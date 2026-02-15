// commands/start.js
import { syncUser } from '../supabase/queries.js';
import { uncleLetterLayout } from '../ui/layouts.js';
import { mainKeyboard } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Verarbeitet den /start Befehl.
 * Erstellt den User-Account (falls neu) und zeigt das Intro oder ein Willkommen zurück.
 */
export async function handleStart(ctx) {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Hustler';
    const username = ctx.from.username || firstName;

    try {
        await ctx.sendChatAction('typing');

        // 1. User-Daten synchronisieren
        // Wir nutzen syncUser, um zu prüfen, ob der User neu ist
        const userData = await syncUser(userId, username);

        if (!userData) {
            throw new Error("User-Synchronisierung fehlgeschlagen");
        }

        // 2. Logik: Ist der User neu oder ein Rückkehrer?
        // Wir prüfen das Erst-Anmeldedatum (created_at). 
        // Wenn es weniger als 10 Sekunden her ist, gilt er als "neu registriert".
        const isNewUser = new Date() - new Date(userData.created_at) < 10000;

        if (isNewUser) {
            // --- ERST-INITIALISIERUNG: ONKEL WILLI BRIEF ---
            const welcomeMessage = uncleLetterLayout(firstName);

            const sentMsg = await ctx.reply(welcomeMessage, {
                parse_mode: 'Markdown',
                ...mainKeyboard
            });

            // Brief dauerhaft anpinnen
            try {
                await ctx.pinChatMessage(sentMsg.message_id);
            } catch (e) {
                logger.debug("Pinnen im Privat-Chat fehlgeschlagen (evtl. Bot-Rechte).");
            }

            // Für das immersive Interface speichern
            ctx.session.lastMessageId = sentMsg.message_id;

            // Optionales kurzes Follow-up
            setTimeout(async () => {
                await ctx.reply(
                    `💡 **Dein Erbe wartet:** Nutze das Menü unten, um dein Imperium zu starten.`,
                    { parse_mode: 'Markdown' }
                );
            }, 1500);

            logger.info(`Neuer Spieler registriert: ${username} (${userId})`);

        } else {
            // --- RÜCKKEHRER: SAUBERES INTERFACE ---
            const welcomeBackMsg = `👋 **Willkommen zurück, ${firstName}!**\n\nDeine Portfolios sind bereit. Was ist dein nächster Move?`;
            
            // Nutzt die zentrale sendInterface Logik aus der main.js
            if (ctx.sendInterface) {
                await ctx.sendInterface(welcomeBackMsg, mainKeyboard);
            } else {
                const msg = await ctx.reply(welcomeBackMsg, {
                    parse_mode: 'Markdown',
                    ...mainKeyboard
                });
                ctx.session.lastMessageId = msg.message_id;
            }
        }

    } catch (err) {
        logger.error("Fehler im Start-Command:", err);
        await ctx.reply("🚨 Ein Fehler ist aufgetreten. Bitte versuche es später noch einmal.");
    }
}
