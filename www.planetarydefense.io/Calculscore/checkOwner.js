// checkOwner.js
// Script pour vérifier si un owner donné possède des lands dans la base locale SQLite

const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const dbPath = process.env.DATABASE_PATH;
const ownerToCheck = process.argv[2] || 'pimpampumwas';

function getLandIdsForOwnerLocal(owner) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });
        db.all('SELECT landIds FROM Landowners WHERE owner = ?', [owner], (err, rows) => {
            db.close();
            if (err) return reject(err);
            let allLandIds = [];
            rows.forEach(row => {
                try {
                    const ids = JSON.parse(row.landIds);
                    allLandIds = allLandIds.concat(ids);
                } catch (e) {
                    // Ignore parse errors
                }
            });
            resolve(allLandIds);
        });
    });
}

function getOwnersForLandId(landId) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
            if (err) return reject(err);
        });
        db.all('SELECT owner FROM Landowners WHERE landIds LIKE ?', [`%${landId}%`], (err, rows) => {
            db.close();
            if (err) return reject(err);
            const owners = rows.map(row => row.owner);
            resolve(owners);
        });
    });
}

(async () => {
    try {
        console.log(`Recherche des lands pour le propriétaire (base locale) : ${ownerToCheck}`);
        const landIds = await getLandIdsForOwnerLocal(ownerToCheck);
        if (landIds.length > 0) {
            console.log(`Le propriétaire ${ownerToCheck} possède les landIds suivants dans la base locale :`);
            console.log(landIds);
            for (const landId of landIds) {
                const owners = await getOwnersForLandId(landId);
                if (owners.length > 1) {
                    console.log(`ATTENTION : Le landId ${landId} est possédé par plusieurs propriétaires dans la base locale : ${owners.join(', ')}`);
                } else {
                    console.log(`Le landId ${landId} n'est possédé que par ${owners[0]} dans la base locale.`);
                }
            }
        } else {
            console.log(`Aucun landId trouvé pour le propriétaire ${ownerToCheck} dans la base locale.`);
        }
    } catch (err) {
        console.error('Erreur lors de la vérification :', err);
    }
})(); 