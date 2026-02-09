import React from 'react';
import { useStore } from '../../../lib/store';

export const CountryFilter = () => {
    const { countryFilter, setCountryFilter } = useStore();
    const countries = ['Todos', 'Argentina', 'Chile', 'Colombia', 'Costa Rica', 'Uruguay'];

    return (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {countries.map(country => (
                <button
                    key={country}
                    onClick={() => setCountryFilter(country)}
                    style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        border: '1px solid',
                        borderColor: countryFilter === country ? 'var(--primary-color)' : 'var(--border)',
                        background: countryFilter === country ? 'var(--primary-color)' : 'transparent',
                        color: countryFilter === country ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                        transition: 'all 0.2s ease'
                    }}
                >
                    {country}
                </button>
            ))}
        </div>
    );
};
