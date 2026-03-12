const xlsx = require('xlsx');
const fs = require('fs');

const inputPath = 'C:/Users/DANIEL/Documents/JUVE CLIENTES.xlsx';
const outputPath = 'C:/Users/DANIEL/Desktop/JUVE_CLIENTES_ORDENADO.xlsx';

if (!fs.existsSync(inputPath)) {
    console.error("El archivo no existe en: " + inputPath);
    process.exit(1);
}

console.log("Leyendo archivo Excel...");
const wb = xlsx.readFile(inputPath);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

let clientesData = [];

// Función para intentar convertir a número. Ej: "45,000.00" -> 45000
function parseAmount(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleanVal = val.replace(/,/g, '').trim();
        const num = parseFloat(cleanVal);
        if (!isNaN(num) && num > 0) return num;
    }
    return null;
}

for (let r = 0; r < data.length; r++) {
    const row = data[r];
    if (!row) continue;
    
    for (let c = 0; c < row.length - 1; c++) {
        const val1 = row[c];
        const val2 = row[c+1];
        
        if (typeof val1 === 'string' && val1.trim() !== '') {
            const up1 = val1.toUpperCase().trim();
            // Evitar palabras clave de resumen
            if (up1.includes('TOTAL') || ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO', 'CLIENTE', 'EFECTIVO'].includes(up1)) {
                continue;
            }
            
            const amount = parseAmount(val2);
            if (amount !== null) {
                // Quitarles la hora " - ( 13:08 PM )" para dejarlos limpios, si se desea. 
                // Pero el usuario quizás quiera la hora. La dejaremos tal cual.
                clientesData.push({
                    Cliente: val1.trim(),
                    Efectivo: amount
                });
                c++; // Saltar la columna analizada
            }
        }
    }
}

console.log(`Se encontraron ${clientesData.length} registros válidos.`);

const consolidados = {};
let totalGeneral = 0;

for (const reg of clientesData) {
    if (!consolidados[reg.Cliente]) consolidados[reg.Cliente] = 0;
    consolidados[reg.Cliente] += reg.Efectivo;
    totalGeneral += reg.Efectivo;
}

const finalArray = Object.keys(consolidados).map(k => ({
    Cliente: k,
    Efectivo: consolidados[k]
}));

// Orden alfabético
finalArray.sort((a, b) => a.Cliente.localeCompare(b.Cliente));

const newWb = xlsx.utils.book_new();

const outputData = [
    ['RECAUDACIÓN JUVE CLIENTES'],
    [],
    ['CLIENTE', 'EFECTIVO', '']
];

for (const reg of finalArray) {
    outputData.push([reg.Cliente, reg.Efectivo]);
}

outputData.push([]);
outputData.push(['TOTAL A RENDIR:', totalGeneral]);

const newSheet = xlsx.utils.aoa_to_sheet(outputData);
newSheet['!cols'] = [{ wch: 60 }, { wch: 20 }];

xlsx.utils.book_append_sheet(newWb, newSheet, 'Ordenado y Calculado');
xlsx.writeFile(newWb, outputPath);
console.log(`¡Archivo guardado exitosamente en: ${outputPath}!`);
