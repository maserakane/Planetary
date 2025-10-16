const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { body, validationResult } = require('express-validator');
const upload = multer();
const { checkAuth } = require('../server');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../images');
        fs.mkdirSync(uploadPath, { recursive: true }); // Crée le dossier s'il n'existe pas
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname)); // Renomme le fichier avec un timestamp
    }
});

const imageUpload = multer({ storage });

const uploadAttack = multer({
    dest: path.join(__dirname, '../images'),
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('attackImage');

const uploadDefense = multer({
    dest: path.join(__dirname, '../images'),
    limits: { fileSize: 10 * 1024 * 1024 }
}).single('defenseImage');

router.get('/', checkAuth, (req, res) => {
    console.log("bien recu");
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

function getImagesFromContent(htmlContent) {
    const regex = /<img[^>]+src="([^">]+)"/g;
    let matches;
    const images = [];
    while (matches = regex.exec(htmlContent)) {
        images.push(matches[1]);
    }
    return images;
}

function getMissingFields(fields) {
    return Object.keys(fields).filter(key => !fields[key]);
}

function validateAttackData(req, res, next) {
    body('attackTitleSite').isString().notEmpty().run(req);
    body('attackTitleOnchain').isString().notEmpty().run(req);
    body('attackText').isString().notEmpty().run(req);
    body('attackTarget').isInt({ min: 1 }).run(req);
    body('attackRewards').matches(/^\d{1,11}\.\d{4} TLM$/).run(req);
    body('attackDifficulty').isString().notEmpty().run(req);
    body('attackStartDate').isInt().run(req);
    body('attackEndDate').isInt().run(req);
    body('Planet').isString().notEmpty().run(req);
  	body('attackShards').matches(/^\d{1,11}\.\d{4} Shards$/).run(req);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}

function validateDefenseData(req, res, next) {
    body('defenseTitleSite').isString().notEmpty().run(req);
    body('defenseTitleOnchain').isString().notEmpty().run(req);
    body('defenseText').isString().notEmpty().run(req);
    body('defenseTarget').isInt({ min: 1 }).run(req);
    body('defenseRewards').matches(/^\d{1,11}\.\d{4} TLM$/).run(req);
    body('defenseStartDate').isInt().run(req);
    body('defenseEndDate').isInt().run(req);
    body('Planet').isString().notEmpty().run(req); // Ajout de la validation du champ Planet
	body('defenseShards').matches(/^\d{1,11}\.\d{4} Shards$/).run(req);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}


router.post('/update-attack', checkAuth, uploadAttack, validateAttackData, (req, res) => {
    const image = req.file;
    const fields = {
        attackTitleSite: req.body.attackTitleSite,
        attackTitleOnchain: req.body.attackTitleOnchain,
        attackText: req.body.attackText,
        attackTarget: req.body.attackTarget,
        attackRewards: req.body.attackRewards,
        attackDifficulty: req.body.attackDifficulty,
        attackStartDate: req.body.attackStartDate,
        attackEndDate: req.body.attackEndDate,
        Planet: req.body.Planet, // Ajout du champ Planet
        attackShards: req.body.attackShards
    };

    const missingFields = getMissingFields({ ...fields, attackImage: image });

    if (missingFields.length > 0) {
        return res.status(400).json({ error: `Tous les champs sont requis. Champs manquants: ${missingFields.join(', ')}` });
    }

    const newFilename = `${Date.now()}-${image.originalname}`;
    const newPath = path.join(__dirname, '../images', newFilename);

    fs.rename(image.path, newPath, (err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors du déplacement de l\'image.' });
        }

        db.run("INSERT INTO html (attackimg, attacktext, attackTitleSite, attackTitleOnchain, attackTarget, attackRewards, attackDifficulty, attackStartDate, attackEndDate, Planet, attackShards) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
            [newFilename, fields.attackText, fields.attackTitleSite, fields.attackTitleOnchain, fields.attackTarget, fields.attackRewards, fields.attackDifficulty, fields.attackStartDate, fields.attackEndDate, fields.Planet, fields.attackShards], 
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement des données.' });
                }
                res.json({ message: 'Données d\'attaque mises à jour avec succès.' });
            });
    });
});

