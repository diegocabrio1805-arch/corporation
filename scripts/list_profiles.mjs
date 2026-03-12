import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    await supabase.auth.signInWithPassword({
        email: 'DDANTE1983@anexocobro.com',
        password: 'Cobros2026'
    });

    const { data: users, error } = await supabase
        .from('profiles')
        .select('id, name, username');

    console.log("=== LISTA DE USUARIOS ===");
    console.log(users);
}

main();
