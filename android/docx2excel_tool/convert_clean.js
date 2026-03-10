const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const inputDir = 'D:\\ANEXO COBRO\\TODOS LOS CLIENTES';

function parseBalance(balanceStr) {
    if (!balanceStr) return 0;
    const cleanStr = balanceStr.replace(/,/g, '').replace(/\$/g, '').trim();
    const num = parseFloat(cleanStr);
    return isNaN(num) ? 0 : num;
}

// Función para generar un hash único por cliente para detectar duplicados
function getClientSignature(row) {
    // Si Nombre + Celular + Saldo son exactamente iguales, es un duplicado
    return `${row["Nombre"]}_${row["Numero Celular"]}_${row["Saldo"]}`.toLowerCase().trim();
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
        const outputFilePath = path.join(inputDir, `${path.parse(file).name}_ORDENADO.xlsx`);

        try {
            const result = await mammoth.extractRawText({ path: inputFilePath });
            const lines = result.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            let dataRows = [];
            let isSixColumns = false;
            let startIndex = 0;

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
            if (startIndex === 0 && lines.length > 5) startIndex = 5;

            const step = isSixColumns ? 6 : 5;

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
                    "Saldo": balanceStr,
                    "_numericBalance": parseBalance(balanceStr)
                });
            }

            if (dataRows.length > 0) {
                // 1. ELIMINAR DUPLICADOS
                const uniqueRowsMap = new Map();
                let duplicatesRemoved = 0;

                dataRows.forEach(row => {
                    const sig = getClientSignature(row);
                    if (!uniqueRowsMap.has(sig)) {
                        uniqueRowsMap.set(sig, row);
                    } else {
                        duplicatesRemoved++;
                    }
                });

                const uniqueDataRows = Array.from(uniqueRowsMap.values());

                // 2. ORDENAR POR SALDO ASCENDENTE
                uniqueDataRows.sort((a, b) => a._numericBalance - b._numericBalance);

                // 3. LIMPIAR ETIQUETAS INTERNAS
                const finalRows = uniqueDataRows.map(row => {
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

                console.log(` ✅ Listo: ${file} | Guardados: ${finalRows.length} | Duplicados borrados: ${duplicatesRemoved}`);
            }

        } catch (error) {
            console.error(` ❌ Error con ${file}:`, error.message);
        }
    }
    console.log("¡Terminado! Todos los archivos fueron limpiados de duplicados y ordenados.");
}

processDirectory();
