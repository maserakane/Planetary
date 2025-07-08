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
        console.log(pairs);
        console.log("Nombre de paires :", pairs.length);
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
    try {
        // 1. Nettoyage de la base
        await compareData();

        // 2. Calcul des scores joueurs
        await Playerscore();

        // 3. Calcul des scores propriétaires
        await Ownerscore();

        // 4. Enrichissement des assets avec les prix
        await getAndAssociatePrices();

        // // 5. Lecture des résultats JSON
        const playerData = JSON.parse(await fs.readFile('./allResults.json', 'utf8'));
        const ownerData = JSON.parse(await fs.readFile('./ownerscore.json', 'utf8'));

        // 6. Connexion à la base SQLite
        db = new sqlite3.Database(dbPath, (err) => {
             if (err) {
                console.error('Erreur de connexion à la base :', err);
                return;
            }
        });

        // 7. Insertion des détails de templates
        await insertTemplateDetailsIntoDatabase(db);

        // 8. Insertion des propriétaires
        await insertLandowners(db, ownerData);

        // 9. Insertion des joueurs
        await insertPlayers(db, playerData);

        // 10. Insertion des templates (fusion joueurs/propriétaires)
        await insertTemplates(db, ownerData, playerData);

        // 11. Envoi des scores sur la blockchain
        await sendOwnersInBatches(ownerData);
        await sendPlayersInBatches(playerData);

        // // 12. Vérification des membres/propriétaires sur la blockchain
        await ismemberandowner();

        // 13. Synchronisation des propriétaires de lands
        await processLandData();

        // 14. Mise à jour du timestamp de dernière exécution
        const updatetime = Date.now();
        const lastUpdate = (updatetime / 1000).toFixed(0);
        await db.run(`UPDATE config SET last_update = ?`, [lastUpdate]);

    } catch (error) {
        console.error('[mainFunction] Erreur globale :', error);
    } finally {
        if (db) {
            try {
                await closeDatabase(db);
            } catch (err) {
                console.error('Erreur lors de la fermeture de la base :', err);
            }
        }
        const endTime = Date.now();
        const executionTime = (endTime - startTime) / 1000;
    }
}

if (require.main === module) {
    mainFunction();
}
