"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initialTickets, initialAssets, initialDeliveries, initialUsers, initialConsumables, initialRates } from './data';
import { supabase } from './supabase';
const StoreContext = createContext();

// Helper to identify unconfigured automatic SFDC cases
const isAutoUnconfiguredCase = (task) => {
    const caseNum = task.caseNumber || task.case_number;
    if (!caseNum) return false;
    
    // Check if it's an 8-digit SFDC case number
    const isSFDCCase = /^\d{8}$/.test(String(caseNum).trim());
    if (!isSFDCCase) return false;
    
    // Check if it has no assets, yubikeys, or active accessories
    const hasNoAssets = !task.assets || task.assets.length === 0;
    const hasNoYubikeys = !task.yubikeys || task.yubikeys.length === 0;
    const hasNoAccessories = !task.accessories || !Object.values(task.accessories).some(v => v === true || v === 'true');
    
    const isUnconfigured = !task.method || task.method === 'Sin método' || task.method === 'Pendiente' || 
                           !task.status || task.status === 'No requiere accion' || task.status === 'Pendiente';
    
    return hasNoAssets && hasNoYubikeys && hasNoAccessories && isUnconfigured;
};

let volatileMaxTicketId = null;

export function StoreProvider({ children }) {
    const [tickets, setTickets] = useState([]);
    const [assets, setAssets] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [sfdcCases, setSfdcCases] = useState([]);
    const [lastImportedCases, setLastImportedCases] = useState([]);
    const [users, setUsers] = useState(initialUsers);
    const [currentUser, setCurrentUser] = useState(null);
    const [rates, setRates] = useState(initialRates);
    const [yubikeys, setYubikeys] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]); // Realtime Presence State
    const [logisticsTasks, setLogisticsTasks] = useState([]); // Relational Sub-Cases
    const [warehouseLocations, setWarehouseLocations] = useState([]);
    const lastRefreshTimeRef = useRef(0);
    const migratingCasesRef = useRef(new Set());

    // --- Client Mapping Helper ---
    const getClientName = (filterName) => {
        if (!filterName || filterName === 'Todos') return 'Todos';
        const CLIENT_MAP = {
            'Argentina': 'SFDC-Argentina',
            'Chile': 'SFDC-Chile',
            'Colombia': 'SFDC-Colombia',
            'Costa Rica': 'SFDC-Costa Rica',
            'Uruguay': 'SFDC-Uruguay',
            'Commvault': 'Commvault',
            'Sycomp-SRV': 'Sycomp-SRV'
        };
        return CLIENT_MAP[filterName] || filterName;
    };

    // --- Data Mappers (Sync logic) ---
    const formatAsset = (a) => {
        if (!a) return null;
        return {
            ...a,
            dateLastUpdate: a.date_last_update,
            updatedBy: a.updated_by,
            boxNumber: a.box_number,
            eolDate: a.eol_date,
            hardwareSpec: a.hardware_spec,
            modelNumber: a.model_number,
            partNumber: a.part_number,
            purchaseOrder: a.purchase_order,
            sfdcCase: a.sfdc_case,
            imei2: a.imei_2,
            cod: a.cod,
            lastAssetCheck: a.last_asset_check,
            locationId: a.location_id,
            dateMapped: a.date_mapped,
            addByUser: a.add_by_user,
            photoUrl: a.photo_url || null
        };
    };

    const formatTicket = (t) => {
        if (!t) return null;
        return {
            ...t,
            client: t.client || null,
            deliveryStatus: t.delivery_status,
            deliveryCompletedDate: t.delivery_completed_date,
            associatedCases: t.associated_assets || [],
            excludedCases: t.excluded_cases || [],
            internalNotes: t.internal_notes || [],
            deliveryDetails: t.delivery_details,
            chatLog: t.chat_log || [],
            instructionsUpdatedBy: t.instructions_updated_by
        };
    };

    const formatTask = (t) => {
        if (!t) return null;
        return {
            ...t,
            caseNumber: t.case_number,
            deliveryPerson: t.delivery_person,
            assignedTo: t.assigned_to,
            timeSlot: t.time_slot,
            trackingNumber: t.tracking_number,
            deliveryInfo: t.delivery_info || {},
            deliveryOrder: t.delivery_order || 0,
            coordinatedBy: t.coordinated_by,
            chatLog: t.chat_log || [],
            // Staged workflow fields
            caseType: t.case_type || 'independiente', // 'entrega' | 'recoleccion' | 'independiente'
            dependsOn: t.depends_on || []           // Array of task IDs this task depends on
        };
    };

    const [loading, setLoading] = useState(true);
    const [countryFilter, setCountryFilter] = useState('Todos'); // 'Todos', dynamic entities...
    const [entities, setEntities] = useState([]); // Dynamic regions/clients

    // Referencia para leer el filtro de país/entorno actual en callbacks asíncronos y evitar stale closures
    const countryFilterRef = useRef('Todos');

    // Sincronizar referencia y persistir en localStorage ante cambios en el estado
    useEffect(() => {
        countryFilterRef.current = countryFilter;
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('assetflow_country_filter', countryFilter);
        }
    }, [countryFilter]);

    // Cargar la selección de localStorage al montar en el cliente para evitar mismatch de hidratación
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedFilter = window.localStorage.getItem('assetflow_country_filter');
            if (savedFilter) {
                setCountryFilter(savedFilter);
                countryFilterRef.current = savedFilter;
            }
        }
    }, []);
    
    // Referencia para leer el estado actual del usuario dentro de callbacks asíncronos (evita cierres stale)
    const currentUserRef = useRef(currentUser);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    // Cargar datos persistentes al iniciar desde Supabase
    const refreshData = async (force = false) => {
        const nowTime = Date.now();
        if (!force && nowTime - lastRefreshTimeRef.current < 5000) {
            console.log("refreshData throttled to prevent redundant queries");
            return;
        }
        lastRefreshTimeRef.current = nowTime;
        try {
            console.log("Refreshing App Data... (Manual or Auto)");
            if (force) {
                console.log("Forced refresh: refreshing Supabase session...");
                await supabase.auth.refreshSession();
            }

            // 1. CRITICAL DATA (Lightweight config/auth data)
            const criticalPromises = [
                supabase.from('users').select('id, name, role, email, username, location_latitude, location_longitude, last_location_update, tracking_enabled'),
                supabase.from('app_config').select('*').eq('key', 'rates').maybeSingle(),
                supabase.from('consumables').select('*').order('id'),
                supabase.from('app_entities').select('*').order('name'),
                supabase.from('warehouse_locations').select('*').order('id')
            ];

            const criticalResults = await Promise.allSettled(criticalPromises);

            const usersResult = criticalResults[0];
            const configResult = criticalResults[1];
            const consResult = criticalResults[2];

            if (usersResult.status === 'fulfilled') {
                const { data, error } = usersResult.value;
                if (!error && data) setUsers(data);
            }

            if (configResult.status === 'fulfilled') {
                const { data, error } = configResult.value;
                if (!error && data && data.value) setRates({ ...initialRates, ...data.value });
            }

            if (consResult.status === 'fulfilled') {
                const { data, error } = consResult.value;
                if (!error && data) setConsumables(data);
            }
            if (criticalResults[3] && criticalResults[3].status === 'fulfilled') {
                const { data, error } = criticalResults[3].value;
                if (!error && data) {
                    setEntities(data);
                    // Priorizar SFDC-Argentina o Argentina por defecto si existe
                    const defaultEntity = data.find(e => e.name === 'SFDC-Argentina') || data.find(e => e.name === 'Argentina') || data[0];
                    if (data.length > 0 && (countryFilterRef.current === 'Todos' || !countryFilterRef.current)) {
                        setCountryFilter(defaultEntity.name);
                    }
                }
            }
            if (criticalResults[4] && criticalResults[4].status === 'fulfilled') {
                const { data, error } = criticalResults[4].value;
                if (!error && data) setWarehouseLocations(data);
            }

            // Immediately set loading to false so the user enters the site under 200ms
            setLoading(false);

            // 2. HEAVY DATA PREFETCHING (Executed asynchronously in the background)
            (async () => {
                try {
                    console.log("Background prefetching heavy data...");
                    
                    // Assets Paginated Fetch
                    const fetchAllAssets = async () => {
                        let allData = [];
                        let start = 0;
                        const step = 1000;
                        while (true) {
                            const { data, error } = await supabase.from('assets').select('*').range(start, start + step - 1);
                            if (error) return { data: null, error };
                            if (data) allData = [...allData, ...data];
                            if (!data || data.length < step) break;
                            start += step;
                        }
                        return { data: allData, error: null };
                    };

                    const heavyResults = await Promise.all([
                        supabase.from('sfdc_cases').select('*'),
                        supabase.from('tickets').select('*').order('date', { ascending: false }),
                        fetchAllAssets(),
                        supabase.from('expenses').select('*').order('date', { ascending: false }),
                        supabase.from('deliveries').select('*'),
                        supabase.from('yubikeys').select('*').order('created_at', { ascending: false }),
                        supabase.from('logistics_tasks').select('*').order('created_at', { ascending: false })
                    ]);

                    const [
                        { data: sfdcData }, { data: ticketsData }, { data: assetsData },
                        { data: expensesData }, { data: delData }, { data: yubikeysData }, { data: tasksData }
                    ] = heavyResults;

                    if (sfdcData) setSfdcCases(sfdcData.map(c => ({ ...c, ...c.raw_data, caseNumber: c.case_number })));
                    if (ticketsData) setTickets(ticketsData.map(formatTicket));
                    if (assetsData) setAssets(assetsData.map(formatAsset));
                    if (expensesData) setExpenses(expensesData);
                    if (delData) setDeliveries(delData);
                    if (yubikeysData) setYubikeys(yubikeysData);
                    if (tasksData) setLogisticsTasks(tasksData.map(formatTask));

                    console.log("App Heavy Data Background Prefetched Successfully");
                } catch (err) {
                    console.error("Error prefetching heavy data in background:", err);
                }
            })();

            console.log("App Critical Data Loaded Successfully");
        } catch (err) {
            console.error("Error refreshing critical data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Cargar datos persistentes al iniciar desde Supabase
    useEffect(() => {
        let subscription = null;
        let presenceChannel = null;
        let timeoutId = null;
        let isUnmounted = false;

        const initAuth = async () => {
            setLoading(true);

            // Failsafe: Force stop loading after 20 seconds to prevent infinite hang
            timeoutId = setTimeout(() => {
                if (!isUnmounted) {
                    console.warn("Auth check timed out - forcing app load");
                    setLoading(false);
                }
            }, 20000);

            try {
                // Check session explicitly first. If no session is present in storage,
                // we can immediately set loading to false so the login screen renders instantly (under 10ms).
                const sessionResponse = await supabase.auth.getSession();
                const initialSession = sessionResponse?.data?.session;
                if (!initialSession) {
                    console.log("No initial session found - loading login screen instantly");
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    if (!isUnmounted) setLoading(false);
                }

                // Rely on onAuthStateChange to handle actual session updates, logins, and token refreshes
                const authResponse = supabase.auth.onAuthStateChange((event, session) => {
                    console.log('Auth State Change:', event, session?.user?.email);

                    // Skip redundant profile and data fetch on token refresh if currentUser is already loaded.
                    // This avoids executing database calls during the synchronous auth state transition phase
                    // which can trigger Web Lock deadlocks in the Supabase SDK.
                    if (event === 'TOKEN_REFRESHED' && currentUserRef.current) {
                        console.log('Skipping profile & data fetch for TOKEN_REFRESHED event.');
                        if (!isUnmounted) setLoading(false);
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = null;
                        }
                        return;
                    }

                    // Run the async profile/data fetch outside the auth state callback execution flow
                    // to prevent deadlock on Supabase auth client locks.
                    setTimeout(async () => {
                        try {
                            if (session?.user) {
                                // Only block UI if we don't have a user yet (initial load or login)
                                const isInitialLoad = !currentUserRef.current;
                                if (isInitialLoad && !isUnmounted) setLoading(true);

                                // 1. Fetch User Profile
                                let profile = null;
                                const { data, error } = await supabase
                                    .from('users')
                                    .select('*')
                                    .eq('email', session.user.email?.toLowerCase())
                                    .maybeSingle();

                                if (data) profile = data;

                                if (profile) {
                                    // Only update currentUser if it's new or changed to avoid redundant re-renders
                                    const shouldUpdateUser = !currentUserRef.current || currentUserRef.current.email !== profile.email;
                                    if (shouldUpdateUser && !isUnmounted) {
                                        setCurrentUser({ ...profile, id: profile.id, uuid: session.user.id });
                                    }
                                    
                                    // Start/Update Presence Tracking
                                    if (profile.email && (!presenceChannel || shouldUpdateUser)) {
                                        try {
                                            if (presenceChannel) {
                                                supabase.removeChannel(presenceChannel);
                                            }

                                            presenceChannel = supabase.channel('presence-channel', {
                                                config: {
                                                    presence: {
                                                        key: profile.email,
                                                    },
                                                },
                                            });
                                            presenceChannel
                                                .on('presence', { event: 'sync' }, () => {
                                                    const newState = presenceChannel.presenceState();
                                                    const usersMap = new Map();
                                                    for (const key in newState) {
                                                        if (newState[key] && newState[key].length > 0) {
                                                            const presenceData = newState[key][0];
                                                            const uniqueId = presenceData.email || presenceData.name || key;
                                                            if (!usersMap.has(uniqueId)) {
                                                                usersMap.set(uniqueId, {
                                                                    email: key,
                                                                    ...presenceData
                                                                });
                                                            }
                                                        }
                                                    }
                                                    const users = Array.from(usersMap.values());
                                                    console.log('👥 Online Users Sync:', users);
                                                    if (!isUnmounted) setOnlineUsers(users);
                                                })
                                                .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                                                    console.log('👤 User Joined:', key, newPresences);
                                                })
                                                .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                                                    console.log('👋 User Left:', key, leftPresences);
                                                })
                                                .subscribe(async (status) => {
                                                    if (status === 'SUBSCRIBED') {
                                                        const userStatus = {
                                                            name: profile.name,
                                                            email: profile.email,
                                                            role: profile.role,
                                                            online_at: new Date().toISOString(),
                                                        };
                                                        await presenceChannel.track(userStatus);
                                                    }
                                                });
                                        } catch (presenceError) {
                                            console.error("Error initializing presence:", presenceError);
                                        }
                                    }
                                } else {
                                    if (!isUnmounted) {
                                        setCurrentUser({
                                            id: session.user.id,
                                            email: session.user.email,
                                            role: 'user',
                                            name: session.user.user_metadata?.full_name || session.user.email
                                        });
                                    }
                                }

                                // 2. Fetch App Data NOW that we have a session
                                await refreshData();
                            } else {
                                if (!isUnmounted) {
                                    setCurrentUser(null);
                                }
                                // Unsubscribe from presence channel on logout
                                if (presenceChannel) {
                                    supabase.removeChannel(presenceChannel);
                                    presenceChannel = null;
                                    if (!isUnmounted) setOnlineUsers([]);
                                }
                            }
                        } catch (callbackErr) {
                            console.error("Error inside onAuthStateChange callback:", callbackErr);
                        } finally {
                            // Clear the failsafe timeout ONLY when we successfully resolved or errored the flow
                            if (timeoutId) {
                                clearTimeout(timeoutId);
                                timeoutId = null;
                            }
                            if (!isUnmounted) setLoading(false);
                        }
                    }, 0);
                });
                subscription = authResponse?.data?.subscription;
            } catch (error) {
                if (error.name === 'AbortError' || error.message?.includes('aborted')) {
                    console.warn('Auth request was aborted (likely due to navigation or race condition)');
                } else {
                    console.error('Auth initialization error:', error);
                }
                if (!isUnmounted) {
                    clearTimeout(timeoutId);
                    setLoading(false);
                }
            }
        };

        const channel = supabase.channel('realtime-tickets')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                (payload) => {
                    console.log('Realtime Ticket Change:', payload.eventType, payload.new?.id);
                    if (payload.eventType === 'INSERT') {
                        const formatted = formatTicket(payload.new);
                        setTickets(prev => {
                            if (prev.some(old => old.id === formatted.id)) return prev;
                            return [formatted, ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const formatted = formatTicket(payload.new);
                        setTickets(prev => prev.map(old => old.id === formatted.id ? formatted : old));
                    } else if (payload.eventType === 'DELETE') {
                        setTickets(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const tasksChannel = supabase.channel('realtime-tasks')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'logistics_tasks' },
                (payload) => {
                    console.log('Realtime Task Change:', payload.eventType, payload.new?.id);
                    if (payload.eventType === 'INSERT') {
                        const formatted = formatTask(payload.new);
                        setLogisticsTasks(prev => [formatted, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        const formatted = formatTask(payload.new);
                        setLogisticsTasks(prev => prev.map(old => old.id === formatted.id ? formatted : old));
                    } else if (payload.eventType === 'DELETE') {
                        setLogisticsTasks(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const assetsChannel = supabase.channel('realtime-assets')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'assets' },
                (payload) => {
                    console.log('Realtime Asset Change:', payload.eventType, payload.new?.id);
                    if (payload.eventType === 'INSERT') {
                        const formatted = formatAsset(payload.new);
                        setAssets(prev => [formatted, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        const formatted = formatAsset(payload.new);
                        setAssets(prev => prev.map(old => old.id === formatted.id ? formatted : old));
                    } else if (payload.eventType === 'DELETE') {
                        setAssets(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const warehouseChannel = supabase.channel('realtime-warehouse')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'warehouse_locations' },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setWarehouseLocations(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        setWarehouseLocations(prev => prev.map(old => old.id === payload.new.id ? payload.new : old));
                    } else if (payload.eventType === 'DELETE') {
                        setWarehouseLocations(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        const usersChannel = supabase.channel('realtime-users')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'users' },
                (payload) => {
                    console.log('Realtime User Change:', payload.eventType, payload.new?.id);
                    if (payload.eventType === 'INSERT') {
                        setUsers(prev => [...prev, payload.new]);
                    } else if (payload.eventType === 'UPDATE') {
                        setUsers(prev => prev.map(old => old.id === payload.new.id ? payload.new : old));
                    } else if (payload.eventType === 'DELETE') {
                        setUsers(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        let lastFocusRefreshTime = Date.now();

        const handleVisibilityChange = async () => {
            if (document.visibilityState === 'visible') {
                console.log("Tab visible - verifying session validity");
                try {
                    const sessionRes = await supabase.auth.getSession();
                    const session = sessionRes?.data?.session;
                    let didRefresh = false;

                    if (session) {
                        const expiresAt = session.expires_at; // Unix timestamp
                        const now = Math.floor(Date.now() / 1000);
                        // If expired or expiring in less than 15 minutes (900 seconds)
                        if (expiresAt - now < 900) {
                            console.log("JWT is close to expiration. Forcing token refresh...");
                            await supabase.auth.refreshSession();
                            didRefresh = true;
                        }
                    }

                    // Only trigger a heavy data refresh if the token was refreshed 
                    // OR if 15 minutes have passed since the last heavy refresh.
                    const nowMs = Date.now();
                    if (didRefresh || nowMs - lastFocusRefreshTime > 15 * 60 * 1000) {
                        lastFocusRefreshTime = nowMs;
                        await refreshData();
                    } else {
                        console.log("Tab visible - skipping heavy data refresh (cooldown active)");
                    }
                } catch (err) {
                    console.error("Error on visibility change:", err);
                }
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        initAuth();

        return () => {
            isUnmounted = true;
            if (timeoutId) clearTimeout(timeoutId);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (subscription) subscription.unsubscribe();
            supabase.removeChannel(channel);
            supabase.removeChannel(tasksChannel);
            supabase.removeChannel(assetsChannel);
            supabase.removeChannel(warehouseChannel);
            supabase.removeChannel(usersChannel);
            if (presenceChannel) {
                supabase.removeChannel(presenceChannel);
            }
        };
    }, []);

    // Global background migration: Promote configured legacy/auto cases in JSON to logistics_tasks DB table
    useEffect(() => {
        if (loading || !tickets || tickets.length === 0 || !logisticsTasks) return;

        const migrationPromises = [];

        for (const ticket of tickets) {
            const legacyCases = ticket.associatedCases || [];
            if (legacyCases.length === 0) continue;

            const ticketTasks = logisticsTasks.filter(t => t.ticket_id === ticket.id);

            const casesToMigrate = legacyCases.filter(lc => {
                const hasNoRealTask = lc.caseNumber && lc.caseNumber !== 'Caso Principal' &&
                    !ticketTasks.some(rt => String(rt.caseNumber || rt.case_number).trim() === String(lc.caseNumber).trim());
                
                // Avoid migrating cases that are already migrating
                const isNotMigrating = lc.caseNumber && !migratingCasesRef.current.has(String(lc.caseNumber).trim());
                
                return hasNoRealTask && isNotMigrating && !isAutoUnconfiguredCase(lc);
            });

            if (casesToMigrate.length > 0) {
                console.log(`[Global Migration] Found ${casesToMigrate.length} configured legacy cases to migrate for ticket ${ticket.id}`);

                // Mark cases as migrating immediately
                casesToMigrate.forEach(lc => migratingCasesRef.current.add(String(lc.caseNumber).trim()));

                const migrateTicketCases = async () => {
                    try {
                        for (const lc of casesToMigrate) {
                            const caseNum = lc.caseNumber;
                            const taskSubject = lc.subject || '';
                            const taskStatus = lc.status || lc.logistics?.status || 'Pendiente';
                            const taskMethod = lc.method || lc.logistics?.method || '';

                            const taskDeliveryPerson = lc.delivery_person || lc.deliveryPerson || lc.logistics?.deliveryPerson || lc.logistics?.delivery_person || '';
                            const taskAssignedTo = lc.assigned_to || lc.assignedTo || lc.logistics?.assignedTo || lc.logistics?.assigned_to || '';

                            const taskDate = lc.date || lc.logistics?.date || '';
                            const taskTimeSlot = lc.time_slot || lc.timeSlot || lc.logistics?.timeSlot || lc.logistics?.time_slot || 'AM';
                            const taskAddress = lc.address || lc.logistics?.address || '';

                            const taskTrackingNumber = lc.tracking_number || lc.trackingNumber || lc.logistics?.trackingNumber || lc.logistics?.tracking_number || '';

                            const taskAssets = lc.assets || [];
                            const taskAccessories = lc.accessories || { backpack: false, screenFilter: false, filterSize: '14"' };
                            const taskYubikeys = lc.yubikeys || [];
                            const taskDeliveryInfo = lc.deliveryInfo || lc.delivery_info || lc.logistics?.deliveryInfo || {};
                            const taskCoordinatedBy = lc.coordinated_by || lc.coordinatedBy || lc.logistics?.coordinatedBy || '';

                            const newTask = {
                                ticketId: ticket.id,
                                caseNumber: caseNum,
                                subject: taskSubject,
                                status: taskStatus,
                                method: taskMethod,
                                deliveryPerson: taskDeliveryPerson,
                                assignedTo: taskAssignedTo,
                                date: taskDate,
                                timeSlot: taskTimeSlot,
                                address: taskAddress,
                                trackingNumber: taskTrackingNumber,
                                assets: taskAssets,
                                accessories: taskAccessories,
                                yubikeys: taskYubikeys,
                                deliveryInfo: taskDeliveryInfo,
                                coordinatedBy: taskCoordinatedBy
                            };

                            console.log(`[Global Migration] Promoting legacy task ${caseNum} to DB:`, newTask);
                            const result = await addLogisticsTask(newTask);
                            if (result && result.error) {
                                throw new Error(`DB Error adding task: ${result.error.message || JSON.stringify(result.error)}`);
                            }
                        }

                        // Remove migrated cases from JSON array
                        const migratedNumbers = casesToMigrate.map(c => String(c.caseNumber).trim());
                        const remainingCases = (ticket.associatedCases || []).filter(c =>
                            !c.caseNumber || !migratedNumbers.includes(String(c.caseNumber).trim())
                        );

                        console.log(`[Global Migration] Removing migrated cases from ticket JSON:`, migratedNumbers);
                        await updateTicket(ticket.id, { associatedCases: remainingCases });
                    } catch (err) {
                        console.error(`[Global Migration] Error migrating cases for ticket ${ticket.id}:`, err);
                        // On failure, remove from migrating set so we can retry
                        casesToMigrate.forEach(lc => migratingCasesRef.current.delete(String(lc.caseNumber).trim()));
                    }
                };

                migrationPromises.push(migrateTicketCases());
            }
        }

        if (migrationPromises.length > 0) {
            Promise.all(migrationPromises).then(() => {
                console.log("[Global Migration] All pending migrations processed successfully.");
            });
        }
    }, [loading, tickets, logisticsTasks]);

    // Auth Actions
    const login = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            console.error('Login error:', error);
            return { error };
        }

        // Fetch user profile to return full user object
        if (data.session) {
            // 1. Try to find in the local pre-loaded users list first (instant, case-insensitive)
            let profile = users.find(u => u.email?.toLowerCase() === email?.toLowerCase());

            if (!profile) {
                // 2. Fallback: Wait 50ms to allow Supabase client headers to synchronize and then query the DB
                await new Promise(resolve => setTimeout(resolve, 50));
                
                const { data: dbProfile } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email?.toLowerCase())
                    .maybeSingle();

                if (dbProfile) profile = dbProfile;
            }

            const loggedInUser = profile 
                ? { ...profile, id: profile.id, uuid: data.user.id } 
                : { ...data.user, role: 'pending', email: email?.toLowerCase() };

            // Set currentUser state synchronously in the context to avoid routing race conditions
            setCurrentUser(loggedInUser);

            return { user: loggedInUser };
        }

        return { error: 'No session created' };
    };

    const updatePassword = async (newPassword) => {
        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) {
            console.error('Error updating password:', error);
            return { error };
        }
        return { data };
    };

    const signup = async (email, password, fullName) => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    tickets,
                    assets,
                    consumables,
                    yubikeys,
                    deliveries,
                    sfdcCases, full_name: fullName
                }
            }
        });

        if (error) {
            console.error('Signup error:', error);
            return { error };
        }

        return { user: data.user, session: data.session };
    };

    const logout = async () => {
        try {
            // Forzar un timeout máximo de 1.5s para evitar que se quede colgado
            await Promise.race([
                supabase.auth.signOut(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500))
            ]);
        } catch (e) {
            console.warn("Supabase auth api signout failed, forcing local clear", e)
        }
        setCurrentUser(null);
        
        // Ensure ALL local storage items related to Supabase are cleared
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('sb-')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.removeItem('currentUser');
    };

    const sendPasswordReset = async (email) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/dashboard/settings',
        });
        return { error };
    };

    // User Management Actions
    const addUser = async (user) => {
        const newUser = { ...user, id: `USR-${Date.now()}` };
        const { error } = await supabase.from('users').insert([newUser]);
        if (!error) setUsers([...users, newUser]);
    };

    const deleteUser = async (id) => {
        console.log("Attempting to delete user:", id);
        const { error } = await supabase.from('users').delete().eq('id', id);
        if (error) {
            console.error("Error deleting user:", error);
            alert(`Error al eliminar usuario: ${error.message}`);
        } else {
            console.log("User deleted successfully from DB");
            setUsers(prev => prev.filter(u => u.id !== id));
        }
    };

    const updateUser = async (id, updatedData) => {
        const { error } = await supabase.from('users').update(updatedData).eq('id', id);
        if (error) {
            console.error('Error updating user:', error);
            alert(`Error al actualizar usuario: ${error.message}`);
        } else {
            setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updatedData } : u));
        }
        return { error };
    };

    // Consumable Actions


    // SFDC Actions
    const importSfdcCases = async (newCases) => {
        const formatted = newCases.map(c => ({
            case_number: c.caseNumber,
            subject: c.subject,
            description: c.description || '',
            status: c.status,
            priority: c.priority,
            requester: c.requestedFor,
            date_opened: c.dateOpened,
            country: c.country,
            raw_data: c
        }));
        const { error } = await supabase.from('sfdc_cases').upsert(formatted);

        if (error) {
            console.error('ERROR IMPORTANDO SFDC A SUPABASE:', error);
            alert('Error al guardar en base de datos: ' + error.message);
        }

        if (!error) {
            setLastImportedCases(newCases); // Guardamos TODO el array de nuevos casos para poder filtrarlos en UI
            // Refresh local state
            const { data } = await supabase.from('sfdc_cases').select('*');
            setSfdcCases(data.map(c => ({ ...c, ...c.raw_data, caseNumber: c.case_number })));
        }
    };

    const clearSfdcCases = async (country) => {
        let query = supabase.from('sfdc_cases').delete().neq('case_number', '0'); // Base query (match all)

        // Si se provee un país válido que no sea 'Todos', filtramos la eliminación por país
        if (country && country !== 'Todos') {
            query = query.ilike('country', `%${country}%`); // Usar ilike para búsqueda flexible (ej. "chile" == "Chile")
        }

        const { error } = await query;
        if (!error) {
            if (country && country !== 'Todos') {
                // Borrar solo los de ese país del estado local (ignorando mayúsculas/minúsculas)
                setLastImportedCases(prev => prev.filter(c => !c.country || !c.country.toLowerCase().includes(country.toLowerCase())));
                setSfdcCases(prev => prev.filter(c => !c.country || !c.country.toLowerCase().includes(country.toLowerCase())));
            } else {
                // Borrar todos
                setLastImportedCases([]);
                setSfdcCases([]);
            }
        } else {
            console.error('ERROR AL BORRAR CASOS SFDC:', error);
            alert('Error al borrar los casos de la base de datos: ' + error.message);
        }
    };

    const removeSfdcCase = async (caseNumber) => {
        const { error } = await supabase.from('sfdc_cases').delete().eq('case_number', caseNumber);
        if (!error) setSfdcCases(sfdcCases.filter(c => c.caseNumber !== caseNumber));
    };

    // App Actions
    const addTicket = async (ticket) => {
        let maxId = volatileMaxTicketId;
        
        if (maxId === null) {
            maxId = tickets.reduce((max, t) => {
                if (!t.id) return max;
                const num = parseInt(t.id.split('-')[1]);
                return isNaN(num) ? max : Math.max(max, num);
            }, 1000);
        }

        let attempt = 0;
        let createdTicket = null;

        while (attempt < 5) {
            const currentAttemptMaxId = maxId + 1 + attempt;
            const nextId = `CAS-${currentAttemptMaxId}`;

            const newTicket = {
                ...ticket,
                id: nextId,
                date: new Date().toISOString().split('T')[0]
            };

            const cleanString = (str) => {
                if (typeof str !== 'string') return String(str || '');
                // Strip invisible characters, but EXCLUDE \n (\x0A), \r (\x0D), \t (\x09)
                return str.trim().replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
            };

            const cleanLogistics = { ...(newTicket.logistics || {}) };
            Object.keys(cleanLogistics).forEach(key => {
                if (typeof cleanLogistics[key] === 'string') {
                    cleanLogistics[key] = cleanString(cleanLogistics[key]);
                }
            });

            const dbData = {
                id: newTicket.id,
                subject: cleanString(newTicket.subject),
                requester: cleanString(newTicket.requester),
                priority: newTicket.priority,
                status: newTicket.status,
                date: newTicket.date,
                client: ticket.client || getClientName(countryFilter),
                delivery_status: newTicket.deliveryStatus || 'Pendiente',
                logistics: cleanLogistics,
                associated_assets: newTicket.associatedCases || [],
                accessories: newTicket.accessories || {},
                internal_notes: newTicket.internalNotes || [],
                delivery_details: newTicket.deliveryDetails || {}
            };

            console.log("addTicket: Attempting DB insert...", dbData);
            
            const withRetryAndTimeout = async (queryFn, timeoutMs = 15000, maxRetries = 2) => {
                for (let i = 0; i <= maxRetries; i++) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                    try {
                        const res = await queryFn(controller.signal);
                        clearTimeout(timeoutId);
                        if (res?.error?.message === 'FetchError: The user aborted a request.') {
                            throw new Error('TIMEOUT');
                        }
                        return res;
                    } catch (err) {
                        clearTimeout(timeoutId);
                        const isTimeout = err.name === 'AbortError' || err.message === 'TIMEOUT' || (err.message && err.message.includes('fetch'));
                        if (isTimeout && i < maxRetries) {
                            console.warn(`Query timeout (attempt ${i + 1}/${maxRetries + 1}). Retrying...`);
                            continue;
                        }
                        return { error: err };
                    }
                }
            };

            const { error } = await withRetryAndTimeout((signal) => {
                // Fetch abort signal injection into supabase JS client is tricky, but the global fetch handles it
                return supabase.from('tickets').insert([dbData]).abortSignal(signal);
            });
            
            console.log("addTicket: DB insert result:", { error });

            if (!error) {
                const formattedNewTicket = formatTicket(dbData);
                // IMPORTANT: update directly based on previous state to avoid race conditions.
                // Prevent duplicate ticket in React state if Realtime channel already processed the INSERT event.
                setTickets(prev => {
                    if (prev.some(t => t.id === formattedNewTicket.id)) {
                        return prev.map(t => t.id === formattedNewTicket.id ? formattedNewTicket : t);
                    }
                    return [formattedNewTicket, ...prev];
                });
                volatileMaxTicketId = currentAttemptMaxId; // Update global counter instantly
                createdTicket = formattedNewTicket;
                break; // Success!
            }

            // If error is NOT unique violation (23505), throw it immediately
            if (error.code !== '23505') {
                console.error('Error creating ticket:', error);
                throw error;
            }

            // If it WAS a collision, try next ID
            console.warn(`Collision for ID ${nextId}, retrying...`);
            attempt++;
        }

        if (!createdTicket) {
            throw new Error("No se pudo generar un ID único después de varios intentos.");
        }

        // --- AUTOMATIZACIÓN DESACTIVADA: El usuario prefiere crear los casos consolidados a mano. ---
        console.log(`Ticket ${createdTicket.id} creado sin sub-casos automáticos (se crearán manualmente).`);

        return createdTicket;
    };

    const addAsset = async (asset) => {
        const now = new Date().toISOString();
        let attempt = 0;
        let createdAsset = null;

        const cleanString = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : String(str || '');

        while (attempt < 5) {
            // Get TRUE max ID from DB to avoid collisions
            const { data: maxData } = await supabase.from('assets').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
            let maxId = 0;
            if (maxData && maxData.id) {
                const num = parseInt(maxData.id.replace('AST-', ''));
                if (!isNaN(num)) maxId = num;
            }

            const nextIdNum = maxId + 1 + attempt;
            const dbAsset = {
                ...asset,
                id: `AST-${String(nextIdNum).padStart(4, '0')}`,
                date: asset.date || now.split('T')[0],
                updated_by: currentUser?.name || 'Sistema',
                date_last_update: now,
                hardware_spec: cleanString(asset.hardwareSpec),
                model_number: cleanString(asset.modelNumber),
                part_number: cleanString(asset.partNumber),
                purchase_order: cleanString(asset.purchaseOrder),
                sfdc_case: cleanString(asset.sfdcCase),
                eol_date: asset.eolDate,
                imei_2: cleanString(asset.imei2),
                country: asset.country,
                box_number: cleanString(asset.boxNumber),
                cod: cleanString(asset.cod),
                photo_url: asset.photoUrl || asset.photo_url || null,
                add_by_user: currentUser?.name || 'Sistema'
            };

            // Clean all top-level strings in the spread asset object too
            Object.keys(dbAsset).forEach(key => {
                if (typeof dbAsset[key] === 'string') {
                    dbAsset[key] = cleanString(dbAsset[key]);
                }
            });

            if (dbAsset.status === 'Asignado') {
                dbAsset.location_id = null;
                asset.locationId = null;
            }

            // Remove camelCase fields and frontend-only fields
            ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2', 'boxNumber', 'dateLastUpdate', 'updatedBy', 'lastAssetCheck', 'locationId', 'dateMapped', 'addByUser', 'photoUrl'].forEach(k => delete dbAsset[k]);

            const { error } = await supabase.from('assets').insert([dbAsset]);
            if (!error) {
                const uiAsset = { ...asset, ...dbAsset, dateLastUpdate: now, updatedBy: dbAsset.updated_by, photoUrl: dbAsset.photo_url };
                setAssets(prev => [uiAsset, ...prev]);
                createdAsset = uiAsset;
                break;
            }

            if (error.code === '23505') {
                attempt++;
                console.warn("Collision in addAsset, retrying...", attempt);
                if (attempt >= 5) throw new Error("No se pudo generar un ID único después de 5 intentos.");
            } else {
                console.error('Supabase error inserting asset:', error);
                throw error;
            }
        }
    };

    const addAssets = async (newAssets) => {
        const now = new Date().toISOString();
        let attempt = 0;
        let success = false;

        while (attempt < 5) {
            // Get TRUE max ID from DB
            const { data: maxData } = await supabase.from('assets').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
            let maxId = 0;
            if (maxData && maxData.id) {
                const num = parseInt(maxData.id.replace('AST-', ''));
                if (!isNaN(num)) maxId = num;
            }

            const cleanString = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : String(str || '');

            const formattedAssets = newAssets.map((asset, index) => {
                const nextIdNum = maxId + index + 1 + (attempt * 100); // Shift if retrying
                const dbAsset = {
                    ...asset,
                    id: `AST-${String(nextIdNum).padStart(4, '0')}`,
                    date: asset.date || now.split('T')[0],
                    status: asset.status || 'Disponible',
                    assignee: asset.assignee || 'Almacén',
                    updated_by: currentUser?.name || 'Importación',
                    date_last_update: now,
                    hardware_spec: cleanString(asset.hardwareSpec),
                    model_number: cleanString(asset.modelNumber),
                    part_number: cleanString(asset.partNumber),
                    purchase_order: cleanString(asset.purchaseOrder),
                    sfdc_case: cleanString(asset.sfdcCase),
                    eol_date: asset.eolDate,
                    imei_2: cleanString(asset.imei2),
                    country: asset.country,
                    notes: cleanString(asset.notes),
                    vendor: cleanString(asset.vendor),
                    oem: cleanString(asset.oem),
                    type: asset.type,
                    name: cleanString(asset.name),
                    serial: cleanString(asset.serial),
                    box_number: cleanString(asset.boxNumber),
                    cod: cleanString(asset.cod),
                    add_by_user: currentUser?.name || 'Importación'
                };
                
                // Extra cleaning for any other strings
                Object.keys(dbAsset).forEach(key => {
                    if (typeof dbAsset[key] === 'string') {
                        dbAsset[key] = cleanString(dbAsset[key]);
                    }
                });

                if (dbAsset.status === 'Asignado') {
                    dbAsset.location_id = null;
                }

                ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2', 'boxNumber'].forEach(k => delete dbAsset[k]);
                return dbAsset;
            });

            const { error } = await supabase.from('assets').insert(formattedAssets);
            if (!error) {
                const uiAssets = formattedAssets.map(a => ({
                    ...a,
                    dateLastUpdate: a.date_last_update,
                    updatedBy: a.updated_by,
                    hardwareSpec: a.hardware_spec,
                    modelNumber: a.model_number,
                    partNumber: a.part_number,
                    purchaseOrder: a.purchase_order,
                    sfdcCase: a.sfdc_case,
                    eolDate: a.eol_date,
                    imei2: a.imei_2,
                    locationId: a.status === 'Asignado' ? null : a.location_id
                }));
                setAssets(prev => [...uiAssets, ...prev]);
                success = true;
                break;
            }

            if (error.code === '23505') {
                attempt++;
                console.warn("Collision in bulk addAssets, retrying...", attempt);
            } else {
                console.error('Supabase Error adding assets:', error);
                throw error;
            }
        }

        if (!success) {
            throw new Error("No se pudo completar la importación debido a colisiones constantes de IDs.");
        }
    };

    const addDelivery = async (delivery) => {
        const newDelivery = { ...delivery, id: `ENV-${2025 + (deliveries?.length || 0)}`, date: new Date().toISOString().split('T')[0] };
        const { error } = await supabase.from('deliveries').insert([newDelivery]);
        if (!error) setDeliveries(prev => [newDelivery, ...prev]);
    };

    const deleteDelivery = async (id) => {
        const { error } = await supabase.from('deliveries').delete().eq('id', id);
        if (!error) setDeliveries(prev => prev.filter(d => d.id !== id));
    };

    const deleteDeliveries = async (ids) => {
        const { error } = await supabase.from('deliveries').delete().in('id', ids);
        if (!error) setDeliveries(prev => prev.filter(d => !ids.includes(d.id)));
    };

    const updateTicket = async (id, updatedData) => {
        try {
            // Auto-asignación de fecha de resolución al transicionar a un estado cerrado/resuelto
            const resolvedStatuses = ['Resuelto', 'Cerrado', 'Caso SFDC Cerrado', 'Servicio Facturado'];
            let requesterName = null;
            let isTransitioningToResolved = false;

            if (updatedData.status !== undefined) {
                const currentTicket = tickets.find(t => t.id === id);
                isTransitioningToResolved = resolvedStatuses.includes(updatedData.status) && 
                    (!currentTicket || !resolvedStatuses.includes(currentTicket.status));
                
                requesterName = currentTicket?.requester || updatedData.requester;
                
                if (isTransitioningToResolved) {
                    // Validar regla de Swap/Collection:
                    // Si el ticket es un caso principal de Swap/Bundle, no permitir cerrarlo si aún hay retiros (Collection) pendientes del mismo usuario.
                    const isSwapTicket = /swap|bundle|intercambio/i.test(currentTicket?.subject || '') || /swap|bundle|intercambio/i.test(updatedData.subject || '');
                    if (isSwapTicket && requesterName) {
                        const openCollectionTicket = tickets.find(t => 
                            t.id !== id && 
                            t.requester?.toLowerCase() === requesterName.toLowerCase() && 
                            /collection|retiro|recupero|baja/i.test(t.subject || '') && 
                            !resolvedStatuses.includes(t.status)
                        );
                        
                        if (openCollectionTicket) {
                            throw new Error(`No se puede cerrar el caso principal (Swap) porque existe un caso de retiro/recupero pendiente (${openCollectionTicket.id}) para ${requesterName}.`);
                        }
                    }

                    if (updatedData.deliveryCompletedDate === undefined) {
                        const localDate = new Date();
                        const yyyy = localDate.getFullYear();
                        const mm = String(localDate.getMonth() + 1).padStart(2, '0');
                        const dd = String(localDate.getDate()).padStart(2, '0');
                        updatedData.deliveryCompletedDate = `${yyyy}-${mm}-${dd}`;
                    }
                } else if (!resolvedStatuses.includes(updatedData.status)) {
                    if (updatedData.deliveryCompletedDate === undefined) {
                        updatedData.deliveryCompletedDate = null;
                    }
                }
            }

            // Map camelCase to snake_case for Supabase
            const dbUpdate = {};
            const cleanString = (str) => {
                if (typeof str !== 'string') return String(str || '');
                // Strip invisible characters, but EXCLUDE \n (\x0A), \r (\x0D), and \t (\x09) to preserve formatting
                return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F\u200B-\u200F\uFEFF]/g, '').trim();
            };

            // Core fields
            if (updatedData.subject !== undefined) dbUpdate.subject = cleanString(updatedData.subject);
            if (updatedData.requester !== undefined) dbUpdate.requester = cleanString(updatedData.requester);
            if (updatedData.priority !== undefined) dbUpdate.priority = updatedData.priority;
            if (updatedData.status !== undefined) dbUpdate.status = updatedData.status;
            if (updatedData.client !== undefined) dbUpdate.client = cleanString(updatedData.client);

            // Logistics & JSONB fields
            if (updatedData.deliveryStatus !== undefined) dbUpdate.delivery_status = updatedData.deliveryStatus;
            if (updatedData.logistics !== undefined) {
                const cleanLogistics = { ...updatedData.logistics };
                Object.keys(cleanLogistics).forEach(key => {
                    const val = cleanLogistics[key];
                    if (val !== null && val !== undefined) {
                        cleanLogistics[key] = typeof val === 'string' ? cleanString(val) : String(val);
                    }
                });
                dbUpdate.logistics = cleanLogistics;
            }
            if (updatedData.associatedCases !== undefined) dbUpdate.associated_assets = updatedData.associatedCases;
            if (updatedData.excludedCases !== undefined) dbUpdate.excluded_cases = updatedData.excludedCases;
            if (updatedData.accessories !== undefined) dbUpdate.accessories = updatedData.accessories;
            if (updatedData.internalNotes !== undefined) dbUpdate.internal_notes = updatedData.internalNotes;
            if (updatedData.deliveryDetails !== undefined) dbUpdate.delivery_details = updatedData.deliveryDetails;
            if (updatedData.deliveryCompletedDate !== undefined) {
                dbUpdate.delivery_completed_date = updatedData.deliveryCompletedDate === '' ? null : updatedData.deliveryCompletedDate;
            }
            if (updatedData.instructions !== undefined) dbUpdate.instructions = cleanString(updatedData.instructions);
            if (updatedData.instructionsUpdatedBy !== undefined) dbUpdate.instructions_updated_by = updatedData.instructionsUpdatedBy;
            if (updatedData.chatLog !== undefined) dbUpdate.chat_log = updatedData.chatLog;

            // Validar que haya algo para actualizar
            if (Object.keys(dbUpdate).length === 0) return;

            const errSpan = typeof document !== 'undefined' ? document.getElementById('save-error-msg') : null;
            if (errSpan) errSpan.textContent = "2.1.1 Guardando en BD principal...";

            const withRetryAndTimeout = async (getQueryBuilderFn, ms, retries = 1) => {
                for (let attempt = 0; attempt <= retries; attempt++) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), ms);
                    
                    try {
                        const queryBuilder = getQueryBuilderFn();
                        const promise = queryBuilder.abortSignal(controller.signal);
                        const result = await promise;
                        clearTimeout(timeoutId);
                        
                        if (result.error && (result.error.status === 401 || result.error.code === 'PGRST301' || result.error.message?.includes('JWT'))) {
                            if (attempt < retries) {
                                console.warn("JWT error, refreshing session...");
                                if (errSpan) errSpan.textContent = `2.1.${attempt + 2} Recuperando sesión...`;
                                await supabase.auth.refreshSession();
                                continue;
                            }
                        }
                        
                        return result;
                    } catch (err) {
                        clearTimeout(timeoutId);
                        const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
                        
                        if (isTimeout && attempt < retries) {
                            console.warn(`Database timeout on attempt ${attempt + 1}. Retrying...`);
                            if (errSpan) errSpan.textContent = `2.1.${attempt + 2} Reintentando por Timeout...`;
                            continue;
                        }
                        if (isTimeout) {
                            return { error: new Error(`Timeout: La base de datos no respondió tras ${ms/1000}s. Intenta recargar la página para liberar conexiones.`) };
                        }
                        if (attempt < retries) {
                            continue;
                        }
                        return { error: err };
                    }
                }
            };

            let { error } = await withRetryAndTimeout(() => supabase.from('tickets').update(dbUpdate).eq('id', id), 15000, 1);

            if (errSpan) errSpan.textContent = "2.1.3 BD respondió...";

            if (error) {
                console.error('Error updating ticket:', error);
                throw error;
            } else {
                if (errSpan) errSpan.textContent = "2.1.5 Actualizando estado React...";
                // 1. Actualizar el estado del ticket en React
                setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));

                // 2. PROPAGACIÓN EN CASCADA: Si se modificó el bloque de logística (address, phone, etc.)
                //    actualizar todas las sub-tareas que NO tienen dirección propia (dependen del padre).
                if (updatedData.logistics !== undefined) {
                    const newAddress = updatedData.logistics?.address || null;
                    
                    if (newAddress) {
                        // Encontrar todas las sub-tareas de este ticket sin dirección propia
                        const dependentTasks = logisticsTasks.filter(
                            t => t.ticket_id === id && !t.address
                        );

                        if (dependentTasks.length > 0) {
                            // No guardamos la dirección en la DB (sigue siendo null),
                            // la actualización del state de tickets es suficiente para que
                            // el fallback dinámico muestre la dirección correcta en todos lados.
                            // El estado ya fue actualizado arriba con setTickets.
                            console.log(`[Cascada] ${dependentTasks.length} sub-tareas del ticket ${id} heredarán la nueva dirección automáticamente.`);
                        }

                        // Si hay sub-tareas CON dirección propia guardada (override viejo),
                        // forzar que la DB también las actualice para mantener consistencia.
                        const overridedTasks = logisticsTasks.filter(
                            t => t.ticket_id === id && t.address && t.address !== newAddress
                        );

                        if (overridedTasks.length > 0) {
                            // Solo actualizamos en DB las que tienen un override diferente al nuevo.
                            // Esto sincroniza los datos viejos "congelados" con el nuevo valor del Servicio.
                            const overridedIds = overridedTasks.map(t => t.id);
                            const { error: cascadeError } = await supabase
                                .from('logistics_tasks')
                                .update({ address: null }) // Borrar el override → vuelven a ser dinámicas
                                .in('id', overridedIds);
                            
                            if (!cascadeError) {
                                // Actualizar estado local en React también
                                setLogisticsTasks(prev => prev.map(t =>
                                    overridedIds.includes(t.id) ? { ...t, address: null } : t
                                ));
                                console.log(`[Cascada] Limpiadas ${overridedIds.length} sub-tareas con dirección desactualizada.`);
                            } else {
                                console.error('[Cascada] Error limpiando direcciones obsoletas:', cascadeError);
                            }
                        }
                    }
                }

                // Si se resolvió con éxito un ticket de tipo Retiro/Collection,
                // verificar si podemos cerrar automáticamente los Swap tickets asociados que estuvieran pendientes.
                if (isTransitioningToResolved && requesterName && /collection|retiro|recupero|baja/i.test(tickets.find(t => t.id === id)?.subject || '')) {
                    const openSwapTickets = tickets.filter(t => 
                        t.id !== id &&
                        t.requester?.toLowerCase() === requesterName.toLowerCase() &&
                        /swap|bundle|intercambio/i.test(t.subject || '') &&
                        !resolvedStatuses.includes(t.status)
                    );

                    for (const swapTicket of openSwapTickets) {
                        const tasksForSwap = logisticsTasks.filter(t => String(t.ticket_id) === String(swapTicket.id));
                        if (tasksForSwap.length > 0) {
                            const TERMINAL_STATUSES = ['Entregado', 'No requiere accion', 'Cancelado', 'Recuperado'];
                            const allTerminal = tasksForSwap.every(t => TERMINAL_STATUSES.includes(t.status));
                            
                            const otherOpenCollection = tickets.find(t => 
                                t.id !== swapTicket.id &&
                                t.id !== id &&
                                t.requester?.toLowerCase() === requesterName.toLowerCase() &&
                                /collection|retiro|recupero|baja/i.test(t.subject || '') &&
                                !resolvedStatuses.includes(t.status)
                            );

                            if (allTerminal && !otherOpenCollection) {
                                console.log(`[Cascade Auto-Close] Cerrando ticket de Swap ${swapTicket.id} por finalización del retiro.`);
                                setTimeout(() => {
                                    updateTicket(swapTicket.id, { status: 'Resuelto' }).catch(err => 
                                        console.error(`Error en auto-cierre cascada del ticket ${swapTicket.id}:`, err)
                                    );
                                }, 100);
                            }
                        }
                    }
                }

                return true;
            }
        } catch (error) {
            console.error("Critical exception in updateTicket:", error);
            throw error;
        }
    };;

    const deleteTicket = async (id) => {
        // Find all case numbers associated with this ticket
        const ticket = tickets.find(t => t.id === id);
        const caseNumbers = [];
        if (ticket) {
            const mainCaseMatch = (ticket.subject || '').match(/SFDC-(\d+)/);
            if (mainCaseMatch) caseNumbers.push(mainCaseMatch[1]);
            
            const assocCases = ticket.associatedCases || [];
            assocCases.forEach(ac => {
                if (ac.caseNumber) caseNumbers.push(String(ac.caseNumber).trim());
            });
        }
        const allTargets = [id, ...caseNumbers];

        // 1. Desvincular activos asociados a este ticket (si los hay)
        await supabase.from('assets').update({ sfdc_case: null }).in('sfdc_case', allTargets);

        // 2. Eliminar el ticket
        const { error } = await supabase.from('tickets').delete().eq('id', id);

        if (!error) {
            setTickets(prev => prev.filter(t => t.id !== id));
            // Actualizar estado local de activos también
            setAssets(prev => prev.map(a => allTargets.includes(a.sfdcCase) ? { ...a, sfdcCase: null } : a));
        }
    };

    const deleteTickets = async (ids) => {
        try {
            const caseNumbers = [];
            ids.forEach(id => {
                const ticket = tickets.find(t => t.id === id);
                if (ticket) {
                    const mainCaseMatch = (ticket.subject || '').match(/SFDC-(\d+)/);
                    if (mainCaseMatch) caseNumbers.push(mainCaseMatch[1]);
                    
                    const assocCases = ticket.associatedCases || [];
                    assocCases.forEach(ac => {
                        if (ac.caseNumber) caseNumbers.push(String(ac.caseNumber).trim());
                    });
                }
            });
            const allTargets = [...ids, ...caseNumbers];

            // 1. Desvincular activos masivamente
            const { error: assetError } = await supabase.from('assets').update({ sfdc_case: null }).in('sfdc_case', allTargets);
            if (assetError) {
                console.error("Error unlinking assets:", assetError);
            }

            // 2. Eliminar tickets
            const { error } = await supabase.from('tickets').delete().in('id', ids);

            if (error) {
                console.error("Error deleting tickets:", error);
                alert(`Error al eliminar tickets masivamente: ${error.message}`);
            } else {
                setTickets(prev => prev.filter(t => !ids.includes(t.id)));
                // Actualizar activos locales
                setAssets(prev => prev.map(a => allTargets.includes(a.sfdcCase) ? { ...a, sfdcCase: null } : a));
                alert("Tickets eliminados correctamente.");
            }
        } catch (e) {
            console.error("Exception in deleteTickets:", e);
            alert(`Error inesperado: ${e.message}`);
        }
    };

    const updateAsset = async (id, updatedData) => {
        const now = new Date().toISOString();
        const cleanString = (str) => typeof str === 'string' ? str.trim().replace(/[\r\n\t\0]+/g, ' ') : String(str || '');
        
        // When status is 'Asignado' (assigned to a person), location automatically becomes 'empleado'
        let targetStatus = updatedData.status;
        if (targetStatus === undefined) {
            const currentAsset = assets.find(a => String(a.id) === String(id));
            if (currentAsset) {
                targetStatus = currentAsset.status;
            }
        }
        if (targetStatus === 'Asignado') {
            updatedData.locationId = null;
        }

        // Whitelist only valid DB columns and clean strings
        const dbUpdate = {
            name: updatedData.name !== undefined ? cleanString(updatedData.name) : undefined,
            type: updatedData.type,
            serial: updatedData.serial !== undefined ? cleanString(updatedData.serial) : undefined,
            status: targetStatus,
            assignee: updatedData.assignee !== undefined ? cleanString(updatedData.assignee) : undefined,
            date: updatedData.date,
            notes: updatedData.notes !== undefined ? cleanString(updatedData.notes) : undefined,
            country: updatedData.country,
            vendor: updatedData.vendor !== undefined ? cleanString(updatedData.vendor) : undefined,
            oem: updatedData.oem !== undefined ? cleanString(updatedData.oem) : undefined,
            imei: updatedData.imei !== undefined ? cleanString(updatedData.imei) : undefined,
            hardware_spec: updatedData.hardwareSpec !== undefined ? cleanString(updatedData.hardwareSpec) : undefined,
            model_number: updatedData.modelNumber !== undefined ? cleanString(updatedData.modelNumber) : undefined,
            part_number: updatedData.partNumber !== undefined ? cleanString(updatedData.partNumber) : undefined,
            purchase_order: updatedData.purchaseOrder !== undefined ? cleanString(updatedData.purchaseOrder) : undefined,
            sfdc_case: updatedData.sfdcCase !== undefined ? cleanString(updatedData.sfdcCase) : undefined,
            eol_date: updatedData.eolDate,
            imei_2: updatedData.imei2 !== undefined ? cleanString(updatedData.imei2) : undefined,
            box_number: updatedData.boxNumber !== undefined ? cleanString(updatedData.boxNumber) : undefined,
            cod: updatedData.cod !== undefined ? cleanString(updatedData.cod) : undefined,
            location_id: updatedData.locationId === "" ? null : updatedData.locationId,
            date_mapped: updatedData.dateMapped,
            last_asset_check: updatedData.lastAssetCheck,
            photo_url: updatedData.photoUrl !== undefined ? updatedData.photoUrl : (updatedData.photo_url !== undefined ? updatedData.photo_url : undefined),
            updated_by: currentUser?.name || 'Sistema',
            date_last_update: now
        };

        // Remove undefined fields to avoid accidental nulling
        Object.keys(dbUpdate).forEach(key => dbUpdate[key] === undefined && delete dbUpdate[key]);

        let { error } = await supabase.from('assets').update(dbUpdate).eq('id', id);

        // Auto-retry once on authorization / JWT errors
        if (error && (error.status === 401 || error.code === 'PGRST301' || error.message?.includes('JWT') || error.message?.includes('claim'))) {
            console.warn("Update asset failed due to JWT expiration. Attempting automatic recovery...");
            const refreshRes = await supabase.auth.refreshSession();
            const session = refreshRes?.data?.session;
            if (session) {
                console.log("Session refreshed successfully. Retrying asset update...");
                const retryResult = await supabase.from('assets').update(dbUpdate).eq('id', id);
                error = retryResult.error;
            }
        }

        if (!error) {
            setAssets(prev => prev.map(a => String(a.id) === String(id) ? { ...a, ...updatedData, dateLastUpdate: now, updatedBy: dbUpdate.updated_by } : a));
            // Failsafe: Sync everything after a few ms to ensure KPIs are updated correctly
            setTimeout(() => refreshData(), 500);
        } else {
            console.error("Error updating asset:", error);
            alert(`Error al actualizar el equipo: ${error.message}. Verifica que todas las migraciones SQL (39-43) hayan sido ejecutadas.`);
        }
    };

    const deleteAsset = async (id) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (!error) setAssets(prev => prev.filter(a => String(a.id) !== String(id)));
    };

    const updateConsumable = async (id, updatedData) => {
        const { error } = await supabase.from('consumables').update(updatedData).eq('id', id);
        if (!error) setConsumables(consumables.map(c => c.id === id ? { ...c, ...updatedData } : c));
    };

    const updateConsumableStock = async (id, newStock) => {
        const { error } = await supabase.from('consumables').update({ stock: newStock }).eq('id', id);
        if (!error) {
            setConsumables(consumables.map(c => c.id === id ? { ...c, stock: newStock } : c));
        } else {
            console.error("Error updating stock:", error);
        }
    };

    const addConsumable = async (consumable) => {
        let attempt = 0;
        let createdConsumable = null;

        // Calculate the highest existing ID to start with from LOCAL state
        let maxId = consumables.reduce((max, c) => {
            const num = parseInt((c.id || '').replace('CON-', ''));
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);

        while (attempt < 5) {
            const nextId = `CON-${String(maxId + 1 + attempt).padStart(3, '0')}`;
            alert("addConsumable iteración " + attempt + ", intentando ID " + nextId);

            const newConsumable = {
                ...consumable,
                id: nextId,
                stock: parseInt(consumable.stock) || 0
            };

            alert("Llamando insert de supabase (Vía FETCH NATIVO)...");
            
            let error = null;
            try {
                const sessionRes = await supabase.auth.getSession();
                const token = sessionRes?.data?.session?.access_token;
                
                const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/consumables`, {
                    method: 'POST',
                    headers: {
                        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(newConsumable)
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    error = errorData;
                    // Normalizar el error para que coincida con el formato de supabase-js
                    if (error.code === '23505') {
                         // already handled below
                    }
                } else {
                    const data = await response.json();
                    // success
                }
            } catch (err) {
                error = err;
            }

            alert("Insert finalizó con error = " + (error ? (error.message || JSON.stringify(error)) : "null"));

            if (!error) {
                createdConsumable = newConsumable;
                setConsumables(prev => [...prev, newConsumable]);
                break; // Success!
            }

            // If error is due to unique constraint violation (duplicate key)
            if (error.code === '23505') {
                alert("Colisión de ID (23505), buscando max ID en DB...");
                console.warn(`Collision for ID ${nextId}, fetching real max ID from DB...`);

                // Fetch ALL IDs to compute the TRUE max ID in JS, because string sorting in DB fails for CON-010 vs CON-009
                const { data: allIds } = await supabase
                    .from('consumables')
                    .select('id');

                if (allIds && allIds.length > 0) {
                    const dbMax = allIds.reduce((max, d) => {
                        const num = parseInt((d.id || '').replace('CON-', ''));
                        return !isNaN(num) ? Math.max(max, num) : max;
                    }, 0);
                    
                    if (dbMax > maxId) {
                        maxId = dbMax;
                        // Reset attempt because we have a new base to start from
                        attempt = 0;
                        continue;
                    }
                }

                // If we couldn't get a better max ID, just increment attempt
                attempt++;
            } else {
                // If other error, throw it immediately
                console.error("Error adding consumable:", error);
                throw error;
            }
        }

        if (!createdConsumable) {
            throw new Error("No se pudo generar un ID único para el consumible después de varios intentos/consultas.");
        }

        return createdConsumable;
    };

    // Yubikey Actions
    const updateYubikey = async (id, updatedData) => {
        const { error } = await supabase.from('yubikeys').update(updatedData).eq('id', id);
        if (!error) setYubikeys(yubikeys.map(y => y.id === id ? { ...y, ...updatedData } : y));
    };

    // Removed updateYubikeyStock as we are now tracking individual items

    const addYubikey = async (yubikey) => {
        let attempt = 0;
        let createdYubikey = null;

        // Calculate max ID
        let maxId = yubikeys.reduce((max, y) => {
            const num = parseInt((y.id || '').replace('YBK-', ''));
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);

        while (attempt < 5) {
            const nextId = `YBK-${String(maxId + 1 + attempt).padStart(3, '0')}`;

            const newYubikey = {
                ...yubikey,
                id: nextId,
                stock: 1 // Default to 1 for individual tracking
            };

            const { error } = await supabase.from('yubikeys').insert([newYubikey]);

            if (!error) {
                createdYubikey = newYubikey;
                setYubikeys(prev => [...prev, newYubikey]);
                break;
            }

            if (error.code === '23505') {
                // Collision, query DB for true max
                const { data: maxIdData } = await supabase
                    .from('yubikeys')
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1)
                    .single();

                if (maxIdData && maxIdData.id) {
                    const dbMax = parseInt(maxIdData.id.replace('YBK-', ''));
                    if (!isNaN(dbMax) && dbMax > maxId) {
                        maxId = dbMax;
                        attempt = 0;
                        continue;
                    }
                }
                attempt++;
            } else {
                console.error("Error adding yubikey:", error);
                throw error;
            }
        }

        if (!createdYubikey) {
            throw new Error("No se pudo generar un ID único para el Yubikey.");
        }
    };

    const deleteYubikey = async (id) => {
        const { error } = await supabase.from('yubikeys').delete().eq('id', id);
        if (!error) setYubikeys(prev => prev.filter(y => String(y.id) !== String(id)));
    };

    const deleteConsumable = async (id) => {
        const { error } = await supabase.from('consumables').delete().eq('id', id);
        if (!error) setConsumables(prev => prev.filter(c => String(c.id) !== String(id)));
    };

    const clearInventory = async (countryName) => {
        if (countryName && countryName !== 'Todos') {
            // Delete only for specific country
            const { error: assetError } = await supabase.from('assets').delete().neq('id', '0').eq('country', countryName);
            const { error: consError } = await supabase.from('consumables').delete().neq('id', '0').eq('country', countryName);

            if (assetError || consError) {
                console.error("Error clearing inventory for country:", assetError, consError);
                alert("Hubo un error al vaciar el inventario del país. Revisa la consola.");
            } else {
                setAssets(prev => prev.filter(a => a.country !== countryName));
                setConsumables(prev => prev.filter(c => c.country !== countryName));
            }
        } else {
            // Delete ALL (Global)
            await supabase.from('assets').delete().neq('id', '0');
            await supabase.from('consumables').delete().neq('id', '0');
            setAssets([]);
            setConsumables([]);
        }
    };

    const clearInventoryLaptops = async (countryName) => {
        const type = 'Laptop';
        if (countryName && countryName !== 'Todos') {
            const { error: assetError } = await supabase.from('assets').delete().eq('country', countryName).eq('type', type);
            if (assetError) {
                console.error("Error clearing laptops for country:", assetError);
                alert("Hubo un error al vaciar las laptops del país.");
            } else {
                setAssets(prev => prev.filter(a => !(a.country === countryName && a.type === type)));
            }
        } else {
            const { error } = await supabase.from('assets').delete().eq('type', type);
            if(error) console.error(error);
            setAssets(prev => prev.filter(a => a.type !== type));
        }
    };

    const clearInventorySmartphones = async (countryName) => {
        const type = 'Smartphone';
        if (countryName && countryName !== 'Todos') {
            const { error: assetError } = await supabase.from('assets').delete().eq('country', countryName).eq('type', type);
            if (assetError) {
                console.error("Error clearing smartphones for country:", assetError);
                alert("Hubo un error al vaciar los smartphones del país.");
            } else {
                setAssets(prev => prev.filter(a => !(a.country === countryName && a.type === type)));
            }
        } else {
            const { error } = await supabase.from('assets').delete().eq('type', type);
            if(error) console.error(error);
            setAssets(prev => prev.filter(a => a.type !== type));
        }
    };

    const updateRates = async (newRates, silent = false) => {
        try {
            // Sanitize rates to ensure clean JSON (converts NaN to null, strips undefined)
            const sanitizedRates = JSON.parse(JSON.stringify(newRates));

            const { error } = await supabase.from('app_config').upsert({ key: 'rates', value: sanitizedRates });

            if (error) {
                console.error('Full Error Object:', JSON.stringify(error, null, 2));
                alert(`Error al guardar tarifas: ${error.message || 'Error desconocido revisa la consola'}`);
            } else {
                setRates(sanitizedRates);
                if (!silent) alert('Tarifas guardadas correctamente');
            }
        } catch (e) {
            console.error('Exception updating rates:', e);
            alert(`Excepción al guardar: ${e.message}`);
        }
    };

    const addExpense = async (expense) => {
        const { data, error } = await supabase.from('expenses').insert([expense]).select();
        if (error) {
            console.error('Error adding expense:', error);
            alert('Error al agregar gasto');
        } else if (data) {
            setExpenses(prev => [data[0], ...prev]);
        }
    };

    const deleteExpense = async (id) => {
        const { error } = await supabase.from('expenses').delete().eq('id', id);
        if (error) {
            console.error('Error deleting expense:', error);
            alert('Error al eliminar gasto');
        } else {
            setExpenses(prev => prev.filter(e => e.id !== id));
        }
    };

    // --- Logistics Tasks Actions (Relational) ---
    const addLogisticsTask = async (task) => {
        const sanitizeString = (val) => {
            if (typeof val === 'string') {
                const cleaned = val.trim().replace(/[\0]+/g, '');
                return cleaned === '' ? null : cleaned;
            }
            return val;
        };

        const dbTask = {
            ticket_id: task.ticketId,
            case_number: sanitizeString(task.caseNumber),
            subject: sanitizeString(task.subject),
            status: sanitizeString(task.status) || 'Pendiente',
            method: sanitizeString(task.method),
            delivery_person: sanitizeString(task.deliveryPerson),
            assigned_to: sanitizeString(task.assignedTo),
            date: task.date === '' ? null : task.date,
            time_slot: sanitizeString(task.timeSlot) || 'AM',
            address: sanitizeString(task.address),
            tracking_number: sanitizeString(task.trackingNumber),
            assets: task.assets || [],
            accessories: task.accessories || {},
            yubikeys: task.yubikeys || [],
            delivery_info: task.deliveryInfo || {},
            instructions: sanitizeString(task.instructions) || '',
            // Staged workflow fields
            case_type: task.caseType || task.case_type || 'independiente',
            depends_on: task.dependsOn || task.depends_on || []
        };

        const { data, error } = await supabase.from('logistics_tasks').insert([dbTask]).select();
        if (error) {
            console.error('Error adding logistics task:', error);
            return { error };
        }
        if (data) {
            const formatted = formatTask(data[0]);
            setLogisticsTasks(prev => [formatted, ...prev]);
            return { data: formatted };
        }
    };

    const updateLogisticsTask = async (id, updatedData) => {
        try {
            const dbUpdate = {};
            const task = logisticsTasks.find(t => t.id === id);
            
            // --- AUTO-HISTORIAL CENTRALIZADO ---
            if (task && task.ticket_id) {
                const newHistoryNotes = [];
                const taskName = task.case_number || task.subject || 'Caso Asociado';
                
                // 1. Asignaciones
                const pDriver = updatedData.delivery_person || updatedData.deliveryPerson || updatedData.assigned_to || updatedData.assignedTo;
                const cDriver = task.delivery_person || task.deliveryPerson || task.assigned_to || task.assignedTo;
                
                if (pDriver !== undefined && String(pDriver) !== String(cDriver)) {
                    newHistoryNotes.push(`Asignación: Caso [${taskName}] asignado al conductor > ${pDriver || 'Sin asignar'}`);
                }
                
                // 2. Estado
                if ('status' in updatedData && updatedData.status !== task.status) {
                    newHistoryNotes.push(`Estado: Caso [${taskName}] cambió a > '${updatedData.status}'`);
                }
                
                // 3. Coordinación (Fecha y Turno)
                const pDate = updatedData.date;
                const pTime = updatedData.time_slot || updatedData.timeSlot;
                const cDate = task.date;
                const cTime = task.time_slot || task.timeSlot;
                
                if ((pDate !== undefined && pDate !== cDate) || (pTime !== undefined && pTime !== cTime)) {
                    const dateStr = pDate || cDate || 'N/A';
                    const timeStr = pTime || cTime || 'N/A';
                    newHistoryNotes.push(`Coordinación: Caso [${taskName}] agendado para > ${dateStr} (${timeStr})`);
                }
                
                // 4. Activos Físicos
                if ('assets' in updatedData) {
                    const count = updatedData.assets?.length || 0;
                    const currentCount = task.assets?.length || 0;
                    if (count !== currentCount) { 
                        newHistoryNotes.push(`Equipos: Caso [${taskName}] tiene ahora > ${count} dispositivo(s) asignado(s)`);
                    }
                }
                
                // 5. Verificación de Entrega (Recepción)
                const pInfo = updatedData.delivery_info || updatedData.deliveryInfo;
                if (pInfo && pInfo.receivedBy) {
                    // Asegurarse de no duplicar si se edita multiples veces (opcional, pero ayuda)
                    const cInfo = task.delivery_info || task.deliveryInfo;
                    if (!cInfo || cInfo.receivedBy !== pInfo.receivedBy) {
                        newHistoryNotes.push(`Recepción: Caso [${taskName}] recibido por > ${pInfo.receivedBy} (DNI/ID: ${pInfo.dni || 'N/A'})`);
                    }
                }

                // Guardar historial en el ticket padre silenciosamente y auto-resolver si aplica
                if (newHistoryNotes.length > 0 || updatedData.status === 'Entregado') {
                    const parentTicket = tickets.find(t => t.id === task.ticket_id);
                    if (parentTicket) {
                        let currentNotes = parentTicket.internalNotes || [];
                        if (!Array.isArray(currentNotes)) {
                            currentNotes = typeof currentNotes === 'string' ? [{ content: currentNotes, user: 'Sistema', date: new Date().toISOString() }] : [currentNotes];
                        }
                        let finalNotes = [...currentNotes];
                        const userName = currentUser?.name || 'Sistema (Automático)';
                        
                        newHistoryNotes.forEach(content => {
                            finalNotes.push({
                                content: content,
                                user: userName,
                                date: new Date().toISOString()
                            });
                        });
                        
                        const ticketUpdates = { internalNotes: finalNotes };

                        // AUTO-RESOLVER CASO PRINCIPAL SI SE COMPLETA UNA RECOLECCION
                        const isCollection = task.case_type === 'recoleccion' || task.caseType === 'recoleccion' || (task.subject && /recolecci[oó]n|recupero|collection|retir[oar]/i.test(task.subject));
                        
                        if (updatedData.status === 'Entregado' && isCollection) {
                            ticketUpdates.status = 'Resuelto';
                            finalNotes.push({
                                content: `Estado: El ticket principal fue auto-resuelto porque se completó la recolección asociada [${taskName}]`,
                                user: 'Sistema (Automático)',
                                date: new Date().toISOString()
                            });
                        }
                        
                        // Llama a updateTicket localmente. updateTicket emite cambios al state central,
                        // Dejando registro para el Panel Historial. Await this to avoid race conditions.
                        await updateTicket(parentTicket.id, ticketUpdates);
                    }
                }
            }
            // -----------------------------------

            // Unificación total a snake_case (el estándar de nuestra DB)
            const fieldMap = {
                'status': 'status',
                'method': 'method',
                'delivery_person': 'delivery_person',
                'deliveryPerson': 'delivery_person',
                'assigned_to': 'assigned_to',
                'assignedTo': 'assigned_to',
                'date': 'date',
                'time_slot': 'time_slot',
                'timeSlot': 'time_slot',
                'address': 'address',
                'tracking_number': 'tracking_number',
                'trackingNumber': 'tracking_number',
                'assets': 'assets',
                'accessories': 'accessories',
                'yubikeys': 'yubikeys',
                'delivery_info': 'delivery_info',
                'deliveryInfo': 'delivery_info',
                'subject': 'subject',
                'coordinated_by': 'coordinated_by',
                'coordinatedBy': 'coordinated_by',
                'delivery_order': 'delivery_order',
                'deliveryOrder': 'delivery_order',
                'instructions': 'instructions',
                'chat_log': 'chat_log',
                'chatLog': 'chat_log',
                'case_type': 'case_type',
                'caseType': 'case_type',
                'depends_on': 'depends_on',
                'dependsOn': 'depends_on'
            };

            Object.keys(fieldMap).forEach(key => {
                if (updatedData[key] !== undefined) {
                    let val = updatedData[key];
                    
                    // Limpiar strings de caracteres nulos copiados
                    if (typeof val === 'string') {
                        val = val.trim().replace(/[\0]+/g, '');
                    }

                    // Postgres date columns y Foreign Keys no aceptan strings vacíos
                    if ((key === 'date' || key === 'deliveryCompletedDate' || key === 'delivery_completed_date' || key === 'assigned_to' || key === 'assignedTo') && val === '') {
                        val = null;
                    }
                    dbUpdate[fieldMap[key]] = val;
                }
            });

            dbUpdate.updated_at = new Date().toISOString();

            const withRetryAndTimeout = async (getQueryBuilderFn, ms, retries = 1) => {
                for (let attempt = 0; attempt <= retries; attempt++) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), ms);
                    try {
                        const queryBuilder = getQueryBuilderFn();
                        const promise = queryBuilder.abortSignal(controller.signal);
                        const result = await promise;
                        clearTimeout(timeoutId);
                        
                        if (result.error && (result.error.status === 401 || result.error.code === 'PGRST301' || result.error.message?.includes('JWT'))) {
                            if (attempt < retries) {
                                await supabase.auth.refreshSession();
                                continue;
                            }
                        }
                        return result;
                    } catch (err) {
                        clearTimeout(timeoutId);
                        const isTimeout = err.name === 'AbortError' || err.message?.includes('aborted');
                        if (isTimeout && attempt < retries) continue;
                        if (isTimeout) return { error: new Error(`Timeout: La base de datos no respondió tras ${ms/1000}s.`) };
                        if (attempt < retries) continue;
                        return { error: err };
                    }
                }
            };

            let { data: updateResult, error } = await withRetryAndTimeout(
                () => supabase.from('logistics_tasks').update(dbUpdate).eq('id', id).select(),
                15000,
                1
            );
            
            if (error) {
                console.error('Error updating logistics task:', error);
                throw error;
            }
            if (!updateResult || updateResult.length === 0) {
                console.error('No rows updated. Check if task ID exists or RLS policies block the update.');
                throw new Error('No se pudo actualizar la tarea en la base de datos. Verifique sus permisos.');
            }
            
            // --- ASOCIACIÓN DE CAMPOS PARA EL STATE ---
            // Sincronizamos tanto camelCase (UI) como snake_case (DB) para evitar desajustes
            const fullTaskStateUpdate = { ...updatedData };
            Object.entries(fieldMap).forEach(([uiField, dbField]) => {
                if (updatedData[dbField] !== undefined) {
                    fullTaskStateUpdate[uiField] = updatedData[dbField];
                } else if (updatedData[uiField] !== undefined) {
                    fullTaskStateUpdate[dbField] = updatedData[uiField];
                }
            });

            setLogisticsTasks(prev => prev.map(t => t.id === id ? { ...t, ...fullTaskStateUpdate } : t));

            // --- AUTOMATIZACIÓN: Bloquear Caso si sus Dependencias no están Completadas ---
            // Cuando se setea depends_on (caso tipo Recolección), auto-set status a 'Bloqueado'
            // si alguna de sus dependencias todavía no está en estado terminal
            const newDepsRaw = updatedData.depends_on || updatedData.dependsOn;
            if (newDepsRaw && newDepsRaw.length > 0) {
                const TERMINAL = ['Entregado', 'Cancelado', 'No requiere accion', 'Recuperado'];
                const anyDepNotTerminal = newDepsRaw.some(depId => {
                    const depTask = logisticsTasks.find(t => t.id === depId);
                    return !depTask || !TERMINAL.includes(depTask.status);
                });
                if (anyDepNotTerminal && task.status !== 'Bloqueado') {
                    console.log(`Automatización: Bloqueando caso ${id} porque sus dependencias no están completadas`);
                    await supabase.from('logistics_tasks').update({ status: 'Bloqueado', updated_at: new Date().toISOString() }).eq('id', id);
                    setLogisticsTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'Bloqueado' } : t));
                }
            }

            // --- AUTOMATIZACIÓN: Sincronización de Casos en Inventario ---
            // Manejamos tanto la vinculación (suma) como la desvinculación (resta) de activos
            if (updatedData.assets !== undefined) {
                const ticketId = updatedData.ticket_id || task.ticket_id;
                const parentTicket = tickets.find(t => t.id === ticketId);
                
                const oldAssets = task?.assets || [];
                const newAssets = updatedData.assets || [];
                const oldSerials = oldAssets.map(a => a.serial?.toLowerCase()).filter(Boolean);
                const newSerials = newAssets.map(a => a.serial?.toLowerCase()).filter(Boolean);

                // 1. Identificar activos ELIMINADOS (desvincular)
                const removed = oldAssets.filter(oa => oa.serial && !newSerials.includes(oa.serial.toLowerCase()));
                for (const item of removed) {
                    const fullAsset = assets.find(a => a.serial && a.serial.toLowerCase() === item.serial?.toLowerCase());
                    if (fullAsset) {
                        console.log(`Liberando activo ${item.serial} por desvinculación del ticket ${ticketId}`);
                        await updateAsset(fullAsset.id, {
                            sfdcCase: null,
                            status: 'Disponible',
                            assignee: 'Almacén',
                            notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                                   `[${new Date().toLocaleDateString()}] DESVINCULADO de Ticket #${ticketId}. Regresa a Almacén.`
                        });
                    }
                }

                // 2. Identificar activos AGREGADOS o EXISTENTES (vincular/actualizar)
                if (ticketId && newAssets.length > 0) {
                    for (const item of newAssets) {
                        const fullAsset = assets.find(a => a.serial && a.serial.toLowerCase() === item.serial?.toLowerCase());
                        if (fullAsset) {
                            const isRecovery = item.type === 'Recupero';
                            const newAssignee = isRecovery ? 'Almacén' : (parentTicket?.requester || 'Usuario Final');
                            const taskCaseNumber = task.case_number || task.caseNumber;
                            const targetSfdcCase = taskCaseNumber || ticketId;
                            
                            // Solo actualizamos si hay cambios reales para evitar bucles de red
                            if (fullAsset.sfdcCase !== targetSfdcCase || fullAsset.status !== 'Asignado' || fullAsset.assignee !== newAssignee) {
                                console.log(`Sincronizando activo ${item.serial} con ticket ${ticketId} / caso ${targetSfdcCase}`);
                                await updateAsset(fullAsset.id, { 
                                    sfdcCase: targetSfdcCase,
                                    status: 'Asignado',
                                    assignee: newAssignee,
                                    notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                                           `[${new Date().toLocaleDateString()}] ASOCIADO/ACTUALIZADO en Ticket #${ticketId} (Caso: ${targetSfdcCase}) (Asignado a: ${newAssignee})`
                                });
                            }
                        }
                    }
                }
            }

            // --- AUTOMATIZACIÓN: Actualización de Activos en Inventario (Finalización) ---
            if (updatedData.status === 'Entregado') {
                const finalAssets = updatedData.assets || task.assets || [];
                if (finalAssets.length > 0) {
                    console.log(`Finalizando activos para tarea ${id}:`, finalAssets);
                    const parentTicket = tickets.find(t => t.id === task.ticket_id);
                    
                    for (const item of finalAssets) {
                        const fullAsset = assets.find(a => a.serial && a.serial.toLowerCase() === item.serial?.toLowerCase());
                        if (fullAsset) {
                            const isRecovery = item.type === 'Recupero';
                            const newStatus = isRecovery ? 'Verificacion HW' : 'Asignado';
                            const newAssignee = isRecovery ? 'Almacén' : (parentTicket?.requester || 'Usuario Final');
                            const taskCaseNumber = task.case_number || task.caseNumber;
                            const targetSfdcCase = taskCaseNumber || parentTicket?.id;
                            
                            await updateAsset(fullAsset.id, {
                                status: newStatus,
                                assignee: newAssignee,
                                sfdcCase: targetSfdcCase,
                                notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                                       `[${new Date().toLocaleDateString()}] ${isRecovery ? 'RECUPERADO' : 'ENTREGADO'} vía Ticket #${parentTicket?.id || task.ticket_id} (${taskCaseNumber || 'Sub-caso'})`
                            });
                        }
                    }
                }
            }
            
            // --- AUTOMATIZACIÓN: Desbloqueo de Casos Dependientes ---
            // Cuando un caso de Entrega pasa a 'Entregado' o 'Cancelado', desbloquear los casos
            // de Recolección que dependen de él (depends_on contiene su ID)
            const isTerminalUnlock = updatedData.status === 'Entregado' || updatedData.status === 'Cancelado';
            if (isTerminalUnlock) {
                const currentTask = logisticsTasks.find(t => t.id === id);
                if (currentTask && currentTask.ticket_id) {
                    const ticketId = currentTask.ticket_id;
                    const siblingTasks = logisticsTasks.filter(t =>
                        String(t.ticket_id) === String(ticketId) && t.id !== id
                    );

                    // Find sibling tasks that depend on this task AND are currently Bloqueado
                    const toUnlock = siblingTasks.filter(t => {
                        const deps = t.depends_on || t.dependsOn || [];
                        return deps.includes(id) && t.status === 'Bloqueado';
                    });

                    for (const depTask of toUnlock) {
                        // Check all their dependencies — unlock only if ALL are terminal
                        const allDeps = depTask.depends_on || depTask.dependsOn || [];
                        const allDepsTerminal = allDeps.every(depId => {
                            if (depId === id) return true; // This one just became terminal
                            const depTask2 = logisticsTasks.find(t => t.id === depId);
                            return depTask2 && (depTask2.status === 'Entregado' || depTask2.status === 'Cancelado' || depTask2.status === 'No requiere accion');
                        });

                        if (allDepsTerminal) {
                            console.log(`Automatización: Desbloqueando caso ${depTask.id} (${depTask.subject}) → Para Coordinar`);
                            await supabase.from('logistics_tasks').update({ status: 'Para Coordinar', updated_at: new Date().toISOString() }).eq('id', depTask.id);
                            setLogisticsTasks(prev => prev.map(t => t.id === depTask.id ? { ...t, status: 'Para Coordinar' } : t));
                            
                            // Log in history
                            const parentTicket = tickets.find(t => t.id === ticketId);
                            if (parentTicket) {
                                let currentNotes = parentTicket.internalNotes || [];
                                if (!Array.isArray(currentNotes)) currentNotes = [];
                                await updateTicket(ticketId, {
                                    internalNotes: [...currentNotes, {
                                        content: `Desbloqueo automático: El caso [${depTask.subject || depTask.case_number}] quedó disponible para coordinar.`,
                                        user: currentUser?.name || 'Sistema',
                                        date: new Date().toISOString()
                                    }]
                                });
                            }
                        }
                    }
                }
            }

            // --- AUTOMATIZACIÓN: Cierre de Ticket Padre ---
            // Se dispara si una tarea se marca como terminal (Entregado, Cancelado, No requiere accion, Recuperado)
            const TERMINAL_STATUSES = ['Entregado', 'No requiere accion', 'Cancelado', 'Recuperado'];
            if (TERMINAL_STATUSES.includes(updatedData.status)) {
                const currentTask = logisticsTasks.find(t => t.id === id);
                if (currentTask && currentTask.ticket_id) {
                    const ticketId = currentTask.ticket_id;
                    const allTasksForTicket = logisticsTasks.filter(t => 
                        String(t.ticket_id) === String(ticketId)
                    );
                    
                    const currentTasksWithUpdates = allTasksForTicket.map(t => {
                        if (t.id === id) return { ...t, status: updatedData.status };
                        return t;
                    });

                    // Ticket closes when:
                    // 1. At least one task is 'Entregado' (not just cancelled)
                    // 2. ALL tasks are in a terminal state (no active work remaining)
                    const atLeastOneDone = currentTasksWithUpdates.some(t => t.status === 'Entregado');
                    const allTerminal = currentTasksWithUpdates.every(t => TERMINAL_STATUSES.includes(t.status));

                    if (atLeastOneDone && allTerminal) {
                        console.log(`Automatización: Todas las tareas en estado terminal en ticket ${ticketId}. Cerrando ticket...`);
                        await updateTicket(ticketId, { status: 'Resuelto' });
                    }
                }
            }

            // Sincronizar estado global
            refreshData();

            return { success: true };
        } catch (err) {
            console.error('Error in updateLogisticsTask:', err);
            throw err;
        }
    };

    const deleteLogisticsTask = async (id) => {
        const { error } = await supabase.from('logistics_tasks').delete().eq('id', id);
        if (error) {
            console.error('Error deleting logistics task:', error);
            return { error };
        }
        setLogisticsTasks(prev => prev.filter(t => t.id !== id));
        return { success: true };
    };
    // Entity Actions
    const addEntity = async (entity) => {
        const { data, error } = await supabase.from('app_entities').insert([entity]).select().single();
        if (error) {
            console.error('Error adding entity:', error);
            return { error };
        }
        setEntities(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
        return { data };
    };

    const updateEntity = async (id, updatedData) => {
        const { data, error } = await supabase.from('app_entities').update(updatedData).eq('id', id).select().single();
        if (error) {
            console.error('Error updating entity:', error);
            return { error };
        }
        setEntities(prev => prev.map(e => e.id === id ? data : e).sort((a, b) => a.name.localeCompare(b.name)));
        return { data };
    };

    const deleteEntity = async (id) => {
        const { error } = await supabase.from('app_entities').delete().eq('id', id);
        if (error) {
            console.error('Error deleting entity:', error);
            return { error };
        }
        setEntities(prev => prev.filter(e => e.id !== id));
        return { success: true };
    };

    // Warehouse Mapping Actions
    const addWarehouseLocation = async (location) => {
        const { data, error } = await supabase.from('warehouse_locations').insert([location]).select().single();
        if (error) {
            console.error('Error adding location:', error);
            return { error };
        }
        setWarehouseLocations(prev => [...prev, data]);
        return { data };
    };

    const updateWarehouseLocation = async (id, updatedData) => {
        const newId = `${updatedData.aisle}-${updatedData.section}-${updatedData.level}`;
        
        try {
            if (newId !== id) {
                // ID changed! Create new location, update assets, delete old location.
                // 1. Insert new location
                const { data: newLocData, error: insertError } = await supabase
                    .from('warehouse_locations')
                    .insert([{ ...updatedData, id: newId }])
                    .select()
                    .single();
                
                if (insertError) throw insertError;
                
                // 2. Move assets to the new location ID
                const { error: assetError } = await supabase
                    .from('assets')
                    .update({ location_id: newId })
                    .eq('location_id', id);
                
                if (assetError) throw assetError;
                
                // 3. Delete the old location
                const { error: deleteError } = await supabase
                    .from('warehouse_locations')
                    .delete()
                    .eq('id', id);
                
                if (deleteError) throw deleteError;
                
                setWarehouseLocations(prev => prev.map(l => l.id === id ? newLocData : l));
                await refreshData();
                return { data: newLocData };
            } else {
                // ID did not change. Simple update.
                const { data, error } = await supabase
                    .from('warehouse_locations')
                    .update(updatedData)
                    .eq('id', id)
                    .select()
                    .single();
                
                if (error) throw error;
                
                setWarehouseLocations(prev => prev.map(l => l.id === id ? data : l));
                return { data };
            }
        } catch (err) {
            console.error('Error updating warehouse location:', err);
            return { error: err };
        }
    };

    const deleteWarehouseLocation = async (id) => {
        const { error } = await supabase.from('warehouse_locations').delete().eq('id', id);
        if (error) {
            console.error('Error deleting location:', error);
            return { error };
        }
        setWarehouseLocations(prev => prev.filter(l => l.id !== id));
        return { success: true };
    };
    
    const renameWarehouseGroup = async (oldAisle, newAisle) => {
        if (!oldAisle || !newAisle || oldAisle === newAisle) return { error: 'Nombres inválidos' };
        
        try {
            // 1. Obtener todas las ubicaciones actuales del grupo
            const { data: locations, error: fetchError } = await supabase
                .from('warehouse_locations')
                .select('*')
                .eq('aisle', oldAisle);
                
            if (fetchError) throw fetchError;
            if (!locations || locations.length === 0) return { error: 'No se encontraron ubicaciones en este grupo' };

            // 2. Para cada ubicación, crear la nueva y mover los activos
            for (const loc of locations) {
                const newId = loc.id.replace(oldAisle, newAisle);
                
                // Crear nueva ubicación (copiando datos)
                const { error: insertError } = await supabase
                    .from('warehouse_locations')
                    .insert([{ ...loc, id: newId, aisle: newAisle }]);
                
                if (insertError && insertError.code !== '23505') throw insertError;

                // Mover activos a la nueva ubicación
                const { error: assetError } = await supabase
                    .from('assets')
                    .update({ location_id: newId })
                    .eq('location_id', loc.id);
                
                if (assetError) throw assetError;

                // Eliminar ubicación vieja
                await supabase.from('warehouse_locations').delete().eq('id', loc.id);
            }
            
            await refreshData();
            return { success: true };
        } catch (err) {
            console.error('Error al renombrar grupo:', err);
            return { error: err.message };
        }
    };

    const mapAssetToLocation = async (assetId, locationId) => {
        const now = new Date().toISOString();
        const { error } = await supabase.from('assets').update({
            location_id: locationId,
            date_mapped: now,
            date_last_update: now,
            updated_by: currentUser?.name || 'Scanner'
        }).eq('id', assetId);

        if (error) {
            console.error('Error mapping asset to location:', error);
            return { error };
        }

        // Also update location status if needed
        if (locationId) {
            await supabase.from('warehouse_locations').update({ status: 'Ocupado' }).eq('id', locationId);
        }

        setAssets(prev => prev.map(a => String(a.id) === String(assetId) ? { ...a, locationId, dateMapped: now } : a));
        return { success: true };
    };

    return (
        <StoreContext.Provider value={{
            tickets, assets, consumables, yubikeys, deliveries, sfdcCases, lastImportedCases, users, currentUser, rates, expenses, loading,
            entities, addEntity, updateEntity, deleteEntity,
            logisticsTasks, addLogisticsTask, updateLogisticsTask, deleteLogisticsTask,
            addTicket, updateTicket, deleteTicket, deleteTickets, addAsset, addAssets, updateAsset, deleteAsset,
            addDelivery, deleteDelivery, deleteDeliveries, updateConsumableStock, updateConsumable, addConsumable, deleteConsumable,
            addYubikey, updateYubikey, deleteYubikey,
            clearInventory, clearInventoryLaptops, clearInventorySmartphones, updateRates, addExpense, deleteExpense,
            importSfdcCases, clearSfdcCases, removeSfdcCase,
            countryFilter, setCountryFilter, getClientName,
            login, logout, signup, addUser, deleteUser, updateUser, updatePassword, sendPasswordReset,
            onlineUsers, refreshData, setLoading,
            warehouseLocations, setWarehouseLocations,
            addWarehouseLocation, updateWarehouseLocation, deleteWarehouseLocation, mapAssetToLocation, renameWarehouseGroup
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export const useStore = () => useContext(StoreContext);
