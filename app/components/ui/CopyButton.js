import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export const CopyButton = ({ text, style = {}, iconSize = 13 }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!text) return;
        navigator.clipboard.writeText(String(text).trim());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            title="Copiar al portapapeles"
            style={{
                background: 'none',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: copied ? '#10b981' : 'var(--text-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s',
                verticalAlign: 'middle',
                ...style
            }}
            onMouseEnter={(e) => {
                if (!copied) e.currentTarget.style.color = 'var(--text-main)';
            }}
            onMouseLeave={(e) => {
                if (!copied) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
        >
            {copied ? <Check size={iconSize} /> : <Copy size={iconSize} />}
        </button>
    );
};

export default CopyButton;
