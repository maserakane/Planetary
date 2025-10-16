// test_api_direct.js
// Script pour tester l'API directement

const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const app = express();

// Simuler la route /mission/data/:owner
app.get('/mission/data/:owner', (req, res) => {
    const owner = req.params.owner;
    const db = new sqlite3.Database('./planetary.db');
    
    console.log(`🔍 Test de l'API /mission/data/${owner}`);
    
    db.get('SELECT * FROM Landowners WHERE owner = ?', [owner], (err, row) => {
        if (err) {
            console.error('Erreur:', err);
            res.status(500).json({ error: 'Failed to retrieve data from Landowners' });
        } else if (!row) {
            console.log('❌ Aucune donnée trouvée pour cet utilisateur');
            res.status(404).json({ error: 'No data found for the given owner' });
        } else {
            console.log('✅ Données trouvées:');
            console.log('- Total Defense:', row.totalDefense);
            console.log('- Total Attack:', row.totalAttack);
            console.log('- Total Move Cost:', row.totalMoveCost);
            console.log('- Total Slots:', row.totalSlots);
            console.log('- Total Crew:', row.totalCrew);
            console.log('- Total Arm:', row.totalArm);
            
            res.json(row);
        }
        db.close();
    });
});

// Tester avec ffnjw.wam
const testOwner = 'ffnjw.wam';
const request = require('http').request({
    hostname: 'localhost',
    port: 3001,
    path: `/mission/data/${testOwner}`,
    method: 'GET'
}, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });
    res.on('end', () => {
        console.log('\n📊 Réponse de l\'API:');
        console.log(data);
    });
});

request.on('error', (err) => {
    console.error('Erreur de requête:', err);
});

// Démarrer le serveur de test
app.listen(3001, () => {
    console.log('🚀 Serveur de test démarré sur le port 3001');
    console.log(`🔍 Test de l'API pour ${testOwner}...`);
    
    // Faire la requête
    request.end();
});
