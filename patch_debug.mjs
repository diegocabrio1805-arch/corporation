import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Dashboard.tsx';
let content = readFileSync(filePath, 'utf8');

const target = `{/* AUDITORÍA DE RUTAS - Premium Table */}`;
const debugCode = `      {/* DEBUG BANNER FOR FABIAN */}
      {isAdmin && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl mb-6">
          <h4 className="text-red-700 font-bold mb-2">DEBUG: Clientes en Dashboard vs Cartera (FABIAN ARRUA2)</h4>
          <ul className="text-xs text-red-600 font-mono list-disc pl-4">
            {collectorStats.filter(s => s.name.toUpperCase().includes('FABIAN ARRUA2')).map(stat => {
              // Recalculate Dashboard logic
              const uidLower = stat.id.toLowerCase();
              const validClients = (Array.isArray(state.clients) ? state.clients : []).filter(c => !c.isHidden && !c.deletedAt);
              const validClientIdsSet = new Set(validClients.map(c => c.id));
              
              const assignedLoans = (Array.isArray(state.loans) ? state.loans : []).filter(l => (l.collectorId?.toLowerCase() === uidLower || (l as any).collector_id?.toLowerCase() === uidLower));
              const clientsMappedToLoans = new Set(assignedLoans.map(l => l.clientId || (l as any).client_id).filter(id => validClientIdsSet.has(id)));
              const clientsAddedByThisCollector = validClients.filter(c => c.addedBy?.toLowerCase() === uidLower).map(c => c.id);
              
              const dashIds = new Set([...Array.from(clientsMappedToLoans), ...clientsAddedByThisCollector]);
              
              // Recalculate Cartera logic
              const carteraIds = new Set(validClients.filter(c => {
                const addedByLower = (c.addedBy || (c as any).added_by || '').toLowerCase();
                const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.status === 'ACTIVE' || l.status === 'DEFAULT'));
                const loanCollectorId = (activeLoan?.collectorId || (activeLoan as any)?.collector_id)?.toLowerCase();
                const anyHistoricLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => (l.clientId || (l as any).client_id) === c.id && (l.collectorId || (l as any).collector_id)?.toLowerCase() === uidLower);
                return addedByLower === uidLower || loanCollectorId === uidLower || !!anyHistoricLoan;
              }).map(c => c.id));

              const missingIds = Array.from(dashIds).filter(id => !carteraIds.has(id));
              const missingInDash = Array.from(carteraIds).filter(id => !dashIds.has(id));

              return (
                <div key={stat.id}>
                  <li>Dashboard Count: {dashIds.size}</li>
                  <li>Cartera Count: {carteraIds.size}</li>
                  <li>Faltan en Cartera ({missingIds.length}): {missingIds.map(id => {
                    const c = validClients.find(client => client.id === id);
                    return c ? c.name : id;
                  }).join(', ')}</li>
                  <li>Faltan en Dashboard ({missingInDash.length}): {missingInDash.map(id => {
                    const c = validClients.find(client => client.id === id);
                    return c ? c.name : id;
                  }).join(', ')}</li>
                </div>
              );
            })}
          </ul>
        </div>
      )}
      {/* AUDITORÍA DE RUTAS - Premium Table */}`;

if (content.includes(target) && !content.includes('DEBUG: Clientes en Dashboard')) {
  content = content.replace(target, debugCode);
  writeFileSync(filePath, content, 'utf8');
  console.log('Injected debug banner');
} else {
  console.log('Failed to inject or already injected');
}
