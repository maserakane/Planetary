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

// ==================== CONFIGURATION BLOCKCHAIN ====================
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;
const dbPath = process.env.DATABASE_PATH;

if (!privateKey || !accountName || !permissionName || !dbPath) {
    console.error('Une ou plusieurs variables d\'environnement sont manquantes.');
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

// ==================== FONCTIONS UTILITAIRES ====================

function getLandownersData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });
        db.all('SELECT landIds, owner FROM Landowners', [], (err, rows) => {
            db.close();
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function chargerDonneesBlockchain() {
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
}

async function chargerDonneesBlockchainChest() {
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
}

function comparerLandIds(ownersData, chestData) {
    const discrepancies = [];
    ownersData.forEach((ownerEntry) => {
        if (ownerEntry.landId && ownerEntry.owner) {
            ownerEntry.landId.forEach(landId => {
                const matchingChestEntry = chestData.find(chest => chest.landId === landId);
                if (!matchingChestEntry) {
                    discrepancies.push({ owner: ownerEntry.owner, landId, issue: 'Land ID not found in chest table' });
                } else if (matchingChestEntry.owner !== ownerEntry.owner) {
                    discrepancies.push({ owner: ownerEntry.owner, landId, issue: `Land ID belongs to ${ownerEntry.owner} in chest table instead of ${matchingChestEntry.owner}` });
                }
            });
        }
    });
    return discrepancies;
}

async function removeLand(owner, landId) {
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
        }
    } catch (error) {
        console.error(`[removeLand] Erreur : ${error.message}`);
    }
}

async function modifyChest(landId, newOwner) {
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
        }
    } catch (error) {
        console.error(`[modifyChest] Erreur : ${error.message}`);
    }
}

async function getOwnerFromBlockchain(landId) {
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: accountName,
            table: "owners",
            scope: accountName,
            json: true,
            limit: 1000
        }),
    });
    if (!response.ok) throw new Error('Network response was not ok');
    const data = await response.json();
    for (const row of data.rows) {
        if (row.land_ids && row.land_ids.includes(landId)) {
            return row.owner_address;
        }
    }
    return null;
}

// ==================== SYNCHRONISATION PRINCIPALE ====================

async function processLandData() {
    try {
        console.log('--- Début de la synchronisation des propriétaires de lands ---');
        // 1. Récupération des données locales et blockchain
        const localLandownersData = await getLandownersData();
        const blockchainLandownersData = await chargerDonneesBlockchain();
        console.log(`Nombre d'entrées locales Landowners: ${localLandownersData.length}`);
        console.log(`Nombre d'entrées blockchain owners: ${blockchainLandownersData.length}`);

        // 0. Nettoyage des doublons locaux AVANT toute synchronisation
        console.log('--- Début du nettoyage des doublons locaux (landId attribué à plusieurs propriétaires) ---');

        // Construction d'une map landId -> Set(propriétaires)
        const landIdToOwners = {};
        localLandownersData.forEach(item => {
            const owner = item.owner;
            const landIds = JSON.parse(item.landIds);
            landIds.forEach(id => {
                if (!landIdToOwners[id]) landIdToOwners[id] = new Set();
                landIdToOwners[id].add(owner);
            });
        });

        const db = new sqlite3.Database(dbPath);

        for (const [landId, ownersSet] of Object.entries(landIdToOwners)) {
            const owners = Array.from(ownersSet);
            if (owners.length > 1) {
                console.log(`LandId ${landId} est attribué à plusieurs propriétaires dans la base locale : ${owners.join(', ')}`);
                // On interroge la blockchain pour trouver le vrai propriétaire
                const trueOwner = await getOwnerFromBlockchain(landId);
                if (trueOwner) {
                    console.log(`Le propriétaire blockchain de landId ${landId} est ${trueOwner}. Suppression des autres propriétaires dans la base locale...`);
                    for (const owner of owners) {
                        if (owner !== trueOwner) {
                            db.run(
                                'DELETE FROM Landowners WHERE landIds LIKE ? AND owner = ?',
                                [`%${landId}%`, owner],
                                function(err) {
                                    if (err) {
                                        console.error(`Erreur lors de la suppression du landId ${landId} pour le propriétaire ${owner} :`, err.message);
                                    } else {
                                        console.log(`LandId ${landId} supprimé pour le propriétaire ${owner} dans la base locale.`);
                                    }
                                }
                            );
                        }
                    }
                } else {
                    console.warn(`Impossible de trouver le propriétaire blockchain pour landId ${landId}. Aucun nettoyage effectué.`);
                }
            }
        }
        db.close();

        // 2. Construction des maps pour comparaison rapide
        const localLandIdToOwner = {};
        localLandownersData.forEach(item => {
            const owner = item.owner;
            const landIds = JSON.parse(item.landIds);
            landIds.forEach(id => {
                localLandIdToOwner[id] = owner;
            });
        });
        const blockchainLandIdToOwner = {};
        blockchainLandownersData.forEach(item => {
            const owner = item.owner;
            item.landId.forEach(id => {
                blockchainLandIdToOwner[id] = owner;
            });
        });

        // 3. Correction blockchain : retire les mauvais propriétaires et signale les manquants
        for (const [landId, localOwner] of Object.entries(localLandIdToOwner)) {
            const chainOwner = blockchainLandIdToOwner[landId];
            if (chainOwner && chainOwner !== localOwner) {
                console.log(`Correction blockchain : landId ${landId} appartient à ${chainOwner} sur la blockchain, mais devrait appartenir à ${localOwner}.`);
                await removeLand(chainOwner, landId);
            }
            if (!chainOwner) {
                console.log(`LandId ${landId} n'existe pas sur la blockchain, il devrait appartenir à ${localOwner}. (Action d'ajout à prévoir si besoin)`);
            }
        }

        // 4. Suppression sur la blockchain des landIds inexistants localement
        for (const [landId, chainOwner] of Object.entries(blockchainLandIdToOwner)) {
            if (!localLandIdToOwner[landId]) {
                console.log(`LandId ${landId} existe sur la blockchain (propriétaire ${chainOwner}) mais pas dans la base locale. Suppression...`);
                await removeLand(chainOwner, landId);
            }
        }

        // 5. Vérification des chests
        const chestData = await chargerDonneesBlockchainChest();
        const discrepancies = comparerLandIds(blockchainLandownersData, chestData);
        if (discrepancies.length > 0) {
            console.log('Discrepancies entre owners et chests:', JSON.stringify(discrepancies, null, 2));
        }
        for (const discrepancy of discrepancies) {
            console.log(`[processLandData] Correction Land ID ${discrepancy.landId} vers ${discrepancy.owner}`);
            //await modifyChest(discrepancy.landId, discrepancy.owner);
        }
        console.log('--- Fin de la synchronisation des propriétaires de lands ---');
    } catch (error) {
        console.error('[processLandData] Erreur lors de la synchronisation des propriétaires de lands :', error);
    }
}

// ==================== EXPORT ====================
module.exports = {
    processLandData
};

if (require.main === module) {
    processLandData().then(() => {
        console.log('Synchronisation terminée.');
        process.exit(0);
    }).catch((err) => {
        console.error('Erreur lors de l\'exécution du script :', err);
        process.exit(1);
    });
}


