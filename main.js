// main.js
import { Telegraf, session, Markup } from 'telegraf';
import http from 'http'; 
import { CONFIG } from './config.js';
import { logger } from './utils/logger.js';
import { supabase } from './supabase/client.js';
import { handleStart } from './commands/start.js';
import { showTradeMenu, handleBuy, handleSell } from './commands/trade.js'; // Imports erweitert
import { showImmoMarket } from './commands/immo.js';
import { showWallet } from './commands/wallet.js';
import { showLeaderboard } from './commands/rank.js';
import { startGlobalScheduler } from './core/scheduler.js';
import { getVersion } from './utils/versionLoader.js';
import { mainKeyboard } from './ui/buttons.js';
import { updateMarketPrices } from './logic/market.js';

if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt in den Environment Variables!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

bot.use(session());

/**
 * OPTIMIERTER INTERFACE HANDLER
 * Sorgt für sauberen Chat durch Löschen/Editieren.
 */
bot.use(async (ctx, next) => {
    ctx.sendInterface = async (text, extra = {}) => {
        if (ctx.callbackQuery) {
            try {
                return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
            } catch (e) {}
        }

        if (ctx.session?.lastMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastMessageId).catch(() => {});
            } catch (e) {}
        }

        try {
            const msg = await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
            ctx.session.lastMessageId = msg.message_id;
            return msg;
        } catch (e) {
            logger.error("Interface-Reply fehlgeschlagen:", e);
        }
    };
    await next();
});

// --- NEU: HANDLER FÜR MENGEN-EINGABEN (AUTO-DELETE) ---
bot.on('text', async (ctx, next) => {
    // Falls kein aktiver Trade-Status in der Session, normal weiter
    if (!ctx.session?.activeTrade) return next();

    const amount = parseFloat(ctx.message.text.replace(',', '.'));
    const { coinId, type } = ctx.session.activeTrade;

    // 1. User-Nachricht sofort löschen (für Immersion)
    try {
        await ctx.deleteMessage().catch(() => {});
    } catch (e) {}

    // 2. Validierung
    if (isNaN(amount) || amount <= 0) {
        // Wir senden eine temporäre Warnung über das Interface
        return ctx.sendInterface(`⚠️ **Fehler:** Bitte gib eine gültige Zahl für ${coinId.toUpperCase()} ein.`);
    }

    // 3. Trade ausführen
    if (type === 'buy') {
        await handleBuy(ctx, coinId, amount);
    } else if (type === 'sell') {
        await handleSell(ctx, coinId, amount);
    }

    // 4. Status löschen, damit normale Nachrichten wieder durchgehen
    delete ctx.session.activeTrade;
});

bot.catch((err, ctx) => {
    if (err.description?.includes("message to delete not found")) return;
    logger.error(`Kritischer Fehler:`, err);
});

// 4. Befehle & Handler
bot.command('start', (ctx) => handleStart(ctx));

bot.hears('📈 Trading Center', async (ctx) => {
    await ctx.sendInterface("⌛ Lade Live-Kurse..."); 
    return showTradeMenu(ctx);
});

bot.hears('🏠 Immobilien', (ctx) => showImmoMarket(ctx));

bot.hears('💰 Mein Portfolio', async (ctx) => {
    await ctx.sendInterface("⌛ Öffne Portfolio...");
    return showWallet(ctx);
});

bot.hears('🏆 Bestenliste', (ctx) => showLeaderboard(ctx, 'wealth'));

// 5. Callback-Query Handler
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    
    if (action === 'open_trading_center') return showTradeMenu(ctx);
    
    if (action.startsWith('view_coin_')) {
        return showTradeMenu(ctx, action.split('_')[2]);
    }

    // NEU: Diese Callbacks triggern den Eingabe-Modus in trade.js
    if (action.startsWith('trade_buy_')) {
        const { initiateTradeInput } = await import('./commands/trade.js');
        return initiateTradeInput(ctx, action.split('_')[2], 'buy');
    }
    
    if (action.startsWith('trade_sell_')) {
        const { initiateTradeInput } = await import('./commands/trade.js');
        return initiateTradeInput(ctx, action.split('_')[2], 'sell');
    }

    if (action === 'main_menu') {
        return ctx.sendInterface("🏠 **Hauptmenü**\nWas möchtest du tun?", mainKeyboard);
    }

    if (action.startsWith('rank_')) return showLeaderboard(ctx, action.replace('rank_', ''));

    try {
        await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}
});

// 6. Startvorgang
async function launch() {
    try {
        const version = getVersion();
        await bot.launch();

        logger.info("Starte initialen Marktdaten-Abruf...");
        await updateMarketPrices().catch(e => logger.error("Erster Fetch fehlgeschlagen", e));

        startGlobalScheduler(bot);
        console.log(`🚀 MoonShot Tycoon ONLINE (v${version})`);
    } catch (err) {
        logger.error("Launch Error:", err);
        process.exit(1);
    }
}

const port = CONFIG.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200); res.end('Bot running');
}).listen(port);

launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
