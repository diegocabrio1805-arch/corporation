# Implementación de Botones de Salida / Volver

He implementado botones claros para navegar fuera de las pestañas de administración (Rutas/Cobradores y Gerentes), cumpliendo con tu solicitud de tener una forma fácil de salir de estas secciones hacia el panel principal.

## Cambios Realizados

### [Collectors.tsx](file:///c:/Users/DANIEL/Desktop/cobros/components/Collectors.tsx)

- Se agregó un botón **"SALIR"** prominente en la barra de acciones superior.
- Se agregó un botón de **flecha "Volver"** específico para móviles en la cabecera.
- Ambos botones redirigen inteligentemente según el rol del usuario (Dashboard para Admin/Gerente, Ruta para Cobrador).

### [Managers.tsx](file:///c:/Users/DANIEL/Desktop/cobros/components/Managers.tsx)

- Se agregó un botón **"SALIR"** en la barra de acciones superior para consistencia.
- Se agregó un botón de **flecha "Volver"** en la cabecera para móviles.
- Redirige siempre al Dashboard.

### [App.tsx](file:///c:/Users/DANIEL/Desktop/cobros/App.tsx)

- Se pasó la función `setActiveTab` como prop a ambos componentes para habilitar la navegación.

## Verificación Visual

Los botones están diseñados para ser intuitivos:

1. **Móvil:** Un círculo con flecha a la izquierda al lado del título.
2. **Escritorio/Tablet:** Un botón rectangular "SALIR" junto a los botones de acción ("Nueva Ruta", "Configurar Recibo").
