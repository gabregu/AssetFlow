'use client';

import React from 'react';

export default function TimeSlotSelector({
    editedData,
    setEditedData,
    disabled
}) {
    const setTimeSlot = (slot) => {
        setEditedData(prev => {
            const currentLog = prev.logistics || {};
            const hasAllInfo = currentLog.date && slot;
            
            const newData = {
                ...prev,
                logistics: { ...currentLog, timeSlot: slot }
            };

            // Si hay fecha y turno, pasar a En Tránsito
            if (hasAllInfo) {
                newData.deliveryStatus = 'En Transito';
            }
            return newData;
        });
    };

    const currentTimeSlot = editedData.logistics?.timeSlot || 'AM';

    return (
        <div className="form-group">
            <label className="form-label">Turno</label>
            <div style={{ display: 'flex', gap: '0.5rem', height: '42px' }}>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setTimeSlot('AM')}
                    style={{
                        flex: 1,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: currentTimeSlot === 'AM' ? 'var(--primary-color)' : 'var(--background)',
                        color: currentTimeSlot === 'AM' ? 'white' : 'var(--text-main)',
                        fontWeight: 600,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >AM</button>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setTimeSlot('PM')}
                    style={{
                        flex: 1,
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                        background: currentTimeSlot === 'PM' ? 'var(--primary-color)' : 'var(--background)',
                        color: currentTimeSlot === 'PM' ? 'white' : 'var(--text-main)',
                        fontWeight: 600,
                        cursor: disabled ? 'default' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >PM</button>
            </div>
        </div>
    );
}
