// commands/trade.js
import { getMarketData, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout, divider } from '../ui/layouts.js';
import { coinListButtons, coinActionButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';
import { getTradeCalculations } from '../logic/tradeLogic.js';
import { Markup } from 'telegraf';

/**
 * ZENTRALE STEUERUNG: Zeigt die Coin-Liste oder das Detail-Menü.
 */
export async function showTradeMenu(ctx, coinId = null) {
    const userId = ctx.from.id;

    try {
        const marketData = await getMarketData();
        
        if (!marketData || Object.keys(marketData).length === 0) {
            const waitMsg = "⏳ Die Märkte werden synchronisiert... Bitte einen Moment Geduld.";
            return await ctx.sendInterface(waitMsg);
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
            listMsg += `\n_Wähle einen Coin für Details._`;
            return await ctx.sendInterface(listMsg, coinListButtons(marketData));
        }

        // --- FALL B: DETAIL-ANSICHT ---
        const coin = marketData[coinId];
        if (!coin) return ctx.answerCbQuery(`❌ Coin ${coinId.toUpperCase()} unbekannt.`);

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();

        const detailMsg = tradingViewLayout({
            symbol: coinId,
            price: coin.price,
            change24h: coin.change24h
        }, user.balance);

        await ctx.sendInterface(detailMsg, coinActionButtons(coinId));

    } catch (err) {
        logger.error(`Fehler im Trade-System:`, err);
        ctx.answerCbQuery("🚨 Marktdaten-Fehler.");
    }
}

/**
 * INITIIERT DEN EINGABE-MODUS: Berechnet Max-Werte und bittet um Mengeneingabe.
 */
export async function initiateTradeInput(ctx, coinId, type) {
    const userId = ctx.from.id;
    try {
        const marketData = await getMarketData();
        const coin = marketData[coinId];
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const { data: asset } = await supabase.from('user_crypto')
            .select('amount').eq('user_id', userId).eq('coin_id', coinId).single();

        const userHoldings = asset ? asset.amount : 0;
        const { maxBuy, maxSell } = getTradeCalculations(user.balance, coin.price, userHoldings);

        // Status für die main.js setzen
        ctx.session.activeTrade = { coinId, type };

        const actionTitle = type === 'buy' ? '🛒 KAUFEN' : '💰 VERKAUFEN';
        const limitInfo = type === 'buy' 
            ? `Max. kaufbar: \`${maxBuy}\` ${coinId.toUpperCase()}` 
            : `Verfügbarer Bestand: \`${maxSell}\` ${coinId.toUpperCase()}`;

        const inputMsg = `⌨️ **${actionTitle}: ${coinId.toUpperCase()}**\n${divider}\n` +
                         `Aktueller Kurs: \`${coin.price.toLocaleString()} €\`\n` +
                         `${limitInfo}\n\n` +
                         `_Bitte sende jetzt die gewünschte Anzahl als Nachricht._`;

        await ctx.sendInterface(inputMsg, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Abbrechen', `view_coin_${coinId}`)]
        ]));
    } catch (err) {
        logger.error("Fehler bei Trade-Initialisierung:", err);
    }
}

/**
 * Wickelt den eigentlichen Kauf ab (basierend auf Anzahl)
 */
export async function handleBuy(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        const totalCost = cryptoAmount * coin.price;

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();

        if (user.balance < totalCost) {
            return ctx.sendInterface(`❌ **Guthaben unzureichend!**\nDu benötigst \`${totalCost.toFixed(2)} €\` für diese Menge.`);
        }

        // Transaktion ausführen
        await supabase.rpc('increment_balance', { user_id: userId, amount: -totalCost });
        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId, 
            amount: cryptoAmount, 
            avg_buy_price: coin.price,
            leverage: 1 
        }, { onConflict: 'user_id,coin_id' });

        await updateTradeStats(userId, totalCost);
        await logTransaction(userId, 'buy_crypto', totalCost, `Kauf ${cryptoAmount} ${coinId.toUpperCase()}`);
        
        await ctx.answerCbQuery(`✅ ${cryptoAmount} ${coinId.toUpperCase()} erfolgreich gekauft!`);
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Kauf-Fehler:", err);
    }
}

/**
 * Wickelt den eigentlichen Verkauf ab
 */
export async function handleSell(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        const { data: asset } = await supabase.from('user_crypto')
            .select('*').eq('user_id', userId).eq('coin_id', coinId).single();

        if (!asset || asset.amount < cryptoAmount) {
            return ctx.sendInterface(`❌ **Fehler:** Du besitzt nur \`${asset ? asset.amount : 0}\` ${coinId.toUpperCase()}.`);
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
        
        await ctx.answerCbQuery(`✅ ${cryptoAmount} ${coinId.toUpperCase()} für ${payout.toFixed(2)}€ verkauft!`);
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Verkauf-Fehler:", err);
    }
}
