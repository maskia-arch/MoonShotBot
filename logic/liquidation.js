// logic/liquidation.js
import { supabase } from '../supabase/client.js';
import { updateMarketPrices } from './market.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';

/**
 * Prüft alle offenen Krypto-Positionen auf Liquidation.
 * Eine Liquidation tritt ein, wenn der Verlust den Einsatz übersteigt.
 */
export async function checkLiquidations(bot) {
    try {
        const marketData = await updateMarketPrices();
        
        // 1. Alle Krypto-Bestände abrufen
        const { data: positions, error } = await supabase
            .from('user_crypto')
            .select('*, profiles(username)');

        if (error) throw error;

        for (const pos of positions) {
            const currentPrice = marketData[pos.coin_id]?.price;
            if (!currentPrice) continue;

            // Berechnung des aktuellen Werts vs. Einstiegswert
            // Da wir Hebel in handleBuy() als erhöhte Menge gespeichert haben,
            // ist die Liquidation-Schwelle erreicht, wenn der Preis unter einen Wert fällt,
            // der den ursprünglichen Cash-Einsatz vernichtet.
            
            const priceDropPercent = (pos.avg_buy_price - currentPrice) / pos.avg_buy_price;
            
            // Beispiel: 10x Hebel -> 1/10 = 0.1 (10% Preisabfall = Liquidation)
            // Wir berechnen den Hebel rückwärts aus dem Bestand (vereinfacht für das Spiel)
            // oder prüfen, ob der aktuelle Gesamtwert der Position gegen Null läuft.
            
            if (priceDropPercent >= (1 / pos.leverage)) { 
                await performLiquidation(bot, pos);
            }
        }
    } catch (err) {
        logger.error("Fehler beim Liquidation-Check:", err);
    }
}

/**
 * Führt die Liquidation aus und benachrichtigt den User
 */
async function performLiquidation(bot, pos) {
    try {
        // 1. Position in DB löschen
        await supabase.from('user_crypto').delete().eq('id', pos.id);

        // 2. Den Totalverlust in die Season-Statistik eintragen
        const totalLoss = pos.amount * pos.avg_buy_price / pos.leverage;
        await updateTradeStats(pos.user_id, 0, -totalLoss);

        // 3. Loggen
        await logTransaction(pos.user_id, 'liquidation', -totalLoss, `LIQUIDATION: ${pos.coin_id.toUpperCase()}`);

        // 4. User benachrichtigen
        const msg = `🚨 **MARGIN CALL / LIQUIDATION** 🚨\n\nDeine Position in **${pos.coin_id.toUpperCase()}** wurde zwangsverkauft, da der Kurs zu stark gefallen ist.\n\nVerlust: \`-${totalLoss.toFixed(2)} €\``;
        await bot.telegram.sendMessage(pos.user_id, msg, { parse_mode: 'Markdown' });
        
        logger.info(`User ${pos.user_id} wurde in ${pos.coin_id} liquidiert.`);
    } catch (err) {
        logger.error("Liquidation fehlgeschlagen:", err);
    }
}
