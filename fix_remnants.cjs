const fs = require('fs');

// 1. UPDATE TRANSLATIONS
const tFile = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\translations.ts';
let tContent = fs.readFileSync(tFile, 'utf8');

tContent = tContent.replace(/balance: 'SALDO',/g, `balance: 'SALDO',\n      publicPhone: 'TEL. PUBLICO',\n      companyId: 'ID EMPRESA',\n      account: 'CUENTA',`);
tContent = tContent.replace(/balance: 'BALANCE',/g, `balance: 'BALANCE',\n      publicPhone: 'PUBLIC PHONE',\n      companyId: 'COMPANY ID',\n      account: 'ACCOUNT',`);
tContent = tContent.replace(/balance: 'SOLDE',/g, `balance: 'SOLDE',\n      publicPhone: 'TÉL. PUBLIC',\n      companyId: 'ID ENTREPRISE',\n      account: 'COMPTE',`);
tContent = tContent.replace(/balance: 'SALDO',/g, `balance: 'SALDO',\n      publicPhone: 'TEL. PÚBLICO',\n      companyId: 'ID EMPRESA',\n      account: 'CONTA',`);

fs.writeFileSync(tFile, tContent);

// 2. UPDATE HELPERS.TS
const hFile = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\helpers.ts';
let hContent = fs.readFileSync(hFile, 'utf8');

// Replace contactLabel fallback
hContent = hContent.replace(
  /const contactLabel = \(data\.contactLabelManual \|\| ''\)\.trim\(\) \? data\.contactLabelManual : "TEL\. PUBLICO";/g,
  `const contactLabel = (data.contactLabelManual || '').trim() ? data.contactLabelManual : (t.receipt?.publicPhone || "TEL. PUBLICO");`
);

// Replace idLabel fallback
hContent = hContent.replace(
  /const idLabel = \(data\.companyIdentifierLabelManual \|\| ''\)\.trim\(\) \? data\.companyIdentifierLabelManual : \(t\.receipt\?\.accountState \|\| "ESTADO DE CUENTA"\);/g,
  `let rawIdLabel = (data.companyIdentifierLabelManual || '').trim();
  if (rawIdLabel === 'ID EMPRESA') rawIdLabel = t.receipt?.companyId || 'ID EMPRESA';
  const idLabel = rawIdLabel ? rawIdLabel : (t.receipt?.accountState || "ESTADO DE CUENTA");`
);

// Replace shareLabel fallback
hContent = hContent.replace(
  /const bankLabel = \(rawManualShareLabel \? rawManualShareLabel : \(settings\.shareLabel \|\| \(t\.receipt\?\.bank \|\| 'BANCO'\)\)\)\.toUpperCase\(\);/g,
  `let shareFallback = settings.shareLabel || (t.receipt?.bank || 'BANCO');
  if (shareFallback.toUpperCase() === 'CUENTA') shareFallback = t.receipt?.account || 'CUENTA';
  if (rawManualShareLabel && rawManualShareLabel.toUpperCase() === 'CUENTA') rawManualShareLabel = t.receipt?.account || 'CUENTA';
  const bankLabel = (rawManualShareLabel ? rawManualShareLabel : shareFallback).toUpperCase();`
);

fs.writeFileSync(hFile, hContent);

// 3. UPDATE COMPONENTS (Loans, Clients, CollectionRoute, MobileCollectorMode)
const files = [
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Clients.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Loans.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\CollectionRoute.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\MobileCollectorMode.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Fix buttons that have spaces around them
  content = content.replace(
    />\s*Finalizar y Salir\s*</g,
    `>{((t as any).receipt?.finish) || 'Finalizar y Salir'}<`
  );

  content = content.replace(
    /<\/i>\s*Re-Imprimir Ticket/g,
    `</i> {((t as any).receipt?.reprint) || 'Re-Imprimir Ticket'}`
  );

  // In the editor UI, there are some "TEL. PUBLICO" and "ID EMPRESA" text in inputs
  content = content.replace(
    /value={editingReceipt\.contactLabelManual \?\? "TEL\. PUBLICO"}/g,
    `value={editingReceipt.contactLabelManual ?? ((t as any).receipt?.publicPhone || "TEL. PUBLICO")}`
  );
  content = content.replace(
    /value={editingReceipt\.companyIdentifierLabelManual \?\? "ID EMPRESA"}/g,
    `value={editingReceipt.companyIdentifierLabelManual ?? ((t as any).receipt?.companyId || "ID EMPRESA")}`
  );

  fs.writeFileSync(file, content);
});

console.log('Remnants fixed successfully!');
