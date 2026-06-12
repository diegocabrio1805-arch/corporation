const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  />Monto<\/label>/g,
  ">{state.settings.language === 'fr' ? 'MONTANT' : 'Monto'}</label>"
);
c = c.replace(
  />Int %<\/label>/g,
  ">{state.settings.language === 'fr' ? 'INT %' : 'Int %'}</label>"
);
c = c.replace(
  />Cuotas<\/label>/g,
  ">{state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'Cuotas'}</label>"
);
c = c.replace(
  />Inicio<\/label>/g,
  ">{state.settings.language === 'fr' ? 'DÉBUT' : 'Inicio'}</label>"
);
c = c.replace(
  />Frecuencia<\/label>/g,
  ">{state.settings.language === 'fr' ? 'FRÉQUENCE' : 'Frecuencia'}</label>"
);

c = c.replace(
  />\* Editar estos valores recalculará todo el cronograma\.<\/p>/g,
  ">{state.settings.language === 'fr' ? '* L\\'édition de ces valeurs recalculera tout le calendrier.' : '* Editar estos valores recalculará todo el cronograma.'}</p>"
);

c = c.replace(
  /className="bg-white text-slate-800">\{f\}<\/option>/g,
  "className=\"bg-white text-slate-800\">{state.settings.language === 'fr' ? (f === Frequency.DAILY || f === 'Diaria' ? 'QUOTIDIEN (L - S)' : f === Frequency.DAILY_MF ? 'QUOTIDIEN (L - V)' : f === Frequency.WEEKLY ? 'HEBDOMADAIRE' : f === Frequency.BIWEEKLY ? 'BIMENSUEL' : 'MENSUEL') : f}</option>"
);

c = c.replace(
  /label="Perfil"/g,
  "label={state.settings.language === 'fr' ? 'PROFIL' : 'Perfil'}"
);
c = c.replace(
  /label="Cédula"/g,
  "label={state.settings.language === 'fr' ? 'IDENTITÉ' : 'Cédula'}"
);
c = c.replace(
  /label="Cédula Dorso"/g,
  "label={state.settings.language === 'fr' ? 'IDENTITÉ VERSO' : 'Cédula Dorso'}"
);
c = c.replace(
  /label="Fachada"/g,
  "label={state.settings.language === 'fr' ? 'FAÇADE' : 'Fachada'}"
);
c = c.replace(
  /label="Negocio"/g,
  "label={state.settings.language === 'fr' ? 'TRAVAIL' : 'Negocio'}"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Finished Edit modal patches 2!');
