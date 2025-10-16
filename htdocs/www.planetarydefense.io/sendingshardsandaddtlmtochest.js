const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH;
const db = new sqlite3.Database(dbPath);

// Charger la clé privée (environnement ou autre méthode sécurisée)
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

// const privateKey = "5KasUafxJ8dxBKXGuNEazXp2PKv6JWKF4VDauCVczpZGc2ipoUp";
// const accountName = "magortestpla";
// const permissionName = "owner";

// Vérifier que la clé privée est disponible
if (!privateKey) {
    console.error('Clé privée non définie.');
    process.exit(1);
}

// Configuration de la blockchain
const chain = {
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    url: "https://wax.pink.gg",
};
const walletPlugin = new WalletPluginPrivateKey(privateKey);

const session = new Session({
    actor: accountName,
    permission: permissionName,
    chain,
    walletPlugin,
});

// Fonction pour charger les données d'une table blockchain EOSIO
async function chargerDonneesBlockchain(tableName) {
    try {
        const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'magordefense', // Contrat EOSIO
                table: tableName,     // Table à interroger
                scope: 'magordefense', // Scope de la table
                json: true,
                limit: 1000,
            }),
        });

        if (!response.ok) {
            throw new Error('Problème réseau.');
        }

        const data = await response.json();
        return data; // Retourne les données JSON
    } catch (error) {
        console.error('Erreur lors de la récupération des données blockchain :', error);
        throw error;
    }
}

// Trouver les terrains avec une défense supérieure à un seuil et retourner owner et supporters
async function trouverLandsDefenseSuperieure(seuilDefense, dataSupport, dataOwner) {
    console.log(`Recherche des terrains avec défense supérieure à ${seuilDefense}`);

    let resultatsQualifies = []; // Tableau pour stocker les informations qualifiées

    // Filtrer les propriétaires ayant une défense supérieure au seuil
    dataSupport.rows
        .filter(owner => owner.total_defense_score > seuilDefense)
        .forEach(owner => {
            const ownerData = dataOwner.rows.find(data => data.owner_address === owner.owner_address);
            if (ownerData) {
                const requiredDefenseScore = seuilDefense * ownerData.numberofland;
                if (owner.total_defense_score > requiredDefenseScore) {
                    console.log(`=== PROPRIÉTAIRE QUALIFIÉ ===`);
                    console.log(`Adresse: ${owner.owner_address}`);
                    console.log(`Nombre de terrains: ${ownerData.numberofland}`);
                    console.log(`Défense totale: ${owner.total_defense_score}`);
                    console.log(`Défense requise: ${requiredDefenseScore}`);
                    console.log(`Marge de sécurité: ${owner.total_defense_score - requiredDefenseScore}`);
                    console.log(`Terrains: ${ownerData.land_ids.join(', ')}`);
                    console.log(`Supporters (${owner.supporters.length}): ${owner.supporters.join(', ')}`);
                    console.log(`==============================`);

                    // Ajouter le propriétaire, les supporters et les terrains dans les résultats qualifiés
                    resultatsQualifies.push({
                        owner: owner.owner_address,
                        supporters: owner.supporters, // Liste des supporters
                        lands: ownerData.land_ids // Liste des terrains qualifiés
                    });
                } else {
                    console.log(`=== PROPRIÉTAIRE NON QUALIFIÉ ===`);
                    console.log(`Adresse: ${owner.owner_address}`);
                    console.log(`Nombre de terrains: ${ownerData.numberofland}`);
                    console.log(`Défense totale: ${owner.total_defense_score}`);
                    console.log(`Défense requise: ${requiredDefenseScore}`);
                    console.log(`Déficit: ${requiredDefenseScore - owner.total_defense_score}`);
                    console.log(`Terrains: ${ownerData.land_ids.join(', ')}`);
                    console.log(`Supporters (${owner.supporters.length}): ${owner.supporters.join(', ')}`);
                    console.log(`==============================`);
                }
            } else {
                console.log(`⚠️  ${owner.owner_address} - Données propriétaire non trouvées`);
            }
        });

    console.log(`\n📊 RÉSUMÉ: ${resultatsQualifies.length} propriétaires qualifiés sur ${dataSupport.rows.length} total`);
    return resultatsQualifies; // Retourner un tableau contenant owner, supporters et land_ids
}


