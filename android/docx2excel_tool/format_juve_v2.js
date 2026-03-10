const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const inputFilePath = 'D:\\ANEXO COBRO\\publicidad\\JUVE CLIENTESZONA.xlsx';
const outputFilePath = 'D:\\ANEXO COBRO\\publicidad\\JUVE CLIENTESZONA_ORDENADO.xlsx';

function parseBalance(balanceStr) {
    if (!balanceStr) return 0;
    const cleanStr = String(balanceStr).replace(/,/g, '').replace(/\$/g, '').replace(/[^\d.-]/g, '').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

function formatPhone(phone) {
    if (!phone) return "";
    let cleanPhone = String(phone).replace(/\s+/g, '').replace(/-/g, '').trim();

    if (cleanPhone.startsWith('+595')) return cleanPhone;
    if (cleanPhone.startsWith('595')) return '+' + cleanPhone;

    if (cleanPhone.startsWith('09')) {
        return '+595' + cleanPhone.substring(1);
    }
    if (cleanPhone.startsWith('9')) {
        return '+595' + cleanPhone;
    }
    return cleanPhone;
}

function processExcel() {
    console.log(`Procesando archivo: ${inputFilePath}`);

    if (!fs.existsSync(inputFilePath)) {
        console.error("El archivo no existe.");
        return;
    }

    try {
        const workbook = xlsx.readFile(inputFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Obtener arreglo de arreglos (header: 1) para evadir nombres de columnas feos
        const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

        if (rawData.length < 2) {
            console.log("El Excel no tiene datos suficientes.");
            return;
        }

        // Buscar en las primeras 5 filas donde esta la cabecera real
        let headerRowIndex = 0;
        let nameColIdx = -1, phoneColIdx = -1, balanceColIdx = -1, duesColIdx = -1;

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            const row = rawData[i];
            if (!row) continue;

            for (let j = 0; j < row.length; j++) {
                const cell = String(row[j]).toLowerCase();
                if (cell.includes('nombre') || cell.includes('cliente')) nameColIdx = j;
                if (cell.includes('celular') || cell.includes('telef')) phoneColIdx = j;
                if (cell.includes('vencida') || cell.includes('cuota')) duesColIdx = j;
                if (cell.includes('saldo') || cell.includes('total')) balanceColIdx = j;
            }

            // Si encontramos al menos Nombre y Saldo, asumimos que esta es la fila
            if (nameColIdx !== -1 && balanceColIdx !== -1) {
                headerRowIndex = i;
                break;
            }
        }

        // Si no detectó por nombres obvios asume indices standar para tablas exportadas (1=Nombre, 3=Tel, etc)
        if (nameColIdx === -1) nameColIdx = 1;
        if (phoneColIdx === -1) phoneColIdx = 2;
        if (duesColIdx === -1) duesColIdx = 3;
        if (balanceColIdx === -1) balanceColIdx = 4; // Por tirar algo, ajustable

        console.log(`Indices detectados (Fila ${headerRowIndex}): Nombre[${nameColIdx}] Cel[${phoneColIdx}] Cuotas[${duesColIdx}] Saldo[${balanceColIdx}]`);

        let structuredData = [];

        // Leer datos desde la fila siguiente a la cabecera
        for (let i = headerRowIndex + 1; i < rawData.length; i++) {
            const row = rawData[i];
            if (!row || row.length === 0 || !row[nameColIdx]) continue; // Saltar vacias o sin nombre

            const rawPhone = row[phoneColIdx] !== undefined ? row[phoneColIdx] : "";
            const rawBalance = row[balanceColIdx] !== undefined ? row[balanceColIdx] : "0";

            structuredData.push({
                "Nombre": String(row[nameColIdx]).trim(),
                "Numero Celular": formatPhone(rawPhone),
                "Cuotas Vencidas": row[duesColIdx] !== undefined ? String(row[duesColIdx]).trim() : "0",
                "Saldo": String(rawBalance).trim(),
                "_numericBalance": parseBalance(rawBalance)
            });
        }

        // ELIMINAR DUPLICADOS
        const uniqueRowsMap = new Map();
        structuredData.forEach(row => {
            const sig = `${row["Nombre"]}_${row["Numero Celular"]}_${row["Saldo"]}`.toLowerCase();
            if (!uniqueRowsMap.has(sig)) {
                uniqueRowsMap.set(sig, row);
            }
        });
        const finalData = Array.from(uniqueRowsMap.values());

        // ORDENAR: $0 primero
        finalData.sort((a, b) => a._numericBalance - b._numericBalance);

        // Quitar campo oculto
        finalData.forEach(r => delete r["_numericBalance"]);

        const newWorksheet = xlsx.utils.json_to_sheet(finalData);
        newWorksheet['!cols'] = [
            { wch: 40 }, // Nombre
            { wch: 20 }, // Celular
            { wch: 15 }, // Cuota
            { wch: 15 }  // Saldo
        ];

        const newWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "Clientes Formateados");
        xlsx.writeFile(newWorkbook, outputFilePath);

        console.log(` ✅ Transformado, Formateado y ASCENDIDO: ${outputFilePath} (${finalData.length} clientes efectivos)`);

    } catch (error) {
        console.error(` ❌ Error procesando el Excel:`, error.message);
    }
}

processExcel();
