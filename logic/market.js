// logic/market.js
import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

let priceCache = {};
let lastFetch = 0;

/**
 * Kern-Logik: Holt Daten von CoinGecko und schreibt sie in den Cache.
 * Wird vom Scheduler jede Minute aufgerufen.
 */
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
        logger.debug("Markt-Cache erfolgreich aktualisiert.");
        return priceCache;
    } catch (err) {
        logger.error("API Fehler bei Marktdaten-Update:", err.message);
        // Gib den alten Cache zurück, um System-Hänger zu vermeiden
        return priceCache; 
    }
}

/**
 * Schnittstelle für den Rest des Bots: Liefert sofort die Daten aus dem Speicher.
 */
export async function getMarketData() {
    // Falls der Cache beim allerersten Start noch komplett leer ist, kurz warten/holen
    if (Object.keys(priceCache).length === 0) {
        await updateMarketPrices();
    }
    return priceCache;
}

/**
 * Bequemlichkeits-Funktion für einen einzelnen Coin
 */
export async function getCoinPrice(coinId) {
    const prices = await getMarketData();
    return prices[coinId.toLowerCase()] || null;
}

/**
 * INITIALER FETCH: Erzwingt Daten beim Laden des Moduls (Serverstart).
 * Dies verhindert die "Bitte warten"-Nachricht beim ersten User-Klick.
 */
updateMarketPrices().catch(err => logger.error("Erster Marktdaten-Fetch fehlgeschlagen:", err));
