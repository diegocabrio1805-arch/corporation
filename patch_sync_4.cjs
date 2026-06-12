const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(
  /if \(itemBranchLower\) \{\s*return myBranchIds\.has\(itemBranchLower\);\s*\} else \{\s*if \(collectorIdLower\) \{\s*return collectorIdLower === myIdLower \|\|\s*myDirectCollectorIds\.has\(collectorIdLower\);\s*\}\s*return addedByLower === myIdLower \|\|\s*myDirectCollectorIds\.has\(addedByLower\);\s*\}/m,
  `if (collectorIdLower) {
          return collectorIdLower === myIdLower || myDirectCollectorIds.has(collectorIdLower);
        }
        
        if (itemBranchLower) {
            return myBranchIds.has(itemBranchLower);
        }
        
        return addedByLower === myIdLower || myDirectCollectorIds.has(addedByLower);`
);

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Patched priority of collectorId");
