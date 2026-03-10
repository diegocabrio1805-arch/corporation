const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const inputDir = 'D:\\ANEXO COBRO\\TODOS LOS CLIENTES';

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

            // Buscar inicio de datos detectando los headers
            for (let i = 0; i < 15; i++) {
                if (lines[i] === '#' && lines[i + 1] === 'IDENTIFICACIÓN') {
                    isSixColumns = true;
                    startIndex = i + 6; // Saltar los 6 headers
                    break;
                }
                if (lines[i] === 'IDENTIFICACIÓN' && lines[i + 1] === 'NOMBRE') {
                    isSixColumns = false;
                    startIndex = i + 5; // Saltar los 5 headers
                    break;
                }
            }

            // Si por alguna razon no lo encontro bien
            if (startIndex === 0 && lines.length > 5) {
                console.log(`No se encontraron encabezados estandar en ${file}, intentando forzar 5 columnas.`);
                startIndex = 5;
            }

            const step = isSixColumns ? 6 : 5;

            // Procesar en chunks de N
            for (let i = startIndex; i < lines.length - (step - 1); i += step) {
                // Validación para no pasarse de la raya o pillar pies de página
                if (lines[i].includes('TOTAL') || lines[i + 1] === undefined) break;

                if (isSixColumns) {
                    dataRows.push({
                        "Nombre": lines[i + 2],
                        "Numero Celular": lines[i + 3],
                        "Cuota (Vencidas)": lines[i + 4],
                        "Saldo": lines[i + 5]
                    });
                } else {
                    dataRows.push({
                        "Nombre": lines[i + 1],
                        "Numero Celular": lines[i + 2],
                        "Cuota (Vencidas)": lines[i + 3],
                        "Saldo": lines[i + 4]
                    });
                }
            }

            if (dataRows.length > 0) {
                const worksheet = xlsx.utils.json_to_sheet(dataRows);

                // Ajustar ancho de columnas para que se vea mas lindo
                worksheet['!cols'] = [
                    { wch: 40 }, // Nombre
                    { wch: 15 }, // Celular
                    { wch: 15 }, // Cuota
                    { wch: 15 }  // Saldo
                ];

                const workbook = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(workbook, worksheet, "Clientes");
                xlsx.writeFile(workbook, outputFilePath);
                console.log(` ✅ Convertido y arreglado en vertical: ${file} (${dataRows.length} clientes)`);
            } else {
                console.log(` ⚠️ No se pudo formatear ${file}`);
            }

        } catch (error) {
            console.error(` ❌ Error con ${file}:`, error.message);
        }
    }
    console.log("¡Todo convertido a Excel vertical con columnas correctamente!");
}

processDirectory();
