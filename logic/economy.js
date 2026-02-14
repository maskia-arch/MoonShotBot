// logic/economy.js
import { supabase } from '../supabase/client.js';
import { CONFIG } from '../config.js';
import { logger } from '../utils/logger.js';
import { logTransaction } from '../supabase/queries.js';

/**
 * Der Wirtschafts-Tick: Wird jede Stunde ausgeführt.
 * Berechnet Mieten und zufällige Wartungskosten.
 */
export async function runEconomyTick() {
    logger.info("Starte Wirtschafts-Tick...");

    try {
        // 1. Alle Immobilienbesitzer laden, deren letzte Miete > 24h her ist
        const { data: assets, error } = await supabase
            .from('user_assets')
            .select('*, profiles(username, balance)');

        if (error) throw error;

        for (const asset of assets) {
            await processAssetEconomy(asset);
        }

        logger.info(`Tick beendet. ${assets.length} Assets verarbeitet.`);
    } catch (err) {
        logger.error("Fehler im Economy-Tick:", err);
    }
}

/**
 * Verarbeitet die Finanzen für ein einzelnes Asset
 */
async function processAssetEconomy(asset) {
    const now = new Date();
    const lastCollection = new Date(asset.last_rent_collection);
    const hoursSinceLast = (now - lastCollection) / (1000 * 60 * 60);

    // Miete alle 24 Stunden
    if (hoursSinceLast >= CONFIG.RENT_CYCLE_HOURS) {
        const rentAmount = calculateRent(asset);
        
        // Miete gutschreiben
        await supabase.rpc('increment_balance', { 
            user_id: asset.user_id, 
            amount: rentAmount 
        });

        // Zeitstempel aktualisieren
        await supabase
            .from('user_assets')
            .update({ last_rent_collection: now.toISOString() })
            .eq('id', asset.id);

        await logTransaction(asset.user_id, 'rent', rentAmount, `Mieteinnahme: ${asset.asset_type}`);
    }

    // Zufällige Wartungskosten (Verschleiß)
    if (Math.random() < CONFIG.MAINTENANCE_CHANCE) {
        await applyMaintenanceEvent(asset);
    }
}

/**
 * Berechnet die Miete basierend auf dem Zustand der Immobilie
 */
function calculateRent(asset) {
    // Basis-Mieten (würden normalerweise in config.js oder DB stehen)
    const baseRents = {
        garage: 110,
        apartment: 550,
        house: 2100
    };

    const base = baseRents[asset.asset_type] || 0;
    // Malus: Wenn Zustand < 80%, sinkt die Miete proportional
    const conditionFactor = asset.condition < 80 ? (asset.condition / 100) : 1;
    
    return base * conditionFactor;
}

/**
 * Erzeugt ein negatives Zufallsevent (Reparatur)
 */
async function applyMaintenanceEvent(asset) {
    const damage = Math.floor(Math.random() * 10) + 1; // 1-10% Verschleiß
    const newCondition = Math.max(0, asset.condition - damage);
    
    await supabase
        .from('user_assets')
        .update({ condition: newCondition })
        .eq('id', asset.id);

    logger.info(`Event: ${asset.asset_type} von User ${asset.user_id} beschädigt (-${damage}%)`);
}
