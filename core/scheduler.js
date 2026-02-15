// core/scheduler.js
import { runEconomyTick } from '../logic/economy.js';
import { updateMarketPrices } from '../logic/market.js';
import { triggerRandomMarketEvent } from '../logic/events.js';
import { checkLiquidations } from '../logic/liquidation.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Der Scheduler ist der Herzschlag des Bots.
 * Optimiert für minütliche Krypto-Updates und Single-Message-Interface.
 */
export function startGlobalScheduler(bot) {
    logger.info("🕒 Globaler Scheduler wird initialisiert...");

    // 1. KRYPTO-PREIS-TICK & LIQUIDATION (Alle 60 Sekunden)
    // Damit Spieler immer die aktuellsten Kurse sehen
    setInterval(async () => {
        try {
            // Preise sofort aktualisieren
            await updateMarketPrices();
            
            // Sofort prüfen, ob Hebel-Positionen liquidiert werden müssen
            await checkLiquidations(bot); 
            
            logger.debug("⚡ Minütlicher Krypto-Tick erfolgreich.");
        } catch (err) {
            logger.error("Fehler im 60s Krypto-Tick:", err);
        }
    }, 60000); // 60.000ms = 1 Minute

    // 2. WIRTSCHAFTS-TICK (Intervall aus CONFIG, z.B. jede Stunde)
    // Verarbeitet Mieteinnahmen, Instandhaltung und Events
    setInterval(async () => {
        try {
            logger.info("--- START WIRTSCHAFTS-TICK (Stündlich) ---");
            await runEconomyTick();
            await triggerRandomMarketEvent(bot);
            logger.info("--- TICK ERFOLGREICH BEENDET ---");
        } catch (err) {
            logger.error("Fehler während des Wirtschafts-Ticks:", err);
        }
    }, CONFIG.TICK_SPEED_MS);

    // 3. SEASON-CHECK & MAINTENANCE (Einmal täglich)
    setInterval(async () => {
        try {
            await checkSeasonEnd(bot);
            logger.debug("Täglicher System-Check durchgeführt.");
        } catch (err) {
            logger.error("Fehler im Daily-Check:", err);
        }
    }, 24 * 60 * 60 * 1000);
}

/**
 * Prüft das Enddatum der Season
 */
async function checkSeasonEnd(bot) {
    // Hier wird später die Season-Logik implementiert
    logger.debug("Season-End-Check läuft...");
}

/**
 * Setzt die Statistiken für eine neue Season zurück
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
            });

        if (error) throw error;
        logger.info("🏆 Season wurde erfolgreich zurückgesetzt.");
    } catch (err) {
        logger.error("Fehler beim Season-Reset:", err);
    }
}
