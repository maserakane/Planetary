const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'www.planetarydefense.io/.env') });

const dbPath = process.env.DATABASE_PATH;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                return reject(err);
            }
            resolve(db);
        });
    });
}

function updateNullProgressToZero(db) {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE html SET progress = 0 WHERE progress IS NULL`;
        db.run(sql, function (err) {
            if (err) {
                return reject(err);
            }
            console.log(`Rows updated: ${this.changes}`);
            resolve(this.changes);
        });
    });
}

async function main() {
    try {
        const db = await openDatabase();
        const rowsUpdated = await updateNullProgressToZero(db);
        console.log(`Updated ${rowsUpdated} rows where progress was NULL.`);
        db.close();
        console.log("Database closed.");
    } catch (error) {
        console.error("Error updating mission data:", error);
    }
}

main();
