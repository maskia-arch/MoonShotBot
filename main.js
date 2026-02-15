// main.js
import { Telegraf, session } from 'telegraf';
import http from 'http'; // Für den Render Health-Check
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

// 1. Bot-Instanz erstellen
// WICHTIG: In deiner config.js heißt es TELEGRAM_TOKEN
if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt in den Environment Variables!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

// 2. Middleware & Session-Setup
bot.use(session());
bot.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.debug(`Response time: ${ms}ms`);
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

// 5. Callback-Query Handler (Inline Buttons)
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    logger.info(`Action: ${action} von User ${ctx.from.id}`);

    // Ranking-Filter
    if (action === 'rank_wealth') return showLeaderboard(ctx, 'wealth');
    if (action === 'rank_profit') return showLeaderboard(ctx, 'profit');
    if (action === 'rank_loser') return showLeaderboard(ctx, 'loser');

    await ctx.answerCbQuery();
});

// 6. Startvorgang
async function launch() {
    try {
        const version = getVersion();
        logger.info(`MoonShot Tycoon ${version} wird gestartet...`);
        
        // Supabase Verbindung testen
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;
        logger.info("Datenbank-Verbindung erfolgreich hergestellt.");

        // Bot starten
        await bot.launch();
        
        // Startet Mieten, Kurse & Events
        startGlobalScheduler(bot);

        console.log(`
        ----------------------------------
        🚀 MoonShot Tycoon ist ONLINE (${version})
        Status: Alle Systeme aktiv.
        ----------------------------------
        `);
    } catch (err) {
        logger.error("Fehler beim Bot-Launch:", err);
        process.exit(1);
    }
}

// 7. Render Keep-Alive Server (Health Check)
// Dies verhindert, dass Render den Port-Error wirft
const port = CONFIG.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('MoonShot Tycoon Bot is running...');
}).listen(port, () => {
    logger.info(`🌐 Health-Check Server läuft auf Port ${port}`);
});

launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
