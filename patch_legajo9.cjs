const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  /I\. Datos del Cliente/g,
  "{state.settings.language === 'fr' ? 'I. DONNÉES DU CLIENT' : 'I. Datos del Cliente'}"
);
c = c.replace(
  />Nro Operación<\/div>/g,
  ">{state.settings.language === 'fr' ? 'N° OPÉRATION' : 'Nro Operación'}</div>"
);
c = c.replace(
  />Dirección<\/div>/g,
  ">{state.settings.language === 'fr' ? 'ADRESSE' : 'Dirección'}</div>"
);
c = c.replace(
  />Particular Ciudad<\/div>/g,
  ">{state.settings.language === 'fr' ? 'DOMICILE VILLE' : 'Particular Ciudad'}</div>"
);
c = c.replace(
  />Barrio Part\.<\/div>/g,
  ">{state.settings.language === 'fr' ? 'QUARTIER DOM.' : 'Barrio Part.'}</div>"
);
c = c.replace(
  /II\. Datos Laborales/g,
  "{state.settings.language === 'fr' ? 'II. DONNÉES PROFESSIONNELLES' : 'II. Datos Laborales'}"
);
c = c.replace(
  />Cargo<\/div>/g,
  ">{state.settings.language === 'fr' ? 'POSTE' : 'Cargo'}</div>"
);
c = c.replace(
  />Salario<\/div>/g,
  ">{state.settings.language === 'fr' ? 'SALAIRE' : 'Salario'}</div>"
);
c = c.replace(
  />Teléf\. Laboral<\/div>/g,
  ">{state.settings.language === 'fr' ? 'TÉL. TRAVAIL' : 'Teléf. Laboral'}</div>"
);
c = c.replace(
  />Dirección Lab\.<\/div>/g,
  ">{state.settings.language === 'fr' ? 'ADRESSE TRAVAIL' : 'Dirección Lab.'}</div>"
);
c = c.replace(
  /II\. Ubicación GPS/g,
  "{state.settings.language === 'fr' ? 'II. LOCALISATION GPS' : 'II. Ubicación GPS'}"
);
c = c.replace(
  /\} Capturar Casa/g,
  "} {state.settings.language === 'fr' ? 'CAPTURER MAISON' : 'Capturar Casa'}"
);
c = c.replace(
  /\} Capturar Negocio/g,
  "} {state.settings.language === 'fr' ? 'CAPTURER TRAVAIL' : 'Capturar Negocio'}"
);
c = c.replace(
  /\{state\.settings\.language === 'fr' \? 'Éditer ' : 'Editar '\}Ubicación/g,
  "{state.settings.language === 'fr' ? 'ÉDITER LOCALISATION' : 'EDITAR UBICACIÓN'}"
);
c = c.replace(
  />PERMITIR A COBRADOR ACTUALIZAR GPS<\/span>/g,
  ">{state.settings.language === 'fr' ? 'AUTORISER LE COLLECTEUR À METTRE À JOUR LE GPS' : 'PERMITIR A COBRADOR ACTUALIZAR GPS'}</span>"
);
c = c.replace(
  /IV\. Editar Crédito Activo/g,
  "{state.settings.language === 'fr' ? 'IV. ÉDITER CRÉDIT ACTIF' : 'IV. Editar Crédito Activo'}"
);
c = c.replace(
  />Monto<\/div>/g,
  ">{state.settings.language === 'fr' ? 'MONTANT' : 'Monto'}</div>"
);
c = c.replace(
  />Cuotas<\/div>/g,
  ">{state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'Cuotas'}</div>"
);
c = c.replace(
  />Inicio<\/div>/g,
  ">{state.settings.language === 'fr' ? 'DÉBUT' : 'Inicio'}</div>"
);
c = c.replace(
  />Frecuencia<\/div>/g,
  ">{state.settings.language === 'fr' ? 'FRÉQUENCE' : 'Frecuencia'}</div>"
);
c = c.replace(
  />SEMANAL<\/option>/g,
  ">{state.settings.language === 'fr' ? 'HEBDOMADAIRE' : 'SEMANAL'}</option>"
);
c = c.replace(
  />\* Editar estos valores recalculará todo el cronograma\.<\/span>/g,
  ">{state.settings.language === 'fr' ? '* L\\'édition de ces valeurs recalculera tout le calendrier.' : '* Editar estos valores recalculará todo el cronograma.'}</span>"
);
c = c.replace(
  /III\. Documentación Fotográfica/g,
  "{state.settings.language === 'fr' ? 'III. DOCUMENTATION PHOTOGRAPHIQUE' : 'III. Documentación Fotográfica'}"
);
c = c.replace(
  /'GUARDAR TODOS LOS CAMBIOS'\}/g,
  "(state.settings.language === 'fr' ? 'ENREGISTRER TOUS LES CHANGEMENTS' : 'GUARDAR TODOS LOS CAMBIOS')}"
);

c = c.replace(
  /texto = `\{state\.settings\.language === 'fr' \? 'HEBDOMADAIRE · ' \: 'SEMANAL · '\}\{state\.settings\.language === 'fr' \? 'PAIEMENT LES ' \: 'PAGO LOS '\}\$\{diaSemana\}`/g,
  "texto = state.settings.language === 'fr' ? `HEBDOMADAIRE · PAIEMENT LES ${FR_DIAS[startDate.getDay()]}` : `SEMANAL · PAGO LOS ${diaSemana}`"
);

c = c.replace(
  /`\{state\.settings\.language === 'fr' \? 'HEBDOMADAIRE · ' \: 'SEMANAL · '\}\{state\.settings\.language === 'fr' \? 'PAIEMENT LES ' \: 'PAGO LOS '\}\$\{diaSemana\}`/g,
  "(state.settings.language === 'fr' ? `HEBDOMADAIRE · PAIEMENT LES ${FR_DIAS[startDate.getDay()]}` : `SEMANAL · PAGO LOS ${diaSemana}`)"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Finished Edit modal patches!');
