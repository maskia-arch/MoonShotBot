// commands/trade.js
import { getMarketData, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout, divider } from '../ui/layouts.js';
import { coinListButtons, coinActionButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';
import { getTradeCalculations } from '../logic/tradeLogic.js';
import { Markup } from 'telegraf';
import { CONFIG } from '../config.js';

/**
 * ZENTRALE STEUERUNG: Zeigt die Coin-Liste oder das Detail-Menü.
 */
export async function showTradeMenu(ctx, coinId = null) {
    const userId = ctx.from.id;

    try {
        const marketData = await getMarketData();
        
        if (!marketData || Object.keys(marketData).length === 0) {
            return await ctx.sendInterface("⏳ Die Märkte werden gerade synchronisiert... Bitte versuche es in wenigen Sekunden erneut.");
        }

        if (!coinId) {
            let listMsg = `📊 **Live-Marktübersicht (24h)**\n${divider}\n`;
            Object.keys(marketData).forEach(id => {
                const c = marketData[id];
                const emoji = c.change24h >= 0 ? '🟢' : '🔴';
                const trend = c.change24h >= 0 ? '+' : '';
                listMsg += `${emoji} **${id.toUpperCase()}**: \`${c.price.toLocaleString('de-DE')} €\` (${trend}${c.change24h.toFixed(2)}%)\n`;
            });
            listMsg += `\n_Wähle einen Coin für Details._`;
            return await ctx.sendInterface(listMsg, coinListButtons(marketData));
        }

        const coin = marketData[coinId.toLowerCase()];
        if (!coin) return ctx.answerCbQuery(`❌ Coin ${coinId.toUpperCase()} aktuell nicht verfügbar.`);

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();

        const detailMsg = tradingViewLayout({
            symbol: coinId,
            price: coin.price,
            change24h: coin.change24h
        }, user.balance);

        await ctx.sendInterface(detailMsg, coinActionButtons(coinId));

    } catch (err) {
        logger.error(`Fehler im Trade-System:`, err);
        ctx.answerCbQuery("🚨 Marktdaten konnten nicht geladen werden.");
    }
}

/**
 * INITIIERT DEN EINGABE-MODUS.
 */
export async function initiateTradeInput(ctx, coinId, type) {
    const userId = ctx.from.id;
    try {
        const marketData = await getMarketData();
        const coin = marketData[coinId.toLowerCase()];
        
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const { data: asset } = await supabase.from('user_crypto')
            .select('amount').eq('user_id', userId).eq('coin_id', coinId).single();

        const userHoldings = asset ? asset.amount : 0;
        const { maxBuy, maxSell } = getTradeCalculations(user.balance, coin.price, userHoldings);

        ctx.session.activeTrade = { coinId, type };

        const actionTitle = type === 'buy' ? '🛒 KAUFEN' : '💰 VERKAUFEN';
        const limitInfo = type === 'buy' 
            ? `Max. kaufbar: \`${maxBuy}\` ${coinId.toUpperCase()}` 
            : `Verfügbarer Bestand: \`${maxSell}\` ${coinId.toUpperCase()}`;

        const inputMsg = `⌨️ **${actionTitle}: ${coinId.toUpperCase()}**\n${divider}\n` +
                         `Aktueller Kurs: \`${coin.price.toLocaleString('de-DE')} €\`\n` +
                         `${limitInfo}\n\n` +
                         `_Bitte sende jetzt die gewünschte Anzahl als Nachricht._`;

        await ctx.sendInterface(inputMsg, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Abbrechen', `view_coin_${coinId}`)]
        ]));
    } catch (err) {
        logger.error("Fehler bei Trade-Initialisierung:", err);
        ctx.answerCbQuery("🚨 Eingabe-Modus Fehler.");
    }
}

/**
 * Verarbeitet den Kauf.
 */
export async function handleBuy(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        const tax = CONFIG.TRADE_TAX || 0.001;
        const totalCost = cryptoAmount * coin.price * (1 + tax);

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        if (user.balance < totalCost) {
            return ctx.sendInterface(`❌ **Guthaben unzureichend!**\nBedarf: \`${totalCost.toLocaleString('de-DE')} €\``);
        }

        // Aktuellen Bestand holen für korrekte Addition
        const { data: currentAsset } = await supabase.from('user_crypto')
            .select('amount, avg_buy_price')
            .eq('user_id', userId)
            .eq('coin_id', coinId)
            .single();

        const oldAmount = currentAsset ? currentAsset.amount : 0;
        const newAmount = oldAmount + cryptoAmount;
        
        // Neuer Durchschnittspreis
        const oldValue = oldAmount * (currentAsset?.avg_buy_price || 0);
        const newValue = cryptoAmount * coin.price;
        const newAvgPrice = (oldValue + newValue) / newAmount;

        await supabase.rpc('increment_balance', { user_id: userId, amount: -totalCost });
        
        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId, 
            amount: newAmount, 
            avg_buy_price: newAvgPrice,
            leverage: 1 
        }, { onConflict: 'user_id,coin_id' });

        await updateTradeStats(userId, totalCost);
        await logTransaction(userId, 'buy_crypto', totalCost, `Kauf ${cryptoAmount} ${coinId.toUpperCase()}`);
        
        await ctx.answerCbQuery(`✅ Kauf erfolgreich!`);
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Kauf-Fehler:", err);
    }
}

/**
 * Verarbeitet den Verkauf.
 */
export async function handleSell(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        const { data: asset } = await supabase.from('user_crypto')
            .select('*').eq('user_id', userId).eq('coin_id', coinId).single();

        if (!asset || asset.amount < cryptoAmount) {
            return ctx.sendInterface(`❌ **Bestand zu niedrig!** (Besitz: ${asset?.amount || 0})`);
        }

        const payout = cryptoAmount * coin.price;
        const newAmount = asset.amount - cryptoAmount;

        await supabase.rpc('increment_balance', { user_id: userId, amount: payout });
        
        if (newAmount <= 0) {
            await supabase.from('user_crypto').delete().eq('id', asset.id);
        } else {
            await supabase.from('user_crypto').update({ amount: newAmount }).eq('id', asset.id);
        }

        await logTransaction(userId, 'sell_crypto', payout, `Verkauf ${cryptoAmount} ${coinId.toUpperCase()}`);
        
        await ctx.answerCbQuery(`✅ Verkauf erfolgreich!`);
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Verkauf-Fehler:", err);
    }
}
