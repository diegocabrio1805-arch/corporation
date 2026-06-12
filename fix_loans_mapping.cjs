const fs = require('fs');
let code = fs.readFileSync('components/Loans.tsx', 'utf8');

code = code.replace(/loans\.tableHeaders/g, 'loans.filters?.tableHeaders');
code = code.replace(/loans\.history/g, 'loans.filters?.history');

fs.writeFileSync('components/Loans.tsx', code, 'utf8');
console.log('Fixed Loans.tsx mapping');
