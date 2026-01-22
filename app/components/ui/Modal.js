"use client";
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, children }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !mounted) return null;

    // Usamos Portal para inyectar el modal directamente en el body y evitar conflictos de transform/z-index
    return createPortal(
        <div className="modal-overlay" onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <div className="modal-content" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                    backgroundColor: 'var(--surface)',
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
                }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>{title}</h3>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(0,0,0,0.05)',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            padding: '0.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '50%',
                            transition: 'all 0.2s'
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: '1.5rem', flex: 1 }}>
                    {children}
                </div>
            </div>
        </div>,
        document.body
    );
}
