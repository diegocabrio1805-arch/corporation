require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function formatOpeningLogs() {
    console.log("Buscando logs de apertura (is_opening = true) con tipo PAGO...");

    // Buscar todos los logs que son de apertura pero tienen type PAGO
    const { data: logs, error: fetchErr } = await supabase
        .from('collection_logs')
        .select('id, amount')
        .eq('is_opening', true)
        .eq('type', 'PAGO');

    if (fetchErr) {
        console.error("Error buscando logs:", fetchErr);
        return;
    }

    if (!logs || logs.length === 0) {
        console.log("No se encontraron logs afectados.");
        return;
    }

    console.log(`¡Se encontraron ${logs.length} logs! Procediendo a marcarlos como ARRASTRE...`);

    // Actualizar todos los IDs a tipo ARRASTRE
    const ids = logs.map(l => l.id);
    const { error: updateErr } = await supabase
        .from('collection_logs')
        .update({ type: 'ARRASTRE' })
        .in('id', ids);

    if (updateErr) {
        console.error("Error actualizando logs:", updateErr);
    } else {
        console.log("¡Éxito! Valores actualizados. Los saldos en las apps móviles se corregirán al sincronizar.");
    }
}

formatOpeningLogs();
