const XLSX = require('xlsx-js-style');
const fs = require('fs');

const filePath = 'C:\\Users\\DANIEL\\Desktop\\CARPETA PARA APLICACIONES\\prueba de excel.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    let headerRow = -1;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i].map(c => String(c || '').toUpperCase());
        if (row.some(r => r.includes("NOMBRE") || r.includes("CLIENTE") || r.includes("CEDULA"))) {
            headerRow = i;
            console.log(`Header Row found at index ${i}`);
            console.log("Headers:");
            rows[i].forEach(h => {
                if (h) console.log(`- ${h}`);
            });
            break;
        }
    }

    if (headerRow === -1 && rows.length > 0) {
        console.log("No header row found with keywords. Showing first row headers:");
        rows[0].forEach(h => {
            if (h) console.log(`- ${h}`);
        });
    }
} catch (err) {
    console.error(`Error: ${err.message}`);
}
