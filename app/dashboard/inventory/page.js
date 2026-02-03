"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useStore } from '../../../lib/store';
import {
    Plus, Search, Filter, Laptop, Smartphone, Monitor,
    HardDrive, Package, Trash2, Edit3, Eye, ArrowRight,
    TrendingUp, AlertTriangle, CheckCircle, Upload, Download, History,
    ChevronDown, ChevronUp, Key, UserPlus, Truck, MapPin
} from 'lucide-react';
import Link from 'next/link';

export default function InventoryPage() {
    const router = useRouter();
    const { assets, consumables, addAsset, addAssets, updateAsset, deleteAsset, updateConsumableStock, addConsumable, deleteConsumable, clearInventory, currentUser, addTicket, users } = useStore();
    const [isHardwareTab, setIsHardwareTab] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isConsumableModalOpen, setIsConsumableModalOpen] = useState(false);
    const [isAddAccessoryModalOpen, setIsAddAccessoryModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState(null);
    const [selectedConsumable, setSelectedConsumable] = useState(null);
    const [stockChange, setStockChange] = useState(0);
    const [isStockExpanded, setIsStockExpanded] = useState(false);
    const [isInventoryExpanded, setIsInventoryExpanded] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [assigningAsset, setAssigningAsset] = useState(null);
    const [assignmentData, setAssignmentData] = useState({
        userId: '',
        userName: '',
        address: '',
        deliveryMethod: 'Andreani'
    });

    const [newAccessory, setNewAccessory] = useState({
        name: '', category: 'Accesorio', stock: 0
    });

    const [newAsset, setNewAsset] = useState({
        name: '', type: 'Laptop', serial: '', assignee: 'Almacén', status: 'Nuevo',
        date: new Date().toISOString().split('T')[0], vendor: 'Other', purchaseOrder: '',
        modelNumber: '', partNumber: '', hardwareSpec: '', imei: '-',
        eolDate: '', notes: '', sfd_case: '', oem: ''
    });
    const [replacementSerial, setReplacementSerial] = useState('');
    const [smartRecommendations, setSmartRecommendations] = useState([]);
    const [assetToReplace, setAssetToReplace] = useState(null);
    const [isSmartSearchOpen, setIsSmartSearchOpen] = useState(false);
    const [searchFilter, setSearchFilter] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'dateLastUpdate', direction: 'desc' });
    const [columnFilters, setColumnFilters] = useState({ status: 'All', type: 'All', assignee: '' });

    // Quick Detail Modal State
    const [stockDetailModal, setStockDetailModal] = useState({ isOpen: false, model: '', status: '', items: [] });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleStockClick = (model, status) => {
        // Filter assets for this specific bucket
        const items = assets.filter(a => {
            const matchModel = a.name === model;
            let matchStatus = false;
            if (status === 'Nuevo') matchStatus = a.status === 'Nuevo' || a.status === 'Disponible';
            else if (status === 'Dañado') matchStatus = ['Dañado', 'Rota', 'De Baja'].includes(a.status);
            else matchStatus = a.status === status;

            return matchModel && matchStatus;
        });

        setStockDetailModal({
            isOpen: true,
            model: model,
            status: status,
            items: items
        });
    };

    const filteredAssets = React.useMemo(() => {
        let result = assets.filter(a => {
            const matchesSearch = a.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                a.serial.toLowerCase().includes(searchFilter.toLowerCase()) ||
                a.assignee.toLowerCase().includes(searchFilter.toLowerCase());

            let matchesStatus = false;
            if (columnFilters.status === 'All') {
                matchesStatus = true;
            } else if (columnFilters.status === 'Nuevo') {
                // 'Nuevo' filter includes both 'Nuevo' and 'Disponible'
                matchesStatus = a.status === 'Nuevo' || a.status === 'Disponible';
            } else if (columnFilters.status === 'Dañado') {
                // 'Dañado' filter includes 'Rota', 'De Baja', 'Dañado'
                matchesStatus = ['Dañado', 'Rota', 'De Baja'].includes(a.status);
            } else {
                matchesStatus = a.status === columnFilters.status;
            }

            const matchesType = columnFilters.type === 'All' || a.type === columnFilters.type;
            const matchesAssignee = !columnFilters.assignee || a.assignee.toLowerCase().includes(columnFilters.assignee.toLowerCase());

            return matchesSearch && matchesStatus && matchesType && matchesAssignee;
        });

        if (sortConfig.key) {
            result.sort((a, b) => {
                const valA = a[sortConfig.key] || '';
                const valB = b[sortConfig.key] || '';
                if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
                if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [assets, searchFilter, sortConfig, columnFilters]);

    const SortIcon = ({ column }) => {
        if (sortConfig.key !== column) return <span style={{ opacity: 0.3, marginLeft: '4px' }}>↕</span>;
        return <span style={{ marginLeft: '4px', color: 'var(--primary-color)' }}>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    const handleCreateOrUpdate = (e) => {
        e.preventDefault();

        // Verificar duplicados solo si estamos CREANDO un activo nuevo
        if (!editingAsset) {
            const isDuplicate = assets.some(a => a.serial.toLowerCase() === newAsset.serial.toLowerCase());
            if (isDuplicate) {
                alert(`Error: Ya existe un activo con el número de serie "${newAsset.serial}".`);
                return;
            }
        }

        if (editingAsset) {
            updateAsset(editingAsset.id, { ...newAsset, dateLastUpdate: new Date().toISOString(), updatedBy: currentUser.name });
        } else {
            addAsset({ ...newAsset, dateLastUpdate: new Date().toISOString(), updatedBy: currentUser.name });
        }
        closeModal();
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingAsset(null);
        setNewAsset({
            name: '', type: 'Laptop', serial: '', assignee: 'Almacén', status: 'Disponible',
            date: new Date().toISOString().split('T')[0], vendor: 'Other', purchaseOrder: '',
            modelNumber: '', partNumber: '', hardwareSpec: '', imei: '-',
            eolDate: '', notes: '', sfd_case: '', oem: ''
        });
    };

    const handleEdit = (asset) => {
        setEditingAsset(asset);
        setNewAsset(asset);
        setIsModalOpen(true);
    };

    const handleDelete = (id) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este activo?')) {
            deleteAsset(id);
        }
    };

    const handleAdjustStock = (e) => {
        e.preventDefault();
        if (selectedConsumable) {
            updateConsumableStock(selectedConsumable.id, stockChange);
            setIsConsumableModalOpen(false);
            setSelectedConsumable(null);
            setStockChange(0);
        }
    };

    const handleAddAccessory = (e) => {
        e.preventDefault();
        addConsumable(newAccessory);
        setIsAddAccessoryModalOpen(false);
        setNewAccessory({ name: '', category: 'Accesorio', stock: 0 });
    };

    const handleDeleteConsumable = (id) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este accesorio de la lista?')) {
            deleteConsumable(id);
        }
    };

    const handleAssignClick = (asset) => {
        setAssigningAsset(asset);
        setIsAssignModalOpen(true);
    };

    const handleAssignSubmit = (e) => {
        e.preventDefault();
        if (!assignmentData.userName) {
            alert('Por favor selecciona un usuario.');
            return;
        }

        // 1. Crear Ticket de Entrega
        const newTicket = {
            subject: `Entrega de Equipo: ${assigningAsset.name}`,
            requester: assignmentData.userName,
            priority: 'Media',
            status: 'En Progreso',
            associatedAssets: [assigningAsset.serial],
            logistics: {
                type: 'Entrega',
                address: assignmentData.address,
                method: assignmentData.deliveryMethod,
                datetime: new Date().toISOString().slice(0, 16)
            }
        };
        addTicket(newTicket);

        // 2. Actualizar Activo
        updateAsset(assigningAsset.id, {
            status: 'Asignado',
            assignee: assignmentData.userName,
            dateLastUpdate: new Date().toISOString(),
            updatedBy: currentUser.name
        });

        alert(`Asignado con éxito. Se ha creado el ticket para ${assignmentData.userName}.`);
        setIsAssignModalOpen(false);
        setAssigningAsset(null);
        setAssignmentData({ userId: '', userName: '', address: '', deliveryMethod: 'Andreani' });
    };

    const getTypeIcon = (type) => {
        switch (type) {
            case 'Laptop': return Laptop;
            case 'Smartphone': return Smartphone;
            case 'Tablet': return Smartphone;
            case 'Security keys': return Key;
            default: return Laptop;
        }
    };

    const handleReplacementSearch = (serial) => {
        setReplacementSerial(serial);
        if (serial.length < 3) {
            setAssetToReplace(null);
            setSmartRecommendations([]);
            return;
        }

        const target = assets.find(a => a.serial.toLowerCase() === serial.toLowerCase());
        if (target) {
            setAssetToReplace(target);
            // Buscar equipos disponibles que se parezcan
            const available = assets.filter(a =>
                a.serial.toLowerCase() !== serial.toLowerCase() &&
                ['Nuevo', 'Disponible', 'Recuperado'].includes(a.status) &&
                a.assignee === 'Almacén'
            );

            const scored = available.map(a => {
                let score = 0;
                if (a.type === target.type) score += 40;
                if (a.oem === target.oem) score += 30;
                if (a.hardwareSpec === target.hardwareSpec) score += 20;
                if (a.name === target.name) score += 10;
                return { ...a, score };
            }).filter(a => a.score > 0).sort((a, b) => b.score - a.score);

            // Deduplicar recomendaciones por modelo para no saturar si hay muchos del mismo tipo
            const uniqueModels = [];
            const result = [];
            for (const item of scored) {
                if (!uniqueModels.includes(item.name)) {
                    uniqueModels.push(item.name);
                    result.push(item);
                }
                if (result.length >= 4) break;
            }

            setSmartRecommendations(result);
        } else {
            setAssetToReplace(null);
            setSmartRecommendations([]);
        }
    };

    const handleCsvUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const rows = text.split('\n').filter(row => row.trim() !== '');
                if (rows.length < 2) {
                    alert('El archivo CSV parece estar vacío o solo tiene cabeceras.');
                    return;
                }

                // Normalización de Cabeceras (Mapping)
                const rawHeaders = rows[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase()); // Remove quotes and lower

                const headerMap = {
                    // Critical Fields
                    'serial': 'serial', 'nro serie': 'serial', 'numero de serie': 'serial', 'sn': 'serial', 's/n': 'serial', 'service tag': 'serial',
                    'name': 'name', 'nombre': 'name', 'equipo': 'name', 'device': 'name', 'producto': 'name',
                    'type': 'type', 'tipo': 'type', 'categoria': 'type',
                    'status': 'status', 'estado': 'status',
                    'assignee': 'assignee', 'asignee': 'assignee', 'usuario': 'assignee', 'asignado a': 'assignee', 'user': 'assignee',

                    // Extended Fields (Mapped to internal camelCase)
                    'date': 'date', 'fecha': 'date',
                    'vendor': 'vendor', 'proveedor': 'vendor',
                    'purchase order': 'purchaseOrder', 'po': 'purchaseOrder', 'orden de compra': 'purchaseOrder',
                    'sfdc_case': 'sfdcCase', 'sfdc case': 'sfdcCase', 'caso sfdc': 'sfdcCase', 'sfdc': 'sfdcCase',
                    'oem': 'oem', 'marca': 'oem',
                    'model': 'modelNumber', 'modelo': 'modelNumber',
                    'hardware spec': 'hardwareSpec', 'spec': 'hardwareSpec', 'especificaciones': 'hardwareSpec', 'hardwarespec': 'hardwareSpec',
                    'partnumber': 'partNumber', 'part number': 'partNumber', 'pn': 'partNumber', 'numero de parte': 'partNumber',
                    'imei': 'imei', 'imei 2': 'imei2', 'imei2': 'imei2',
                    'eol': 'eolDate', 'eol date': 'eolDate', 'fin de vida': 'eolDate',
                    'notes': 'notes', 'notas': 'notes', 'comentarios': 'notes', 'comments': 'notes',
                    'country': 'country', 'pais': 'country'
                };

                const mappedHeaders = rawHeaders.map(h => headerMap[h] || h); // Use map or keep original if no match

                // Validate critical headers
                if (!mappedHeaders.includes('serial')) {
                    alert('Error: No se encontró la columna "Serial" o "Numero de Serie" en el CSV. Es obligatoria.');
                    return;
                }

                const newAssets = rows.slice(1).map(row => {
                    // Robust CSV Parser: Handles commas in quotes AND empty fields correctly
                    const values = [];
                    let currentVal = '';
                    let inQuotes = false;
                    for (let i = 0; i < row.length; i++) {
                        const char = row[i];
                        if (char === '"') {
                            inQuotes = !inQuotes;
                        } else if (char === ',' && !inQuotes) {
                            values.push(currentVal.trim().replace(/^"|"$/g, ''));
                            currentVal = '';
                        } else {
                            currentVal += char;
                        }
                    }
                    // Push the last value
                    values.push(currentVal.trim().replace(/^"|"$/g, ''));

                    const asset = {};
                    mappedHeaders.forEach((header, index) => {
                        if (values[index] !== undefined && values[index] !== '') {
                            asset[header] = values[index];
                        }
                    });

                    // Defaults/Cleanups
                    if (!asset.type) asset.type = 'Laptop';
                    if (!asset.status) asset.status = 'Disponible';
                    if (!asset.assignee) asset.assignee = 'Almacén'; // Default to Warehouse if empty

                    // --- NORMALIZATION START ---
                    // Normalize Status to match App Enums (Nuevo, Asignado, Recuperado, etc.)
                    const statusMap = {
                        'new': 'Nuevo', 'nuevo': 'Nuevo',
                        'available': 'Disponible', 'disponible': 'Disponible', 'stock': 'Disponible',
                        'assigned': 'Asignado', 'asignado': 'Asignado', 'in use': 'Asignado', 'en uso': 'Asignado',
                        'recovered': 'Recuperado', 'recuperado': 'Recuperado',
                        'repair': 'En Reparación', 'en reparación': 'En Reparación', 'broken': 'Dañado', 'dañado': 'Dañado',
                        'eol': 'EOL', 'end of life': 'EOL', 'baja': 'EOL'
                    };
                    const lowerStatus = (asset.status || '').toLowerCase().trim();
                    if (statusMap[lowerStatus]) {
                        asset.status = statusMap[lowerStatus];
                    } else {
                        // Capitalize first letter as fallback if not in map
                        asset.status = asset.status.charAt(0).toUpperCase() + asset.status.slice(1).toLowerCase();
                    }

                    // Normalize Type
                    const typeMap = {
                        'notebook': 'Laptop', 'laptop': 'Laptop', 'portatil': 'Laptop', 'latop': 'Laptop',
                        'smartphone': 'Smartphone', 'phone': 'Smartphone', 'celular': 'Smartphone', 'movil': 'Smartphone',
                        'tablet': 'Tablet', 'ipad': 'Tablet',
                        'monitor': 'Monitor', 'display': 'Monitor',
                        'key': 'Security keys', 'security key': 'Security keys', 'yubikey': 'Security keys'
                    };
                    const lowerType = (asset.type || '').toLowerCase().trim();
                    if (typeMap[lowerType]) {
                        asset.type = typeMap[lowerType];
                    }

                    // Normalize Assignee (Warehouse normalization)
                    const assigneeMap = {
                        'whse': 'Almacén', 'warehouse': 'Almacén', 'almacen': 'Almacén',
                        'stock': 'Almacén', 'office': 'Almacén', 'deposito': 'Almacén'
                    };
                    const lowerAssignee = (asset.assignee || '').toLowerCase().trim();
                    if (assigneeMap[lowerAssignee]) {
                        asset.assignee = assigneeMap[lowerAssignee];
                    }
                    // --- NORMALIZATION END ---

                    return asset;
                }).filter(a => a.serial && a.serial.length > 2); // Filter empty rows

                if (newAssets.length > 0) {
                    const existingSerials = new Set(assets.map(a => (a.serial || '').toString().toLowerCase().trim()));
                    const seenInCsv = new Set();
                    const toAdd = [];
                    let skippedCount = 0;

                    newAssets.forEach(asset => {
                        const normalizedSerial = (asset.serial || '').toString().toLowerCase().trim();

                        // Check against DB assets AND duplicates within the file itself
                        if (existingSerials.has(normalizedSerial) || seenInCsv.has(normalizedSerial)) {
                            skippedCount++;
                        } else {
                            seenInCsv.add(normalizedSerial);
                            // Ensure strict string format for Serial to match consistency
                            asset.serial = (asset.serial || '').toString().trim();
                            toAdd.push(asset);
                        }
                    });

                    if (toAdd.length > 0) {
                        try {
                            // Intento 1: Guardar con TODOS los campos mapeados
                            await addAssets(toAdd);
                            alert(`✅ Éxito: ${toAdd.length} activos cargados correctamente.\n(Se omitieron ${skippedCount} duplicados).`);
                        } catch (err) {
                            console.warn("Intento de carga completa falló, probando importación segura...", err);

                            // Intento 2: Importación Segura (Fallback)
                            // Si falla por columnas faltantes, movemos los datos extra a 'notes'
                            if (err.message && (err.message.includes('Could not find') || err.message.includes('column'))) {
                                const confirmation = window.confirm(
                                    `⚠️ Tu base de datos no tiene algunas columnas nuevas (como IMEI, Country, etc.)\n\n` +
                                    `¿Quieres que guarde estos datos dentro del campo "Notas" para no perderlos y completar la importación?`
                                );

                                if (confirmation) {
                                    const safeAssets = toAdd.map(asset => {
                                        const safe = {
                                            name: asset.name,
                                            type: asset.type,
                                            serial: asset.serial,
                                            status: asset.status,
                                            assignee: asset.assignee,
                                            date: asset.date,
                                            hardwareSpec: asset.hardwareSpec,
                                            notes: asset.notes || ''
                                        };

                                        // Campos potencialmente "nuevos" o conflictivos
                                        const riskyFields = [
                                            'imei', 'imei2', 'country', 'purchaseOrder', 'sfdcCase',
                                            'oem', 'modelNumber', 'partNumber', 'eolDate', 'vendor'
                                        ];

                                        let extraInfo = [];
                                        riskyFields.forEach(field => {
                                            if (asset[field]) {
                                                extraInfo.push(`${field.toUpperCase()}: ${asset[field]}`);
                                            }
                                        });

                                        if (extraInfo.length > 0) {
                                            safe.notes = (safe.notes ? safe.notes + '\n\n' : '') +
                                                '--- DATOS IMPORTADOS ---\n' +
                                                extraInfo.join('\n');
                                        }

                                        return safe;
                                    });

                                    try {
                                        await addAssets(safeAssets);
                                        alert(`✅ Importación Segura completada: ${safeAssets.length} activos guardados.\n(Los datos de IMEI, Pais, etc. se guardaron en "Notas").`);
                                    } catch (retryErr) {
                                        console.error("Fallo final importación segura:", retryErr);
                                        alert(`❌ Error Crítico: No se pudo importar ni siquiera en modo seguro.\n${retryErr.message}`);
                                    }
                                }
                            } else {
                                alert(`❌ Error DB: ${err.message}\nCódigo: ${err.code || 'N/A'}\nHint: ${err.hint || 'Posible Bloqueo por Permisos o Datos Inválidos'}`);
                            }
                        }
                    } else {
                        alert(`ℹ️ No hay activos nuevos. Todos los ${skippedCount} registros del CSV ya existen.`);
                    }
                } else {
                    alert('⚠️ No se encontraron filas válidas en el CSV.');
                }
            } catch (error) {
                console.error("CSV Parse Error:", error);
                alert('❌ Error procesando el archivo CSV. Revisa el formato.');
            }
            e.target.value = null; // Reset input
        };
        reader.readAsText(file);
    };

    const handleExportWarehouseCsv = () => {
        const warehouseAssets = assets.filter(a => a.assignee === 'Almacén');
        const warehouseConsumables = consumables.filter(c => c.stock > 0);

        const headers = ['Categoria', 'Articulo', 'Serial', 'Cantidad', 'Estado', 'Proveedor', 'OEM', 'PO', 'SFDC Case', 'Hardware Spec', 'Actualizado Por', 'Fecha Ultimo Cambio'];
        const csvRows = [headers.join(',')];

        // Add Hardware
        warehouseAssets.forEach(a => {
            const row = [
                'Hardware',
                `"${a.name}"`,
                `"${a.serial}"`,
                '1',
                `"${a.status}"`,
                `"${a.vendor || '-'}"`,
                `"${a.oem || '-'}"`,
                `"${a.purchaseOrder || '-'}"`,
                `"${a.sfd_case || '-'}"`,
                `"${a.hardwareSpec || '-'}"`,
                `"${a.updatedBy || 'Sistema'}"`,
                `"${a.dateLastUpdate ? new Date(a.dateLastUpdate).toLocaleString() : '-'}"`
            ];
            csvRows.push(row.join(','));
        });

        // Add Accessories
        warehouseConsumables.forEach(c => {
            const row = [
                'Accesorio',
                `"${c.name}"`,
                '-',
                c.stock,
                'Disponible',
                '-',
                '-',
                '-',
                '-',
                '-'
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Reporte_Almacen_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getStatusVariant = (status) => {
        switch (status) {
            case 'Nuevo': return 'success';
            case 'Asignado': return 'info';
            case 'Recuperado': return 'info';
            case 'En Reparación': return 'warning';
            case 'Dañado':
            case 'EOL': return 'danger';
            default: return 'default';
        }
    };

    // KPI Calculations - FILTERED BY WAREHOUSE ONLY
    const warehouseAssets = assets.filter(a => a.assignee === 'Almacén' && a.status !== 'Asignado');

    const totalAssets = warehouseAssets.length;
    const novos = warehouseAssets.filter(a => a.status === 'Nuevo' || a.status === 'Disponible').length;
    const recuperados = warehouseAssets.filter(a => a.status === 'Recuperado').length;
    const enReparacion = warehouseAssets.filter(a => a.status === 'En Reparación').length;
    const dañados = warehouseAssets.filter(a => ['Dañado', 'EOL', 'Rota', 'De Baja'].includes(a.status)).length;
    const categoriesCount = new Set(warehouseAssets.map(a => a.type)).size || (isHardwareTab ? 4 : 0);

    const deviceTypes = ['Laptop', 'Smartphone', 'Security keys', 'Tablet'];
    const statuses = ['Nuevo', 'Asignado', 'Recuperado', 'En Reparación', 'Dañado', 'EOL'];

    return (
        <div style={{ paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Gestión de Inventario</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Control de activos de hardware y stock de consumibles.</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', background: 'var(--background)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <button
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'calc(var(--radius-md) - 2px)',
                                border: 'none',
                                background: isHardwareTab ? 'var(--primary-color)' : 'transparent',
                                color: isHardwareTab ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease'
                            }}
                            onClick={() => setIsHardwareTab(true)}
                        >
                            <Laptop size={18} /> Equipos
                        </button>
                        <button
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'calc(var(--radius-md) - 2px)',
                                border: 'none',
                                background: !isHardwareTab ? 'var(--primary-color)' : 'transparent',
                                color: !isHardwareTab ? 'white' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                fontWeight: 600,
                                transition: 'all 0.2s ease'
                            }}
                            onClick={() => setIsHardwareTab(false)}
                        >
                            <Package size={18} /> Accesorios
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                        {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    type="file"
                                    id="csv-upload-top"
                                    accept=".csv"
                                    style={{ display: 'none' }}
                                    onChange={handleCsvUpload}
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    icon={Upload}
                                    onClick={() => document.getElementById('csv-upload-top').click()}
                                >
                                    Cargar CSV
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    icon={Download}
                                    onClick={handleExportWarehouseCsv}
                                >
                                    Exportar Reporte
                                </Button>
                            </div>
                        )}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                            <Button
                                variant="outline"
                                size="sm"
                                icon={Trash2}
                                onClick={() => {
                                    if (window.confirm('⚠️ ADVERTENCIA: Esta acción BORRARÁ TODO el inventario (Equipos y Accesorios). ¿Estás absolutamente seguro?')) {
                                        if (window.confirm('¿Confirmación final? Esta acción es irreversible.')) {
                                            clearInventory();
                                            alert('Inventario vaciado con éxito.');
                                        }
                                    }
                                }}
                                style={{ color: '#ef4444', borderColor: '#ef4444', fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                            >
                                Vaciar Inventario
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Global Inventory KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>Activos en Almacén</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{totalAssets}</h3>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a', borderRadius: '12px' }}>
                            <CheckCircle size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>Nuevos</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#16a34a' }}>{novos}</h3>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', borderRadius: '12px' }}>
                            <History size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>Recuperados</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#2563eb' }}>{recuperados}</h3>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderRadius: '12px' }}>
                            <TrendingUp size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>En Reparación</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#f59e0b' }}>{enReparacion}</h3>
                        </div>
                    </div>
                </Card>
                <Card style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px' }}>
                            <AlertTriangle size={24} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, fontWeight: 600 }}>Dañados</p>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#ef4444' }}>{dañados}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Resumen Ejecutivo de Inventario */}
            {isHardwareTab && (
                <Card style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1.5fr', gap: '2rem', alignItems: 'start' }}>
                        {/* Columna Izquierda: Totales por Tipo */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                <div style={{ width: '3px', height: '16px', background: 'var(--primary-color)', borderRadius: '2px' }}></div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Inventario por Tipo</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {deviceTypes.map(type => {
                                    const count = assets.filter(a => a.type === type).length;
                                    const Icon = getTypeIcon(type);
                                    return (
                                        <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.8rem', background: 'var(--background)', borderRadius: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ color: 'var(--primary-color)' }}><Icon size={16} /></div>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{type}s</span>
                                            </div>
                                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{count}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Divisor Visual */}
                        <div style={{ width: '1px', height: '100%', background: 'var(--border)' }}></div>

                        {/* Columna Derecha: Totales por Estado (Columnado) */}
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                <div style={{ width: '3px', height: '16px', background: 'var(--primary-color)', borderRadius: '2px' }}></div>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>Equipos por Estado</h4>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                                {statuses.map(status => {
                                    const count = assets.filter(a => a.status === status || (status === 'Nuevo' && a.status === 'Disponible')).length;
                                    const color = getStatusVariant(status) === 'success' ? '#16a34a' : getStatusVariant(status) === 'info' ? '#2563eb' : getStatusVariant(status) === 'warning' ? '#f59e0b' : getStatusVariant(status) === 'danger' ? '#ef4444' : 'var(--text-secondary)';
                                    return (
                                        <div key={status} style={{
                                            padding: '1rem 0.5rem',
                                            background: 'var(--background)',
                                            borderRadius: '12px',
                                            textAlign: 'center',
                                            border: `1px solid ${color}20`
                                        }}>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: color, marginBottom: '0.2rem' }}>
                                                {count}
                                            </div>
                                            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{status}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Stock por Modelo - Desplegable */}
            {isHardwareTab && (novos > 0 || recuperados > 0) && (
                <div style={{ marginBottom: '2rem' }}>
                    <div
                        onClick={() => setIsStockExpanded(!isStockExpanded)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '1rem',
                            cursor: 'pointer',
                            padding: '0.5rem 1rem',
                            background: 'var(--surface)',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '4px', height: '24px', background: 'var(--primary-color)', borderRadius: '4px' }}></div>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Stock Disponible por Modelo</h2>
                            <Badge variant="success" style={{ marginLeft: '0.5rem' }}>{novos + recuperados} u.</Badge>
                        </div>
                        {isStockExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>

                    {isStockExpanded && (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ background: 'var(--background)', borderBottom: '1px solid var(--border)' }}>
                                            <th style={{ padding: '1rem', fontWeight: 700 }}>MODELO</th>
                                            {statuses.map(s => (
                                                <th key={s} style={{ padding: '0.75rem 0.5rem', fontWeight: 700, textAlign: 'center', fontSize: '0.7rem' }}>{s.toUpperCase()}</th>
                                            ))}
                                            <th style={{ padding: '1rem', fontWeight: 700, textAlign: 'center' }}>TOTAL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(
                                            assets.reduce((acc, a) => {
                                                if (!acc[a.name]) {
                                                    acc[a.name] = { total: 0, type: a.type };
                                                    statuses.forEach(s => acc[a.name][s] = 0);
                                                }
                                                acc[a.name].total++;
                                                const s = a.status === 'Disponible' ? 'Nuevo' :
                                                    (['Rota', 'De Baja'].includes(a.status) ? 'Dañado' : a.status);
                                                if (acc[a.name][s] !== undefined) acc[a.name][s]++;
                                                return acc;
                                            }, {})
                                        )
                                            .sort((a, b) => {
                                                const typeOrder = { 'Laptop': 1, 'Smartphone': 2, 'Security keys': 3, 'Tablet': 4 };
                                                const typeCompare = (typeOrder[a[1].type] || 99) - (typeOrder[b[1].type] || 99);
                                                if (typeCompare !== 0) return typeCompare;
                                                return a[0].localeCompare(b[0]);
                                            })
                                            .map(([model, data]) => {
                                                const Icon = getTypeIcon(data.type);
                                                return (
                                                    <tr key={model} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ padding: '0.4rem', background: 'var(--background)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
                                                                    <Icon size={14} />
                                                                </div>
                                                                <span style={{ fontWeight: 600 }}>{model}</span>
                                                            </div>
                                                        </td>
                                                        {statuses.map(s => (
                                                            <td key={s} style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                                <span
                                                                    onClick={() => data[s] > 0 && handleStockClick(model, s)}
                                                                    style={{
                                                                        padding: '0.2rem 0.5rem',
                                                                        borderRadius: '4px',
                                                                        background: data[s] > 0 ? `${getStatusVariant(s) === 'success' ? 'rgba(22, 163, 74, 0.1)' : getStatusVariant(s) === 'info' ? 'rgba(37, 99, 235, 0.1)' : getStatusVariant(s) === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)'}` : 'transparent',
                                                                        color: data[s] > 0 ? (getStatusVariant(s) === 'success' ? '#16a34a' : getStatusVariant(s) === 'info' ? '#2563eb' : getStatusVariant(s) === 'warning' ? '#f59e0b' : '#ef4444') : 'var(--text-secondary)',
                                                                        fontWeight: data[s] > 0 ? 700 : 400,
                                                                        opacity: data[s] > 0 ? 1 : 0.2,
                                                                        fontSize: '0.8rem',
                                                                        cursor: data[s] > 0 ? 'pointer' : 'default',
                                                                        textDecoration: data[s] > 0 ? 'underline' : 'none'
                                                                    }}>
                                                                    {data[s]}
                                                                </span>
                                                            </td>
                                                        ))}
                                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--primary-color)' }}>{data.total}</td>
                                                    </tr>
                                                );
                                            })}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            )}
            {isHardwareTab ? (
                <Card id="inventory-list">
                    <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Buscar por serie, modelo o usuario..."
                                className="form-input"
                                style={{ paddingLeft: '2.5rem' }}
                                value={searchFilter}
                                onChange={(e) => setSearchFilter(e.target.value)}
                            />
                        </div>

                        {(columnFilters.status !== 'All' || columnFilters.type !== 'All' || columnFilters.assignee !== '') && (
                            <Button variant="ghost" size="sm" onClick={() => setColumnFilters({ status: 'All', type: 'All', assignee: '' })}>Limpiar Filtros</Button>
                        )}

                        {(currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                            <Button
                                icon={Plus}
                                onClick={() => {
                                    setEditingAsset(null);
                                    setNewAsset({
                                        name: '', type: 'Laptop', serial: '', assignee: 'Almacén', status: 'Nuevo',
                                        date: new Date().toISOString().split('T')[0], vendor: 'Other', purchaseOrder: '',
                                        modelNumber: '', partNumber: '', hardwareSpec: '', imei: '-',
                                        eolDate: '', notes: '', sfd_case: '', oem: ''
                                    });
                                    setIsModalOpen(true);
                                }}
                            >
                                Añadir Activo
                            </Button>
                        )}

                        <Button
                            variant={isSmartSearchOpen ? "primary" : "outline"}
                            icon={TrendingUp}
                            onClick={() => setIsSmartSearchOpen(!isSmartSearchOpen)}
                        >
                            {isSmartSearchOpen ? "Cerrar Recomendador" : "Buscador de Reemplazos"}
                        </Button>
                    </div>

                    {/* Recomendador Inteligente */}
                    {isSmartSearchOpen && (
                        <div style={{
                            marginBottom: '2rem',
                            padding: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(37, 99, 235, 0.02) 100%)',
                            borderRadius: '16px',
                            border: '1px solid rgba(37, 99, 235, 0.1)',
                            animation: 'slideDown 0.3s ease-out'
                        }}>
                            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        Serial del Equipo a Reemplazar
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary-color)' }} />
                                        <input
                                            type="text"
                                            placeholder="Ej: C70CYYYKXC"
                                            className="form-input"
                                            style={{ paddingLeft: '2.5rem', borderColor: 'var(--primary-color)' }}
                                            value={replacementSerial}
                                            onChange={(e) => handleReplacementSearch(e.target.value)}
                                        />
                                    </div>

                                    {assetToReplace && (
                                        <div style={{ marginTop: '1rem', padding: '1rem', background: 'white', borderRadius: '12px', border: '1px solid var(--border)' }}>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Equipo Encontrado</div>
                                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                <div style={{ padding: '0.5rem', background: 'var(--background)', borderRadius: '8px' }}>
                                                    {React.createElement(getTypeIcon(assetToReplace.type), { size: 20, color: 'var(--primary-color)' })}
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{assetToReplace.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                        {assetToReplace.oem} • {assetToReplace.hardwareSpec}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ flex: 2 }}>
                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                        Recomendaciones del Stock ({smartRecommendations.length})
                                    </label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                        {smartRecommendations.length > 0 ? smartRecommendations.map(rec => (
                                            <div key={rec.id} style={{
                                                padding: '0.75rem',
                                                background: 'white',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'all 0.2s',
                                                cursor: 'pointer'
                                            }}
                                                className="hover-card"
                                                onClick={() => handleAssignClick(rec)}
                                            >
                                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                    <div style={{ padding: '0.4rem', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', borderRadius: '8px' }}>
                                                        <CheckCircle size={16} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{rec.name}</div>
                                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{rec.serial}</div>
                                                    </div>
                                                </div>
                                                <Button variant="ghost" size="sm" icon={ArrowRight} />
                                            </div>
                                        )) : (
                                            <div style={{
                                                gridColumn: 'span 2',
                                                padding: '2rem',
                                                textAlign: 'center',
                                                background: 'rgba(255,255,255,0.5)',
                                                borderRadius: '12px',
                                                border: '1px dashed var(--border)',
                                                color: 'var(--text-secondary)',
                                                fontSize: '0.85rem'
                                            }}>
                                                {replacementSerial.length < 3 ? "Ingresa un serial para ver recomendaciones" : "No se encontraron equipos similares disponibles"}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Resultados de Búsqueda Directos */}
                    {searchFilter !== '' && (
                        <div style={{ marginBottom: '2rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <div style={{ width: '4px', height: '20px', background: 'var(--primary-color)', borderRadius: '2px' }}></div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Resultados de Búsqueda</h3>
                                <Badge variant="info">{filteredAssets.length}</Badge>
                            </div>
                            <div style={{ overflowX: 'auto', background: 'rgba(37, 99, 235, 0.02)', borderRadius: '12px', padding: '0.5rem', border: '1px dashed rgba(37, 99, 235, 0.2)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                            <th onClick={() => handleSort('name')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>ACTIVO <SortIcon column="name" /></th>
                                            <th onClick={() => handleSort('serial')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>SERIAL <SortIcon column="serial" /></th>
                                            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>USUARIO</th>
                                            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ESTADO</th>
                                            <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAssets.length > 0 ? filteredAssets.map((asset) => (
                                            <tr key={asset.id} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ padding: '0.5rem', backgroundColor: 'var(--surface)', borderRadius: '8px', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                                            {React.createElement(getTypeIcon(asset.type), { size: 16 })}
                                                        </div>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{asset.name}</div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>{asset.serial}</td>
                                                <td style={{ padding: '1rem' }}>{asset.assignee}</td>
                                                <td style={{ padding: '1rem' }}><Badge variant={getStatusVariant(asset.status)}>{asset.status}</Badge></td>
                                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'flex-end' }}>
                                                        <Button variant="ghost" size="sm" icon={Eye} onClick={() => router.push(`/dashboard/inventory/${asset.id}`)} />
                                                        <Button variant="ghost" size="sm" icon={Edit3} onClick={() => handleEdit(asset)} />
                                                    </div>
                                                </td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                    No se encontraron coincidencias para "{searchFilter}"
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Desplegable de Inventario Completo */}
                    {searchFilter === '' && (
                        <div style={{ marginTop: '1rem' }}>
                            <div
                                onClick={() => setIsInventoryExpanded(!isInventoryExpanded)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '1rem 1.5rem',
                                    background: 'var(--background)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ width: '4px', height: '24px', background: 'var(--text-secondary)', borderRadius: '4px', opacity: 0.5 }}></div>
                                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Ver Inventario Completo</h2>
                                    <Badge style={{ background: 'var(--border)', color: 'var(--text-main)' }}>{assets.length} activos</Badge>
                                </div>
                                {isInventoryExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                            </div>

                            {isInventoryExpanded && (
                                <div style={{ marginTop: '1.5rem', overflowX: 'auto', animation: 'fadeIn 0.3s ease-out' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                                <th onClick={() => handleSort('name')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>ACTIVO <SortIcon column="name" /></th>
                                                <th onClick={() => handleSort('serial')} style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', cursor: 'pointer' }}>SERIAL <SortIcon column="serial" /></th>
                                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>USUARIO</th>
                                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ESTADO</th>
                                                <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredAssets.map((asset) => (
                                                <tr key={asset.id} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '1rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ padding: '0.6rem', backgroundColor: 'var(--background)', borderRadius: '10px', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                                                {React.createElement(getTypeIcon(asset.type), { size: 18 })}
                                                            </div>
                                                            <div>
                                                                <Link href={`/dashboard/inventory/${asset.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                                    <div style={{ fontWeight: 600, fontSize: '0.95rem' }} className="hover-link">{asset.name}</div>
                                                                </Link>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{asset.type}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '0.9rem' }}>{asset.serial}</td>
                                                    <td style={{ padding: '1rem' }}>
                                                        {asset.assignee === 'Almacén' ? (
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: 'var(--background)', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>En Almacén</span>
                                                        ) : (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                                                    {asset.assignee.charAt(0)}
                                                                </div>
                                                                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{asset.assignee}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '1rem' }}>
                                                        <Badge variant={getStatusVariant(asset.status)}>{asset.status}</Badge>
                                                    </td>
                                                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                            {(asset.status === 'Nuevo' || asset.status === 'Disponible' || asset.status === 'Recuperado') && (
                                                                <Button variant="ghost" size="sm" icon={UserPlus} onClick={() => handleAssignClick(asset)} title="Asignar" />
                                                            )}
                                                            <Button variant="ghost" size="sm" icon={Eye} onClick={() => router.push(`/dashboard/inventory/${asset.id}`)} />
                                                            <Button variant="ghost" size="sm" icon={Edit3} onClick={() => handleEdit(asset)} />
                                                            {currentUser?.role === 'admin' && (
                                                                <Button variant="ghost" size="sm" icon={Trash2} onClick={() => handleDelete(asset.id)} style={{ color: '#ef4444' }} />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            ) : (
                /* ACCESORIOS TAB */
                <Card
                    title="Inventario de Consumibles"
                    action={
                        (currentUser?.role === 'admin' || currentUser?.role === 'Gerencial') && (
                            <Button size="sm" icon={Plus} onClick={() => setIsAddAccessoryModalOpen(true)}>
                                Añadir Artículo
                            </Button>
                        )
                    }
                >
                    const [isStockExpanded, setIsStockExpanded] = useState(false);
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Accesorios genéricos controlados por cantidad unitaria.
                    </p>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ARTÍCULO</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>CATEGORÍA</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>STOCK</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>ESTADO</th>
                                    <th style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'right' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consumables.map((item) => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ padding: '0.5rem', backgroundColor: 'var(--background)', borderRadius: '10px', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                                    <Package size={18} />
                                                </div>
                                                <span style={{ fontWeight: 600 }}>{item.name}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.category}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{
                                                    fontSize: '1.2rem',
                                                    fontWeight: 800,
                                                    color: item.stock < 5 ? '#ef4444' : 'inherit'
                                                }}>
                                                    {item.stock}
                                                </span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Unidades</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <Badge variant={item.stock > 10 ? 'success' : item.stock > 0 ? 'warning' : 'danger'}>
                                                {item.stock > 10 ? 'Suficiente' : item.stock > 0 ? 'Stock Bajo' : 'Agotado'}
                                            </Badge>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    icon={TrendingUp}
                                                    onClick={() => {
                                                        setSelectedConsumable(item);
                                                        setIsConsumableModalOpen(true);
                                                    }}
                                                >
                                                    Ajustar Stock
                                                </Button>
                                                {currentUser?.role === 'admin' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Trash2}
                                                        onClick={() => handleDeleteConsumable(item.id)}
                                                        style={{ color: '#ef4444' }}
                                                        title="Eliminar de la lista"
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* Modal para Activos de Hardware */}
            <Modal isOpen={isModalOpen} onClose={closeModal} title={editingAsset ? "Editar Activo" : "Registrar Nuevo Activo"}>
                <form onSubmit={handleCreateOrUpdate}>
                    <div className="form-group">
                        <label className="form-label">Nombre del Modelo / Descripción</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: MacBook Pro 16 M3"
                            value={newAsset.name}
                            onChange={e => setNewAsset({ ...newAsset, name: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Tipo de Activo</label>
                            <select
                                className="form-select"
                                value={newAsset.type}
                                onChange={e => setNewAsset({ ...newAsset, type: e.target.value })}
                            >
                                <option value="Laptop">Laptop</option>
                                <option value="Smartphone">Smartphone</option>
                                <option value="Tablet">Tablet</option>
                                <option value="Security keys">Security keys</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Número de Serie (S/N)</label>
                            <input
                                required
                                className="form-input"
                                placeholder="SN-123456"
                                value={newAsset.serial}
                                onChange={e => setNewAsset({ ...newAsset, serial: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Estado</label>
                            <select
                                className="form-select"
                                value={newAsset.status}
                                onChange={e => setNewAsset({ ...newAsset, status: e.target.value })}
                            >
                                <option value="Nuevo">Nuevo</option>
                                <option value="Asignado">Asignado</option>
                                <option value="Recuperado">Recuperado</option>
                                <option value="En Reparación">En Reparación</option>
                                <option value="Dañado">Dañado</option>
                                <option value="EOL">EOL</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Asignado a</label>
                            <input
                                className="form-input"
                                placeholder="Nombre o Almacén"
                                value={newAsset.assignee}
                                onChange={e => setNewAsset({ ...newAsset, assignee: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Fecha de Ingreso</label>
                            <input
                                type="date"
                                className="form-input"
                                value={newAsset.date}
                                onChange={e => setNewAsset({ ...newAsset, date: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Proveedor</label>
                            <select
                                className="form-select"
                                value={newAsset.vendor}
                                onChange={e => setNewAsset({ ...newAsset, vendor: e.target.value })}
                            >
                                <option value="MacStation">MacStation</option>
                                <option value="Tacco">Tacco</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Orden de Compra (PO)</label>
                            <input
                                className="form-input"
                                placeholder="PO-XXXX"
                                value={newAsset.purchaseOrder}
                                onChange={e => setNewAsset({ ...newAsset, purchaseOrder: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">OEM</label>
                            <input
                                className="form-input"
                                placeholder="Fabricante..."
                                value={newAsset.oem || ''}
                                onChange={e => setNewAsset({ ...newAsset, oem: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">SFDC Case</label>
                            <input
                                className="form-input"
                                placeholder="Case #..."
                                value={newAsset.sfd_case || ''}
                                onChange={e => setNewAsset({ ...newAsset, sfd_case: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">IMEI (Solo Smartphones)</label>
                            <input
                                className="form-input"
                                placeholder="358900..."
                                value={newAsset.imei || ''}
                                onChange={e => setNewAsset({ ...newAsset, imei: e.target.value })}
                            />
                        </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label className="form-label">Modelo Técnico</label>
                            <input
                                className="form-input"
                                placeholder="Ej: A2485"
                                value={newAsset.modelNumber}
                                onChange={e => setNewAsset({ ...newAsset, modelNumber: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Part Number</label>
                            <input
                                className="form-input"
                                placeholder="Ej: Z15S005DW"
                                value={newAsset.partNumber}
                                onChange={e => setNewAsset({ ...newAsset, partNumber: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Hardware Spec</label>
                        <input
                            className="form-input"
                            placeholder="M2 / 8CPU / 8GPU / 24GB / 512GB"
                            value={newAsset.hardwareSpec}
                            onChange={e => setNewAsset({ ...newAsset, hardwareSpec: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Fecha EOL (Fin de Vida Útil)</label>
                        <input
                            type="date"
                            className="form-input"
                            value={newAsset.eolDate}
                            onChange={e => setNewAsset({ ...newAsset, eolDate: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Notas Adicionales</label>
                        <textarea
                            className="form-textarea"
                            rows="3"
                            placeholder="Información extra sobre el activo..."
                            value={newAsset.notes}
                            onChange={e => setNewAsset({ ...newAsset, notes: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                        <Button type="button" variant="ghost" onClick={closeModal}>Cancelar</Button>
                        <Button type="submit">{editingAsset ? "Guardar Cambios" : "Registrar Activo"}</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal para Ajuste de Stock */}
            <Modal isOpen={isConsumableModalOpen} onClose={() => setIsConsumableModalOpen(false)} title="Ajustar Stock de Consumible">
                <form onSubmit={handleAdjustStock}>
                    <p style={{ marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Ajustando stock para: <strong>{selectedConsumable?.name}</strong>
                        <br />
                        <span style={{ color: 'var(--text-secondary)' }}>Stock Actual: {selectedConsumable?.stock} unidades</span>
                    </p>

                    <div className="form-group">
                        <label className="form-label">Cantidad a añadir (positivo) o quitar (negativo)</label>
                        <input
                            type="number"
                            required
                            className="form-input"
                            value={stockChange}
                            onChange={e => setStockChange(parseInt(e.target.value))}
                            placeholder="Ej: 10 o -5"
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsConsumableModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" variant="primary">Aplicar Ajuste</Button>
                    </div>
                </form>
            </Modal>

            {/* Modal para Crear Nuevo Accesorio */}
            <Modal isOpen={isAddAccessoryModalOpen} onClose={() => setIsAddAccessoryModalOpen(false)} title="Añadir Nuevo Artículo a Accesorios">
                <form onSubmit={handleAddAccessory}>
                    <div className="form-group">
                        <label className="form-label">Nombre del Artículo</label>
                        <input
                            required
                            className="form-input"
                            placeholder="Ej: Teclado Logitech K120"
                            value={newAccessory.name}
                            onChange={e => setNewAccessory({ ...newAccessory, name: e.target.value })}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Categoría</label>
                        <select
                            className="form-select"
                            value={newAccessory.category}
                            onChange={e => setNewAccessory({ ...newAccessory, category: e.target.value })}
                        >
                            <option value="Accesorio">Accesorio</option>
                            <option value="Periférico">Periférico</option>
                            <option value="Herramienta">Herramienta</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Stock Inicial</label>
                        <input
                            type="number"
                            required
                            min="0"
                            className="form-input"
                            value={newAccessory.stock}
                            onChange={e => setNewAccessory({ ...newAccessory, stock: e.target.value })}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsAddAccessoryModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Crear Artículo</Button>
                    </div>
                </form>
            </Modal>
            {/* Modal para Asignación Directa */}
            <Modal isOpen={isAssignModalOpen} onClose={() => setIsAssignModalOpen(false)} title="Asignar Activo a Usuario">
                <form onSubmit={handleAssignSubmit}>
                    <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--background)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ padding: '0.75rem', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary-color)', borderRadius: '10px' }}>
                            {assigningAsset && React.createElement(getTypeIcon(assigningAsset.type), { size: 24 })}
                        </div>
                        <div>
                            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Asignando:</p>
                            <p style={{ margin: 0, fontWeight: 700 }}>{assigningAsset?.name}</p>
                            <p style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>S/N: {assigningAsset?.serial}</p>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Seleccionar Usuario</label>
                        <select
                            required
                            className="form-select"
                            value={assignmentData.userName}
                            onChange={e => setAssignmentData({ ...assignmentData, userName: e.target.value })}
                        >
                            <option value="">Seleccione un usuario...</option>
                            {users.map(u => (
                                <option key={u.id} value={u.name}>{u.name} ({u.role})</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Dirección de Entrega</label>
                        <div style={{ position: 'relative' }}>
                            <MapPin size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-secondary)' }} />
                            <input
                                className="form-input"
                                placeholder="Ej: Calle Principal 123..."
                                style={{ paddingLeft: '2.5rem' }}
                                value={assignmentData.address}
                                onChange={e => setAssignmentData({ ...assignmentData, address: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Método de Envío</label>
                        <select
                            className="form-select"
                            value={assignmentData.deliveryMethod}
                            onChange={e => setAssignmentData({ ...assignmentData, deliveryMethod: e.target.value })}
                        >
                            <option value="Andreani">Andreani</option>
                            <option value="Correo Argentino">Correo Argentino</option>
                            <option value="Repartidor Propio">Repartidor Propio</option>
                            <option value="Retiro en Oficina">Retiro en Oficina</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2.5rem' }}>
                        <Button type="button" variant="ghost" onClick={() => setIsAssignModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" icon={Truck}>Confirmar y Crear Ticket</Button>
                    </div>
                </form>
            </Modal>
            {/* Quick Detail Modal for Stock Numbers */}
            <Modal
                isOpen={stockDetailModal.isOpen}
                onClose={() => setStockDetailModal({ ...stockDetailModal, isOpen: false })}
                title={`${stockDetailModal.model} - ${stockDetailModal.status}`}
            >
                <div>
                    <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                        Se encontraron <strong>{stockDetailModal.items.length}</strong> equipos en este estado.
                    </p>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead style={{ position: 'sticky', top: 0, background: 'var(--surface)' }}>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Serial</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Estado Real</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Ubicación/Usuario</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stockDetailModal.items.map(item => (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.serial}</td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>{item.assignee}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setEditingAsset(item);
                                                    setNewAsset({ ...item, date: item.date || new Date().toISOString().split('T')[0] });
                                                    setIsModalOpen(true);
                                                    setStockDetailModal({ ...stockDetailModal, isOpen: false });
                                                }}
                                            >
                                                Editar
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
