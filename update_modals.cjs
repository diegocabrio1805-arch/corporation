const fs = require('fs');

const files = [
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Clients.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\Loans.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\CollectionRoute.tsx',
  'c:\\\\Users\\\\Usuario\\\\.antigravity\\\\cobros\\\\components\\\\MobileCollectorMode.tsx'
];

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  
  content = content.replace(/>Vista de Comprobante</g, `>{((t as any).receipt?.viewTitle) || 'VISTA DE COMPROBANTE'}<`);
  content = content.replace(/>¡GESTIÓN EXITOSA!</g, `>{((t as any).receipt?.successMsg) || '¡GESTIÓN EXITOSA!'}<`);
  content = content.replace(/>Finalizar y Salir</g, `>{((t as any).receipt?.finish) || 'Finalizar y Salir'}<`);
  content = content.replace(/>RE-IMPRIMIR TICKET</g, `>{((t as any).receipt?.reprint) || 'RE-IMPRIMIR TICKET'}<`);
  content = content.replace(/>ENVIAR POR WHATSAPP \(PDF\)</g, `>{((t as any).receipt?.sendWhatsapp) || 'ENVIAR POR WHATSAPP (PDF)'}<`);
  content = content.replace(/>ENVIAR FOTO DE RECIBO</g, `>{((t as any).receipt?.sendPhoto) || 'ENVIAR FOTO DE RECIBO'}<`);
  
  fs.writeFileSync(file, content);
});
console.log('Modals updated');
