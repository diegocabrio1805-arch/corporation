import { readFileSync, writeFileSync } from 'fs';

let content = readFileSync('components/Clients.tsx', 'utf8');

const isFr = "state.settings.language === 'fr'";
const isPt = "state.settings.language === 'pt'";

const replacements = [
  // 1. Título "Modificar Expediente Completo"
  [
    `>Modificar Expediente Completo</h4>`,
    `>{${isFr} ? 'MODIFIER DOSSIER COMPLET' : ${isPt} ? 'MODIFICAR FICHA COMPLETA' : 'Modificar Expediente Completo'}</h4>`
  ],
  // 2. Placeholder "SOLO NÚMEROS"
  [
    `placeholder="SOLO NÚMEROS"`,
    `placeholder={${isFr} ? 'CHIFFRES SEULEMENT' : ${isPt} ? 'SOMENTE NÚMEROS' : 'SOLO NÚMEROS'}`
  ],
  // 3. "Coordenadas Manuales" (casa)
  [
    `>Coordenadas Manuales</div>\n                                     <div \n                                       onClick={() => {\n                                         const input = window.prompt("Ingresar coordenadas CASA (lat, lng):");`,
    `>{${isFr} ? 'COORDONNÉES MANUELLES' : ${isPt} ? 'COORDENADAS MANUAIS' : 'Coordenadas Manuales'}</div>\n                                     <div \n                                       onClick={() => {\n                                         const input = window.prompt(${isFr} ? "Saisir coordonnées MAISON (lat, lng):" : "Ingresar coordenadas CASA (lat, lng):");`
  ],
  // 4. "INGRESAR" botón casa
  [
    `<i className="fa-solid fa-keyboard mr-1"></i> INGRESAR\n                                     </div>\n                                   </div>\n                                 )}\n                               </div>\n                               <div className="space-y-2">\n                                 <button type="button" onClick={() => handleCaptureLocation('domicilio'`,
    `<i className="fa-solid fa-keyboard mr-1"></i> {${isFr} ? 'SAISIR' : ${isPt} ? 'INSERIR' : 'INGRESAR'}\n                                     </div>\n                                   </div>\n                                 )}\n                               </div>\n                               <div className="space-y-2">\n                                 <button type="button" onClick={() => handleCaptureLocation('domicilio'`
  ],
  // 5. "Coordenadas Manuales" (negocio)
  [
    `>Coordenadas Manuales</div>\n                                     <div \n                                       onClick={() => {\n                                         const input = window.prompt("Ingresar coordenadas NEGOCIO (lat, lng):");`,
    `>{${isFr} ? 'COORDONNÉES MANUELLES' : ${isPt} ? 'COORDENADAS MANUAIS' : 'Coordenadas Manuales'}</div>\n                                     <div \n                                       onClick={() => {\n                                         const input = window.prompt(${isFr} ? "Saisir coordonnées TRAVAIL (lat, lng):" : "Ingresar coordenadas NEGOCIO (lat, lng):");`
  ],
  // 6. "INGRESAR" botón negocio
  [
    `<i className="fa-solid fa-keyboard mr-1"></i> INGRESAR\n                                     </div>\n                                   </div>\n                                 )}\n                               </div>\n                             </div>\n                             <div className="flex items-center gap-2 pt-2">`,
    `<i className="fa-solid fa-keyboard mr-1"></i> {${isFr} ? 'SAISIR' : ${isPt} ? 'INSERIR' : 'INGRESAR'}\n                                     </div>\n                                   </div>\n                                 )}\n                               </div>\n                             </div>\n                             <div className="flex items-center gap-2 pt-2">`
  ],
  // 7. "Permitir a Cobrador actualizar GPS"
  [
    `>Permitir a Cobrador actualizar GPS</span>`,
    `>{${isFr} ? 'AUTORISER LE COLLECTEUR À METTRE À JOUR LE GPS' : ${isPt} ? 'PERMITIR COBRADOR ATUALIZAR GPS' : 'Permitir a Cobrador actualizar GPS'}</span>`
  ],
];

let patched = 0;
for (const [oldStr, newStr] of replacements) {
  // Normalize line endings for comparison
  const normalizedOld = oldStr.replace(/\r\n/g, '\n');
  const normalizedContent = content.replace(/\r\n/g, '\n');
  
  if (normalizedContent.includes(normalizedOld)) {
    content = content.replace(/\r\n/g, '\n').replace(normalizedOld, newStr);
    // Restore \r\n if needed (keep as \n for TSX)
    console.log(`✅ Replaced: ${oldStr.substring(0, 60).replace(/\n/g,' ')}...`);
    patched++;
  } else {
    console.warn(`⚠️  Not found: ${oldStr.substring(0, 80).replace(/\n/g,' ')}`);
  }
}

writeFileSync('components/Clients.tsx', content, 'utf8');
console.log(`\nDone. ${patched}/${replacements.length} replacements applied.`);
