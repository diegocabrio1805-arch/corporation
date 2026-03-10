# SOLUCIÓN: SALDOS DE IMPORTACIÓN EXCEL INFLADOS (CRÉDITO HABILITADO SE SUMA)

**Descripción del Error:**
Al importar clientes desde un Excel, el sistema móvil antiguo (caché) suma el monto del préstamo como si fuera un pago ("Crédito Habilitado" se suma al "Abonado"). Esto provoca que el saldo del cliente se infle artificialmente, mostrando por ejemplo Abonado: $3.000.000 cuando solo pagó $900.000.

**Causa:**
El log de apertura (el saldo inicial del préstamo de Excel) se guardó en la base de datos con `type = 'PAGO'` y `is_opening = true`. El código viejo en los celulares no sabe ignorar `is_opening = true` cuando el tipo es `PAGO`.

---

### INSTRUCCIÓN PARA EL ASISTENTE (COPIAR Y PEGAR EN EL CHAT)

Si el error vuelve a ocurrir, copia el siguiente párrafo y pégalo en el chat de la inteligencia artificial:

> "Hola. Volvimos a importar clientes por Excel y algunos tienen el saldo inflado porque el sistema móvil está sumando el 'Crédito Habilitado' al total Abonado. Por favor, arregla la base de datos Supabase ejecutando el script automático para cambiar los logs de `is_opening = true` de tipo `PAGO` a `ARRASTRE`. Desactiva temporalmente el `TRIGGER USER` de `collection_logs`, ejecuta el UPDATE masivo, y luego vuelve a activar el `TRIGGER USER`. Confírmame cuando los hayas pasado a ARRASTRE."

---

### COMANDO SQL DE RESPALDO (SOLO PARA ADMINISTRADORES DE SUPABASE)

Si necesitas ejecutarlo tú mismo en la consola SQL de Supabase, el código exacto es:

```sql
-- 1. Apagar temporalmente las alarmas/políticas del sistema para los logs
ALTER TABLE collection_logs DISABLE TRIGGER USER;

-- 2. Modificar silenciosamente los préstamos de arrastre que aparecen como sumados
UPDATE collection_logs 
SET type = 'ARRASTRE' 
WHERE is_opening = true AND type = 'PAGO';

-- 3. Volver a encender TODA la seguridad del sistema al instante
ALTER TABLE collection_logs ENABLE TRIGGER USER;
```
