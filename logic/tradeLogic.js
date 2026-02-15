// logic/tradeLogic.js
import { CONFIG } from '../config.js';

/**
 * Berechnet die maximal verfügbaren Mengen für Kauf und Verkauf.
 * @param {number} balance - Aktueller Kontostand des Users in Euro
 * @param {number} coinPrice - Aktueller Preis des Coins in Euro
 * @param {number} userHoldings - Aktueller Bestand des Users an diesem Coin
 * @returns {object} - Enthält maxBuy, maxSell und die berechnete Steuer
 */
export function getTradeCalculations(balance, coinPrice, userHoldings = 0) {
    const tax = CONFIG.TRADE_TAX || 0.001; // Standard 0,1% falls nicht gesetzt
    
    // 1. Maximale Kaufmenge berechnen
    // Formel: (Guthaben / Preis) abzüglich der Steuer
    let maxBuy = 0;
    if (coinPrice > 0) {
        maxBuy = (balance / coinPrice) * (1 - tax);
    }

    // 2. Maximale Verkaufmenge ist einfach der aktuelle Bestand
    const maxSell = userHoldings;

    return {
        // Wir runden auf 6 Nachkommastellen für Präzision (wie bei echten Börsen)
        maxBuy: parseFloat(maxBuy.toFixed(6)),
        maxSell: parseFloat(maxSell.toFixed(6)),
        taxPercent: (tax * 100).toFixed(1),
        currentPrice: coinPrice
    };
}

/**
 * Berechnet die Kosten für eine spezifische Menge inklusive Steuer.
 * Hilfreich für die finale Validierung vor dem Datenbank-Update.
 */
export function calculateTotalCost(amount, coinPrice) {
    const tax = CONFIG.TRADE_TAX || 0.001;
    const basePrice = amount * coinPrice;
    const taxAmount = basePrice * tax;
    
    return {
        basePrice,
        taxAmount,
        total: basePrice + taxAmount
    };
}
