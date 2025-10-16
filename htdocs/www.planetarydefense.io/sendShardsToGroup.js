const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Charger la clé privée (environnement ou autre méthode sécurisée)
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

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

// Liste des joueurs à qui envoyer les shards
const playersList = [
".yphi.wam"
];

// Nombre de shards à envoyer à chaque joueur
const SHARDS_PER_PLAYER = 8000;

// Fonction pour envoyer des shards à un joueur
async function sendShardsToPlayer(player, playerShards) {
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

        const result = await session.transact({ actions: [action] }, { blocksBehind: 3, expireSeconds: 30 });
        console.log(`✅ Shards envoyés à ${player}. Transaction ID: ${result.transaction_id}`);
        return { success: true, player, transactionId: result.transaction_id };
    } catch (error) {
        console.error(`❌ Erreur lors de l'envoi de shards à ${player}:`, error);
        return { success: false, player, error: error.message };
    }
}

// Fonction principale pour envoyer des shards à tous les joueurs
async function sendShardsToGroup() {
    console.log(`🚀 Début de l'envoi de ${SHARDS_PER_PLAYER} shards à ${playersList.length} joueurs...`);
    console.log(`📋 Liste des joueurs: ${playersList.join(', ')}`);
    console.log('');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Envoyer les shards à chaque joueur avec un délai entre chaque transaction
    for (let i = 0; i < playersList.length; i++) {
        const player = playersList[i];
        console.log(`📤 Envoi de shards à ${player} (${i + 1}/${playersList.length})...`);
        
        const result = await sendShardsToPlayer(player, SHARDS_PER_PLAYER);
        results.push(result);
        
        if (result.success) {
            successCount++;
        } else {
            errorCount++;
        }

        // Attendre 2 secondes entre chaque transaction pour éviter la surcharge
        if (i < playersList.length - 1) {
            console.log('⏳ Attente de 2 secondes avant la prochaine transaction...');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Résumé final
    console.log('');
    console.log('📊 RÉSUMÉ FINAL:');
    console.log(`✅ Transactions réussies: ${successCount}`);
    console.log(`❌ Transactions échouées: ${errorCount}`);
    console.log(`📈 Taux de succès: ${((successCount / playersList.length) * 100).toFixed(2)}%`);
    console.log(`💰 Total de shards envoyés: ${successCount * SHARDS_PER_PLAYER}`);

    // Afficher les détails des erreurs si il y en a
    if (errorCount > 0) {
        console.log('');
        console.log('❌ DÉTAILS DES ERREURS:');
        results.filter(r => !r.success).forEach(result => {
            console.log(`- ${result.player}: ${result.error}`);
        });
    }

    // Afficher les transactions réussies
    if (successCount > 0) {
        console.log('');
        console.log('✅ TRANSACTIONS RÉUSSIES:');
        results.filter(r => r.success).forEach(result => {
            console.log(`- ${result.player}: ${result.transactionId}`);
        });
    }

    return results;
}

// Fonction pour envoyer des shards à un joueur spécifique (utile pour les tests)
async function sendShardsToSpecificPlayer(player, shards = SHARDS_PER_PLAYER) {
    console.log(`🎯 Envoi de ${shards} shards à ${player}...`);
    const result = await sendShardsToPlayer(player, shards);
    
    if (result.success) {
        console.log(`✅ Succès! Transaction ID: ${result.transactionId}`);
    } else {
        console.log(`❌ Échec: ${result.error}`);
    }
    
    return result;
}

// Exporter les fonctions pour une utilisation externe
module.exports = {
    sendShardsToGroup,
    sendShardsToSpecificPlayer,
    playersList,
    SHARDS_PER_PLAYER
};

// Exécuter automatiquement si le fichier est lancé directement
if (require.main === module) {
    sendShardsToGroup()
        .then(() => {
            console.log('🎉 Processus terminé!');
            process.exit(0);
        })
        .catch(error => {
            console.error('💥 Erreur fatale:', error);
            process.exit(1);
        });
} 