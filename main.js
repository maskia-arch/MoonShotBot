// main.js
import { Telegraf, session, Markup } from 'telegraf';
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

// 1. Bot-Instanz erstellen
if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt in den Environment Variables!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

// 2. Middleware & Session-Setup
bot.use(session());

/**
 * GLOBALER INTERFACE HANDLER
 * Macht ctx.sendInterface überall verfügbar
 */
bot.use(async (ctx, next) => {
    ctx.sendInterface = async (text, extra = {}) => {
        if (ctx.callbackQuery) {
            try {
                return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
            } catch (e) {
                // Falls Text identisch, ignorieren
            }
        }

        if (ctx.session?.lastMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastMessageId);
            } catch (e) {
                // Nachricht bereits weg
            }
        }

        const msg = await ctx.reply(text, { parse_mode: 'Markdown', ...extra });
        ctx.session.lastMessageId = msg.message_id;
        return msg;
    };
    await next();
});

// 3. Fehlerbehandlung
bot.catch((err, ctx) => {
    logger.error(`Kritischer Fehler bei Update ${ctx.update.update_id}:`, err);
});

// 4. Befehle & Menü-Handler
bot.command('start', (ctx) => handleStart(ctx));

bot.hears('📈 Trading Center', (ctx) => showTradeMenu(ctx));
bot.hears('🏠 Immobilien', (ctx) => showImmoMarket(ctx));
bot.hears('💰 Mein Portfolio', (ctx) => showWallet(ctx));
bot.hears('🏆 Bestenliste', (ctx) => showLeaderboard(ctx, 'wealth'));

// 5. Callback-Query Handler (Interaktionen)
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    logger.info(`Action: ${action} von User ${ctx.from.id}`);

    // --- Trading Center Navigation ---
    if (action === 'open_trading_center') {
        return showTradeMenu(ctx);
    }

    if (action.startsWith('view_coin_')) {
        const coinId = action.split('_')[2];
        return showTradeMenu(ctx, coinId);
    }

    // --- Ranking Filter ---
    if (action === 'rank_wealth') return showLeaderboard(ctx, 'wealth');
    if (action === 'rank_profit') return showLeaderboard(ctx, 'profit');
    if (action === 'rank_loser') return showLeaderboard(ctx, 'loser');

    // --- Globaler Zurück-Button ---
    if (action === 'main_menu') {
        return ctx.sendInterface("🏠 **Hauptmenü**\nNutze die Tastatur unten für deine Aktionen.", mainKeyboard);
    }

    await ctx.answerCbQuery();
});

// 6. Startvorgang
async function launch() {
    try {
        const version = getVersion();
        logger.info(`MoonShot Tycoon ${version} wird gestartet...`);
        
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        logger.info("Datenbank-Verbindung erfolgreich hergestellt.");

        await bot.launch();
        startGlobalScheduler(bot);

        console.log(`
        ----------------------------------
        🚀 MoonShot Tycoon ist ONLINE (v${version})
        Coins aktiv: ${CONFIG.SUPPORTED_COINS.join(', ')}
        ----------------------------------
        `);
    } catch (err) {
        logger.error("Fehler beim Bot-Launch:", err);
        process.exit(1);
    }
}

// 7. Render Keep-Alive
const port = CONFIG.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MoonShot Tycoon Bot is running...');
}).listen(port);

launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
