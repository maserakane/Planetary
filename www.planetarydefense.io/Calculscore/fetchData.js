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
    // Liste élargie d'endpoints à essayer
    const endpoints = [
        "https://wax.api.atomicassets.io",
        "https://wax.blokcrafters.io",
        "https://api.atomicassets.io",
        "https://atomic-wax.tacocrypto.io",
        "https://wax-aa.eu.eosamsterdam.net",
        "https://atomicassets.ledgerwise.io",
        "https://atomicassets-api.wax.cryptolions.io",
        "https://wax-atomic-api.eosphere.io"
    ];
    console.log(`[FETCH] Début du batch : ${batchIds.length} landIds à traiter`);
    const idParam = batchIds.join(',');
    // Pour chaque ID, on va essayer tous les endpoints jusqu'à obtenir une réponse satisfaisante
    const results = [];
    let foundCount = 0;
    for (let i = 0; i < batchIds.length; i++) {
        const id = batchIds[i];
        let foundOwner = null;
        let foundVia = null;
        // 1. Essayer tous les endpoints en batch
        for (const endpoint of endpoints) {
            try {
                console.log(`[TRY][BATCH] landId: ${id} | Endpoint: ${endpoint}`);
                const response = await fetch(`${endpoint}/atomicassets/v1/assets?ids=${id}&collection_name=alienworlds&schema_name=land`);
                if (response.ok) {
                    const jsonResponse = await response.json();
                    if (Array.isArray(jsonResponse.data) && jsonResponse.data.length > 0 && jsonResponse.data[0].owner) {
                        foundOwner = jsonResponse.data[0].owner;
                        foundVia = `[BATCH] ${endpoint}`;
                        console.log(`[SUCCESS][BATCH] landId: ${id} | Owner: ${foundOwner} | Endpoint: ${endpoint}`);
                        break;
                    } else {
                        console.log(`[FAIL][BATCH] landId: ${id} | Endpoint: ${endpoint} | Pas d'owner trouvé dans la réponse.`);
                    }
                } else {
                    console.log(`[ERROR][BATCH] landId: ${id} | Endpoint: ${endpoint} | Status: ${response.status}`);
                }
            } catch (e) {
                console.log(`[EXCEPTION][BATCH] landId: ${id} | Endpoint: ${endpoint} | Erreur: ${e.message}`);
            }
        }
        // 2. Si pas trouvé, essayer tous les endpoints en individuel
        if (!foundOwner) {
            for (const endpoint of endpoints) {
                try {
                    console.log(`[TRY][INDIV] landId: ${id} | Endpoint: ${endpoint}`);
                    const singleResp = await fetch(`${endpoint}/atomicassets/v1/assets/${id}`);
                    if (singleResp.ok) {
                        const singleJson = await singleResp.json();
                        if (singleJson.data && singleJson.data.owner) {
                            foundOwner = singleJson.data.owner;
                            foundVia = `[INDIV] ${endpoint}`;
                            console.log(`[SUCCESS][INDIV] landId: ${id} | Owner: ${foundOwner} | Endpoint: ${endpoint}`);
                            break;
                        } else {
                            console.log(`[FAIL][INDIV] landId: ${id} | Endpoint: ${endpoint} | Pas d'owner trouvé dans la réponse.`);
                        }
                    } else {
                        console.log(`[ERROR][INDIV] landId: ${id} | Endpoint: ${endpoint} | Status: ${singleResp.status}`);
                    }
                } catch (e) {
                    console.log(`[EXCEPTION][INDIV] landId: ${id} | Endpoint: ${endpoint} | Erreur: ${e.message}`);
                }
            }
        }
        // 3. Log si toujours pas trouvé
        if (!foundOwner) {
            console.log(`[API DEBUG] landId: ${id} | Aucun owner trouvé sur tous les endpoints.`);
        } else {
            foundCount++;
        }
        if ((i+1) % 10 === 0 || i === batchIds.length-1) {
            console.log(`[FETCH] Progression : ${i+1}/${batchIds.length} | Owners trouvés : ${foundCount}`);
        }
        results.push({ landName: id, owner: foundOwner, via: foundVia });
    }
    console.log(`[FETCH] Fin du batch. Owners trouvés : ${foundCount}/${batchIds.length}`);
    return results;
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
    //console.log(JSON.stringify(results, null, 2));
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
