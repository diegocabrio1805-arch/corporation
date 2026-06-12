const fs = require('fs');
let content = fs.readFileSync('hooks/useAppSyncEngine.ts', 'utf8');

content = content.replace(/let clients = \(Array\.isArray\(state\.clients\) \? state\.clients : \[\]\)\.filter\(c => \{\s*const activeLoan = \(Array\.isArray\(state\.loans\) \? state\.loans : \[\]\)\.find\(l =>\s*\(\(l\.clientId \|\| \(l as any\)\.client_id\) === c\.id\) &&\s*\(l\.status === LoanStatus\.ACTIVE \|\| l\.status === LoanStatus\.DEFAULT\)\s*\);\s*const collectorId = activeLoan \? \(activeLoan\.collectorId \|\| \(activeLoan as any\)\.collector_id\) : undefined;\s*return isOurBranch\(c\.branchId \|\| \(c as any\)\.branch_id, c\.addedBy \|\| \(c as any\)\.added_by, collectorId\) &&\s*c\.isActive !== false;\s*\}\);/m,
`let clients = (Array.isArray(state.clients) ? state.clients : []).filter(c => {
          const loans = Array.isArray(state.loans) ? state.loans : [];
          const activeLoan = loans.find(l => 
            ((l.clientId || (l as any).client_id) === c.id) && 
            (l.status === LoanStatus.ACTIVE || l.status === LoanStatus.DEFAULT)
          );
          let collectorId = activeLoan ? (activeLoan.collectorId || (activeLoan as any).collector_id) : undefined;
          
          if (!collectorId) {
             const anyLoan = loans.find(l => (l.clientId || (l as any).client_id) === c.id);
             if (anyLoan) {
                 collectorId = anyLoan.collectorId || (anyLoan as any).collector_id;
             }
          }
          
          return isOurBranch(c.branchId || (c as any).branch_id, c.addedBy || (c as any).added_by, collectorId) && 
c.isActive !== false;
      });`);

fs.writeFileSync('hooks/useAppSyncEngine.ts', content, 'utf8');
console.log("Patched fallback to any loan!");
