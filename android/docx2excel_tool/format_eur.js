const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Todas las carpetas afectadas
const dirs = [
    'D:\\ANEXO COBRO\\TODOS LOS CLIENTES',
    'D:\\ANEXO COBRO\\publicidad'
];

// Ojo: el user pìdió el estandar europeo/paraguayo:
// Separador de miles: . (punto)
// Separador decimal: , (coma)
// Ejemplo: 8.550.000,00
function formatBalanceToEuroStyle(balanceStr) {
    if (!balanceStr) return "0.00";

    // Primero, limpiar cualquier basura pero sin dañar si es un string o num
    let cleanStr = String(balanceStr).replace(/\$/g, '').trim();

    // Si viene como "8.550.000.00" (la burrada que hicimos antes), volvamoslo numero base
    // Quitando PUNTOS y COMAS, PERO hay que detectar donde estaba el decimal.
    // Asumiremos que si termina en ".00" o ",00" son centavos.

    // Unificar a numero limpio en parseo nativo US (ej: 8550000.00)
    let asBaseString = cleanStr.replace(/,/g, '').replace(/\./g, '');

    // Si el original terminaba en .00 o ,00 que son 2 dec, debemos devolverle el decimal para float.
    if (cleanStr.endsWith('.00') || cleanStr.endsWith(',00')) {
        // En baseString '855000000', los ultimos dos son decimales, así que dividimos entre 100
        asBaseString = (parseInt(asBaseString) / 100).toString();
    }

    let num = parseFloat(asBaseString);
    if (isNaN(num)) return cleanStr; // devolver crudo si falla

    // Ahora, aplicamos el regex mágico para 8.550.000,00
    // toFixed(2) nos da ej: "8550000.00"
    let parts = num.toFixed(2).split('.');

    // parts[0] son los enteros ("8550000") -> le ponemos puntos cada 3: "8.550.000"
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    // Juntamos enteros y centavos usando una COMA: "8.550.000,00"
    return parts.join(',');
}

function processAllExcels() {
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) continue;

        const files = fs.readdirSync(dir);
        // Aplica a los de TODAS LAS ZONAS y también incluiremos el crudo de JUVE que ya ordenamos
        const excelFiles = files.filter(f => (f.endsWith('_ORDENADO.xlsx') || f === 'JUVE CLIENTESZONA.xlsx') && !f.startsWith('~$'));

        for (const file of excelFiles) {
            const filePath = path.join(dir, file);
            console.log(`Aplicando estilo '8.550.000,00' en: ${file}`);

            try {
                const workbook = xlsx.readFile(filePath);
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];

                // Si es JUVE original (sin ordenado), no usamos headers por los nombres raros.
                if (file === 'JUVE CLIENTESZONA.xlsx') {
                    const rawData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
                    // Buscar columna de Saldo
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
                    if (balIdx === -1) balIdx = 8; // default juve

                    for (let i = 1; i < rawData.length; i++) {
                        if (rawData[i] && rawData[i][balIdx] !== undefined && !String(rawData[i][balIdx]).toLowerCase().includes('saldo')) {
                            rawData[i][balIdx] = formatBalanceToEuroStyle(rawData[i][balIdx]);
                        }
                    }
                    const newWs = xlsx.utils.aoa_to_sheet(rawData);
                    const newWb = xlsx.utils.book_new();
                    xlsx.utils.book_append_sheet(newWb, newWs, sheetName);
                    xlsx.writeFile(newWb, filePath);
                    console.log(` ✅ Hecho en CRÚDO: ${file}`);
                    continue;
                }

                // Si son los ORDENADOS (1 al 4 o Juve ordenado)
                let dataRows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
                if (dataRows.length === 0) continue;

                for (let row of dataRows) {
                    if (row["Saldo"] !== undefined) {
                        row["Saldo"] = formatBalanceToEuroStyle(row["Saldo"]);
                    } else if (row["SALDO TOTAL"] !== undefined) {
                        row["SALDO TOTAL"] = formatBalanceToEuroStyle(row["SALDO TOTAL"]);
                    }
                }

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

                console.log(` ✅ Hecho en: ${file}`);
            } catch (error) {
                console.error(` ❌ Error en ${file}:`, error.message);
            }
        }
    }
    console.log("¡Todo procesado con formato: 8.550.000,00!");
}

processAllExcels();
