// ui/layouts.js
import { formatCurrency, formatPercent, formatProgressBar } from '../utils/formatter.js';
import { CONFIG } from '../config.js';

// --- BASIS KOMPONENTEN ---
export const divider = "----------------------------------";

export const renderHeader = (title) => `🏆 **${title.toUpperCase()}**`;

// DYNAMISCH: Nutzt die Version aus der config.js
export const renderFooter = () => `\n🎮 _MoonShot Tycoon v${CONFIG.VERSION}_`;

export const renderBalanceSnippet = (balance) => `Kontostand: \`${formatCurrency(balance)}\``;

// --- LAYOUTS ---

export const uncleLetterLayout = (userName) => {
    return `
✉️ **EIN BRIEF AUS DER TOSKANA**
${divider}
Mein lieber ${userName},

die Luft hier ist herrlich, aber mein altes Händlerherz ist unruhig. Ich habe dir **10.000 €** auf dein Konto überwiesen. Es ist nicht viel, aber es ist ein Anfang.

Die Welt der Coins ist wild – pass auf, dass du nicht alles auf einmal verhebelst. Wenn du klug bist, sicherst du deine Gewinne in Steinen und Mörtel.

Enttäusche mich nicht. Wir hören uns beim nächsten Kassensturz!

Dein Onkel Willi
${renderFooter()}
`;
};

/**
 * Portfolio-Layout: Zeigt PnL und Fortschritt zum Immobilien-Limit an.
 */
export const portfolioLayout = (userData, assets = []) => {
    const targetVolume = 30000;
    const currentVolume = userData.trading_volume || 0;
    const remaining = Math.max(targetVolume - currentVolume, 0);

    let message = [
        renderHeader("Dein Vermögen"),
        renderBalanceSnippet(userData.balance),
        `Handelsvolumen: \`${formatCurrency(currentVolume)}\``,
        divider
    ];

    // Status der Immobilien-Sperre anzeigen
    if (remaining > 0) {
        message.push(`⚠️ **Immobilien-Sperre**`);
        message.push(`Fortschritt: ${formatProgressBar(currentVolume, targetVolume)}`);
        message.push(`Handel noch \`${formatCurrency(remaining)}\` für Zugriff.\n`);
    } else {
        message.push(`✅ **Immobilien-Markt freigeschaltet!**\n`);
    }

    message.push(`📊 **Assets:** ${assets.length > 0 ? '' : '_Noch keine Assets vorhanden._'}`);

    assets.forEach(asset => {
        if(asset.type === 'crypto') {
            const profitStr = asset.profit >= 0 ? formatPercent(asset.profit) : formatPercent(asset.profit);
            const emoji = asset.profit >= 0 ? '📈' : '📉';
            message.push(`${emoji} **${asset.symbol.toUpperCase()}**: \`${asset.amount}\` (PnL: ${profitStr})`);
        } else {
            // Für echte Immobilien nutzen wir den 5-Segment Balken
            const bar = '🟩'.repeat(Math.round(asset.condition / 20)) + '⬜'.repeat(5 - Math.round(asset.condition / 20));
            message.push(`🏠 **${asset.name}**: ${bar} ${asset.condition}%`);
        }
    });

    message.push(renderFooter());
    return message.join('\n');
};

/**
 * Detailansicht eines Coins im Trading Center
 */
export const tradingViewLayout = (coinData, userBalance) => {
    // Vorzeichen manuell setzen für saubere Optik
    return `
${renderHeader(`Trading: ${coinData.symbol.toUpperCase()}`)}
Preis: \`${formatCurrency(coinData.price)}\`
24h Change: ${formatPercent(coinData.change24h)}

${renderBalanceSnippet(userBalance)}
${divider}
💡 *Tipp: Nutze hohe Hebel nur, wenn du das Risiko einer Liquidation verstehst.*
${renderFooter()}
`;
};

/**
 * Layout für die Mengeneingabe (Kaufen/Verkaufen)
 */
export const tradeInputLayout = (coinId, type, price, limitInfo) => {
    const actionTitle = type === 'buy' ? '🛒 KAUFEN' : '💰 VERKAUFEN';
    return `
${renderHeader(actionTitle)}
Symbol: **${coinId.toUpperCase()}**
Kurs: \`${formatCurrency(price)}\`

${divider}
${limitInfo}

⌨️ _Bitte sende jetzt die gewünschte Anzahl als Nachricht._
_Zum Abbrechen nutze den Button unten oder wechsle das Menü._
${renderFooter()}
`;
};

export const immoMarketLayout = (availableImmos, userBalance) => {
    let message = [
        renderHeader("Immobilien-Markt"),
        renderBalanceSnippet(userBalance),
        divider,
        "Wähle ein Objekt für Details:"
    ];

    availableImmos.forEach(immo => {
        message.push(`${immo.emoji} **${immo.name}**\nPreis: \`${formatCurrency(immo.price)}\``);
    });

    message.push(renderFooter());
    return message.join('\n');
};
