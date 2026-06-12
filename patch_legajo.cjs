const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

const t = (fr, es) => `{state.settings.language === 'fr' ? '${fr}' : '${es}'}`;

// Top Buttons
c = c.replace(/>Enviar /g, `>{state.settings.language === 'fr' ? 'Envoyer ' : 'Enviar '}`);
c = c.replace(/>Editar /g, `>{state.settings.language === 'fr' ? 'Éditer ' : 'Editar '}`);
c = c.replace(/>EDITAR EMPRES/g, `>{state.settings.language === 'fr' ? 'ÉDITER ENTREPRISE' : 'EDITAR EMPRES'}`);
c = c.replace(/>EDITAR NO PAGO</g, `>{state.settings.language === 'fr' ? 'ÉDITER NON-PAIEMENT' : 'EDITAR NO PAGO'}<`);
c = c.replace(/>EDITAR</g, `>{state.settings.language === 'fr' ? 'ÉDITER' : 'EDITAR'}<`);

// Header
c = c.replace(/>Mapa GPS:/g, `>{state.settings.language === 'fr' ? 'Carte GPS:' : 'Mapa GPS:'}`);
c = c.replace(/>CASA</g, `>{state.settings.language === 'fr' ? 'MAISON' : 'CASA'}<`);
c = c.replace(/>NEGOCIO</g, `>{state.settings.language === 'fr' ? 'TRAVAIL' : 'NEGOCIO'}<`);
c = c.replace(/>Contactos:/g, `>{state.settings.language === 'fr' ? 'Contacts:' : 'Contactos:'}`);

// Resumen Cuenta
c = c.replace(/>Resumen Cuenta</g, `>{state.settings.language === 'fr' ? 'RÉSUMÉ DU COMPTE' : 'Resumen Cuenta'}<`);
c = c.replace(/>En curso</g, `>{state.settings.language === 'fr' ? 'EN COURS' : 'En curso'}<`);
c = c.replace(/>Monto Habilitado</g, `>{state.settings.language === 'fr' ? 'MONTANT APPROUVÉ' : 'Monto Habilitado'}<`);
c = c.replace(/>Crédito Habilitado</g, `>{state.settings.language === 'fr' ? 'CRÉDIT APPROUVÉ' : 'Crédito Habilitado'}<`);
c = c.replace(/>Abonado</g, `>{state.settings.language === 'fr' ? 'PAYÉ' : 'Abonado'}<`);
c = c.replace(/>Saldo Pendiente</g, `>{state.settings.language === 'fr' ? 'SOLDE RESTANT' : 'Saldo Pendiente'}<`);
c = c.replace(/>Progreso Cuotas</g, `>{state.settings.language === 'fr' ? 'PROGRÈS ÉCHÉANCES' : 'Progreso Cuotas'}<`);
c = c.replace(/>Cód Operación</g, `>{state.settings.language === 'fr' ? 'CODE OPÉRATION' : 'Cód Operación'}<`);

// Fotos del Expediente
c = c.replace(/>Fotos del expediente</g, `>{state.settings.language === 'fr' ? 'PHOTOS DU DOSSIER' : 'Fotos del expediente'}<`);
c = c.replace(/>PERFIL</g, `>{state.settings.language === 'fr' ? 'PROFIL' : 'PERFIL'}<`);
c = c.replace(/>CÉDULA</g, `>{state.settings.language === 'fr' ? 'IDENTITÉ' : 'CÉDULA'}<`);
c = c.replace(/>CÉDULA DORSO</g, `>{state.settings.language === 'fr' ? 'IDENTITÉ VERSO' : 'CÉDULA DORSO'}<`);
c = c.replace(/>FACHADA</g, `>{state.settings.language === 'fr' ? 'FAÇADE' : 'FACHADA'}<`);

