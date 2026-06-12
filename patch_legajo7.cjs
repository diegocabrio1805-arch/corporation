const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

// Replace address
c = c.replace(
  /> \{clientInLegajo\.address\}<\/p>/g,
  "> {clientInLegajo.address === 'A COMPLETAR' ? (state.settings.language === 'fr' ? 'À COMPLÉTER' : 'A COMPLETAR') : clientInLegajo.address}</p>"
);

// Replace phone next to whatsapp
c = c.replace(
  /<\/i>\s*\{clientInLegajo\.phone\}\s*<\/button>/g,
  "</i> {clientInLegajo.phone === 'A COMPLETAR' ? (state.settings.language === 'fr' ? 'À COMPLÉTER' : 'A COMPLETAR') : clientInLegajo.phone}</button>"
);

// Replace work phone next to whatsapp if there is one
c = c.replace(
  /<\/i>\s*\{clientInLegajo\.workPhone\}\s*<\/button>/g,
  "</i> {clientInLegajo.workPhone === 'A COMPLETAR' ? (state.settings.language === 'fr' ? 'À COMPLÉTER' : 'A COMPLETAR') : clientInLegajo.workPhone}</button>"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Fixed A COMPLETAR variables!');
