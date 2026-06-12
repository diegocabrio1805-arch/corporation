const fs = require('fs');

let expenses = fs.readFileSync('components/Expenses.tsx', 'utf8');

expenses = expenses.replace(
  /d\.toLocaleString\('es-ES'/g,
  "d.toLocaleString(state.settings.language || 'es'"
);

fs.writeFileSync('components/Expenses.tsx', expenses, 'utf8');
console.log('Fixed month translations');
