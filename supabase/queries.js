// supabase/queries.js
import { supabase } from './client.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Synchronisiert den User beim Start.
 * Erstellt Profil und Season-Stats, falls sie noch nicht existieren.
 */
export async function syncUser(id, username) {
    try {
        const { data: profile, error: pError } = await supabase
            .from('profiles')
            .upsert({ id, username, balance: CONFIG.INITIAL_CASH }, { onConflict: 'id' })
            .select().single();

        if (pError) throw pError;
        
        // Initialisiere Season Stats (WICHTIG für das neue Ranking)
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
 * Verbucht einen Trade und aktualisiert die Season-Performance
 * @param {number} userId - ID des Users
 * @param {number} amount - Der investierte Betrag
 * @param {number} pnl - Profit oder Loss aus diesem Trade (bei Verkauf)
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
 * Dynamische Leaderboard-Abfrage je nach Filter
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
