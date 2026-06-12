const fs = require('fs');
let c = fs.readFileSync('components/Clients.tsx', 'utf8');

c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thRegDateFull \|\| 'Fecha Alta'\)\}/g, "{state.settings.language === 'fr' ? 'DATE D\\'OUVERTURE' : 'Fecha Alta'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thClientId \|\| 'Cliente \/ ID'\)\}/g, "{state.settings.language === 'fr' ? 'CLIENT / ID' : 'Cliente / ID'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thPhone \|\| 'Teléfono'\)\}/g, "{state.settings.language === 'fr' ? 'TÉLÉPHONE' : 'Teléfono'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thCredit \|\| 'Crédito'\)\}/g, "{state.settings.language === 'fr' ? 'CRÉDIT' : 'Crédito'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thAmount \|\| 'Monto'\)\}/g, "{state.settings.language === 'fr' ? 'MONTANT' : 'Monto'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thInterest \|\| 'Interés'\)\}/g, "{state.settings.language === 'fr' ? 'INTÉRÊT' : 'Interés'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thCollected \|\| 'Cobrado'\)\}/g, "{state.settings.language === 'fr' ? 'RECOUVRÉ' : 'Cobrado'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thInstallmentValue \|\| 'Valor Cuota'\)\}/g, "{state.settings.language === 'fr' ? 'VALEUR MENSUALITÉ' : 'Valor Cuota'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thInstallments \|\| 'Cuotas'\)\}/g, "{state.settings.language === 'fr' ? 'ÉCHÉANCES' : 'Cuotas'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thMora \|\| 'Mora'\)\}/g, "{state.settings.language === 'fr' ? 'RETARD' : 'Mora'}");
c = c.replace(/\{\(\(t as any\)\.clients\.list\?\.thActions \|\| 'Acciones'\)\}/g, "{state.settings.language === 'fr' ? 'ACTIONS' : 'Acciones'}");

c = c.replace(/No hay registros para este periodo/g, "{state.settings.language === 'fr' ? 'AUCUN ENREGISTREMENT POUR CETTE PÉRIODE' : 'No hay registros para este periodo'}");

fs.writeFileSync('components/Clients.tsx', c, 'utf8');
console.log('Patched Clients.tsx!');
