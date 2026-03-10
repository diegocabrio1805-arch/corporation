const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const inputFilePath = 'D:\\ANEXO COBRO\\publicidad\\JUVE CLIENTESZONA.xlsx';
const outputFilePath = 'D:\\ANEXO COBRO\\publicidad\\JUVE CLIENTESZONA_ORDENADO.xlsx';

function parseBalance(balanceStr) {
    if (!balanceStr) return 0;
    const cleanStr = String(balanceStr).replace(/,/g, '').replace(/\$/g, '').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

function formatPhone(phone) {
    if (!phone) return "";
    let cleanPhone = String(phone).replace(/\s+/g, '').trim();

    // Si ya empieza con 595 o +595 lo dejamos igual
    if (cleanPhone.startsWith('+595')) return cleanPhone;
    if (cleanPhone.startsWith('595')) return '+' + cleanPhone;

    // Si empieza con 09, lo reemplazamos por +5959
    if (cleanPhone.startsWith('09')) {
        return '+595' + cleanPhone.substring(1); // Quitar el 0 inicial
    }

    // Si empieza con 9, agregar el prefijo +595
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

        // Convertir Excel a JSON
        // Utilizamos raw: false para intentar obtener los strings formateados, pero manejaremos los numeros
        let dataRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

        if (dataRows.length === 0) {
            console.log("El Excel está vacío.");
            return;
        }

        // Asumiendo que las columnas se llaman igual o parecidas ('Nombre', 'Numero Celular', etc)
        // Detectar los nombres reales de las columnas en la fila 1
        const keys = Object.keys(dataRows[0]);
        const nameCol = keys.find(k => k.toLowerCase().includes('nombre')) || keys[0];
        const phoneCol = keys.find(k => k.toLowerCase().includes('celular') || k.toLowerCase().includes('tele')) || keys[1];
        const balanceCol = keys.find(k => k.toLowerCase().includes('saldo')) || keys[keys.length - 1];

        console.log(`Columnas detectadas -> Nombre: '${nameCol}', Celular: '${phoneCol}', Saldo: '${balanceCol}'`);

        const processedRows = dataRows.map(row => {
            const rawBalance = row[balanceCol];
            row["_numericBalance"] = parseBalance(rawBalance);

            // Formatear celular
            if (row[phoneCol]) {
                row[phoneCol] = formatPhone(row[phoneCol]);
            }

            return row;
        });

        // Ordenar Ascendente (0 primero)
        processedRows.sort((a, b) => a._numericBalance - b._numericBalance);

        // Limpiar campo temporal
        processedRows.forEach(row => delete row["_numericBalance"]);

        const newWorksheet = xlsx.utils.json_to_sheet(processedRows);

        // Ajustar anchos
        newWorksheet['!cols'] = [
            { wch: 40 }, // Nombre
            { wch: 20 }, // Celular
            { wch: 15 }, // Cuota
            { wch: 15 }  // Saldo
        ];

        const newWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "Clientes Formateados");
        xlsx.writeFile(newWorkbook, outputFilePath);

        console.log(` ✅ Generado y ASCENDIDO con Teléfonos +595: ${outputFilePath} (${processedRows.length} clientes)`);

    } catch (error) {
        console.error(` ❌ Error procesando el Excel:`, error.message);
    }
}

processExcel();
