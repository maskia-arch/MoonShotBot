// ui/layouts.js
import { formatCurrency, formatPercent } from '../utils/formatter.js';

// --- BASIS KOMPONENTEN (Direkt hier definiert, um Import-Fehler zu vermeiden) ---
export const divider = "----------------------------------";

export const renderHeader = (title) => `🏆 **${title.toUpperCase()}**`;

export const renderFooter = () => `\n🎮 _MoonShot Tycoon v1.0_`;

export const renderBalanceSnippet = (balance) => `Kontostand: \`${formatCurrency(balance)}\``;

/**
 * Hilfsfunktion für Zustandsbalken (Immobilien)
 */
const formatProgressBar = (value) => {
    const total = 5;
    const filled = Math.round((value / 100) * total);
    return '🟩'.repeat(filled) + '⬜'.repeat(total - filled) + ` ${value}%`;
};

// --- LAYOUTS ---

/**
 * Der atmosphärische Einstieg: Onkel Willis Brief
 */
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
 * Die Dashboard-Ansicht (Portfolio)
 */
export const portfolioLayout = (userData, assets = []) => {
    let message = [
        renderHeader("Dein Vermögen"),
        renderBalanceSnippet(userData.balance),
        `Handelsvolumen: \`${formatCurrency(userData.trading_volume)}\``,
        divider,
        `📊 **Assets:** ${assets.length > 0 ? '' : '_Noch keine Assets vorhanden._'}`
    ];

    assets.forEach(asset => {
        if(asset.type === 'crypto') {
            message.push(`• ${asset.symbol.toUpperCase()}: \`${asset.amount}\` (Profit: ${formatPercent(asset.profit)})`);
        } else {
            message.push(`• ${asset.name}: ${formatProgressBar(asset.condition)}`);
        }
    });

    message.push(renderFooter());
    return message.join('\n');
};

/**
 * Das Trading-Interface für einen spezifischen Coin
 */
export const tradingViewLayout = (coinData, userBalance) => {
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
 * Die Immobilien-Marktplatz Ansicht
 */
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
