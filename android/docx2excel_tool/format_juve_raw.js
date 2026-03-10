const fs = require('fs');
const xlsx = require('xlsx');

const filePath = 'D:\\ANEXO COBRO\\publicidad\\JUVE CLIENTESZONA.xlsx';

function formatBalanceToDots(balanceStr) {
    if (!balanceStr) return "0.00";
    let str = String(balanceStr).trim();

    if (/^\d+(\.\d+)?$/.test(str) || typeof balanceStr === 'number') {
        const num = parseFloat(str);
        if (isNaN(num)) return str;
        let parts = num.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join('.');
    }

    if (str.includes(',')) {
        return str.replace(/,/g, '.');
    }
    return str;
}

try {
    console.log(`Cambiando formato numérico en archivo original: ${filePath}`);
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Lo leemos como arreglo crudo para no dañar los nombres de cabecera feos (XLSXLXSCSV, etc)
    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    // Identificar cual de todas las columnas (0 a N) es la que tiene la palabra Saldo o numeros grandes
    // Juve original usa la logica de columnas separadas
    let balanceColIdx = -1;
    for (let i = 0; i < Math.min(10, rawData.length); i++) {
        if (!rawData[i]) continue;
        for (let j = 0; j < rawData[i].length; j++) {
            const cell = String(rawData[i][j]).toLowerCase();
            if (cell.includes('saldo') || cell.includes('total')) {
                balanceColIdx = j;
                break;
            }
        }
        if (balanceColIdx !== -1) break;
    }

    // Si no encontró, forzamos a la columna que sabemos que es el saldo (Índice 10 en tu Excel crudo)
    if (balanceColIdx === -1) balanceColIdx = 10;
    console.log("Columna de Saldo detectada en índice: " + balanceColIdx);

    // Reemplazar la data en todas las filas de esa columna exceptuando headers
    for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row[balanceColIdx] !== undefined) {
            // Ver si realmente es un numero de saldo
            const testStr = String(row[balanceColIdx]);
            // Aplicar formato
            row[balanceColIdx] = formatBalanceToDots(testStr);
        }
    }

    const newWorksheet = xlsx.utils.aoa_to_sheet(rawData);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, sheetName);

    // Guardar reemplazando el archivo original de Juve (no el ordenado)
    xlsx.writeFile(newWorkbook, filePath);

    console.log(` ✅ Formateado a puntos aplicado a: JUVE CLIENTESZONA.xlsx`);

} catch (error) {
    console.error(` ❌ Error salvando JUVE Original:`, error.message);
}
