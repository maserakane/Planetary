console.log('Chargement des modules...');
const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'www.planetarydefense.io/.env') });

console.log('Lecture de la clé privée depuis les variables d\'environnement...');
// Load the private key from environment variables
const privateKey = process.env.PRIVATE_KEY;

if (!privateKey) {
    console.error('La clé privée n\'est pas définie dans les variables d\'environnement.');
    process.exit(1);
}

console.log('Configuration de la blockchain...');
// Configuration for blockchain
const chain = {
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    url: "https://wax.pink.gg",
};
const accountName = "magordefense";
const permissionName = "owner";
const walletPlugin = new WalletPluginPrivateKey(privateKey);

console.log('Création de la session...');
const session = new Session({
    actor: accountName,
    permission: permissionName,
    chain,
    walletPlugin,
});

const dbPath = process.env.DATABASE_PATH;
console.log('Chemin de la base de données :', dbPath);
function openDatabase() {
    console.log('Ouverture de la base de données...');
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Erreur lors de l\'ouverture de la base de données :', err);
                return reject(err);
            }
            console.log('Base de données ouverte avec succès.');
            resolve(db);
        });
    });
}

function fetchDefenseMissions(db) {
    console.log('Récupération des missions de défense depuis la base de données...');
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM html WHERE progress IS NULL AND defenseStartDate <= ?`;
        const currentTimeInSeconds = Math.floor(Date.now() / 1000);
        console.log('Requête SQL :', sql);
        console.log('Paramètre de temps actuel (en secondes) :', currentTimeInSeconds);
        db.all(sql, [currentTimeInSeconds], (err, rows) => {
            if (err) {
                console.error('Erreur lors de la récupération des missions :', err);
                return reject(err);
            }
            console.log('Nombre de missions récupérées :', rows.length);
            resolve(rows);
        });
    });
}

function updateProgress(db, id) {
    console.log(`Mise à jour du progrès pour la mission ID : ${id}`);
    return new Promise((resolve, reject) => {
        const sql = `UPDATE html SET progress = 0 WHERE id = ?`;
        console.log('Requête SQL de mise à jour :', sql);
        db.run(sql, [id], function(err) {
            if (err) {
                console.error(`Erreur lors de la mise à jour du progrès pour la mission ID : ${id}`, err);
                return reject(err);
            }
            console.log(`Progrès mis à jour pour la mission ID : ${id}`);
            resolve();
        });
    });
}

async function sendDefenseMissionsOnChain(db, missions) {
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    console.log(`Heure actuelle en secondes : ${currentTimeInSeconds}`);
    console.log(`Début du traitement des missions de défense...`);
    for (const row of missions) {
        const { id, defenseTitleOnchain, defenseTarget, defenseRewards, defenseStartDate, defenseEndDate, defenseShards } = row;
        console.log(`Traitement de la mission de défense ID : ${id}`);
        // Convert defenseStartDate and defenseEndDate to integers for comparison
        const startDate = parseInt(defenseStartDate);
        const endDate = parseInt(defenseEndDate);
        console.log(`Données de la mission :`, row);
        // Check if defenseStartDate is in the past and all necessary fields are provided
        if (!defenseTitleOnchain || !defenseTarget || !defenseRewards || !startDate || !endDate || !defenseShards) {
            console.log(`Mission ID : ${id} ignorée à cause de données manquantes.`);
            continue;
        }
        if (startDate <= currentTimeInSeconds) {
            try {
                await updateProgress(db, id);
                console.log(`Mission de défense ID : ${id} progrès mis à jour à 0.`);
            } catch (error) {
                console.error(`Erreur lors de la mise à jour du progrès pour la mission ID : ${id}`, error);
            }
        } else {
            console.log(`Mission ID : ${id} ignorée car sa date de début est dans le futur.`);
        }
    }
    console.log('Fin du traitement des missions de défense.');
}

async function main() {
    console.log('Début du script principal...');
    try {
        const db = await openDatabase();
        const missions = await fetchDefenseMissions(db);
        console.log('Missions récupérées :', missions);
        await sendDefenseMissionsOnChain(db, missions);
        db.close();
        console.log("Base de données fermée.");
    } catch (error) {
        console.error("Erreur lors du traitement des données de mission de défense :", error);
    }
    console.log('Fin du script principal.');
}

main();