router.post('/update-defense', checkAuth, uploadDefense, validateDefenseData, (req, res) => {
    const image = req.file;
    const fields = {
        defenseTitleSite: req.body.defenseTitleSite,
        defenseTitleOnchain: req.body.defenseTitleOnchain,
        defenseText: req.body.defenseText,
        defenseTarget: req.body.defenseTarget,
        defenseRewards: req.body.defenseRewards,
        defenseStartDate: req.body.defenseStartDate,
        defenseEndDate: req.body.defenseEndDate,
        Planet: req.body.Planet,
        defenseShards: req.body.defenseShards
    };

    const missingFields = getMissingFields({ ...fields, defenseImage: image });

    if (missingFields.length > 0) {
        console.error(`Champs manquants: ${missingFields.join(', ')}`);
        return res.status(400).json({ error: `Tous les champs sont requis. Champs manquants: ${missingFields.join(', ')}` });
    }

    const newFilename = `${Date.now()}-${image.originalname}`;
    const newPath = path.join(__dirname, '../images', newFilename);

    fs.rename(image.path, newPath, (err) => {
        if (err) {
            console.error('Erreur lors du déplacement de l\'image:', err);
            return res.status(500).json({ error: 'Erreur lors du déplacement de l\'image.' });
        }

        const sql = "INSERT INTO html (defenseimg, defensetext, defenseTitleSite, defenseTarget, defenseRewards, defenseStartDate, defenseEndDate, Planet, defenseTitleOnchain, defenseShards) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        const params = [newFilename, fields.defenseText, fields.defenseTitleSite, fields.defenseTarget, fields.defenseRewards, fields.defenseStartDate, fields.defenseEndDate, fields.Planet, fields.defenseTitleOnchain, fields.defenseShards];
        
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Erreur lors de l\'enregistrement des données:', err);
                return res.status(500).json({ error: 'Erreur lors de l\'enregistrement des données.' });
            }
            res.json({ message: 'Données de défense mises à jour avec succès.' });
        });
    });
});



router.get('/data', checkAuth, (req, res) => {
    db.all("SELECT * FROM html ORDER BY id DESC", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(rows);
    });
});

// Route pour supprimer une attaque
router.delete('/delete-attack/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT attackimg FROM html WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération de l\'image.' });
        }
        if (row && row.attackimg) {
            fs.unlink(path.join(__dirname, '../images', row.attackimg), (err) => {
                if (err) {
                    console.error('Erreur lors de la suppression de l\'image:', err);
                    return res.status(500).json({ error: 'Erreur lors de la suppression de l\'image.' });
                }

                db.run("DELETE FROM html WHERE id = ?", [id], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur lors de la suppression des données.' });
                    }
                    res.json({ message: 'Données d\'attaque supprimées avec succès.' });
                });
            });
        } else {
            db.run("DELETE FROM html WHERE id = ?", [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de la suppression des données.' });
                }
                res.json({ message: 'Données d\'attaque supprimées avec succès.' });
            });
        }
    });
});

// Route pour supprimer une défense
router.delete('/delete-defense/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT defenseimg FROM html WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération de l\'image.' });
        }
        if (row && row.defenseimg) {
            fs.unlink(path.join(__dirname, '../images', row.defenseimg), (err) => {
                if (err) {
                    console.error('Erreur lors de la suppression de l\'image:', err);
                    return res.status(500).json({ error: 'Erreur lors de la suppression de l\'image.' });
                }

                db.run("DELETE FROM html WHERE id = ?", [id], function(err) {
                    if (err) {
                        return res.status(500).json({ error: 'Erreur lors de la suppression des données.' });
                    }
                    res.json({ message: 'Données de défense supprimées avec succès.' });
                });
            });
        } else {
            db.run("DELETE FROM html WHERE id = ?", [id], function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de la suppression des données.' });
                }
                res.json({ message: 'Données de défense supprimées avec succès.' });
            });
        }
    });
});

