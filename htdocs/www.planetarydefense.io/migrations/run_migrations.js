const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Chemin vers la base de données
const dbPath = path.join(__dirname, '..', 'planetary.db');

// Créer une connexion à la base de données
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à la base de données:', err);
        process.exit(1);
    }
    console.log('Connecté à la base de données SQLite');
});

// Lire le fichier de migration
const migrationPath = path.join(__dirname, 'create_supply_ads_tables.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Exécuter les migrations
db.exec(migrationSQL, (err) => {
    if (err) {
        console.error('Erreur lors de l\'exécution des migrations:', err);
        process.exit(1);
    }
    console.log('Migrations exécutées avec succès');
    
    // Fermer la connexion à la base de données
    db.close((err) => {
        if (err) {
            console.error('Erreur lors de la fermeture de la base de données:', err);
            process.exit(1);
        }
        console.log('Connexion à la base de données fermée');
    });
}); 