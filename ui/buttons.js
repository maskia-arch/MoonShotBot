// ui/buttons.js
import { Markup } from 'telegraf';

/**
 * Das Hauptmenü, das die normale Tastatur ersetzt.
 * Erscheint nach dem Start oder wenn der User das Menü aufruft.
 */
export const mainKeyboard = Markup.keyboard([
    ['📈 Trading Center', '🏠 Immobilien'],
    ['💰 Mein Portfolio', '🏆 Bestenliste'],
    ['⚙️ Einstellungen']
]).resize(); // Macht die Buttons kompakt

/**
 * Inline-Buttons für das Krypto-Trading-Fenster.
 * @param {string} symbol - Das Kürzel des Coins (z.B. BTC)
 */
export const tradeControlButtons = (symbol) => {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback(`🚀 Long ${symbol}`, `trade_long_${symbol}`),
            Markup.button.callback(`📉 Short ${symbol}`, `trade_short_${symbol}`)
        ],
        [
            Markup.button.callback('🔄 Aktualisieren', `refresh_price_${symbol}`),
            Markup.button.callback('❌ Schließen', 'close_menu')
        ]
    ]);
};

/**
 * Inline-Buttons für den Immobilienmarkt.
 */
export const immoMarketButtons = (immoId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('➕ Objekt kaufen', `buy_immo_${immoId}`)],
        [Markup.button.callback('ℹ️ Details anzeigen', `info_immo_${immoId}`)]
    ]);
};

/**
 * Buttons für das Portfolio, um zwischen Ansichten zu wechseln.
 */
export const portfolioButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📊 Coins', 'port_crypto'),
        Markup.button.callback('🏘️ Objekte', 'port_immo')
    ],
    [Markup.button.callback('🧾 Transaktionsverlauf', 'view_history')]
]);

/**
 * Bestätigungs-Buttons (für wichtige Käufe/Verkäufe)
 */
export const confirmAction = (actionId) => {
    return Markup.inlineKeyboard([
        Markup.button.callback('✅ Bestätigen', `confirm_${actionId}`),
        Markup.button.callback('❌ Abbrechen', 'cancel_action')
    ]);
};
