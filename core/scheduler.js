// core/scheduler.js
import { runEconomyTick } from '../logic/economy.js';
import { updateMarketPrices } from '../logic/market.js';
import { triggerRandomMarketEvent } from '../logic/events.js';
import { checkLiquidations } from '../logic/liquidation.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';
import { supabase } from '../supabase/client.js';

/**
 * Der Scheduler verwaltet alle zeitgesteuerten Aufgaben.
 * Er ist darauf optimiert, Marktdaten im Hintergrund zu puffern.
 */
export function startGlobalScheduler(bot) {
    logger.info("🕒 Globaler Scheduler wird initialisiert...");

    // 1. KRYPTO-PREIS-TICK (Alle 60 Sekunden)
    // Aktualisiert den internen Server-Cache für BTC & LTC und prüft Liquidationen.
    setInterval(async () => {
        try {
            // Holt die neuesten Kurse lautlos in den Cache
            await updateMarketPrices();
            
            // Prüft Hebel-Positionen auf Liquidation (ohne Chat-Spam)
            await checkLiquidations(bot); 
            
            logger.debug("⚡ Markt-Synchronisation (60s) erfolgreich.");
        } catch (err) {
            // Spezielle Behandlung für API-Limits (Error 429), um Bot-Sperren zu vermeiden
            if (err.message.includes('429')) {
                logger.warn("⚠️ API-Limit erreicht. Scheduler pausiert kurzzeitig.");
            } else {
                logger.error("Fehler im 60s Markt-Update:", err);
            }
        }
    }, 60000); 

    // 2. WIRTSCHAFTS-TICK (Jede Stunde / TICK_SPEED_MS)
    // Berechnet Mieten, Instandhaltungskosten und Zufallsevents.
    setInterval(async () => {
        try {
            logger.info("--- START WIRTSCHAFTS-TICK ---");
            // Berechnet Einkünfte und Kosten für Immobilien
            await runEconomyTick();
            // Triggert zufällige Marktschwankungen
            await triggerRandomMarketEvent(bot);
            logger.info("--- TICK ERFOLGREICH BEENDET ---");
        } catch (err) {
            logger.error("Fehler im stündlichen Wirtschafts-Tick:", err);
        }
    }, CONFIG.TICK_SPEED_MS);

    // 3. SYSTEM-MAINTENANCE (Einmal täglich)
    // Prüft Season-Ende und führt Datenbank-Bereinigungen durch.
    setInterval(async () => {
        try {
            await checkSeasonEnd(bot);
        } catch (err) {
            logger.error("Fehler im täglichen Wartungs-Check:", err);
        }
    }, 24 * 60 * 60 * 1000);
}

/**
 * Prüft den Fortschritt der aktuellen Season.
 */
async function checkSeasonEnd(bot) {
    // Platzhalter für Season-End-Logik
    logger.debug("Season-Fortschritt geprüft.");
}

/**
 * Setzt Season-Statistiken in der Datenbank zurück.
 */
export async function resetSeasonStats() {
    try {
        const { error } = await supabase
            .from('season_stats')
            .update({ 
                season_profit: 0, 
                season_loss: 0, 
                trades_count: 0,
                updated_at: new Date() 
            })
            .neq('user_id', '00000000-0000-0000-0000-000000000000'); // Sicherheitsfilter

        if (error) throw error;
        logger.info("🏆 Season-Stats erfolgreich zurückgesetzt.");
    } catch (err) {
        logger.error("Fehler beim Season-Reset:", err);
    }
}
