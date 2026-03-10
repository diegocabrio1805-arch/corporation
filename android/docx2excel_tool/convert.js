const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

const inputDir = 'D:\\ANEXO COBRO\\TODOS LOS CLIENTES';

async function processDirectory() {
    console.log(`Buscando archivos en: ${inputDir}`);

    if (!fs.existsSync(inputDir)) {
        console.error("El directorio no existe. Verifica la ruta.");
        return;
    }

    const files = fs.readdirSync(inputDir);
    const docxFiles = files.filter(f => f.toLowerCase().endsWith('.docx'));

    if (docxFiles.length === 0) {
        console.log("No se encontraron archivos .docx en la carpeta.");
        return;
    }

    console.log(`Encontrados ${docxFiles.length} archivos Word. Iniciando extracción...`);

    for (const file of docxFiles) {
        const inputFilePath = path.join(inputDir, file);
        const fileNameWithoutExt = path.parse(file).name;
        const outputFilePath = path.join(inputDir, `${fileNameWithoutExt}_CONVERTIDO.xlsx`);

        console.log(`\nProcesando: ${file}`);

        try {
            // Extraer solo texto crudo (mammoth.extractRawText es rapido y descarta imagenes)
            const result = await mammoth.extractRawText({ path: inputFilePath });
            const text = result.value;

            // Lógica de parseo: 
            // Asumiendo que el word es una lista pegada o saltos de linea. 
            // Vamos a dividir por linea, quitar vacios, y si lucen como datos (Monto, Cedula) estructurar un poco
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            // Si el Word era una tabla, Mammoth rawText normalmente intercala celda x celda.
            // Para asegurar máxima retención sin adivinar tablas complejas, lo pondremos todo en 1 pilar base
            // y luego agruparemos de a 1, o si vemos un patron.

            let dataRows = [];

            // Heuristica basica: Si hay un numero consecutivo tipo "1. " o "2. " es inicio de fila
            let currentRow = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Ignorar headers probables
                if (line.toUpperCase().includes('TOTAL CLIENTES') || line.includes('ZONA')) continue;

                // Metodo mas generico: Solo exportar fila por fila directo, el usuario podra ajustarlo
                dataRows.push({
                    "Dato_Extraido": line
                });
            }

            if (dataRows.length === 0) {
                console.log(` -> Advertencia: No se pudo extraer texto legible o estaba vacía.`);
                continue;
            }

            // Convertir a hoja Excel
            const worksheet = xlsx.utils.json_to_sheet(dataRows);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, "Clientes");

            // Guardar
            xlsx.writeFile(workbook, outputFilePath);
            console.log(` ✅ Convertido y guardado exitosamente como: ${outputFilePath}`);

        } catch (error) {
            console.error(` ❌ Error procesando ${file}:`, error.message);
        }
    }
    console.log("\nProceso finalizado. Revisa tu carpeta 'TODOS LOS CLIENTES'.");
}

processDirectory();
