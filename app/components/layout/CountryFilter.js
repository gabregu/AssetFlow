import React from 'react';
import { useStore } from '../../../lib/store';
import { Globe, ChevronDown } from 'lucide-react';

export const CountryFilter = () => {
    const { countryFilter, setCountryFilter } = useStore();
    const countries = ['Todos', 'Argentina', 'Chile', 'Colombia', 'Costa Rica', 'Uruguay'];

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                background: 'var(--surface)', 
                border: '1px solid var(--border)', 
                padding: '0.4rem 0.75rem', 
                borderRadius: '10px',
                color: 'var(--text-secondary)'
            }}>
                <Globe size={16} />
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Regiones:</span>
            </div>
            
            <div style={{ position: 'relative', display: 'inline-block' }}>
                <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    style={{
                        padding: '0.5rem 2.5rem 0.5rem 1rem',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-main)',
                        fontSize: '0.9rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        minWidth: '160px',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}
                    className="hover-card"
                >
                    {countries.map(country => (
                        <option key={country} value={country}>
                            {country === 'Todos' ? '🌍 Todas las Regiones' : country}
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
                    <ChevronDown size={14} />
                </div>
            </div>
        </div>
    );
};
