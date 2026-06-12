const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  />MAPA GPS:<\/span>/g,
  ">{state.settings.language === 'fr' ? 'CARTE GPS:' : 'MAPA GPS:'}</span>"
);

c = c.replace(
  /<\/i> CASA<\/button>/g,
  "</i> {state.settings.language === 'fr' ? 'MAISON' : 'CASA'}</button>"
);

c = c.replace(
  /<\/i> NEGOCIO<\/button>/g,
  "</i> {state.settings.language === 'fr' ? 'TRAVAIL' : 'NEGOCIO'}</button>"
);

c = c.replace(
  />CONTACTOS:<\/span>/g,
  ">{state.settings.language === 'fr' ? 'CONTACTS:' : 'CONTACTOS:'}</span>"
);

c = c.replace(
  /texto = 'DIARIO · PAGO DE LUNES A SÁBADO';/g,
  "texto = state.settings.language === 'fr' ? 'QUOTIDIEN · PAIEMENT LUNDI AU SAMEDI' : 'DIARIO · PAGO DE LUNES A SÁBADO';"
);

c = c.replace(
  /texto = 'DIARIO · PAGO DE LUNES A VIERNES';/g,
  "texto = state.settings.language === 'fr' ? 'QUOTIDIEN · PAIEMENT LUNDI AU VENDREDI' : 'DIARIO · PAGO DE LUNES A VIERNES';"
);

c = c.replace(
  /texto = 'QUINCENAL';/g,
  "texto = state.settings.language === 'fr' ? 'BIMENSUEL' : 'QUINCENAL';"
);

c = c.replace(
  /texto = 'MENSUAL';/g,
  "texto = state.settings.language === 'fr' ? 'MENSUEL' : 'MENSUAL';"
);

c = c.replace(
  /\{isFullyPaid \? 'Renovar Crédito' \: 'Cobrar \/ Renovación'\}/g,
  "{isFullyPaid ? (state.settings.language === 'fr' ? 'RENOUVELER CRÉDIT' : 'Renovar Crédito') : (state.settings.language === 'fr' ? 'ENCAISSER / RENOUVELLEMENT' : 'Cobrar / Renovación')}"
);

c = c.replace(
  /<\/i> REIMPRIMIR ÚLTIMO RECIBO/g,
  "</i> {state.settings.language === 'fr' ? 'RÉIMPRIMER DERNIER REÇU' : 'REIMPRIMIR ÚLTIMO RECIBO'}"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Final missing patches applied!');
