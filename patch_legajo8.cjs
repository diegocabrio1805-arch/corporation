const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  /toLocaleDateString\('es-ES'/g,
  "toLocaleDateString(state.settings.language === 'fr' ? 'fr-FR' : 'es-ES'"
);

c = c.replace(
  /\} DÍAS/g,
  "} {state.settings.language === 'fr' ? 'JOURS' : 'DÍAS'}"
);

c = c.replace(
  /\|\| 'Sin observaciones adicionales\.'/g,
  "|| (state.settings.language === 'fr' ? 'Aucune observation supplémentaire.' : 'Sin observaciones adicionales.')"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Fixed dates and missing strings!');
