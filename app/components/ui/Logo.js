import React from 'react';

export function Logo({ size = 'large', collapsed = false }) {
    if (collapsed) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ display: 'flex', gap: '1px' }}>
                    {[1, 0.7, 0.4].map((op, i) => (
                        <div key={i} style={{
                            width: '4px',
                            height: '12px',
                            backgroundColor: '#0ea5e9',
                            clipPath: 'polygon(0% 0%, 70% 0%, 100% 50%, 70% 100%, 0% 100%, 30% 50%)',
                            opacity: op
                        }} />
                    ))}
                </div>
            </div>
        );
    }

    const isSmall = size === 'small';

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 0.9 }}>
                <span style={{
                    fontSize: isSmall ? '1.5rem' : '2.2rem',
                    fontWeight: 900,
                    color: '#0f172a',
                    letterSpacing: '-0.03em'
                }}>
                    AssetFlow
                </span>
                <span style={{
                    fontSize: isSmall ? '0.75rem' : '1rem',
                    fontWeight: 800,
                    color: '#334155',
                    marginTop: isSmall ? '2px' : '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    by <span style={{ color: '#0ea5e9' }}>YAWI</span>
                </span>
            </div>

            {/* Stylized Arrow Icon matching the image */}
            <div style={{
                display: 'flex',
                gap: '3px',
                alignItems: 'center',
                marginLeft: '8px'
            }}>
                {[1, 2, 3].map((i) => (
                    <div key={i} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '3px'
                    }}>
                        {[1, 2, 3].map((j) => (
                            <div key={j} style={{
                                width: isSmall ? '5px' : '6px',
                                height: isSmall ? '5px' : '6px',
                                backgroundColor: i === 3 && j === 2 ? '#0ea5e9' : '#94a3b8',
                                opacity: i === 3 ? 1 : 0.3 + (i * 0.2),
                                borderRadius: '1.5px',
                                transform: `translateX(${i * 2}px)`
                            }} />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}
