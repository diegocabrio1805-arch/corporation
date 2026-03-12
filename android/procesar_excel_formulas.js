const xlsx = require('xlsx');
const fs = require('fs');

const inputPath = 'C:/Users/DANIEL/Documents/JUVE CLIENTES.xlsx';
const outputPath = 'C:/Users/DANIEL/Desktop/JUVE_CLIENTES_FORMULAS_EXACTAS.xlsx';

if (!fs.existsSync(inputPath)) {
    console.error("El archivo no existe en: " + inputPath);
    process.exit(1);
}

console.log("Generando planilla con formulas...");
const wb = xlsx.readFile(inputPath, {cellFormula: true});
const sheetName = wb.SheetNames[0];

// Leemos manteniendo la estructura JSON de arreglos (header: 1)
const data = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });


// Función auxiliar para pasar de índice de columna a Letra (0->A, 1->B, 25->Z, 26->AA)
function colToLetter(index) {
    let letter = '';
    let temp = index;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

// Identificamos los bloques como antes
let blockStarts = [];
for (let i = 0; i < data.length; i++) {
    const col0 = String(data[i][0] || '').trim().toUpperCase();
    if (col0.startsWith('LUNES') && col0 !== 'LUNES') {
        blockStarts.push(i);
    } else if (col0 === 'LUNES') {
        blockStarts.push(i);
    }
}

// Data output structure (construiremos hoja celda por celda)
// En vez de generar data bidimensional simple, vamos a construir todo el sheet
let finalData = [];

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

blockStarts.forEach((startRow, index) => {
    let _mes = startRow >= 2 ? String(data[startRow - 2][0] || '').trim() : '';
    let endLimit = index < blockStarts.length - 1 ? blockStarts[index + 1] - 4 : data.length;
    
    // Obtenemos último row con datos
    let lastDataRowOffset = startRow + 2; 

    for (let r = startRow + 2; r < endLimit; r++) {
        if (!data[r]) continue;
        let hasData = false;
        [1, 4, 7, 10, 13, 16].forEach(cIndex => {
            const valName = String(data[r][cIndex - 1] || '').trim().toUpperCase();
            if (parseAmount(data[r][cIndex]) > 0 && !valName.includes("TOTAL") && !valName.includes("DESCUENTO") && !valName.includes("RENDIR") && !valName.includes("FEBRERO")) {
                hasData = true;
            }
        });
        if (hasData) lastDataRowOffset = Math.max(lastDataRowOffset, r);
    }
    
    // Total rows location
    let rowStartData = startRow + 2;
    let rowEndData = lastDataRowOffset;
    let totalRow = lastDataRowOffset + 2;
    
    // Primero, copiamos las filas de este bloque hasta el final de sus datos
    // Respetamos los row index
    for(let r = startRow - 2; r <= rowEndData; r++) {
        if(r < 0) continue;
        finalData[r] = data[r] || Array(24).fill('');
    }
    
    // Insertamos totales (formulas sumatorias) en la parte inferior de los dias
    let formulaRow1 = totalRow;     // TOTAL
    let formulaRow2 = totalRow + 1; // DESCUENTO
    let formulaRow3 = totalRow + 2; // TOTAL A RENDIR
    
    finalData[formulaRow1] = Array(24).fill('');
    finalData[formulaRow2] = Array(24).fill('');
    finalData[formulaRow3] = Array(24).fill('');

    const colsMontos = [1, 4, 7, 10, 13, 16]; 
    
    colsMontos.forEach((cIndex) => {
        let colLetraMonto = colToLetter(cIndex);
        let colLetraDesc = colToLetter(cIndex + 1); // La columna de la derecha para descuentos
        
        finalData[formulaRow1][cIndex - 1] = 'TOTAL';
        // Ej: SUM(B4:B15)
        finalData[formulaRow1][cIndex] = { f: `SUM(${colLetraMonto}${rowStartData+1}:${colLetraMonto}${rowEndData+1})` };
        
        finalData[formulaRow2][cIndex - 1] = 'DESCUENTO';
        // El usuario suma la columna adyacente vacía: Ej: SUM(C4:C15)
        finalData[formulaRow2][cIndex] = { f: `SUM(${colLetraDesc}${rowStartData+1}:${colLetraDesc}${rowEndData+1})` };
        
        finalData[formulaRow3][cIndex - 1] = 'TOTAL A RENDIR';
        // Formula de resta: =B18 - B19 (Total - Descuento sumado)
        finalData[formulaRow3][cIndex] = { f: `${colLetraMonto}${formulaRow1+1}-${colLetraMonto}${formulaRow2+1}` }; 
    });
    
    // Construir tabla lateral SUMARIA (Columnas T (19) y U (20))
    let summaryStart = startRow + 2;
    
    // Rellenamos vacios si la tabla de resumen es más larga que los datos
    for(let r = summaryStart; r < summaryStart + 18; r++) {
        if (!finalData[r]) finalData[r] = Array(24).fill('');
    }
    
    const dLabels = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
    
    finalData[summaryStart][19] = _mes; // mes 
    
    // Fila 19 a la 24 (Lunes a Sábado sumas)
    dLabels.forEach((lbl, i) => {
        let rSum = summaryStart + 1 + i;
        finalData[rSum][19] = lbl;
        
        let colMontoIdx = colsMontos[i];
        let cLetraMonto = colToLetter(colMontoIdx);
        // Vinculamos la celda de resumen U directamente a la formula del TOTAL A RENDIR del día correspondiente
        finalData[rSum][20] = { f: `${cLetraMonto}${formulaRow3+1}` }; 
    });
    
    // TOTAL A RENDIR TODO (U18 en el ejemplo = sum(U11:U16))
    // Adaptado dinámicamente:
    let rTotalRendirSummary = summaryStart + 8;
    finalData[rTotalRendirSummary][19] = 'TOTAL A RENDIR';
    finalData[rTotalRendirSummary][20] = { f: `SUM(U${summaryStart+2}:U${summaryStart+7})` };
    
    // TOTAL EFECTIVO FINAL (U22 en ejemplo = U18 - X22)
    // Para simplificar, U18 (rTotalRendirSummary+1) a menos que detectemos X22
    let rTotalEfectivo = summaryStart + 12;
    finalData[rTotalEfectivo][19] = 'TOTAL EFECTIVO';
    finalData[rTotalEfectivo][20] = { f: `U${rTotalRendirSummary+1}` }; 

});

// A partir de finalData crearemos el sheet manual para inyectar formulas adecuadamente
const newSheet = {};
let range = { s: { c: 0, r: 0 }, e: { c: 23, r: finalData.length - 1 } };

for (let R = 0; R < finalData.length; R++) {
    let row = finalData[R];
    if (!row) continue;
    for (let C = 0; C < 24; C++) {
        let val = row[C];
        if (val === '' || val === undefined || val === null) continue;
        
        let cellRef = xlsx.utils.encode_cell({ c: C, r: R });
        let cell = {};
        
        if (typeof val === 'object' && val.f) {
            cell.f = val.f;
            cell.t = 'n'; // Numeric (resultado de formula es usualmente num)
        } else if (typeof val === 'number') {
            cell.v = val;
            cell.t = 'n';
        } else {
            cell.v = val;
            cell.t = 's';
        }
        newSheet[cellRef] = cell;
    }
}
newSheet['!ref'] = xlsx.utils.encode_range(range);

// Anchos de columna
newSheet['!cols'] = [];
for (let i=0; i<24; i++) {
    if ([0,3,6,9,12,15].includes(i)) newSheet['!cols'].push({ wch: 45 });
    else if ([1,4,7,10,13,16].includes(i)) newSheet['!cols'].push({ wch: 15 });
    else if (i === 19) newSheet['!cols'].push({ wch: 20 });
    else if (i === 20) newSheet['!cols'].push({ wch: 15 });
    else newSheet['!cols'].push({ wch: 2 });
}

const newWb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(newWb, newSheet, 'Formulas Replicadas');

xlsx.writeFile(newWb, outputPath);
console.log(`¡Archivo idéntico con fórmulas nativas guardado en: ${outputPath}!`);
