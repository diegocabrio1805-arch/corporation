const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const inputDir = 'D:\\ANEXO COBRO\\TODOS LOS CLIENTES';

// Función para limpiar el texto del saldo a un número real
// Ej: "1,116,000.00" -> 1116000
function parseBalance(balanceStr) {
    if (!balanceStr) return 0;
    // Quitamos espacios, comas y cualquier símbolo de moneda si lo hubiera
    const cleanStr = balanceStr.replace(/,/g, '').replace(/\$/g, '').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

async function processDirectory() {
    console.log(`Buscando archivos en: ${inputDir}`);

    if (!fs.existsSync(inputDir)) {
        console.error("El directorio no existe.");
        return;
    }

    const files = fs.readdirSync(inputDir);
    const docxFiles = files.filter(f => f.toLowerCase().endsWith('.docx') && !f.startsWith('~$'));

    for (const file of docxFiles) {
        const inputFilePath = path.join(inputDir, file);
        // Sobreescribir el mismo ORDENADO o crear uno nuevo
        const outputFilePath = path.join(inputDir, `${path.parse(file).name}_ORDENADO.xlsx`);

        try {
            const result = await mammoth.extractRawText({ path: inputFilePath });
            const lines = result.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let dataRows = [];
            let isSixColumns = false;
            let startIndex = 0;

            // Buscar inicio de datos detectando los headers
            for (let i = 0; i < 15; i++) {
                if (lines[i] === '#' && lines[i + 1] === 'IDENTIFICACIÓN') {
                    isSixColumns = true;
                    startIndex = i + 6;
                    break;
                }
                if (lines[i] === 'IDENTIFICACIÓN' && lines[i + 1] === 'NOMBRE') {
                    isSixColumns = false;
                    startIndex = i + 5;
                    break;
                }
            }

            if (startIndex === 0 && lines.length > 5) {
                startIndex = 5;
            }

            const step = isSixColumns ? 6 : 5;

            // Procesar en chunks
            for (let i = startIndex; i < lines.length - (step - 1); i += step) {
                if (lines[i].includes('TOTAL') || lines[i + 1] === undefined) break;

                const name = isSixColumns ? lines[i + 2] : lines[i + 1];
                const phone = isSixColumns ? lines[i + 3] : lines[i + 2];
                const quotas = isSixColumns ? lines[i + 4] : lines[i + 3];
                const balanceStr = isSixColumns ? lines[i + 5] : lines[i + 4];

                dataRows.push({
                    "Nombre": name,
                    "Numero Celular": phone,
                    "Cuota (Vencidas)": quotas,
                    "Saldo": balanceStr, // Guardamos como String original visualmente
                    "_numericBalance": parseBalance(balanceStr) // Campo oculto para ordenar
                });
            }

            if (dataRows.length > 0) {
                // ORDENAR: De Menor a Mayor (0 primero, y despues subiendo)
                dataRows.sort((a, b) => a._numericBalance - b._numericBalance);

                // Quitar la columna oculta antes de exportar
                const finalRows = dataRows.map(row => {
                    return {
                        "Nombre": row["Nombre"],
                        "Numero Celular": row["Numero Celular"],
                        "Cuota (Vencidas)": row["Cuota (Vencidas)"],
                        "Saldo": row["Saldo"]
                    }
                });

                const worksheet = xlsx.utils.json_to_sheet(finalRows);

                worksheet['!cols'] = [
                    { wch: 40 }, // Nombre
                    { wch: 15 }, // Celular
                    { wch: 15 }, // Cuota
                    { wch: 15 }  // Saldo
                ];

                const workbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(workbook, worksheet, "Clientes");
                xlsx.writeFile(workbook, outputFilePath);
                console.log(` ✅ Generado y ASCENDIDO: ${file} (${finalRows.length} clientes)`);
            }

        } catch (error) {
            console.error(` ❌ Error con ${file}:`, error.message);
        }
    }
    console.log("¡Terminado con orden por saldo numérico!");
}

processDirectory();