// Ajouter des TLM aux terrains qualifiés
async function addTLMToWinningLands(landsQualifies, tlmAmountToAdd) {
    // Calculate TLM to add per land
    let totalLands = 0;
    landsQualifies.forEach(qualified => {
        totalLands += qualified.lands.length;
    });
    const tlmAmountPerLand = tlmAmountToAdd / totalLands;
    console.log(tlmAmountPerLand);
    // For each land, create a modifychest action
    const actions = [];

    landsQualifies.forEach(qualified => {
        qualified.lands.forEach(landId => {
            console.log(landId)
            actions.push({
                account: "magordefense",
                name: "modifychest",
                authorization: [{
                    actor: session.actor,
                    permission: session.permission,
                }],
                data: {
                    land_id: parseInt(landId), // Ensure land_id is a uint64_t
                    new_owner: null,           // No new owner provided
                    new_level: null,           // No new level provided
                    new_tlm: tlmAmountPerLand,  // Adding TLM
                    tlm_to_withdraw: null      // No withdrawal
                }
            });
        });
    });

    // Execute the transaction
    try {
        const result = await session.transact({
            actions: actions
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        console.log(`Transaction réussie ! ID : ${result.transaction_id}`);
    } catch (error) {
        console.error(`Erreur lors de la transaction : ${error.message}`);
    }
}


// Main function to send shards
async function sendShards(landsQualifies, shards) {
    try {
        const totalShards = convertShardsToNumber(shards);
        console.log(`Total shards to distribute: ${totalShards}`);

        const totalLands = calculateTotalLands(landsQualifies);
        if (totalLands === 0) {
            console.log("No qualified lands found. No shards to distribute.");
            return;
        }

        const shardsPerLand = calculateShardsPerLand(totalShards, totalLands);
        console.log(`Shards per land: ${shardsPerLand}`);

        for (const qualified of landsQualifies) {
            await distributeShardsToOwner(qualified, shardsPerLand);
        }
    } catch (error) {
        console.error('Error in sendShards function:', error);
    }
}

// Helper functions

// 1. Convert shards string to a number
function convertShardsToNumber(shards) {
    return parseFloat(shards.replace(/[^\d.]/g, ''));
}

// 2. Calculate total number of lands
function calculateTotalLands(landsQualifies) {
    return landsQualifies.reduce((total, qualified) => total + qualified.lands.length, 0);
}

// 3. Calculate the number of shards to distribute per land
function calculateShardsPerLand(totalShards, totalLands) {
    return (totalShards / totalLands).toFixed(0);
}

// 4. Distribute 75% of the shards to the owner
async function distributeShardsToOwner(qualified, shardsPerLand) {
    const owner = qualified.owner;
    const numLands = qualified.lands.length;
    const shardsToSend = shardsPerLand * numLands;
    const ownerShards = shardsToSend * 0.75;

    console.log(`Owner: ${owner}, Lands: ${numLands}, Shards for owner (75%): ${ownerShards}`);

    const { ownerScore, supporterScores } = await getOwnerAndSupporterScores(owner, qualified.supporters);
    
    // Vérifier que les scores sont des nombres valides pour éviter les NaN
    const validOwnerScore = Number.isFinite(ownerScore) ? ownerScore : 0;
    const validSupporterScores = supporterScores.map(s => ({
        ...s,
        supporterScore: Number.isFinite(s.supporterScore) ? s.supporterScore : 0
    }));
    
    const totalScore = validOwnerScore + validSupporterScores.reduce((acc, s) => acc + s.supporterScore, 0);
    console.log(`Owner Score: ${validOwnerScore}, Total Score: ${totalScore}`);
    console.log('Supporter Scores:', validSupporterScores);
    if (ownerShards > 0) {
        console.log(`Sending ${ownerShards.toFixed(4)} SHARDS to ${owner} (75%)`);
        await sendShardsToPlayers(owner, ownerShards);
    }

    await distributeShardsToSupporters(qualified, totalScore, shardsToSend * 0.25, supporterScores, owner, ownerScore);
}

// 5. Distribute 25% shards to supporters and the owner (based on their respective scores)
async function distributeShardsToSupporters(qualified, totalScore, supporterShards, supporterScores, owner, ownerScore) {
    console.log(`Distribution des 25% restants (${supporterShards}) aux supporters et au propriétaire.`);

    // Include the owner's score in the calculation
    if (totalScore > 0 && supporterShards > 0) {
        // Add owner's score to supporterScores for distribution
        const totalDistribution = [{ supporter: owner, supporterScore: ownerScore }, ...supporterScores];

        // Iterate through each supporter and owner to distribute shards proportionally
        for (const { supporter, supporterScore } of totalDistribution) {
            const supporterShare = (supporterScore / totalScore) * supporterShards;
            const ownerShare = (ownerScore / totalScore) * supporterShards;
            if (supporterShare > 0 || ownerShare > 0) {
                if (supporter === owner) {
                    console.log(`Envoi de ${supporterShare.toFixed(0)} SHARDS au propriétaire ${supporter} (proportionnelle à son score)`);
                    await sendShardsToPlayers(supporter, ownerShare);
                } else {
                    console.log(`Envoi de ${supporterShare.toFixed(0)} SHARDS au supporter ${supporter} (proportionnelle au score)`);
                    await sendShardsToPlayers(supporter, supporterShare);
                }
                // Add code to send shards to the supporter or owner
            }
        }
    } else {
        console.log(`Pas de supporters ou score total nul. Aucune distribution effectuée.`);
    }
}


// 6. Retrieve owner and supporter scores
async function getOwnerAndSupporterScores(owner, supporters) {
    const ownerData = await chargerDonneesBlockchain('owners');
    const playersData = await chargerDonneesBlockchain('players');
    const forgeData = await chargerDonneesBlockchain('forge'); // Charger les données de la forge

    // Fonction pour récupérer le bon score en fonction de la présence dans la forge
    function getDefenseScore(playerAddress) {
        // Vérifier si le joueur est dans la forge
        const forgePlayer = forgeData.rows.find(f => f.player_address === playerAddress);
        if (forgePlayer) {
            const score = Number(forgePlayer.totalDefenseArm);
            return Number.isFinite(score) ? score : 0; // Si présent dans la forge, prendre totalDefenseArm
        }

        // Sinon, on cherche dans la table des joueurs ou des propriétaires
        const playerData = playersData.rows.find(p => p.player_address === playerAddress);
        const score = playerData ? Number(playerData.totalDefense) : 0;
        return Number.isFinite(score) ? score : 0;
    }

    // Récupérer le score du propriétaire
    const ownerScore = getDefenseScore(owner);

    // Récupérer les scores des supporters
    const supporterScores = supporters.map(supporter => ({
        supporter,
        supporterScore: getDefenseScore(supporter),
    }));

    return { ownerScore, supporterScores };
}


// 7. Send shards to a player
async function sendShardsToPlayers(player, playerShards) {
    try {
        const shards = (playerShards * 10).toFixed(0);
        const action = {
            account: "ptpxy.worlds",
            name: "addpoints",
            authorization: [{ actor: "magordefense", permission: "owner" }],
            data: {
                points_manager: "magordefense",
                user: player,
                points: shards,
            },
        };

        console.log(`🚀 Transaction prête à être envoyée pour ${player} - ${shards} points`);
        
        console.log(`📤 Envoi de la transaction...`);
        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        console.log(`Shards sent to ${player}. Transaction ID: ${result.transaction_id}`);
    } catch (error) {
        console.error(`Error sending shards to ${player}:`, error);
    }
}

// Distribution des récompenses en fonction de la défense
async function distributeRewards(name, target, reward, shards) {
    try {
        // Chargement des données des tables 'supports' et 'owners'
        const dataSupport = await chargerDonneesBlockchain('supports');
        const dataOwner = await chargerDonneesBlockchain('owners');
        const dataPlayers = await chargerDonneesBlockchain("players")
        const landsQualifies = await trouverLandsDefenseSuperieure(target, dataSupport, dataOwner); // Trouver les terrains qualifiés
        console.log(landsQualifies);

        if (landsQualifies.length > 0) {
            // Compter le nombre de lands gagnants
            let totalLands = 0;
            landsQualifies.forEach(qualified => {
                totalLands += qualified.lands.length; // Compte le nombre de lands pour chaque owner
            });
            const response = await fetch(`https://www.planetarydefense.io/mission/check-landowner-status`);
            const data = await response.json();
            const landqualifies_active = landsQualifies.filter(item => data.landowners[item.owner]);

            console.log(landqualifies_active.length);
            console.log(`Nombre total de terrains qualifiés: ${totalLands}`);
            updateLandCount(name, totalLands);

            await sendShards(landqualifies_active,shards)
            // // Si nécessaire, ajoute la logique pour ajouter les TLM aux terrains gagnants
           await addTLMToWinningLands(landsQualifies, reward);

            //UPLOAD LES CONTRATS SUR LE COMPTE OFFICIEL
            await addInfoToBlockchain(name, shards);
        } else {
            console.log("Aucun terrain qualifié trouvé.");
        }
    } catch (error) {
        console.error(`Erreur dans distributeRewards : ${error}`);
    }
}




async function fetchAllActions(url, startTime, endTime) {
    let allActions = [];
    let skip = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(`${url}&skip=${skip}&limit=${limit}`);
            if (!response.ok) {
                throw new Error(`Erreur lors de la requête : ${response.statusText}`);
            }

            const data = await response.json();

            // Filtrer les actions par plage de dates
            const filteredActions = data.actions
                .filter(action => {
                    const timestamp = new Date(action.timestamp);
                    return timestamp >= startTime && timestamp <= endTime;
                })
                .map(action => {
                    const pointsManager = action.act.data.points_manager;
                    if (pointsManager === "magordefense") {
                        return {
                            user: action.act.data.user,
                            shards: action.act.data.points / 10
                        };
                    }
                    return null;
                })
                .filter(item => item !== null); // Exclure les éléments non pertinents

            allActions = allActions.concat(filteredActions);

            // Vérifier s'il reste des données à récupérer
            hasMore = data.actions.length === limit;
            skip += limit;
        } catch (error) {
            console.error(`Erreur lors de la récupération des actions : ${error.message}`);
            break;
        }
    }

    return allActions;
}

