# Plan de Implementación: AssetFlow (IT Case Management)

## Fase 1: Configuración y Cimientos
- [x] Inicializar proyecto con Next.js (App Router)
- [x] Configurar sistema de diseño base (Variables CSS, Tema Dark/Light persistente)
- [x] Gestión de estado global y persistencia en Backend (JSON DB)
- [x] Sistema de roles persistentes (Admin, Conductor, Administrativo, Gerencial)

## Fase 2: Sistema de Diseño y Componentes Core
- [x] Crear Layout Principal (Sidebar, Header responsive)
- [x] Desarrollar componentes UI base (Botones, Tarjetas, Tablas ordenables)
- [x] Implementar sistema de notificaciones y modales premium

## Fase 3: Gestión de Servicios (Service Management)
- [x] Vista de Tablero/Dashboard dinámico (KPIs interactivos con filtrado)
- [x] Integración con Salesforce (Importación CSV avanzada, bandeja de entrada SFDC)
- [x] Conversión de Casos SFDC a Servicios internos con lógica de logística
- [x] Vista de Detalle de Ticket / Gestión completa (Historial, Notas, Logística)

## Fase 4: Gestión de Inventario (Inventory Management)
- [x] Catálogo de Activos (Hardware con/sin S/N, Consumibles)
- [x] Automatización de Asignación: Actualización de estado, responsable e historial del activo al vincularlo a un ticket
- [x] Vista de detalle de activo (Historial de movimientos detallado)

## Fase 5: Gestión de Entregas (Logística Avanzada)
- [x] Panel de Gestión de Envíos con integración real de Google Maps (Geolocalización CABA)
- [x] Interfaz "Mis Envíos" exclusiva para Conductores con navegación directa a Maps
- [x] Sistema de Secuenciación: Botones de orden editables y colorizados por jornada
- [x] Agrupamiento Inteligente: Separación por día y agrupación por dirección para optimización de rutas
- [x] Registro de Entrega: Captura de DNI, Recibido por, y horario real con envío de comprobantes (WhatsApp/Email)

## Fase 6: Pulido y Optimización
- [x] Animaciones de transición (Framer-like transitions)
- [x] Sistema de etiquetas dinámicas (Entrega/Recupero) en activos vinculados
- [x] Filtros KPI en tablero de entregas
- [x] Optimización SEO y Performance
