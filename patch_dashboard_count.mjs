import { readFileSync, writeFileSync } from 'fs';

const filePath = './components/Dashboard.tsx';
let content = readFileSync(filePath, 'utf8');

const oldLogic = `      const clientsMappedToLoans = new Set(assignedLoans.map(l => l.clientId || (l as any).client_id));\r
      const clientsAddedByThisCollector = clientsSafe\r
        .filter(c => c.addedBy?.toLowerCase() === uidLower)\r
        .map(c => c.id);\r
      \r
      const allClientIdsForCollector = new Set([...Array.from(clientsMappedToLoans), ...clientsAddedByThisCollector]);\r
      const totalClientsCount = allClientIdsForCollector.size;`;

const newLogic = `      // Filtrar clientes para excluir los ocultos o eliminados (igual que en Cartera)\r
      const validClients = clientsSafe.filter(c => !c.isHidden && !c.deletedAt);\r
      const validClientIdsSet = new Set(validClients.map(c => c.id));\r
\r
      const clientsMappedToLoans = new Set(\r
        assignedLoans\r
          .map(l => l.clientId || (l as any).client_id)\r
          .filter(id => validClientIdsSet.has(id))\r
      );\r
      const clientsAddedByThisCollector = validClients\r
        .filter(c => c.addedBy?.toLowerCase() === uidLower)\r
        .map(c => c.id);\r
      \r
      const allClientIdsForCollector = new Set([...Array.from(clientsMappedToLoans), ...clientsAddedByThisCollector]);\r
      const totalClientsCount = allClientIdsForCollector.size;`;

if (content.includes(oldLogic)) {
  content = content.replace(oldLogic, newLogic);
  writeFileSync(filePath, content, 'utf8');
  console.log('Fixed Dashboard logic to exclude hidden/deleted clients from total count.');
} else {
  console.log('ERROR: Could not find logic to replace in Dashboard.tsx');
  // let's try to find it with a different whitespace
  const idx = content.indexOf('clientsMappedToLoans');
  console.log('Found at:', idx);
  if (idx > -1) console.log(content.substring(idx - 100, idx + 300));
}
