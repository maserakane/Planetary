const express = require('express');
const router = express.Router();
const path = require('path');

// Endpoint pour servir la page index
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Endpoint pour gérer les soumissions de formulaire depuis index.html
router.post('/save-data', (req, res) => {
    const { field1, field2 } = req.body; // Remplacer par les champs de votre formulaire

    // Insérer les données dans la base de données
    const stmt = db.prepare("INSERT INTO mytable (field1, field2) VALUES (?, ?)"); // Remplacer par votre table et champs
    stmt.run(field1, field2, (err) => {
        if (err) {
            return res.status(500).send('Erreur lors de l\'enregistrement des données.');
        }
        res.send('Données enregistrées avec succès.');
    });
    stmt.finalize();
});

module.exports = router;
