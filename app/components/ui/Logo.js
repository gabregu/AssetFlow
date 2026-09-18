import React from 'react';

export function Logo({ size = 'large', collapsed = false }) {
    if (collapsed) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '3px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid rgba(226, 232, 240, 0.8)'
                }}>
                    <img 
                        src="/favicon.png" 
                        alt="AssetFlow" 
                        style={{ width: '24px', height: '24px', objectFit: 'contain' }} 
                    />
                </div>
            </div>
        );
    }

    const isSmall = size === 'small';

    return (
        <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            padding: isSmall ? '0.35rem 0.65rem' : '0.55rem 1rem',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
            border: '1px solid #e2e8f0',
            maxWidth: '100%'
        }}>
            <img 
                src="/assetflow-yaw-logo.png" 
                alt="AssetFlow by YAW Informatica" 
                style={{ 
                    height: isSmall ? '34px' : '48px', 
                    width: 'auto',
                    maxWidth: isSmall ? '160px' : '220px',
                    objectFit: 'contain',
                    display: 'block'
                }} 
            />
        </div>
    );
}
