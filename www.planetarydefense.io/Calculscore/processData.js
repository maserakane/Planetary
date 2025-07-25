// processData.js
// Traitement et enrichissement des assets pour scoring (joueurs et propriétaires)
// ------------------------------------------------------------
// - Regroupe les assets par owner
// - Enrichit les assets avec les détails (templateDetails.json)
// - Prépare les données pour le calcul de score
// ------------------------------------------------------------

const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');

const templateDetailsPath = path.join(__dirname, 'templateDetails.json');

// Regroupe les lands par propriétaire
async function processLands(pairs) {
    const ownersLandCount = {};
    pairs.forEach(pair => {
        if (!pair.landName) {
            console.error(`[processLands] landName is undefined for pair: ${JSON.stringify(pair)}`);
            return;
        }
        if (!ownersLandCount[pair.owner]) {
            ownersLandCount[pair.owner] = { lands: [pair.landName], count: 1 };
        } else {
            ownersLandCount[pair.owner].lands.push(pair.landName);
            ownersLandCount[pair.owner].count++;
        }
    });
    return ownersLandCount;
}

// Récupère et enrichit les assets de chaque owner avec les détails de template
async function fetchAndProcessOwnersData(pairs) {
    const { function_list_assets_batch } = require('./fetchData');
    try {
        const uniqueOwners = Array.from(new Set(pairs.map(pair => pair.owner)));
        const ownersAssets = await function_list_assets_batch(uniqueOwners);
        if (!ownersAssets) {
            console.error("[fetchAndProcessOwnersData] No assets data retrieved.");
            return [];
        }
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        let results = [];
        for (let i = 0; i < ownersAssets.length; i++) {
            const ownerAsset = ownersAssets[i];
            const owner = uniqueOwners[i];
            try {
                if (!ownerAsset.data || !ownerAsset.data.templates) {
                    console.error(`[fetchAndProcessOwnersData] No templates found for owner: ${owner}`);
                    continue;
                }
                const enrichedTemplates = ownerAsset.data.templates.map(template => {
                    const detail = templateDetails.find(detail => detail.template_id === template.template_id);
                    return {
                        template_id: template.template_id,
                        assets: template.assets,
                        details: detail || {},
                    };
                });
                // Répartition par type d'asset
                let armsWorlds = [], crewWorlds = [], facesWorlds = [], landWorlds = [];
                enrichedTemplates.forEach(template => {
                    switch (template.details.schema) {
                        case 'arms.worlds':
                            armsWorlds.push(template);
                            break;
                        case 'crew.worlds':
                            crewWorlds.push(template);
                            break;
                        case 'faces.worlds':
                            facesWorlds.push(template);
                            break;
                        case 'land.worlds':
                            if (
                                template.details.attributes.planet === '10491499835444449792' ||
                                template.details.attributes.planet === '9346907992691696272'  ||
                                template.details.attributes.planet === '6310955965768028672') {
                                landWorlds.push(template);
                            }
                            break;
                    }
                });
                // ================= Récupération des mercenaires planetdefnft =================
                let extraMercenaries = [];
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
                let found = false;
                for (const endpoint of endpoints) {
                    const url = `${endpoint}/atomicassets/v1/assets?owner=${owner}&collection_name=planetdefnft&schema_name=mercenary&limit=100`;
                    try {
                        //console.log(`[fetchAndProcessOwnersData] Requête API pour mercenaires planetdefnft de ${owner} : ${url}`);
                        const response = await axios.get(url);
                        if (response.data && response.data.data) {
                            extraMercenaries = response.data.data.map(asset => ({
                                asset_id: asset.asset_id,
                                attack: asset.data.attack || 0,
                                defense: asset.data.defense || 0,
                                movecost: asset.data.movecost || 0
                            }));
                            if (extraMercenaries.length > 0) {
                                //console.log(`[fetchAndProcessOwnersData] ${owner} possède ${extraMercenaries.length} mercenaires planetdefnft :`);
                                extraMercenaries.forEach(m => {
                                    //console.log(`  - asset_id: ${m.asset_id}, attack: ${m.attack}, defense: ${m.defense}, movecost: ${m.movecost}`);
                                });
                            } else {
                                //console.log(`[fetchAndProcessOwnersData] ${owner} ne possède aucun mercenaire planetdefnft.`);
                            }
                            found = true;
                            break;
                        } else {
                            console.log(`[fetchAndProcessOwnersData] Réponse API inattendue pour ${owner} (pas de data) via ${endpoint}.`);
                        }
                    } catch (err) {
                        console.error(`[fetchAndProcessOwnersData] Erreur récupération mercenaires planetdefnft pour ${owner} via ${endpoint}:`, err.message);
                    }
                }
                if (!found) {
                    console.log(`[fetchAndProcessOwnersData] Aucun endpoint n'a permis de récupérer les mercenaires planetdefnft pour ${owner}.`);
                }
                // =====================================================
                results.push({
                    owner,
                    armsWorlds,
                    crewWorlds,
                    facesWorlds,
                    landWorlds,
                    extraMercenaries
                });
            } catch (error) {
                console.error(`[fetchAndProcessOwnersData] Error processing assets for owner ${owner}:`, error);
            }
        }
        return results;
    } catch (error) {
        console.error("[fetchAndProcessOwnersData] An error occurred while fetching assets:", error);
        return [];
    }
}

