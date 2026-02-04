"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';
import { initialTickets, initialAssets, initialDeliveries, initialUsers, initialConsumables, initialRates } from './data';
import { supabase } from './supabase';
const StoreContext = createContext();

export function StoreProvider({ children }) {
    const [tickets, setTickets] = useState([]);
    const [assets, setAssets] = useState([]);
    const [consumables, setConsumables] = useState([]);
    const [deliveries, setDeliveries] = useState([]);
    const [sfdcCases, setSfdcCases] = useState([]);
    const [lastImportCount, setLastImportCount] = useState(0);
    const [users, setUsers] = useState(initialUsers);
    const [currentUser, setCurrentUser] = useState(null);
    const [rates, setRates] = useState(initialRates);
    const [expenses, setExpenses] = useState([]);

    const [loading, setLoading] = useState(true);

    // Cargar datos persistentes al iniciar desde Supabase
    useEffect(() => {
        let subscription = null;

        const fetchAppData = async () => {
            try {
                console.log("Fetching Critical App Data...");

                // 1. CRITICAL DATA (Fast & Essential for UI Context)
                const criticalResults = await Promise.all([
                    supabase.from('users').select('id, name, role, email, username, location_latitude, location_longitude, last_location_update, tracking_enabled'),
                    supabase.from('app_config').select('*').eq('key', 'rates').maybeSingle(),
                    supabase.from('consumables').select('*').order('id')
                ]);

                const [
                    { data: usersData, error: usersError },
                    { data: configData, error: configError },
                    { data: consData, error: consError }
                ] = criticalResults;

                // Process Critical Data
                if (usersError) console.error("Error fetching users:", usersError);
                else if (usersData) setUsers(usersData);

                if (configData) setRates(configData.value);
                if (consData) setConsumables(consData);

                // UNBLOCK UI NOW
                setLoading(false);
                console.log("Critical Data Loaded - UI Unblocked");

                // 2. HEAVY DATA (Content - Can load in background)
                const heavyResults = await Promise.all([
                    supabase.from('sfdc_cases').select('*'),
                    supabase.from('tickets').select('*').order('date', { ascending: false }),
                    supabase.from('assets').select('*'),
                    supabase.from('expenses').select('*').order('date', { ascending: false }),
                    supabase.from('deliveries').select('*')
                ]);

                const [
                    { data: sfdcData, error: sfdcError },
                    { data: ticketsData, error: ticketsError },
                    { data: assetsData, error: assetsError },
                    { data: expensesData, error: expensesError },
                    { data: delData, error: delError }
                ] = heavyResults;

                // Process Heavy Data
                // SFDC Cases
                if (sfdcData) setSfdcCases(sfdcData.map(c => ({
                    ...c,
                    ...c.raw_data,
                    caseNumber: c.case_number,
                    dateOpened: c.date_opened
                })));

                // Tickets
                if (ticketsError) console.error("Error fetching tickets:", ticketsError);
                if (ticketsData) setTickets(ticketsData.map(t => ({
                    ...t,
                    deliveryStatus: t.delivery_status,
                    deliveryCompletedDate: t.delivery_completed_date,
                    associatedAssets: t.associated_assets,
                    internalNotes: t.internal_notes,
                    deliveryDetails: t.delivery_details
                })));

                // Assets
                if (assetsData) setAssets(assetsData.map(a => ({
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
                })));

                // Expenses
                if (expensesData) setExpenses(expensesData);

                // Deliveries
                if (delData) setDeliveries(delData);

                console.log("All App Data Fetched Successfully");
            } catch (err) {
                console.error("CRITICAL ERROR in fetchAppData:", err);
            } finally {
                // Ensure loading is false even if critical fetch failed
                setLoading(false);
            }
        };

        const initAuth = async () => {
            setLoading(true);

            // Failsafe: Force stop loading after 8 seconds to prevent infinite hang
            const timeoutId = setTimeout(() => {
                setLoading((currentLoading) => {
                    if (currentLoading) {
                        console.warn("Auth check timed out - forcing app load");
                        return false;
                    }
                    return currentLoading;
                });
            }, 8000);

            // Check session explicitly first to avoid hanging if listener delays
            const { data: { session: initialSession } } = await supabase.auth.getSession();
            if (!initialSession) {
                console.log("No initial session found");
                clearTimeout(timeoutId); // Clear timeout if we already know result
                setLoading(false);
            }

            const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (event, session) => {
                console.log('Auth State Change:', event, session?.user?.email);

                // Clear the failsafe timeout as we got a response
                clearTimeout(timeoutId);

                if (session?.user) {
                    // 1. Fetch User Profile
                    let profile = null;
                    const { data, error } = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', session.user.email?.toLowerCase())
                        .maybeSingle();

                    if (data) profile = data;

                    if (profile) {
                        setCurrentUser({ ...profile, id: profile.id, uuid: session.user.id });
                    } else {
                        setCurrentUser({
                            id: session.user.id,
                            email: session.user.email,
                            role: 'user',
                            name: session.user.user_metadata?.full_name || session.user.email
                        });
                    }

                    // 2. Fetch App Data NOW that we have a session
                    // Ensure we don't fetch if slightly redundant but safer for sync
                    await fetchAppData();
                } else {
                    // Only set loading false if we aren't already handled by initial check NO, always explicit
                    setCurrentUser(null);
                    setLoading(false);
                }
            });
            subscription = sub;
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
                            associatedAssets: t.associated_assets,
                            internalNotes: t.internal_notes,
                            deliveryDetails: t.delivery_details
                        };
                        setTickets(prev => [formatted, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        const t = payload.new;
                        const formatted = {
                            ...t,
                            deliveryStatus: t.delivery_status,
                            deliveryCompletedDate: t.delivery_completed_date,
                            associatedAssets: t.associated_assets,
                            internalNotes: t.internal_notes,
                            deliveryDetails: t.delivery_details
                        };
                        setTickets(prev => prev.map(old => old.id === t.id ? formatted : old));
                    } else if (payload.eventType === 'DELETE') {
                        setTickets(prev => prev.filter(old => old.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        initAuth();

        return () => {
            if (subscription) subscription.unsubscribe();
            supabase.removeChannel(channel);
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
                    full_name: fullName
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
        await supabase.auth.signOut();
        setCurrentUser(null);
        // localStorage is handled by Supabase automatically, but we clean up ours
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
            setUsers(users.filter(u => u.id !== id));
        }
    };

    const updateUser = async (id, updatedData) => {
        const { error } = await supabase.from('users').update(updatedData).eq('id', id);
        if (!error) setUsers(users.map(u => u.id === id ? { ...u, ...updatedData } : u));
    };

    // Consumable Actions
    const updateConsumableStock = async (id, change) => {
        const target = consumables.find(c => c.id === id);
        if (!target) return;
        const newStock = Math.max(0, target.stock + change);
        const { error } = await supabase.from('consumables').update({ stock: newStock }).eq('id', id);
        if (!error) setConsumables(consumables.map(c => c.id === id ? { ...c, stock: newStock } : c));
    };

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
            raw_data: c
        }));
        const { error } = await supabase.from('sfdc_cases').upsert(formatted);

        if (error) {
            console.error('ERROR IMPORTANDO SFDC A SUPABASE:', error);
            alert('Error al guardar en base de datos: ' + error.message);
        }

        if (!error) {
            setLastImportCount(newCases.length);
            // Refresh local state
            const { data } = await supabase.from('sfdc_cases').select('*');
            setSfdcCases(data.map(c => ({ ...c, ...c.raw_data, caseNumber: c.case_number })));
        }
    };

    const clearSfdcCases = async () => {
        const { error } = await supabase.from('sfdc_cases').delete().neq('case_number', '0'); // Delete all
        if (!error) {
            setLastImportCount(0);
            setSfdcCases([]);
        }
    };

    const removeSfdcCase = async (caseNumber) => {
        const { error } = await supabase.from('sfdc_cases').delete().eq('case_number', caseNumber);
        if (!error) setSfdcCases(sfdcCases.filter(c => c.caseNumber !== caseNumber));
    };

    // App Actions
    const addTicket = async (ticket) => {
        let maxId = tickets.reduce((max, t) => {
            const num = parseInt(t.id.split('-')[1]);
            return isNaN(num) ? max : Math.max(max, num);
        }, 1000);

        let attempt = 0;
        let createdTicket = null;

        while (attempt < 5) {
            const nextId = `CAS-${maxId + 1 + attempt}`;

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
                associated_assets: newTicket.associatedAssets || [],
                accessories: newTicket.accessories || {},
                internal_notes: newTicket.internalNotes || [],
                delivery_details: newTicket.deliveryDetails || {}
            };

            const { error } = await supabase.from('tickets').insert([dbData]);

            if (!error) {
                setTickets(prev => [newTicket, ...prev]);
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

        return createdTicket;
    };

    const addAsset = async (asset) => {
        const now = new Date().toISOString();

        // Calculate max ID for single asset addition
        const maxId = assets.reduce((max, a) => {
            const num = parseInt((a.id || '').replace('AST-', ''));
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);
        const nextIdNum = maxId + 1;

        const dbAsset = {
            ...asset,
            id: `AST-${String(nextIdNum).padStart(4, '0')}`,
            date: asset.date || now.split('T')[0],
            updated_by: currentUser?.name || 'Sistema',
            date_last_update: now,
            // Map camelCase to snake_case
            hardware_spec: asset.hardwareSpec,
            model_number: asset.modelNumber,
            part_number: asset.partNumber,
            purchase_order: asset.purchaseOrder,
            sfdc_case: asset.sfdcCase,
            eol_date: asset.eolDate,
            imei_2: asset.imei2
        };
        // Remove camelCase fields from DB object
        ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2'].forEach(k => delete dbAsset[k]);

        const { error } = await supabase.from('assets').insert([dbAsset]);
        if (!error) {
            setAssets([{ ...asset, ...dbAsset, dateLastUpdate: now, updatedBy: dbAsset.updated_by }, ...assets]);
        }
    };

    const addAssets = async (newAssets) => {
        const now = new Date().toISOString();

        // Calculate the highest existing ID to avoid collisions
        const maxId = assets.reduce((max, a) => {
            const num = parseInt((a.id || '').replace('AST-', ''));
            return !isNaN(num) ? Math.max(max, num) : max;
        }, 0);

        const formattedAssets = newAssets.map((asset, index) => {
            const nextIdNum = maxId + index + 1;
            const dbAsset = {
                ...asset,
                id: `AST-${String(nextIdNum).padStart(4, '0')}`,
                date: asset.date || now.split('T')[0],
                status: asset.status || 'Disponible',
                assignee: asset.assignee || 'Almacén',
                updated_by: currentUser?.name || 'Importación',
                date_last_update: now,
                // Map camelCase to snake_case
                hardware_spec: asset.hardwareSpec,
                model_number: asset.modelNumber,
                part_number: asset.partNumber,
                purchase_order: asset.purchaseOrder,
                sfdc_case: asset.sfdcCase,
                eol_date: asset.eolDate,
                imei_2: asset.imei2
            };
            // Remove camelCase fields
            ['hardwareSpec', 'modelNumber', 'partNumber', 'purchaseOrder', 'sfdcCase', 'eolDate', 'imei2'].forEach(k => delete dbAsset[k]);
            return dbAsset;
        });

        const { error } = await supabase.from('assets').insert(formattedAssets);
        if (error) {
            console.error('Supabase Error adding assets:', error);
            throw error;
        }

        // Update local state with camelCase versions for the UI
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
        setAssets([...uiAssets, ...assets]);
    };

    const addDelivery = async (delivery) => {
        const newDelivery = { ...delivery, id: `ENV-${2025 + deliveries.length}`, date: new Date().toISOString().split('T')[0] };
        const { error } = await supabase.from('deliveries').insert([newDelivery]);
        if (!error) setDeliveries([newDelivery, ...deliveries]);
    };

    const deleteDelivery = async (id) => {
        const { error } = await supabase.from('deliveries').delete().eq('id', id);
        if (!error) setDeliveries(deliveries.filter(d => d.id !== id));
    };

    const deleteDeliveries = async (ids) => {
        const { error } = await supabase.from('deliveries').delete().in('id', ids);
        if (!error) setDeliveries(deliveries.filter(d => !ids.includes(d.id)));
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
        if (updatedData.associatedAssets !== undefined) dbUpdate.associated_assets = updatedData.associatedAssets;
        if (updatedData.accessories !== undefined) dbUpdate.accessories = updatedData.accessories;
        if (updatedData.internalNotes !== undefined) dbUpdate.internal_notes = updatedData.internalNotes;
        if (updatedData.deliveryDetails !== undefined) dbUpdate.delivery_details = updatedData.deliveryDetails;
        if (updatedData.deliveryCompletedDate !== undefined) dbUpdate.delivery_completed_date = updatedData.deliveryCompletedDate;

        // Validar que haya algo para actualizar
        if (Object.keys(dbUpdate).length === 0) return;

        const { error } = await supabase.from('tickets').update(dbUpdate).eq('id', id);

        if (error) {
            console.error('Error updating ticket:', error);
            alert(`Error al actualizar ticket: ${error.message}`);
        } else {
            setTickets(tickets.map(t => t.id === id ? { ...t, ...updatedData } : t));
        }
    };

    const deleteTicket = async (id) => {
        // 1. Desvincular activos asociados a este ticket (si los hay)
        await supabase.from('assets').update({ sfdc_case: null }).eq('sfdc_case', id);

        // 2. Eliminar el ticket
        const { error } = await supabase.from('tickets').delete().eq('id', id);

        if (!error) {
            setTickets(tickets.filter(t => t.id !== id));
            // Actualizar estado local de activos también
            setAssets(assets.map(a => a.sfdcCase === id ? { ...a, sfdcCase: null } : a));
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
        if (!error) setAssets(assets.map(a => a.id === id ? { ...a, ...updatedData, dateLastUpdate: now, updatedBy: dbUpdate.updated_by } : a));
    };

    const deleteAsset = async (id) => {
        const { error } = await supabase.from('assets').delete().eq('id', id);
        if (!error) setAssets(assets.filter(a => a.id !== id));
    };

    const updateConsumable = async (id, updatedData) => {
        const { error } = await supabase.from('consumables').update(updatedData).eq('id', id);
        if (!error) setConsumables(consumables.map(c => c.id === id ? { ...c, ...updatedData } : c));
    };

    const addConsumable = async (consumable) => {
        const newConsumable = {
            ...consumable,
            id: `CON-${String(consumables.length + 1).padStart(3, '0')}`,
            stock: parseInt(consumable.stock) || 0
        };
        const { error } = await supabase.from('consumables').insert([newConsumable]);
        if (!error) setConsumables([...consumables, newConsumable]);
    };

    const deleteConsumable = async (id) => {
        const { error } = await supabase.from('consumables').delete().eq('id', id);
        if (!error) setConsumables(consumables.filter(c => c.id !== id));
    };

    const clearInventory = async () => {
        await supabase.from('assets').delete().neq('id', '0');
        await supabase.from('consumables').delete().neq('id', '0');
        setAssets([]);
        setConsumables([]);
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

    return (
        <StoreContext.Provider value={{
            tickets, assets, consumables, deliveries, sfdcCases, lastImportCount, users, currentUser, rates, expenses, loading,
            addTicket, updateTicket, deleteTicket, deleteTickets, addAsset, addAssets, updateAsset, deleteAsset,
            addDelivery, deleteDelivery, deleteDeliveries, updateConsumableStock, updateConsumable, addConsumable, deleteConsumable,
            clearInventory, updateRates, addExpense, deleteExpense,
            importSfdcCases, clearSfdcCases, removeSfdcCase,
            login, logout, signup, addUser, deleteUser, updateUser, updatePassword, sendPasswordReset
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export const useStore = () => useContext(StoreContext);
