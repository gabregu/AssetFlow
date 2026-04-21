"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useStore } from '../../../lib/store';
import { Trash2, Shield, Moon, Sun, Pencil, Lock, Eye, EyeOff, Key, MapPin, MapPinOff, Globe } from 'lucide-react';
import { useTheme } from '../../components/theme-provider';

export default function SettingsPage() {
    const { users, currentUser, deleteUser, updateUser, sendPasswordReset, updatePassword, entities = [], addEntity, deleteEntity } = useStore();
    const { theme } = useTheme();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState(null);
    const [newEntityName, setNewEntityName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const isAdmin = currentUser?.role === 'admin';



    const handleEditClick = (user) => {
        setUserToEdit({ ...user, password: '' });
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = (e) => {
        e.preventDefault();
        if (!userToEdit) return;

        const updates = {
            name: userToEdit.name,
            username: userToEdit.username
        };
        updateUser(userToEdit.id, updates);
        setIsEditModalOpen(false);
        setUserToEdit(null);
    };

    const handleSendReset = async (email) => {
        if (!email) return alert('El usuario no tiene email asociado.');
        if (confirm(`¿Enviar correo de restablecimiento de contraseña a ${email}?`)) {
            const { error } = await sendPasswordReset(email);
            if (error) alert('Error al enviar correo: ' + error.message);
            else alert('Correo enviado correctamente. El usuario recibirá un enlace para crear una nueva clave.');
        }
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        console.log("handleChangePassword triggered"); // Debug
        setMessage({ type: '', text: '' });

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' });
            return;
        }

        try {
            console.log("Calling updatePassword..."); // Debug
            const { error } = await updatePassword(newPassword);
            console.log("updatePassword result:", { error }); // Debug

            if (error) throw error;

            setMessage({ type: 'success', text: '¡Contraseña actualizada correctamente!' });
            alert('¡Contraseña actualizada correctamente!'); // Force feedback for now
            setNewPassword('');
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
        } catch (error) {
            console.error("Change Password Error:", error); // Debug
            setMessage({ type: 'error', text: 'Error: ' + error.message });
            alert('Error: ' + error.message);
        }
    };

    const roles = ['Gerencial', 'Administrativo', 'Conductor', 'user', 'admin'];

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="flex-mobile-column" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Configuración</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Gestiona las preferencias del sistema y usuarios.</p>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', color: '#3b82f6' }}>
                    <Shield size={24} />
                </div>
            </div>

            <div className="grid-responsive-dashboard" style={{ marginBottom: '2.5rem' }}>
                {/* Visual Settings */}
                <Card title="Apariencia" action={theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Cambia entre el modo día y noche para mayor comodidad visual.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                        <div>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Modo de Interfaz</span>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Actual: {theme === 'dark' ? 'Noche' : 'Día'}</p>
                        </div>
                        <ThemeToggle />
                    </div>
                </Card>

                {/* My Account (Visible to everyone) */}
                <Card title="Mi Cuenta" action={<Lock size={20} />}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Gestiona tu seguridad y datos personales.
                    </p>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label className="form-label">Cambiar Contraseña</label>
                            <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                                <div style={{ position: 'relative', flex: 1 }}>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="form-input"
                                        placeholder="Nueva contraseña"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={6}
                                        style={{ paddingRight: '2.5rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '0.5rem',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <Button type="submit" size="sm">Actualizar</Button>
                            </div>
                            {message.text && (
                                <p style={{
                                    fontSize: '0.8rem',
                                    marginTop: '0.5rem',
                                    fontWeight: 500,
                                    color: message.type === 'error' ? '#ef4444' : '#10b981'
                                }}>
                                    {message.text}
                                </p>
                            )}
                            {!message.text && (
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                    Ingresa tu nueva contraseña para cambiarla inmediatamente.
                                </p>
                            )}
                        </div>
                    </form>
                    
                    <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                        <Button 
                            variant="danger-soft" 
                            style={{ width: '100%', gap: '0.5rem' }}
                            onClick={async () => {
                                if (confirm('¿Cerrar sesión de AssetFlow?')) {
                                    const { logout } = useStore.getState();
                                    await logout();
                                    window.location.href = '/';
                                }
                            }}
                        >
                            <Trash2 size={16} /> Cerrar Sesión
                        </Button>
                    </div>
                </Card>

                {/* User Management (Admin Only) */}
                <Card
                    title="Gestión de Usuarios"
                    action={<Shield size={20} style={{ color: isAdmin ? 'var(--primary-color)' : 'var(--text-secondary)' }} />}
                >
                    {!isAdmin ? (
                        <div style={{ textAlign: 'center', padding: '2rem' }}>
                            <Shield size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                Solo los Administradores pueden gestionar usuarios y permisos.
                            </p>
                        </div>
                    ) : (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                                    {users.filter(u => u.email).length} usuarios activos
                                </p>
                            </div>

                            {/* Pending Users Section */}
                            {users.some(u => u.role === 'pending') && (
                                <div style={{ marginBottom: '2rem', border: '1px solid #f59e0b', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)' }}>
                                    <h3 style={{ color: '#d97706', fontSize: '1rem', marginTop: 0, marginBottom: '1rem', fontWeight: 700 }}>Solicitudes Pendientes</h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {users.filter(u => u.role === 'pending').map(u => (
                                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
                                                <div>
                                                    <p style={{ fontWeight: 600, margin: 0 }}>{u.name}</p>
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{u.email} (@{u.username})</p>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <select
                                                        onChange={(e) => {
                                                            if (e.target.value !== 'pending') {
                                                                if (confirm(`¿Aprobar acceso para ${u.name} como ${e.target.value}?`)) {
                                                                    updateUser(u.id, { role: e.target.value });
                                                                }
                                                            }
                                                        }}
                                                        style={{ padding: '0.3rem', borderRadius: '4px', border: '1px solid var(--border)' }}
                                                        defaultValue="pending"
                                                    >
                                                        <option value="pending" disabled>Aprobar como...</option>
                                                        {roles.filter(r => r !== 'pending').map(r => (
                                                            <option key={r} value={r}>{r}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="table-responsive" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
                                {users.filter(u => u.role !== 'pending' && u.email).map(u => (
                                    <div key={u.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '0.75rem',
                                        background: 'var(--background)',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)'
                                    }}>
                                        <div>
                                            <p style={{ fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>{u.name}</p>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '4px' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>@{u.username}</span>
                                                {u.username === 'admin' ? (
                                                    <span style={{
                                                        fontSize: '0.7rem',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        backgroundColor: 'var(--primary-color)',
                                                        color: 'white',
                                                        textTransform: 'uppercase',
                                                        fontWeight: 700
                                                    }}>{u.role}</span>
                                                ) : (
                                                    <select
                                                        value={u.role}
                                                        onChange={(e) => updateUser(u.id, { role: e.target.value })}
                                                        style={{
                                                            fontSize: '0.7rem',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: 'var(--primary-hover)',
                                                            color: 'white',
                                                            textTransform: 'uppercase',
                                                            fontWeight: 700,
                                                            border: 'none',
                                                            outline: 'none',
                                                            cursor: 'pointer',
                                                            appearance: 'none',
                                                            textAlign: 'center'
                                                        }}
                                                    >
                                                        {roles.map(r => (
                                                            <option key={r} value={r} style={{ color: 'black' }}>{r.toUpperCase()}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </div>
                                        </div>
                                        {u.username !== 'admin' && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                {/* Botón de Tracking GPS */}
                                                <button
                                                    onClick={async () => {
                                                        const newValue = !u.tracking_enabled;
                                                        console.log(`Toggling GPS for ${u.name} (${u.id}) to ${newValue}`);
                                                        const { error } = await updateUser(u.id, { tracking_enabled: newValue });
                                                        if (error) {
                                                            console.error("Failed to toggle GPS:", error);
                                                            // Alert handled in store.js, but we could add toast here if needed
                                                        } else {
                                                            console.log("GPS toggled successfully");
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: u.tracking_enabled ? '#10b981' : 'var(--text-secondary)',
                                                        cursor: 'pointer',
                                                        padding: '0.5rem',
                                                        opacity: u.tracking_enabled ? 1 : 0.5
                                                    }}
                                                    title={u.tracking_enabled ? "Desactivar rastreo GPS" : "Activar rastreo GPS"}
                                                >
                                                    {u.tracking_enabled ? <MapPin size={16} /> : <MapPinOff size={16} />}
                                                </button>

                                                <button
                                                    onClick={() => handleSendReset(u.email)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}
                                                    title="Enviar correo de cambio de contraseña"
                                                >
                                                    <Key size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditClick(u)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.5rem' }}
                                                    title="Editar usuario"
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </Card>

                {/* Entity Management (Admin Only) */}
                {isAdmin && (
                    <Card
                        title="Gestión de Sedes y Clientes"
                        action={<Globe size={20} style={{ color: 'var(--primary-color)' }} />}
                    >
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                            Agrega nuevos países o clientes para separar sus inventarios de forma independiente.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <input 
                                className="form-input" 
                                placeholder="Nombre de la sede o cliente (ej: Nuevo Cliente ABC)" 
                                value={newEntityName}
                                onChange={e => setNewEntityName(e.target.value)}
                                style={{ flex: 1 }}
                            />
                            <Button 
                                onClick={async () => {
                                    if (!newEntityName.trim()) return;
                                    await addEntity({ name: newEntityName.trim() });
                                    setNewEntityName('');
                                }}
                                disabled={!newEntityName.trim()}
                            >
                                Agregar Sede
                            </Button>
                        </div>

                        <div className="table-responsive" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '300px', overflowY: 'auto' }}>
                            {entities.map(entity => (
                                <div key={entity.id} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '0.75rem',
                                    background: 'var(--background)',
                                    borderRadius: 'var(--radius-md)',
                                    border: '1px solid var(--border)'
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.9rem' }}>{entity.name}</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (confirm(`¿Estás seguro de eliminar la sede "${entity.name}"? Los equipos no se borrarán pero dejarán de verse agrupados bajo este nombre.`)) {
                                                await deleteEntity(entity.id);
                                            }
                                        }}
                                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}
                                        title="Eliminar Sede"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {entities.length === 0 && (
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No hay sedes configuradas.</p>
                            )}
                        </div>
                    </Card>
                )}
            </div>


            {/* Modal para Editar Usuario */}
            {
                isEditModalOpen && userToEdit && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        zIndex: 1000, backdropFilter: 'blur(4px)'
                    }}>
                        <Card title="Editar Usuario" style={{ width: '400px', margin: '2rem' }}>
                            <form onSubmit={handleUpdateUser}>
                                <div className="form-group">
                                    <label className="form-label">Nombre Completo</label>
                                    <input className="form-input" required value={userToEdit.name} onChange={e => setUserToEdit({ ...userToEdit, name: e.target.value })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Usuario</label>
                                    <input className="form-input" required value={userToEdit.username} onChange={e => setUserToEdit({ ...userToEdit, username: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
                                    <Button
                                        type="button" variant="ghost"
                                        onClick={async () => {
                                            if (confirm(`¿Estás seguro de que deseas eliminar a ${userToEdit.name}?`)) {
                                                await deleteUser(userToEdit.id);
                                                setIsEditModalOpen(false);
                                                setUserToEdit(null);
                                            }
                                        }}
                                        style={{ color: '#ef4444' }}
                                    >
                                        Eliminar Usuario
                                    </Button>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                                        <Button type="submit">Guardar Cambios</Button>
                                    </div>
                                </div>
                            </form>
                        </Card>
                    </div>
                )
            }
        </div>
    );
}
