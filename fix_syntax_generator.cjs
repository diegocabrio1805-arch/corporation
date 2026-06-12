const fs = require('fs');

let fileContent = fs.readFileSync('components/Generator/Generator.tsx', 'utf8');

// 1. Fix the syntax error on line 37
// My previous script did: fileContent = fileContent.replace(/DEFAULT_MANUAL_TEXT/g, "(tg?.redactHere || '...')");
// So line 37 became: const (tg?.redactHere || 'Escriba aquí el contenido de su documento...') = `Escriba aquí...`;
fileContent = fileContent.replace(
  /const \(tg\?\.redactHere \|\| 'Escriba aqu. el contenido de su documento\.\.\.'\) = `.*?`;/s,
  "const DEFAULT_MANUAL_TEXT = `Escriba aquí el contenido de su documento...`;"
);

// 2. We also want to restore DEFAULT_PAGARE_TEXT and DEFAULT_RECIBO_TEXT if they were somehow affected (they shouldn't be).
// Let's replace the usages inside the component.
// Instead of replacing DEFAULT_PAGARE_TEXT with a static string, we should use the translation.
fileContent = fileContent.replace(
  /legalText: formData\.type === DocumentType\.PAGARE \? DEFAULT_PAGARE_TEXT : \(formData\.type === DocumentType\.RECIBO \? DEFAULT_RECIBO_TEXT : \(tg\?\.redactHere \|\| 'Escriba aqu. el contenido de su documento\.\.\.'\)\),/g,
  "legalText: formData.type === DocumentType.PAGARE ? (tg?.defaultPagare || DEFAULT_PAGARE_TEXT) : (formData.type === DocumentType.RECIBO ? (tg?.defaultRecibo || DEFAULT_RECIBO_TEXT) : (tg?.defaultManual || DEFAULT_MANUAL_TEXT)),"
);

fileContent = fileContent.replace(
  /const text = type === DocumentType\.PAGARE \? DEFAULT_PAGARE_TEXT : \(type === DocumentType\.RECIBO \? DEFAULT_RECIBO_TEXT : \(tg\?\.redactHere \|\| 'Escriba aqu. el contenido de su documento\.\.\.'\)\);/g,
  "const text = type === DocumentType.PAGARE ? (tg?.defaultPagare || DEFAULT_PAGARE_TEXT) : (type === DocumentType.RECIBO ? (tg?.defaultRecibo || DEFAULT_RECIBO_TEXT) : (tg?.defaultManual || DEFAULT_MANUAL_TEXT));"
);

// 3. For the textarea placeholder
fileContent = fileContent.replace(
  /placeholder=\{tg\?\.redactHere \|\| "Redacte el contenido aqu.\.\.\."\} \/>/g,
  'placeholder={tg?.redactHere || "Redacte el contenido aquí..."} />'
);

fs.writeFileSync('components/Generator/Generator.tsx', fileContent, 'utf8');
console.log('Generator.tsx syntax fixed.');
