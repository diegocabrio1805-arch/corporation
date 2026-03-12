# Solución: Cuotas Pagadas de Excel no se muestran en Cartera (Progreso 0/X)

## Descripción del Problema
Al importar un archivo Excel de clientes (por ejemplo, "prueba excel"), la consola de la aplicación detectaba correctamente cuántas cuotas estaban pagadas según la lógica matemática insertada en la versión v2.4 (Ej: `[MATH FORENSIC v2.4] Pendientes=36 | Pagadas=8`). 

Sin embargo, en la interfaz visual de la Cartera General, las tarjetas de los clientes mostraban un progreso de `0/X` cuotas pagadas, calculando erróneamente el saldo atrasado.

## Causa Raíz
El problema radicaba en cómo el archivo `utils/excelHelper.ts` convertía ese número de "cuotas pagadas" importadas en un registro histórico para la base de datos:
1. Para cuadrar los saldos, el importador creaba un "recibo de pago falso" (un log) equivalente a todo lo que el cliente ya había pagado en la vida real.
2. A ese log se le ponía la etiqueta interna `isOpening: true` y el tipo `type: 'ARRASTRE'`.
3. El motor de cálculos de la vista de Cartera (`utils/helpers.ts`) tiene una regla de seguridad que **ignora** y esconde cualquier pago que tenga `isOpening: true` o no sea de tipo explícito `'PAGO' / PAYMENT`, asumiendo que es dinero de desembolso inicial y no una cuota real cobrada.
4. Consecuencia: El motor descartaba ese recibo histórico importado y creía que el cliente nunca había pagado ninguna cuota real.

## La Solución Aplicada
En `utils/excelHelper.ts`, alrededor de la línea 460-470 (en el bloque `5. GENERAR LOG HISTÓRICO "RECONSTRUIDO"`), se modificó la forma en que se crea este log artificial de arrastre.

**Código Anterior (Fallido):**
```typescript
type: 'ARRASTRE' as CollectionLogType,
isOpening: true,
```

**Código Nuevo (Exitoso):**
```typescript
type: CollectionLogType.PAYMENT,
isOpening: false, 
notes: "Pago histórico importado (Ajuste de Saldo)",
```

Al hacer esto, el sistema pasó a reconocer ese saldo anterior como un pago válido y legítimo de cuotas, normalizando así el indicador visual (ej: "8/44").

---

## 🤖 Prompt de Rescate (Para ejecutar si el problema regresa)
Si en el futuro se sobrescribe el archivo o vuelve a suceder que al importar de Excel se muestran "0 cuotas pagadas", copia y pega el siguiente prompt a la Inteligencia Artificial:

> **PROMPT DE RESCATE PARA LA IA:**
> "El sistema de importación de Excel está fallando de nuevo al mostrar las cuotas pagadas en la UI (Progreso muestra 0/X). Ve al archivo `utils/excelHelper.ts`, ubica el bloque donde se genera el log histórico reconstruido (busca `logAmount > 0` y `logs.push`) y asegúrate de reemplazar el `type: 'ARRASTRE'` y el `isOpening: true`. 
> 
> Tienes que cambiarlo para que obligatoriamente el log insertado al hacer 'push' tenga:
> `type: CollectionLogType.PAYMENT`
> `isOpening: false`
> `notes: "Pago histórico importado (Ajuste de Saldo)"`
> 
> Esto permitirá que la función de métricas en `utils/helpers.ts` valide este registro importado como un pago real y cuente correctamente las cuotas en la vista general."
