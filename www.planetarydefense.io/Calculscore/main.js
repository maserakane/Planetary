const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { fetchOwnersForIDs, adress } = require('./fetchData');
const { processLands, fetchAndProcessOwnersData, processAllAddresses } = require('./processData');
const { calculateScore } = require('./calculateScore');
const { getAndAssociatePrices } = require('./fetchPrices');
const { processLandData } = require('./changementowner');
const landIDs = require('./landIDs.json');
const { sendOwnersInBatches, sendPlayersInBatches } = require('./blockchainTransactions');
const { ismemberandowner } = require('./ismemberandowner.js');
const { compareData } = require('./compareownerdatabase.js');
const {
    insertLandowners,
    insertPlayers,
    insertTemplates,
    insertTemplateDetailsIntoDatabase,
    closeDatabase
} = require('./dbInsert');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const dbPath = process.env.DATABASE_PATH;

// Calcule et sauvegarde les scores pour tous les joueurs
async function Playerscore() {
    try {
        const adressplayer = await adress();
        const results = await processAllAddresses(adressplayer);
        const scoresWithoutLandCount = await calculateScore(results);
        await fs.writeFile('./allResults.json', JSON.stringify(scoresWithoutLandCount, null, 2), 'utf8');
    } catch (error) {
        console.error("[Playerscore] Erreur :", error);
    }
}

// Calcule et sauvegarde les scores pour tous les propriétaires de lands
async function Ownerscore() {
    try {
        const pairs = await fetchOwnersForIDs(landIDs);
        const ownersLandData = await processLands(pairs);
        const results = await fetchAndProcessOwnersData(pairs);
        const scoresWithLandCount = await calculateScore(results, ownersLandData);
        await fs.writeFile('./ownerscore.json', JSON.stringify(scoresWithLandCount, null, 2), 'utf8');
    } catch (error) {
        console.error("[Ownerscore] Erreur :", error);
    }
}

// Pipeline principal
async function mainFunction() {
    let db;
    const startTime = Date.now();
    console.log('--- Démarrage du pipeline principal ---');
    try {
        // 1. Nettoyage de la base
        console.log('[1] Nettoyage de la base de données...');
        await compareData();
        console.log('   -> Suppression effectuée avec succès.');

        // 2. Calcul des scores joueurs
        console.log('[2] Calcul des scores joueurs...');
        await Playerscore();
        console.log('   -> Playerscore terminé.');

        // 3. Calcul des scores propriétaires
        console.log('[3] Calcul des scores propriétaires...');
        await Ownerscore();
        console.log('   -> Ownerscore terminé.');

        // 4. Enrichissement des assets avec les prix
        console.log('[4] Enrichissement des assets avec les prix...');
        await getAndAssociatePrices();
        console.log('   -> Prix associés.');

        // 5. Lecture des résultats JSON
        const playerData = JSON.parse(await fs.readFile('./allResults.json', 'utf8'));
        const ownerData = JSON.parse(await fs.readFile('./ownerscore.json', 'utf8'));

        // 6. Connexion à la base SQLite
        console.log('[5] Connexion à la base de données...');
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erreur de connexion à la base :', err);
                return;
            }
            console.log('   -> Connecté à la base de données.');
        });

        // 7. Insertion des détails de templates
        await insertTemplateDetailsIntoDatabase(db);
        console.log('   -> Détails de templates insérés.');

        // 8. Insertion des propriétaires
        await insertLandowners(db, ownerData);
        console.log('   -> Propriétaires insérés.');

        // 9. Insertion des joueurs
        await insertPlayers(db, playerData);
        console.log('   -> Joueurs insérés.');

        // 10. Insertion des templates (fusion joueurs/propriétaires)
        await insertTemplates(db, ownerData, playerData);
        console.log('   -> Templates insérés.');

        // 11. Envoi des scores sur la blockchain
        console.log('[6] Envoi des scores sur la blockchain...');
        await sendOwnersInBatches(ownerData);
        console.log('   -> Scores propriétaires envoyés sur la blockchain.');
        await sendPlayersInBatches(playerData);
        console.log('   -> Scores joueurs envoyés sur la blockchain.');

        // 12. Vérification des membres/propriétaires sur la blockchain
        console.log('[7] Vérification membres/propriétaires blockchain...');
        await ismemberandowner();

        // 13. Synchronisation des propriétaires de lands
        console.log('[8] Synchronisation des propriétaires de lands...');
        await processLandData();

        // 14. Mise à jour du timestamp de dernière exécution
        const updatetime = Date.now();
        const lastUpdate = (updatetime / 1000).toFixed(0);
        await db.run(`UPDATE config SET last_update = ?`, [lastUpdate]);
        console.log('   -> Timestamp de dernière exécution mis à jour.');

    } catch (error) {
        console.error('[mainFunction] Erreur globale :', error);
    } finally {
        if (db) {
            try {
                console.log('Fermeture de la connexion à la base...');
                await closeDatabase(db);
                console.log('   -> Connexion fermée.');
            } catch (err) {
                console.error('Erreur lors de la fermeture de la base :', err);
            }
        }
        const endTime = Date.now();
        const executionTime = (endTime - startTime) / 1000;
        console.log(`--- Pipeline terminé en ${executionTime} secondes ---`);
    }
}

if (require.main === module) {
    mainFunction();
}
