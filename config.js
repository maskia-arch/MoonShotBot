// config.js
import { getVersion } from './utils/versionLoader.js';

export const CONFIG = {
    VERSION: getVersion(),
    TELEGRAM_TOKEN: process.env.BOT_TOKEN, 
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    PORT: process.env.PORT || 3000,
    INITIAL_CASH: 10000,
    TRADE_TAX: 0.001,
    MIN_VOL_FOR_REALESTATE: 30000,
    SEASON_DURATION_DAYS: 30,
    TICK_SPEED_MS: 60000, // NEU: Alle 60 Sekunden aktualisieren
    MAINTENANCE_CHANCE: 0.05,
    RENT_CYCLE_HOURS: 24,
    COINGECKO_BASE_URL: 'https://api.coingecko.com/api/v3',
    SUPPORTED_COINS: ['bitcoin', 'litecoin'], 
    EMOJIS: {
        CASH: '💶', CRYPTO: '📈', IMMO: '🏠',
        MAINTENANCE: '🛠️', ERROR: '🚨', SUCCESS: '✅'
    }
};

if (!CONFIG.TELEGRAM_TOKEN) console.error("❌ FEHLER: BOT_TOKEN fehlt!");
