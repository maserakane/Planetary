// fetchData.js
// Récupération des données depuis la blockchain WAX et les APIs externes
// ------------------------------------------------------------
// - Récupère les assets pour un ou plusieurs owners
// - Récupère les propriétaires de lands
// - Utilisé pour alimenter le pipeline de scoring et de synchronisation
// ------------------------------------------------------------

const axios = require('axios');

// ==================== Récupération des assets pour un batch d'IDs ====================
async function fetchDataForBatchIDs(batchIds) {
    //console.log(`[fetchDataForBatchIDs] Début avec ${batchIds.length} IDs: ${batchIds.slice(0, 5).join(', ')}${batchIds.length > 5 ? '...' : ''}`);
    
    const endpoints = [
        "https://atomic-wax.tacocrypto.io",
        "https://atomic.3dkrender.com",
        "https://atomic-api.wax.cryptolions.io",
        "http://wax-atomic-api.eosphere.io",
        "http://atomic.wax.eosrio.io",
        "http://atomic-wax.tacocrypto.io",
       " https://wax-aa.eu.eosamsterdam.net",
        "https://aa.dapplica.io",
        "https://atomic-wax.a-dex.xyz",
        "https://wax-atomic.alcor.exchange",
        "https://aa-wax-public1.neftyblocks.com",
        "https://wax.eosusa.io",
        "https://atomicassets.ledgerwise.io",
        "https://atomic-wax.qaraqol.com",
        "https://wax-atomic.eosiomadrid.io"
    ];
    
    const idParam = batchIds.join(',');
    
    for (const endpoint of endpoints) {
        try {
            //console.log(`[fetchDataForBatchIDs] Essai avec l'endpoint: ${endpoint}`);
            const response = await fetch(`${endpoint}/atomicassets/v1/assets?ids=${idParam}`);
            
            if (response.ok) {
                const jsonResponse = await response.json();
                //console.log(`[fetchDataForBatchIDs] Réponse reçue de ${endpoint}, status: ${response.status}`);
                
                if (Array.isArray(jsonResponse.data)) {
                    //console.log(`[fetchDataForBatchIDs] ${jsonResponse.data.length} assets trouvés`);
                    const transformedData = jsonResponse.data.map(asset => ({
                        landName: asset.asset_id,
                        owner: asset.owner
                    }));
                    //console.log(`[fetchDataForBatchIDs] Données transformées: ${transformedData.length} entrées`);
                    return transformedData;
                } else {
                    console.warn(`[fetchDataForBatchIDs] Réponse invalide de ${endpoint}: data n'est pas un tableau`);
                }
            } else {
                //console.warn(`[fetchDataForBatchIDs] Erreur HTTP ${response.status} de ${endpoint}`);
            }

            //console.log(`[fetchDataForBatchIDs] Réponse complète de ${endpoint}:`, jsonResponse);
        } catch (error) {
            console.error(`[fetchDataForBatchIDs] Erreur avec ${endpoint}:`, error.message);
        }
    }
    
    console.warn(`[fetchDataForBatchIDs] Aucun endpoint n'a fonctionné, retour d'un tableau vide`);
    return [];
}

// ==================== Récupération des propriétaires de lands ====================
async function fetchOwnersForIDs(ids) {
    //console.log(`[fetchOwnersForIDs] Début avec ${ids.length} IDs`);
    //console.log(`[fetchOwnersForIDs] Premiers IDs: ${ids.slice(0, 10).join(', ')}${ids.length > 10 ? '...' : ''}`);
    
    let resultPairs = [];
    const batchSize = 90;
    const numBatches = Math.ceil(ids.length / batchSize);
    //console.log(`[fetchOwnersForIDs] Traitement en ${numBatches} lots de ${batchSize} IDs`);
    
    for (let i = 0; i < ids.length; i += batchSize) {
        const batchNumber = Math.floor(i / batchSize) + 1;
        let batchIds = ids.slice(i, i + batchSize);
        //console.log(`[fetchOwnersForIDs] Traitement du lot ${batchNumber}/${numBatches} avec ${batchIds.length} IDs`);
        
        const pairs = await fetchDataForBatchIDs(batchIds);
        //console.log(`[fetchOwnersForIDs] Lot ${batchNumber} terminé: ${pairs.length} paires trouvées`);
        
        resultPairs = resultPairs.concat(pairs);
        //console.log(`[fetchOwnersForIDs] Total accumulé: ${resultPairs.length} paires`);
    }
    
    //console.log(`[fetchOwnersForIDs] Traitement terminé. Total final: ${resultPairs.length} paires`);
    return resultPairs;
}

