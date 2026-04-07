"use client";
import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Button } from '../../components/ui/Button';

export default function ImportCODPage() {
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [stats, setStats] = useState({ success: 0, missing: 0 });

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            setLoading(true);
            setLogs(['Iniciando lectura de archivo...']);
            let sCount = 0;
            let mCount = 0;

            const text = event.target.result;
            const lines = text.split('\n');

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const parts = line.split(',');
                const serial = parts[0].replace(/"/g, '').trim();
                if (!serial) continue;

                setLogs(prev => [...prev, `Buscando serial: ${serial}...`]);

                try {
                    const { data, error } = await supabase
                        .from('assets')
                        .update({ cod: 'COD Abril 2026' })
                        .ilike('serial', serial)
                        .select();

                    if (error) {
                        setLogs(prev => [...prev, `❌ Error en ${serial}: ${error.message}`]);
                    } else if (data && data.length > 0) {
                        setLogs(prev => [...prev, `✅ Éxito: ${serial} marcado como COD`]);
                        sCount++;
                    } else {
                        setLogs(prev => [...prev, `⚠️ Advertencia: ${serial} no existe en DB`]);
                        mCount++;
                    }
                } catch (err) {
                    setLogs(prev => [...prev, `❌ Exception en ${serial}: ${err.message}`]);
                }
            }

            setStats({ success: sCount, missing: mCount });
            setLogs(prev => [...prev, `🎉 Proceso Finalizado. Éxitos: ${sCount}, No Encontrados: ${mCount}`]);
            setLoading(false);
        };
        reader.readAsText(file);
    };

    return (
        <div style={{ padding: '3rem', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ background: 'var(--surface)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Herramienta Automática COD Abril 2026</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Sube el archivo "COD2026 - Tabla de Seriales.csv". El sistema usará tu sesión activa para brincar las restricciones de seguridad y actualizar la base de datos automáticamente.
                </p>
                
                <input 
                    type="file" 
                    accept=".csv" 
                    onChange={handleFileUpload} 
                    disabled={loading}
                    style={{ marginBottom: '2rem', padding: '1rem', border: '2px dashed var(--border)', borderRadius: '8px', width: '100%' }}
                />

                {loading && <p style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Procesando base de datos, por favor espera...</p>}

                {(stats.success > 0 || stats.missing > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success-color)', padding: '1rem', borderRadius: '8px' }}>
                            <strong>Equipos Marcados:</strong> {stats.success}
                        </div>
                        <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-color)', padding: '1rem', borderRadius: '8px' }}>
                            <strong>No Encontrados:</strong> {stats.missing}
                        </div>
                    </div>
                )}

                <div style={{ background: 'var(--background)', padding: '1rem', borderRadius: '8px', height: '400px', overflowY: 'auto', border: '1px solid var(--border)' }}>
                    {logs.map((log, index) => (
                        <div key={index} style={{ fontSize: '0.85rem', marginBottom: '0.25rem', fontFamily: 'monospace' }}>
                            {log}
                        </div>
                    ))}
                    {logs.length === 0 && <span style={{ color: 'var(--text-secondary)' }}>Esperando archivo...</span>}
                </div>
            </div>
        </div>
    );
}
