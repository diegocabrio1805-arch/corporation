const fs = require('fs');

// First update translations.ts
let translations = fs.readFileSync('utils/translations.ts', 'utf8');

const newStrings = {
  es: {
    pendingArrears: "Mora Pendiente",
    newCreditsFull: "Créditos Nuevos",
    confirmExpense: "Confirmar Salida"
  },
  en: {
    pendingArrears: "Pending Arrears",
    newCreditsFull: "New Credits",
    confirmExpense: "Confirm Expense"
  },
  pt: {
    pendingArrears: "Atraso Pendente",
    newCreditsFull: "Novos Créditos",
    confirmExpense: "Confirmar Saída"
  },
  fr: {
    pendingArrears: "Retard en cours",
    newCreditsFull: "Nouveaux Crédits",
    confirmExpense: "Confirmer la Dépense"
  }
};

const langs = ['es', 'en', 'pt', 'fr'];
for (const lang of langs) {
  const langIndex = translations.indexOf(`  ${lang}: {`);
  if (langIndex !== -1) {
    const capitalBlockIndex = translations.indexOf(`    capitalBlock: {`, langIndex);
    if (capitalBlockIndex !== -1) {
      const nextLineIndex = translations.indexOf(`\n`, capitalBlockIndex);
      let add = ``;
      for (const [k, v] of Object.entries(newStrings[lang])) {
        add += `\n      ${k}: "${v}",`;
      }
      translations = translations.slice(0, nextLineIndex) + add + translations.slice(nextLineIndex);
    }
  }
}
fs.writeFileSync('utils/translations.ts', translations, 'utf8');


// Second update Expenses.tsx
let expenses = fs.readFileSync('components/Expenses.tsx', 'utf8');

expenses = expenses.replace(
  /name="CR.DITOS NUEVOS"/g,
  "name={(t as any).capitalBlock?.newCreditsFull?.toUpperCase() || 'CRÉDITOS NUEVOS'}"
);

expenses = expenses.replace(
  /name="MORA PENDIENTE"/g,
  "name={(t as any).capitalBlock?.pendingArrears?.toUpperCase() || 'MORA PENDIENTE'}"
);

expenses = expenses.replace(
  /name="RENOVACIONES"/g,
  "name={(t as any).capitalBlock?.renewals?.toUpperCase() || 'RENOVACIONES'}"
);

expenses = expenses.replace(
  /name="UTILIDAD PROYECTADA"/g,
  "name={(t as any).capitalBlock?.projectedProfit?.toUpperCase() || 'UTILIDAD PROYECTADA'}"
);

expenses = expenses.replace(
  />CONFIRMAR SALIDA<\/button>/g,
  ">{(t as any).capitalBlock?.confirmExpense?.toUpperCase() || 'CONFIRMAR SALIDA'}</button>"
);

fs.writeFileSync('components/Expenses.tsx', expenses, 'utf8');

console.log('Tooltip data translated.');
