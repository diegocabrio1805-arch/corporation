const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
    /\{hasActiveLoan \? \(\(t as any\)\.clients\.list\?\.btnActive \? '● ' \+ \(t as any\)\.clients\.list\.btnActive \: '● ACTIVO'\) \: '● INACTIVO'\}/g,
    "{hasActiveLoan ? ((t as any).clients.list?.btnActive ? '● ' + (t as any).clients.list.btnActive : '● ACTIVO') : (state.settings.language === 'fr' ? '● INACTIF' : '● INACTIVO')}"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Patched INACTIVO in Clients.tsx');
