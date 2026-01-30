"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './components/ui/Modal';
import { initialUsers } from '../lib/data';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { useStore } from '../lib/store';
import { Logo } from './components/ui/Logo';
import { Loader2 } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const { login, users, currentUser, loading } = useStore();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && currentUser) {
            router.push('/dashboard');
        }
    }, [currentUser, loading, router]);

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: 'var(--primary-color)' }} />
            </div>
        );
    }

    const handleLogin = async (e) => {
        e.preventDefault();
        const { error, user } = await login(formData.email, formData.password);

        if (error) {
            // console.error('Login error:', error); // Optional: keep for internal logging
            setError(error.message || JSON.stringify(error));
        } else if (user) {
            // Check role redirect
            if (user.role === 'Conductor') {
                router.push('/dashboard/my-deliveries');
            } else {
                router.push('/dashboard');
            }
        }
    };

    return (
        <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(to bottom right, var(--background), var(--surface))', position: 'relative' }}>

            <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
                <ThemeToggle />
            </div>

            <div style={{ textAlign: 'center', maxWidth: '600px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ transform: 'scale(1.5)', marginBottom: '2rem' }}>
                    <Logo />
                </div>
                <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Plataforma integral de gestión de activos y casos de TI.
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        onClick={() => setIsLoginOpen(true)}
                        className="btn btn-primary"
                        style={{ padding: '0.75rem 1.5rem', fontSize: '1rem' }}
                    >
                        Iniciar Sesión
                    </button>
                </div>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Acceso restringido a personal autorizado.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', width: '100%', maxWidth: '1000px' }}>
                <div className="card">
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📋 Gestión de Servicios
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Administra tickets, incidencias y solicitudes de soporte de manera eficiente.
                    </p>
                </div>
                <div className="card">
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        💻 Inventario
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Control total sobre hardware y software. Ciclo de vida completo de activos.
                    </p>
                </div>
                <div className="card">
                    <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        🚚 Envíos
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Seguimiento de entregas y logística de equipamiento a empleados.
                    </p>
                </div>
            </div>

            {/* LOGIN MODAL */}
            <Modal
                isOpen={isLoginOpen}
                onClose={() => { setIsLoginOpen(false); setError(''); setFormData({ email: '', password: '' }); }}
                title="Iniciar Sesión"
            >
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {error && (
                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fee2e2', color: '#991b1b', fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}

                    {/* DEBUG: Temporary Diagnostic Info */}

                    <div>
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="Ingrese su email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            required
                        />
                    </div>
                    <div>
                        <label className="form-label" htmlFor="password">Contraseña</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="Ingrese su contraseña"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            required
                        />
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                        <button
                            type="button"
                            onClick={() => setIsLoginOpen(false)}
                            className="btn"
                            style={{ background: 'transparent', border: '1px solid var(--border)' }}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Ingresar
                        </button>
                    </div>
                </form>
            </Modal>



        </main >
    );
}
