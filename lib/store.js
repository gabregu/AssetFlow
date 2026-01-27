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
        const loadAllData = async () => {
            setLoading(true);
            try {
                // Initialize Auth Listener
                const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
                    if (session?.user) {
                        // Fetch user profile from public table
                        const { data: profile } = await supabase
                            .from('users')
                            .select('*')
                            .eq('email', session.user.email)
                            .single();

                        // If profile doesn't exist yet (first login), we might need to create it or handle it
                        // For now, we assume the user profile exists or we use metadata
                        if (profile) {
                            setCurrentUser({ ...profile, id: profile.id, uuid: session.user.id });
                        } else {
                            // Fallback: use auth metadata if no profile found
                            setCurrentUser({
                                id: session.user.id,
                                email: session.user.email,
                                role: 'user', // Default role
                                name: session.user.user_metadata?.full_name || session.user.email
                            });
                        }
                    } else {
                        setCurrentUser(null);
                    }
                });

                // Users (Restricted fetch - Public Profile info only)
                const { data: usersData } = await supabase
                    .from('users')
                    .select('id, name, role, email, username');
                if (usersData && usersData.length > 0) setUsers(usersData);

                // Consumables
                const { data: consData } = await supabase.from('consumables').select('*').order('id');
                if (consData && consData.length > 0) setConsumables(consData);

                // SFDC Cases
                const { data: sfdcData } = await supabase.from('sfdc_cases').select('*');
                if (sfdcData) setSfdcCases(sfdcData.map(c => ({
                    ...c,
                    ...c.raw_data,
                    caseNumber: c.case_number,
                    dateOpened: c.date_opened
                })));

                // Tickets
                const { data: ticketsData } = await supabase.from('tickets').select('*').order('date', { ascending: false });
                if (ticketsData) setTickets(ticketsData.map(t => ({
                    ...t,
                    deliveryStatus: t.delivery_status,
                    deliveryCompletedDate: t.delivery_completed_date,
                    associatedAssets: t.associated_assets,
                    internalNotes: t.internal_notes,
                    deliveryDetails: t.delivery_details
                })));

                // Assets
                const { data: assetsData } = await supabase.from('assets').select('*');
                if (assetsData) setAssets(assetsData.map(a => ({
                    ...a,
                    // Map snake_case DB columns to camelCase for App use
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
                const { data: expensesData } = await supabase.from('expenses').select('*').order('date', { ascending: false });
                if (expensesData) setExpenses(expensesData);

                // Deliveries
                const { data: delData } = await supabase.from('deliveries').select('*');
                if (delData) setDeliveries(delData);

                // Rates from config
                const { data: configData } = await supabase.from('app_config').select('*').eq('key', 'rates').single();
                if (configData) setRates(configData.value);

                return () => subscription.unsubscribe();

            } catch (error) {
                console.error('Error loading data from Supabase:', error);
            } finally {
                setLoading(false);
            }
        };
        loadAllData();
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
        const maxId = tickets.reduce((max, t) => {
            const num = parseInt(t.id.split('-')[1]);
            return isNaN(num) ? max : Math.max(max, num);
        }, 1000);

        const newTicket = {
            ...ticket,
            id: `CAS-${maxId + 1}`,
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
            setTickets([newTicket, ...tickets]);
            return newTicket;
        }
    };

    const addAsset = async (asset) => {
        const now = new Date().toISOString();
        const dbAsset = {
            ...asset,
            id: `AST-${String(assets.length + 1).padStart(4, '0')}`,
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
        const formattedAssets = newAssets.map((asset, index) => {
            const dbAsset = {
                ...asset,
                id: `AST-${String(assets.length + index + 1).padStart(4, '0')}`,
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

    const updateTicket = async (id, updatedData) => {
        // Map camelCase to snake_case for Supabase
        const dbUpdate = {};
        if (updatedData.status) dbUpdate.status = updatedData.status;
        if (updatedData.deliveryStatus) dbUpdate.delivery_status = updatedData.deliveryStatus;
        if (updatedData.logistics) dbUpdate.logistics = updatedData.logistics;
        if (updatedData.associatedAssets) dbUpdate.associated_assets = updatedData.associatedAssets;
        if (updatedData.accessories) dbUpdate.accessories = updatedData.accessories;
        if (updatedData.internalNotes) dbUpdate.internal_notes = updatedData.internalNotes;
        if (updatedData.deliveryDetails) dbUpdate.delivery_details = updatedData.deliveryDetails;
        if (updatedData.deliveryCompletedDate) dbUpdate.delivery_completed_date = updatedData.deliveryCompletedDate;

        const { error } = await supabase.from('tickets').update(dbUpdate).eq('id', id);
        if (!error) setTickets(tickets.map(t => t.id === id ? { ...t, ...updatedData } : t));
    };

    const deleteTicket = async (id) => {
        const { error } = await supabase.from('tickets').delete().eq('id', id);
        if (!error) setTickets(tickets.filter(t => t.id !== id));
    };

    const deleteTickets = async (ids) => {
        const { error } = await supabase.from('tickets').delete().in('id', ids);
        if (!error) setTickets(tickets.filter(t => !ids.includes(t.id)));
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
            addDelivery, deleteDelivery, updateConsumableStock, updateConsumable, addConsumable, deleteConsumable,
            clearInventory, updateRates, addExpense, deleteExpense,
            importSfdcCases, clearSfdcCases, removeSfdcCase,
            login, logout, signup, addUser, deleteUser, updateUser, updatePassword
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export const useStore = () => useContext(StoreContext);
