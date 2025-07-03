// blockchainTransactions.js
// ------------------------------------------------------------
// Module de gestion des transactions blockchain pour Planetary Defense (WAX)
// ------------------------------------------------------------
// - Ajoute les propriétaires de lands (addowners)
// - Ajoute les joueurs (addplayers)
// - Gère l'envoi en lots (batch) pour éviter les limites de transaction
// - Utilise @wharfkit/session pour la signature et l'envoi
// ------------------------------------------------------------

const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// ==================== CONFIGURATION ====================
// Chargement des variables d'environnement
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

if (!privateKey) {
    console.error('[blockchainTransactions] Clé privée non définie dans les variables d\'environnement.');
    process.exit(1);
}

// Configuration de la blockchain WAX
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

// ==================== FONCTIONS PRINCIPALES ====================

/**
 * Envoie une transaction pour ajouter des propriétaires de lands sur la blockchain.
 * @param {Array} ownersDetails - Tableau d'objets { owner, landIds, defenseScores }
 */
async function addOwners(ownersDetails) {
    try {
        if (!Array.isArray(ownersDetails)) {
            throw new Error("ownersDetails n'est pas un tableau");
        }
        // Préparation des données pour la blockchain
        const ownerDetailsProcessed = ownersDetails.flatMap(owner => {
            const landIds = Array.isArray(owner.landIds) ? owner.landIds : [];
            if (landIds.length === 0) {
                console.warn(`[addOwners] Aucun landId trouvé pour owner: ${owner.owner}`);
            }
            return landIds.map(land_id => ({
                owner: owner.owner,
                land_id: parseInt(land_id),
                totalDefense: owner.defenseScores?.totalDefense || 0,
                totalDefenseArm: owner.defenseScores?.totalDefenseArm || 0,
                totalAttack: owner.defenseScores?.totalAttack || 0,
                totalAttackArm: owner.defenseScores?.totalAttackArm || 0,
                totalMoveCost: owner.defenseScores?.totalMoveCost || 0
            }));
        });
        if (ownerDetailsProcessed.length === 0) {
            console.warn("[addOwners] Aucun owner detail n'a été généré.");
            return;
        }
        const action = {
            account: accountName,
            name: 'addowners',
            authorization: [{
                actor: accountName,
                permission: permissionName,
            }],
            data: {
                owner_details: ownerDetailsProcessed
            },
        };
        const result = await session.transact({ actions: [action] }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        if (result && result.transaction_id) {
            console.log(`[addOwners] Transaction réussie ! ID: ${result.transaction_id}`);
        } else {
            console.log('[addOwners] Transaction peut-être réussie mais pas de transaction_id retourné', result);
        }
    } catch (error) {
        console.error(`[addOwners] Erreur : ${error.message}`);
    }
}

/**
 * Envoie les propriétaires de lands à la blockchain par lots (batch).
 * @param {Array} ownersDetails - Tableau d'objets propriétaires
 * @param {number} batchSize - Taille du lot (par défaut 100)
 */
async function sendOwnersInBatches(ownersDetails, batchSize = 100) {
    for (let i = 0; i < ownersDetails.length; i += batchSize) {
        const batch = ownersDetails.slice(i, i + batchSize);
        try {
            await addOwners(batch);
        } catch (error) {
            console.error(`[sendOwnersInBatches] Erreur lors de l'envoi du batch : `, error);
        }
    }
}

/**
 * Envoie une transaction pour ajouter des joueurs sur la blockchain.
 * @param {Array} playersDetails - Tableau d'objets { owner, defenseScores }
 */
async function addPlayers(playersDetails) {
    try {
        const action = {
            account: accountName,
            name: 'addplayers',
            authorization: [{
                actor: accountName,
                permission: permissionName,
            }],
            data: {
                players_details: playersDetails.map(player => ({
                    player_address: player.owner,
                    totalDefense: player.defenseScores?.totalDefense || 0,
                    totalDefenseArm: player.defenseScores?.totalDefenseArm || 0,
                    totalAttack: player.defenseScores?.totalAttack || 0,
                    totalAttackArm: player.defenseScores?.totalAttackArm || 0,
                    totalMoveCost: player.defenseScores?.totalMoveCost || 0
                }))
            },
        };
        const result = await session.transact({ actions: [action] }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        if (result && result.transaction_id) {
            console.log(`[addPlayers] Transaction réussie ! ID: ${result.transaction_id}`);
        } else {
            console.log('[addPlayers] Transaction peut-être réussie mais pas de transaction_id retourné', result);
        }
    } catch (error) {
        console.error(`[addPlayers] Erreur : ${error.message}`);
    }
}

/**
 * Envoie les joueurs à la blockchain par lots (batch).
 * @param {Array} playersDetails - Tableau d'objets joueurs
 * @param {number} batchSize - Taille du lot (par défaut 100)
 */
async function sendPlayersInBatches(playersDetails, batchSize = 100) {
    for (let i = 0; i < playersDetails.length; i += batchSize) {
        const batch = playersDetails.slice(i, i + batchSize);
        try {
            await addPlayers(batch);
        } catch (error) {
            console.error(`[sendPlayersInBatches] Erreur lors de l'envoi du batch : `, error);
        }
    }
}

// ==================== EXPORT ====================
module.exports = {
    sendOwnersInBatches,
    sendPlayersInBatches
};
