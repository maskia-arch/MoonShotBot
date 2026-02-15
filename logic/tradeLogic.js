// logic/tradeLogic.js
import { CONFIG } from '../config.js';

/**
 * ZENTRALE HANDELSLOGIK
 * Berechnet Gebühren, Limits und die Berechtigung für das Immobilien-Volumen.
 */

// Konstante für die neue Gebühr von 0,5%
const TRADING_FEE = 0.005; 

/**
 * Berechnet die maximal verfügbaren Mengen für Kauf und Verkauf.
 */
export function getTradeCalculations(balance, coinPrice, userHoldings = 0) {
    // Sicherheitscheck: Falls kein Preis vorhanden ist, Mengen auf 0 setzen
    if (!coinPrice || coinPrice <= 0) {
        return { maxBuy: 0, maxSell: 0, feePercent: "0.5", currentPrice: 0 };
    }

    // 1. Maximale Kaufmenge berechnen inkl. 0,5% Gebühr
    // Formel: (Guthaben / Preis) reduziert um die Gebühr
    const maxBuy = (balance / coinPrice) / (1 + TRADING_FEE);
    const maxSell = userHoldings;

    return {
        maxBuy: parseFloat(maxBuy.toFixed(6)),
        maxSell: parseFloat(maxSell.toFixed(6)),
        feePercent: (TRADING_FEE * 100).toFixed(1), // Zeigt 0.5% an
        currentPrice: coinPrice
    };
}

/**
 * Berechnet die Kosten/Erlöse für einen Trade.
 * Die Gebühr wird in einen separaten Topf für Verlosungen gesammelt.
 */
export function calculateTrade(amount, price) {
    // Validierung der Eingabewerte
    const safeAmount = parseFloat(amount) || 0;
    const safePrice = parseFloat(price) || 0;

    const subtotal = safeAmount * safePrice;
    const fee = subtotal * TRADING_FEE;
    
    return {
        subtotal,
        fee,
        totalCost: subtotal + fee, // Beim Kauf: Preis + Gebühr
        payout: subtotal - fee     // Beim Verkauf: Preis - Gebühr
    };
}

/**
 * ANTI-WASH-TRADING: Prüft die Haltedauer.
 * Ein Trade zählt erst nach 1 Stunde Haltedauer für das 30k Ziel.
 * @param {string} boughtAt - ISO Zeitstempel des Kaufs
 * @returns {boolean} - True, wenn > 1 Stunde vergangen ist
 */
export function isTradeEligibleForVolume(boughtAt) {
    if (!boughtAt) return false;
    
    const oneHourInMs = 60 * 60 * 1000;
    const timeHeld = Date.now() - new Date(boughtAt).getTime();
    
    // Gibt true zurück, wenn mindestens 3.600.000 ms vergangen sind
    return timeHeld >= oneHourInMs;
}

/**
 * Berechnet den gewichteten Fortschritt für das Immobilien-Ziel.
 * Beispiel: 1.000€ investiert für 24h zählen voll.
 */
export function calculateEligibleVolume(amountInEuro, boughtAt) {
    // Wenn die 1-Stunden-Frist nicht erreicht ist, zählt 0€
    if (!isTradeEligibleForVolume(boughtAt)) return 0;

    const startTime = new Date(boughtAt).getTime();
    const hoursHeld = (Date.now() - startTime) / (1000 * 60 * 60);
    
    // Gewichtung: 24h = 100%, 12h = 50%, etc. (Minimum 1h Haltedauer erforderlich)
    const weight = Math.min(hoursHeld / 24, 1);
    
    return amountInEuro * weight;
}
