require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: logs } = await supabase.from('collection_logs').select('*').limit(5);
    logs.forEach(l => {
        console.log(`Log ${l.id} - is_opening: ${l.is_opening} (${typeof l.is_opening})`);
    });
}
run();
