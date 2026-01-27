"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useStore } from '../../../lib/store';
import { UserPlus, Trash2, Shield, Moon, Sun, Pencil, Lock, Eye, EyeOff, Key } from 'lucide-react';
import { useTheme } from '../../components/theme-provider';

export default function SettingsPage() {
    const { users, currentUser, addUser, deleteUser, updateUser, sendPasswordReset, updatePassword } = useStore();
    const { theme } = useTheme();
    // ...
    const [newPassword, setNewPassword] = useState('');

    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (newPassword.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');

        try {
            const { error } = await updatePassword(newPassword);
            if (error) throw error;
            alert('Contraseña actualizada correctamente');
            setNewPassword('');
        } catch (error) {
            alert('Error al actualizar contraseña: ' + error.message);
        }
    };

    // ... (rest of logic)

    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'var(--background)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
        <div>
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Modo de Interfaz</span>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Actual: {theme === 'dark' ? 'Noche' : 'Día'}</p>
        </div>
        <ThemeToggle />
    </div>
                </Card >

        {/* My Account (Visible to everyone) */ }
        < Card title = "Mi Cuenta" action = {< Lock size = { 20} />}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Gestiona tu seguridad y datos personales.
                    </p>
                    <form onSubmit={handleChangePassword}>
                        <div className="form-group">
                            <label className="form-label">Cambiar Contraseña</label>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input 
                                    type="password" 
                                    className="form-input" 
                                    placeholder="Nueva contraseña"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    minLength={6}
                                />
                                <Button type="submit" size="sm">Actualizar</Button>
                            </div>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                                Ingresa tu nueva contraseña para cambiarla inmediatamente.
                            </p>
                        </div>
                    </form>
                </Card >

    {/* User Management (Admin Only) */ }
    < Card
title = "Gestión de Usuarios"
action = {< Shield size = { 20} style = {{ color: isAdmin ? 'var(--primary-color)' : 'var(--text-secondary)' }} />}
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
                <Button size="sm" icon={UserPlus} onClick={() => setIsModalOpen(true)}>Nuevo Usuario</Button>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
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
                </Card >
            </div >

    {/* Modal para Nuevo Usuario */ }
{
    isModalOpen && (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)'
        }}>
            <Card title="Agregar Nuevo Usuario" style={{ width: '400px', margin: '2rem' }}>
                <form onSubmit={handleAddUser}>
                    <div className="form-group">
                        <label className="form-label">Nombre Completo</label>
                        <input className="form-input" required value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Usuario</label>
                        <input className="form-input" required value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Información</label>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                            Este formulario crea un perfil. Para login real, el usuario debe registrarse con su email o ser invitado desde el panel de Supabase.
                        </p>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Rol del Usuario</label>
                        <select className="form-select" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            {roles.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                        <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit">Crear Usuario</Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}

{/* Modal para Editar Usuario */ }
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
        </div >
    );
}
