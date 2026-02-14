// supabase/client.js
import { createClient } from '@supabase/supabase-js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Initialisiert den Supabase Client mit den Werten aus der config.js.
 * Der 'anon' Key ist sicher für Client-Abfragen, solange RLS-Policies 
 * in Supabase korrekt gesetzt sind.
 */
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
    logger.error("Supabase URL oder Key fehlen in der config.js!");
}

export const supabase = createClient(
    CONFIG.SUPABASE_URL, 
    CONFIG.SUPABASE_KEY
);

/**
 * Hilfsfunktion zum Testen der Verbindung beim Bot-Start.
 * Wird in der main.js aufgerufen.
 */
export async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('count', { count: 'exact', head: true });

        if (error) {
            throw error;
        }

        logger.info("✅ Verbindung zu Supabase erfolgreich hergestellt.");
        return true;
    } catch (err) {
        logger.error("❌ Verbindung zu Supabase fehlgeschlagen:", err.message);
        return false;
    }
}
