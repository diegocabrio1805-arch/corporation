import { readFileSync, writeFileSync } from 'fs';

let c = readFileSync('components/Clients.tsx', 'utf8');
const lang = `state.settings.language`;

// Fix "Coordenadas Manuales" (both occurrences - emerald and blue versions)
c = c.replace(
  `>Coordenadas Manuales</div>`,
  `>{${lang} === 'fr' ? 'COORDONN\u00c9ES MANUELLES' : ${lang} === 'pt' ? 'COORDENADAS MANUAIS' : 'COORDENADAS MANUALES'}</div>`
);
// Second occurrence (blue - negocio)
c = c.replace(
  `>Coordenadas Manuales</div>`,
  `>{${lang} === 'fr' ? 'COORDONN\u00c9ES MANUELLES' : ${lang} === 'pt' ? 'COORDENADAS MANUAIS' : 'COORDENADAS MANUALES'}</div>`
);

// Fix "INGRESAR" button text (both occurrences)
c = c.replace(
  /(<i className="fa-solid fa-keyboard mr-1"><\/i>) INGRESAR\r?\n(\s*<\/div>)/g,
  `$1 {${lang} === 'fr' ? 'SAISIR' : ${lang} === 'pt' ? 'INSERIR' : 'INGRESAR'}\n$2`
);

// Fix "Subir Imagen" - should already be handled but just in case
c = c.replace(/Subir Imagen(?!<\/span>)/g, '');  // safety net - remove any rogue ones

// Fix window.prompt texts for GPS coords
c = c.replace(
  `"Ingresar coordenadas CASA (lat, lng):")`,
  `(${lang} === 'fr' ? "Saisir coordonn\u00e9es MAISON (lat, lng):" : "Ingresar coordenadas CASA (lat, lng):"))`
);
c = c.replace(
  `"Ingresar coordenadas NEGOCIO (lat, lng):")`,
  `(${lang} === 'fr' ? "Saisir coordonn\u00e9es TRAVAIL (lat, lng):" : "Ingresar coordenadas NEGOCIO (lat, lng):"))`
);

writeFileSync('components/Clients.tsx', c, 'utf8');

// Verify
const result = readFileSync('components/Clients.tsx', 'utf8');
const coordCount = (result.match(/COORDONN\u00c9ES MANUELLES/g) || []).length;
const saisirCount = (result.match(/SAISIR/g) || []).length;
const remainManual = (result.match(/Coordenadas Manuales/g) || []).length;
const remainIngresar = (result.match(/> INGRESAR\n/g) || []).length;

console.log(`COORDONNÉES MANUELLES translated: ${coordCount} times`);
console.log(`SAISIR translated: ${saisirCount} times`);
console.log(`Remaining untranslated "Coordenadas Manuales": ${remainManual}`);
console.log(`Remaining untranslated "INGRESAR": ${remainIngresar}`);