router.get('/data-attack/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM html WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(row);
    });
});

router.get('/data-defense/:id', checkAuth, (req, res) => {
    const id = req.params.id;
    db.get("SELECT * FROM html WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(row);
    });
});

router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la déconnexion.' });
        }
        res.clearCookie('connect.sid', { path: '/' });
        res.json({ message: 'Déconnexion réussie.' });
    });
});

// News
router.post('/update-news', upload.none(), (req, res) => {
    const { newsContent } = req.body;

    console.log('Données reçues:', req.body); // Log pour vérifier les données reçues par le serveur

    if (!newsContent || newsContent.trim() === '') {
        console.error('Erreur: Le contenu des news est vide.');
        return res.status(400).json({ error: 'Le contenu des news ne doit pas être vide.' });
    }

    const dateUTC = Math.floor(Date.now() / 1000);

    db.run(
        `INSERT INTO News (newsfeed, date) VALUES (?, ?)`,
        [newsContent, dateUTC],
        function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion des données:', err);
                return res.status(500).json({ error: 'Erreur lors de l\'insertion des données.' });
            }
            res.status(200).json({ success: 'Les données ont été mises à jour avec succès.' });
        }
    );
});

router.get('/data-news', (req, res) => {
    db.all(`SELECT * FROM News`, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.status(200).json(rows);
    });
});

router.delete('/delete-news/:id', (req, res) => {
    const { id } = req.params;

    // Récupérer la news avant de la supprimer pour obtenir les chemins des images
    db.get(`SELECT * FROM News WHERE id = ?`, [id], (err, row) => {
        if (err) {
            console.error('Erreur lors de la récupération des données:', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }

        if (!row) {
            return res.status(404).json({ error: 'News non trouvée.' });
        }

        // Supposons que les chemins des images soient dans `row.newsfeed`
        const images = getImagesFromContent(row.newsfeed);

        // Supprimer la news de la base de données
        db.run(`DELETE FROM News WHERE id = ?`, id, function(err) {
            if (err) {
                console.error('Erreur lors de la suppression de la news:', err);
                return res.status(500).json({ error: 'Erreur lors de la suppression de la news.' });
            }

            // Supprimer les fichiers images
            images.forEach(image => {
                const imagePath = path.join(__dirname, '..', image);
                fs.unlink(imagePath, (err) => {
                    if (err) {
                        console.error('Erreur lors de la suppression de l\'image:', err);
                    }
                });
            });

            res.status(200).json({ success: 'La donnée a été supprimée avec succès.' });
        });
    });
});

router.post('/upload-image', imageUpload.single('upload'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier uploadé.' });
    }

    const file = req.file;
    const filePath = path.join(__dirname, '../images', file.filename);

    res.status(200).json({
        url: `/images/${file.filename}` // L'URL pour accéder à l'image
    });
});

// Route pour sélectionner les lignes de la table 'Lore'
router.get('/lore', (req, res) => {
    db.all("SELECT * FROM Lore", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(rows);
    });
});

// Route pour sélectionner une ligne de la table 'Lore' par ID
router.get('/lore/:id', (req, res) => {
    const { id } = req.params;
    db.get("SELECT * FROM Lore WHERE id = ?", [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(row);
    });
});

// Route pour modifier une ligne de la table 'Lore'
router.put('/lore/:id', (req, res) => {
    const { id } = req.params;
    const { page, titre, lore_html, section } = req.body;

    if (!page || !titre || !lore_html || !section) {
        return res.status(400).json({ error: 'Tous les champs doivent être remplis.' });
    }

    db.run(`UPDATE Lore SET page = ?, titre = ?, lore_html = ?, valide = 0, section = ? WHERE id = ?`,
        [page, titre, lore_html, section, id], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la mise à jour des données.' });
            }
            res.json({ message: 'Données mises à jour avec succès.' });
        });
});

