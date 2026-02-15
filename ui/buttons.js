// ui/buttons.js
import { Markup } from 'telegraf';

/**
 * Das Hauptmenü (Untere Tastatur)
 */
export const mainKeyboard = Markup.keyboard([
    ['📈 Trading Center', '🏠 Immobilien'],
    ['💰 Mein Portfolio', '🏆 Bestenliste'],
    ['⚙️ Einstellungen']
]).resize();

/**
 * 1. COIN-LISTE (Übersicht)
 * Erzeugt für jeden aktiven Coin eine Zeile mit Trend-Emoji.
 */
export const coinListButtons = (marketData) => {
    const buttons = Object.keys(marketData).map(id => {
        const coin = marketData[id];
        const change = coin.change24h >= 0 ? '📈' : '📉';
        // Beispiel: "📈 BITCOIN (58.000€)"
        return [Markup.button.callback(`${change} ${id.toUpperCase()} (${coin.price.toLocaleString()}€)`, `view_coin_${id}`)];
    });
    
    buttons.push([Markup.button.callback('🏠 Zurück zum Hauptmenü', 'main_menu')]);
    return Markup.inlineKeyboard(buttons);
};

/**
 * 2. COIN-DETAIL-MENÜ (Kauf/Verkauf/Wette)
 * Das Menü, das erscheint, wenn man einen Coin ausgewählt hat.
 */
export const coinActionButtons = (coinId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🎰 Kurs-Wette (Hebel)', `trade_leverage_${coinId}`)],
        [
            Markup.button.callback('🛒 Kaufen', `trade_buy_${coinId}`), 
            Markup.button.callback('💰 Verkaufen', `trade_sell_${coinId}`)
        ],
        [Markup.button.callback('⬅️ Zurück zur Liste', 'open_trading_center')]
    ]);
};

/**
 * 3. HEBEL-AUSWAHL (Für die Kurs-Wette)
 */
export const leverageButtons = (coinId) => {
    return Markup.inlineKeyboard([
        [
            Markup.button.callback('x2', `set_lev_${coinId}_2`),
            Markup.button.callback('x5', `set_lev_${coinId}_5`),
            Markup.button.callback('x10', `set_lev_${coinId}_10`)
        ],
        [
            Markup.button.callback('x20', `set_lev_${coinId}_20`),
            Markup.button.callback('x50 🔥', `set_lev_${coinId}_50`)
        ],
        [Markup.button.callback('⬅️ Abbrechen', `view_coin_${coinId}`)]
    ]);
};

/**
 * Bestehende Immobilien-Buttons
 */
export const immoMarketButtons = (immoId) => {
    return Markup.inlineKeyboard([
        [Markup.button.callback('➕ Objekt kaufen', `buy_immo_${immoId}`)],
        [Markup.button.callback('ℹ️ Details anzeigen', `info_immo_${immoId}`)]
    ]);
};

/**
 * Portfolio & Verlauf
 */
export const portfolioButtons = Markup.inlineKeyboard([
    [
        Markup.button.callback('📊 Coins', 'port_crypto'),
        Markup.button.callback('🏘️ Objekte', 'port_immo')
    ],
    [Markup.button.callback('🧾 Transaktionsverlauf', 'view_history')]
]);
