// Synchronisation simplifiée des propriétaires de lands
// =====================================================

const path = require('path');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");

// Configuration
const config = {
    privateKey: process.env.PRIVATE_KEY,
    accountName: process.env.ACCOUNT_NAME,
    permissionName: process.env.PERMISSION_NAME,
    dbPath: process.env.DATABASE_PATH,
    chain: {
        id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
        url: "https://wax.pink.gg",
    }
};

// Session WAX
const walletPlugin = new WalletPluginPrivateKey(config.privateKey);
const session = new Session({
    actor: config.accountName,
    permission: config.permissionName,
    chain: config.chain,
    walletPlugin,
});

// Fonctions utilitaires
function log(message) {
    console.log(`🔄 ${message}`);
}

function success(message) {
    console.log(`✅ ${message}`);
}

function error(message, err) {
    console.error(`❌ ${message}`);
    if (err) console.error(err.message);
}

// Récupérer les données locales
async function getLocalData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(config.dbPath, sqlite3.OPEN_READONLY);
        db.all('SELECT landIds, owner FROM Landowners WHERE active = 1', [], (err, rows) => {
            db.close();
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

// Récupérer les données blockchain
async function getBlockchainData() {
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: config.accountName,
            table: "owners",
            scope: config.accountName,
            json: true,
            limit: 1000,
        }),
    });
    
    const data = await response.json();
    return data.rows.map(row => ({ 
        landId: row.land_ids, 
        owner: row.owner_address 
    }));
}

// Supprimer un land
async function removeLand(owner, landId) {
    const action = {
        account: config.accountName,
        name: 'removeland',
        authorization: [{ actor: config.accountName, permission: config.permissionName }],
        data: { owner, land_id: landId },
    };
    
    const result = await session.transact({ actions: [action] }, { 
        blocksBehind: 3, 
        expireSeconds: 30 
    });
    
    return result;
}

// Nettoyer les doublons
async function cleanDuplicates() {
    log('Nettoyage des doublons...');
    
    const [localData, blockchainData] = await Promise.all([
        getLocalData(),
        getBlockchainData()
    ]);
    
    log(`📊 Données récupérées: ${localData.length} entrées locales, ${blockchainData.length} entrées blockchain`);
    
    // Créer la map des propriétaires corrects
    const correctOwners = new Map();
    for (const item of localData) {
        const landIds = JSON.parse(item.landIds);
        for (const landId of landIds) {
            correctOwners.set(landId, item.owner);
        }
    }
    log(`📋 ${correctOwners.size} propriétaires corrects identifiés`);
    
    // Détecter les doublons
    const landIdToOwners = new Map();
    for (const entry of blockchainData) {
        const landIds = entry.landId || [];
        for (const landId of landIds) {
            if (!landIdToOwners.has(landId)) {
                landIdToOwners.set(landId, new Set());
            }
            landIdToOwners.get(landId).add(entry.owner);
        }
    }
    log(`🔍 ${landIdToOwners.size} lands analysés sur la blockchain`);
    
    // Identifier les doublons
    const duplicates = [];
    for (const [landId, ownersSet] of landIdToOwners) {
        if (ownersSet.size > 1) {
            duplicates.push({
                landId: parseInt(landId),
                owners: Array.from(ownersSet)
            });
        }
    }
    
    if (duplicates.length === 0) {
        success('✅ Aucun doublon détecté');
        return 0;
    }
    
    log(`⚠️  ${duplicates.length} doublons détectés:`);
    duplicates.forEach(dup => {
        log(`   LandId ${dup.landId}: ${dup.owners.join(', ')}`);
    });
    
    // Identifier et corriger les doublons
    let suppressions = 0;
    let errors = 0;
    
    for (const duplicate of duplicates) {
        const { landId, owners } = duplicate;
        const correctOwner = correctOwners.get(landId);
        
        log(`🔧 Traitement LandId ${landId}:`);
        log(`   Propriétaires actuels: ${owners.join(', ')}`);
        log(`   Propriétaire correct: ${correctOwner || 'Non trouvé'}`);
        
        if (correctOwner) {
            for (const owner of owners) {
                if (owner !== correctOwner) {
                    try {
                        log(`   🗑️  Suppression de ${owner} pour LandId ${landId}...`);
                        await removeLand(owner, landId);
                        suppressions++;
                        success(`   ✅ LandId ${landId} supprimé pour ${owner}`);
                    } catch (err) {
                        errors++;
                        error(`   ❌ Erreur suppression LandId ${landId} pour ${owner}`, err);
                    }
                } else {
                    log(`   ✅ ${owner} est le propriétaire correct, conservation`);
                }
            }
        } else {
            log(`   ⚠️  Aucun propriétaire correct trouvé pour LandId ${landId}`);
            // Garder le premier propriétaire, supprimer les autres
            for (let i = 1; i < owners.length; i++) {
                try {
                    log(`   🗑️  Suppression de ${owners[i]} pour LandId ${landId}...`);
                    await removeLand(owners[i], landId);
                    suppressions++;
                    success(`   ✅ LandId ${landId} supprimé pour ${owners[i]}`);
                } catch (err) {
                    errors++;
                    error(`   ❌ Erreur suppression LandId ${landId} pour ${owners[i]}`, err);
                }
            }
        }
    }
    
    success(`🎉 Nettoyage terminé: ${suppressions} suppressions, ${errors} erreurs`);
    return suppressions;
}

// Fonction principale
async function main() {
    const startTime = Date.now();
    
    try {
        log('🚀 Début de la synchronisation des propriétaires de lands');
        
        // Nettoyer les doublons
        const suppressions = await cleanDuplicates();
        
        if (suppressions > 0) {
            log('⏳ Attente de stabilisation de la blockchain...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            log('✅ Stabilisation terminée');
        }
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        success(`🎉 Synchronisation terminée en ${duration}s`);
        
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        error(`💥 Erreur lors de la synchronisation après ${duration}s`, err);
        process.exit(1);
    }
}

// Exécution
if (require.main === module) {
    main();
}

module.exports = { main, cleanDuplicates };
