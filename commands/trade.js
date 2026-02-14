// commands/trade.js
import { updateMarketPrices, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout } from '../ui/layouts.js';
import { tradeControlButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';

/**
 * Öffnet das Trading-Menü für einen Coin
 */
export async function showTradeMenu(ctx, coinId = 'bitcoin') {
    const userId = ctx.from.id;

    try {
        const marketData = await updateMarketPrices();
        const coin = marketData[coinId];

        if (!coin) {
            return ctx.reply("❌ Dieser Coin wird momentan nicht unterstützt.");
        }

        const { data: user } = await supabase
            .from('profiles')
            .select('balance')
            .eq('id', userId)
            .single();

        const message = tradingViewLayout({
            symbol: coinId,
            price: coin.price,
            change24h: coin.change24h
        }, user.balance);

        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...tradeControlButtons(coinId)
        });

    } catch (err) {
        logger.error(`Fehler im Trade-Menü für ${coinId}:`, err);
        ctx.reply("🚨 Kursdaten konnten nicht geladen werden.");
    }
}

/**
 * Wickelt einen Kauf ab (Market Order)
 */
export async function handleBuy(ctx, coinId, amountEur, leverage = 1) {
    const userId = ctx.from.id;

    try {
        const coin = await getCoinPrice(coinId);
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();

        if (user.balance < amountEur) {
            return ctx.answerCbQuery("❌ Guthaben reicht nicht aus!", { show_alert: true });
        }

        const cryptoAmount = (amountEur * leverage) / coin.price;

        // 1. Geld abziehen
        await supabase.rpc('increment_balance', { user_id: userId, amount: -amountEur });

        // 2. Bestand updaten (JETZT MIT LEVERAGE)
        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId, 
            amount: cryptoAmount, 
            avg_buy_price: coin.price,
            leverage: leverage // <--- WICHTIG für logic/liquidation.js
        }, { onConflict: 'user_id,coin_id' });

        // 3. Handelsvolumen & Season Stats tracken
        await updateTradeStats(userId, amountEur);

        await logTransaction(userId, 'buy_crypto', amountEur, `Kauf ${coinId.toUpperCase()} x${leverage}`);
        await ctx.reply(`✅ Gekauft: \`${cryptoAmount.toFixed(8)}\` ${coinId.toUpperCase()} (Hebel: x${leverage})`);

    } catch (err) {
        logger.error("Fehler beim Kauf:", err);
    }
}

/**
 * Wickelt einen Verkauf ab
 */
export async function handleSell(ctx, coinId) {
    const userId = ctx.from.id;

    try {
        const coin = await getCoinPrice(coinId);
        
        const { data: asset } = await supabase
            .from('user_crypto')
            .select('*')
            .eq('user_id', userId)
            .eq('coin_id', coinId)
            .single();

        if (!asset || asset.amount <= 0) {
            return ctx.answerCbQuery("❌ Du besitzt diesen Coin nicht!", { show_alert: true });
        }

        // Berechnung unter Berücksichtigung des Hebels
        const currentVal = asset.amount * coin.price;
        const initialInvestment = (asset.amount * asset.avg_buy_price) / asset.leverage;
        const currentEquity = currentVal - (asset.amount * asset.avg_buy_price) + initialInvestment;
        
        const pnl = currentEquity - initialInvestment;

        // DB Updates
        await supabase.rpc('increment_balance', { user_id: userId, amount: Math.max(0, currentEquity) });
        await supabase.from('user_crypto').delete().eq('id', asset.id);

        await updateTradeStats(userId, currentEquity, pnl);
        await logTransaction(userId, 'sell_crypto', currentEquity, `Verkauf ${coinId.toUpperCase()} (PnL: ${pnl.toFixed(2)}€)`);
        
        const emoji = pnl >= 0 ? '🚀' : '📉';
        await ctx.reply(`✅ Verkauf abgeschlossen!\nErtrag: \`${currentEquity.toFixed(2)} €\`\nErgebnis: ${emoji} \`${pnl.toFixed(2)} €\``);

    } catch (err) {
        logger.error("Fehler beim Verkauf:", err);
    }
}