function mergeDuplicates(results) {
    const mergedResults = [];
    const resultMap = new Map();

    results.forEach(entry => {
        const key = entry.owner_address + JSON.stringify(entry.land_ids);

        if (resultMap.has(key)) {
            const existing = resultMap.get(key);

            // Fusionner les supporters
            existing.supporters = Array.from(new Set([...existing.supporters, ...entry.supporters]));

            // Additionner les shards
            const shardsSum = existing.shards[0] + entry.shards[0];
            existing.shards = [shardsSum, ...existing.shards.slice(1), ...entry.shards.slice(1)];
        } else {
            resultMap.set(key, { ...entry });
        }
    });

    resultMap.forEach(value => mergedResults.push(value));
    return mergedResults;
}

function validateEntry(entry) {
    if (!entry.owner_address || !entry.mission_name || !entry.land_ids || !entry.supporters || !entry.shards) {
        console.error('Entrée invalide détectée :', entry);
        return false;
    }
    return true;
}

async function sendActionsToBlockchain(result) {
    for (const entry of result) {
        if (!validateEntry(entry)) {
            console.error(`Entrée ignorée en raison de données invalides : ${JSON.stringify(entry)}`);
            continue;
        }
        console.log(entry)

        const action = {
            account: accountName, // Nom du contrat
            name: "adddefwin", // Nom de l'action
            authorization: [{
                actor: accountName, // Nom d'acteur, ex: "magordefense"
                permission: permissionName
            }],
            data: {
                owner_address: entry.owner_address,   // Adresse du propriétaire
                mission_name: entry.mission_name,        // Nom de la mission
                land_ids: entry.land_ids,             // Liste des land IDs convertis en nombres
                supporters: entry.supporters,        // Liste des supporters
                shards: entry.shards                 // Liste des shards distribués
            }
        };

        console.log('Envoi de la transaction :', action);

        try {
            const resultTransaction = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
            console.log(`Transaction réussie avec ID: ${resultTransaction.transaction_id}`);
        } catch (transactError) {
            console.error(`Erreur lors de l'envoi de la transaction pour ${entry.owner_address} : ${transactError.message}`);
        }
    }
}

