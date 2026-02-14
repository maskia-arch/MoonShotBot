// utils/formatter.js

/**
 * Formatiert Geldbeträge nach deutschem Standard
 * Beispiel: 12500.5 -> 12.500,50 €
 */
export const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(amount);
};

/**
 * Formatiert Krypto-Mengen (mehr Nachkommastellen nötig)
 * Beispiel: 0.0004521 -> 0.00045210 BTC
 */
export const formatCrypto = (amount, symbol = '') => {
    const formatted = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
    }).format(amount);
    return symbol ? `${formatted} ${symbol.toUpperCase()}` : formatted;
};

/**
 * Formatiert prozentuale Änderungen mit Emojis
 * Beispiel: 5.2 -> 🟢 +5,20% | -3.1 -> 🔴 -3,10%
 */
export const formatPercent = (percent) => {
    const value = parseFloat(percent);
    const sign = value >= 0 ? '+' : '';
    const emoji = value >= 0 ? '🟢' : '🔴';
    
    const formatted = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);

    return `${emoji} ${sign}${formatted}%`;
};

/**
 * Kürzt lange Usernamen oder Texte für Tabellen/Leaderboards
 */
export const truncateText = (text, maxLength = 15) => {
    if (!text) return 'Unbekannt';
    return text.length > maxLength ? text.substring(0, maxLength - 3) + '...' : text;
};

/**
 * Erstellt einen visuellen Fortschrittsbalken aus Emojis
 * Beispiel: (80, 100) -> ████████░░ (80%)
 */
export const formatProgressBar = (value, max = 100, length = 10) => {
    const percentage = Math.min(Math.max(value / max, 0), 1);
    const filledLength = Math.round(length * percentage);
    const emptyLength = length - filledLength;

    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const label = Math.round(percentage * 100) + '%';
    
    return `\`${bar}\` (${label})`;
};