// Récupère et enrichit les assets d'un joueur unique
async function fetchAndProcessPlayerData(address) {
    const { function_list_assets_batch } = require('./fetchData');
    try {
        const playerassets = await function_list_assets_batch([address]);
        if (!playerassets || playerassets.length === 0) {
            console.error(`[fetchAndProcessPlayerData] No assets data retrieved for ${address}.`);
            return [];
        }
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        let results = [];
        const playerasset = playerassets[0];
        try {
            if (!playerasset.data || !playerasset.data.templates) {
                console.error(`[fetchAndProcessPlayerData] No templates found for player: ${address}`);
                return [];
            }
            const enrichedTemplates = playerasset.data.templates.map(template => {
                const detail = templateDetails.find(detail => detail.template_id === template.template_id);
                return {
                    template_id: template.template_id,
                    assets: template.assets,
                    details: detail || {},
                };
            });
            let armsWorlds = [], crewWorlds = [], facesWorlds = [];
            enrichedTemplates.forEach(template => {
                if (template.details.schema === 'arms.worlds') {
                    armsWorlds.push(template);
                } else if (template.details.schema === 'crew.worlds') {
                    crewWorlds.push(template);
                } else if (template.details.schema === 'faces.worlds') {
                    facesWorlds.push(template);
                }
            });
            // ================= Récupération des mercenaires planetdefnft pour le joueur =================
            let extraMercenaries = [];
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
            let found = false;
            for (const endpoint of endpoints) {
                const url = `${endpoint}/atomicassets/v1/assets?owner=${address}&collection_name=planetdefnft&schema_name=mercenary&limit=100`;
                try {
                    //console.log(`[fetchAndProcessPlayerData] Requête API pour mercenaires planetdefnft du joueur ${address} : ${url}`);
                    const response = await axios.get(url);
                    if (response.data && response.data.data) {
                        extraMercenaries = response.data.data.map(asset => ({
                            asset_id: asset.asset_id,
                            attack: asset.data.attack || 0,
                            defense: asset.data.defense || 0,
                            movecost: asset.data.movecost || 0
                        }));
                        if (extraMercenaries.length > 0) {
                            //console.log(`[fetchAndProcessPlayerData] ${address} possède ${extraMercenaries.length} mercenaires planetdefnft :`);
                            extraMercenaries.forEach(m => {
                                //console.log(`  - asset_id: ${m.asset_id}, attack: ${m.attack}, defense: ${m.defense}, movecost: ${m.movecost}`);
                            });
                        } else {
                            //console.log(`[fetchAndProcessPlayerData] ${address} ne possède aucun mercenaire planetdefnft.`);
                        }
                        found = true;
                        break;
                    } else {
                        console.log(`[fetchAndProcessPlayerData] Réponse API inattendue pour ${address} (pas de data) via ${endpoint}.`);
                    }
                } catch (err) {
                    console.error(`[fetchAndProcessPlayerData] Erreur récupération mercenaires planetdefnft pour ${address} via ${endpoint}:`, err.message);
                }
            }
            if (!found) {
                console.log(`[fetchAndProcessPlayerData] Aucun endpoint n'a permis de récupérer les mercenaires planetdefnft pour ${address}.`);
            }
            // =====================================================
            results.push({
                owner: address,
                armsWorlds,
                crewWorlds,
                facesWorlds,
                extraMercenaries
            });
        } catch (error) {
            console.error(`[fetchAndProcessPlayerData] Error processing assets for player ${address}:`, error);
        }
        return results;
    } catch (error) {
        console.error(`[fetchAndProcessPlayerData] An error occurred while fetching assets for ${address}:`, error);
        return [];
    }
}

// Traite tous les joueurs d'une liste d'adresses
async function processAllAddresses(adressplayer) {
    const results = [];
    for (const address of adressplayer) {
        const result = await fetchAndProcessPlayerData(address);
        if (result.length > 0) {
            results.push(result[0]);
        }
    }
    return results;
}

module.exports = {
    processLands,
    fetchAndProcessOwnersData,
    fetchAndProcessPlayerData,
    processAllAddresses
};
