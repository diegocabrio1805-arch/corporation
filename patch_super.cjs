const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(
  /const isSuperUser = \['DIEGO', 'FABIAN PEDROZO', 'ALTERFINZONA01'\]\.includes\(uName\);/g,
  "const isSuperUser = ['FABIAN PEDROZO', 'ALTERFINZONA01'].includes(uName);"
);

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Removed DIEGO from isSuperUser");