//Ca aussi c'est un monstre a la limite on rajoute des endpoints et on regarde plus
// ==================== Récupération des assets pour une liste d'owners ====================
async function function_list_assets_batch(owners) {
    const startTime = Date.now();
    
    const endpoints = [
        "https://atomic-wax.tacocrypto.io",
        "https://atomic.3dkrender.com",
        "https://atomic-api.wax.cryptolions.io",
        "http://wax-atomic-api.eosphere.io",
        "http://atomic.wax.eosrio.io",
        "http://atomic-wax.tacocrypto.io",
       " https://wax-aa.eu.eosamsterdam.net",
        "https://aa.dapplica.io",
        "https://atomic-wax.a-dex.xyz",
        "https://wax-atomic.alcor.exchange",
        "https://aa-wax-public1.neftyblocks.com",
        "https://wax.eosusa.io",
        "https://atomicassets.ledgerwise.io",
        "https://atomic-wax.qaraqol.com",
        "https://wax-atomic.eosiomadrid.io"
    ];
    
    // Mélanger les endpoints pour équilibrer la charge
    const shuffledEndpoints = [...endpoints].sort(() => Math.random() - 0.5);
    
    let results = [];
    let successCount = 0;
    let failureCount = 0;
    let endpointIndex = 0; // Index pour faire tourner les endpoints
    
    for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];

        let success = false;
        let attempts = 0;
        const maxAttempts = shuffledEndpoints.length;
        
        while (attempts < maxAttempts && !success) {
            const endpoint = shuffledEndpoints[endpointIndex];
            const url = `${endpoint}/atomicassets/v1/accounts/${owner}/alien.worlds`;
            try {
                const response = await axios.get(url);
                results.push(response.data);
                success = true;
                successCount++;
                
                // Faire tourner l'index pour le prochain owner
                endpointIndex = (endpointIndex + 1) % shuffledEndpoints.length;
                break;
            } catch (error) {
                if (error.response && error.response.status === 502) {
                    console.warn(`⚠️  [function_list_assets_batch] Endpoint ${endpoint} temporairement indisponible (502) pour ${owner}`);
                } else {
                    console.warn(`⚠️  [function_list_assets_batch] Erreur avec ${endpoint} pour ${owner}: ${error.message}`);
                }
                
                // Passer au prochain endpoint
                endpointIndex = (endpointIndex + 1) % shuffledEndpoints.length;
                attempts++;
                
                if (attempts === maxAttempts) {
                    console.error(`❌ [function_list_assets_batch] Tous les endpoints ont échoué pour owner ${owner}.`);
                }
            }
        }
        
        if (!success) {
            console.warn(`⚠️  [function_list_assets_batch] Échec pour ${owner}, ajout de null`);
            results.push(null);
            failureCount++;
        }
    }
    
    const duration = (Date.now() - startTime) / 1000;
    //console.log(`📊 [function_list_assets_batch] Traitement terminé en ${duration.toFixed(2)}s`);
    
    return results;
}

// ==================== Récupération des adresses des joueurs (membres) ====================
async function adress() {
    //console.log(`[adress] Début de la récupération des adresses des membres`);
    
    try {
        //console.log(`[adress] Envoi de la requête à la blockchain`);
        const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'magordefense',
                table: 'members',
                scope: 'magordefense',
                json: true,
                limit: 1000,
            }),
        });
        
        //console.log(`[adress] Réponse reçue, status: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        //console.log(`[adress] Données reçues: ${data.rows ? data.rows.length : 0} membres`);
        
        if (!data.rows || !Array.isArray(data.rows)) {
            //console.warn(`[adress] Structure de données inattendue:`, data);
            return [];
        }
        
        const playerNames = data.rows.map(row => row.player_name);
        //console.log(`[adress] Noms des joueurs extraits: ${playerNames.length} membres`);
        //console.log(`[adress] Premiers membres: ${playerNames.slice(0, 10).join(', ')}${playerNames.length > 10 ? '...' : ''}`);
        
        return playerNames;
    } catch (error) {
        //console.error('[adress] Erreur lors de la récupération des adresses :', error.message);
        //console.error('[adress] Stack trace:', error.stack);
        return [];
    }
}

module.exports = {
    fetchDataForBatchIDs,
    fetchOwnersForIDs,
    function_list_assets_batch,
    adress
};
