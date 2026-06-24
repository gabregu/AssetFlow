# Resolución del Deadlock por Web Locks y Resiliencia de Sesión en Supabase

Este documento detalla el diagnóstico y la solución aplicada para resolver los problemas de congelamiento aleatorio al guardar información o al dejar la aplicación abierta durante periodos prolongados. Sirve como estándar técnico para el desarrollo y mantenimiento de los formularios y la integración con Supabase.

---

## 1. El Problema (Síntomas)
* **Comportamiento:** Los usuarios y conductores reportaban que, tras dejar la aplicación abierta e inactiva por un tiempo, al intentar guardar un formulario (p. ej., detalles de un ticket o carga de entregas), el botón se quedaba permanentemente bloqueado en `"Guardando..."` y la aplicación se colgaba de forma indefinida.
* **Mensaje en el DOM:** Se observaba el texto estático `2.1.1 Guardando en BD principal...` congelado al lado del botón, sin avanzar a respuestas de éxito ni de error.
* **Solución temporal vieja:** Recargar la página y volver a llenar el formulario.

---

## 2. Causa Raíz: Deadlock por Web Locks de Supabase
El problema técnico no era un fallo de red ni de base de datos, sino un **bloqueo mutuo (deadlock)** interno del SDK de Supabase al interactuar con el navegador web:

1. **Expiración del JWT:** Las sesiones de Supabase expiran cada 1 hora.
2. **Refresco de Sesión:** Al intentar realizar una consulta con un token expirado, el backend responde con un error `401 Unauthorized` o `PGRST301`. Nuestro interceptor de reintento detecta esto y ejecuta `await supabase.auth.refreshSession()`.
3. **Bloqueo Exclusivo (Web Lock):** Durante el proceso de refresco de sesión, el SDK de Supabase adquiere un bloqueo exclusivo (`navigator.locks`) sobre la sesión de autenticación para garantizar consistencia.
4. **Lanzamiento de Evento:** A mitad de este proceso, Supabase dispara el evento `TOKEN_REFRESHED` a todos los escuchas registrados mediante `supabase.auth.onAuthStateChange`.
5. **Consulta Bloqueante:** El listener global en `lib/store.js` capturaba el evento y ejecutaba de forma síncrona:
   ```javascript
   const { data } = await supabase.from('users').select('*').eq('email', ...);
   ```
6. **El Deadlock:**
   * La consulta `supabase.from('users').select(...)` necesita firmar la petición, por lo que consulta el estado de autenticación, intentando adquirir el mismo Web Lock de sesión.
   * La consulta se suspende en el `await` esperando que el Web Lock sea liberado.
   * Sin embargo, `refreshSession()` **no libera el Web Lock** hasta que todos los callbacks de `onAuthStateChange` finalicen su ejecución.
   * Ambas promesas quedan pendientes indefinidamente esperando la otra, congelando por completo el flujo de autenticación del cliente. Cualquier consulta posterior en la app (como guardar un formulario) queda en cola esperando el mismo Web Lock liberado, provocando el cuelgue generalizado.

---

## 3. La Solución Aplicada

Se implementó una solución en tres niveles dentro del archivo [store.js](file:///c:/Users/guill/OneDrive/Documents/Antigravity-APP/AssetFlow/lib/store.js):

### A. Desacoplamiento Asíncrono (`setTimeout`)
Para evitar que las consultas dentro del listener de autenticación bloqueen el ciclo del refresco, se envolvió el cuerpo del listener de `onAuthStateChange` en un `setTimeout` con retardo cero:
```javascript
const authResponse = supabase.auth.onAuthStateChange((event, session) => {
    // ...
    setTimeout(async () => {
        try {
            // Consultas a la base de datos se ejecutan en el siguiente tick del event loop
        } catch (err) { ... }
    }, 0);
});
```
* **Efecto:** El listener de eventos de autenticación retorna inmediatamente, permitiendo que `refreshSession()` complete su ejecución y libere el Web Lock de sesión. Cuando el callback del `setTimeout` se ejecuta en el siguiente ciclo, el lock ya está libre y las consultas se resuelven de forma instantánea.

### B. Omisión de Consultas Redundantes para `TOKEN_REFRESHED`
Se agregó un cortocircuito al inicio del listener para ignorar eventos de refresco de token si el usuario ya está cargado en memoria:
```javascript
if (event === 'TOKEN_REFRESHED' && currentUserRef.current) {
    console.log('Skipping profile & data fetch for TOKEN_REFRESHED event.');
    if (!isUnmounted) setLoading(false);
    return;
}
```
* **Efecto:** Reduce drásticamente la carga sobre la red y evita consultas de base de datos innecesarias en segundo plano cada vez que el token se actualiza automáticamente.

### C. Generación Dinámica de Consultas en Reintentos
Modificamos el helper `withRetryAndTimeout` en [store.js](file:///c:/Users/guill/OneDrive/Documents/Antigravity-APP/AssetFlow/lib/store.js) para recibir un callback generador de consultas (`getQueryBuilderFn`) en lugar de una consulta estática pre-construida:
```javascript
// Correcto (Generación dinámica)
let { error } = await withRetryAndTimeout(
    () => supabase.from('tickets').update(dbUpdate).eq('id', id), 
    15000, 
    1
);
```
* **Efecto:** Al fallar por token expirado, el reintento ejecuta nuevamente la función anónima, la cual solicita al cliente de Supabase una nueva consulta. Esto asegura que la petición de reintento incluya las cabeceras `Authorization` con el nuevo token JWT obtenido durante el refresco.

---

## 4. Estándar de Implementación para Nuevos Formularios
Para cualquier nuevo formulario que requiera guardar o modificar información en Supabase de forma resiliente, se deben seguir estas directrices:

1. **Uso de `useForm` / `useSafeSubmit`:** Centralizar el estado del formulario con el hook [useForm.js](file:///c:/Users/guill/OneDrive/Documents/Antigravity-APP/AssetFlow/lib/useForm.js) para evitar envíos dobles, controlar timeouts en el cliente (30 segundos por defecto) y cancelar peticiones si el usuario navega fuera del formulario.
2. **Consultas con Tolerancia a Fallos:** Envolver los métodos de persistencia usando el ayudante `withRetryAndTimeout` para garantizar que errores transitorios de red o JWT expirado se solventen de forma transparente para el usuario final sin congelar el botón de envío.
3. **Manejo de Errores Limpio:** Asegurarse de que en caso de error definitivo, el estado de carga (`isSaving`) se apague y el mensaje de error sea visible, en lugar de dejar el formulario bloqueado.
