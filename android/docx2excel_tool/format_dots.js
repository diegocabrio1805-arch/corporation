const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Carpetas donde generamos los Excels
const dirs = [
    'D:\\ANEXO COBRO\\TODOS LOS CLIENTES',
    'D:\\ANEXO COBRO\\publicidad'
];

function formatBalanceToDots(balanceStr) {
    if (!balanceStr) return "0.00";
    // Si ya viene numérico, lo pasamos a string
    let str = String(balanceStr).trim();

    // Si la cadena original tenía comas (ej. 8,550,000.00) las reemplazamos por puntos.
    // Ej: 8,550,000.00 -> 8.550.000.00
    // PERO, si es un número crudo de Excel como 8550000, le damos formato de miles con puntos y 2 decimales.

    // Veamos si es solo un número puro
    if (/^\d+(\.\d+)?$/.test(str) || typeof balanceStr === 'number') {
        const num = parseFloat(str);
        if (isNaN(num)) return str;

        // Formatear a locale aleman/español que usa puntos para miles y coma para decimales
        // Pero el usuario pidió 8.550.000.00 (punto para miles Y punto para decimal).
        // Haremos un formateo manual para asegurar exactamente lo que pidio.
        let parts = num.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return parts.join('.');
    }

    // Si es un String que sí tiene comas, las cambiamos todas por puntos
    if (str.includes(',')) {
        return str.replace(/,/g, '.');
    }

    return str;
}

function processAllExcels() {
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        // Filtrar solo los que ya ordenamos
        const excelFiles = files.filter(f => f.endsWith('_ORDENADO.xlsx') && !f.startsWith('~$'));

        for (const file of excelFiles) {
            const filePath = path.join(dir, file);
            console.log(`Cambiando formato numérico en: ${file}`);

            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                let dataRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });

                if (dataRows.length === 0) continue;

                // Modificar el saldo
                for (let row of dataRows) {
                    if (row["Saldo"] !== undefined) {
                        row["Saldo"] = formatBalanceToDots(row["Saldo"]);
                    } else if (row["SALDO TOTAL"] !== undefined) {
                        row["SALDO TOTAL"] = formatBalanceToDots(row["SALDO TOTAL"]);
                    }
                }

                // Generar de nuevo el excel
                const newWorksheet = xlsx.utils.json_to_sheet(dataRows);
                newWorksheet['!cols'] = [
                    { wch: 40 }, // Nombre
                    { wch: 20 }, // Celular
                    { wch: 15 }, // Cuota
                    { wch: 20 }  // Saldo
                ];

                const newWorkbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "Clientes Formateados");
                xlsx.writeFile(newWorkbook, filePath);

                console.log(` ✅ Formateado a puntos: ${file}`);
            } catch (error) {
                console.error(` ❌ Error en ${file}:`, error.message);
            }
        }
    }
    console.log("¡Todos los saldos actualizados al formato 8.550.000.00!");
}

processAllExcels();
