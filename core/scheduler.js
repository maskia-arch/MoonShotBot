// core/scheduler.js
import { runEconomyTick } from '../logic/economy.js';
import { updateMarketPrices } from '../logic/market.js';
import { triggerRandomMarketEvent } from '../logic/events.js';
import { checkLiquidations } from '../logic/liquidation.js'; // NEU
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Der Scheduler ist der Herzschlag des Bots.
 */
export function startGlobalScheduler(bot) {
    logger.info("🕒 Globaler Scheduler wird initialisiert...");

    // 1. KRYPTO-PREIS-TICK & LIQUIDATION (Alle 5 Minuten)
    setInterval(async () => {
        try {
            // Erst Preise aktualisieren...
            await updateMarketPrices();
            logger.debug("Markt-Cache automatisch aktualisiert.");
            
            // ...dann sofort prüfen, ob jemand "rekt" gegangen ist
            await checkLiquidations(bot); 
        } catch (err) {
            logger.error("Fehler im Preis/Liquidation-Tick:", err);
        }
    }, 5 * 60 * 1000);

    // 2. WIRTSCHAFTS-TICK (Jede Stunde)
    setInterval(async () => {
        try {
            logger.info("--- START WIRTSCHAFTS-TICK ---");
            await runEconomyTick();
            await triggerRandomMarketEvent(bot);
            logger.info("--- TICK ERFOLGREICH BEENDET ---");
        } catch (err) {
            logger.error("Fehler während des Wirtschafts-Ticks:", err);
        }
    }, CONFIG.TICK_SPEED_MS);

    // 3. SEASON-CHECK (Einmal täglich)
    setInterval(async () => {
        await checkSeasonEnd(bot);
    }, 24 * 60 * 60 * 1000);
}

/**
 * Prüft das Enddatum der Season
 */
async function checkSeasonEnd(bot) {
    // Hier kannst du später ein festes Datum aus der CONFIG prüfen
    logger.debug("Season-Check durchgeführt.");
}

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
