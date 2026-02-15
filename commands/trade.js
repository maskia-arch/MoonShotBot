// commands/trade.js
import { updateMarketPrices, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout, divider } from '../ui/layouts.js';
import { coinListButtons, coinActionButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';

/**
 * ZENTRALE STEUERUNG: Öffnet entweder die Coin-Liste oder das Detail-Menü.
 */
export async function showTradeMenu(ctx, coinId = null) {
    const userId = ctx.from.id;

    try {
        // 1. Marktdaten abrufen
        const marketData = await updateMarketPrices();
        
        if (!marketData || Object.keys(marketData).length === 0) {
            const waitMsg = "⏳ Marktdaten werden geladen... bitte einen Moment Geduld.";
            return ctx.sendInterface ? await ctx.sendInterface(waitMsg) : ctx.reply(waitMsg);
        }

        // --- FALL A: ÜBERSICHT ALLER COINS ---
        if (!coinId) {
            let listMsg = `📊 **Live-Marktübersicht (24h)**\n${divider}\n`;
            
            Object.keys(marketData).forEach(id => {
                const c = marketData[id];
                const emoji = c.change24h >= 0 ? '🟢' : '🔴';
                const trend = c.change24h >= 0 ? '+' : '';
                listMsg += `${emoji} **${id.toUpperCase()}**: \`${c.price.toLocaleString()} €\` (${trend}${c.change24h.toFixed(2)}%)\n`;
            });

            listMsg += `\n_Wähle einen Coin für Details und Handelsoptionen._`;

            return await ctx.sendInterface(listMsg, coinListButtons(marketData));
        }

        // --- FALL B: DETAIL-ANSICHT (KAUFEN/VERKAUFEN/WETTE) ---
        const coin = marketData[coinId];
        if (!coin) {
            return ctx.answerCbQuery(`❌ Coin ${coinId} nicht gefunden.`, { show_alert: true });
        }

        const { data: user } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        const detailMsg = tradingViewLayout({
            symbol: coinId,
            price: coin.price,
            change24h: coin.change24h
        }, user.balance);

        await ctx.sendInterface(detailMsg, coinActionButtons(coinId));

    } catch (err) {
        logger.error(`Fehler im Trade-System:`, err);
        ctx.answerCbQuery("🚨 Fehler beim Laden der Marktdaten.");
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

        await supabase.rpc('increment_balance', { user_id: userId, amount: -amountEur });

        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId, 
            amount: cryptoAmount, 
            avg_buy_price: coin.price,
            leverage: leverage
        }, { onConflict: 'user_id,coin_id' });

        await updateTradeStats(userId, amountEur);
        await logTransaction(userId, 'buy_crypto', amountEur, `Kauf ${coinId.toUpperCase()} x${leverage}`);
        
        await ctx.answerCbQuery("🚀 Kauf erfolgreich!");
        
        // Zurück zur Detailansicht des Coins
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

        await supabase.rpc('increment_balance', { user_id: userId, amount: Math.max(0, currentEquity) });
        await supabase.from('user_crypto').delete().eq('id', asset.id);

        await updateTradeStats(userId, currentEquity, pnl);
        await logTransaction(userId, 'sell_crypto', currentEquity, `Verkauf ${coinId.toUpperCase()} (PnL: ${pnl.toFixed(2)}€)`);
        
        await ctx.answerCbQuery(`✅ Verkauft für ${currentEquity.toFixed(2)} €`);
        
        return showTradeMenu(ctx, coinId);

    } catch (err) {
        logger.error("Fehler beim Verkauf:", err);
        ctx.answerCbQuery("❌ Fehler beim Verkauf.");
    }
}
