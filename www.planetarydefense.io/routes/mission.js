const express = require('express');
//const jwt = require('jsonwebtoken');
const path = require('path');
const router = express.Router();
const db = require('../db');
//const verifyToken = require('../middlewares/verifyToken');

router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/mission.html'));
});
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/leaderboard.html'));
});

//require('dotenv').config();
//const secretKey = process.env.SECRET_KEY;

//router.post('/generate-token', (req, res) => {
//    const { userAccount } = req.body;

//    if (!userAccount) {
//        return res.status(400).json({ error: 'userAccount is required' });
//    }

//    const token = jwt.sign({ userAccount }, secretKey, { expiresIn: '10y' });
//    res.json({ token });
//});

// Route pour récupérer toutes les informations des Players
router.get('/update-time', (req, res) => {
    db.all('SELECT * FROM config', (err, rows) => {
        if (err) {
            console.error('Error fetching data from Config:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Config' });
        } else {
            res.json(rows);
        }
    });
});

router.post('/update-last-check', (req, res) => {
    const { lastUpdate } = req.body;
    db.run('UPDATE config SET last_update_check = ?', [lastUpdate], function(err) {
        if (err) {
            console.error('Error updating last_update_check:', err.message);
            res.status(500).json({ error: 'Failed to update last_update_check' });
        } else {
            res.json({ success: true });
        }
    });
});

router.get('/planet-data', (req, res) => {
    const planetName = req.query.userPlanet; // Récupère le paramètre userPlanet depuis la requête

    if (!planetName) {
        return res.status(400).json({ error: 'Missing userPlanet parameter' });
    }

    db.get('SELECT * FROM Planet WHERE Name = ?', [planetName], (err, row) => {
        if (err) {
            console.error('Error fetching data from Planet:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Planet' });
        } else if (!row) {
            res.status(404).json({ error: 'No data found for the given planet' });
        } else {
            res.json(row);
        }
    });
});

router.get('/data/:owner', (req, res) => {
    const owner = req.params.owner;
    db.get('SELECT * FROM Landowners WHERE owner = ?', [owner], (err, row) => {
        if (err) {
            console.error('Error fetching data from Landowners:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Landowners' });
        } else if (!row) {
            res.status(404).json({ error: 'No data found for the given owner' });
        } else {
            res.json(row);
        }
    });
});


router.get('/players/:owner', (req, res) => {
    const owner = req.params.owner;
    db.get('SELECT * FROM Players WHERE owner = ?', [owner], (err, row) => {
        if (err) {
            console.error('Error fetching data from Players:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Players' });
        } else if (!row) {
            res.status(404).json({ error: 'No data found for the given owner' });
        } else {
            res.json(row);
        }
    });
});

router.get('/data', (req, res) => {
    db.all('SELECT * FROM Landowners', (err, rows) => {
        if (err) {
            console.error('Error fetching data from Landowners:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Landowners' });
        } else {
            res.json(rows);
        }
    });
});

