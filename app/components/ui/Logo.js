import React from 'react';

export function Logo({ size = 'large', collapsed = false, style = {}, className = '' }) {
    if (collapsed) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    border: '1px solid rgba(226, 232, 240, 0.8)'
                }}>
                    <img 
                        src="/favicon.png" 
                        alt="AssetFlow" 
                        style={{ width: '26px', height: '26px', objectFit: 'contain' }} 
                    />
                </div>
            </div>
        );
    }

    const isSmall = size === 'small';

    return (
        <div 
            className={className}
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#ffffff',
                borderRadius: '10px',
                padding: isSmall ? '0.45rem 0.85rem' : '0.65rem 1.25rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                border: '1px solid #e2e8f0',
                width: isSmall ? '100%' : 'auto',
                maxWidth: isSmall ? '225px' : '280px',
                boxSizing: 'border-box',
                ...style
            }}
        >
            <img 
                src="/assetflow-yaw-logo.png" 
                alt="AssetFlow by YAW Informatica" 
                style={{ 
                    height: isSmall ? '50px' : '62px', 
                    width: 'auto',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block'
                }} 
            />
        </div>
    );
}