// Route pour supprimer une ligne de la table 'Lore'
router.delete('/lore/:id', (req, res) => {
    const { id } = req.params;

    db.run("DELETE FROM Lore WHERE id = ?", id, function (err) {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la suppression des données.' });
        }
        res.json({ message: 'Données supprimées avec succès.' });
    });
});

// Route pour valider une page
router.put('/lore/validate/:id', (req, res) => {
    const { id } = req.params;

    db.run("UPDATE Lore SET valide = 1 WHERE id = ?", id, function (err) {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la validation de la page.' });
        }
        res.json({ message: 'Page validée avec succès.' });
    });
});

router.post('/lore', (req, res) => {
    const { page, titre, lore_html, section } = req.body;

    if (!page || !titre || !lore_html || !section) {
        return res.status(400).json({ error: 'Tous les champs doivent être remplis.' });
    }

    db.run(`INSERT INTO Lore (page, titre, lore_html, valide, section) VALUES (?, ?, ?, 0, ?)`,
        [page, titre, lore_html, section], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de l\'insertion des données.' });
            }
            res.json({ message: 'Données insérées avec succès.' });
        });
});

// Routes pour les produits
router.post('/products', checkAuth, imageUpload.single('image'), (req, res) => {
    const { title, description, price, section } = req.body;
    const image = req.file;

    if (!title || !description || !price || !section) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    const imagePath = image ? `/images/products/${image.filename}` : null;

    db.run(
        `INSERT INTO products (title, description, price, section, image) VALUES (?, ?, ?, ?, ?)`,
        [title, description, price, section, imagePath],
        function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion du produit:', err);
                return res.status(500).json({ error: 'Erreur lors de l\'insertion du produit.' });
            }
            res.json({ message: 'Produit ajouté avec succès.', id: this.lastID });
        }
    );
});

router.put('/products/:id', checkAuth, imageUpload.single('image'), (req, res) => {
    const { id } = req.params;
    const { title, description, price, section } = req.body;
    const image = req.file;

    if (!title || !description || !price || !section) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    // Récupérer l'ancienne image si elle existe
    db.get('SELECT image FROM products WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération du produit.' });
        }

        const imagePath = image ? `/images/products/${image.filename}` : row.image;

        // Si une nouvelle image est uploadée, supprimer l'ancienne
        if (image && row.image) {
            const oldImagePath = path.join(__dirname, '..', row.image);
            fs.unlink(oldImagePath, (err) => {
                if (err) console.error('Erreur lors de la suppression de l\'ancienne image:', err);
            });
        }

        db.run(
            `UPDATE products SET title = ?, description = ?, price = ?, section = ?, image = ? WHERE id = ?`,
            [title, description, price, section, imagePath, id],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Erreur lors de la mise à jour du produit.' });
                }
                res.json({ message: 'Produit mis à jour avec succès.' });
            }
        );
    });
});

router.delete('/products/:id', checkAuth, (req, res) => {
    const { id } = req.params;

    // Récupérer l'image avant de supprimer le produit
    db.get('SELECT image FROM products WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération du produit.' });
        }

        // Supprimer l'image si elle existe
        if (row && row.image) {
            const imagePath = path.join(__dirname, '..', row.image);
            fs.unlink(imagePath, (err) => {
                if (err) console.error('Erreur lors de la suppression de l\'image:', err);
            });
        }

        // Supprimer le produit
        db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la suppression du produit.' });
            }
            res.json({ message: 'Produit supprimé avec succès.' });
        });
    });
});

// Routes pour les dev logs
router.post('/dev-logs', checkAuth, (req, res) => {
    const { title, content, tags } = req.body;

    if (!title || !content || !tags) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    const tagsJson = JSON.stringify(tags);

    db.run(
        `INSERT INTO dev_logs (title, content, tags) VALUES (?, ?, ?)`,
        [title, content, tagsJson],
        function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion du dev log:', err);
                return res.status(500).json({ error: 'Erreur lors de l\'insertion du dev log.' });
            }
            res.json({ message: 'Dev log ajouté avec succès.', id: this.lastID });
        }
    );
});

