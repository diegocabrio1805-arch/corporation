# Borrado Suave y Limpieza Automática de Cobradores

He implementado un sistema de borrado seguro para los cobradores, asegurando que los datos se oculten inmediatamente de la vista de los gerentes y se eliminen definitivamente de la base de datos después de 30 días.

## Cambios Realizados

### Frontend (Ocultamiento Inmediato)

- **[App.tsx](file:///c:/Users/DANIEL/Desktop/cobros/App.tsx)**: Se actualizó la lógica de procesamiento de datos en tiempo real (`handleRealtimeData`) para filtrar automáticamente a cualquier usuario que tenga una marca de eliminación (`deletedAt`). Esto garantiza que, aunque el administrador "elimine" al usuario, este desaparezca instantáneamente de la vista de todos los gerentes y del propio administrador sin esperar a la eliminación física en la base de datos.

### Base de Datos (Limpieza en Segundo Plano)

- **Supabase (pg_cron)**:
  - Se habilitó la extensión `pg_cron` en tu base de datos.
  - Se creó una función `delete_expired_soft_deleted_profiles()` que busca registros en la tabla `profiles` con un `deleted_at` mayor a 30 días.
  - Se programó una tarea cron (`cleanup-soft-deleted-profiles`) que ejecuta esta limpieza **diariamente a medianoche**.

## Resultado

1. **Seguridad**: Los datos no se borran físicamente de inmediato, permitiendo recuperarlos en caso de error (vía DB) durante los primeros 30 días.
2. **Privacidad**: El gerente ve que el cobrador desaparece de su lista al instante.
3. **Eficiencia**: La base de datos se mantiene limpia de datos obsoletos automáticamente.
