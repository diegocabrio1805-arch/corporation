const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
    /\{finalizadosData\.length\} CRÉDITO\{finalizadosData\.length \!\=\= 1 \? 'S' : ''\}/g,
    "{finalizadosData.length} {state.settings.language === 'fr' ? (finalizadosData.length !== 1 ? 'CRÉDITS' : 'CRÉDIT') : (finalizadosData.length !== 1 ? 'CRÉDITOS' : 'CRÉDITO')}"
);

c = c.replace(
    /\{loan\.totalInstallments\} CUOTAS/g,
    "{loan.totalInstallments} {state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'CUOTAS'}"
);

c = c.replace(
    /\{\(\(t as any\)\.clients\.list\?\.thTotal \|\| 'Total'\)\}/g,
    "{state.settings.language === 'fr' ? 'TOTAL' : 'Total'}"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Patched final missing texts in Clients.tsx');
