const fs = require('fs');

let code = fs.readFileSync('components/Loans.tsx', 'utf8');

code = code.replace(/>\s*Anterior\s*<\/button>/g, `>{((t as any).loans.pagination?.prev || 'Anterior')}</button>`);
code = code.replace(/>\s*Siguiente\s*<\/button>/g, `>{((t as any).loans.pagination?.next || 'Siguiente')}</button>`);
code = code.replace(/P.gina \{currentPage\} de \{totalPages\}/g, `{((t as any).loans.pagination?.page || 'Página')} {currentPage} {((t as any).loans.pagination?.of || 'de')} {totalPages}`);

fs.writeFileSync('components/Loans.tsx', code, 'utf8');
console.log("Fixed hardcoded pagination in Loans.tsx");
