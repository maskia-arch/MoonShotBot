// supabase/queries.js
import { supabase } from './client.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Synchronisiert den User beim Start.
 */
export async function syncUser(id, username) {
    try {
        const { data: profile, error: pError } = await supabase
            .from('profiles')
            .upsert({ id, username }, { onConflict: 'id' }) // INITIAL_CASH nur beim ersten Mal setzen via DB-Default oder Logic
            .select().single();

        if (pError) throw pError;
        
        await supabase.from('season_stats').upsert({ user_id: id }, { onConflict: 'user_id' });
        
        return profile;
    } catch (err) {
        logger.error(`Fehler in syncUser für ${id}:`, err);
        return null;
    }
}

/**
 * Holt das komplette Profil inkl. Krypto, Assets und Season-Stats
 */
export async function getUserProfile(id) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*, user_crypto(*), user_assets(*), season_stats(*)')
            .eq('id', id).single();

        if (error) throw error;
        return data;
    } catch (err) {
        logger.error(`Fehler in getUserProfile für ${id}:`, err);
        return null;
    }
}

/**
 * ZENTRALE FUNKTION: Aktualisiert den Krypto-Bestand (Kauf/Verkauf)
 * @param {string} userId - ID des Users
 * @param {string} coinId - ID des Coins (z.B. bitcoin)
 * @param {number} amountChange - Positive Zahl für Kauf, negative für Verkauf
 * @param {number} currentPrice - Aktueller Kurs für den Durchschnittspreis
 */
export async function updateCryptoHolding(userId, coinId, amountChange, currentPrice) {
    try {
        // Vorhandenen Bestand prüfen
        const { data: current } = await supabase
            .from('user_crypto')
            .select('*')
            .eq('user_id', userId)
            .eq('coin_id', coinId)
            .single();

        if (current) {
            const newAmount = current.amount + amountChange;
            
            if (newAmount <= 0) {
                // Alles verkauft -> Eintrag löschen
                return await supabase.from('user_crypto').delete().eq('id', current.id);
            } else {
                // Bestand aktualisieren
                // Bei Kauf wird der Durchschnittspreis (avg_buy_price) gewichtet neu berechnet
                let newAvgPrice = current.avg_buy_price;
                if (amountChange > 0) {
                    newAvgPrice = ((current.amount * current.avg_buy_price) + (amountChange * currentPrice)) / newAmount;
                }

                return await supabase.from('user_crypto')
                    .update({ amount: newAmount, avg_buy_price: newAvgPrice })
                    .eq('id', current.id);
            }
        } else if (amountChange > 0) {
            // Neuer Coin-Eintrag (Erster Kauf)
            return await supabase.from('user_crypto').insert({
                user_id: userId,
                coin_id: coinId,
                amount: amountChange,
                avg_buy_price: currentPrice
            });
        }
    } catch (err) {
        logger.error("Fehler bei updateCryptoHolding:", err);
        throw err;
    }
}

/**
 * Verbucht einen Trade und aktualisiert die Season-Performance
 */
export async function updateTradeStats(userId, amount, pnl = 0) {
    try {
        // 1. Handelsvolumen im Profil erhöhen
        await supabase.rpc('add_trading_volume', { user_id: userId, amount: Math.abs(amount) });

        // 2. Season Stats aktualisieren (Profit oder Loss)
        if (pnl > 0) {
            await supabase.rpc('update_season_profit', { user_id: userId, pnl_amount: pnl });
        } else if (pnl < 0) {
            await supabase.rpc('update_season_loss', { user_id: userId, pnl_amount: Math.abs(pnl) });
        }
    } catch (err) {
        logger.error("Fehler beim Update der Trade-Stats:", err);
    }
}

/**
 * Dynamische Leaderboard-Abfrage
 */
export async function getFilteredLeaderboard(filterType) {
    try {
        let query;
        if (filterType === 'wealth') {
            query = supabase.from('profiles').select('username, balance').order('balance', { ascending: false });
        } else if (filterType === 'profit') {
            query = supabase.from('season_stats').select('profiles(username), season_profit').order('season_profit', { ascending: false });
        } else if (filterType === 'loser') {
            query = supabase.from('season_stats').select('profiles(username), season_loss').order('season_loss', { ascending: false });
        }

        const { data, error } = await query.limit(10);
        if (error) throw error;
        return data;
    } catch (err) {
        logger.error(`Leaderboard-Fehler (${filterType}):`, err);
        return [];
    }
}

/**
 * Loggt jede Transaktion für die Historie
 */
export async function logTransaction(userId, type, amount, description) {
    const { error } = await supabase.from('transactions').insert({
        user_id: userId, type, amount, description
    });
    if (error) logger.error("Transaktions-Log fehlgeschlagen", error);
}
