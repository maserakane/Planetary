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
    // Liste des endpoints à essayer
    const endpoints = [
        "https://wax.blokcrafters.io",
        "https://wax.api.atomicassets.io",
        "https://api.atomicassets.io"  // Fallback
    ];
    const idParam = batchIds.join(',');
    for (const endpoint of endpoints) {
        try {
            //console.log(`[fetchDataForBatchIDs] Tentative avec l'endpoint: ${endpoint}`);
            const response = await fetch(`${endpoint}/atomicassets/v1/assets?ids=${idParam}`);
            if (response.ok) {
                const jsonResponse = await response.json();
                if (Array.isArray(jsonResponse.data)) {
                    // Transformation des données récupérées
                    return jsonResponse.data.map(asset => ({
                        landName: asset.asset_id,
                        owner: asset.owner
                    }));
                } else {
                    //console.error(`[fetchDataForBatchIDs] Endpoint ${endpoint} a renvoyé des données inattendues:`, jsonResponse.data);
                }
            } else {
                console.log(`[fetchDataForBatchIDs] Réponse invalide de ${endpoint}, status: ${response.status}`);
            }
        } catch (error) {
            //console.error(`[fetchDataForBatchIDs] Erreur avec ${endpoint} pour les IDs [${idParam}]: ${error.message}`);
        }
    }
    // Si aucun endpoint n'a abouti, on retourne un tableau vide
    return [];
}

// ==================== Récupération des propriétaires de lands ====================
async function fetchOwnersForIDs(ids) {
    let resultPairs = [];
    const batchSize = 90;
    for (let i = 0; i < ids.length; i += batchSize) {
        let batchIds = ids.slice(i, i + batchSize);
        const pairs = await fetchDataForBatchIDs(batchIds);
        resultPairs = resultPairs.concat(pairs);
    }
    return resultPairs;
}

// ==================== Récupération des assets pour une liste d'owners ====================
async function function_list_assets_batch(owners) {
    const endpoints = [
        "https://atomic-api.wax.cryptolions.io",
        "https://wax.api.atomicassets.io",
        "http://wax-atomic-api.eosphere.io",
        "http://atomic.wax.eosrio.io",
        "http://atomic-wax.tacocrypto.io"
    ];
    let results = [];
    for (let i = 0; i < owners.length; i++) {
        const owner = owners[i];
        let success = false;
        for (let j = 0; j < endpoints.length; j++) {
            const endpoint = endpoints[j];
            const url = `${endpoint}/atomicassets/v1/accounts/${owner}/alien.worlds`;
            try {
                const response = await axios.get(url);
                results.push(response.data);
                success = true;
                break;
            } catch (error) {
                if (error.response && error.response.status === 502) {
                    // Endpoint temporairement indisponible, on essaie le suivant
                } else {
                    // Autre erreur
                }
                if (j === endpoints.length - 1) {
                    console.error(`[function_list_assets_batch] Tous les endpoints ont échoué pour owner ${owner}.`);
                }
            }
        }
        if (!success) {
            results.push(null); // Indique l'échec pour ce propriétaire
        }
    }
    return results;
}

// ==================== Récupération des adresses des joueurs (membres) ====================
async function adress() {
    try {
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
        const data = await response.json();
        return data.rows.map(row => row.player_name);
    } catch (error) {
        console.error('[adress] Erreur lors de la récupération des adresses :', error);
    }
}

module.exports = {
    fetchDataForBatchIDs,
    fetchOwnersForIDs,
    function_list_assets_batch,
    adress
};
