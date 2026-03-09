function extractJSON(text) {
    try {
        // Find the first { and last }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1) return {};
        const jsonStr = text.substring(start, end + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to parse JSON from AI response:", e);
        return {};
    }
}

const samples = [
    '{"Nombre": "name", "Saldo": "balance"}',
    'He analizado las columnas: ```json\n{"Nombres": "name"}\n```',
    'Aquí tienes el mapeo: \n{"CAPITAL": "principal", "DEUDA": "balance"}'
];

console.log("🧪 Test: Extractor de JSON robusto");
samples.forEach(s => {
    const res = extractJSON(s);
    console.log(`Input: ${s.substring(0, 30)}... -> Result:`, res);
});
