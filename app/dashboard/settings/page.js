"use client";
import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import { useStore } from '../../../lib/store';
import { UserPlus, Trash2, Shield, Moon, Sun, Pencil, Lock, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../../components/theme-provider';

export default function SettingsPage() {
    const { users, currentUser, addUser, deleteUser, updateUser, updatePassword } = useStore();
    const { theme } = useTheme();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [pwdData, setPwdData] = useState({ new: '', confirm: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', role: 'Conductor', name: '' });
    const [userToEdit, setUserToEdit] = useState(null);

    const isAdmin = currentUser?.role === 'admin';

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        console.log('Intentando actualizar contraseña...');

        if (pwdData.new.length < 6) {
            alert('La contraseña debe tener al menos 6 caracteres.');
            return;
        }
        if (pwdData.new !== pwdData.confirm) {
            alert('Las contraseñas no coinciden.');
            return;
        }

        console.log('Llamando a updatePassword store fn');
        try {
            const { error } = await updatePassword(pwdData.new);
            if (error) {
                console.error('Error cambio clave:', error);
                alert('Error al actualizar: ' + error.message);
            } else {
                console.log('Cambio clave exitoso');
                alert('Contraseña actualizada correctamente.');
                setPwdData({ new: '', confirm: '' });
            }
        } catch (err) {
            console.error('Excepcion en handleSubmit:', err);
            alert('Error inesperado: ' + err.message);
        }
    };

    const handleAddUser = (e) => {
        e.preventDefault();
        addUser(newUser);
        setNewUser({ username: '', role: 'Conductor', name: '' });
        setIsModalOpen(false);
    };

    const handleEditClick = (user) => {
        setUserToEdit({ ...user, password: '' }); // Clear password for security/don't show old one
        setIsEditModalOpen(true);
    };

    const handleUpdateUser = (e) => {
        e.preventDefault();
        if (!userToEdit) return;

        const updates = {
            name: userToEdit.name,
            username: userToEdit.username
        };
        if (userToEdit.password) {
            updates.password = userToEdit.password;
        }

        updateUser(userToEdit.id, updates);
        setIsEditModalOpen(false);
        setUserToEdit(null);
    };

    const roles = ['Gerencial', 'Administrativo', 'Conductor', 'user', 'admin'];

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-main)' }}>Configuración</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Personaliza tu experiencia y gestiona el acceso al sistema.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
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

                {/* Security Settings (Change Password) */}
                <Card title="Seguridad" action={<Lock size={20} />}>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Actualiza tu contraseña de acceso.
                    </p>
                    <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Nueva Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={pwdData.new}
                                    onChange={e => setPwdData({ ...pwdData, new: e.target.value })}
                                    required
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="form-label" style={{ fontSize: '0.8rem' }}>Confirmar Contraseña</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="form-input"
                                    placeholder="Repite la contraseña"
                                    value={pwdData.confirm}
                                    onChange={e => setPwdData({ ...pwdData, confirm: e.target.value })}
                                    required
                                    style={{ paddingRight: '2.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div style={{ alignSelf: 'flex-end' }}>
                            <Button type="submit" size="sm">Actualizar</Button>
                        </div>
                    </form>
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
                                    {users.length} usuarios totales
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

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {users.map(u => (
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
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
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
            </div>

            {/* Modal para Nuevo Usuario */}
            {isModalOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <Card title="Agregar Nuevo Usuario" style={{ width: '400px', margin: '2rem' }}>
                        <form onSubmit={handleAddUser}>
                            <div className="form-group">
                                <label className="form-label">Nombre Completo</label>
                                <input
                                    className="form-input"
                                    required
                                    value={newUser.name}
                                    onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Usuario</label>
                                <input
                                    className="form-input"
                                    required
                                    value={newUser.username}
                                    onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contraseña</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                                    Este formulario crea un <strong>Perfil de Usuario</strong>. Para dar acceso de login, debe invitar al usuario desde el Panel de Supabase o pedirle que se registre con este mismo email.
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Rol del Usuario</label>
                                <select
                                    className="form-select"
                                    value={newUser.role}
                                    onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    {roles.map(r => (
                                        <option key={r} value={r}>{r === 'admin' ? 'Administrador (Full)' : r.charAt(0).toUpperCase() + r.slice(1)}</option>
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
            )}

            {/* Modal para Editar Usuario */}
            {isEditModalOpen && userToEdit && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <Card title="Editar Usuario" style={{ width: '400px', margin: '2rem' }}>
                        <form onSubmit={handleUpdateUser}>
                            <div className="form-group">
                                <label className="form-label">Nombre Completo</label>
                                <input
                                    className="form-input"
                                    required
                                    value={userToEdit.name}
                                    onChange={e => setUserToEdit({ ...userToEdit, name: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Usuario</label>
                                <input
                                    className="form-input"
                                    required
                                    value={userToEdit.username}
                                    onChange={e => setUserToEdit({ ...userToEdit, username: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Contraseña</label>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.5rem', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                                    La gestión de contraseñas se realiza a través del sistema de autenticación seguro. No se puede cambiar desde aquí.
                                </p>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '2rem' }}>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={async () => {
                                        if (confirm(`¿Estás seguro de que deseas eliminar permanentemente a ${userToEdit.name}?`)) {
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
            )}
        </div>
    );
}
