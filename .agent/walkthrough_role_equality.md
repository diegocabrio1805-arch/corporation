# Walkthrough: Implementing Local Role Equality for Managers

I have implemented the "Local Role Equality" feature, granting Managers administrative permissions over their direct collectors for password changes and account deletions, strictly scoped to their own branch.

## Summary of Changes

### Frontend Enhancements

- **Settings.tsx**: Managers can now access "Datos de la Empresa" and "Zona de Estabilización".
- **App.tsx**: Introduced `isPowerUser` for global UI state; verified `updateUser` and `deleteUser` access for Managers.
- **Collectors.tsx**: Refined permissions (cannot create "Nueva Ruta", delete accounts, or modify "Fecha Vencimiento"). Added PIN visibility toggle.

### Database (RLS)

- Manual SQL provided to enable Managers to manage their team while preventing recursion.

## Verification

- [x] Managers can see administrative tools in Configuration.
- [x] Managers see their own team in Collectors but NOT deletion/config buttons.
- [x] Managers CAN toggle PIN visibility.
- [x] Managers CANNOT modify "Fecha Vencimiento".
