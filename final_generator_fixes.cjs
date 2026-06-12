const fs = require('fs');
let fileContent = fs.readFileSync('components/Generator/Generator.tsx', 'utf8');

// Replace sidebar "Historial"
fileContent = fileContent.replace(
  '<History className="w-3.5 h-3.5 inline mr-1" /> Historial',
  '<History className="w-3.5 h-3.5 inline mr-1" /> {tg?.history || "Historial"}'
);

// Replace sidebar "Plantillas"
fileContent = fileContent.replace(
  '<BookOpen className="w-3.5 h-3.5 inline mr-1" /> Plantillas',
  '<BookOpen className="w-3.5 h-3.5 inline mr-1" /> {tg?.templates || "Plantillas"}'
);

// Replace dropdown "Plantillas"
fileContent = fileContent.replace(
  '<BookOpen className="w-3 h-3" />\n                                        Plantillas',
  '<BookOpen className="w-3 h-3" />\n                                        {tg?.templates || "Plantillas"}'
);

// Replace the manual text usage
// First we see: const text = type === DocumentType.PAGARE ? DEFAULT_PAGARE_TEXT : (type === DocumentType.RECIBO ? DEFAULT_RECIBO_TEXT : DEFAULT_MANUAL_TEXT);
// And also in resetForm: legalText: formData.type === DocumentType.PAGARE ? ... : DEFAULT_MANUAL_TEXT
// And the initial state of formData.

fileContent = fileContent.replace(
  /DEFAULT_MANUAL_TEXT/g,
  "(tg?.redactHere || 'Escriba aquí el contenido de su documento...')"
);

fs.writeFileSync('components/Generator/Generator.tsx', fileContent, 'utf8');
console.log('Final fixes applied.');