async function addInfoToBlockchain(name) {
    const url = 'https://wax.eosrio.io/v2/history/get_actions?account=magordefense&filter=ptpxy.worlds:*';
    // Calculer les dates dynamiques pour aujourd'hui
    const now = new Date(); // Heure actuelle

    // Définir le startTime à une heure avant l'heure actuelle
    const startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
    
    // Définir le endTime à une heure après l'heure actuelle
    const endTime = new Date(now.getTime() + 1 * 60 * 60 * 1000);
    
    console.log('startTime:', startTime.toISOString());
    console.log('endTime:', endTime.toISOString());
    



    try {
        // Charger les données de la table "owners"
        const ownersData = await chargerDonneesBlockchain('owners');

        // Récupérer toutes les actions via l'API avec pagination
        const userShards = await fetchAllActions(url, startTime, endTime);

        // Combiner les données avec "owners"
        const combinedData = userShards.map(shard => {
            const owner = ownersData.rows.find(row => row.owner_address === shard.user);
            return {
                wam: shard.user,
                shards: shard.shards,
                land_ids: owner ? owner.land_ids : [],
            };
        }).reverse(); // Inverser la liste ici

        // Identifier les supporters et leurs propriétaires
        const result = [];
        let currentOwner = null;
        let currentSupporters = [];

        combinedData.forEach(user => {
            if (user.land_ids && user.land_ids.length > 0) {
                // Si un nouveau propriétaire est trouvé
                if (currentOwner) {
                    result.push({
                        owner_address: currentOwner.wam,
                        mission_name: name,
                        land_ids: currentOwner.land_ids,
                        supporters: currentSupporters.map(supporter => supporter.wam),
                        shards: [currentOwner.shards, ...currentSupporters.map(supporter => supporter.shards)]
                    });
                }
                // Réinitialiser le propriétaire et les supporters
                currentOwner = user;
                currentSupporters = [];
            } else {
                // Ajouter à la liste des supporters
                if (currentOwner) {
                    currentSupporters.push({
                        wam: user.wam,
                        shards: user.shards
                    });
                }
            }
        });

        // Ajouter le dernier groupe à la liste
        if (currentOwner) {
            result.push({
                owner_address: currentOwner.wam,
                mission_name: name,
                land_ids: currentOwner.land_ids,
                supporters: currentSupporters.map(supporter => supporter.wam),
                shards: [currentOwner.shards, ...currentSupporters.map(supporter => supporter.shards)]
            });
        }

        // Fusionner les doublons
        const mergedResult = mergeDuplicates(result);

        // Écrire les données dans un fichier "user_shards.json"
        const fs = require('fs');
        fs.writeFileSync('user_shards.json', JSON.stringify(mergedResult, null, 2));

        console.log('Données sauvegardées dans user_shards.json');

        // Envoyer les actions sur la blockchain
        //await sendActionsToBlockchain(mergedResult);
    } catch (error) {
        console.error('Erreur lors du traitement des actions :', error);
    }
}

