// commands/trade.js
import { getMarketData, getCoinPrice } from '../logic/market.js';
import { supabase } from '../supabase/client.js';
import { tradingViewLayout, divider } from '../ui/layouts.js';
import { coinListButtons, coinActionButtons } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { logTransaction, updateTradeStats } from '../supabase/queries.js';
import { getTradeCalculations, calculateTrade, isTradeEligibleForVolume } from '../logic/tradeLogic.js';
import { formatCurrency, formatCrypto } from '../utils/formatter.js';
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
            return await ctx.sendInterface("⏳ Die Märkte werden gerade synchronisiert... Bitte einen Moment Geduld.");
        }

        if (!coinId) {
            let listMsg = `📊 **Live-Marktübersicht (24h)**\n${divider}\n`;
            Object.keys(marketData).forEach(id => {
                const c = marketData[id];
                const emoji = c.change24h >= 0 ? '🟢' : '🔴';
                const trend = c.change24h >= 0 ? '+' : '';
                // Korrektur: Währung auf 2 Nachkommastellen via formatCurrency
                listMsg += `${emoji} **${id.toUpperCase()}**: \`${formatCurrency(c.price)}\` (${trend}${c.change24h.toFixed(2)}%)\n`;
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
        ctx.answerCbQuery("🚨 Marktdaten-Fehler.");
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
        
        if (!coin) throw new Error("Coin-Daten fehlen");

        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        const { data: asset } = await supabase.from('user_crypto')
            .select('amount').eq('user_id', userId).eq('coin_id', coinId.toLowerCase()).single();

        const userHoldings = asset ? asset.amount : 0;
        const { maxBuy, maxSell } = getTradeCalculations(user.balance, coin.price, userHoldings);

        ctx.session.activeTrade = { coinId: coinId.toLowerCase(), type };

        const actionTitle = type === 'buy' ? '🛒 KAUFEN' : '💰 VERKAUFEN';
        const limitInfo = type === 'buy' 
            ? `Max. kaufbar: \`${formatCrypto(maxBuy)}\` ${coinId.toUpperCase()}` 
            : `Verfügbarer Bestand: \`${formatCrypto(maxSell)}\` ${coinId.toUpperCase()}`;

        const inputMsg = `⌨️ **${actionTitle}: ${coinId.toUpperCase()}**\n${divider}\n` +
                         `Aktueller Kurs: \`${formatCurrency(coin.price)}\`\n` +
                         `${limitInfo}\n\n` +
                         `_Bitte sende jetzt die gewünschte Anzahl als Nachricht._`;

        await ctx.sendInterface(inputMsg, Markup.inlineKeyboard([
            [Markup.button.callback('❌ Abbrechen', `view_coin_${coinId}`)]
        ]));
    } catch (err) {
        logger.error("Fehler bei Trade-Initialisierung:", err);
        ctx.answerCbQuery("🚨 Fehler beim Starten der Eingabe.");
    }
}

/**
 * Verarbeitet den Kauf (inkl. 0,5% Gebühr für den Wirtschafts-Topf).
 */
export async function handleBuy(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        if (!coin) throw new Error("Preis nicht verfügbar");

        const { totalCost, fee } = calculateTrade(cryptoAmount, coin.price);
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        
        if (user.balance < totalCost) {
            return ctx.sendInterface(`❌ **Guthaben unzureichend!**\nBedarf: \`${formatCurrency(totalCost)}\``);
        }

        const { data: currentAsset } = await supabase.from('user_crypto')
            .select('amount, avg_buy_price')
            .eq('user_id', userId)
            .eq('coin_id', coinId.toLowerCase())
            .single();

        const oldAmount = currentAsset ? currentAsset.amount : 0;
        const newAmount = oldAmount + cryptoAmount;
        const newAvgPrice = ((oldAmount * (currentAsset?.avg_buy_price || 0)) + (cryptoAmount * coin.price)) / newAmount;

        // DB Updates via RPC (Geld & Steuertopf)
        await supabase.rpc('execute_trade_buy', { 
            p_user_id: userId, 
            p_total_cost: totalCost, 
            p_fee: fee 
        });
        
        await supabase.from('user_crypto').upsert({ 
            user_id: userId, 
            coin_id: coinId.toLowerCase(), 
            amount: newAmount, 
            avg_buy_price: newAvgPrice,
            created_at: new Date()
        }, { onConflict: 'user_id,coin_id' });

        await ctx.answerCbQuery(`✅ Kauf erfolgreich: ${formatCrypto(cryptoAmount)} ${coinId.toUpperCase()}`, { show_alert: false });
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Kauf-Fehler:", err);
        ctx.answerCbQuery("🚨 Kauf konnte nicht verarbeitet werden.");
    }
}

/**
 * Verarbeitet den Verkauf (inkl. Haltefrist-Check).
 */
export async function handleSell(ctx, coinId, cryptoAmount) {
    const userId = ctx.from.id;
    try {
        const coin = await getCoinPrice(coinId);
        const { data: asset } = await supabase.from('user_crypto')
            .select('*').eq('user_id', userId).eq('coin_id', coinId.toLowerCase()).single();

        if (!asset || asset.amount < cryptoAmount) {
            return ctx.sendInterface(`❌ **Bestand zu niedrig!**`);
        }

        const isEligible = isTradeEligibleForVolume(asset.created_at);
        const { payout, fee } = calculateTrade(cryptoAmount, coin.price);
        const tradeVolumeEuro = cryptoAmount * coin.price;

        await supabase.rpc('execute_trade_sell', {
            p_user_id: userId,
            p_payout: payout,
            p_fee: fee,
            p_volume: isEligible ? tradeVolumeEuro : 0
        });
        
        const newAmount = asset.amount - cryptoAmount;
        if (newAmount <= 0) {
            await supabase.from('user_crypto').delete().eq('id', asset.id);
        } else {
            await supabase.from('user_crypto').update({ amount: newAmount }).eq('id', asset.id);
        }

        await logTransaction(userId, 'sell_crypto', payout, `Verkauf ${cryptoAmount} ${coinId.toUpperCase()}`);
        await ctx.answerCbQuery(`💰 Verkauf erfolgreich: +${formatCurrency(payout)}`, { show_alert: false });
        return showTradeMenu(ctx, coinId);
    } catch (err) {
        logger.error("Verkauf-Fehler:", err);
        ctx.answerCbQuery("🚨 Verkauf konnte nicht verarbeitet werden.");
    }
}
