const xlsx = require('xlsx');
const fs = require('fs');

const inputPath = 'C:/Users/DANIEL/Documents/JUVE CLIENTES.xlsx';
const outputPath = 'C:/Users/DANIEL/Desktop/JUVE_CLIENTES_FORMATO_ORIGINAL.xlsx';

if (!fs.existsSync(inputPath)) {
    console.error("El archivo no existe en: " + inputPath);
    process.exit(1);
}

console.log("Leyendo archivo original para darle el formato exacto del usuario...");
const wb = xlsx.readFile(inputPath);
const sheetName = wb.SheetNames[0];

// Usamos defval: '' para evitar nulls que complican los reemplazos
const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });

// Parsear montos
function parseAmount(val) {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const cleanVal = val.replace(/,/g, '').trim();
        const num = parseFloat(cleanVal);
        if (!isNaN(num) && num > 0) return num;
    }
    return 0;
}

// Blocks identification
// Buscamos todas las filas que en la primera columna digan "LUNES" o algo similar para identificar inicio de semana
let blockStarts = [];
for (let i = 0; i < data.length; i++) {
    const col0 = String(data[i][0] || '').trim().toUpperCase();
    if (col0.startsWith('LUNES') && col0 !== 'LUNES') {
        // En row 2 el inicio es "LUNES " pero a veces es "LUNES 2", "LUNES 9"
        blockStarts.push(i);
    } else if (col0 === 'LUNES') {
         blockStarts.push(i);
    }
}

// Ahora procesamos cada bloque
blockStarts.forEach((startRow, index) => {
    // Si es el primer bloque (el que ya hizo el usuario), podemos saltarlo o resumarlo.
    // El prompt indica "aplicar los cálculos con el resto", podemos aplicarlo a todos o desde el segundo
    // Si lo aplicamos a todos nos aseguramos de que todo esté igual y calculos frescos y correctos.
    
    // El mes suele estar 2 filas arriba (o cerca) en la columna 0.
    let _mes = '';
    if (startRow >= 2) {
        let textM = String(data[startRow - 2][0] || '').trim();
        if (textM) _mes = textM;
    }
    
    // Obtenemos último row con datos en este bloque (hasta el prox bloque o fin de archivo o fin real de data)
    let endLimit = index < blockStarts.length - 1 ? blockStarts[index + 1] - 4 : data.length;
    
    // Recolectar datos y sumas
    let sums = [0, 0, 0, 0, 0, 0]; // L, M, Mi, J, V, S
    let lastDataRowOffset = startRow + 2; // Por si está vacío

    for (let r = startRow + 2; r < endLimit; r++) {
        if (!data[r]) continue;
        
        let hasData = false;
        // Revisar las 6 columnas de montos: 1, 4, 7, 10, 13, 16
        [1, 4, 7, 10, 13, 16].forEach((cIndex, dIndex) => {
            const valName = String(data[r][cIndex - 1] || '').trim().toUpperCase();
            const val = parseAmount(data[r][cIndex]);
            if (val > 0 && !valName.includes("TOTAL") && !valName.includes("DESCUENTO") && !valName.includes("RENDIR")) {
                sums[dIndex] += val;
                hasData = true;
            }
        });
        
        // Si hay datos reales (no labels de TOTAL que el usuario pudo haber dejado a medias)
        if (hasData) {
            lastDataRowOffset = Math.max(lastDataRowOffset, r);
        }
    }
    
    // Añadiremos las filas de TOTAL debajo del ultimo dato
    let totalRow = lastDataRowOffset + 2;
    
    // Asegurarnos que existan las filas en el arreglo (agregarlas si hace falta)
    while (data.length <= totalRow + 4) {
        data.push(Array(24).fill(''));
    }
    
    // Limpiamos esas filas por si tenian basura anterior
    const labelRows = [totalRow, totalRow+1, totalRow+2];
    labelRows.forEach(r => {
        if (!data[r]) data[r] = Array(24).fill('');
        for(let c=0; c<=16; c++) if (data[r][c] === undefined) data[r][c] = '';
    });

    [0, 3, 6, 9, 12, 15].forEach((cIndex, dIndex) => {
        data[totalRow][cIndex] = 'TOTAL';
        data[totalRow][cIndex + 1] = sums[dIndex] > 0 ? sums[dIndex] : '';
        
        data[totalRow + 1][cIndex] = 'DESCUENTO';
        data[totalRow + 1][cIndex + 1] = '';
        
        data[totalRow + 2][cIndex] = 'TOTAL A RENDIR';
        data[totalRow + 2][cIndex + 1] = sums[dIndex] > 0 ? sums[dIndex] : ''; // (Total - descuento)
    });
    
    // Construir tabla lateral de resumen (Columnas T y U -> indices 19 y 20)
    let summaryStart = startRow + 2;
    for(let r = summaryStart; r < summaryStart + 18; r++) {
        if (!data[r]) data[r] = Array(24).fill('');
    }
    
    const dLabels = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    
    data[summaryStart][19] = _mes;
    data[summaryStart][20] = '';
    
    let totalAll = 0;
    dLabels.forEach((lbl, i) => {
        data[summaryStart + 1 + i][19] = lbl;
        data[summaryStart + 1 + i][20] = sums[i] > 0 ? sums[i] : 'FERIADO';
        totalAll += sums[i];
    });
    
    data[summaryStart + 8][19] = 'TOTAL A RENDIR';
    data[summaryStart + 8][20] = totalAll;
    
    data[summaryStart + 12][19] = 'TOTAL EFECTIVO';
    data[summaryStart + 12][20] = totalAll;
});

// Guardar
const newWb = xlsx.utils.book_new();
const newSheet = xlsx.utils.aoa_to_sheet(data);

// Estilos de visualización básicos para ensanchar y que se vea igual
newSheet['!cols'] = [];
for (let i=0; i<24; i++) {
    if ([0,3,6,9,12,15].includes(i)) {
        newSheet['!cols'].push({ wch: 45 }); // Nombres de clientes
    } else if ([1,4,7,10,13,16].includes(i)) {
        newSheet['!cols'].push({ wch: 15 }); // Montos
    } else if (i === 19) {
        newSheet['!cols'].push({ wch: 20 }); // Lateral label
    } else if (i === 20) {
        newSheet['!cols'].push({ wch: 15 }); // Lateral sum
    } else {
        newSheet['!cols'].push({ wch: 2 });  // Espacios
    }
}

xlsx.utils.book_append_sheet(newWb, newSheet, 'Mismo Formato Usuario');
xlsx.writeFile(newWb, outputPath);
console.log(`¡Archivo idéntico completado y guardado en: ${outputPath}!`);
