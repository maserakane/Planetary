const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Charge les variables d'environnement depuis le même dossier

const sqlite3 = require('sqlite3').verbose();

// Charger le chemin de la base de données depuis les variables d'environnement
const dbPath = process.env.DATABASE_PATH;

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erreur lors de la connexion à la base de données:", err.message);
    } else {
        console.log("Connecté à la base de données SQLite.");
    }
});

// Fonction pour exécuter la requête de sélection et mise à jour
const updateExpiredRequests = () => {
    // Requête pour sélectionner les enregistrements
    const selectQuery = `
        SELECT *
        FROM requests
        WHERE expiration_time < datetime('now')
          AND status = 'pending';
    `;

    db.all(selectQuery, [], (err, rows) => {
        if (err) {
            console.error("Erreur lors de l'exécution de la requête SELECT:", err.message);
            return;
        }

        if (rows.length === 0) {
            console.log("Aucune requête expirée à mettre à jour.");
            return;
        }

        console.log(`Trouvé ${rows.length} requêtes à mettre à jour.`);

        // Requête pour mettre à jour les enregistrements
        const updateQuery = `
            UPDATE requests
            SET status = 'expired'
            WHERE expiration_time < datetime('now')
              AND status = 'pending';
        `;

        db.run(updateQuery, function (err) {
            if (err) {
                console.error("Erreur lors de l'exécution de la requête UPDATE:", err.message);
            } else {
                console.log(`Mis à jour ${this.changes} requêtes en statut 'expired'.`);
            }
        });
    });
};

// Appeler la fonction pour mettre à jour les requêtes
updateExpiredRequests();

// Fermer la connexion à la base de données après traitement
db.close((err) => {
    if (err) {
        console.error("Erreur lors de la fermeture de la base de données:", err.message);
    } else {
        console.log("Connexion à la base de données SQLite fermée.");
    }
});
