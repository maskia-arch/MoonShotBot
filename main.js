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
import { updateMarketPrices } from './logic/market.js'; // Wichtig für Sofort-Start

if (!CONFIG.TELEGRAM_TOKEN) {
    logger.error("BOT_TOKEN fehlt in den Environment Variables!");
    process.exit(1);
}
const bot = new Telegraf(CONFIG.TELEGRAM_TOKEN);

bot.use(session());

/**
 * OPTIMIERTER INTERFACE HANDLER
 * Sorgt für sauberen Chat durch Löschen veralteter Nachrichten.
 */
bot.use(async (ctx, next) => {
    ctx.sendInterface = async (text, extra = {}) => {
        // 1. Button-Klick: Editieren
        if (ctx.callbackQuery) {
            try {
                return await ctx.editMessageText(text, { parse_mode: 'Markdown', ...extra });
            } catch (e) {
                // Falls Editieren fehlschlägt, löschen wir unten neu
            }
        }

        // 2. Veraltete Nachricht löschen
        if (ctx.session?.lastMessageId) {
            try {
                // .catch verhindert Fehlermeldungen, falls Nachricht bereits gelöscht wurde
                await ctx.telegram.deleteMessage(ctx.chat.id, ctx.session.lastMessageId).catch(() => {});
            } catch (e) {}
        }

        // 3. Neue Nachricht senden
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
    if (err.description?.includes("message to delete not found")) return;
    logger.error(`Kritischer Fehler:`, err);
});

// 4. Befehle & Handler
bot.command('start', (ctx) => handleStart(ctx));

// Hears-Handler nutzen jetzt sendInterface für Immersion
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
        const coinId = action.split('_')[2];
        return showTradeMenu(ctx, coinId);
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
        const { error } = await supabase.from('profiles').select('count', { count: 'exact', head: true });
        if (error) throw error;

        await bot.launch();

        // INITIALER FETCH: Verhindert "Marktdaten werden geladen" beim ersten Klick
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
    res.writeHead(200);
    res.end('Bot running');
}).listen(port);

launch();

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
