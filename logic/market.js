// logic/market.js
import fetch from 'node-fetch';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

// --- NEU: FALLBACK-DATEN (Verhindert Start-Hänger bei API-Sperre) ---
const FALLBACK_PRICES = {
    bitcoin: { price: 62450.00, change24h: 1.2 },
    litecoin: { price: 92.45, change24h: -0.5 }
};

// Initialisiere den Cache direkt mit Fallbacks, damit der Bot nie leer startet
let priceCache = { ...FALLBACK_PRICES }; 
let lastFetch = 0;

/**
 * Kern-Logik: Holt Daten von CoinGecko und schreibt sie in den Cache.
 */
export async function updateMarketPrices() {
    const now = Date.now();
    try {
        const ids = CONFIG.SUPPORTED_COINS.join(',');
        const url = `${CONFIG.COINGECKO_BASE_URL}/simple/price?ids=${ids}&vs_currencies=eur&include_24hr_change=true`;

        const response = await fetch(url);

        // Spezielle Behandlung für Rate-Limits (Error 429) aus deinen Logs
        if (response.status === 429) {
            logger.warn("⚠️ CoinGecko Rate Limit (429). Nutze vorhandenen Cache/Fallbacks.");
            return priceCache;
        }

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
        // Bei jedem Fehler (Timeout, API-Down, DNS) nutzen wir den Cache weiter
        logger.error(`API Fehler: ${err.message}. System läuft mit Cache weiter.`);
        return priceCache; 
    }
}

/**
 * Schnittstelle: Liefert sofort Daten aus dem Speicher (Keine Wartezeit!)
 */
export async function getMarketData() {
    // Falls die API noch nie erreicht wurde, haben wir dank Initialisierung die Fallbacks
    return priceCache;
}

/**
 * Bequemlichkeits-Funktion für einen einzelnen Coin
 */
export async function getCoinPrice(coinId) {
    const prices = await getMarketData();
    const id = coinId.toLowerCase();
    // Falls Coin nicht im Cache, nutze Fallback-Preis
    return prices[id] || FALLBACK_PRICES[id] || null;
}

/**
 * INITIALER FETCH: Erzwingt Daten beim Laden des Moduls (Serverstart).
 */
updateMarketPrices().catch(err => logger.error("Erster Marktdaten-Fetch fehlgeschlagen:", err));
