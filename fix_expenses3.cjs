const fs = require('fs');

let expenses = fs.readFileSync('components/Expenses.tsx', 'utf8');

const replacements = [
  [/CARGAR CAPITAL INICIAL/g, "{(t as any).capitalBlock?.loadCapitalBtn || 'CARGAR CAPITAL INICIAL'}"],
  [/GASTO OPERATIVO/g, "{(t as any).capitalBlock?.expenseBtn || 'GASTO OPERATIVO'}"],
  [/>Fondo base inicial cargado<\/p>/g, ">{(t as any).capitalBlock?.mainFund || 'Fondo base inicial cargado'}</p>"],
  [/>Base \+ Cobros:<\/span>/g, ">{(t as any).capitalBlock?.basePlusCollections || 'Base + Cobros:'}</span>"],
  [/>Entregado \+ Gastos:<\/span>/g, ">{(t as any).capitalBlock?.deliveredPlusExpenses || 'Entregado + Gastos:'}</span>"],
  [/>Operaciones<\/span>/g, ">{(t as any).capitalBlock?.operations || 'Operaciones'}</span>"],
  [/>Utilidad Proyectada<\/p>/g, ">{(t as any).capitalBlock?.projectedProfit || 'Utilidad Proyectada'}</p>"],
  [/>Balance Hist.rico de Cr.ditos<\/h3>/g, ">{(t as any).capitalBlock?.historicalBalance || 'Balance Histórico de Créditos'}</h3>"],
];

for (const [regex, repl] of replacements) {
  expenses = expenses.replace(regex, repl);
}

fs.writeFileSync('components/Expenses.tsx', expenses, 'utf8');
console.log('Fixed missed translations');
