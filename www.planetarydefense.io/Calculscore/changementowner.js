// changementowner.js
// Synchronisation et correction des propriétaires de lands entre la base locale et la blockchain WAX
// ------------------------------------------------------------
// - Vérifie les incohérences entre la base locale et la blockchain
// - Corrige les propriétaires incorrects sur la blockchain
// - Met à jour la table chest si besoin
// ------------------------------------------------------------

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const fs = require('fs').promises;

// ==================== CONFIGURATION BLOCKCHAIN ====================
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

if (!privateKey) {
    console.error('Private key is not defined in the environment variables.');
    process.exit(1);
}

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

const dbPath = process.env.DATABASE_PATH;
if (!dbPath) {
    console.error('DATABASE_PATH is not defined in .env file');
    process.exit(1);
}

// ==================== FONCTIONS PRINCIPALES ====================

// Récupère les données de la table Landowners (base locale)
function getLandownersData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                console.error('Error connecting to the database:', err.message);
                return reject(err);
            }
        });
        const query = 'SELECT landIds, owner FROM Landowners';
        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                console.error('Error executing query:', err.message);
                return reject(err);
            }
            resolve(rows);
        });
    });
}

// Récupère les données de la table owners sur la blockchain WAX
async function chargerDonneesBlockchain() {
    try {
        const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: accountName,
                table: "owners",
                scope: accountName,
                json: true,
                limit: 1000,
            }),
        });
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data.rows.map(row => ({ landId: row.land_ids, owner: row.owner_address }));
    } catch (error) {
        console.error('Error fetching data from blockchain:', error);
        throw error;
    }
}

// Détecte les landIds avec plusieurs propriétaires sur la blockchain
function detectDuplicateLandIds(blockchainData) {
    const landIdMap = {};
    blockchainData.forEach(({ landId, owner }) => {
        landId.forEach(id => {
            if (!landIdMap[id]) landIdMap[id] = [];
            landIdMap[id].push(owner);
        });
    });
    return Object.entries(landIdMap)
        .filter(([, owners]) => owners.length > 1)
        .map(([landId, owners]) => ({ landId, owners }));
}

// Détermine les propriétaires incorrects à retirer sur la blockchain
function determineIncorrectOwners(duplicateLandIds, localData) {
    const actions = [];
    const localLandMap = {};
    localData.forEach(item => {
        const landIds = JSON.parse(item.landIds);
        landIds.forEach(id => {
            localLandMap[id] = item.owner;
        });
    });
    duplicateLandIds.forEach(({ landId, owners }) => {
        const correctOwner = localLandMap[landId];
        if (correctOwner) {
            owners.forEach(owner => {
                if (owner !== correctOwner) {
                    actions.push({ landId, ownerToRemove: owner });
                }
            });
        } else {
            console.warn(`[determineIncorrectOwners] Aucun propriétaire correct trouvé dans la base locale pour le landId: ${landId}`);
        }
    });
    return actions;
}

// Appelle l'action "removeland" sur la blockchain
async function removeLand(owner, landId) {
    console.log('removeLand');
    console.log(owner, landId);
    try {
        const action = {
            account: accountName,
            name: 'removeland',
            authorization: [{ actor: accountName, permission: permissionName }],
            data: { owner, land_id: landId },
        };
        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        if (result && result.transaction_id) {
            console.log(`[removeLand] Transaction successful! ID: ${result.transaction_id}`);
        } else {
            console.log('[removeLand] Transaction might have succeeded but did not return a transaction_id', result);
        }
    } catch (error) {
        console.error(`[removeLand] Erreur : ${error.message}`);
    }
}

// Récupère les données de la table chest sur la blockchain
async function chargerDonneesBlockchainChest() {
    try {
        const limit = 1000;
        let allRows = [];
        let lower_bound = "";
        let more = true;
        while (more) {
            const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: accountName,
                    table: "chests",
                    scope: accountName,
                    json: true,
                    limit: limit,
                    lower_bound: lower_bound,
                }),
            });
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            allRows = allRows.concat(data.rows);
            more = data.more;
            if (more) lower_bound = data.next_key;
        }
        return allRows.map(row => ({ landId: row.land_id, owner: row.owner }));
    } catch (error) {
        console.error('Error fetching data from blockchain:', error);
        throw error;
    }
}

// Compare les landIds entre les tables owners et chest
function comparerLandIds(ownersData, chestData) {
    const discrepancies = [];
    ownersData.forEach((ownerEntry) => {
        if (ownerEntry.landId && ownerEntry.owner) {
            ownerEntry.landId.forEach(landId => {
                const matchingChestEntry = chestData.find(chest => chest.landId === landId);
                if (!matchingChestEntry) {
                    discrepancies.push({ owner: ownerEntry.owner, landId, issue: 'Land ID not found in chest table' });
                } else if (matchingChestEntry.owner !== ownerEntry.owner) {
                    console.warn(`[comparerLandIds] Propriétaire incorrect pour ${landId} : trouvé ${matchingChestEntry.owner}, attendu ${ownerEntry.owner}.`);
                    discrepancies.push({ owner: ownerEntry.owner, landId, issue: `Land ID belongs to ${ownerEntry.owner} in chest table instead of ${matchingChestEntry.owner}` });
                }
            });
        } else {
            console.warn(`[comparerLandIds] Aucun land_ids défini ou propriétaire manquant pour l'entrée :`, ownerEntry);
        }
    });
    return discrepancies;
}

// Modifie le propriétaire d'un chest sur la blockchain
async function modifyChest(landId, newOwner) {
    console.log(landId, newOwner);
    try {
        const action = {
            account: accountName,
            name: 'modifychest',
            authorization: [{ actor: accountName, permission: permissionName }],
            data: { land_id: landId.toString(), new_owner: newOwner },
        };
        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        if (result && result.transaction_id) {
            console.log(`[modifyChest] Transaction modifychest réussie ! ID : ${result.transaction_id}`);
        } else {
            //console.log('[modifyChest] Transaction might have succeeded but did not return a transaction_id', result);
        }
    } catch (error) {
        console.error(`[modifyChest] Erreur : ${error.message}`);
    }
}

// ==================== PIPELINE DE SYNCHRONISATION ====================
async function processLandData() {
    try {
        // 1. Récupération des données locales et blockchain
        const localLandownersData = await getLandownersData();
        const blockchainLandownersData = await chargerDonneesBlockchain();
        // 2. Détection des landIds avec plusieurs propriétaires
        const duplicateLandIds = detectDuplicateLandIds(blockchainLandownersData);
        // 3. Détermination des propriétaires incorrects
        const incorrectOwners = determineIncorrectOwners(duplicateLandIds, localLandownersData);
        for (const action of incorrectOwners) {
            console.log(`[processLandData] Retirer Land ID ${action.landId} de ${action.ownerToRemove}`);
            await removeLand(action.ownerToRemove, action.landId);
        }
        // 4. Vérification des chests
        const chestData = await chargerDonneesBlockchainChest();
        const discrepancies = comparerLandIds(blockchainLandownersData, chestData);
        for (const discrepancy of discrepancies) {
            console.log(`[processLandData] Correction Land ID ${discrepancy.landId} vers ${discrepancy.owner}`);
            await modifyChest(discrepancy.landId, discrepancy.owner);
        }
    } catch (error) {
        console.error('[processLandData] Erreur lors de la synchronisation des propriétaires de lands :', error);
    }
}

// ==================== EXPORT ====================
module.exports = {
    processLandData
};


