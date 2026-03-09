const { parseAmount } = require('./utils/helpers.ts');

const testValues = [
    "1.500.000",
    "1,500,000.00",
    "1500000",
    "Gs. 1.250.000",
    "  1.000.000  ",
    "0",
    "1.000.000,50"
];

console.log("🧪 Diagnóstico de parseAmount:");
testValues.forEach(val => {
    try {
        const result = parseAmount(val);
        console.log(`Input: "${val}" -> Output: ${result} (${typeof result})`);
    } catch (e) {
        console.error(`Error procesando "${val}":`, e.message);
    }
});