(async () => {
    const baseUrl = 'https://www.planetarydefense.io'; // Replace with your server's base URL
    try {
        // Fetching mission data from the server
        const response = await fetch(`${baseUrl}/mission/mission-data?cache-buster=${new Date().getTime()}`);
        const data = await response.json();

        // Extracting relevant mission details
        const name = data.defense.defenseTitleOnchain;
        const shards = data.defense.defenseShards;

        // Remove non-numeric characters and convert the reward to an integer
        const reward = parseInt(data.defense.defenseRewards.replace(/[^\d]/g, ''), 10) / 10000; // Will become 75000
        const target = data.defense.defenseTarget;
        // Log the extracted mission details
        console.log(`Mission Name: ${name}`);
        console.log(`Shards: ${shards}`);
        console.log(`Rewards: ${reward}`);
        console.log(`Target: ${target}`);

        // Call distributeRewards function with the extracted mission details
        await distributeRewards(name, target, reward, shards);

        await updateDefense(name);
    } catch (error) {
        console.error(`Error fetching mission data: ${error.message}`);
    } finally {
        //Closing the database connection
        db.close((err) => {
            if (err) {
                console.error(err.message);
            }
            console.log('Closed the database connection.');
        });
    }
})();


async function updateDefense(mission_name) {
    db.serialize(() => {
        db.get(`SELECT * FROM html WHERE progress = 0 AND defenseTitleOnchain = ?`, [mission_name], (err, row) => {
            if (err) {
                return console.error(err.message);
            }

            // Trigger the update if at least one of the defense fields is populated
            if (row && (row.defenseimg || row.defensetext || row.defenseTitleSite || row.defenseTarget || row.defenseRewards || row.defenseStartDate || row.defenseEndDate || row.defenseTitleOnchain)) {
                db.run(`UPDATE html SET progress = 1 WHERE progress = 0 AND defenseTitleOnchain = ?`, [mission_name], (updateErr) => {
                    if (updateErr) {
                        return console.error(updateErr.message);
                    }
                    console.log(`Progress set to 1 for mission ${mission_name}`);
                });
            } else {
                console.log('No matching defense mission found or no defense fields are populated.');
            }
        });
    });
}

async function updateLandCount(mission_name, nombre_land) {
    db.serialize(() => {
        // Mettre à jour la colonne nombre_land pour la mission spécifiée
        db.run(`UPDATE html SET nombre_land = ? WHERE defenseTitleOnchain = ?`, [nombre_land, mission_name], (updateErr) => {
            if (updateErr) {
                return console.error("Erreur lors de la mise à jour de nombre_land:", updateErr.message);
            }
            console.log(`nombre_land mis à jour pour ${mission_name}: ${nombre_land}`);
        });
    });
}


