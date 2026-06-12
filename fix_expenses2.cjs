const fs = require('fs');

let expenses = fs.readFileSync('components/Expenses.tsx', 'utf8');

expenses = expenses.replace(/t\?\./g, "(t as any).capitalBlock?.");

fs.writeFileSync('components/Expenses.tsx', expenses, 'utf8');
console.log('Fixed Expenses.tsx typing');
