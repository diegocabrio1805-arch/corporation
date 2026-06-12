const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(/if \(itemBranchLower\) \{\s*return myBranchIds\.has\(itemBranchLower\);\s*\} else \{\s*return addedByLower === myIdLower \|\|\s*myDirectCollectorIds\.has\(addedByLower\) \|\|\s*collectorIdLower === myIdLower \|\|\s*myDirectCollectorIds\.has\(collectorIdLower\);\s*\}/, 
`if (itemBranchLower) {
          return myBranchIds.has(itemBranchLower);
        } else {
          if (collectorIdLower) {
            return collectorIdLower === myIdLower || myDirectCollectorIds.has(collectorIdLower);
          }
          return addedByLower === myIdLower || myDirectCollectorIds.has(addedByLower);
        }`);

content = content.replace(/let clients = \(Array\.isArray\(state\.clients\) \? state\.clients : \[\]\)\.filter\(c =>\s*isOurBranch\(c\.branchId \|\| \(c as any\)\.branch_id, c\.addedBy \|\| \(c as any\)\.added_by, undefined\) &&\s*c\.isActive !== false\s*\);/,
`let clients = (Array.isArray(state.clients) ? state.clients : []).filter(c => {
        const activeLoan = (Array.isArray(state.loans) ? state.loans : []).find(l => 
          ((l.clientId || (l as any).client_id) === c.id) && 
          (l.status === 'ACTIVE' || l.status === 'DEFAULT')
        );
        const collectorId = activeLoan ? (activeLoan.collectorId || (activeLoan as any).collector_id) : undefined;
        return isOurBranch(c.branchId || (c as any).branch_id, c.addedBy || (c as any).added_by, collectorId) && c.isActive !== false;
      });`);

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Patched");
