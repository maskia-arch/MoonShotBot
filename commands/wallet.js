// commands/wallet.js
import { getUserProfile } from '../supabase/queries.js';
import { portfolioLayout } from '../ui/layouts.js';
import { portfolioButtons } from '../ui/buttons.js';
import { updateMarketPrices } from '../logic/market.js';
import { logger } from '../utils/logger.js';
import { formatCurrency } from '../utils/formatter.js';

/**
 * Zeigt das Portfolio des Spielers an
 */
export async function showWallet(ctx) {
    const userId = ctx.from.id;

    try {
        // 1. Lade User-Profil inkl. Kryptos und Assets aus Supabase
        const userData = await getUserProfile(userId);
        
        if (!userData) {
            return ctx.reply("❌ Profil nicht gefunden. Nutze /start.");
        }

        // 2. Aktuelle Kurse holen, um den Gesamtwert der Kryptos zu berechnen
        const marketData = await updateMarketPrices();
        
        // 3. Assets für das Layout aufbereiten
        const processedAssets = [];

        // Kryptos verarbeiten
        if (userData.user_crypto) {
            userData.user_crypto.forEach(coin => {
                const currentPrice = marketData[coin.coin_id]?.price || 0;
                const currentVal = coin.amount * currentPrice;
                const profitPercent = coin.avg_buy_price 
                    ? ((currentPrice - coin.avg_buy_price) / coin.avg_buy_price) * 100 
                    : 0;

                processedAssets.push({
                    type: 'crypto',
                    symbol: coin.coin_id,
                    amount: coin.amount,
                    profit: profitPercent,
                    value: currentVal
                });
            });
        }

        // Immobilien verarbeiten
        if (userData.user_assets) {
            userData.user_assets.forEach(asset => {
                processedAssets.push({
                    type: 'immo',
                    name: asset.asset_type.charAt(0).toUpperCase() + asset.asset_type.slice(1),
                    condition: asset.condition
                });
            });
        }

        // 4. Layout generieren
        const message = portfolioLayout(userData, processedAssets);

        // 5. Nachricht senden (oder editieren, falls es ein Refresh war)
        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...portfolioButtons
        });

    } catch (err) {
        logger.error("Fehler in showWallet:", err);
        ctx.reply("🚨 Fehler beim Laden deines Portfolios.");
    }
}
