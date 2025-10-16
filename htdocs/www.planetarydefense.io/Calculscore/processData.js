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

const templateDetailsPath = path.join(__dirname, 'enriched_assets.json');

// ==================== RÉCUPÉRATION ET CALCUL DES SLOTS WARLORD ====================
// Récupère les faces warlord et calcule le nombre de slots qu'elles apportent
async function getWarlordSlotsForOwner(owner) {
    const warlordFaces = [];
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
        "https://api.waxeastern.cn",
        "https://wax-atomic.eosiomadrid.io"
    ];
    
    let found = false;
    for (const endpoint of endpoints) {
        const url = `${endpoint}/atomicassets/v1/assets?owner=${owner}&schema_name=warlord&limit=100`;
        try {
            //console.log(`[getWarlordSlotsForOwner] Requête API pour faces warlord de ${owner} : ${url}`);
            const response = await axios.get(url);
            if (response.data && response.data.data) {
                //console.log(response.data.data);
                warlordFaces.push(...response.data.data.map(asset => ({
                    asset_id: asset.asset_id,
                    template_id: asset.template?.template_id || asset.template_id,
                    collection_name: asset.collection.collection_name,
                    schema: asset.schema.schema_name,
                    attributes: asset.data,
                    name: asset.data.name || "Warlord Face"
                })));
                if (warlordFaces.length > 0) {
                   //console.log(`[getWarlordSlotsForOwner] ${owner} possède ${warlordFaces.length} faces warlord :`);
                   // Log spécifique pour nleou.c.wam
                   if (owner === 'nleou.c.wam') {
                       console.log(`🎯 [WARLORD FILTER] ${owner} possède ${warlordFaces.length} faces warlord :`);
                       warlordFaces.forEach(face => {
                           console.log(`🎯 [WARLORD FILTER]   - ${face.name} (template: ${face.template_id}, asset: ${face.asset_id})`);
                       });
                   }
                } else {
                    //console.log(`[getWarlordSlotsForOwner] ${owner} ne possède aucune face warlord.`);
                    // Log spécifique pour nleou.c.wam
                    if (owner === 'nleou.c.wam') {
                        console.log(`🎯 [WARLORD FILTER] ${owner} ne possède aucune face warlord.`);
                    }
                }
                found = true;
                break;
            }
        } catch (err) {
            //console.error(`[getWarlordSlotsForOwner] Erreur récupération faces warlord pour ${owner} via ${endpoint}:`, err.message);
            // Log spécifique pour nleou.c.wam
            if (owner === 'nleou.c.wam') {
                console.log(`🎯 [WARLORD FILTER] Erreur récupération faces warlord pour ${owner} via ${endpoint}: ${err.message}`);
            }
        }
    }
    
    if (!found) {
        console.log(`[getWarlordSlotsForOwner] Aucun endpoint n'a permis de récupérer les faces warlord pour ${owner}.`);
        // Log spécifique pour nleou.c.wam
        if (owner === 'nleou.c.wam') {
            console.log(`🎯 [WARLORD FILTER] Aucun endpoint n'a permis de récupérer les faces warlord pour ${owner}.`);
        }
    }
    
    // Calculer le nombre total de slots
    let totalSlots = 0;
    warlordFaces.forEach(face => {
        // Utiliser directement l'attribut 'crew slot' des faces warlord
        const crewSlots = parseInt(face.attributes['crew slot']) || 0;
        totalSlots += crewSlots;
        
        //console.log(`[getWarlordSlotsForOwner] ${face.name}:`);
        //console.log(`   - Crew slots: ${crewSlots}`);
    });
    
    //console.log(`[getWarlordSlotsForOwner] ${owner} - Total slots warlord: ${totalSlots}`);
    // Log spécifique pour nleou.c.wam
    if (owner === 'nleou.c.wam') {
        console.log(`🎯 [WARLORD FILTER] ${owner} - Total slots warlord: ${totalSlots}`);
    }
    
    return {
        totalSlots,
        warlordFaces: warlordFaces.length,
        details: warlordFaces.map(face => ({
            template_id: face.template_id,
            name: face.name,
            crewSlots: parseInt(face.attributes['crew slot']) || 0
        }))
    };
}

