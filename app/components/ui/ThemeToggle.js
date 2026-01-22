"use client";
import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme-provider';

export function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className="btn"
            style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                padding: '0.5rem',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-main)',
                boxShadow: 'var(--shadow-sm)',
                width: '40px',
                height: '40px',
                transition: 'all 0.2s ease'
            }}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
            {theme === 'dark' ? (
                <Sun size={20} className="text-yellow-400" style={{ color: '#fbbf24' }} />
            ) : (
                <Moon size={20} className="text-slate-700" style={{ color: '#334155' }} />
            )}
        </button>
    );
}
