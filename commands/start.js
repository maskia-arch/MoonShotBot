// commands/start.js
import { syncUser } from '../supabase/queries.js';
import { uncleLetterLayout } from '../ui/layouts.js';
import { mainKeyboard } from '../ui/buttons.js';
import { logger } from '../utils/logger.js';
import { CONFIG } from '../config.js';

/**
 * Verarbeitet den /start Befehl.
 * Erstellt den User-Account und heftet den Onkel-Brief dauerhaft an.
 */
export async function handleStart(ctx) {
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Hustler';
    const username = ctx.from.username || firstName;

    try {
        // User-Nachricht (/start) löschen für ein sauberes Interface
        try {
            await ctx.deleteMessage().catch(() => {});
        } catch (e) {}

        await ctx.sendChatAction('typing');

        // 1. User-Daten synchronisieren
        const userData = await syncUser(userId, username);

        if (!userData) {
            throw new Error("User-Synchronisierung fehlgeschlagen");
        }

        // 2. Prüfung: Neuer User oder Rückkehrer?
        const isNewUser = new Date() - new Date(userData.created_at) < 15000; // 15s Puffer

        if (isNewUser) {
            // --- NEUER SPIELER: ONKEL WILLI BRIEF & PIN ---
            const welcomeMessage = uncleLetterLayout(firstName);

            // Wir senden den Brief separat, da er dauerhaft OBEN bleiben soll (Pin)
            const sentMsg = await ctx.reply(welcomeMessage, {
                parse_mode: 'Markdown'
            });

            // Brief dauerhaft anheften
            try {
                await ctx.pinChatMessage(sentMsg.message_id);
            } catch (e) {
                logger.debug("Pinnen fehlgeschlagen: " + e.message);
            }

            // Danach das eigentliche Spiel-Interface öffnen
            const startInfo = `🚀 **Willkommen im Spiel!**\n\nDein Startkapital wurde gutgeschrieben. Nutze das Menü unten, um deine ersten Coins zu kaufen oder Immobilien zu checken.`;
            
            // Initialisiert das Single-Message-Interface
            await ctx.sendInterface(startInfo, mainKeyboard);

            logger.info(`Neuer Spieler registriert: ${username} (${userId})`);

        } else {
            // --- RÜCKKEHRER: SAUBERES INTERFACE ---
            const welcomeBackMsg = `👋 **Willkommen zurück, ${firstName}!**\n\nDer Markt schläft nie. Was ist dein nächster Move?`;
            
            // Nutzt die zentrale sendInterface Logik (editiert die letzte Nachricht)
            await ctx.sendInterface(welcomeBackMsg, mainKeyboard);
        }

    } catch (err) {
        logger.error("Fehler im Start-Command:", err);
        // Fallback, falls sendInterface noch nicht bereit ist
        await ctx.reply("🚨 Marktplatz-Verbindung fehlgeschlagen. Versuche es gleich noch einmal.");
    }
}