// Regroupe les lands par propriétaire
async function processLands(pairs) {
    const ownersLandCount = {};
    pairs.forEach(pair => {
        if (!pair.landName) {
            //console.error(`[processLands] landName is undefined for pair: ${JSON.stringify(pair)}`);
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
//C'est un monstre
//Ajoute encore plus d'enpoints pour la récupération des assets et enleve tout les logs tu veux pas savoir ce qu'il se passe dedans
async function fetchAndProcessOwnersData(pairs) {
    const { function_list_assets_batch } = require('./fetchData');
    try {
        // Étape 1: Extraction des propriétaires uniques
        const uniqueOwners = Array.from(new Set(pairs.map(pair => pair.owner)));
        
        // Étape 2: Récupération des assets
        const ownersAssets = await function_list_assets_batch(uniqueOwners);
        if (!ownersAssets) {
            console.error("[fetchAndProcessOwnersData] No assets data retrieved.");
            return [];
        }       
        // Étape 3: Lecture des détails de templates
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        
        // Étape 4: Traitement des propriétaires
        let results = [];
        let successCount = 0;
        let errorCount = 0;
        
        for (let i = 0; i < ownersAssets.length; i++) {
            const ownerAsset = ownersAssets[i];
            const owner = uniqueOwners[i];
            
            try {
                if (!ownerAsset.data || !ownerAsset.data.templates) {
                    console.warn(`⚠️  [fetchAndProcessOwnersData] No templates found for owner: ${owner}`);
                    errorCount++;
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
                                landWorlds.push(template);
                            break;
                    }
                });
                
                //console.log(`📊 [fetchAndProcessOwnersData] ${owner}: ${armsWorlds.length} arms, ${crewWorlds.length} crew, ${facesWorlds.length} faces, ${landWorlds.length} lands`);
                
                // ================= Récupération des faces warlord =================
                console.log(`🔄 [fetchAndProcessOwnersData] ${owner}: Récupération des warlords...`);
                const warlordInfo = await getWarlordSlotsForOwner(owner);
                
                // Préparer les warlords pour stockage en base (sans les ajouter aux facesWorlds)
                let warlordTemplates = [];
                if (warlordInfo.details && warlordInfo.details.length > 0) {
                    warlordTemplates = warlordInfo.details.map(warlord => ({
                        template_id: warlord.template_id,
                        count: 1, // Chaque warlord compte pour 1 asset
                        type: 'warlord'
                    }));
                }
                console.log(`✅ [fetchAndProcessOwnersData] ${owner}: ${warlordTemplates.length} warlords récupérés`);
                
                // ================= Récupération des mercenaires planetdefnft =================
                //console.log(`🔄 [fetchAndProcessOwnersData] ${owner}: Récupération des mercenaires...`);
                let extraMercenaries = [];
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
                    "https://api.waxeastern.cn",
                    "https://wax-atomic.eosiomadrid.io"
                ];
                let found = false;
                for (const endpoint of endpoints) {
                    const url = `${endpoint}/atomicassets/v1/assets?owner=${owner}&collection_name=planetdefnft&schema_name=mercenary&limit=100`;
                    try {
                        const response = await axios.get(url);
                        if (response.data && response.data.data) {
                            
                            extraMercenaries = response.data.data.map((asset, index) => {
                                return {
                                    asset_id: asset.asset_id || `mercenary_${index}`,
                                    template_id: asset.template?.template_id || `mercenary_${asset.name?.replace(/\s+/g, '_') || index}`,
                                    attack: parseInt(asset.data?.attack || asset.template?.immutable_data?.attack || 0),
                                    defense: parseInt(asset.data?.defense || asset.template?.immutable_data?.defense || 0),
                                    movecost: parseInt(asset.data?.movecost || asset.template?.immutable_data?.movecost || 0),
                                    name: asset.data?.name || asset.template?.immutable_data?.name || asset.name || `Mercenary ${index}`
                                };
                            });
                            
                            // Préparer les mercenaries pour stockage en base (sans les ajouter aux crewWorlds)
                            // Les mercenaries seront traités séparément
                            
                            found = true;
                            break;
                        }
                    } catch (err) {
                        // Erreur silencieuse, on essaie le prochain endpoint
                    }
                }
                //console.log(`✅ [fetchAndProcessOwnersData] ${owner}: ${extraMercenaries.length} mercenaires récupérés`);
                // Préparer les mercenaries comme templates
                let mercenaryTemplates = [];
                if (extraMercenaries && extraMercenaries.length > 0) {
                    mercenaryTemplates = extraMercenaries.map(mercenary => ({
                        template_id: mercenary.template_id,
                        count: 1, // Chaque mercenaire compte pour 1 asset
                        type: 'mercenary'
                    }));
                }
                
                // =====================================================
                results.push({
                    owner,
                    armsWorlds,
                    crewWorlds,
                    facesWorlds,
                    landWorlds,
                    extraMercenaries,
                    warlordTemplates,
                    mercenaryTemplates
                });
                
                successCount++;
                //console.log(`✅ [fetchAndProcessOwnersData] ${owner}: Traitement terminé avec succès`);
                
            } catch (error) {
                errorCount++;
                console.error(`❌ [fetchAndProcessOwnersData] Error processing assets for owner ${owner}:`, error.message);
            }
        }
        
        //console.log(`\n📊 [fetchAndProcessOwnersData] RÉSUMÉ:`);
        //console.log(`   ✅ Succès: ${successCount}/${ownersAssets.length} propriétaires`);
        //console.log(`   ❌ Erreurs: ${errorCount}/${ownersAssets.length} propriétaires`);
        //console.log(`✅ [fetchAndProcessOwnersData] Terminé: ${results.length} propriétaires traités`);
        
        return results;
    } catch (error) {
        console.error(`❌ [fetchAndProcessOwnersData] Erreur globale:`, error.message);
        return [];
    }
}

// Récupère et enrichit les assets d'un joueur unique
async function fetchAndProcessPlayerData(address) {
    const { function_list_assets_batch } = require('./fetchData');
    try {
        const playerassets = await function_list_assets_batch([address]);
        if (!playerassets || playerassets.length === 0) {
            //console.error(`[fetchAndProcessPlayerData] No assets data retrieved for ${address}.`);
            return [];
        }
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        let results = [];
        const playerasset = playerassets[0];
        try {
            if (!playerasset.data || !playerasset.data.templates) {
                //console.error(`[fetchAndProcessPlayerData] No templates found for player: ${address}`);
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
            
            // ================= Récupération des faces warlord pour le joueur =================
            const warlordInfo = await getWarlordSlotsForOwner(address);
            
            // Préparer les warlords pour stockage en base (sans les ajouter aux facesWorlds)
            let warlordTemplates = [];
            if (warlordInfo.details && warlordInfo.details.length > 0) {
                warlordTemplates = warlordInfo.details.map(warlord => ({
                    template_id: warlord.template_id,
                    count: 1, // Chaque warlord compte pour 1 asset
                    type: 'warlord'
                }));
            }
            // ================= Récupération des mercenaires planetdefnft pour le joueur =================
            let extraMercenaries = [];
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
                "https://api.waxeastern.cn",
                "https://wax-atomic.eosiomadrid.io"
            ];
            
            // Mélanger les endpoints pour équilibrer la charge
            const shuffledEndpoints = [...endpoints].sort(() => Math.random() - 0.5);
            //console.log(`🔄 [fetchAndProcessPlayerData] ${address}: Endpoints mélangés pour mercenaires`);
            
            let found = false;
            for (const endpoint of shuffledEndpoints) {
                const url = `${endpoint}/atomicassets/v1/assets?owner=${address}&collection_name=planetdefnft&schema_name=mercenary&limit=100`;
                try {
                    const response = await axios.get(url);
                    if (response.data && response.data.data) {
                        extraMercenaries = response.data.data.map(asset => ({
                            asset_id: asset.asset_id,
                            template_id: asset.template?.template_id || asset.template_id,
                            attack: asset.data.attack || 0,
                            defense: asset.data.defense || 0,
                            movecost: asset.data.movecost || 0
                        }));
                        
                        // Préparer les mercenaries pour stockage en base (sans les ajouter aux crewWorlds)
                        // Les mercenaries seront traités séparément
                        
                        found = true;
                        break;
                    }
                } catch (err) {
                    // Erreur silencieuse, on essaie le prochain endpoint
                }
            }
            
            // Préparer les mercenaries comme templates
            let mercenaryTemplates = [];
            if (extraMercenaries && extraMercenaries.length > 0) {
                mercenaryTemplates = extraMercenaries.map(mercenary => ({
                    template_id: mercenary.template_id,
                    count: 1, // Chaque mercenaire compte pour 1 asset
                    type: 'mercenary'
                }));
            }
            
            // =====================================================
            results.push({
                owner: address,
                armsWorlds,
                crewWorlds,
                facesWorlds,
                extraMercenaries,
                warlordTemplates,
                mercenaryTemplates
            });
        } catch (error) {
            //console.error(`[fetchAndProcessPlayerData] Error processing assets for player ${address}:`, error);
        }
        return results;
    } catch (error) {
        //console.error(`[fetchAndProcessPlayerData] An error occurred while fetching assets for ${address}:`, error);
        return [];
    }
}

// Traite tous les joueurs d'une liste d'adresses (OPTIMISÉ - PARALLÈLE)
async function processAllAddresses(adressplayer) {
    //console.log(`🔄 [processAllAddresses] Traitement de ${adressplayer.length} joueurs en parallèle...`);
    
    // Traitement par batches pour éviter la surcharge
    const batchSize = 10; // Traiter 50 joueurs à la fois
    const results = [];
    
    for (let i = 0; i < adressplayer.length; i += batchSize) {
        const batch = adressplayer.slice(i, i + batchSize);
        //console.log(`📦 [processAllAddresses] Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(adressplayer.length/batchSize)} (${batch.length} joueurs)`);
        
        // Traitement parallèle du batch
        const batchPromises = batch.map(async (address) => {
            try {
                const result = await fetchAndProcessPlayerData(address);
                return result.length > 0 ? result[0] : null;
            } catch (error) {
                //console.log(`⚠️  [processAllAddresses] Erreur pour ${address}: ${error.message}`);
                return null;
            }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null));
        
        //console.log(`✅ [processAllAddresses] Batch terminé: ${batchResults.filter(r => r !== null).length}/${batch.length} succès`);
    }
    
    //console.log(`🎉 [processAllAddresses] Traitement terminé: ${results.length} joueurs traités avec succès`);
    return results;
}

module.exports = {
    processLands,
    fetchAndProcessOwnersData,
    fetchAndProcessPlayerData,
    processAllAddresses,
    getWarlordSlotsForOwner
};
