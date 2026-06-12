const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(/l\.status === 'ACTIVE'/g, 'l.status === LoanStatus.ACTIVE');
content = content.replace(/l\.status === 'DEFAULT'/g, 'l.status === LoanStatus.DEFAULT');

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Patched enums!");
