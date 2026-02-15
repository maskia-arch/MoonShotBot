// main.js
import { Telegraf, session, Markup } from 'telegraf';
import http from 'http'; 
import { CONFIG } from './config.js';
import { logger } from './utils/logger.js';
import { supabase } from './supabase/client.js';
import { handleStart } from './commands/start.js';
import { showTradeMenu, handleBuy, handleSell } from './commands/trade.js';
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
 * ZENTRALER INTERFACE HANDLER (Single-Message-Prinzip)
 * Fix: Initialisiert ctx.session, falls sie undefined ist.
 */
bot.use(async (ctx, next) => {
    // KRITISCH: Verhindert den "undefined" Fehler beim Zugriff auf lastMessageId
    if (ctx.from && !ctx.session) {
        ctx.session = {};
    }

    ctx.sendInterface = async (text, extra = {}) => {
        const lastId = ctx.session?.lastMessageId;

        // 1. VERSUCH: Bestehende Nachricht editieren
        if (lastId) {
            try {
                return await ctx.telegram.editMessageText(ctx.chat.id, lastId, null, text, {
                    parse_mode: 'Markdown',
                    ...extra
                });
            } catch (e) {
                // Falls Editieren fehlschlägt, löschen wir die alte Nachricht
                try {
                    await ctx.telegram.deleteMessage(ctx.chat.id, lastId).catch(() => {});
                } catch (delErr) {}
            }
        }

        // 2. NEU SENDEN
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

/**
 * AUTO-CLEANUP HANDLER
 * Löscht User-Eingaben sofort nach Erhalt.
 */
bot.on('text', async (ctx, next) => {
    // User Nachricht sofort löschen
    try {
        await ctx.deleteMessage().catch(() => {});
    } catch (e) {}

    if (!ctx.session?.activeTrade || ctx.message.text.startsWith('/')) return next();

    const amount = parseFloat(ctx.message.text.replace(',', '.'));
    const { coinId, type } = ctx.session.activeTrade;

    if (isNaN(amount) || amount <= 0) {
        return ctx.sendInterface(`🚨 **Fehler:** Bitte gib eine gültige Anzahl für ${coinId.toUpperCase()} ein.`);
    }

    if (type === 'buy') {
        await handleBuy(ctx, coinId, amount);
    } else if (type === 'sell') {
        await handleSell(ctx, coinId, amount);
    }
    
    delete ctx.session.activeTrade;
});

bot.catch((err, ctx) => {
    if (err.description?.includes("message to delete not found") || err.description?.includes("message is not modified")) return;
    logger.error(`Kritischer Fehler:`, err);
});

// --- BEFEHLE & HANDLER ---
bot.command('start', (ctx) => handleStart(ctx));

bot.hears('📈 Trading Center', (ctx) => showTradeMenu(ctx));
bot.hears('💰 Mein Portfolio', (ctx) => showWallet(ctx));
bot.hears('🏠 Immobilien', (ctx) => showImmoMarket(ctx));
bot.hears('🏆 Bestenliste', (ctx) => showLeaderboard(ctx, 'wealth'));

// --- CALLBACK QUERIES ---
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    
    if (action === 'open_trading_center') return showTradeMenu(ctx);
    if (action.startsWith('view_coin_')) return showTradeMenu(ctx, action.split('_')[2]);

    if (action.startsWith('trade_buy_') || action.startsWith('trade_sell_')) {
        const parts = action.split('_');
        const { initiateTradeInput } = await import('./commands/trade.js');
        return initiateTradeInput(ctx, parts[2], parts[1]);
    }

    if (action === 'main_menu') {
        return ctx.sendInterface("🏠 **Hauptmenü**\nWas möchtest du tun?", mainKeyboard);
    }

    if (action.startsWith('rank_')) return showLeaderboard(ctx, action.replace('rank_', ''));

    try {
        await ctx.answerCbQuery().catch(() => {});
    } catch (e) {}
});

async function launch() {
    try {
        const version = getVersion();
        await bot.launch();

        logger.info("Lade initiale Marktdaten...");
        // updateMarketPrices wird durch das neue market.js-Modul mit Fallbacks abgesichert
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
