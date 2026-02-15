// logic/market.js
import fetch from 'node-fetch';
import { supabase } from '../supabase/client.js';
import { logger } from '../utils/logger.js';

// Realistischere Fallbacks für den absoluten Notfall
const FALLBACK_PRICES = {
    bitcoin: { price: 61500.00, change24h: 0.5 },
    litecoin: { price: 41.20, change24h: -0.2 }
};

/**
 * Holt aktuelle Kurse von CryptoCompare (stabilere Alternative zu CoinGecko)
 * und speichert sie zentral in der Supabase-Datenbank.
 */
export async function updateMarketPrices() {
    try {
        // CryptoCompare Preis-Abfrage für BTC und LTC in EUR
        const url = `https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,LTC&tsyms=EUR`;
        
        const response = await fetch(url);
        const data = await response.json();

        if (!data.RAW) {
            throw new Error("API-Limit erreicht oder ungültige Antwort");
        }

        // Wir runden die Preise direkt auf 2 Nachkommastellen für die DB
        const updates = [
            { 
                coin_id: 'bitcoin', 
                price_eur: parseFloat(data.RAW.BTC.EUR.PRICE.toFixed(2)), 
                change_24h: parseFloat(data.RAW.BTC.EUR.CHANGEPCT24HOUR.toFixed(2)),
                last_update: new Date()
            },
            { 
                coin_id: 'litecoin', 
                price_eur: parseFloat(data.RAW.LTC.EUR.PRICE.toFixed(2)), 
                change_24h: parseFloat(data.RAW.LTC.EUR.CHANGEPCT24HOUR.toFixed(2)),
                last_update: new Date()
            }
        ];

        // Die Preise in den Supabase market_cache schreiben
        const { error } = await supabase.from('market_cache').upsert(updates);
        if (error) throw error;

        logger.debug("✅ Markt-DB via CryptoCompare aktualisiert.");
    } catch (err) {
        logger.error(`❌ Markt-Update fehlgeschlagen: ${err.message}`);
    }
}

/**
 * Holt die Daten blitzschnell aus der Datenbank statt von der API.
 */
export async function getMarketData() {
    try {
        const { data, error } = await supabase.from('market_cache').select('*');
        
        if (error || !data || data.length === 0) {
            // Falls DB leer, versuchen wir ein Update zu erzwingen
            updateMarketPrices();
            return FALLBACK_PRICES;
        }

        const formatted = {};
        data.forEach(row => {
            formatted[row.coin_id] = { 
                price: parseFloat(row.price_eur), 
                change24h: parseFloat(row.change_24h) 
            };
        });
        return formatted;
    } catch (err) {
        return FALLBACK_PRICES;
    }
}

/**
 * Bequemlichkeits-Funktion für einen einzelnen Preis.
 * Stellt sicher, dass das Trading-System immer valide Daten hat.
 */
export async function getCoinPrice(coinId) {
    const market = await getMarketData();
    const id = coinId.toLowerCase();
    
    // Falls Coin nicht im Cache, versuchen wir ihn aus den Fallbacks zu retten
    const result = market[id] || FALLBACK_PRICES[id];
    
    if (!result) {
        logger.error(`🚨 Preis-Anfrage für unbekannten Coin: ${id}`);
        return null;
    }
    
    return result;
}

// Initialer Aufruf beim Serverstart
updateMarketPrices().catch(e => logger.error("Initialer Fetch fehlgeschlagen", e));
