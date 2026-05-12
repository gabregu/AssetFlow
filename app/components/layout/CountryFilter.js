import React from 'react';
import { useStore } from '../../../lib/store';
import { Globe, ChevronDown, Building2 } from 'lucide-react';

export const CountryFilter = () => {
    const { countryFilter, setCountryFilter, entities = [] } = useStore();
    const countries = entities.map(e => e.name);

    return (
        <div style={{ padding: '0 0.5rem', marginBottom: '1.5rem' }}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                marginBottom: '0.6rem',
                color: 'var(--text-secondary)',
                padding: '0 0.5rem'
            }}>
                <Building2 size={14} />
                <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente / Entorno</span>
            </div>
            
            <div style={{ position: 'relative' }}>
                <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '0.75rem 2.5rem 0.75rem 1rem',
                        borderRadius: '12px',
                        border: '1px solid var(--border)',
                        background: 'var(--background)',
                        color: 'var(--text-main)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                        outline: 'none'
                    }}
                    className="hover-card"
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary-color)'}
                    onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                >
                    {countries.map(country => (
                        <option key={country} value={country}>
                            {country}
                        </option>
                    ))}
                </select>
                <div style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                    color: 'var(--text-secondary)'
                }}>
                    <ChevronDown size={16} />
                </div>
            </div>
        </div>
    );
};
