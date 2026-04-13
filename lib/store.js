"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { initialTickets, initialAssets, initialDeliveries, initialUsers, initialConsumables, initialRates } from './data';
import { supabase } from './supabase';
const StoreContext = createContext();

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

    const [loading, setLoading] = useState(true);
    const [countryFilter, setCountryFilter] = useState('Todos'); // 'Todos', 'Argentina', 'Chile', 'Colombia'
    
    // Referencia para leer el estado actual del usuario dentro de callbacks asíncronos (evita cierres stale)
    const currentUserRef = useRef(currentUser);
    useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

    // Cargar datos persistentes al iniciar desde Supabase
    const refreshData = async () => {
        try {
            console.log("Refreshing App Data... (Manual or Auto)");

            // 1. CRITICAL DATA
            const criticalPromises = [
                supabase.from('users').select('id, name, role, email, username, location_latitude, location_longitude, last_location_update, tracking_enabled'),
                supabase.from('app_config').select('*').eq('key', 'rates').maybeSingle(),
                supabase.from('consumables').select('*').order('id')
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

            setLoading(false);

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

            // 2. HEAVY DATA
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
            if (ticketsData) setTickets(ticketsData.map(t => ({ ...t, deliveryStatus: t.delivery_status, associatedCases: t.associated_assets || [] })));
            if (assetsData) setAssets(assetsData.map(a => ({ ...a, dateLastUpdate: a.date_last_update, updatedBy: a.updated_by })));
            if (expensesData) setExpenses(expensesData);
            if (delData) setDeliveries(delData);
            if (yubikeysData) setYubikeys(yubikeysData);
            if (tasksData) setLogisticsTasks(tasksData.map(t => ({ 
                ...t, 
                caseNumber: t.case_number,
                deliveryInfo: t.delivery_info || t.deliveryInfo
            })));

            console.log("App Data Refreshed Successfully");
        } catch (err) {
            console.error("Error refreshing data:", err);
        } finally {
            setLoading(false);
        }
    };

    // Cargar datos persistentes al iniciar desde Supabase
    useEffect(() => {
        let subscription = null;
        let presenceChannel = null;

        const initAuth = async () => {
            setLoading(true);

            let timeoutId = null;
            let isUnmounted = false;

            // Failsafe: Force stop loading after 10 seconds to prevent infinite hang
            timeoutId = setTimeout(() => {
                if (!isUnmounted) {
                    console.warn("Auth check timed out - forcing app load");
                    setLoading(false);
                }
            }, 10000);

            try {
                // Check session explicitly first to avoid hanging if listener delays
                const sessionResponse = await supabase.auth.getSession();
                const initialSession = sessionResponse?.data?.session;
                if (!initialSession) {
                    console.log("No initial session found");
                    clearTimeout(timeoutId);
                    if (!isUnmounted) setLoading(false);
                }

                const authResponse = supabase.auth.onAuthStateChange(async (event, session) => {
                    console.log('Auth State Change:', event, session?.user?.email);

                    // Clear the failsafe timeout as we got a response
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }

                    if (session?.user) {
                        // Only block UI if we don't have a user yet (initial load or login)
                        const isInitialLoad = !currentUserRef.current;
                        if (isInitialLoad) setLoading(true);

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
                            if (shouldUpdateUser) {
                                setCurrentUser({ ...profile, id: profile.id, uuid: session.user.id });
                            }
                            
                            // Start/Update Presence Tracking
                            if (profile.email && (!presenceChannel || shouldUpdateUser)) {
                                try {
                                    if (presenceChannel) {
                                        supabase.removeChannel(presenceChannel);
                                    }

                                presenceChannel = supabase.channel('presence-channel');
                                presenceChannel
                                    .on('presence', { event: 'sync' }, () => {
                                        const newState = presenceChannel.presenceState();
                                        const users = [];
                                        for (const key in newState) {
                                            // Supabase sends an array of presence objects for each key
                                            if (newState[key] && newState[key].length > 0) {
                                                users.push({
                                                    email: key,
                                                    ...newState[key][0] // Get the first session's data
                                                });
                                            }
                                        }
                                        console.log('👥 Online Users Sync:', users);
                                        setOnlineUsers(users);
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
                                                name: profile.name, // Use profile's name
                                                role: profile.role, // Use profile's role
                                                online_at: new Date().toISOString(),
                                            };
                                            await presenceChannel.track(userStatus);
                                        }
                                    });

                                // Clean up on user logout or component unmount handled by return logic (though tricky in global store)
                            } catch (presenceError) {
                                console.error("Error initializing presence:", presenceError);
                            }
                        }
                    } else {
                        setCurrentUser({
                            id: session.user.id,
                            email: session.user.email,
                            role: 'user',
                            name: session.user.user_metadata?.full_name || session.user.email
                        });
                    }

                    // 2. Fetch App Data NOW that we have a session
                    await refreshData();
                    setLoading(false); // Explicitly end loading after data is ready
                } else {
                    // Only set loading false if we aren't already handled by initial check NO, always explicit
                    setCurrentUser(null);
                    setLoading(false);
                    // Unsubscribe from presence channel on logout
                    if (presenceChannel) {
                        supabase.removeChannel(presenceChannel);
                        presenceChannel = null;
                        setOnlineUsers([]);
                    }
                }
            });
            subscription = authResponse?.data?.subscription;
            } catch (error) {
                // Handle AbortError and other auth errors gracefully
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
                    console.log('Realtime Change:', payload);
                    if (payload.eventType === 'INSERT') {
                        const t = payload.new;
                        // Formatear nuevo ticket igual que en fetch
                        const formatted = {
                            ...t,
                            deliveryStatus: t.delivery_status,
                            deliveryCompletedDate: t.delivery_completed_date,
                            associatedCases: t.associated_assets || [],
                            internalNotes: t.internal_notes,
                            deliveryDetails: t.delivery_details,
                            chatLog: t.chat_log || [],
                            instructionsUpdatedBy: t.instructions_updated_by
                        };
                        setTickets(prev => {
                            if (prev.some(old => old.id === formatted.id)) return prev;
                            return [formatted, ...prev];
                        });
                    } else if (payload.eventType === 'UPDATE') {
                        const t = payload.new;
                        const formatted = {
                            ...t,
                            deliveryStatus: t.delivery_status,
                            deliveryCompletedDate: t.delivery_completed_date,
                            associatedCases: t.associated_assets || [],
                            internalNotes: t.internal_notes,
                            deliveryDetails: t.delivery_details,
                            chatLog: t.chat_log || [],
                            instructionsUpdatedBy: t.instructions_updated_by
                        };
                        setTickets(prev => prev.map(old => old.id === t.id ? formatted : old));
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
                    if (payload.eventType === 'INSERT') {
                        const t = payload.new;
                        const formatted = {
                            ...t,
                            caseNumber: t.case_number,
                            deliveryPerson: t.delivery_person,
                            assignedTo: t.assigned_to,
                            timeSlot: t.time_slot,
                            trackingNumber: t.tracking_number,
                            deliveryInfo: t.delivery_info,
                            chatLog: t.chat_log || [],
                            coordinatedBy: t.coordinated_by
                        };
                        setLogisticsTasks(prev => [formatted, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        const t = payload.new;
                        const formatted = {
                            ...t,
                            caseNumber: t.case_number,
                            deliveryPerson: t.delivery_person,
                            assignedTo: t.assigned_to,
                            timeSlot: t.time_slot,
                            trackingNumber: t.tracking_number,
                            deliveryInfo: t.delivery_info,
                            chatLog: t.chat_log || [],
                            coordinatedBy: t.coordinated_by
                        };
                        setLogisticsTasks(prev => prev.map(old => old.id === t.id ? formatted : old));
                    } else if (payload.eventType === 'DELETE') {
                        setLogisticsTasks(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        initAuth();

        return () => {
            if (subscription) subscription.unsubscribe();
            supabase.removeChannel(channel);
            supabase.removeChannel(tasksChannel);
            if (presenceChannel) {
                supabase.removeChannel(presenceChannel);
            }
        };
    }, []);

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
            const { data: profile } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();

            // If profile is stuck in 'pending' or doesn't match trigger, ensure we get latest
            // The trigger should have created it.

            return { user: profile ? { ...profile, uuid: data.user.id } : { ...data.user, role: 'pending' } };
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
            await supabase.auth.signOut();
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

            const dbData = {
                id: newTicket.id,
                subject: newTicket.subject,
                requester: newTicket.requester,
                priority: newTicket.priority,
                status: newTicket.status,
                date: newTicket.date,
                delivery_status: newTicket.deliveryStatus || 'Pendiente',
                logistics: newTicket.logistics || {},
                associated_assets: newTicket.associatedCases || [],
                accessories: newTicket.accessories || {},
                internal_notes: newTicket.internalNotes || [],
                delivery_details: newTicket.deliveryDetails || {}
            };

            const { error } = await supabase.from('tickets').insert([dbData]);

            if (!error) {
                // IMPORTANT: update directly based on previous state to avoid race conditions
                setTickets(prev => [newTicket, ...prev]);
                volatileMaxTicketId = currentAttemptMaxId; // Update global counter instantly
                createdTicket = newTicket;
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

        // --- AUTOMATIZACIÓN: Crear Sub-Casos (logistics_tasks) automáticamente ---
        if (ticket.associatedCases && Array.isArray(ticket.associatedCases) && ticket.associatedCases.length > 0) {
            console.log(`Creando ${ticket.associatedCases.length} sub-casos para el ticket ${createdTicket.id}`);
            
            const tasksToInsert = ticket.associatedCases.map(ac => ({
                ticket_id: createdTicket.id,
                case_number: ac.caseNumber || ac.case_number,
                subject: ac.subject || ticket.subject,
                status: ac.logistics?.status || 'Pendiente',
                address: ac.logistics?.address || null, // No hard-codeamos la dirección del ticket para que sea dinámica
                method: ac.logistics?.method ?? ticket.logistics?.method ?? '', 
                delivery_person: ac.logistics?.deliveryPerson || ticket.logistics?.deliveryPerson || 'Sin asignar',
                assigned_to: ac.logistics?.assignedTo || ticket.logistics?.assignedTo || null,
                date: ac.logistics?.date || null,
                time_slot: ac.logistics?.timeSlot || 'AM',
                assets: ac.assets || [],
                accessories: ac.accessories || {}
            }));

            const { data: createdTasks, error: taskError } = await supabase
                .from('logistics_tasks')
                .insert(tasksToInsert)
                .select();

            if (taskError) {
                console.error("Error creando sub-casos automáticos:", taskError);
            } else if (createdTasks) {
                const formattedTasks = createdTasks.map(t => ({
                    ...t,
                    caseNumber: t.case_number,
                    deliveryPerson: t.delivery_person,
                    assignedTo: t.assigned_to,
                    timeSlot: t.time_slot
                }));
                setLogisticsTasks(prev => [...formattedTasks, ...prev]);
            }
        }

        return createdTicket;
    };

    const addAsset = async (asset) => {
        const now = new Date().toISOString();
        let attempt = 0;
        let createdAsset = null;

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
                hardware_spec: asset.hardwareSpec,
                model_number: asset.modelNumber,
                part_number: asset.partNumber,
                purchase_order: asset.purchaseOrder,
                sfdc_case: asset.sfdcCase,
                eol_date: asset.eolDate,
                imei_2: asset.imei2,
                country: asset.country,
                add_by_user: currentUser?.name || 'Sistema'
            };

            // Remove camelCase fields
            ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2'].forEach(k => delete dbAsset[k]);

            const { error } = await supabase.from('assets').insert([dbAsset]);
            if (!error) {
                const uiAsset = { ...asset, ...dbAsset, dateLastUpdate: now, updatedBy: dbAsset.updated_by };
                setAssets(prev => [uiAsset, ...prev]);
                createdAsset = uiAsset;
                break;
            }

            if (error.code === '23505') {
                attempt++;
                console.warn("Collision in addAsset, retrying...", attempt);
            } else {
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
                    hardware_spec: asset.hardwareSpec,
                    model_number: asset.modelNumber,
                    part_number: asset.partNumber,
                    purchase_order: asset.purchaseOrder,
                    sfdc_case: asset.sfdcCase,
                    eol_date: asset.eolDate,
                    imei_2: asset.imei2,
                    country: asset.country,
                    notes: asset.notes,
                    vendor: asset.vendor,
                    oem: asset.oem,
                    type: asset.type,
                    name: asset.name,
                    serial: asset.serial,
                    add_by_user: currentUser?.name || 'Importación'
                };
                ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2'].forEach(k => delete dbAsset[k]);
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
                    imei2: a.imei_2
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
        // Map camelCase to snake_case for Supabase
        const dbUpdate = {};
        // Core fields
        if (updatedData.subject !== undefined) dbUpdate.subject = updatedData.subject;
        if (updatedData.requester !== undefined) dbUpdate.requester = updatedData.requester;
        if (updatedData.priority !== undefined) dbUpdate.priority = updatedData.priority;
        if (updatedData.status !== undefined) dbUpdate.status = updatedData.status;

        // Logistics & JSONB fields
        if (updatedData.deliveryStatus !== undefined) dbUpdate.delivery_status = updatedData.deliveryStatus;
        if (updatedData.logistics !== undefined) dbUpdate.logistics = updatedData.logistics;
        if (updatedData.associatedCases !== undefined) dbUpdate.associated_assets = updatedData.associatedCases;
        if (updatedData.accessories !== undefined) dbUpdate.accessories = updatedData.accessories;
        if (updatedData.internalNotes !== undefined) dbUpdate.internal_notes = updatedData.internalNotes;
        if (updatedData.deliveryDetails !== undefined) dbUpdate.delivery_details = updatedData.deliveryDetails;
        if (updatedData.deliveryCompletedDate !== undefined) dbUpdate.delivery_completed_date = updatedData.deliveryCompletedDate;
        if (updatedData.instructions !== undefined) dbUpdate.instructions = updatedData.instructions;
        if (updatedData.instructionsUpdatedBy !== undefined) dbUpdate.instructions_updated_by = updatedData.instructionsUpdatedBy;
        if (updatedData.chatLog !== undefined) dbUpdate.chat_log = updatedData.chatLog;

        // Validar que haya algo para actualizar
        if (Object.keys(dbUpdate).length === 0) return;

        const { error } = await supabase.from('tickets').update(dbUpdate).eq('id', id);

        if (error) {
            console.error('Error updating ticket:', error);
            alert(`Error al actualizar ticket: ${error.message}`);
            return false;
        } else {
            setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
            return true;
        }
    };

    const deleteTicket = async (id) => {
        // 1. Desvincular activos asociados a este ticket (si los hay)
        await supabase.from('assets').update({ sfdc_case: null }).eq('sfdc_case', id);

        // 2. Eliminar el ticket
        const { error } = await supabase.from('tickets').delete().eq('id', id);

        if (!error) {
            setTickets(prev => prev.filter(t => t.id !== id));
            // Actualizar estado local de activos también
            setAssets(prev => prev.map(a => a.sfdcCase === id ? { ...a, sfdcCase: null } : a));
        }
    };

    const deleteTickets = async (ids) => {
        try {
            // 1. Desvincular activos masivamente
            const { error: assetError } = await supabase.from('assets').update({ sfdc_case: null }).in('sfdc_case', ids);
            if (assetError) {
                console.error("Error unlinking assets:", assetError);
                // No detenemos el proceso, pero lo logueamos. Si falla esto, el delete de tickets podría fallar si hay FK restrict.
            }

            // 2. Eliminar tickets
            const { error } = await supabase.from('tickets').delete().in('id', ids);

            if (error) {
                console.error("Error deleting tickets:", error);
                alert(`Error al eliminar tickets masivamente: ${error.message}`);
            } else {
                setTickets(tickets.filter(t => !ids.includes(t.id)));
                // Actualizar activos locales
                setAssets(assets.map(a => ids.includes(a.sfdcCase) ? { ...a, sfdcCase: null } : a));
                alert("Tickets eliminados correctamente.");
            }
        } catch (e) {
            console.error("Exception in deleteTickets:", e);
            alert(`Error inesperado: ${e.message}`);
        }
    };

    const updateAsset = async (id, updatedData) => {
        const now = new Date().toISOString();
        const dbUpdate = {
            ...updatedData,
            updated_by: currentUser?.name || 'Sistema',
            date_last_update: now,
            // Map camelCase to snake_case
            hardware_spec: updatedData.hardwareSpec,
            model_number: updatedData.modelNumber,
            part_number: updatedData.partNumber,
            purchase_order: updatedData.purchaseOrder,
            sfdc_case: updatedData.sfdcCase,
            eol_date: updatedData.eolDate,
            imei_2: updatedData.imei2
        };
        // Remove camelCase fields and frontend-only fields
        ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2', 'dateLastUpdate', 'updatedBy'].forEach(k => delete dbUpdate[k]);

        const { error } = await supabase.from('assets').update(dbUpdate).eq('id', id);
        if (!error) {
            setAssets(prev => prev.map(a => a.id === id ? { ...a, ...updatedData, dateLastUpdate: now, updatedBy: dbUpdate.updated_by } : a));
        }
    };

    const deleteAsset = async (id) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (!error) setAssets(assets.filter(a => a.id !== id));
    };

    const updateConsumable = async (id, updatedData) => {
        const { error } = await supabase.from('consumables').update(updatedData).eq('id', id);
        if (!error) setConsumables(consumables.map(c => c.id === id ? { ...c, ...updatedData } : c));
    };

    const updateConsumableStock = async (id, newStock) => {
        const { error } = await supabase.from('consumables').update({ stock: newStock }).eq('id', id);
        if (!error) {
            setConsumables(consumables.map(c => c.id === id ? { ...c, stock: newStock } : c));
            alert("Stock actualizado correctamente.");
        } else {
            console.error("Error updating stock:", error);
            alert("Error al actualizar stock.");
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

            const newConsumable = {
                ...consumable,
                id: nextId,
                stock: parseInt(consumable.stock) || 0
            };

            const { error } = await supabase.from('consumables').insert([newConsumable]);

            if (!error) {
                createdConsumable = newConsumable;
                setConsumables(prev => [...prev, newConsumable]);
                break; // Success!
            }

            // If error is due to unique constraint violation (duplicate key)
            if (error.code === '23505') {
                console.warn(`Collision for ID ${nextId}, fetching real max ID from DB...`);

                // Fetch the TRUE max ID from the database to resync context
                const { data: maxIdData } = await supabase
                    .from('consumables')
                    .select('id')
                    .order('id', { ascending: false })
                    .limit(1)
                    .single();

                if (maxIdData && maxIdData.id) {
                    const dbMax = parseInt(maxIdData.id.replace('CON-', ''));
                    if (!isNaN(dbMax) && dbMax > maxId) {
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
        if (!error) setYubikeys(yubikeys.filter(y => y.id !== id));
    };

    const deleteConsumable = async (id) => {
        const { error } = await supabase.from('consumables').delete().eq('id', id);
        if (!error) setConsumables(consumables.filter(c => c.id !== id));
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
                setAssets(assets.filter(a => a.country !== countryName));
                setConsumables(consumables.filter(c => c.country !== countryName));
            }
        } else {
            // Delete ALL (Global)
            await supabase.from('assets').delete().neq('id', '0');
            await supabase.from('consumables').delete().neq('id', '0');
            setAssets([]);
            setConsumables([]);
        }
    };

    const updateRates = async (newRates) => {
        try {
            // Sanitize rates to ensure clean JSON (converts NaN to null, strips undefined)
            const sanitizedRates = JSON.parse(JSON.stringify(newRates));

            const { error } = await supabase.from('app_config').upsert({ key: 'rates', value: sanitizedRates });

            if (error) {
                console.error('Full Error Object:', JSON.stringify(error, null, 2));
                alert(`Error al guardar tarifas: ${error.message || 'Error desconocido revisa la consola'}`);
            } else {
                setRates(sanitizedRates);
                alert('Tarifas guardadas correctamente');
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
        const dbTask = {
            ticket_id: task.ticketId,
            case_number: task.caseNumber,
            subject: task.subject,
            status: task.status || 'Pendiente',
            method: task.method,
            delivery_person: task.deliveryPerson,
            assigned_to: task.assignedTo,
            date: task.date,
            time_slot: task.timeSlot || 'AM',
            address: task.address,
            tracking_number: task.trackingNumber,
            assets: task.assets || [],
            accessories: task.accessories || {},
            yubikeys: task.yubikeys || [],
            delivery_info: task.deliveryInfo || {},
            instructions: task.instructions || ''
        };

        const { data, error } = await supabase.from('logistics_tasks').insert([dbTask]).select();
        if (error) {
            console.error('Error adding logistics task:', error);
            return { error };
        }
        if (data) {
            const formatted = { ...data[0], caseNumber: data[0].case_number, deliveryPerson: data[0].delivery_person, assignedTo: data[0].assigned_to, timeSlot: data[0].time_slot, trackingNumber: data[0].tracking_number, deliveryInfo: data[0].delivery_info };
            setLogisticsTasks(prev => [formatted, ...prev]);
            return { data: formatted };
        }
    };

    const updateLogisticsTask = async (id, updatedData) => {
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

            // Guardar historial en el ticket padre silenciosamente (Solo en el State para evitar bucles de render, o llamar a updateTicket suave)
            if (newHistoryNotes.length > 0) {
                const parentTicket = tickets.find(t => t.id === task.ticket_id);
                if (parentTicket) {
                    let finalNotes = [...(parentTicket.internalNotes || [])];
                    const userName = currentUser?.name || 'Sistema (Automático)';
                    
                    newHistoryNotes.forEach(content => {
                        finalNotes.push({
                            content: content,
                            user: userName,
                            date: new Date().toISOString()
                        });
                    });
                    
                    // Llama a updateTicket localmente. updateTicket emite cambios al state central,
                    // Dejando registro para el Panel Historial.
                    updateTicket(parentTicket.id, { internalNotes: finalNotes });
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
            'chatLog': 'chat_log'
        };

        Object.keys(fieldMap).forEach(key => {
            if (updatedData[key] !== undefined) {
                dbUpdate[fieldMap[key]] = updatedData[key];
            }
        });

        dbUpdate.updated_at = new Date().toISOString();

        const { data: updateResult, error } = await supabase
            .from('logistics_tasks')
            .update(dbUpdate)
            .eq('id', id)
            .select();
        
        if (error) {
            console.error('Error updating logistics task:', error);
            return { error };
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
                const fullAsset = assets.find(a => a.serial.toLowerCase() === item.serial?.toLowerCase());
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
                    const fullAsset = assets.find(a => a.serial.toLowerCase() === item.serial?.toLowerCase());
                    if (fullAsset) {
                        const isRecovery = item.type === 'Recupero';
                        const newAssignee = isRecovery ? 'Almacén' : (parentTicket?.requester || 'Usuario Final');
                        
                        // Solo actualizamos si hay cambios reales para evitar bucles de red
                        if (fullAsset.sfdcCase !== ticketId || fullAsset.status !== 'Asignado' || fullAsset.assignee !== newAssignee) {
                            console.log(`Sincronizando activo ${item.serial} con ticket ${ticketId}`);
                            await updateAsset(fullAsset.id, { 
                                sfdcCase: ticketId,
                                status: 'Asignado',
                                assignee: newAssignee,
                                notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                                       `[${new Date().toLocaleDateString()}] ASOCIADO/ACTUALIZADO en Ticket #${ticketId} (Asignado a: ${newAssignee})`
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
                    const fullAsset = assets.find(a => a.serial.toLowerCase() === item.serial?.toLowerCase());
                    if (fullAsset) {
                        const isRecovery = item.type === 'Recupero';
                        const newStatus = isRecovery ? 'Recuperado' : 'Asignado';
                        const newAssignee = isRecovery ? 'Almacén' : (parentTicket?.requester || 'Usuario Final');
                        
                        await updateAsset(fullAsset.id, {
                            status: newStatus,
                            assignee: newAssignee,
                            sfdcCase: parentTicket?.id,
                            notes: (fullAsset.notes ? fullAsset.notes + '\n' : '') + 
                                   `[${new Date().toLocaleDateString()}] ${isRecovery ? 'RECUPERADO' : 'ENTREGADO'} vía Ticket #${parentTicket?.id || task.ticket_id} (${task.case_number || 'Sub-caso'})`
                        });
                    }
                }
            }
        }
        
        // --- AUTOMATIZACIÓN: Cierre de Ticket Padre ---
        // Se dispara si una tarea se marca como finalizada o sin acción
        if (updatedData.status === 'Entregado' || updatedData.status === 'No requiere accion') {
            const currentTask = logisticsTasks.find(t => t.id === id);
            if (!currentTask || !currentTask.ticket_id) return;
            
            const ticketId = currentTask.ticket_id;
            // Filter all tasks related to this ticket_id, including the one just updated
            const allTasksForTicket = logisticsTasks.filter(t => 
                String(t.ticket_id) === String(ticketId)
            );
                
                // LÓGICA DE CIERRE:
                // El ticket principal se da como "Resuelto" si:
                // 1. HAY al menos una tarea "Entregado"
                // 2. TODAS las tareas han salido de "Pendiente" (están en Entregado, No requiere acción, etc.)
                // NO se cierra si aún queda algo en "Para Coordinar" o "En Transito" para ser rigurosos.
                
                const currentTasksWithUpdates = allTasksForTicket.map(t => {
                    if (t.id === id) return { ...t, status: updatedData.status };
                    return t;
                });

                const atLeastOneDone = currentTasksWithUpdates.some(t => t.status === 'Entregado');
                const nothingPendingOrInProcess = currentTasksWithUpdates.every(t => 
                    t.status === 'Entregado' || t.status === 'No requiere accion'
                );

                if (atLeastOneDone && nothingPendingOrInProcess) {
                    console.log(`Automatización: Todas las tareas completadas o sin acción necesaria en ticket ${ticketId}. Cerrando ticket...`);
                    await updateTicket(ticketId, { status: 'Resuelto' });
                }
            }

        // Sincronizar estado global
        refreshData();

        return { success: true };
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

    return (
        <StoreContext.Provider value={{
            tickets, assets, consumables, yubikeys, deliveries, sfdcCases, lastImportedCases, users, currentUser, rates, expenses, loading,
            logisticsTasks, addLogisticsTask, updateLogisticsTask, deleteLogisticsTask,
            addTicket, updateTicket, deleteTicket, deleteTickets, addAsset, addAssets, updateAsset, deleteAsset,
            addDelivery, deleteDelivery, deleteDeliveries, updateConsumableStock, updateConsumable, addConsumable, deleteConsumable,
            addYubikey, updateYubikey, deleteYubikey,
            clearInventory, updateRates, addExpense, deleteExpense,
            importSfdcCases, clearSfdcCases, removeSfdcCase,
            countryFilter, setCountryFilter,
            login, logout, signup, addUser, deleteUser, updateUser, updatePassword, sendPasswordReset,
            onlineUsers, refreshData, setLoading
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export const useStore = () => useContext(StoreContext);
