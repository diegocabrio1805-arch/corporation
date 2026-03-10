const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Todas las carpetas afectadas
const dirs = [
    'D:\\ANEXO COBRO\\TODOS LOS CLIENTES',
    'D:\\ANEXO COBRO\\publicidad'
];

// Formato de miles con puntos, sin decimales.
// Ejemplo: 8.550.000
function formatBalanceNoDecimals(balanceStr) {
    if (!balanceStr) return "0";

    let cleanStr = String(balanceStr).replace(/\$/g, '').trim();

    // Obtenemos un número puro sin comas ni puntos de formato anterior
    let asBaseString = cleanStr.replace(/,/g, '').replace(/\./g, '');

    // Si viene de nuestros procesamientos anteriores que tenían decimales (.00 o ,00)
    // necesitamos dividir entre 100 para obtener el entero real.
    if (cleanStr.endsWith('.00') || cleanStr.endsWith(',00')) {
        asBaseString = (parseInt(asBaseString) / 100).toString();
    }

    let num = parseFloat(asBaseString);
    if (isNaN(num)) return cleanStr;

    // Obtenemos solo la parte entera
    let numStr = Math.floor(num).toString();

    // Agregamos puntos como separador de miles
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function processAllExcels() {
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        // Aplica a TODOS LOS ORDENADOS y al JUVE CRÚDO
        const excelFiles = files.filter(f => (f.endsWith('_ORDENADO.xlsx') || f === 'JUVE CLIENTESZONA.xlsx') && !f.startsWith('~$'));

        for (const file of excelFiles) {
            const filePath = path.join(dir, file);
            console.log(`Eliminando decimales en: ${file}`);

            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Tratar el JUVE original
                if (file === 'JUVE CLIENTESZONA.xlsx') {
                    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    let balIdx = -1;
                    for (let i = 0; i < Math.min(10, rawData.length); i++) {
                        if (!rawData[i]) continue;
                        for (let j = 0; j < rawData[i].length; j++) {
                            if (String(rawData[i][j]).toLowerCase().includes('saldo')) {
                                balIdx = j; break;
                            }
                        }
                        if (balIdx !== -1) break;
                    }
                    if (balIdx === -1) balIdx = 8;

                    for (let i = 1; i < rawData.length; i++) {
                        if (rawData[i] && rawData[i][balIdx] !== undefined && !String(rawData[i][balIdx]).toLowerCase().includes('saldo')) {
                            rawData[i][balIdx] = formatBalanceNoDecimals(rawData[i][balIdx]);
                        }
                    }
                    const newWs = xlsx.utils.aoa_to_sheet(rawData);
                    const newWb = xlsx.utils.book_new();
                    xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
                    xlsx.writeFile(newWb, filePath);
                    console.log(` ✅ Sin decimales en CRÚDO: ${file}`);
                    continue;
                }

                // Tratar los demas
                let dataRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
                if (dataRows.length === 0) continue;

                for (let row of dataRows) {
                    if (row["Saldo"] !== undefined) {
                        row["Saldo"] = formatBalanceNoDecimals(row["Saldo"]);
                    } else if (row["SALDO TOTAL"] !== undefined) {
                        row["SALDO TOTAL"] = formatBalanceNoDecimals(row["SALDO TOTAL"]);
                    }
                }

                const newWorksheet = xlsx.utils.json_to_sheet(dataRows);
                newWorksheet['!cols'] = [
                    { wch: 40 }, // Nombre
                    { wch: 20 }, // Celular
                    { wch: 15 }, // Cuota
                    { wch: 20 }  // Saldo sin decimales
                ];

                const newWorkbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, "Clientes Formateados");
                xlsx.writeFile(newWorkbook, filePath);

                console.log(` ✅ Sin decimales en: ${file}`);
            } catch (error) {
                console.error(` ❌ Error en ${file}:`, error.message);
            }
        }
    }
    console.log("¡Todos los saldos actualizados al formato 8.550.000 (Sin decimales)!");
}

processAllExcels();
