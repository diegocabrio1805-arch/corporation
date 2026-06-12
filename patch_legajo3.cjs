const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(
  /<span className="xs:hidden">ENVIAR<\/span>/g,
  '<span className="xs:hidden">{state.settings.language === \'fr\' ? \'ENVOYER\' : \'ENVIAR\'}</span>'
);

c = c.replace(
  /\{isEditingClient \? 'CANCELAR' \: 'EDITAR'\}/g,
  "{isEditingClient ? (state.settings.language === 'fr' ? 'ANNULER' : 'CANCELAR') : (state.settings.language === 'fr' ? 'ÉDITER' : 'EDITAR')}"
);

c = c.replace(
  /'EDITAR EMPRES'\}A<\/span>/g,
  "'EDITAR EMPRESA'}</span>"
);

// Photos Array
c = c.replace(
  /\{ key: 'profilePic', label: 'Perfil' \}, \{ key: 'documentPic', label: 'Cédula' \}, \{ key: 'documentBackPic', label: 'Cédula Dorso' \}, \{ key: 'businessPic', label: 'Negocio' \}, \{ key: 'housePic', label: 'Fachada' \}/g,
  "{ key: 'profilePic', label: state.settings.language === 'fr' ? 'Profil' : 'Perfil' }, { key: 'documentPic', label: state.settings.language === 'fr' ? 'Identité' : 'Cédula' }, { key: 'documentBackPic', label: state.settings.language === 'fr' ? 'Identité Verso' : 'Cédula Dorso' }, { key: 'businessPic', label: state.settings.language === 'fr' ? 'Travail' : 'Negocio' }, { key: 'housePic', label: state.settings.language === 'fr' ? 'Façade' : 'Fachada' }"
);

// FOTOS DEL EXPEDIENTE
c = c.replace(
  />Fotos del Expediente</g,
  ">{state.settings.language === 'fr' ? 'PHOTOS DU DOSSIER' : 'Fotos del Expediente'}<"
);

// History items
c = c.replace(
  /\{isLoanGrant \? 'CRÉDITO' :/g,
  "{isLoanGrant ? (state.settings.language === 'fr' ? 'CRÉDIT' : 'CRÉDITO') :"
);

c = c.replace(
  /log\.isOpening \? 'Crédito Habilitado' :/g,
  "log.isOpening ? (state.settings.language === 'fr' ? 'Crédit Approuvé' : 'Crédito Habilitado') :"
);

c = c.replace(
  /log\.isRenewal \? 'Renovación Crédito' :/g,
  "log.isRenewal ? (state.settings.language === 'fr' ? 'Renouvellement Crédit' : 'Renovación Crédito') :"
);

c = c.replace(
  /log\.type === CollectionLogType\.PAYMENT \? `Abono Recibido \(\$\{/g,
  "log.type === CollectionLogType.PAYMENT ? `${state.settings.language === 'fr' ? 'Paiement Reçu' : 'Abono Recibido'} (${"
);

c = c.replace(
  /log\.type === CollectionLogType\.PAYMENT \? 'Abono Recibido' :/g,
  "log.type === CollectionLogType.PAYMENT ? (state.settings.language === 'fr' ? 'Paiement Reçu' : 'Abono Recibido') :"
);

c = c.replace(
  /log\.type === CollectionLogType\.NO_PAGO \? 'No Pago' :/g,
  "log.type === CollectionLogType.NO_PAGO ? (state.settings.language === 'fr' ? 'Non-Paiement' : 'No Pago') :"
);

c = c.replace(
  /log\.type === CollectionLogType\.HOLIDAY \? 'Feriado \/ Sin Visita' :/g,
  "log.type === CollectionLogType.HOLIDAY ? (state.settings.language === 'fr' ? 'Jour Férié / Pas de Visite' : 'Feriado / Sin Visita') :"
);

c = c.replace(
  /'Sin Visita'/g,
  "(state.settings.language === 'fr' ? 'Pas de Visite' : 'Sin Visita')"
);

// Información Personal
c = c.replace(
  />Información Personal</g,
  ">{state.settings.language === 'fr' ? 'INFORMATIONS PERSONNELLES' : 'Información Personal'}<"
);

// Gestión rápida
c = c.replace(
  />No Pago</g,
  ">{state.settings.language === 'fr' ? 'NON-PAIEMENT' : 'No Pago'}<"
);

c = c.replace(
  />Cobrar \/ Renovación</g,
  ">{state.settings.language === 'fr' ? 'ENCAISSER / RENOUVELLEMENT' : 'Cobrar / Renovación'}<"
);

c = c.replace(
  />Renovar Crédito</g,
  ">{state.settings.language === 'fr' ? 'RENOUVELER CRÉDIT' : 'Renovar Crédito'}<"
);

c = c.replace(
  />REIMPRIMIR ÚLTIMO RECIBO</g,
  ">{state.settings.language === 'fr' ? 'RÉIMPRIMER DERNIER REÇU' : 'REIMPRIMIR ÚLTIMO RECIBO'}<"
);

c = c.replace(
  /:\ 'Al Día'\}/g,
  ": (state.settings.language === 'fr' ? 'À Jour' : 'Al Día')}"
);

c = c.replace(
  /\? \`\$\{m\.daysOverdue\} d mora\` \:/g,
  "? `${m.daysOverdue} ${state.settings.language === 'fr' ? 'j retard' : 'd mora'}` :"
);

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Finished 3rd patch for Legajo view!');
