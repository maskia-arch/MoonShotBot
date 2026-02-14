// logic/market.js
import fetch from 'node-fetch'; // Stelle sicher, dass node-fetch installiert ist
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

// Lokaler Cache, um API-Aufrufe zu minimieren
let priceCache = {};
let lastFetch = 0;

/**
 * Holt aktuelle Kurse von CoinGecko
 */
export async function updateMarketPrices() {
    const now = Date.now();
    
    // Cache für 60 Sekunden nutzen, um API-Limits zu schonen
    if (now - lastFetch < 60000 && Object.keys(priceCache).length > 0) {
        return priceCache;
    }

    try {
        const ids = CONFIG.SUPPORTED_COINS.join(',');
        const url = `${CONFIG.COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;

        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Status: ${response.status}`);
        
        const data = await response.json();
        
        // Daten in flaches Format umwandeln für einfachere Handhabung
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
        return priceCache; // Gib alten Cache zurück, falls API down ist
    }
}

/**
 * Hilfsfunktion um den Preis eines einzelnen Coins zu bekommen
 */
export async function getCoinPrice(coinId) {
    const prices = await updateMarketPrices();
    return prices[coinId.toLowerCase()] || null;
}

/**
 * Simuliert Kursschwankungen für fiktive Events (optional)
 * @param {number} basePrice - Der aktuelle echte Preis
 * @param {number} multiplier - Der Effekt aus logic/events.js
 */
export function calculateEventPrice(basePrice, multiplier) {
    return basePrice * multiplier;
}