router.put('/dev-logs/:id', checkAuth, (req, res) => {
    const { id } = req.params;
    const { title, content, tags } = req.body;

    if (!title || !content || !tags) {
        return res.status(400).json({ error: 'Tous les champs sont requis.' });
    }

    const tagsJson = JSON.stringify(tags);

    db.run(
        `UPDATE dev_logs SET title = ?, content = ?, tags = ? WHERE id = ?`,
        [title, content, tagsJson, id],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Erreur lors de la mise à jour du dev log.' });
            }
            res.json({ message: 'Dev log mis à jour avec succès.' });
        }
    );
});

router.delete('/dev-logs/:id', checkAuth, (req, res) => {
    const { id } = req.params;

    db.run('DELETE FROM dev_logs WHERE id = ?', [id], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la suppression du dev log.' });
        }
        res.json({ message: 'Dev log supprimé avec succès.' });
    });
});

// Route API pour récupérer les produits avec pagination
router.get('/products', (req, res) => {
    // Définir le header Content-Type
    res.setHeader('Content-Type', 'application/json');
    
    const { section, page = 1, limit = 6 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM products';
    let params = [];
    
    if (section) {
        query += ' WHERE section = ?';
        params.push(section);
    }
    
    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);
    
    // D'abord, compter le nombre total de produits
    let countQuery = 'SELECT COUNT(*) as total FROM products';
    if (section) {
        countQuery += ' WHERE section = ?';
    }
    
    db.get(countQuery, section ? [section] : [], (err, result) => {
        if (err) {
            console.error('Erreur lors du comptage des produits:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Erreur lors du comptage des produits.' 
            });
        }
        
        const totalProducts = result.total;
        const totalPages = Math.ceil(totalProducts / limit);
        
        // Ensuite, récupérer les produits pour la page demandée
        db.all(query, params, (err, products) => {
            if (err) {
                console.error('Erreur lors de la récupération des produits:', err);
                return res.status(500).json({ 
                    success: false,
                    error: 'Erreur lors de la récupération des produits.' 
                });
            }
            
            res.json({
                success: true,
                products,
                currentPage: parseInt(page),
                totalPages,
                totalProducts
            });
        });
    });
});

// Route API pour récupérer les dev logs avec pagination
router.get('/dev-logs', (req, res) => {
    // Définir le header Content-Type
    res.setHeader('Content-Type', 'application/json');
    
    const { page = 1, limit = 6 } = req.query;
    const offset = (page - 1) * limit;
    
    // D'abord, compter le nombre total de dev logs
    db.get('SELECT COUNT(*) as total FROM dev_logs', [], (err, result) => {
        if (err) {
            console.error('Erreur lors du comptage des dev logs:', err);
            return res.status(500).json({ 
                success: false,
                error: 'Erreur lors du comptage des dev logs.' 
            });
        }
        
        const totalLogs = result.total;
        const totalPages = Math.ceil(totalLogs / limit);
        
        // Ensuite, récupérer les dev logs pour la page demandée
        db.all(
            'SELECT * FROM dev_logs ORDER BY date DESC LIMIT ? OFFSET ?',
            [parseInt(limit), offset],
            (err, logs) => {
                if (err) {
                    console.error('Erreur lors de la récupération des dev logs:', err);
                    return res.status(500).json({ 
                        success: false,
                        error: 'Erreur lors de la récupération des dev logs.' 
                    });
                }
                
                // Convertir les tags JSON en tableau
                logs.forEach(log => {
                    try {
                        log.tags = JSON.parse(log.tags);
                    } catch (e) {
                        log.tags = [];
                    }
                });
                
                res.json({
                    success: true,
                    logs,
                    currentPage: parseInt(page),
                    totalPages,
                    totalLogs
                });
            }
        );
    });
});

module.exports = router;