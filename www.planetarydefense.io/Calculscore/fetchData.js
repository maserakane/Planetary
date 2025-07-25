// fetchData.js
// Récupération des données depuis la blockchain WAX et les APIs externes
// ------------------------------------------------------------
// - Récupère les assets pour un ou plusieurs owners
// - Récupère les propriétaires de lands
// - Utilisé pour alimenter le pipeline de scoring et de synchronisation
// ------------------------------------------------------------

const axios = require('axios');
const VERBOSE = process.env.VERBOSE === '1';
const MAX_PARALLEL = 10; // Nombre de requêtes simultanées
const TIMEOUT_MS = 8000;

// ==================== Récupération des assets pour un batch d'IDs (optimisé) ====================
async function fetchDataForBatchIDs(batchIds) {
    const endpoints = [
        "https://atomic.3dkrender.com",
        "https://aa.wax.blacklusion.io",
        "https://api.atomicassets.io",
        "https://atomic-wax.tacocrypto.io",
        "https://wax-aa.eu.eosamsterdam.net",
        "https://atomicassets.ledgerwise.io",
        "https://atomicassets-api.wax.cryptolions.io",
        "https://wax-atomic-api.eosphere.io"
    ];
    if (VERBOSE) console.log(`[FETCH] Début du batch : ${batchIds.length} landIds à traiter`);
    let foundCount = 0;
    const results = [];

    // Fonction utilitaire pour fetch avec timeout
    function fetchWithTimeout(url, options = {}) {
        return Promise.race([
            fetch(url, options),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), TIMEOUT_MS))
        ]);
    }

    // Parallélisation contrôlée
    async function processId(id) {
        let foundOwner = null;
        let foundVia = null;
        // 1. Essayer tous les endpoints en batch
        for (const endpoint of endpoints) {
            try {
                if (VERBOSE) console.log(`[TRY][BATCH] landId: ${id} | Endpoint: ${endpoint}`);
                const response = await fetchWithTimeout(`${endpoint}/atomicassets/v1/assets?ids=${id}&collection_name=alienworlds&schema_name=land`);
                if (response.ok) {
                    const jsonResponse = await response.json();
                    if (Array.isArray(jsonResponse.data) && jsonResponse.data.length > 0 && jsonResponse.data[0].owner) {
                        foundOwner = jsonResponse.data[0].owner;
                        foundVia = `[BATCH] ${endpoint}`;
                        if (VERBOSE) console.log(`[SUCCESS][BATCH] landId: ${id} | Owner: ${foundOwner} | Endpoint: ${endpoint}`);
                        break;
                    } else {
                        if (VERBOSE) console.log(`[FAIL][BATCH] landId: ${id} | Endpoint: ${endpoint} | Pas d'owner trouvé dans la réponse.`);
                    }
                } else {
                    if (VERBOSE) console.log(`[ERROR][BATCH] landId: ${id} | Endpoint: ${endpoint} | Status: ${response.status}`);
                }
            } catch (e) {
                if (VERBOSE) console.log(`[EXCEPTION][BATCH] landId: ${id} | Endpoint: ${endpoint} | Erreur: ${e.message}`);
            }
        }
        // 2. Si pas trouvé, essayer tous les endpoints en individuel
        if (!foundOwner) {
            for (const endpoint of endpoints) {
                try {
                    if (VERBOSE) console.log(`[TRY][INDIV] landId: ${id} | Endpoint: ${endpoint}`);
                    const singleResp = await fetchWithTimeout(`${endpoint}/atomicassets/v1/assets/${id}`);
                    if (singleResp.ok) {
                        const singleJson = await singleResp.json();
                        if (singleJson.data && singleJson.data.owner) {
                            foundOwner = singleJson.data.owner;
                            foundVia = `[INDIV] ${endpoint}`;
                            if (VERBOSE) console.log(`[SUCCESS][INDIV] landId: ${id} | Owner: ${foundOwner} | Endpoint: ${endpoint}`);
                            break;
                        } else {
                            if (VERBOSE) console.log(`[FAIL][INDIV] landId: ${id} | Endpoint: ${endpoint} | Pas d'owner trouvé dans la réponse.`);
                        }
                    } else {
                        if (VERBOSE) console.log(`[ERROR][INDIV] landId: ${id} | Endpoint: ${endpoint} | Status: ${singleResp.status}`);
                    }
                } catch (e) {
                    if (VERBOSE) console.log(`[EXCEPTION][INDIV] landId: ${id} | Endpoint: ${endpoint} | Erreur: ${e.message}`);
                }
            }
        }
        if (!foundOwner) {
            if (VERBOSE) console.log(`[API DEBUG] landId: ${id} | Aucun owner trouvé sur tous les endpoints.`);
        } else {
            foundCount++;
        }
        return { landName: id, owner: foundOwner, via: foundVia };
    }

    // Gestion du parallélisme contrôlé
    let i = 0;
    async function next() {
        if (i >= batchIds.length) return null;
        const id = batchIds[i++];
        return processId(id);
    }
    const workers = Array.from({length: Math.min(MAX_PARALLEL, batchIds.length)}, async function worker() {
        let result;
        while ((result = await next()) !== null) {
            results.push(result);
            if (VERBOSE && results.length % 10 === 0) {
                console.log(`[FETCH] Progression : ${results.length}/${batchIds.length} | Owners trouvés : ${foundCount}`);
            }
        }
    });
    await Promise.all(workers);
    if (VERBOSE) console.log(`[FETCH] Fin du batch. Owners trouvés : ${foundCount}/${batchIds.length}`);
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