// Route pour récupérer toutes les informations des Players
router.get('/players', (req, res) => {
    db.all('SELECT * FROM Players', (err, rows) => {
        if (err) {
            console.error('Error fetching data from Players:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Players' });
        } else {
            res.json(rows);
        }
    });
});
router.get('/mission-data', async (req, res) => {
    try {
        const data = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM html WHERE progress = 0", [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const attack = rows.find(row => row.attackTitleSite);
                    const defense = rows.find(row => row.defenseTitleSite);

                    let data = {};

                    if (!attack) {
                        db.get("SELECT * FROM html WHERE attackTitleOnchain IS NOT NULL AND progress = 1 ORDER BY id DESC LIMIT 1", [], (err, row) => {
                            if (err) {
                                reject(err);
                            } else {
                                data.attack = row ? {
                                    ...row,
                                    attackTextV: '<b>Victory</b><br><br><br>Mission accomplished! <br><br>Congratulations, mercenaries, you will receive a bonus worthy of your feats. <br><br>But before returning to combat, don’t forget to regain your strength by drinking a RedBoar! <br><br>RedBoar Gives You (Fire) Wings!',
                                    attackTextD: '<b>Defeat</b><br><br><br>Mercenaries, you have failed. <br><br>The forces deployed were insufficient to prevail. <br><br>Perhaps it is time to enhance your power? Hurry over to our partner Sword and Shield Ltd.<br><br>Sword and Shield Ltd, our expertise serving your security needs.',
                                    attackImgV: 'default_attack_imgv.webp',
                                    attackImgD: 'default_attack_imgd.webp'
                                } : {
                                    attackTitleSite: 'Wait For Next Mission.',
                                    attacktext: 'Wait For Next Mission.',
                                    attackimg: 'attack.webp',
                                    attackTextV: 'Wait For Next Mission.',
                                    attackTextD: 'Wait For Next Mission.',
                                    attackImgV: 'attack-arm.png',
                                    attackImgD: 'attack-arm1.png'
                                };
                                checkAndResolveDefense();
                            }
                        });
                    } else {
                        data.attack = {
                            ...attack,
                            attackTextV: '<b>Victory</b><br><br><br>Mission accomplished! <br><br>Congratulations, mercenaries, you will receive a bonus worthy of your feats. <br><br>But before returning to combat, don’t forget to regain your strength by drinking a RedBoar! <br><br>RedBoar Gives You (Fire) Wings!',
                            attackTextD: '<b>Defeat</b><br><br><br>Mercenaries, you have failed. <br><br>The forces deployed were insufficient to prevail. <br><br>Perhaps it is time to enhance your power? Hurry over to our partner Sword and Shield Ltd.<br><br>Sword and Shield Ltd, our expertise serving your security needs.',
                            attackImgV: 'default_attack_imgv.webp',
                            attackImgD: 'default_attack_imgd.webp'
                        };
                        checkAndResolveDefense();
                    }

                    function checkAndResolveDefense() {
                        if (!defense) {
                            db.get("SELECT * FROM html WHERE defenseTarget IS NOT NULL AND progress = 1 ORDER BY id DESC LIMIT 1", [], (err, row) => {
                                if (err) {
                                    reject(err);
                                } else {
                                    data.defense = row ? {
                                        ...row,
                                        defensetextV: '<b>Victory</b><br><br><br>Victory, mercenaries! <br><br>You have successfully defended this territory! <br><br>It is now time to claim your pay and enjoy a well-deserved rest at our Lava Lux hotel.<br><br>Be cooler with Lava Lux!<br>A Galactic resort hotel.',
                                        defensetextD: '<b>Defeat</b><br><br><br>Unfortunately, this territory could not be defended. <br><br>Mercenaries, if you are reading this, it means you have survived the battle. <br><br>It’s time to strengthen the defenses… or find an employer who can lead you to victory! <br><br>Don’t miss the next issue of Merch Today to learn about the best plans. <br><br>Merch Today, by mercenaries, for mercenaries.',
                                        defenseimgV: 'default_defense_imgv.webp',
                                        defenseimgD: 'default_defense_imgd.webp'
                                    } : {
                                        defenseTitleSite: 'Wait For Next Mission',
                                        defensetext: 'Wait For Next Mission.',
                                        defenseimg: 'defense.webp'
                                    };
                                    resolve(data);
                                }
                            });
                        } else {
                            data.defense = {
                                ...defense,
                                defensetextV: '<b>Victory</b><br><br><br>Victory, mercenaries! <br><br>You have successfully defended this territory! <br><br>It is now time to claim your pay and enjoy a well-deserved rest at our Lava Lux hotel.<br><br>Be cooler with Lava Lux!<br>A Galactic resort hotel.',
                                defensetextD: '<b>Defeat</b><br><br><br>Unfortunately, this territory could not be defended. <br><br>Mercenaries, if you are reading this, it means you have survived the battle. <br><br>It’s time to strengthen the defenses… or find an employer who can lead you to victory! <br><br>Don’t miss the next issue of Merch Today to learn about the best plans. <br><br>Merch Today, by mercenaries, for mercenaries.',
                                defenseimgV: 'default_defense_imgv.webp',
                                defenseimgD: 'default_defense_imgd.webp'
                            };
                            resolve(data);
                        }
                    }
                }
            });
        });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
});

