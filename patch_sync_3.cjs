const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(
  /if \(uManagerId === branchIdLower\) \{\s*myBranchIds\.add\(u\.id\.toLowerCase\(\)\);\s*\/\/\s*Incluir gerentes que dependen de mí\s*if \(u\.role === Role\.COLLECTOR\) \{\s*myDirectCollectorIds\.add\(u\.id\.toLowerCase\(\)\);\s*\}\s*\}/m,
  `if (uManagerId === branchIdLower) {
          if (u.role === Role.COLLECTOR) {
            myDirectCollectorIds.add(u.id.toLowerCase());
          }
        }`
);

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Patched myBranchIds loop");
