const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

const regexReplacements = [
  ['Nacionalidad', 'NATIONALITÉ'],
  ['F. Nacimiento', 'DATE DE NAISSANCE'],
  ['Estado Civil', 'ÉTAT CIVIL'],
  ['Profesión', 'PROFESSION'],
  ['Email', 'E-MAIL'],
  ['Clasific.', 'CLASSIFIC.'],
  ['Tipo Cliente', 'TYPE CLIENT'],
  ['Información de Vivienda y Laboral', 'INFORMATIONS RÉSIDENTIELLES ET PRO.'],
  ['Información de Vivienda', 'INFORMATIONS RÉSIDENTIELLES'],
  ['Tipo Casa', 'TYPE MAISON'],
  ['Particular - Ciudad', 'RÉSIDENCE - VILLE'],
  ['Calle Princ.', 'RUE PRINCIPALE'],
  ['Calle Sec.', 'RUE SECONDAIRE'],
  ['Nro Casa', 'N° MAISON'],
  ['Barrio Particular', 'QUARTIER'],
  ['Empresa', 'ENTREPRISE'],
  ['Laboral - Ciudad', 'TRAVAIL - VILLE'],
  ['Calle Laboral', 'RUE TRAVAIL'],
  ['Tel. Laboral', 'TÉL. TRAVAIL'],
  ['Barrio Laboral', 'QUARTIER TRAVAIL'],
  ['Salario \/ Ingresos', 'SALAIRE \/ REVENUS'],
  ['Información del Cónyuge', 'INFORMATIONS DU CONJOINT'],
  ['Nombre', 'NOM'],
  ['Cédula', 'IDENTITÉ'],
  ['Lugar Trab.', 'LIEU DE TRAVAIL'],
  ['Ingresos', 'REVENUS'],
  ['Referencias Personales', 'RÉFÉRENCES PERSONNELLES'],
  ['Ref. 1', 'RÉF. 1'],
  ['Ref. 2', 'RÉF. 2'],
  ['Otras Notas', 'AUTRES NOTES'],
  ['Sin observaciones adicionales.', 'Aucune observation supplémentaire.'],
  ['Cronograma de Pagos', 'CALENDRIER DE PAIEMENT']
];

regexReplacements.forEach(([es, fr]) => {
  // Be careful with this pattern, we only want to replace text in >text< or {"text"}
  // We'll replace exact occurrences that match our manual search.
  c = c.replace(new RegExp(`>${es}<`, 'gi'), `>{state.settings.language === 'fr' ? '${fr}' : '${es}'}<`);
});

// For variables or table headers without closing brackets right away:
c = c.replace(
  />Fecha<\/th>/i,
  ">{state.settings.language === 'fr' ? 'DATE' : 'Fecha'}</th>"
);
c = c.replace(
  />Crédito<\/th>/i,
  ">{state.settings.language === 'fr' ? 'CRÉDIT' : 'Crédito'}</th>"
);
c = c.replace(
  />Aprobado<\/th>/i,
  ">{state.settings.language === 'fr' ? 'APPROUVÉ' : 'Aprobado'}</th>"
);
c = c.replace(
  />Días de Mora<\/th>/i,
  ">{state.settings.language === 'fr' ? 'JOURS DE RETARD' : 'Días de Mora'}</th>"
);
c = c.replace(
  />Días<\/th>/i,
  ">{state.settings.language === 'fr' ? 'JOURS' : 'Días'}</th>"
);

// Specifically handle the "Información Personal" and "Cronograma de Pagos" and "Información de Vivienda y Laboral" titles which might have trailing elements
c = c.replace(
  /Información Personal<\/h4>/i,
  "{state.settings.language === 'fr' ? 'INFORMATIONS PERSONNELLES' : 'Información Personal'}</h4>"
);
c = c.replace(
  /Información de Vivienda y Laboral<\/h4>/i,
  "{state.settings.language === 'fr' ? 'INFORMATIONS RÉSIDENTIELLES ET PRO.' : 'Información de Vivienda y Laboral'}</h4>"
);
c = c.replace(
  /Información del Cónyuge<\/h4>/i,
  "{state.settings.language === 'fr' ? 'INFORMATIONS DU CONJOINT' : 'Información del Cónyuge'}</h4>"
);
c = c.replace(
  /Referencias Personales<\/h4>/i,
  "{state.settings.language === 'fr' ? 'RÉFÉRENCES PERSONNELLES' : 'Referencias Personales'}</h4>"
);
c = c.replace(
  /Cronograma de Pagos<\/h4>/i,
  "{state.settings.language === 'fr' ? 'CALENDRIER DE PAIEMENT' : 'Cronograma de Pagos'}</h4>"
);

c = c.replace(
  /\{activeLoanInLegajo\.installments\.length\} CUOTAS<\/h3>/i,
  "{activeLoanInLegajo.installments.length} {state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'CUOTAS'}</h3>"
);

// Cuotas en el cronograma
c = c.replace(
  /CUOTAS<\/span>/g,
  "{state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'CUOTAS'}</span>"
);

// Month names in cronograma
c = c.replace(
  /DIAS_SEMANA_CORTO\[dateObj\.getDay\(\)\]/g,
  "(state.settings.language === 'fr' ? ['DIM','LUN','MAR','MER','JEU','VEN','SAM'][dateObj.getDay()] : DIAS_SEMANA_CORTO[dateObj.getDay()])"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Massive extra translations applied.');
