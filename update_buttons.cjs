const fs = require('fs');

// Update UI Files
const files = [
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Clients.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Loans.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\CollectionRoute.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\MobileCollectorMode.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');

  // Regex replacements for varying cases
  content = content.replace(/>¡Gestión Exitosa!</gi, `>{((t as any).receipt?.successMsg) || '¡Gestión Exitosa!'}<`);
  content = content.replace(/>Finalizar y Salir</gi, `>{((t as any).receipt?.finish) || 'Finalizar y Salir'}<`);
  content = content.replace(/>Re-Imprimir Ticket</gi, `>{((t as any).receipt?.reprint) || 'Re-Imprimir Ticket'}<`);

  content = content.replace(/'GENERANDO PDF\.\.\.'/g, `((t as any).receipt?.generatingPdf || 'GENERANDO PDF...')`);
  content = content.replace(/'Enviar por WhatsApp \(PDF\)'/gi, `((t as any).receipt?.sendWhatsapp || 'Enviar por WhatsApp (PDF)')`);
  
  content = content.replace(/'GENERANDO FOTO\.\.\.'/g, `((t as any).receipt?.generatingPhoto || 'GENERANDO FOTO...')`);
  content = content.replace(/'ENVIAR FOTO DE RECIBO'/gi, `((t as any).receipt?.sendPhoto || 'ENVIAR FOTO DE RECIBO')`);

  fs.writeFileSync(file, content);
});

// Update Translations
const tFile = 'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\utils\\\\translations.ts';
let tContent = fs.readFileSync(tFile, 'utf8');

tContent = tContent.replace(/balance: 'SALDO'/g, `balance: 'SALDO',\n      generatingPdf: 'GENERANDO PDF...',\n      generatingPhoto: 'GENERANDO FOTO...'`);
tContent = tContent.replace(/balance: 'BALANCE'/g, `balance: 'BALANCE',\n      generatingPdf: 'GENERATING PDF...',\n      generatingPhoto: 'GENERATING PHOTO...'`);
tContent = tContent.replace(/balance: 'SOLDE'/g, `balance: 'SOLDE',\n      generatingPdf: 'GÉNÉRATION PDF...',\n      generatingPhoto: 'GÉNÉRATION PHOTO...'`);

fs.writeFileSync(tFile, tContent);
console.log('Buttons translated successfully.');
