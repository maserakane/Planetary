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

async function modifyChest(landId, newOwner, newLevel, newTlm, tlmToWithdraw) {
    try {
        const action = {
            account: accountName,
            name: 'modifychest',
            authorization: [{ actor: accountName, permission: permissionName }],
            data: {
                land_id: landId.toString(),
                new_owner: newOwner,
                new_level: newLevel,
                new_tlm: newTlm,
                tlm_to_withdraw: tlmToWithdraw
            },
        };
        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        if (result && result.transaction_id) {
            console.log(`[modifyChest] Transaction modifychest réussie ! ID : ${result.transaction_id}`);
        } else {
            console.log('[modifyChest] Transaction peut-être réussie mais pas de transaction_id retourné', result);
        }
    } catch (error) {
        console.error(`[modifyChest] Erreur : ${error.message}`);
    }
}

async function addChest(landId, owner, chestLevel, TLM) {
    try {
        const action = {
            account: accountName,
            name: 'addchest',
            authorization: [{ actor: accountName, permission: permissionName }],
            data: {
                land_id: landId.toString(),
                owner: owner,
                chest_level: chestLevel,
                TLM: TLM
            },
        };
        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        if (result && result.transaction_id) {
            console.log(`[addChest] Transaction addchest réussie ! ID : ${result.transaction_id}`);
        } else {
            console.log('[addChest] Transaction peut-être réussie mais pas de transaction_id retourné', result);
        }
    } catch (error) {
        console.error(`[addChest] Erreur : ${error.message}`);
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

        // 2. Préparation des maps pour comparaison rapide
        const localLandIdToOwners = {}; // landId -> Set(owners)
        const localOwnerToLandIds = {}; // owner -> Set(landIds)
        localLandownersData.forEach(item => {
            const owner = item.owner;
            const landIds = JSON.parse(item.landIds);
            if (!localOwnerToLandIds[owner]) localOwnerToLandIds[owner] = new Set();
            landIds.forEach(id => {
                if (!localLandIdToOwners[id]) localLandIdToOwners[id] = new Set();
                localLandIdToOwners[id].add(owner);
                localOwnerToLandIds[owner].add(id);
            });
        });
        const blockchainLandIdToOwner = {};
        blockchainLandownersData.forEach(item => {
            const owner = item.owner;
            item.landId.forEach(id => {
                blockchainLandIdToOwner[id] = owner;
            });
        });

        // 3. Nettoyage des doublons locaux (batch + transaction)
        console.log('--- Nettoyage des doublons locaux (landId attribué à plusieurs propriétaires) ---');
        let doublonsCorriges = 0;
        let suppressionsLocales = 0;
        const suppressionsBatch = [];
        for (const [landId, ownersSet] of Object.entries(localLandIdToOwners)) {
            const owners = Array.from(ownersSet);
            if (owners.length > 1) {
                doublonsCorriges++;
                // On utilise la map blockchain pour trouver le vrai propriétaire
                const trueOwner = blockchainLandIdToOwner[landId];
                if (trueOwner) {
                    console.log(`LandId ${landId} : vrai propriétaire blockchain = ${trueOwner}, suppression des autres dans la base locale...`);
                    for (const owner of owners) {
                        if (owner !== trueOwner) {
                            suppressionsBatch.push({ landId, owner });
                        }
                    }
                } else {
                    console.warn(`LandId ${landId} : pas de propriétaire blockchain trouvé, aucun nettoyage effectué.`);
                }
            }
        }
        if (suppressionsBatch.length > 0) {
            const db = new sqlite3.Database(dbPath);
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                for (const {landId, owner} of suppressionsBatch) {
                    db.run('DELETE FROM Landowners WHERE landIds LIKE ? AND owner = ?', [`%${landId}%`, owner], function(err) {
                        if (err) {
                            console.error(`Erreur lors de la suppression du landId ${landId} pour le propriétaire ${owner} :`, err.message);
                        } else {
                            suppressionsLocales++;
                            console.log(`LandId ${landId} supprimé pour le propriétaire ${owner} dans la base locale.`);
                        }
                    });
                }
                db.run('COMMIT');
            });
            db.close();
        }

        // 4. Correction blockchain : retire les mauvais propriétaires et signale les manquants
        let suppressionsBlockchain = 0;
        for (const [landId, localOwnersSet] of Object.entries(localLandIdToOwners)) {
            const localOwners = Array.from(localOwnersSet);
            const chainOwner = blockchainLandIdToOwner[landId];
            // Si le landId existe sur la blockchain mais le propriétaire ne correspond pas à la base locale
            if (chainOwner && !localOwners.includes(chainOwner)) {
                console.log(`Correction blockchain : landId ${landId} appartient à ${chainOwner} sur la blockchain, mais devrait appartenir à ${localOwners[0]}. Suppression sur la blockchain...`);
                await removeLand(chainOwner, landId);
                suppressionsBlockchain++;
            }
            // Si le landId n'existe pas sur la blockchain mais existe localement
            if (!chainOwner) {
                console.log(`LandId ${landId} n'existe pas sur la blockchain, il devrait appartenir à ${localOwners[0]}. (Action d'ajout à prévoir si besoin)`);
            }
        }
        // Suppression sur la blockchain des landIds inexistants localement
        for (const [landId, chainOwner] of Object.entries(blockchainLandIdToOwner)) {
            if (!localLandIdToOwners[landId]) {
                console.log(`LandId ${landId} existe sur la blockchain (propriétaire ${chainOwner}) mais pas dans la base locale. Suppression sur la blockchain...`);
                await removeLand(chainOwner, landId);
                suppressionsBlockchain++;
            }
        }

        // 5. Vérification des chests
        const chestData = await chargerDonneesBlockchainChest();
        const discrepancies = comparerLandIds(blockchainLandownersData, chestData);
        let correctionsChests = 0;

        // Initialisation ou correction des chests manquants ou incorrects
        for (const discrepancy of discrepancies) {
            if (discrepancy.issue === 'Land ID not found in chest table') {
                console.log(`[addChest] Création du chest pour landId ${discrepancy.landId} (owner: ${discrepancy.owner})`);
                try {
                    await addChest(
                        discrepancy.landId,
                        discrepancy.owner || '', // owner si connu, sinon vide
                        0,  // chest_level
                        0   // TLM
                    );
                    console.log(`[addChest] Succès pour landId ${discrepancy.landId}`);
                    correctionsChests++;
                } catch (e) {
                    console.error(`[addChest] Échec pour landId ${discrepancy.landId} :`, e.message);
                }
            } else if (discrepancy.issue && discrepancy.issue.startsWith('Land ID belongs to')) {
                console.log(`[processLandData] Correction du propriétaire du chest pour landId ${discrepancy.landId} vers ${discrepancy.owner}`);
                try {
                    await modifyChest(
                        discrepancy.landId,
                        discrepancy.owner,
                    );
                    console.log(`[processLandData] Correction réussie pour landId ${discrepancy.landId}`);
                    correctionsChests++;
                } catch (e) {
                    console.error(`[processLandData] Correction échouée pour landId ${discrepancy.landId} :`, e.message);
                }
            }
        }
        console.log(`Nombre total de chests initialisés ou corrigés : ${correctionsChests}`);

        // 6. Résumé global
        console.log('--- Résumé de la synchronisation ---');
        console.log(`Doublons locaux corrigés : ${doublonsCorriges}`);
        console.log(`Suppressions locales effectuées : ${suppressionsLocales}`);
        console.log(`Suppressions/corrections blockchain effectuées : ${suppressionsBlockchain}`);
        console.log(`Corrections chests à faire : ${correctionsChests}`);
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


