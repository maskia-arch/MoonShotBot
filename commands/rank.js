// commands/rank.js
import { getFilteredLeaderboard } from '../supabase/queries.js';
import { renderHeader, renderFooter, divider } from '../ui/layouts.js';
import { formatCurrency, truncateText } from '../utils/formatter.js';
import { logger } from '../utils/logger.js';
import { Markup } from 'telegraf';

/**
 * Erstellt und sendet das Leaderboard mit Filter-Optionen.
 * Unterstützt 'wealth', 'profit' und 'loser'.
 */
export async function showLeaderboard(ctx, filterType = 'wealth') {
    try {
        // 1. Daten basierend auf Filter aus der DB holen
        const topPlayers = await getFilteredLeaderboard(filterType);

        // 2. Titel und Texte je nach Filter anpassen
        let title = "Globales Ranking";
        let subTitle = "Wer beherrscht den Markt? 💸";
        
        if (filterType === 'profit') {
            title = "Top Gewinner (Season)";
            subTitle = "Die besten Trader diesen Monat! 🚀";
        } else if (filterType === 'loser') {
            title = "Größte Verlierer (Season)";
            subTitle = "Autsch! Hier wurden Konten gegrillt. 🤡";
        }

        if (!topPlayers || topPlayers.length === 0) {
            return ctx.reply(`🏆 **${title}**\n\nNoch keine Daten für diese Kategorie verfügbar.`);
        }

        // 3. Leaderboard-Text zusammenbauen
        let rankList = [
            renderHeader(title),
            subTitle,
            divider
        ];

        topPlayers.forEach((item, index) => {
            const medal = getMedal(index + 1);
            // Handling für verschachtelte Joins (profiles.username bei Season Stats)
            const name = truncateText(item.username || item.profiles?.username || 'Anonym', 12);
            // Welchen Wert zeigen wir an?
            const value = item.balance || item.season_profit || item.season_loss;
            
            rankList.push(`${medal} **${name}** — \`${formatCurrency(value)}\``);
        });

        rankList.push(divider);
        rankList.push(renderFooter());

        // 4. Inline-Buttons für die Filter
        const buttons = Markup.inlineKeyboard([
            [
                Markup.button.callback('💰 Reichste', 'rank_wealth'),
                Markup.button.callback('🚀 Gewinner', 'rank_profit'),
                Markup.button.callback('🤡 Verlierer', 'rank_loser')
            ]
        ]);

        // 5. Nachricht senden oder editieren
        const messageText = rankList.join('\n');
        
        if (ctx.callbackQuery) {
            // Wenn der User auf einen Button geklickt hat, editieren wir die bestehende Nachricht
            await ctx.editMessageText(messageText, { 
                parse_mode: 'Markdown', 
                ...buttons 
            });
        } else {
            // Wenn der Befehl neu aufgerufen wurde (/rank oder Button im Menü)
            await ctx.reply(messageText, { 
                parse_mode: 'Markdown', 
                ...buttons 
            });
        }

    } catch (err) {
        logger.error(`Fehler im Leaderboard (${filterType}):`, err);
        ctx.reply("❌ Das Leaderboard konnte nicht geladen werden.");
    }
}

/**
 * Hilfsfunktion für Medaillen-Emojis
 */
function getMedal(rank) {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return ` ${rank}.`;
    }
}
