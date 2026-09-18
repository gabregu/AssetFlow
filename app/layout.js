import './globals.css';
import { StoreProvider } from '../lib/store';

import { ThemeProvider } from './components/theme-provider';

export const metadata = {
    title: 'AssetFlow - IT Case Management',
    description: 'Gestión integral de Casos, Inventario y Entregas',
    icons: {
        icon: [
            { url: '/favicon.png?v=3', sizes: 'any', type: 'image/png' },
            { url: '/icon-192x192.png?v=3', sizes: '192x192', type: 'image/png' },
            { url: '/icon-512x512.png?v=3', sizes: '512x512', type: 'image/png' }
        ],
        apple: [
            { url: '/apple-touch-icon.png?v=3', sizes: '180x180', type: 'image/png' }
        ],
        shortcut: ['/favicon.ico?v=3']
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
