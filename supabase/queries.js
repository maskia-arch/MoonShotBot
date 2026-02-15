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
            .upsert({ id, username }, { onConflict: 'id' }) 
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
 * Holt das komplette Profil inkl. Krypto, Assets und Season-Stats.
 * WICHTIG: Holt auch das trading_volume für die Immobilien-Sperre.
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
 * Holt nur die Krypto-Bestände für das Portfolio-Menü.
 */
export async function getUserCrypto(userId) {
    try {
        const { data, error } = await supabase
            .from('user_crypto')
            .select('*')
            .eq('user_id', userId);
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        logger.error("Fehler bei getUserCrypto:", err);
        return [];
    }
}

/**
 * Loggt jede Transaktion für die Historie.
 */
export async function logTransaction(userId, type, amount, description) {
    try {
        const { error } = await supabase.from('transactions').insert({
            user_id: userId, 
            type, 
            amount, 
            description,
            created_at: new Date()
        });
        if (error) throw error;
    } catch (err) {
        logger.error("Transaktions-Log fehlgeschlagen:", err.message);
    }
}

/**
 * FIX: Diese Funktion wurde vom Trade-Modul angefordert, fehlte aber.
 * Aktualisiert Statistiken oder das Handelsvolumen.
 */
export async function updateTradeStats(userId, volumeAmount, pnl = 0) {
    try {
        // Erhöht das Handelsvolumen im Profil
        const { error } = await supabase.rpc('add_trading_volume', { 
            p_user_id: userId, 
            p_volume: volumeAmount 
        });
        
        if (error) throw error;

        // Falls PnL (Profit/Loss) übergeben wurde, Season Stats updaten
        if (pnl !== 0) {
            const rpcFunc = pnl > 0 ? 'update_season_profit' : 'update_season_loss';
            await supabase.rpc(rpcFunc, { 
                p_user_id: userId, 
                pnl_amount: Math.abs(pnl) 
            });
        }
    } catch (err) {
        logger.error("Fehler beim Update der Trade-Stats:", err);
    }
}

/**
 * Holt die letzten 10 Transaktionen eines Users für den Button "Transaktionsverlauf".
 */
export async function getTransactionHistory(userId) {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        return data || [];
    } catch (err) {
        logger.error("Fehler beim Abrufen der Historie:", err);
        return [];
    }
}

/**
 * Dynamische Leaderboard-Abfrage.
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
 * Holt den aktuellen Stand des globalen Wirtschafts-Topfs.
 */
export async function getGlobalEconomy() {
    try {
        const { data, error } = await supabase
            .from('global_economy')
            .select('tax_pool')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        return data?.tax_pool || 0;
    } catch (err) {
        logger.error("Fehler beim Abrufen der Global Economy:", err);
        return 0;
    }
}
