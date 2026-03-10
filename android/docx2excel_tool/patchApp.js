const fs = require('fs');

const file = 'c:/Users/DANIEL/Desktop/cobros/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    if (user.role === Role.COLLECTOR) {
      const myAssignedClientIds = new Set<string>();
      loans.forEach(l => {
        if ((l.collectorId || (l as any).collector_id) === user.id) myAssignedClientIds.add(l.clientId || (l as any).client_id);
      });
      clients = clients.filter(c => (c.addedBy || (c as any).added_by) === user.id || myAssignedClientIds.has(c.id));
      const visibleClientIds = new Set(clients.map(c => c.id));`;

// En vez de requerir (c.addedBy === user.id), permitimos que si el collector está buscando globalmente (o es ADMIN), todos los clientes de todos sus roles se vean.
// Pero como estamos dentro del if Role.COLLECTOR, la regla original era: Solo mis clientes.
// Lo ampliaremos a: "Añadidos por mi" O "Asignados por prestamos" O "Que yo sea el dueño según branch settings de 'Default Collector'". Todo para evitar clientes ocultos.

const repStr = `    if (user.role === Role.COLLECTOR) {
      const myAssignedClientIds = new Set<string>();
      
      // Ampliar la búsqueda de préstamos usando raw state.loans en caso de que loans locales no contenga los PAGADOS
      const allHistoricLoans = Array.isArray(state.loans) ? state.loans : [];
      allHistoricLoans.forEach(l => {
        if ((l.collectorId || (l as any).collector_id) === user.id) myAssignedClientIds.add(l.clientId || (l as any).client_id);
      });
      
      clients = clients.filter(c => 
        (c.addedBy || (c as any).added_by) === user.id || 
        myAssignedClientIds.has(c.id) ||
        // Si por alguna razón el UID del default collector de su rama matchea
        (state.settings?.defaultCollectorId && state.settings.defaultCollectorId === user.id)
      );
      const visibleClientIds = new Set(clients.map(c => c.id));`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, repStr);
    fs.writeFileSync(file, content);
    console.log("APP.TSX PARCHADO CON EXITO.");
} else {
    console.log("NO SE ENCONTRO LA CADENA EN APP.TSX.");
}
