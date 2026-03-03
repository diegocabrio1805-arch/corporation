# MANUAL DE FUNCIONAMIENTO - SISTEMA ANEXO COBRO

**Versión: 6.1.170**

Este documento detalla el funcionamiento integral del sistema, actuando como una guía técnica y operativa de alta precisión ("Reloj Suizo").

---

## 1. ESTRUCTURA Y NAVEGACIÓN

El sistema se organiza en **Pestañas Principales**, cada una con una función específica:

* **DASHBOARD:** Visión general del estado financiero y eficiencia de cobro.
* **CLIENTES:** Gestión total de la base de datos de deudores, préstamos y recibos.
* **GASTOS:** Registro de salidas de dinero de la empresa.
* **COBRADORES:** Gestión de usuarios, perfiles y auditoría de rutas.
* **CONFIGURACIÓN:** Ajustes globales de moneda, país, feriados e identidad visual.

---

## 2. EL "RELOJ SUIZO": CÁLCULOS DE PRÉSTAMOS Y MORA

La precisión del sistema reside en su motor de cálculo central (`helpers.ts` y `Clients.tsx`).

### A. Creación de un Préstamo

1. **Monto Total (Total a Pagar):** Se calcula como `Capital * (1 + Tasa de Interés / 100)`.
2. **Valor de la Cuota:** Se divide el `Monto Total` entre el `Número de Cuotas`, aplicando un redondeo superior (`Math.ceil`) para asegurar que no se pierdan céntimos.
3. **Tabla de Amortización:** El sistema genera un calendario de pagos automático basado en la **Frecuencia** (Diaria, Semanal, Quincenal, Mensual).
    * **Regla de Oro:** Automáticamente ignora **DOMINGOS** y **FERIADOS** (configurados por país o personalizados), saltando al siguiente día hábil.

### B. Saldo Actual y Saldos Atrasados

* **Saldo Actual:** Es el resultado de `Monto Total - Suma de Abonos Reales`. Se actualiza en tiempo real con cada registro de pago.
* **Saldo Atrasado (Responsabilidad):** Es la suma de los valores de todas las cuotas cuya fecha del calendario (`dueDate`) ya pasó y que aún no han sido cubiertas por los abonos realizados.

### C. Días de Atraso (Mora Real)

El cálculo de mora es dinámico e inteligente:

1. El sistema recrea una "tabla virtual" basada en la fecha de inicio del préstamo.
2. Identifica la **primera cuota vencida** que no ha sido pagada.
3. Cuenta los días transcurridos desde esa fecha hasta el día de HOY.
4. **Exclusión de Inactividad:** NO cuenta domingos ni feriados en el total de días de atraso, reflejando la mora real de días de cobro perdidos.

---

## 3. GESTIÓN DE CLIENTES Y CARTERA

### A. Registro Extendido

Permite capturar 45 campos de información, divididos en:

* **Identidad:** Nombre, Cédula, Teléfonos.
* **Vivienda:** Tipo (propia/alquilada), antigüedad, ubicación GPS exacta y foto de la casa.
* **Familia:** Datos del cónyuge (Nombre, Cédula, Ingresos, Trabajo).
* **Negocio:** Ubicación, rubro y foto del comercio.

### B. Legajo Digital (Expediente)

Cada cliente tiene un "Legajo" que permite:

* Ver historial de todos los pagos y visitas.
* Visualizar fotos de perfil, casa, negocio y documento.
* **Transformación PDF:** Cualquier foto subida puede visualizarse o descargarse como PDF profesional.
* **Compartir WhatsApp:** Envío de estado de cuenta detallado con un solo clic.

### C. Importación y Exportación Excel

Ubicado en la parte superior de la **Cartera General**:

* **Exportar:** Genera una planilla con las 45 columnas de datos, incluyendo saldos y estados de mora.
* **Importar:** Permite cargar nuevos clientes masivamente. Al importar, se solicita asignar un **Cobrador/Ruta** específico para que los nuevos registros aparezcan automáticamente en su dispositivo.

---

## 4. DASHBOARD Y COBRADORES

### A. Eficiencia de Cobro

Se calcula dividiendo lo **Cobrado Realmente** entre la **Responsabilidad** (lo que se debía cobrar). Un 100% indica una ruta perfecta.

### B. Gestión de Cobradores

* Permite ver la ubicación GPS de donde el cobrador marcó su último pago o visita.
* Auditoría de "Apertura de Caja" para control de capital diario.

---

## 5. RECIBOS Y AUDITORÍA

Cada abono genera un registro inmutable:

* **Método:** Distingue entre Efectivo y Transferencia Virtual.
* **Recibo:** Incluye "Saldo Anterior", "Abono actual" y "Saldo Nuevo", además de la progresión de cuotas (ej: 5.3 / 24 si hay un pago parcial).

---

**NOTA PARA EL USUARIO:** Este manual describe la lógica interna que garantiza que el sistema sea exacto y no permita fugas de capital. Cada cálculo ha sido verificado para cumplir con los estándares de cobro diario y préstamo prendario/personal.
