"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Modal } from './components/ui/Modal';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { useStore } from '../lib/store';
import { Logo } from './components/ui/Logo';
import { Loader2, Globe, Layers, Box, Truck } from 'lucide-react';

export default function Home() {
    const router = useRouter();
    const { login, users, currentUser, setCurrentUser, loading } = useStore();
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [formData, setFormData] = useState({ email: '', password: '' });
    const [error, setError] = useState('');

    useEffect(() => {
        if (!loading && currentUser) {
            if (currentUser.role === 'Conductor') {
                router.push('/dashboard/my-tickets');
            } else {
                router.push('/dashboard');
            }
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
            setError(error.message || JSON.stringify(error));
        } else if (user) {
            if (user.role === 'Conductor') {
                router.push('/dashboard/my-tickets');
            } else {
                router.push('/dashboard');
            }
        }
    };

    return (
        <main style={{ 
            minHeight: '100vh', 
            background: 'radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.05), transparent 50%), var(--background)', 
            color: 'var(--text-main)', 
            display: 'flex', 
            flexDirection: 'column', 
            position: 'relative',
            overflowX: 'hidden'
        }}>
            {/* HEADER */}
            <header style={{ 
                width: '100%', 
                maxWidth: '1200px', 
                margin: '0 auto', 
                padding: '1.5rem 2rem', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
            }}>
                <div style={{ transform: 'scale(0.95)', transformOrigin: 'left center' }}>
                    <Logo size="small" />
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {/* Language Selector Pill */}
                    <button style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '20px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-secondary)',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <Globe size={14} />
                        <span>ES</span>
                    </button>

                    <div style={{ 
                        background: 'var(--surface)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '50%', 
                        width: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        boxShadow: 'var(--shadow-sm)'
                    }}>
                        <ThemeToggle />
                    </div>
                </div>
            </header>

            {/* HERO SECTION */}
            <section style={{ 
                textAlign: 'center', 
                maxWidth: '800px', 
                margin: '3.5rem auto 1.5rem auto', 
                padding: '0 2rem', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center' 
            }}>
                <h1 style={{ 
                    fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', 
                    fontWeight: '800', 
                    color: 'var(--text-main)', 
                    lineHeight: '1.15', 
                    letterSpacing: '-0.03em', 
                    marginBottom: '0.2rem' 
                }}>
                    Gestioná tu operación IT
                </h1>
                <h2 style={{ 
                    fontSize: 'clamp(2.2rem, 5vw, 3.5rem)', 
                    fontWeight: '800', 
                    background: 'linear-gradient(135deg, #2563eb 20%, #3b82f6 50%, #60a5fa 80%)', 
                    WebkitBackgroundClip: 'text', 
                    WebkitTextFillColor: 'transparent', 
                    lineHeight: '1.2', 
                    letterSpacing: '-0.03em',
                    marginBottom: '1.5rem' 
                }}>
                    de forma inteligente
                </h2>
                
                <p style={{ 
                    fontSize: 'clamp(1rem, 2vw, 1.15rem)', 
                    color: 'var(--text-secondary)', 
                    marginBottom: '2.5rem', 
                    fontWeight: '400',
                    maxWidth: '540px' 
                }}>
                    Tickets, activos y logística en una sola plataforma.
                </p>

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                    <button
                        onClick={() => setIsLoginOpen(true)}
                        className="btn btn-primary"
                        style={{ 
                            padding: '0.8rem 2.2rem', 
                            fontSize: '0.95rem', 
                            fontWeight: '600', 
                            borderRadius: '50px',
                            background: '#2563eb',
                            boxShadow: '0 4px 14px rgba(37, 99, 235, 0.3)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        Iniciar Sesión
                    </button>
                </div>
            </section>

            {/* THREE FEATURE CARDS */}
            <section style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1.5rem', 
                width: '100%', 
                maxWidth: '1100px', 
                margin: '2rem auto 3rem auto', 
                padding: '0 2rem' 
            }}>
                {/* Card 1 */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div style={{ 
                        background: 'rgba(37, 99, 235, 0.08)', 
                        color: '#2563eb', 
                        padding: '0.6rem', 
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Layers size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        Gestión de Servicios
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                        Administra tickets, incidencias y solicitudes de soporte de manera eficiente.
                    </p>
                </div>

                {/* Card 2 */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div style={{ 
                        background: 'rgba(139, 92, 246, 0.08)', 
                        color: '#8b5cf6', 
                        padding: '0.6rem', 
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Box size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        Inventario
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                        Control total sobre hardware y software. Ciclo de vida completo de activos.
                    </p>
                </div>

                {/* Card 3 */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '1.75rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '1rem'
                }}>
                    <div style={{ 
                        background: 'rgba(16, 185, 129, 0.08)', 
                        color: '#10b981', 
                        padding: '0.6rem', 
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Truck size={20} />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)' }}>
                        Logística
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: '1.5' }}>
                        Seguimiento de entregas y logística de equipamiento a empleados.
                    </p>
                </div>
            </section>

            {/* THREE MOCKUP PANELS */}
            <section style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
                gap: '2rem', 
                width: '100%', 
                maxWidth: '1100px', 
                margin: '0 auto 4rem auto', 
                padding: '0 2rem' 
            }}>
                {/* Mockup 1: Asset list */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ 
                        height: '40px', 
                        background: 'var(--background)', 
                        borderBottom: '1px solid var(--border)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0 1rem', 
                        gap: '6px' 
                    }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                    </div>
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Row 1 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Laptop Dell</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: '600' }}>
                                Asignado
                            </span>
                        </div>
                        {/* Row 2 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>iPhone 13</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', fontWeight: '600' }}>
                                Stock
                            </span>
                        </div>
                        {/* Row 3 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Monitor LG</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: '600' }}>
                                Asignado
                            </span>
                        </div>
                        {/* Row 4 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Samsung Galaxy S22</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: '600' }}>
                                Sin Stock
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mockup 2: Metrics and Bar chart */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ 
                        height: '40px', 
                        background: 'var(--background)', 
                        borderBottom: '1px solid var(--border)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0 1rem', 
                        gap: '6px' 
                    }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                    </div>
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* 2x2 Grid of Metrics */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Abiertos</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>12</div>
                            </div>
                            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>En Progreso</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>8</div>
                            </div>
                            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resueltos</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>24</div>
                            </div>
                            <div style={{ background: 'var(--background)', border: '1px solid var(--border)', padding: '0.6rem', borderRadius: '8px', textAlign: 'center' }}>
                                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Activos</div>
                                <div style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)' }}>15</div>
                            </div>
                        </div>

                        {/* Bar Chart Simulation */}
                        <div style={{ 
                            height: '55px', 
                            display: 'flex', 
                            alignItems: 'flex-end', 
                            justifyContent: 'space-around', 
                            padding: '0 0.5rem 0.2rem 0.5rem',
                            borderBottom: '1px solid var(--border)',
                            gap: '8px'
                        }}>
                            <div style={{ width: '100%', height: '35%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                            <div style={{ width: '100%', height: '70%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                            <div style={{ width: '100%', height: '50%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                            <div style={{ width: '100%', height: '90%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                            <div style={{ width: '100%', height: '60%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                            <div style={{ width: '100%', height: '80%', borderRadius: '4px 4px 0 0', background: 'linear-gradient(to top, #3b82f6, #60a5fa)' }} />
                        </div>

                        {/* Text lines simulation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                            <div style={{ width: '80%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                            <div style={{ width: '60%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                        </div>
                    </div>
                </div>

                {/* Mockup 3: SVG Activity Line chart */}
                <div style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    boxShadow: 'var(--shadow-md)',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    <div style={{ 
                        height: '40px', 
                        background: 'var(--background)', 
                        borderBottom: '1px solid var(--border)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        padding: '0 1rem', 
                        gap: '6px' 
                    }}>
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ff5f56' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
                        <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#27c93f' }} />
                    </div>
                    <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Custom SVG Curved Line Graph */}
                        <div style={{ 
                            height: '128px', 
                            position: 'relative', 
                            border: '1px solid var(--border)', 
                            borderRadius: '8px', 
                            overflow: 'hidden',
                            background: 'var(--background)'
                        }}>
                            <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100%', display: 'block' }}>
                                <defs>
                                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.00" />
                                    </linearGradient>
                                </defs>
                                
                                {/* Grid lines */}
                                <line x1="0" y1="30" x2="300" y2="30" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                                <line x1="0" y1="60" x2="300" y2="60" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                                <line x1="0" y1="90" x2="300" y2="90" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                                
                                {/* Chart Area Fill */}
                                <path 
                                    d="M 0,120 L 0,110 C 30,105 50,85 80,80 C 110,75 130,100 160,95 C 190,90 210,65 240,60 C 270,55 285,45 300,35 L 300,120 Z" 
                                    fill="url(#chartGrad)" 
                                />

                                {/* Chart Line */}
                                <path 
                                    d="M 0,110 C 30,105 50,85 80,80 C 110,75 130,100 160,95 C 190,90 210,65 240,60 C 270,55 285,45 300,35" 
                                    fill="none" 
                                    stroke="#22c55e" 
                                    strokeWidth="2.5" 
                                    strokeDasharray="4,4" 
                                />

                                {/* Dot markers */}
                                <circle cx="80" cy="80" r="4.5" fill="#22c55e" stroke="var(--surface)" strokeWidth="1.5" />
                                <circle cx="160" cy="95" r="4.5" fill="#22c55e" stroke="var(--surface)" strokeWidth="1.5" />
                                <circle cx="240" cy="60" r="4.5" fill="#22c55e" stroke="var(--surface)" strokeWidth="1.5" />
                                
                                {/* Highlighting red dot at the peak */}
                                <circle cx="295" cy="38" r="5" fill="#ef4444" stroke="var(--surface)" strokeWidth="2" />
                            </svg>
                        </div>

                        {/* Text lines simulation */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <div style={{ width: '100%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                            <div style={{ width: '90%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                            <div style={{ width: '70%', height: '6px', borderRadius: '3px', backgroundColor: 'var(--border)' }} />
                        </div>
                    </div>
                </div>
            </section>

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
                            style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                        >
                            Cancelar
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ background: '#2563eb' }}>
                            Ingresar
                        </button>
                    </div>
                </form>
            </Modal>
        </main >
    );
}

