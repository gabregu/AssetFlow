import React from 'react';

export function Button({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    icon: Icon,
    ...props
}) {
    const baseStyles = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
        primary: "bg-[var(--primary-color)] text-white hover:bg-[var(--primary-hover)] shadow-md hover:shadow-lg hover:-translate-y-0.5",
        secondary: "bg-white text-[var(--text-main)] border border-[var(--border)] hover:border-[var(--text-secondary)] hover:bg-gray-50",
        ghost: "bg-transparent text-[var(--text-secondary)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10",
        danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
    };

    const sizes = {
        sm: "text-xs px-3 py-1.5 rounded-md gap-1.5",
        md: "text-sm px-4 py-2 rounded-lg gap-2",
        lg: "text-base px-6 py-3 rounded-xl gap-2.5",
        icon: "p-2 rounded-lg",
    };

    // Nota: Como no estamos usando Tailwind (salvo que el usuario lo pidiera, pero el prompt dice Vanilla CSS pref, aunque el usuario NO pidió Tailwind, las clases de arriba son estilo Tailwind que NO funcionarán sin Tailwind configurado).
    // ERROR MÍO: En el prompt inicial dice "Avoid using TailwindCSS unless the USER explicitly requests it".
    // CORRECCIÓN: Debo usar CSS Modules o estilos en línea/clases standard definidas en globals.css.
    // Voy a reescribir esto usando clases estándar que definí en globals.css y estilos en línea para lo específico.

    return (
        <button
            className={`btn btn-${variant} ${className}`}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                ...props.style
            }}
            {...props}
        >
            {Icon && <Icon size={size === 'sm' ? 14 : size === 'lg' ? 20 : 18} />}
            {children}
        </button>
    );
}
