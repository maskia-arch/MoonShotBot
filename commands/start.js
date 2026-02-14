// commands/start.js
import { syncUser } from '../supabase/queries.js';
import { uncleLetterLayout } from '../ui/layouts.js';
import { mainKeyboard } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Verarbeitet den /start Befehl.
 * Erstellt den User-Account und zeigt das Intro.
 */
export async function handleStart(ctx) {
    const userId = ctx.from.id;
    const username = ctx.from.username || ctx.from.first_name || 'Hustler';

    try {
        // 1. Tipp-Indikator senden (wirkt lebendiger)
        await ctx.sendChatAction('typing');

        // 2. User in Supabase registrieren oder laden
        const userData = await syncUser(userId, username);

        if (!userData) {
            throw new Error("User-Synchronisierung fehlgeschlagen");
        }

        // 3. Den atmosphärischen Onkel-Brief aus den Layouts generieren
        const welcomeMessage = uncleLetterLayout(ctx.from.first_name);

        // 4. Nachricht senden und das Haupt-Menü (Keyboard) aktivieren
        await ctx.reply(welcomeMessage, {
            parse_mode: 'Markdown',
            ...mainKeyboard
        });

        // 5. Kleines Follow-up für die ersten Schritte
        setTimeout(async () => {
            await ctx.reply(
                `💡 **Dein erster Schritt:** Klicke unten auf "📈 Trading Center", um deine ersten Coins zu kaufen. Dein Onkel beobachtet dich!`,
                { parse_mode: 'Markdown' }
            );
        }, 2000);

        logger.info(`Neuer Spieler registriert: ${username} (${userId})`);

    } catch (err) {
        logger.error("Fehler im Start-Command:", err);
        await ctx.reply(
            `${CONFIG.EMOJIS.ERROR} Ups! Onkel Willi ist gerade nicht erreichbar. Versuche es gleich noch einmal mit /start.`
        );
    }
}
