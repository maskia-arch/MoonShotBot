// config.js
import { getVersion } from './utils/versionLoader.js';

export const CONFIG = {
    VERSION: getVersion(),
    TELEGRAM_TOKEN: process.env.BOT_TOKEN, 
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    PORT: process.env.PORT || 3000,
    
    // Wirtschaft & Balance
    INITIAL_CASH: 10000,
    TRADING_FEE: 0.005, // Erhöht auf 0,5% für den globalen Topf
    MIN_VOL_FOR_REALESTATE: 30000, // Das Ziel für Onkel Willis Vertrauen
    
    // Zeitsteuerung
    SEASON_DURATION_DAYS: 30,
    TICK_SPEED_MS: 3600000, // Wirtschafts-Tick alle 60 Min (Stündlich)
    MARKET_UPDATE_MS: 60000, // Markt-Preise alle 60 Sekunden
    
    // Immobilien-Logik
    MAINTENANCE_CHANCE: 0.05,
    RENT_CYCLE_HOURS: 24,
    
    // API-Einstellungen
    CRYPTOCOMPARE_BASE_URL: 'https://min-api.cryptocompare.com/data', // Stabilere Quelle
    SUPPORTED_COINS: ['bitcoin', 'litecoin'], 
    
    // UI & Emojis
    EMOJIS: {
        CASH: '💶', 
        CRYPTO: '📈', 
        IMMO: '🏠',
        MAINTENANCE: '🛠️', 
        ERROR: '🚨', 
        SUCCESS: '✅',
        TREND_UP: '🟢',
        TREND_DOWN: '🔴'
    }
};

// Validierung beim Start
if (!CONFIG.TELEGRAM_TOKEN) console.error("❌ FEHLER: BOT_TOKEN fehlt in der Umgebung!");
if (!CONFIG.SUPABASE_URL) console.error("❌ FEHLER: SUPABASE_URL fehlt in der Umgebung!");
