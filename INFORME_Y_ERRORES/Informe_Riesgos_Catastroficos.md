# 🚨 INFORME DE RIESGOS CATASTRÓFICOS GLOBALES (MAYO 2026)

Este es un escaneo profundo de la arquitectura actual de la aplicación (v6.3.3). Estos son errores que **no ocurren hoy**, pero que son **bombas de tiempo** garantizadas cuando la empresa crezca en volumen de clientes o datos.

---

## 💥 1. Riesgo de Pérdida Masiva de Datos (Offline)
**Causa:** La aplicación guarda todos los datos creados sin internet en una bóveda llamada `LocalStorage` (`localStorage.setItem('syncQueue', ...)`).
**El Peligro Catastrófico:**
- En Android e iOS, el `LocalStorage` tiene un límite estricto de **5 Megabytes**. 
- Si un cobrador se queda sin internet 2 días y añade, por ejemplo, 50 clientes nuevos o guarda múltiples fotos en Base64, la aplicación colisionará contra la pared de los 5MB. 
- Lanzará un error silencioso (`QuotaExceededError`), la aplicación dejará de guardar nuevos cobros, y todo lo que el cobrador haga a partir de ahí **se perderá para siempre** sin que él se dé cuenta.
**Solución a futuro:** Migrar la cola de sincronización de LocalStorage a `IndexedDB` o `LocalForage`, que soporta hasta 1 Gigabyte de datos offline.

## 💥 2. Colapso de Memoria RAM (Crash de la App)
**Causa:** Cada vez que la app entra online o fuerza sincronización, ejecuta funciones como `fetchAll()` en `useSync.ts` sin usar paginación genuina escalonada en SQL.
**El Peligro Catastrófico:**
- Hoy tienes un flujo manejable. Pero cuando tengas 10,000 préstamos históricos y 50,000 recibos de pago en Supabase, el teléfono de los cobradores intentará descargar toda esa brutalidad de datos de golpe a la memoria RAM de React.
- Los teléfonos Android de gama media-baja se quedarán sin RAM (OOM - Out of Memory) y la aplicación **se cerrará sola mágicamente (Crasheo) en pantalla blanca** cada vez que intenten abrirla.
**Solución a futuro:** Implementar Paginación (Lazy Loading). Que el celular solo descargue los cobros de los "últimos 3 meses" o solo pida bloques de 500 en 500, en lugar del 100% de la historia financiera.

## 💥 3. Vulnerabilidad Hacker (Seguridad RLS Abierta)
**Causa:** Por problemas recientes, tuvimos que generar un bypass desactivando algunas reglas de RLS (`Row Level Security`) en Supabase.
**El Peligro Catastrófico:**
- Actualmente, la seguridad solo existe "en la vista". Si un exempleado molesto o un hacker extrae tu `anon_key` (que viene empaquetada y visible dentro del código de la APK), podría conectarse a tu Supabase desde su propia computadora y borrar la base de datos completa con una sola línea de código, o robarse los teléfonos de todos tus clientes de todas las sucursales.
**Solución a futuro:** Activar RLS de Supabase al 100% exigiendo comprobación de JWT token nativo desde el Backend, de forma que incluso si alguien roba tu llave, sea imposible pedirle un dato al servidor si no están logueados con un usuario gerente válido.

## 💥 4. Imágenes Pesadas en Base64 (Lentitud Extrema)
**Causa:** Las funciones de helpers para guardar la foto del cliente/casa están inyectando la imagen codificada en formato texto largo (`Base64`) y manteniéndolo en el Contexto global de React (`state.clients`).
**El Peligro Catastrófico:**
- Cargar fotos convierte un objeto de cliente que pesaba 2 KB a uno que pesa 150 KB. Mantener 300 clientes en la RAM con sus fotos Base64 pondrá el celular a arder, la batería se drenará en 2 horas y la pantalla táctil de la aplicación tendrá "lag" crónico, tardando 3 segundos en responder a cada botón.
**Solución a futuro:** Usar `URLs de Supabase Storage` en lugar de encriptar la foto en Base64 dentro del estado global. La app debe descargar la imagen fresca de internet como una etiqueta `<img src="url">` solo cuando la pida, sin guardarla permanentemente en RAM.
