// main.js
import { Telegraf, session } from 'telegraf';
import http from 'http'; 
import { CONFIG } from './config.js';
import { logger } from './utils/logger.js';
import { supabase } from './supabase/client.js';
import { handleStart } from './commands/start.js';
import { showTradeMenu } from './commands/trade.js';
import { showImmoMarket } from './commands/immo.js';
import { showWallet } from './commands/wallet.js';
import { showLeaderboard } from './commands/rank.js';
import { startGlobalScheduler } from './core/scheduler.js';
import { getVersion } from './utils/versionLoader.js';
import { mainKeyboard } from './ui/buttons.js';
import { updateMarketPrices } from './logic/market.js'; // Wichtig für Initial-Fetch

if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

bot.use(session());

/**
 * GLOBALER INTERFACE HANDLER
 * Verhindert "object Object" Fehler und löscht alte Nachrichten lautlos.
 */
bot.use(async (ctx, next) => {
    ctx.sendInterface = async (text, extra = {}) => {
        // 1. Versuche Editieren bei Button-Klick
        if (ctx.callbackQuery) {
            try {
                return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
            } catch (e) {
                // Falls Editieren nicht möglich, löschen wir weiter unten neu
            }
        }

        // 2. Veraltete Nachricht löschen (Immersion)
        if (ctx.session?.lastMessageId) {
            try {
                // .catch() verhindert die rote Fehlermeldung bei /start
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastMessageId).catch(() => {});
            } catch (e) {}
        }

        // 3. Neue Nachricht senden
        const msg = await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
        ctx.session.lastMessageId = msg.message_id;
        return msg;
    };
    await next();
});

// Befehle
bot.command('start', (ctx) => handleStart(ctx));
bot.hears('📈 Trading Center', (ctx) => showTradeMenu(ctx));
bot.hears('🏠 Immobilien', (ctx) => showImmoMarket(ctx));
bot.hears('💰 Mein Portfolio', (ctx) => showWallet(ctx));
bot.hears('🏆 Bestenliste', (ctx) => showLeaderboard(ctx, 'wealth'));

// Callback-Handler für Buttons
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    if (action === 'open_trading_center') return showTradeMenu(ctx);
    if (action.startsWith('view_coin_')) return showTradeMenu(ctx, action.split('_')[2]);
    if (action === 'main_menu') return ctx.sendInterface("🏠 **Hauptmenü**", mainKeyboard);
    
    await ctx.answerCbQuery().catch(() => {});
});

// Startvorgang
async function launch() {
    try {
        logger.info(`MoonShot Tycoon ${getVersion()} startet...`);
        
        await bot.launch();

        // KRITISCH: Sofort Marktdaten laden, nicht auf Scheduler warten!
        logger.info("Initialer Marktdaten-Fetch...");
        await updateMarketPrices().catch(e => logger.error("Erster Fetch fehlgeschlagen", e));

        startGlobalScheduler(bot);
        logger.info("🚀 System bereit.");
    } catch (err) {
        logger.error("Launch Error:", err);
    }
}

const port = CONFIG.PORT || 3000;
http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(port);

launch();
