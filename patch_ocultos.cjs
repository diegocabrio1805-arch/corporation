const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx','utf8');
c = c.replace(/<th className="px-6 py-4">Fecha Reg\.<\/th>/g, "<th className=\"px-6 py-4\">{((t as any).clients.list?.thRegDateFull || 'Fecha Reg.')}</th>");
c = c.replace(/<th className="px-6 py-4 text-right">Saldo<\/th>/g, "<th className=\"px-6 py-4 text-right\">{((t as any).clients.list?.balance || 'Saldo')}</th>");
fs.writeFileSync('components/Clients.tsx',c,'utf8');
console.log('Fixed Ocultos translations');