router.get('/mission-data-futur', async (req, res) => {
    try {
        const data = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM html WHERE progress IS NULL", [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    let data = {
                        attack: [],
                        defense: []
                    };

                    rows.forEach(row => {
                        if (row.attackTitleSite) {
                            data.attack.push(row);
                        }
                        if (row.defenseTitleSite) {
                            data.defense.push(row);
                        }
                    });

                    resolve(data);
                }
            });
        });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
});

router.get('/mission-data-all-defense', async (req, res) => {
    try {
        const data = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM html", [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    let data = {
                        defense: []
                    };

                    rows.forEach(row => {
                        if (row.defenseTitleSite) {
                            data.defense.push(row);
                        }
                    });

                    resolve(data);
                }
            });
        });

        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.json(data);
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
    }
});

router.get('/news-feed', (req, res) => {
    db.all(`SELECT * FROM News ORDER BY date DESC`, [], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des données:', err);
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.status(200).json(rows);
    });
});

router.post('/live-defense', (req, res) => {
    const owners = req.body.owners;
	console.log(req.body);
    if (!owners || !Array.isArray(owners) || owners.length === 0) {
        console.error('La liste des owners est vide ou manquante.');
        return res.status(400).json({ error: 'La liste des owners est vide ou manquante.' });
    }

    const ownerAddresses = owners.map(owner => owner.owner_address);
    const totalDefenseScores = owners.reduce((acc, owner) => {
        acc[owner.owner_address] = owner.total_defense_score;
        return acc;
    }, {});

    const placeholders = ownerAddresses.map(() => '?').join(',');
    const query = `SELECT owner, landCount FROM Landowners WHERE owner IN (${placeholders})`;

    db.all(query, ownerAddresses, (err, rows) => {
        if (err) {
            console.error('Database error while fetching landCounts:', err.message);
            return res.status(500).json({ error: err.message });
        }

        const defenseTarget = req.body.defenseTarget;  // Ajoutez cette ligne pour obtenir defenseTarget du client
        let totalLandCount = 0;
        const results = rows.map(row => {
            const targetDefense = defenseTarget;
            const landCountDefenseTarget = targetDefense * row.landCount;
            const meetsTarget = totalDefenseScores[row.owner] >= landCountDefenseTarget;

            if (meetsTarget) {
                totalLandCount += row.landCount;
            }

            return {
                owner: row.owner,
                landCount: row.landCount,
                targetDefense: targetDefense,
                landCountDefenseTarget: landCountDefenseTarget,
                meetsTarget: meetsTarget
            };
        });

        res.json({ totalLandCount, results });
    });
});

// Route pour sélectionner les lignes de la table 'Lore'
router.get('/lore', (req, res) => {
    db.all("SELECT * FROM Lore WHERE section = 'Lore'", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(rows);
    });
});

// Route pour sélectionner les lignes de la table 'Lore'
router.get('/monstre', (req, res) => {
    db.all("SELECT * FROM Lore WHERE section = 'Monstre'", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(rows);
    });
});

// Route pour sélectionner les lignes de la table 'Lore'
router.get('/indexlibrary', (req, res) => {
    db.all("SELECT * FROM Lore WHERE section = 'Index'", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        }
        res.json(rows);
    });
});

