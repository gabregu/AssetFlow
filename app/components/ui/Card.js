import React from 'react';

export function Card({ children, className = '', title, action, style = {} }) {
    return (
        <div className={`card ${className}`} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', ...style }}>
            {(title || action) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    {title && <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>{title}</h3>}
                    {action && <div>{action}</div>}
                </div>
            )}
            <div style={{ flex: 1 }}>
                {children}
            </div>
        </div>
    );
}
