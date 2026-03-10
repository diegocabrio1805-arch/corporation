const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');

const inputDir = 'D:\\ANEXO COBRO\\TODOS LOS CLIENTES';

async function analyzeDoc() {
    const docPath = path.join(inputDir, 'TOTAL CLIENTES ZONA 3.docx');
    console.log(`Extrayendo texto de prueba de: ${docPath}`);

    try {
        const result = await mammoth.extractRawText({ path: docPath });
        const text = result.value;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

        console.log("=== PRIMERAS 50 LÍNEAS DEL DOCUMENTO PARA ENTENDER PATRONES ===");
        for (let i = 0; i < Math.min(50, lines.length); i++) {
            console.log(`[${i}] ${lines[i]}`);
        }
    } catch (e) {
        console.error(e);
    }
}
analyzeDoc();
