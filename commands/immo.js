// commands/immo.js
import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';
import { immoMarketLayout } from '../ui/layouts.js';
import { immoMarketButtons, confirmAction } from '../ui/buttons.js';
import { CONFIG } from '../config.js';

/**
 * Zeigt den Immobilienmarkt an
 */
export async function showImmoMarket(ctx) {
    const userId = ctx.from.id;

    try {
        // 1. User-Daten laden, um Umsatz und Guthaben zu prüfen
        const { data: user, error } = await supabase
            .from('profiles')
            .select('balance, trading_volume')
            .eq('id', userId)
            .single();

        if (error) throw error;

        // 2. Prüfung: Hat der User genug Umsatz generiert? (Realismus-Hürde)
        if (user.trading_volume < CONFIG.MIN_VOL_FOR_REALESTATE) {
            const missing = CONFIG.MIN_VOL_FOR_REALESTATE - user.trading_volume;
            return ctx.reply(
                `⚠️ **Zugriff verweigert**\n\nOnkel Willi traut dir noch nicht ganz. Er möchte sehen, dass du dich am Markt beweist.\n\nDu musst noch für weitere \`${missing} €\` traden, um Immobilien freizuschalten!`
            );
        }

        // 3. Verfügbare Immobilien definieren (später aus DB oder Config)
        const availableImmos = [
            { id: 'garage', name: 'Garage in Berlin', price: 15000, emoji: '🚗' },
            { id: 'apartment', name: '1-Zimmer Appartement', price: 120000, emoji: '🏢' },
            { id: 'house', name: 'Reihenhaus', price: 550000, emoji: '🏡' }
        ];

        // 4. Layout generieren und senden
        const message = immoMarketLayout(availableImmos, user.balance);
        await ctx.reply(message, {
            parse_mode: 'Markdown',
            ...immoMarketButtons('garage') // Beispielhaft für das erste Objekt
        });

    } catch (err) {
        logger.error("Fehler im Immo-Markt Command:", err);
        ctx.reply("❌ Der Immobilienmarkt ist momentan wegen Wartungsarbeiten geschlossen.");
    }
}

/**
 * Logik für den Kaufprozess einer Immobilie
 */
export async function handleBuyProperty(ctx, assetType) {
    const userId = ctx.from.id;
    
    // In einer echten Umgebung würden wir hier die Preise aus der Config ziehen
    const prices = { garage: 15000, apartment: 120000, house: 550000 };
    const price = prices[assetType];

    try {
        // 1. Guthaben prüfen
        const { data: user } = await supabase.from('profiles').select('balance').eq('id', userId).single();
        
        if (user.balance < price) {
            return ctx.answerCbQuery("❌ Nicht genug Guthaben auf dem Konto!", { show_alert: true });
        }

        // 2. Transaktion: Geld abziehen und Asset hinzufügen
        // In Supabase idealerweise über eine RPC-Funktion für Atomarität
        await supabase.rpc('increment_balance', { user_id: userId, amount: -price });
        
        await supabase.from('user_assets').insert({
            user_id: userId,
            asset_type: assetType,
            purchase_price: price,
            condition: 100
        });

        await ctx.answerCbQuery("✅ Kauf erfolgreich!");
        await ctx.editMessageText(`🎉 Glückwunsch! Du bist nun Besitzer einer neuen Immobilie: **${assetType}**.`);
        
    } catch (err) {
        logger.error("Fehler beim Immobilienkauf:", err);
    }
}
