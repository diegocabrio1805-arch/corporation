const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(/doc\.text\(\(\(t as any\)\.clients\.list\?\.thClientId \|\| "CLIENTE \/ ID"\)\.toUpperCase\(\), margin \+ 2, y \+ 5\.5\);/g, "doc.text(state.settings.language === 'fr' ? 'CLIENT / ID' : 'CLIENTE / ID', margin + 2, y + 5.5);");
c = c.replace(/doc\.text\("TELÉFONO", margin \+ 35, y \+ 5\.5\);/g, "doc.text(state.settings.language === 'fr' ? 'TÉLÉPHONE' : 'TELÉFONO', margin + 35, y + 5.5);");
c = c.replace(/doc\.text\("HABILITADO", margin \+ 65, y \+ 5\.5, \{ align: 'right' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'APPROUVÉ' : 'HABILITADO', margin + 65, y + 5.5, { align: 'right' });");
c = c.replace(/doc\.text\("V\. CUOTA", margin \+ 85, y \+ 5\.5, \{ align: 'right' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'V. MENS.' : 'V. CUOTA', margin + 85, y + 5.5, { align: 'right' });");
c = c.replace(/doc\.text\("MONTO", margin \+ 105, y \+ 5\.5, \{ align: 'right' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'MONTANT' : 'MONTO', margin + 105, y + 5.5, { align: 'right' });");
c = c.replace(/doc\.text\("COBRADO", margin \+ 125, y \+ 5\.5, \{ align: 'right' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'RECOUVRÉ' : 'COBRADO', margin + 125, y + 5.5, { align: 'right' });");
c = c.replace(/doc\.text\("SALDO", margin \+ 145, y \+ 5\.5, \{ align: 'right' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'SOLDE' : 'SALDO', margin + 145, y + 5.5, { align: 'right' });");
c = c.replace(/doc\.text\("CTAS", margin \+ 160, y \+ 5\.5, \{ align: 'center' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'MENS.' : 'CTAS', margin + 160, y + 5.5, { align: 'center' });");
c = c.replace(/doc\.text\("PAG\.", margin \+ 175, y \+ 5\.5, \{ align: 'center' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'PAYÉ' : 'PAG.', margin + 175, y + 5.5, { align: 'center' });");
c = c.replace(/doc\.text\("MORA", margin \+ 188, y \+ 5\.5, \{ align: 'center' \}\);/g, "doc.text(state.settings.language === 'fr' ? 'RETARD' : 'MORA', margin + 188, y + 5.5, { align: 'center' });");

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Patched PDF headers in Clients.tsx');
