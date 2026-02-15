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
    // 1. Maximale Kaufmenge berechnen inkl. 0,5% Gebühr
    let maxBuy = 0;
    if (coinPrice > 0) {
        // Formel: (Guthaben / Preis) reduziert um die Gebühr
        maxBuy = (balance / coinPrice) / (1 + TRADING_FEE);
    }

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
    const subtotal = amount * price;
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
    
    return timeHeld >= oneHourInMs;
}

/**
 * Berechnet den gewichteten Fortschritt für das Immobilien-Ziel.
 * Beispiel: 1.000€ investiert für 24h zählen voll.
 * @param {number} amountInEuro - Wert des Trades
 * @param {string} boughtAt - Zeitstempel des Kaufs
 */
export function calculateEligibleVolume(amountInEuro, boughtAt) {
    if (!isTradeEligibleForVolume(boughtAt)) return 0;

    const startTime = new Date(boughtAt).getTime();
    const hoursHeld = (Date.now() - startTime) / (1000 * 60 * 60);
    
    // Wenn 24h gehalten: 100% des Volumens zählen. 
    // Wenn weniger (aber > 1h): Anteilig berechnen.
    const weight = Math.min(hoursHeld / 24, 1);
    
    return amountInEuro * weight;
}
