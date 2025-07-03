const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const dbPath = process.env.DATABASE_PATH;;

// Fonction pour récupérer les données SQL
async function fetchSqlData() {
    console.log('Fetching data from SQLite database...');
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) {
                return reject(`Error opening database: ${err.message}`);
            }
        });

        const query = 'SELECT owner FROM Landowners WHERE active = 1'; // Modifiez la requête si nécessaire
        const sqlData = [];

        db.each(query, (err, row) => {
            if (err) {
                return reject(`Error running query: ${err.message}`);
            }
            sqlData.push(row.owner);
        }, (err, count) => {
            db.close();
            if (err) {
                return reject(`Error fetching data: ${err.message}`);
            }
            console.log(`Fetched ${count} rows from SQLite.`);
            resolve(sqlData);
        });
    });
}

// Fonction pour récupérer les données de la blockchain EOSIO
async function fetchBlockchainData() {
    console.log('Fetching owners data from blockchain...');
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            code: 'magordefense',   // Le contrat EOSIO
            table: 'owners',        // Nom de la table
            scope: 'magordefense',  // Portée de la table
            json: true,             // Demande au format JSON
            limit: 1000,            // Nombre maximal de lignes à récupérer
            reverse: false,         // Ordre des résultats
            show_payer: false,      // Ne pas afficher le payeur
        }),
    });

    if (!response.ok) {
        throw new Error(`Erreur lors de la récupération des données blockchain: ${response.statusText}`);
    }

    const data = await response.json();
    return data.rows.map(row => row.owner_address); // Retourne uniquement les propriétaires
}

// Fonction pour supprimer un joueur de SQLite
async function deletePlayerFromSql(owner) {
    console.log(`Deleting player '${owner}' from SQLite...`);
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                return reject(`Error opening database: ${err.message}`);
            }
        });

        const query = 'DELETE FROM Landowners WHERE owner = ?';
        db.run(query, [owner], function (err) {
            db.close();
            if (err) {
                return reject(`Error deleting player '${owner}': ${err.message}`);
            }
            console.log(`Player '${owner}' deleted successfully.`);
            resolve();
        });
    });
}

// Comparaison des deux ensembles de données et suppression des joueurs indésirables
async function compareData() {
    try {
        // Récupération des données SQLite et Blockchain
        const sqlData = await fetchSqlData();
        const blockchainData = await fetchBlockchainData();

        console.log('Comparing data...');

        // Trouver les joueurs présents dans SQLite mais pas dans la blockchain
        const onlyInSql = sqlData.filter(owner => !blockchainData.includes(owner));
        console.log('Players only in SQLite:', onlyInSql);

        // Supprimer les joueurs uniquement présents dans SQLite
        for (const owner of onlyInSql) {
            await deletePlayerFromSql(owner);
        }

        console.log('All unmatched players have been deleted.');
    } catch (error) {
        console.error('Error during comparison:', error);
    }
}

// Exécuter la comparaison
compareData();

module.exports = {
    compareData
};
