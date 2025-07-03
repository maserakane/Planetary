const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const path = require('path');

// Endpoint pour servir la page de connexion
router.get('/', (req, res) => {
    console.log('GET /login - Affichage de la page de connexion');
    // Si l'utilisateur est déjà connecté, rediriger vers /admin
    if (req.session && req.session.user) {
        console.log('Utilisateur déjà connecté, redirection vers /admin');
        return res.redirect('/admin');
    }
    res.sendFile(path.join(__dirname, '../public/login.html'));
});

router.post('/', (req, res) => {
    console.log('\n=== Tentative de connexion ===');
    console.log('Body reçu:', req.body);
    console.log('Session avant:', req.session);
    
    const { username, password } = req.body;
    console.log('Username reçu:', username);

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) {
            console.error('❌ Erreur DB:', err);
            return res.status(500).send('Erreur de serveur.');
        }
    
        if (!row) {
            console.log('❌ Utilisateur non trouvé:', username);
            return res.status(404).send('Utilisateur non trouvé.');
        }

        console.log('✅ Utilisateur trouvé dans la base de données');
        
        if (row && bcrypt.compareSync(password, row.passwordHash)) {
            console.log('✅ Mot de passe correct pour:', username);
            
            // Création de la session
            req.session.user = row.username;
            console.log('Session après création:', req.session);
            
            // Sauvegarde de la session
            req.session.save((err) => {
                if (err) {
                    console.error('❌ Erreur sauvegarde session:', err);
                    return res.status(500).send('Erreur lors de la création de la session.');
                }
                
                console.log('✅ Session sauvegardée avec succès');
                console.log('Session finale:', req.session);
                console.log('Redirection vers /admin');
                
                res.status(302).set('Location', '/admin').end();
            });
        } else {
            console.log('❌ Mot de passe incorrect pour:', username);
            res.status(401).send('Nom d\'utilisateur ou mot de passe incorrect.');
        }
    });
});

module.exports = router;
