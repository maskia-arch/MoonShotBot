// commands/trade.js
import { updateMarketPrices, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout } from '../ui/layouts.js';
import { tradeControlButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';

/**
 * Öffnet das Trading-Menü für einen Coin.
 * Nutzt ctx.sendInterface für ein sauberes Chat-Erlebnis.
 */
export async function showTradeMenu(ctx, coinId = 'bitcoin') {
    const userId = ctx.from.id;

    try {
        // 1. Marktdaten abrufen
        const marketData = await updateMarketPrices();
        const coin = marketData ? marketData[coinId] : null;

        // Falls Marktdaten für den Coin (noch) nicht existieren
        if (!coin) {
            const errorMsg = `❌ Der Markt für **${coinId.toUpperCase()}** ist gerade nicht erreichbar. Bitte warte kurz auf das nächste Preis-Update.`;
            if (ctx.sendInterface) {
                return await ctx.sendInterface(ctx, errorMsg);
            }
            return ctx.reply(errorMsg, { parse_mode: 'Markdown' });
        }

        // 2. User-Guthaben abrufen
        const { data: user, error } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // 3. UI Layout generieren
        const message = tradingViewLayout({
            symbol: coinId,
            price: coin.price,
            change24h: coin.change24h
        }, user.balance);

        // 4. Nachricht senden/editieren via immersivem Interface
        if (ctx.sendInterface) {
            await ctx.sendInterface(ctx, message, tradeControlButtons(coinId));
        } else {
            await ctx.reply(message, {
                parse_mode: 'Markdown',
                ...tradeControlButtons(coinId)
            });
        }

    } catch (err) {
        logger.error(`Fehler im Trade-Menü für ${coinId}:`, err);
        const errorText = "🚨 Kursdaten konnten nicht geladen werden.";
        if (ctx.sendInterface) await ctx.sendInterface(ctx, errorText);
        else ctx.reply(errorText);
    }
}

/**
 * Wickelt einen Kauf ab (Market Order)
 */
export async function handleBuy(ctx, coinId, amountEur, leverage = 1) {
    const userId = ctx.from.id;

    try {
        const coin = await getCoinPrice(coinId);
        if (!coin) return ctx.answerCbQuery("❌ Preis aktuell nicht verfügbar.");

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();

        if (user.balance < amountEur) {
            return ctx.answerCbQuery("❌ Guthaben reicht nicht aus!", { show_alert: true });
        }

        const cryptoAmount = (amountEur * leverage) / coin.price;

        // 1. Kontostand aktualisieren
        await supabase.rpc('increment_balance', { user_id: userId, amount: -amountEur });

        // 2. Krypto-Bestand speichern
        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId, 
            amount: cryptoAmount, 
            avg_buy_price: coin.price,
            leverage: leverage
        }, { onConflict: 'user_id,coin_id' });

        // 3. Statistiken loggen
        await updateTradeStats(userId, amountEur);
        await logTransaction(userId, 'buy_crypto', amountEur, `Kauf ${coinId.toUpperCase()} x${leverage}`);
        
        await ctx.answerCbQuery("🚀 Kauf erfolgreich!");
        
        // Menü aktualisieren um neuen Kontostand zu zeigen
        return showTradeMenu(ctx, coinId);

    } catch (err) {
        logger.error("Fehler beim Kauf:", err);
        ctx.answerCbQuery("❌ Fehler beim Trade.");
    }
}

/**
 * Wickelt einen Verkauf ab
 */
export async function handleSell(ctx, coinId) {
    const userId = ctx.from.id;

    try {
        const coin = await getCoinPrice(coinId);
        if (!coin) return ctx.answerCbQuery("❌ Verkauf aktuell nicht möglich.");
        
        const { data: asset } = await supabase
            .from('user_crypto')
            .select('*')
            .eq('user_id', userId)
            .eq('coin_id', coinId)
            .single();

        if (!asset || asset.amount <= 0) {
            return ctx.answerCbQuery("❌ Du besitzt diesen Coin nicht!", { show_alert: true });
        }

        const currentVal = asset.amount * coin.price;
        const initialInvestment = (asset.amount * asset.avg_buy_price) / asset.leverage;
        const currentEquity = currentVal - (asset.amount * asset.avg_buy_price) + initialInvestment;
        const pnl = currentEquity - initialInvestment;

        // DB Updates
        await supabase.rpc('increment_balance', { user_id: userId, amount: Math.max(0, currentEquity) });
        await supabase.from('user_crypto').delete().eq('id', asset.id);

        await updateTradeStats(userId, currentEquity, pnl);
        await logTransaction(userId, 'sell_crypto', currentEquity, `Verkauf ${coinId.toUpperCase()} (PnL: ${pnl.toFixed(2)}€)`);
        
        await ctx.answerCbQuery(`✅ Verkauft für ${currentEquity.toFixed(2)}€`);
        
        // Zurück zum Hauptmenü/Dashboard oder Trading-Ansicht aktualisieren
        return showTradeMenu(ctx, coinId);

    } catch (err) {
        logger.error("Fehler beim Verkauf:", err);
        ctx.answerCbQuery("❌ Fehler beim Verkauf.");
    }
}
