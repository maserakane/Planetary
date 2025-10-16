const sqlite3 = require('sqlite3').verbose();

// Path to your SQLite database file
const dbPath = 'planetary.db';

// Connect to the database
let db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        return;
    }
    console.log('Connected to the database.');
});

// Update all 'progress' values from 0 to 1 in the 'html' table
const updateProgressQuery = `UPDATE html SET progress = NULL WHERE progress = 0`;

db.run(updateProgressQuery, function(err) {
    if (err) {
        return console.error('Error updating progress:', err.message);
    }
    console.log(`Rows updated: ${this.changes}`);
});

// Close the database connection
db.close((err) => {
    if (err) {
        console.error('Error closing the database:', err.message);
        return;
    }
    console.log('Database connection closed.');
});
