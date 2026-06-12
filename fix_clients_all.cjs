const fs = require('fs');

let clients = fs.readFileSync('components/Clients.tsx', 'utf8');

// Screenshot 1 & 3 & 4 Table Headers (Exact matches from Clients.tsx based on grep)
// Note: Some of these were already replaced in my previous script, but maybe they were case sensitive or missed.
clients = clients.replace(/>Fecha Alta<\/th>/g, `>{((t as any).clients.list?.thRegDateFull || 'Fecha Alta')}</th>`);
clients = clients.replace(/>Cliente \/ ID<\/th>/g, `>{((t as any).clients.list?.thClientId || 'Cliente / ID')}</th>`);
clients = clients.replace(/>Teléfono<\/th>/g, `>{((t as any).clients.list?.thPhone || 'Teléfono')}</th>`);
clients = clients.replace(/>Crédito<\/th>/g, `>{((t as any).clients.list?.thCredit || 'Crédito')}</th>`);
clients = clients.replace(/>Monto<\/th>/g, `>{((t as any).clients.list?.thAmount || 'Monto')}</th>`);
clients = clients.replace(/>Interés<\/th>/g, `>{((t as any).clients.list?.thInterest || 'Interés')}</th>`);
clients = clients.replace(/>Cobrado<\/th>/g, `>{((t as any).clients.list?.thCollected || 'Cobrado')}</th>`);
clients = clients.replace(/>Valor Cuota<\/th>/g, `>{((t as any).clients.list?.thInstallmentValue || 'Valor Cuota')}</th>`);
clients = clients.replace(/>Cuotas<\/th>/g, `>{((t as any).clients.list?.thInstallments || 'Cuotas')}</th>`);
clients = clients.replace(/>Mora<\/th>/g, `>{((t as any).clients.list?.thMora || 'Mora')}</th>`);
clients = clients.replace(/>Acciones<\/th>/g, `>{((t as any).clients.list?.thActions || 'Acciones')}</th>`);

clients = clients.replace(/>Fecha Renov.<\/th>/g, `>{((t as any).clients.list?.thRenovDate || 'Fecha Renov.')}</th>`);
clients = clients.replace(/>Cliente<\/th>/g, `>{((t as any).clients.list?.thClient || 'Cliente')}</th>`);
clients = clients.replace(/>Atraso<\/th>/g, `>{((t as any).clients.list?.thArrears || 'Atraso')}</th>`);

clients = clients.replace(/>Frecuencia<\/th>/g, `>{((t as any).clients.list?.thFrequency || 'Frecuencia')}</th>`);
clients = clients.replace(/>Habilitado<\/th>/g, `>{((t as any).clients.list?.thApproved || 'Habilitado')}</th>`);
clients = clients.replace(/>Total<\/th>/g, `>{((t as any).clients.list?.thTotal || 'Total')}</th>`);
clients = clients.replace(/>Créditos<\/th>/g, `>{((t as any).clients.list?.credits || 'Créditos')}</th>`);
clients = clients.replace(/>Estado<\/th>/g, `>{((t as any).clients.list?.thState || 'Estado')}</th>`);

// Tags and texts
clients = clients.replace(/>Créditos Finalizados<\/p>/g, `>{((t as any).clients.list?.thFinished || 'Créditos Finalizados')}</p>`);
clients = clients.replace(/\{totalCredits\} CR.D\. FINALIZADOS/g, `{totalCredits} {((t as any).clients.list?.thFinished || 'CRÉD. FINALIZADOS')}`);
clients = clients.replace(/'● ACTIVO' : '● INACTIVO'/g, `((t as any).clients.list?.btnActive ? '● ' + (t as any).clients.list.btnActive : '● ACTIVO') : '● INACTIVO'`);

// Buttons
clients = clients.replace(/>VER<\/button>/g, `>{((t as any).clients.list?.btnView || 'VER')}</button>`);
clients = clients.replace(/>DETALLE<\/button>/g, `>{((t as any).clients.list?.btnDetail || 'DETALLE')}</button>`);
clients = clients.replace(/>ELIMINAR<\/button>/g, `>{((t as any).clients.list?.btnDelete || 'ELIMINAR')}</button>`);

// Pagination page
clients = clients.replace(/P.gina \{currentPage\} de \{totalPages\}/g, `{((t as any).clients.pagination?.page || 'Página')} {currentPage} {((t as any).clients.pagination?.of || 'de')} {totalPages}`);
clients = clients.replace(/P.gina \{currentPage\} \/ \{totalPages\}/g, `{((t as any).clients.pagination?.page || 'Página')} {currentPage} / {totalPages}`);
clients = clients.replace(/>P.GINA \{currentPage\} \/ \{totalPages\}</g, `>{((t as any).clients.pagination?.page || 'PÁGINA')} {currentPage} / {totalPages}<`);

// Also pagination is rendered as >PÁGINA {currentPage} / {totalPages}< inside Clients.tsx (or similar). Let's catch it.
// Let's actually find how PÁGINA is written:
clients = clients.replace(/>P.GINA\s*\{currentPage\}\s*\/\s*\{totalPages\}\s*<\/span>/gi, `>{((t as any).clients.pagination?.page || 'PÁGINA')} {currentPage} / {totalPages}</span>`);

fs.writeFileSync('components/Clients.tsx', clients, 'utf8');
console.log("Replaced everything in Clients.tsx successfully!");
