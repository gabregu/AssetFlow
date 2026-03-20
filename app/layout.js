import './globals.css';
import { StoreProvider } from '../lib/store';

import { ThemeProvider } from './components/theme-provider';

export const metadata = {
    title: 'AssetFlow - IT Case Management',
    description: 'Gestión integral de Casos, Inventario y Entregas',
    icons: {
        icon: '/favicon.png', // Conectamos el nuevo icono generado
    },
};

import { InactivityMonitor } from './components/ui/InactivityMonitor';

export default function RootLayout({ children }) {
    return (
        <html lang="es" suppressHydrationWarning={true}>
            <body suppressHydrationWarning={true}>
                <ThemeProvider>
                    <StoreProvider>
                        <InactivityMonitor />
                        <div className="app-layout">
                            {children}
                        </div>
                    </StoreProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
