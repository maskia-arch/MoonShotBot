// logic/market.js
import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

let priceCache = {};
let lastFetch = 0;

export async function updateMarketPrices() {
    const now = Date.now();
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
        return priceCache;
    } catch (err) {
        logger.error("API Fehler:", err);
        return priceCache; 
    }
}

// Sofort-Export des Caches für blitzschnelle Anzeige
export async function getMarketData() {
    if (Object.keys(priceCache).length === 0) {
        await updateMarketPrices();
    }
    return priceCache;
}

export async function getCoinPrice(coinId) {
    const prices = await getMarketData();
    return prices[coinId.toLowerCase()] || null;
}

// INITIALER FETCH BEIM SERVERSTART (Erzwingt Daten vor dem ersten Klick)
updateMarketPrices(); 
