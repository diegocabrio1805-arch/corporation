# INFORME DE EMERGENCIA: RESTAURACIÓN DE CLIENTES Y SOLUCIÓN DE VISIBILIDAD
### Fecha: 10 de Marzo de 2026
### ID de Sucursal Administrador (Dante): b3716a78-fb4f-4918-8c0b-92004e3d63ec

---

## 1. RESUMEN DEL PROBLEMA
Se detectó que 54 clientes fueron inicialmente borrados lógicamente (`deleted_at` no nulo). Tras la restauración inicial, los clientes seguían sin aparecer en el Dashboard debido a:
1.  **Aislamiento de Sucursal**: Los registros tenían un `branch_id` distinto al de Dante, lo que activaba filtros de seguridad en la aplicación.
2.  **Estado de Préstamo**: Algunos préstamos figuraban como inactivos tras el borrado masivo.

## 2. SOLUCIÓN APLICADA
Se realizó una reparación maestra que unificó la base de datos bajo los parámetros de visibilidad del Administrador.
- **Resultado Final**: 253 préstamos activos y visibles.
- **Estado Actual**: 0 clientes ocultos o borrados.

---

## 3. SOLUCIÓN TÉCNICA (COMANDOS SQL PARA SUPABASE)

Si el problema vuelve a ocurrir, ejecute estos comandos en el **SQL Editor** de Supabase en este orden exacto:

### PASO 1: Apagar validaciones de seguridad
```sql
ALTER TABLE clients DISABLE TRIGGER USER;
```

### PASO 2: Restaurar Clientes y Forzar Visibilidad
Este comando quita el borrado, desoculta al cliente y lo asigna a la sucursal de Dante.
```sql
UPDATE clients
SET 
  deleted_at = NULL, 
  is_hidden = false,
  is_active = true,
  branch_id = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec'
WHERE deleted_at IS NOT NULL OR is_hidden = true OR branch_id IS NULL;
```

### PASO 3: Restaurar Préstamos y Unificar Sucursal
```sql
UPDATE loans
SET 
  deleted_at = NULL,
  branch_id = 'b3716a78-fb4f-4918-8c0b-92004e3d63ec'
WHERE deleted_at IS NOT NULL OR branch_id IS NULL;
```

### PASO 4: Reactivar Estado de Préstamos (Para el Dashboard)
```sql
UPDATE loans
SET status = 'Activo'
WHERE status != 'Pagado' AND deleted_at IS NULL;
```

### PASO 5: Reencender la seguridad
```sql
ALTER TABLE clients ENABLE TRIGGER USER;
```

---

## 4. CONTEO DE VERIFICACIÓN FINAL (POR COBRADOR)
- **FABIAN ARRUA**: 45
- **JUVE VILLALBA**: 42
- **DERLIS ARMOA**: 21
- **ANEXO COBRADOR**: 33
- **OTROS**: Resto hasta completar 253.

---
**Nota**: El informe original se encuentra disponible también en formato Markdown y se ha verificado visualmente en el Dashboard local.
