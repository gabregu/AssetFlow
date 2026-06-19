"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSafeSubmit } from '../../../lib/useSafeSubmit';
import { 
    Truck, CheckCircle, Package, Send, Calendar, Clock, MapPin, Search, ChevronRight, Navigation, CheckCircle2, ChevronDown, ListFilter, LayoutGrid, List, MessageSquare, StickyNote,
    Filter,
    AlertCircle,
    User,
    ClipboardList,
    TrendingUp,
    BarChart3,
    ArrowUpRight,
    QrCode,
    Download,
    Loader2,
    Camera
} from 'lucide-react';
import { Card } from '@/app/components/ui/Card';
import { Badge } from '@/app/components/ui/Badge';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { QRScannerModal } from '@/app/components/ui/QRScannerModal';
import { useRouter } from 'next/navigation';
import { useStore } from '../../../lib/store';
import { generateTicketPDF } from '../../../lib/pdf-generator';
import { uploadDevicePhoto } from '../../../lib/upload';
import { supabase } from '../../../lib/supabase';

export default function MyDeliveriesPage() {
    const { 
        tickets, 
        assets,
        currentUser, 
        updateTicket, 
        logisticsTasks, 
        updateLogisticsTask,
        refreshData
    } = useStore();

    const router = useRouter();
    
    // Identidad del usuario para filtrado (Definida a nivel de componente para evitar ReferenceErrors)
    const uName = (currentUser?.name || '').trim().toLowerCase();
    const uId = String(currentUser?.id || currentUser?.uid || currentUser?.uuid || '');

    // Refresco al cargar - sin escuchar window.focus para evitar recargas durante descarga de PDF
    useEffect(() => {
        refreshData();
    }, []);



    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('En Transito'); // Solo activos por defecto
    const [selectedDelivery, setSelectedDelivery] = useState(null);
    const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(null);
    const [optimizedOrder, setOptimizedOrder] = useState([]);
    const [editingOrderId, setEditingOrderId] = useState(null);
    const [editOrderValue, setEditOrderValue] = useState("");
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [showDownloadPrompt, setShowDownloadPrompt] = useState(false);
    const [completedDeliveryForPdf, setCompletedDeliveryForPdf] = useState(null);
    const { isSubmitting, safeSubmit: safeRegister } = useSafeSubmit();
    // Stats and Toast State
    const cameraInputRef = useRef(null);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

    const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

    const showToast = (message, type = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 5000);
    };

    const handlePhotoCapture = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        setIsUploadingPhoto(true);
        try {
            const displayId = selectedDelivery?.displayId || 'delivery';
            const publicUrl = await uploadDevicePhoto(file, `delivery_${displayId}`);
            setDeliveryForm(prev => ({
                ...prev,
                photoUrl: publicUrl
            }));
            showToast('Foto cargada correctamente', 'success');
        } catch (err) {
            console.error(err);
            showToast('Error al subir la fotografía', 'error');
        } finally {
            setIsUploadingPhoto(false);
            if (cameraInputRef.current) {
                cameraInputRef.current.value = '';
            }
        }
    };

    const [deliveryForm, setDeliveryForm] = useState({
        receivedBy: '',
        dni: '',
        notes: '',
        deliveredDate: '',
        actualTime: '',
        photoUrl: null,
        sendWhatsapp: false,
        emailAddress: ''
    });

    // 1. APLANAR DATOS: Convertir las tareas relacionales en una lista de Entregas individuales
    const myAssignedDeliveries = useMemo(() => {
        if (!currentUser) return [];
        
        const items = [];

        // 1. Procesar tareas de la nueva tabla relacional
        logisticsTasks.forEach(task => {
            const driverName = (task.delivery_person || task.deliveryPerson || '').trim().toLowerCase();
            const driverUid = String(task.assigned_to || task.assignedTo || '');
            
            // FILTRO: Solo si está asignado a MÍ
            const isAssignedByName = driverName && (driverName === uName || uName.includes(driverName) || driverName.includes(uName));
            const isAssignedByUid = driverUid && (driverUid === uId);
            
            if (isAssignedByName || isAssignedByUid) {
                // FILTRO: Solo si está en 'En Transito'
                if (task.status === 'En Transito') {
                    const parentTicket = tickets.find(t => t && String(t.id) === String(task.ticket_id || task.ticketId));
                    
                    items.push({
                        ...parentTicket, // Datos base del ticket
                        id: parentTicket?.id,
                        taskId: task.id,
                        isMainTicket: false, // Ahora todo se trata como tarea individual
                        displayId: task.case_number || (parentTicket?.id ? String(parentTicket.id).substring(0, 8) : 'SUB-CASE'),
                        displaySubject: task.subject || parentTicket?.subject,
                        caseNumber: task.caseNumber || task.case_number,
                        displayAddress: task.address || parentTicket?.logistics?.address || 'Sin dirección',
                        displayFloorDept: task.floorDept || task.floor_dept || parentTicket?.logistics?.floorDept || '',
                        displayStatus: task.status || 'Pendiente',
                        displayDate: task.date,
                        requester: task.recipient || parentTicket?.requester || 'Destinatario',
                        displayPhone: task.phone || parentTicket?.logistics?.phone || parentTicket?.requesterPhone || 'Sin teléfono',
                        timeSlot: task.time_slot || task.timeSlot,
                        deliveryOrder: task.delivery_order || task.deliveryOrder || 0,
                        taskAssets: task.assets || [],
                        taskAccessories: task.accessories || [],
                        taskYubikeys: task.yubikeys || [],
                        instructions: task.instructions || parentTicket?.logistics?.instructions || parentTicket?.instructions || '',
                        hasNewNotes: (() => {
                            const chat = parentTicket?.chatLog || task.chat_log || task.chatLog || [];
                            return chat.length > 0;
                        })(),
                        hasUnreadChat: (() => {
                            const chat = parentTicket?.chatLog || task.chat_log || task.chatLog || [];
                            if (chat.length === 0) return false;
                            return chat[chat.length - 1].user !== currentUser?.name;
                        })()
                    });
                }
            }
        });

        // 2. Compatibilidad Legacy: Buscar en tickets y sus casos asociados anidados
        tickets.forEach(t => {
            const hasNewTasks = logisticsTasks.some(tk => tk && String(tk.ticket_id || tk.ticketId) === String(t.id));
            if (hasNewTasks) return; // Si ya tiene tareas nuevas, ignoramos el modo legacy

            // A. Revisar el ticket principal
            const tDriverName = (t.logistics?.delivery_person || t.logistics?.deliveryPerson || '').toLowerCase();
            const tDriverUid = t.logistics?.assigned_to || t.logistics?.assignedTo;
            const isTicketAssigned = (tDriverName && (tDriverName === uName || uName.includes(tDriverName) || tDriverName.includes(uName))) || 
                                     (tDriverUid && (String(tDriverUid) === uId));
            
            if (isTicketAssigned && t.logistics?.status === 'En Transito') {
                items.push({
                    ...t,
                    isMainTicket: true,
                    displayId: t.id,
                    displaySubject: t.subject,
                    displayAddress: t.logistics?.address,
                    displayFloorDept: t.logistics?.floorDept || '',
                    displayStatus: t.logistics?.status || 'Pendiente',
                    displayDate: t.logistics?.date,
                    instructions: t.instructions || '',
                    hasNewNotes: (() => {
                        const chat = t.chatLog || [];
                        return chat.length > 0;
                    })(),
                    hasUnreadChat: (() => {
                        const chat = t.chatLog || [];
                        if (chat.length === 0) return false;
                        return chat[chat.length - 1].user !== currentUser?.name;
                    })()
                });
            }

            // B. REVISAR CASOS ASOCIADOS LEGACY (Unificado por normalizador ahora)
            if (t.associatedCases && Array.isArray(t.associatedCases)) {
                t.associatedCases.forEach((c, idx) => {
                    const cDriverName = (c.delivery_person || '').toLowerCase();
                    const cDriverUid = String(c.assigned_to || '');
                    const isCaseAssigned = (cDriverName && (cDriverName === uName || uName.includes(cDriverName) || cDriverName.includes(uName))) || 
                                           (cDriverUid && (cDriverUid === uId));
                    
                    if (isCaseAssigned) {
                        const cStatus = c.logistics?.status || 'Pendiente';
                        if (cStatus === 'En Transito') {
                            items.push({
                                ...t, // Datos del ticket padre
                                id: t.id,
                                legacyCaseIndex: idx,
                                isMainTicket: false,
                                displayId: c.caseNumber || c.case_number || `${String(t.id).substring(0,8)}-${idx}`,
                                displaySubject: c.subject || t.subject,
                                displayAddress: c.logistics?.address || t.logistics?.address,
                                displayFloorDept: c.logistics?.floorDept || t.logistics?.floorDept || '',
                                displayStatus: cStatus,
                                displayDate: c.logistics?.date,
                                requester: c.requester || t.requester,
                                timeSlot: c.logistics?.timeSlot || 'AM',
                                taskAssets: c.assets || [],
                                taskAccessories: c.accessories || [],
                                deliveryOrder: c.logistics?.deliveryOrder || c.logistics?.delivery_order || 0,
                                instructions: c.instructions || t.instructions || '',
                                hasNewNotes: (() => {
                                    const chat = t.chatLog || [];
                                    return chat.length > 0;
                                })(),
                                hasUnreadChat: (() => {
                                    const chat = t.chatLog || [];
                                    if (chat.length === 0) return false;
                                    return chat[chat.length - 1].user !== currentUser?.name;
                                })()
                            });
                        }
                    }
                });
            }
        });

        // Aplicar orden optimizado si existe
        if (optimizedOrder.length > 0) {
            return [...items].sort((a, b) => {
                const idxA = optimizedOrder.indexOf(a.displayId);
                const idxB = optimizedOrder.indexOf(b.displayId);
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                return 0;
            });
        }

        return items;
    }, [tickets, currentUser, optimizedOrder, logisticsTasks]);

    // 2. ESTADÍSTICAS MOVIDAS A /dashboard/my-stats

    // 3. AGRUPAR POR FECHA
    const groupedDeliveries = useMemo(() => {
        const groups = {};
        
        myAssignedDeliveries.forEach(delivery => {
            const date = delivery.displayDate || 'Sin Fecha';
            if (!groups[date]) groups[date] = [];
            groups[date].push(delivery);
        });

        // Ordenar cada grupo por el número de orden de visita
        Object.keys(groups).forEach(date => {
            groups[date].sort((a, b) => (a.deliveryOrder || 0) - (b.deliveryOrder || 0));
        });

        // Ordenar fechas cronológicamente
        return Object.keys(groups)
            .sort((a, b) => {
                if (a === 'Sin Fecha') return 1;
                if (b === 'Sin Fecha') return -1;
                const dateA = new Date(a);
                const dateB = new Date(b);
                if (isNaN(dateA.getTime())) return 1;
                if (isNaN(dateB.getTime())) return -1;
                return dateA - dateB;
            })
            .reduce((acc, key) => {
                acc[key] = groups[key];
                return acc;
            }, {});
    }, [myAssignedDeliveries]);

    // Procesar escaneo automático desde URL (vía QR) - Movido aquí para evitar ReferenceError
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const params = new URLSearchParams(window.location.search);
        const scanId = params.get('scan');
        
        if (scanId && myAssignedDeliveries.length > 0) {
            const targetId = String(scanId).trim();
            const delivery = myAssignedDeliveries.find(d => 
                String(d.id) === targetId || 
                String(d.displayId) === targetId
            );

            if (delivery) {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const day = String(today.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;
                const hours = String(today.getHours()).padStart(2, '0');
                const minutes = String(today.getMinutes()).padStart(2, '0');
                const localTimeStr = `${hours}:${minutes}`;

                // Reducido delay para mayor velocidad de respuesta
                setTimeout(() => {
                    setSelectedDelivery(delivery);
                    setIsDeliveryModalOpen(true);
                    setDeliveryForm(prev => ({
                        ...prev,
                        receivedBy: delivery.requester || '',
                        dni: '',
                        notes: '',
                        deliveredDate: localDateStr,
                        actualTime: localTimeStr
                    }));
                    showToast('Envío identificado desde QR', 'success');
                    
                    // Limpiar la URL
                    params.delete('scan');
                    const newQuery = params.toString();
                    router.replace(window.location.pathname + (newQuery ? `?${newQuery}` : ''));
                }, 100);
            }
        }
    }, [myAssignedDeliveries.length]);

    const handleUpdateOrder = async (delivery, newValue) => {
        const orderNum = parseInt(newValue);
        if (isNaN(orderNum)) return;

        try {
            if (delivery.taskId) {
                await updateLogisticsTask(delivery.taskId, { deliveryOrder: orderNum });
            } else if (delivery.isMainTicket) {
                const updatedLogistics = {
                    ...delivery.logistics,
                    deliveryOrder: orderNum
                };
                await updateTicket(delivery.id, { logistics: updatedLogistics });
            }
            showToast('Orden actualizado', 'success');
        } catch (error) {
            console.error('Error al actualizar orden:', error);
            showToast('Error al guardar el orden', 'error');
        }
    };

    const handleDeliverySubmit = async (e) => {
        e.preventDefault();
        
        if (!deliveryForm.receivedBy || !deliveryForm.dni) {
            showToast('Nombre y DNI son obligatorios', 'error');
            return;
        }

        // Combinar la fecha y hora manuales del formulario para crear el timestamp en la zona horaria del usuario
        let finalDeliveredAt = new Date().toISOString();
        if (deliveryForm.deliveredDate && deliveryForm.actualTime) {
            const [yr, mo, dy] = deliveryForm.deliveredDate.split('-').map(Number);
            const [hr, mn] = deliveryForm.actualTime.split(':').map(Number);
            const localDateObj = new Date(yr, mo - 1, dy, hr, mn);
            if (!isNaN(localDateObj.getTime())) {
                finalDeliveredAt = localDateObj.toISOString();
            }
        }

        await safeRegister(async () => {
            // Cascaded photo update to assets in inventory
            if (deliveryForm.photoUrl) {
                let assetsToUpdate = [];
                if (selectedDelivery.taskAssets && selectedDelivery.taskAssets.length > 0) {
                    assetsToUpdate = selectedDelivery.taskAssets;
                } else if (selectedDelivery.associatedAssets && selectedDelivery.associatedAssets.length > 0) {
                    assetsToUpdate = selectedDelivery.associatedAssets;
                } else if (selectedDelivery.assetInfo?.serial) {
                    assetsToUpdate = [selectedDelivery.assetInfo];
                }

                for (const asset of assetsToUpdate) {
                    if (asset.serial || asset.id) {
                        const currentNotes = asset.notes || '';
                        const query = supabase.from('assets').update({ 
                            photo_url: deliveryForm.photoUrl,
                            notes: `${currentNotes}\n[Estado registrado en entrega/devolución]: ${deliveryForm.notes || 'Sin observaciones'}`.trim()
                        });
                        
                        if (asset.id && String(asset.id).startsWith('AST-')) {
                            await query.eq('id', asset.id);
                        } else if (asset.serial) {
                            await query.eq('serial', asset.serial);
                        }
                    }
                }
            }

            // Lógica para actualizar usando la nueva tabla de tareas
            if (selectedDelivery.taskId) {
                // Actualizar la tarea relacional directamente
                await updateLogisticsTask(selectedDelivery.taskId, {
                    status: 'Entregado',
                    deliveryInfo: {
                        receivedBy: deliveryForm.receivedBy,
                        dni: deliveryForm.dni,
                        notes: deliveryForm.notes,
                        deliveredAt: finalDeliveredAt,
                        actualTime: deliveryForm.actualTime,
                        sendWhatsapp: deliveryForm.sendWhatsapp,
                        emailAddress: deliveryForm.emailAddress,
                        photoUrl: deliveryForm.photoUrl || null
                    }
                });
            } else if (selectedDelivery.isMainTicket) {
                // Caso legacy: Ticket principal sin tareas asignadas
                const updatedLogistics = {
                    ...selectedDelivery.logistics,
                    status: 'Entregado',
                    deliveryInfo: {
                        receivedBy: deliveryForm.receivedBy,
                        dni: deliveryForm.dni,
                        notes: deliveryForm.notes,
                        deliveredAt: finalDeliveredAt,
                        actualTime: deliveryForm.actualTime,
                        sendWhatsapp: deliveryForm.sendWhatsapp,
                        emailAddress: deliveryForm.emailAddress,
                        photoUrl: deliveryForm.photoUrl || null
                    }
                };
                const success = await updateTicket(selectedDelivery.id, { logistics: updatedLogistics });
                if (!success) throw new Error('Error al actualizar el ticket principal');
            } else if (selectedDelivery.legacyCaseIndex !== undefined) {
                // Caso legacy: Sub-caso anidado en associatedCases del ticket principal
                const parentTicket = tickets.find(t => t.id === selectedDelivery.id);
                if (parentTicket && parentTicket.associatedCases) {
                    const updatedCases = [...parentTicket.associatedCases];
                    updatedCases[selectedDelivery.legacyCaseIndex] = {
                        ...updatedCases[selectedDelivery.legacyCaseIndex],
                        logistics: {
                            ...updatedCases[selectedDelivery.legacyCaseIndex].logistics,
                            status: 'Entregado',
                            deliveryInfo: {
                                receivedBy: deliveryForm.receivedBy,
                                dni: deliveryForm.dni,
                                notes: deliveryForm.notes,
                                deliveredAt: finalDeliveredAt,
                                actualTime: deliveryForm.actualTime,
                                sendWhatsapp: deliveryForm.sendWhatsapp,
                                emailAddress: deliveryForm.emailAddress,
                                photoUrl: deliveryForm.photoUrl || null
                            }
                        }
                    };
                    const success = await updateTicket(parentTicket.id, { associatedCases: updatedCases });
                    if (!success) throw new Error('Error al actualizar el sub-caso');
                }
            }
            
            showToast('Entrega registrada correctamente', 'success');
            await refreshData(); // Asegurar sincronización total tras el guardado
            setIsDeliveryModalOpen(false);
            setCompletedDeliveryForPdf({
                delivery: selectedDelivery,
                form: { ...deliveryForm }
            });
            setShowDownloadPrompt(true);
            setDeliveryForm({ receivedBy: '', dni: '', notes: '', deliveredDate: '', actualTime: '', photoUrl: null, sendWhatsapp: false, emailAddress: '' });
        }).catch(error => {
            console.error('Error al registrar entrega:', error);
            showToast('Error al guardar los datos', 'error');
        });
    };

    const handleScanSuccess = (data) => {
        setIsScannerOpen(false);
        if (!data) {
            showToast('Lectura incorrecta', 'error');
            return;
        }

        // Extraer ID (puede venir como string directo o en un objeto)
        let scannedText = data.id || data.raw || (typeof data === 'string' ? data : '');
        
        // Si el texto es una URL, extraer el ID (soporta /tickets/ID o ?scan=ID)
        if (scannedText.includes('/dashboard/tickets/')) {
            const parts = scannedText.split('/');
            scannedText = parts[parts.length - 1];
        } else if (scannedText.includes('?scan=')) {
            try {
                const url = new URL(scannedText);
                scannedText = url.searchParams.get('scan') || scannedText;
            } catch (e) {
                // Fallback si no es una URL válida pero contiene el parámetro
                const match = scannedText.match(/[?&]scan=([^&]+)/);
                if (match) scannedText = match[1];
            }
        }

        // Buscar el envío en la lista del conductor
        const targetId = String(scannedText).trim();
        const delivery = myAssignedDeliveries.find(d => 
            String(d.id) === targetId || 
            String(d.displayId) === targetId
        );

        if (delivery) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            const localDateStr = `${year}-${month}-${day}`;
            const hours = String(today.getHours()).padStart(2, '0');
            const minutes = String(today.getMinutes()).padStart(2, '0');
            const localTimeStr = `${hours}:${minutes}`;

            setSelectedDelivery(delivery);
            setIsDeliveryModalOpen(true);
            setDeliveryForm({
                receivedBy: delivery.requester || '',
                dni: '',
                notes: '',
                deliveredDate: localDateStr,
                actualTime: localTimeStr,
                sendWhatsapp: false,
                emailAddress: ''
            });
            showToast('Envío encontrado', 'success');
        } else {
            showToast(`Envío #${targetId} no asignado o ya entregado`, 'error');
        }
    };

    const openGoogleMaps = (address) => {
        if (!address) return;
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    };

    const getColorByDate = (dateStr) => {
        if (dateStr === 'Sin Fecha') return '#94a3b8';
        const today = new Date().toISOString().split('T')[0];
        if (dateStr === today) return '#3b82f6'; // Azul hoy
        if (dateStr < today) return '#ef4444'; // Rojo retrasado
        return '#10b981'; // Verde futuro
    };

    // Ayudante para identificar el tipo de operación
    const getOperationType = (delivery) => {
        const subject = (delivery.displaySubject || '').toLowerCase();
        if (subject.includes('collection') || subject.includes('recupero') || subject.includes('proceso de baja') || subject.includes('retiro')) {
            return { label: 'RECUPERO', color: '#f59e0b', icon: '📥' };
        }
        return { label: 'ENTREGA', color: '#10b981', icon: '📤' };
    };

    // Ayudante para resumir contenido con detalle
    const getDevicesList = (delivery) => {
        const list = [];
        
        if (delivery.taskId) {
            // Nueva arquitectura: usar datos detallados de la tarea
            const assets = Array.isArray(delivery.taskAssets) ? delivery.taskAssets : [];
            const accessories = Array.isArray(delivery.taskAccessories) ? delivery.taskAccessories : [];
            const yubikeys = Array.isArray(delivery.taskYubikeys) ? delivery.taskYubikeys : [];

            if (assets.length > 0) {
                assets.forEach(asset => {
                    list.push(`${asset.model || 'Equipo'}: ${asset.serial || 'Sin Serial'}`);
                });
            }
            if (accessories.length > 0) {
                const accNames = accessories.map(a => a.name || 'Accesorio').join(', ');
                list.push(`${accessories.length} Accesorios: ${accNames}`);
            } else if (typeof delivery.taskAccessories === 'object' && delivery.taskAccessories !== null) {
                // Manejar caso donde accesorios es un objeto de flags (ej: {backpack: true})
                const active = Object.entries(delivery.taskAccessories)
                    .filter(([_, val]) => val === true || val === 'true')
                    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());
                if (active.length > 0) list.push(`Accesorios: ${active.join(', ')}`);
            }

            if (yubikeys.length > 0) {
                const yubiSerials = yubikeys.map(y => y.serial || 'S/N').join(', ');
                list.push(`${yubikeys.length} YubiKeys: ${yubiSerials}`);
            }
        } else if (delivery.isMainTicket) {
            // Caso legacy
            if (delivery.assetInfo?.serial) {
                list.push(`${delivery.assetInfo.model || 'Equipo'}: ${delivery.assetInfo.serial}`);
            }
            if (delivery.accessoriesCount) {
                list.push(`${delivery.accessoriesCount} Accesorios`);
            } else if (typeof delivery.accessories === 'object' && delivery.accessories !== null) {
                const active = Object.entries(delivery.accessories)
                    .filter(([_, val]) => val === true || val === 'true')
                    .map(([key]) => key.replace(/([A-Z])/g, ' $1').toLowerCase());
                if (active.length > 0) list.push(`Accesorios: ${active.join(', ')}`);
            }
            if (delivery.yubikeysCount) {
                list.push(`${delivery.yubikeysCount} YubiKeys`);
            }
        }
        
        return list.length > 0 ? list : ['Sin items definidos'];
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1rem' }}>
            {/* Header Mobile-friendly */}
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
                        Mis <span style={{ color: 'var(--primary-color)' }}>Envíos</span>
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
                        Logística y ruta de entregas asignada
                    </p>
                </div>
                <Button 
                    variant="primary" 
                    icon={QrCode} 
                    onClick={() => setIsScannerOpen(true)}
                    style={{ 
                        borderRadius: '12px', 
                        width: '42px', 
                        height: '42px', 
                        padding: 0, 
                        display: 'flex', 
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)'
                    }}
                    title="Escanear Etiqueta"
                />
            </div>

            {/* Stats Bar movida a /dashboard/my-stats */}

            {Object.keys(groupedDeliveries).length === 0 ? (
                <Card style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                    <Truck size={48} style={{ color: 'var(--text-secondary)', opacity: 0.2, marginBottom: '1rem' }} />
                    <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>No tienes envíos asignados pendientes</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Cuando se te asigne un nuevo servicio, aparecerá en esta lista.</p>
                </Card>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    {Object.entries(groupedDeliveries).map(([date, deliveries]) => {
                        const dayColor = getColorByDate(date);
                        return (
                            <div key={date} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                <div style={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '1rem', 
                                    padding: '0.5rem 0.75rem',
                                    position: 'sticky',
                                    top: '0',
                                    backgroundColor: 'var(--background)',
                                    zIndex: 10,
                                    margin: '0 -0.5rem'
                                }}>
                                    <div style={{ backgroundColor: dayColor, width: '10px', height: '10px', borderRadius: '50%' }}></div>
                                    <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        {(() => {
                                            const d = (date && date !== 'Sin Fecha') ? new Date(date + 'T00:00:00') : null;
                                            const isInvalid = !d || isNaN(d.getTime());
                                            
                                            if (isInvalid) return 'Fecha no definida';
                                            
                                            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
                                            const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                                            return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
                                        })()}
                                    </h2>
                                    <div style={{ flex: 1, height: '1px', background: `linear-gradient(to right, ${dayColor}44, transparent)` }}></div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                                    {deliveries.map(delivery => (
                                        <Card key={delivery.taskId || `${delivery.id}-${delivery.displayId}`} style={{ borderLeft: `5px solid ${delivery.status === 'Resuelto' ? '#22c55e' : dayColor}` }}>
                                            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                                                <div style={{ flex: 1, width: '100%' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 800, color: dayColor, fontSize: '1.1rem' }}>#{delivery.displayId}</span>
                                                        {!delivery.isMainTicket && <span style={{ fontSize: '0.66rem', background: 'var(--background)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Caso SFDC</span>}
                                                        {(delivery.instructions || delivery.hasNewNotes) && (
                                                            <div 
                                                                className={delivery.hasUnreadChat ? "unread-badge-v2" : ""}
                                                                style={{ 
                                                                    color: delivery.hasUnreadChat ? 'white' : 'var(--primary-color)',
                                                                    width: delivery.hasUnreadChat ? '26px' : 'auto',
                                                                    height: delivery.hasUnreadChat ? '26px' : 'auto',
                                                                    display: 'flex',
                                                                    marginRight: '8px'
                                                                }}
                                                            >
                                                                <MessageSquare 
                                                                    size={16} 
                                                                    fill={delivery.hasUnreadChat ? 'white' : 'none'} 
                                                                    stroke={delivery.hasUnreadChat ? 'none' : 'currentColor'}
                                                                />
                                                            </div>
                                                        )}
                                                        <Badge variant={
                                                            delivery.displayStatus === 'Entregado' ? 'success' :
                                                            delivery.displayStatus === 'En Transito' ? 'info' :
                                                            delivery.displayStatus === 'Para Coordinar' ? 'warning' :
                                                            'default' // Pendiente
                                                        }>
                                                            {delivery.displayStatus || 'Pendiente'}
                                                        </Badge>
                                                    </div>
                                                    <div style={{ marginBottom: '0.5rem' }}>
                                                        <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.2' }}>{delivery.displaySubject}</p>
                                                        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>{delivery.requester}</h3>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                                        <div 
                                                            onClick={() => openGoogleMaps(delivery.displayAddress)}
                                                            style={{ 
                                                                display: 'flex', 
                                                                alignItems: 'flex-start', 
                                                                gap: '0.5rem', 
                                                                color: dayColor, 
                                                                cursor: 'pointer',
                                                                fontSize: '0.9rem',
                                                                fontWeight: 500,
                                                                lineHeight: 1.3
                                                            }}
                                                            className="hover-underline"
                                                        >
                                                            <MapPin size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                                                            <span>
                                                                {delivery.displayAddress}
                                                                <Navigation size={12} style={{ opacity: 0.7, marginLeft: '4px', display: 'inline-block', verticalAlign: 'middle' }} />
                                                                {delivery.displayFloorDept && (
                                                                    <strong style={{ display: 'block', marginTop: '4px', color: '#1e293b', fontSize: '0.85rem', backgroundColor: '#e2e8f0', padding: '2px 8px', borderRadius: '4px', width: 'fit-content', fontWeight: '700' }}>
                                                                        Piso y Depto: {delivery.displayFloorDept}
                                                                    </strong>
                                                                )}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--text-main)', fontSize: '0.95rem', fontWeight: 600, marginTop: '0.2rem', flexWrap: 'wrap' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Calendar size={16} />
                                                                {delivery.displayDate || 'No definida'}
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                <Clock size={16} />
                                                                Turno: {delivery.timeSlot || 'AM'}
                                                            </div>
                                                            {delivery.displayPhone && delivery.displayPhone !== 'Sin teléfono' && (
                                                                <a 
                                                                    href={`tel:${delivery.displayPhone}`}
                                                                    style={{ 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        gap: '0.4rem', 
                                                                        color: 'var(--primary-color)',
                                                                        textDecoration: 'none',
                                                                        fontWeight: 700
                                                                    }}
                                                                >
                                                                    <div style={{ width: '18px', height: '18px', background: 'var(--primary-color)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                                                                        <span style={{ fontSize: '10px' }}>📞</span>
                                                                    </div>
                                                                    {delivery.displayPhone}
                                                                </a>
                                                            )}
                                                        </div>

                                                        {/* Listado de Items en la Tarjeta */}
                                                        <div style={{ 
                                                            marginTop: '0.75rem', 
                                                            padding: '0.6rem', 
                                                            background: 'rgba(0,0,0,0.03)', 
                                                            borderRadius: '8px',
                                                            borderLeft: `3px solid ${dayColor}`
                                                        }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                                    Contenido
                                                                </div>
                                                                <div style={{ 
                                                                    fontSize: '0.7rem', 
                                                                    fontWeight: 900, 
                                                                    color: getOperationType(delivery).color,
                                                                    backgroundColor: `${getOperationType(delivery).color}15`,
                                                                    padding: '2px 8px',
                                                                    borderRadius: '4px',
                                                                    border: `1px solid ${getOperationType(delivery).color}44`
                                                                }}>
                                                                    {getOperationType(delivery).icon} {getOperationType(delivery).label}
                                                                </div>
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                                                {getDevicesList(delivery).map((item, idx) => (
                                                                    <div key={idx} style={{ fontSize: '0.8rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                                                        <div style={{ width: '4px', height: '4px', backgroundColor: dayColor, borderRadius: '50%', flexShrink: 0 }}></div>
                                                                        {item}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex-mobile-column" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'flex-end', width: '100%', maxWidth: '200px' }}>
                                                    {delivery.displayStatus !== 'Entregado' && (
                                                        <Button 
                                                            icon={CheckCircle2}
                                                            onClick={() => {
                                                                setSelectedDelivery(delivery);
                                                                setIsDeliveryModalOpen(true);
                                                                
                                                                const today = new Date();
                                                                const year = today.getFullYear();
                                                                const month = String(today.getMonth() + 1).padStart(2, '0');
                                                                const day = String(today.getDate()).padStart(2, '0');
                                                                const localDateStr = `${year}-${month}-${day}`;
                                                                const hours = String(today.getHours()).padStart(2, '0');
                                                                const minutes = String(today.getMinutes()).padStart(2, '0');
                                                                const localTimeStr = `${hours}:${minutes}`;

                                                                setDeliveryForm(prev => ({
                                                                    ...prev,
                                                                    receivedBy: delivery.requester || '',
                                                                    dni: '',
                                                                    notes: '',
                                                                    deliveredDate: localDateStr,
                                                                    actualTime: localTimeStr
                                                                }));
                                                            }}
                                                            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem', width: '100%', backgroundColor: dayColor, borderColor: dayColor }}
                                                        >
                                                            REGISTRAR
                                                        </Button>
                                                    )}

                                                    <div style={{ display: 'flex', flexDirection: 'row', gap: '10px', alignItems: 'center', justifyContent: 'flex-end', width: '100%' }}>
                                                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>
                                                            Orden de Visita:
                                                        </label>
                                                        {editingOrderId === (delivery.taskId || delivery.id) ? (
                                                            <input
                                                                type="number"
                                                                autoFocus
                                                                value={editOrderValue}
                                                                onChange={(e) => setEditOrderValue(e.target.value)}
                                                                onBlur={() => {
                                                                    handleUpdateOrder(delivery, editOrderValue);
                                                                    setEditingOrderId(null);
                                                                }}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        handleUpdateOrder(delivery, editOrderValue);
                                                                        setEditingOrderId(null);
                                                                    }
                                                                }}
                                                                style={{
                                                                    width: '45px',
                                                                    height: '45px',
                                                                    backgroundColor: 'white',
                                                                    border: `2px solid ${dayColor}`,
                                                                    borderRadius: '50%',
                                                                    textAlign: 'center',
                                                                    fontWeight: 800,
                                                                    fontSize: '1.2rem',
                                                                    color: dayColor,
                                                                    outline: 'none',
                                                                    boxShadow: `0 4px 10px ${dayColor}44`
                                                                }}
                                                            />
                                                        ) : (
                                                            <div 
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingOrderId(delivery.taskId || delivery.id);
                                                                    setEditOrderValue(String(delivery.deliveryOrder || 0));
                                                                }}
                                                                style={{ 
                                                                    width: '45px', 
                                                                    height: '45px', 
                                                                    display: 'flex', 
                                                                    alignItems: 'center', 
                                                                    justifyContent: 'center', 
                                                                    backgroundColor: dayColor, 
                                                                    borderRadius: '50%', 
                                                                    color: 'white', 
                                                                    fontWeight: 800,
                                                                    fontSize: '1.2rem',
                                                                    cursor: 'pointer',
                                                                    boxShadow: `0 4px 10px ${dayColor}44`,
                                                                    transition: 'transform 0.2s ease'
                                                                }}
                                                                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                                                                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                            >
                                                                {delivery.deliveryOrder || 0}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Registro de Entrega */}
            {/* disableOutsideClick: evita que el modal se cierre al tocar
                el banner de descarga del PDF en dispositivos mobile */}
            <Modal
                isOpen={isDeliveryModalOpen}
                onClose={() => setIsDeliveryModalOpen(false)}
                title={`Registro de Entrega/Recupero: #${selectedDelivery?.displayId}`}
                disableOutsideClick={true}
            >
                <form onSubmit={handleDeliverySubmit}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Nombre del Destinatario/Requester */}
                        {selectedDelivery?.requester && (
                            <div style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.5rem',
                                color: 'var(--accent-primary)',
                                fontWeight: 700,
                                fontSize: '1.1rem',
                                padding: '0.2rem 0.5rem'
                            }}>
                                <User size={18} />
                                {selectedDelivery.requester}
                            </div>
                        )}

                        {/* Fecha y Hora Editable */}
                        <div style={{ 
                            background: 'var(--surface-active)', 
                            borderRadius: 'var(--radius-md)', 
                            padding: '0.75rem',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem'
                        }}>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="deliveredDate" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Día de Operación</label>
                                <input
                                    id="deliveredDate"
                                    type="date"
                                    value={deliveryForm.deliveredDate}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, deliveredDate: e.target.value })}
                                    style={{
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface-main)',
                                        color: 'var(--text-main)',
                                        padding: '6px 10px',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        fontFamily: 'inherit'
                                    }}
                                    required
                                />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label htmlFor="actualTime" style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 800, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', textAlign: 'right' }}>Hora de Registro</label>
                                <input
                                    id="actualTime"
                                    type="time"
                                    value={deliveryForm.actualTime}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, actualTime: e.target.value })}
                                    style={{
                                        fontWeight: 700,
                                        fontSize: '0.95rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'var(--surface-main)',
                                        color: 'var(--text-main)',
                                        padding: '6px 10px',
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        textAlign: 'right',
                                        fontFamily: 'inherit'
                                    }}
                                    required
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Recibido por (Nombre Completo)</label>
                            <input
                                type="text"
                                value={deliveryForm.receivedBy}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, receivedBy: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem'
                                }}
                                placeholder="Ej: Juan Pérez"
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>DNI / Identificación</label>
                            <input
                                type="text"
                                value={deliveryForm.dni}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, dni: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem'
                                }}
                                placeholder="Ej: 12.345.678"
                                required
                            />
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Notas adicionales</label>
                            <textarea
                                value={deliveryForm.notes}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                                style={{
                                    padding: '0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface-main)',
                                    color: 'var(--text-main)',
                                    fontSize: '0.95rem',
                                    minHeight: '80px',
                                    resize: 'vertical'
                                }}
                                placeholder="Cualquier observación relevante sobre la entrega..."
                            />
                        </div>

                        {/* Registro Fotográfico (Opcional) */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Fotografía de Estado (Opcional)</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                ref={cameraInputRef} 
                                onChange={handlePhotoCapture} 
                                style={{ display: 'none' }} 
                            />
                            {deliveryForm.photoUrl ? (
                                <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                    <img 
                                        src={deliveryForm.photoUrl} 
                                        alt="Foto de estado" 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDeliveryForm(prev => ({ ...prev, photoUrl: null }))}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '28px',
                                            height: '28px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                                        }}
                                        title="Eliminar foto"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => cameraInputRef.current?.click()}
                                    disabled={isUploadingPhoto}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem',
                                        padding: '0.75rem',
                                        border: '1px dashed var(--border)',
                                        backgroundColor: 'var(--surface-active)',
                                        color: 'var(--text-main)',
                                        borderRadius: 'var(--radius-sm)',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem',
                                        width: '100%',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {isUploadingPhoto ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            <span>Subiendo fotografía...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={18} />
                                            <span>Tomar Foto del Estado</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <Button 
                                    type="button" 
                                    variant="secondary" 
                                    onClick={() => setIsDeliveryModalOpen(false)} 
                                    style={{ flex: 1 }}
                                >
                                    CANCELAR
                                </Button>
                                <Button 
                                    type="submit" 
                                    icon={isSubmitting ? Loader2 : CheckCircle2} 
                                    disabled={isSubmitting}
                                    style={{ flex: 1 }}
                                    className={isSubmitting ? "animate-pulse" : ""}
                                >
                                    {isSubmitting ? 'REGISTRANDO...' : 'CONFIRMAR ENTREGA'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </form>
            </Modal>

            {/* Modal de Prompt de Descarga de PDF */}
            <Modal
                isOpen={showDownloadPrompt}
                onClose={() => setShowDownloadPrompt(false)}
                title="Entrega Registrada con Éxito"
            >
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>La entrega se guardó correctamente.</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>¿Desea descargar el Remito PDF?</p>
                    
                    <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                        <Button 
                            type="button" 
                            onClick={() => {
                                if (completedDeliveryForPdf) {
                                    const { delivery, form } = completedDeliveryForPdf;
                                    // 1. Normalizar activos de hardware
                                    let associatedAssets = [];
                                    if (delivery.taskAssets && delivery.taskAssets.length > 0) {
                                        associatedAssets = delivery.taskAssets;
                                    } else if (delivery.associatedAssets && delivery.associatedAssets.length > 0) {
                                        associatedAssets = delivery.associatedAssets;
                                    } else if (delivery.assetInfo?.serial) {
                                        associatedAssets = [{
                                            serial: delivery.assetInfo.serial,
                                            type: delivery.assetInfo.model || 'Hardware',
                                            name: delivery.assetInfo.name || '-'
                                        }];
                                    }

                                    // 2. Normalizar accesorios
                                    const mappedAccessories = {};
                                    if (Array.isArray(delivery.taskAccessories)) {
                                        delivery.taskAccessories.forEach(acc => {
                                            const name = typeof acc === 'string' ? acc : (acc.name || acc);
                                            if (name === 'Mochila Técnica' || name === 'backpack') mappedAccessories.backpack = true;
                                            else if (name === 'Filtro de Pantalla' || name === 'screenFilter') mappedAccessories.screenFilter = true;
                                            else if (name === 'Mouse Óptico' || name === 'mouse') mappedAccessories.mouse = true;
                                            else if (name === 'Teclado USB' || name === 'keyboard') mappedAccessories.keyboard = true;
                                            else if (name === 'Auriculares con Micrófono' || name === 'headset') mappedAccessories.headset = true;
                                            else if (name === 'Cargador Original' || name === 'charger') mappedAccessories.charger = true;
                                            else if (name) mappedAccessories[name] = true;
                                        });
                                    } else if (delivery.taskAccessories && typeof delivery.taskAccessories === 'object') {
                                        Object.assign(mappedAccessories, delivery.taskAccessories);
                                    } else {
                                        Object.assign(mappedAccessories, delivery.accessories || {});
                                    }

                                    // 3. Normalizar Yubikeys
                                    const mappedYubikeys = (delivery.taskYubikeys && delivery.taskYubikeys.length > 0
                                        ? delivery.taskYubikeys
                                        : delivery.yubikeys || []
                                    ).map(yk => ({
                                        serial: typeof yk === 'string' ? yk : yk.serial,
                                        type: (typeof yk === 'object' && yk?.type) || delivery.logistics?.type || 'Entrega'
                                    }));

                                    // 4. Crear ticket virtual compatible
                                    const virtualTicket = {
                                        ...delivery,
                                        subject: delivery.displaySubject || delivery.subject,
                                        caseNumber: delivery.caseNumber || delivery.case_number || (delivery.taskId ? delivery.displayId : ''),
                                        associatedAssets,
                                        accessories: mappedAccessories,
                                        yubikeys: mappedYubikeys
                                    };

                                    const deliveredAtTime = (() => {
                                        if (form.deliveredDate && form.actualTime) {
                                            const [yr, mo, dy] = form.deliveredDate.split('-').map(Number);
                                            const [hr, mn] = form.actualTime.split(':').map(Number);
                                            const localDateObj = new Date(yr, mo - 1, dy, hr, mn);
                                            if (!isNaN(localDateObj.getTime())) {
                                                return localDateObj.toISOString();
                                            }
                                        }
                                        return new Date().toISOString();
                                    })();

                                    setTimeout(() => {
                                        generateTicketPDF(virtualTicket, assets, {
                                            receivedBy: form.receivedBy,
                                            dni: form.dni,
                                            notes: form.notes,
                                            actualTime: form.actualTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                            deliveredAt: deliveredAtTime
                                        }, 'download');
                                    }, 0);
                                }
                                setShowDownloadPrompt(false);
                            }}
                            icon={Download}
                            style={{ 
                                padding: '0.75rem 1.5rem', 
                                fontSize: '1rem', 
                                backgroundColor: '#25D366', 
                                borderColor: '#25D366',
                                color: 'white',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.2)'
                            }}
                        >
                            SÍ, DESCARGAR PDF
                        </Button>
                        <Button 
                            type="button" 
                            variant="secondary" 
                            onClick={() => setShowDownloadPrompt(false)}
                            style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                        >
                            NO, CERRAR
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* QR Scanner Modal */}
            <QRScannerModal 
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScanSuccess={handleScanSuccess}
            />

            {/* Toast Notification */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    backgroundColor: toast.type === 'success' ? '#10b981' : '#ef4444',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    zIndex: 2000,
                    animation: 'fadeIn 0.3s ease-out',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.9rem'
                }}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {toast.message}
                </div>
            )}

            <style jsx>{`
                .hover-underline:hover span {
                    text-decoration: underline;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (max-width: 768px) {
                    .hide-mobile {
                        display: none !important;
                    }
                    .flex-mobile-column {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        max-width: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
