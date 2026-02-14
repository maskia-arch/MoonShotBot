// logic/events.js
import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Definiert mögliche Zufallsevents für den Krypto-Markt
 */
const MARKET_EVENTS = [
    { id: 'bull_run', msg: "🚀 BREAKING: Eine große Investmentbank akzeptiert BTC!", effect: 1.15 },
    { id: 'crash', msg: "📉 PANIK: Ein großer Exchange wurde gehackt!", effect: 0.80 },
    { id: 'elon', msg: "🐦 Ein Tech-Milliardär postet ein Meme. Kurse wirbeln!", effect: 1.05 }
];

/**
 * Würfelt ein zufälliges Markt-Event aus.
 * Kann über einen Cron-Job oder den Stunden-Tick aufgerufen werden.
 */
export async function triggerRandomMarketEvent(bot) {
    if (Math.random() > 0.1) return; // Nur 10% Chance pro Check

    const event = MARKET_EVENTS[Math.floor(Math.random() * MARKET_EVENTS.length)];
    logger.info(`Markt-Event ausgelöst: ${event.id}`);

    // In einer echten Version würdest du hier die Preise in der DB manipulieren
    // Für den Anfang senden wir eine globale Nachricht an alle aktiven User
    await broadcastEvent(bot, event.msg);
}

/**
 * Immobilien-spezifische Zufallsereignisse
 */
const PROPERTY_EVENTS = [
    { id: 'water_damage', title: "🌊 Wasserschaden!", costRange: [500, 2000], conditionLoss: 15 },
    { id: 'good_tenant', title: "💎 Vorzeigemieter!", costRange: [0, 0], conditionLoss: -5 }, // Verbessert Zustand
    { id: 'tax_audit', title: "⚖️ Betriebsprüfung!", costRange: [1000, 5000], conditionLoss: 0 }
];

/**
 * Wendet ein zufälliges Event auf eine spezifische Immobilie an
 */
export async function triggerPropertyEvent(bot, userId, asset) {
    const event = PROPERTY_EVENTS[Math.floor(Math.random() * PROPERTY_EVENTS.length)];
    const cost = Math.floor(Math.random() * (event.costRange[1] - event.costRange[0] + 1)) + event.costRange[0];

    try {
        // 1. Zustand aktualisieren
        const newCondition = Math.max(0, Math.min(100, asset.condition - event.conditionLoss));
        
        await supabase.from('user_assets')
            .update({ condition: newCondition })
            .eq('id', asset.id);

        // 2. Geld abziehen (falls Kosten anfallen)
        if (cost > 0) {
            await supabase.rpc('increment_balance', { user_id: userId, amount: -cost });
        }

        // 3. User benachrichtigen
        const notification = `⚠️ **EVENT: ${event.title}**\n\nDein Objekt \`${asset.asset_type}\` ist betroffen.\nKosten: -${cost} €\nZustand: ${newCondition}%`;
        await bot.telegram.sendMessage(userId, notification, { parse_mode: 'Markdown' });

    } catch (err) {
        logger.error("Fehler beim Property-Event:", err);
    }
}

/**
 * Sendet eine Nachricht an alle bekannten User (einfache Implementierung)
 */
async function broadcastEvent(bot, message) {
    const { data: profiles } = await supabase.from('profiles').select('id');
    if (!profiles) return;

    for (const profile of profiles) {
        try {
            await bot.telegram.sendMessage(profile.id, `📢 **NEWS UPDATE**\n\n${message}`, { parse_mode: 'Markdown' });
        } catch (e) {
            // User hat Bot evtl. blockiert
        }
    }
}
