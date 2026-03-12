# Informe de Solución: Pagos que Desaparecen

Este informe resume por qué los pagos desaparecían después de unos minutos y proporciona los pasos exactos para solucionarlo si el problema vuelve a ocurrir.

## 1. El Problema (Causas Raíz)

Hubo tres factores que causaron este comportamiento:
1.  **Código faltante (App.tsx):** Faltaba la línea pushLog(newLog) en la función AddCollectionAttempt. Esto hacía que los pagos se guardaran localmente pero NUNCA se enviaran a la nube.
2.  **Bloqueo de Base de Datos (Supabase):** Un trigger (fn_enforce_admin_manager_only) bloqueaba a los cobradores cuando intentaban actualizar el saldo de un cliente. Esto hacía que el registro fallara en el servidor incluso si el código estaba bien.
3.  **Limpieza Agresiva (Frontend):** La aplicación borraba automáticamente cualquier dato local que no estuviera en la nube después de solo 5 minutos.

---

## 2. Solución Aplicada (Pasos para Repetir)

Si el problema vuelve a ocurrir (por un error de actualización o cambios en la base de datos), sigue estos 3 pasos:

### Paso A: Corregir el código en App.tsx
Asegúrate de que en la función addCollectionAttempt (alrededor de la línea 1100), se llame a pushLog(newLog):

```typescript
// BUSCAR ESTA PARTE EN App.tsx:
if (newPaymentsForSync.length > 0 || loansToSync.length > 0) {
  for (const p of newPaymentsForSync) pushPayment(p);
  for (const l of loansToSync) pushLoan(l);
  pushLog(newLog); // <-- ESTA LÍNEA DEBE EXISTIR
}
```

### Paso B: Actualizar el Trigger en Supabase (SQL)
Ejecuta este comando en el Editor SQL de Supabase para desbloquear los saldos:

```sql
CREATE OR REPLACE FUNCTION public.fn_enforce_admin_manager_only()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id::TEXT = auth.uid()::TEXT;
    
    -- 1. Permiso total para Admin y Gerente
    IF user_role IS NOT NULL AND (user_role = 'Administrador' OR user_role = 'Gerente') THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

    -- 2. Permitir a Cobradores actualizar saldo y GPS
    IF TG_TABLE_NAME = 'clients' AND TG_OP = 'UPDATE' THEN
        IF (OLD.name IS NOT DISTINCT FROM NEW.name) AND
           (OLD.document_id IS NOT DISTINCT FROM NEW.document_id) AND
           (OLD.address IS NOT DISTINCT FROM NEW.address) AND
           (OLD.phone IS NOT DISTINCT FROM NEW.phone) AND
           (OLD.is_active IS NOT DISTINCT FROM NEW.is_active) AND
           (OLD.branch_id IS NOT DISTINCT FROM NEW.branch_id) AND
           (OLD.credit_limit IS NOT DISTINCT FROM NEW.credit_limit)
        THEN
            RETURN NEW;
        END IF;
    END IF;

    RAISE EXCEPTION 'Acción denegada por seguridad.';
END; $function$;
```

### Paso C: Relajar la limpieza local en App.tsx
Busca la variable isRecent y cambia 300000 (5 min) por 86400000 (24 horas) para que los datos no se borren tan rápido si falla el internet.

---

## 3. Verificación
Para confirmar que está arreglado, el número ámbar de "Sync Queue" en la parte superior derecha debe llegar a 0 después de registrar un pago. Si el número se queda pegado, hay un error de servidor.