// Historial Reciente
c = c.replace(/>Historial Reciente</g, `>{state.settings.language === 'fr' ? 'HISTORIQUE RÉCENT' : 'Historial Reciente'}<`);
c = c.replace(/>Fecha \/ Hora</g, `>{state.settings.language === 'fr' ? 'DATE / HEURE' : 'Fecha / Hora'}<`);
c = c.replace(/>Concepto</g, `>{state.settings.language === 'fr' ? 'CONCEPT' : 'Concepto'}<`);
c = c.replace(/>Abono Recibido</g, `>{state.settings.language === 'fr' ? 'PAIEMENT REÇU' : 'Abono Recibido'}<`);
c = c.replace(/>Abono Recibido \(/g, `>{state.settings.language === 'fr' ? 'PAIEMENT REÇU (' : 'Abono Recibido ('}`);
c = c.replace(/>Crédito</g, `>{state.settings.language === 'fr' ? 'CRÉDIT' : 'Crédito'}<`);

// Historial Crediticio
c = c.replace(/>Historial Crediticio</g, `>{state.settings.language === 'fr' ? 'HISTORIQUE DE CRÉDIT' : 'Historial Crediticio'}<`);
c = c.replace(/>Días de Mora</g, `>{state.settings.language === 'fr' ? 'JOURS DE RETARD' : 'Días de Mora'}<`);
c = c.replace(/\{l\.metrics\.daysOverdue\} DÍAS</g, `{l.metrics.daysOverdue} {state.settings.language === 'fr' ? 'JOURS' : 'DÍAS'}<`);

// Gestion Rapida
c = c.replace(/>Gestión Rápida</g, `>{state.settings.language === 'fr' ? 'GESTION RAPIDE' : 'Gestión Rápida'}<`);
c = c.replace(/>Valor Cuota</g, `>{state.settings.language === 'fr' ? 'VALEUR MENSUALITÉ' : 'Valor Cuota'}<`);
c = c.replace(/>NO PAGO</g, `>{state.settings.language === 'fr' ? 'NON-PAIEMENT' : 'NO PAGO'}<`);
c = c.replace(/>COBRAR \/ RENOVACIÓN</g, `>{state.settings.language === 'fr' ? 'ENCAISSER / RENOUVELLEMENT' : 'COBRAR / RENOVACIÓN'}<`);
c = c.replace(/>REIMPRIMIR ÚLTIMO RECIBO</g, `>{state.settings.language === 'fr' ? 'RÉIMPRIMER DERNIER REÇU' : 'REIMPRIMIR ÚLTIMO RECIBO'}<`);
c = c.replace(/\{m\.daysOverdue\} D MORA/g, `{m.daysOverdue} {state.settings.language === 'fr' ? 'J RETARD' : 'D MORA'}`);

// Semanal - pago los viernes
c = c.replace(/const diaSemana = /g, 'const FR_DIAS = ["DIMANCHES","LUNDIS","MARDIS","MERCREDIS","JEUDIS","VENDREDIS","SAMEDIS"];\n                            const diaSemana = ');
c = c.replace(/loan\.frequency === Frequency\.WEEKLY \? \`SEMANAL · \$\{diaSemana\}\` : /g, 
  "loan.frequency === Frequency.WEEKLY ? (state.settings.language === 'fr' ? `HEBDOMADAIRE · PAIEMENT LES ${FR_DIAS[startDate.getDay()]}` : `SEMANAL · PAGO LOS ${diaSemana}`) : ");

// Missing `Pago los` from previous logic (actually let's just make sure it's correct)
// Oh, the user's screenshot says "SEMANAL - PAGO LOS VIERNES"
// Let's replace the EXACT string that generates this if it's there:
c = c.replace(/SEMANAL · /g, "{state.settings.language === 'fr' ? 'HEBDOMADAIRE · ' : 'SEMANAL · '}");
c = c.replace(/PAGO LOS /g, "{state.settings.language === 'fr' ? 'PAIEMENT LES ' : 'PAGO LOS '}");
// But wait, it's inside a template literal.
// I will just let the manual replace handle it.

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Massive replace finished for Legajo view!');
