const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  />Nacionalidad<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'NATIONALITÉ' : 'Nacionalidad'}</span></td>"
);
c = c.replace(
  />F\. Nacimiento<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'DATE DE NAISSANCE' : 'F. Nacimiento'}</span></td>"
);
c = c.replace(
  />Estado Civil<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'ÉTAT CIVIL' : 'Estado Civil'}</span></td>"
);
c = c.replace(
  />Profesión<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'PROFESSION' : 'Profesión'}</span></td>"
);
c = c.replace(
  />Email<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'E-MAIL' : 'Email'}</span></td>"
);
c = c.replace(
  />Clasific\.<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'CLASSIFIC.' : 'Clasific.'}</span></td>"
);
c = c.replace(
  />Tipo Cliente<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'TYPE CLIENT' : 'Tipo Cliente'}</span></td>"
);
c = c.replace(
  />Tipo Casa<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'TYPE MAISON' : 'Tipo Casa'}</span></td>"
);
c = c.replace(
  />Particular - Ciudad<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RÉSIDENCE - VILLE' : 'Particular - Ciudad'}</span></td>"
);
c = c.replace(
  />Calle Princ\.<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RUE PRINCIPALE' : 'Calle Princ.'}</span></td>"
);
c = c.replace(
  />Calle Sec\.<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RUE SECONDAIRE' : 'Calle Sec.'}</span></td>"
);
c = c.replace(
  />Nro Casa<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'N° MAISON' : 'Nro Casa'}</span></td>"
);
c = c.replace(
  />Barrio Particular<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'QUARTIER' : 'Barrio Particular'}</span></td>"
);
c = c.replace(
  />Empresa<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'ENTREPRISE' : 'Empresa'}</span></td>"
);
c = c.replace(
  />Laboral - Ciudad<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'TRAVAIL - VILLE' : 'Laboral - Ciudad'}</span></td>"
);
c = c.replace(
  />Calle Laboral<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RUE TRAVAIL' : 'Calle Laboral'}</span></td>"
);
c = c.replace(
  />Tel\. Laboral<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'TÉL. TRAVAIL' : 'Tel. Laboral'}</span></td>"
);
c = c.replace(
  />Barrio Laboral<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'QUARTIER TRAVAIL' : 'Barrio Laboral'}</span></td>"
);
c = c.replace(
  />Salario \/ Ingresos<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'SALAIRE / REVENUS' : 'Salario / Ingresos'}</span></td>"
);
c = c.replace(
  />Nombre<\/td>/g,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'NOM' : 'Nombre'}</span></td>"
);
c = c.replace(
  />Cédula<\/td>/g,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'IDENTITÉ' : 'Cédula'}</span></td>"
);
c = c.replace(
  />Lugar Trab\.<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'LIEU DE TRAVAIL' : 'Lugar Trab.'}</span></td>"
);
c = c.replace(
  />Ingresos<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'REVENUS' : 'Ingresos'}</span></td>"
);
c = c.replace(
  />Ref\. 1<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RÉF. 1' : 'Ref. 1'}</span></td>"
);
c = c.replace(
  />Ref\. 2<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'RÉF. 2' : 'Ref. 2'}</span></td>"
);
c = c.replace(
  />Otras Notas<\/td>/i,
  "><span className=\"uppercase\">{state.settings.language === 'fr' ? 'AUTRES NOTES' : 'Otras Notas'}</span></td>"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Massive extra translations applied.');
