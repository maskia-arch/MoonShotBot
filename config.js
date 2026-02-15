// config.js
import { getVersion } from './utils/versionLoader.js';

export const CONFIG = {
    // --- BOT INFO ---
    // Wir rufen die Version einmal hier zentral ab
    VERSION: getVersion(),
    TELEGRAM_TOKEN: process.env.BOT_TOKEN, 
    
    // --- SUPABASE CONFIG ---
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,

    // --- RENDER SPEZIFISCH ---
    PORT: process.env.PORT || 3000,

    // --- MARKT & PREISE ---
    INITIAL_CASH: 10000,
    TRADE_TAX: 0.001,
    MIN_VOL_FOR_REALESTATE: 30000,
    
    // --- ZEITSTEUERUNG ---
    SEASON_DURATION_DAYS: 30,
    TICK_SPEED_MS: 3600000, // 1 Stunde
    
    // --- IMMOBILIEN PARAMETER ---
    MAINTENANCE_CHANCE: 0.05,
    RENT_CYCLE_HOURS: 24,
    
    // --- KRYPTO EINSTELLUNGEN ---
    COINGECKO_BASE_URL: 'https://api.coingecko.com/api/v3',
    // Hier auf Bitcoin und Litecoin begrenzt:
    SUPPORTED_COINS: ['bitcoin', 'litecoin'], 
    
    // --- DESIGN & EMOJIS ---
    EMOJIS: {
        CASH: '💶',
        CRYPTO: '📈',
        IMMO: '🏠',
        MAINTENANCE: '🛠️',
        ERROR: '🚨',
        SUCCESS: '✅'
    }
};

if (!CONFIG.TELEGRAM_TOKEN) {
    console.error("❌ FEHLER: BOT_TOKEN ist nicht gesetzt!");
}
