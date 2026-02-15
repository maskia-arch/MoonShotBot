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

if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt in den Environment Variables!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

bot.use(session());

/**
 * OPTIMIERTER INTERFACE HANDLER
 * Unterdrückt Fehler beim Löschen und sorgt für Immersion.
 */
bot.use(async (ctx, next) => {
    ctx.sendInterface = async (text, extra = {}) => {
        // 1. Button-Klick: Versuche zu editieren
        if (ctx.callbackQuery) {
            try {
                return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
            } catch (e) {
                // Falls Editieren nicht geht, löschen wir unten neu
            }
        }

        // 2. Veraltete Nachricht löschen (Sauberer Chat)
        if (ctx.session?.lastMessageId) {
            try {
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastMessageId).catch(() => {});
            } catch (e) {
                // Fehler beim Löschen lautlos ignorieren
            }
        }

        // 3. Neue Nachricht senden und ID speichern
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

bot.catch((err, ctx) => {
    // Verhindert, dass harmlose Lösch-Fehler den Bot-Fluss stören
    if (err.description?.includes("message to delete not found")) return;
    logger.error(`Kritischer Fehler:`, err);
});

// 4. Befehle (Nutzen jetzt die Middleware für Immersion)
bot.command('start', (ctx) => handleStart(ctx));

// WICHTIG: Die hears-Handler rufen jetzt ctx.sendInterface auf, bevor sie in die Commands gehen
bot.hears('📈 Trading Center', (ctx) => showTradeMenu(ctx));
bot.hears('🏠 Immobilien', (ctx) => showImmoMarket(ctx));
bot.hears('💰 Mein Portfolio', (ctx) => showWallet(ctx));
bot.hears('🏆 Bestenliste', (ctx) => showLeaderboard(ctx, 'wealth'));

// 5. Callback-Query Handler
bot.on('callback_query', async (ctx) => {
    const action = ctx.callbackQuery.data;
    
    if (action === 'open_trading_center') return showTradeMenu(ctx);
    if (action.startsWith('view_coin_')) {
        const coinId = action.split('_')[2];
        return showTradeMenu(ctx, coinId);
    }
    if (action === 'main_menu') {
        return ctx.sendInterface("🏠 **Hauptmenü**\nWas möchtest du tun?", mainKeyboard);
    }

    // Ranking Filter
    if (action.startsWith('rank_')) return showLeaderboard(ctx, action.replace('rank_', ''));

    try {
        await ctx.answerCbQuery();
    } catch (e) {}
});

async function launch() {
    try {
        const version = getVersion();
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;

        await bot.launch();
        startGlobalScheduler(bot);

        console.log(`🚀 MoonShot Tycoon ONLINE (v${version})`);
    } catch (err) {
        logger.error("Launch Error:", err);
        process.exit(1);
    }
}

const port = CONFIG.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot running');
}).listen(port);

launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