router.get('/user-templates', (req, res) => {
    const userAccount = req.query.userAccount;
    const query = `SELECT * FROM templates WHERE owner = ?`;
    db.all(query, [userAccount], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

router.get('/template-details', (req, res) => {
    const templateIds = req.query.templateIds.split(',');
    const query = `SELECT * FROM templateDetails WHERE template_id IN (${templateIds.map(() => '?').join(',')})`;
    db.all(query, templateIds, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// Définir les valeurs autorisées pour le "schema" afin de sécuriser la route
const allowedSchemas = [
  'tool.worlds', 'arms.worlds', 'crew.worlds',
  'faces.worlds', 'items.worlds', 'land.worlds'
];

// Route pour récupérer les données en fonction du "schema"
router.get('/get-schema', (req, res) => {
  const schema = req.query.schema;

  // Vérifier si la valeur de "schema" est autorisée
  if (!allowedSchemas.includes(schema)) {
    return res.status(400).json({ error: 'Schéma invalide.' });
  }

  // Préparer et exécuter la requête SQL
  db.all('SELECT * FROM templateDetails WHERE schema = ?', [schema], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Erreur interne du serveur.' });
    }
    res.json(rows);
  });
});

// Route pour vérifier le statut de la whitelist
router.post('/check-whitelist-warlord', (req, res) => {
    const { warlord } = req.body;

    db.get('SELECT * FROM Landowners WHERE owner = ?', [warlord], (err, row) => {
        if (err) {
            console.error('Error checking whitelist status:', err);
            return res.status(500).json({ error: 'Failed to check whitelist status' });
        }

        if (row) {
            return res.json({ isWhitelisted: row.active === 1 });
        } else {
            return res.json({ isWhitelisted: false });
        }
    });
});

// Fonction pour ajouter la colonne "active" si elle n'existe pas
function addColumnIfNotExists(db, tableName, columnName, columnDefinition) {
    return new Promise((resolve, reject) => {
        // Vérification de l'existence de la colonne via PRAGMA table_info
        db.all(`PRAGMA table_info(${tableName});`, (err, columns) => {
            if (err) {
                return reject(err);
            }

            const columnExists = columns.some(col => col.name === columnName);
            if (columnExists) {
                console.log(`Column "${columnName}" already exists in table "${tableName}".`);
                return resolve(); // La colonne existe déjà, rien à faire
            }

            // Si la colonne n'existe pas, on l'ajoute
            const alterTableQuery = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`;
            db.run(alterTableQuery, (err) => {
                if (err) {
                    return reject(err);
                }
                console.log(`Column "${columnName}" added to table "${tableName}".`);
                resolve();
            });
        });
    });
}

// Route pour mettre à jour l'utilisateur dans la whitelist
router.post('/whitlist-warlord', async (req, res) => {
    const { warlord, active } = req.body;

    try {
        // Ajouter la colonne "active" si elle n'existe pas
        await addColumnIfNotExists(db, 'Landowners', 'active', 'INTEGER DEFAULT 0');

        // Mise à jour de la colonne "active" dans la table "Landowners"
        db.run('UPDATE Landowners SET active = ? WHERE owner = ?', [active, warlord], function(err) {
            if (err) {
                console.error('Error updating whitelist status:', err);
                return res.status(500).json({ error: 'Failed to update whitelist' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ message: 'User not found in the whitelist' });
            }

            return res.json({ message: 'Whitelist status updated successfully' });
        });
    } catch (error) {
        console.error('Error checking or adding column:', error);
        return res.status(500).json({ error: 'Failed to check or add column' });
    }
});


// Route pour récupérer tous les landowners avec active = 1
router.post('/check-landowner-status', (req, res) => {
    db.all('SELECT owner, active FROM Landowners WHERE active = 1', [], (err, rows) => {
        if (err) {
            console.error('Error fetching landowners:', err);
            return res.status(500).json({ error: 'Failed to fetch landowner status' });
        }

        const landowners = {};
        rows.forEach(row => {
            landowners[row.owner] = row.active;  // Stocke owner et son statut actif dans un objet
        });

        return res.json({ landowners });
    });
});

// Route pour récupérer tous les landowners avec active = 1
router.get('/check-landowner-status', (req, res) => {
    db.all('SELECT owner, active FROM Landowners WHERE active = 1', [], (err, rows) => {
        if (err) {
            console.error('Error fetching landowners:', err);
            return res.status(500).json({ error: 'Failed to fetch landowner status' });
        }

        const landowners = {};
        rows.forEach(row => {
            landowners[row.owner] = row.active;  // Stocke owner et son statut actif dans un objet
        });

        return res.json({ landowners });
    });
});

// Proposal
// Route pour récupérer les données des Warlords
router.post('/warlord', (req, res) => {
    const warlord = req.body.warlord;
    if (!warlord) {
        return res.status(400).json({ error: 'Le champ "warlord" est requis.' });
    }

    const query = `SELECT * FROM requests WHERE warlord = ?`;
    db.all(query, [warlord], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        } else {
            res.json(rows);
        }
    });
});

// Route pour récupérer les données des Players
router.post('/player', (req, res) => {
    const player = req.body.player;
    if (!player) {
        return res.status(400).json({ error: 'Le champ "player" est requis.' });
    }

    const query = `SELECT * FROM requests WHERE player = ?`;
    db.all(query, [player], (err, rows) => {
        if (err) {
            console.error(err.message);
            res.status(500).json({ error: 'Erreur lors de la récupération des données.' });
        } else {
            res.json(rows);
        }
    });
});

router.get('/multipleplayers', (req, res) => {
    const owners = req.query.owners ? req.query.owners.split(',') : [];
    if (owners.length === 0) {
        return res.status(400).json({ error: 'No owners provided in the query string' });
    }

    const placeholders = owners.map(() => '?').join(','); // Génère ?,?,?,...
    const query = `SELECT * FROM Players WHERE owner IN (${placeholders})`;

    db.all(query, owners, (err, rows) => {
        if (err) {
            console.error('Error fetching data from Players:', err.message);
            res.status(500).json({ error: 'Failed to retrieve data from Players' });
        } else {
            res.json(rows);
        }
    });
});

router.post('/update-proposal', (req, res) => {
    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
        console.error('Données invalides reçues.');
        return res.status(400).json({ error: 'Invalid or missing updates array' });
    }

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const stmt = db.prepare(`
            INSERT INTO requests (request_id, player, warlord, status, request_time, expiration_time)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(request_id) DO UPDATE SET
                player = excluded.player,
                warlord = excluded.warlord,
                status = excluded.status,
                request_time = excluded.request_time,
                expiration_time = excluded.expiration_time
        `);

        let hasError = false;

        for (const update of updates) {
            const { request_id, player, warlord, status, request_time, expiration_time } = update;

            if (!request_id || !player || !warlord || !status || !request_time || !expiration_time) {
                console.error('Données invalides pour cette mise à jour :', update);
                hasError = true;
                break;
            }

            stmt.run(
                request_id,
                player,
                warlord,
                status,
                request_time,
                expiration_time,
                function (err) {
                    if (err) {
                        console.error(`Erreur SQL pour request_id ${request_id}:`, err.message);
                        hasError = true;
                    } else {
                        console.log(`Requête exécutée pour request_id ${request_id}, lignes affectées: ${this.changes}`);
                    }
                }
            );
        }

        stmt.finalize();

        if (hasError) {
            db.run('ROLLBACK', () => {
                console.error('Transaction annulée.');
                res.status(500).json({ error: 'Failed to upsert one or more requests' });
            });
        } else {
            db.run('COMMIT', () => {
                console.log('Transaction réussie.');
                res.json({ success: true });
            });
        }
    });
});

router.get('/expired-pending-requests', (req, res) => {
    const now = new Date().toISOString(); // Obtient la date actuelle au format UTC ISO

    const query = `
        SELECT *
        FROM requests
        WHERE expiration_time < ?
          AND status = 'pending'
    `;

    db.all(query, [now], (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des requêtes expirées:', err.message);
            return res.status(500).json({ error: 'Erreur lors de la récupération des requêtes expirées.' });
        }

        res.json(rows);
    });
});
module.exports = router;
