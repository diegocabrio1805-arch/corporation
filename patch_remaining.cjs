const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
    /CRÉD\. TERMINÉS<\/h2>\s*<p className="text-\[10px\] text-slate-400 font-bold tracking-widest">\s*\{terminadosExcelData\.length\} CRÉDITOS\s*<\/p>/g,
    'CRÉD. TERMINÉS</h2>\n                      <p className="text-[10px] text-slate-400 font-bold tracking-widest">\n                        {terminadosExcelData.length} {state.settings.language === \'fr\' ? \'CRÉDITS\' : \'CRÉDITOS\'}\n                      </p>'
);

c = c.replace(
    /\{client\._metrics\.installmentsStr \|\| '--'\}/g,
    '{client._metrics.installmentsStr ? client._metrics.installmentsStr.replace("cuotas", state.settings.language === "fr" ? "ÉCHÉANCES" : "cuotas") : "--"}'
);

c = c.replace(
    /\{client\._metrics\.installmentsStr \|\| '---'\}/g,
    '{client._metrics.installmentsStr ? client._metrics.installmentsStr.replace("cuotas", state.settings.language === "fr" ? "ÉCHÉANCES" : "cuotas") : "---"}'
);

c = c.replace(
    /\{\(t as any\)\.clients\.list\?\.btnActive \? '● ' \+ \(t as any\)\.clients\.list\.btnActive \: '● ACTIVO'\) \: '● INACTIVO'\}/g,
    '{(t as any).clients.list?.btnActive ? \'● \' + (t as any).clients.list.btnActive : \'● ACTIVO\') : (state.settings.language === \'fr\' ? \'● INACTIF\' : \'● INACTIVO\')}'
);

c = c.replace(
    /No hay clientes ocultos/g,
    '{state.settings.language === \'fr\' ? \'AUCUN CLIENT CACHÉ\' : \'No hay clientes ocultos\'}'
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Patched terminados and ocultos text in Clients.tsx');
