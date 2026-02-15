// logic/market.js
import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

// Lokaler Cache
let priceCache = {};
let lastFetch = 0;

/**
 * Holt aktuelle Kurse von CoinGecko
 */
export async function updateMarketPrices() {
    const now = Date.now();
    
    // Nutze Cache, wenn das letzte Update kürzer als der TICK_SPEED her ist
    if (now - lastFetch < CONFIG.TICK_SPEED_MS && Object.keys(priceCache).length > 0) {
        return priceCache;
    }

    try {
        const ids = CONFIG.SUPPORTED_COINS.join(',');
        const url = `${CONFIG.COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Status: ${response.status}`);
        
        const data = await response.json();
        
        const formattedData = {};
        for (const [id, values] of Object.entries(data)) {
            formattedData[id] = {
                price: values.eur,
                change24h: values.eur_24h_change
            };
        }

        priceCache = formattedData;
        lastFetch = now;
        
        logger.debug("Marktpreise aktualisiert", priceCache);
        return priceCache;
    } catch (err) {
        logger.error("Fehler beim Abrufen der Marktdaten:", err);
        return priceCache; 
    }
}

/**
 * NEU: Exportiert den aktuellen Markt-Cache für das Trading Center
 */
export async function getMarketData() {
    // Falls noch nie Daten geholt wurden, erzwinge ein Update
    if (Object.keys(priceCache).length === 0) {
        await updateMarketPrices();
    }
    return priceCache;
}

/**
 * Hilfsfunktion um den Preis eines einzelnen Coins zu bekommen
 */
export async function getCoinPrice(coinId) {
    const prices = await getMarketData();
    return prices[coinId.toLowerCase()] || null;
}

/**
 * Simuliert Kursschwankungen
 */
export function calculateEventPrice(basePrice, multiplier) {
    return basePrice * multiplier;
}
