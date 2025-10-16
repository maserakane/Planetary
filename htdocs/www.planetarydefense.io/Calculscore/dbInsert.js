// dbInsert.js
// Fonctions d'insertion et de vérification pour la base SQLite

const path = require('path');
const fs = require('fs').promises;

const templateDetailsPath = path.join(__dirname, 'enriched_assets.json');

function transformTemplateData(data) {
    return data.map(record => {
        const templateCounts = {
            crews: {},
            faces: {},
            arms: {},
            lands: {},
            warlords: {},
            mercenaries: {}
        };
        (record.templates || []).forEach(template => {
            
            switch (template.type) {
                case 'crew':
                    templateCounts.crews[template.template_id] = template.count;
                    break;
                case 'faces':
                    templateCounts.faces[template.template_id] = template.count;
                    break;
                case 'arms':
                    templateCounts.arms[template.template_id] = template.count;
                    break;
                case 'land':
                    templateCounts.lands[template.template_id] = template.count;
                    break;
                case 'warlord':
                    templateCounts.warlords[template.template_id] = template.count;
                    break;
                case 'mercenary':
                    templateCounts.mercenaries[template.template_id] = template.count;
                    break;
            }
        });
        return {
            owner: record.owner,
            crews: JSON.stringify(templateCounts.crews),
            faces: JSON.stringify(templateCounts.faces),
            arms: JSON.stringify(templateCounts.arms),
            lands: JSON.stringify(templateCounts.lands),
            warlords: JSON.stringify(templateCounts.warlords),
            mercenaries: JSON.stringify(templateCounts.mercenaries)
        };
    });
}

async function insertLandowners(db, ownerData) {
    const insertQuery = `
        INSERT INTO Landowners (owner, totalSlots, totalDefense, totalAttack, totalAttackArm, totalDefenseArm, totalMoveCost, totalArm, totalCrew, landCount, landIds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const updateQuery = `
        UPDATE Landowners SET
            totalSlots = ?, totalDefense = ?, totalAttack = ?, totalAttackArm = ?, totalDefenseArm = ?, 
            totalMoveCost = ?, totalArm = ?, totalCrew = ?, landCount = ?, landIds = ?
        WHERE owner = ?
    `;
    for (const record of ownerData) {
        const ownerExists = await checkIfOwnerExists(db, record.owner);
        const values = [
            record.totalSlots,
            record.defenseScores.totalDefense,
            record.defenseScores.totalAttack,
            record.defenseScores.totalAttackArm,
            record.defenseScores.totalDefenseArm,
            record.defenseScores.totalMoveCost,
            record.totalArm,
            record.totalCrew,
            record.landCount || 0,
            JSON.stringify(record.landIds || [])
        ];
        if (ownerExists) {
            await runQuery(db, updateQuery, [...values, record.owner]);
        } else {
            await runQuery(db, insertQuery, [record.owner, ...values]);
        }
    }
}

async function checkIfOwnerExists(db, owner) {
    const query = 'SELECT COUNT(1) AS count FROM Landowners WHERE owner = ?';
    return new Promise((resolve, reject) => {
        db.get(query, [owner], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

async function insertPlayers(db, playerData) {
    const insertQuery = `
        INSERT INTO Players (owner, totalSlots, totalDefense, totalAttack, totalAttackArm, totalDefenseArm, totalMoveCost, totalArm, totalCrew)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const updateQuery = `
        UPDATE Players SET
            totalSlots = ?, totalDefense = ?, totalAttack = ?, totalAttackArm = ?, totalDefenseArm = ?, 
            totalMoveCost = ?, totalArm = ?, totalCrew = ?
        WHERE owner = ?
    `;
    const deleteDuplicatesQuery = `
        DELETE FROM Players 
        WHERE owner = ? AND rowid NOT IN (
            SELECT MIN(rowid) FROM Players WHERE owner = ?
        )
    `;
    const deleteNullRowsQuery = `
        DELETE FROM Players 
        WHERE owner IS NULL OR totalSlots IS NULL OR totalDefense IS NULL 
            OR totalAttack IS NULL OR totalAttackArm IS NULL 
            OR totalDefenseArm IS NULL OR totalMoveCost IS NULL 
            OR totalArm IS NULL OR totalCrew IS NULL
    `;
    await runQuery(db, deleteNullRowsQuery);
    for (const record of playerData) {
        const playerExists = await checkIfPlayerExists(db, record.owner);
        const values = [
            record.totalSlots,
            record.defenseScores.totalDefense,
            record.defenseScores.totalAttack,
            record.defenseScores.totalAttackArm,
            record.defenseScores.totalDefenseArm,
            record.defenseScores.totalMoveCost,
            record.totalArm,
            record.totalCrew
        ];
        if (playerExists) {
            await runQuery(db, deleteDuplicatesQuery, [record.owner, record.owner]);
            await runQuery(db, updateQuery, [...values, record.owner]);
        } else {
            await runQuery(db, insertQuery, [record.owner, ...values]);
        }
    }
}

async function checkIfPlayerExists(db, owner) {
    const query = 'SELECT COUNT(1) AS count FROM Players WHERE owner = ?';
    return new Promise((resolve, reject) => {
        db.get(query, [owner], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

// Vérifier et créer la contrainte UNIQUE sur la colonne owner
async function ensureUniqueConstraint(db) {
    return new Promise((resolve, reject) => {
        // Vérifier si la contrainte UNIQUE existe déjà
        db.all("PRAGMA index_list(templates)", (err, indexes) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Chercher un index unique sur la colonne owner
            const hasUniqueOwner = indexes.some(index => 
                index.unique === 1 && index.name.includes('owner')
            );
            
            if (hasUniqueOwner) {
                //console.log('✅ Contrainte UNIQUE sur owner existe déjà');
                resolve();
                return;
            }
            
            // Créer un index unique sur la colonne owner
            const createIndexQuery = `CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_owner_unique ON templates(owner)`;
            //console.log('🔧 Création de la contrainte UNIQUE sur owner...');
            
            db.run(createIndexQuery, (err) => {
                if (err) {
                    console.error('❌ Erreur lors de la création de la contrainte UNIQUE:', err);
                    reject(err);
                } else {
                    //console.log('✅ Contrainte UNIQUE sur owner créée avec succès');
                    resolve();
                }
            });
        });
    });
}

// Vérifier et créer les colonnes warlords et mercenaries si elles n'existent pas
async function ensureTemplateColumns(db) {
    return new Promise((resolve, reject) => {
        // Vérifier si la colonne warlords existe
        db.get("PRAGMA table_info(templates)", (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            
            // Récupérer toutes les colonnes de la table templates
            db.all("PRAGMA table_info(templates)", (err, columns) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                const columnNames = columns.map(col => col.name);
                const columnsToAdd = [];
                
                // Vérifier si warlords existe
                if (!columnNames.includes('warlords')) {
                    columnsToAdd.push('ADD COLUMN warlords TEXT DEFAULT "{}"');
                }
                
                // Vérifier si mercenaries existe
                if (!columnNames.includes('mercenaries')) {
                    columnsToAdd.push('ADD COLUMN mercenaries TEXT DEFAULT "{}"');
                }
                
                // Ajouter les colonnes manquantes
                if (columnsToAdd.length > 0) {
                    const alterQuery = `ALTER TABLE templates ${columnsToAdd.join(', ')}`;
                    //console.log(`🔧 Ajout des colonnes manquantes: ${columnsToAdd.join(', ')}`);
                    
                    db.run(alterQuery, (err) => {
                        if (err) {
                            console.error('❌ Erreur lors de l\'ajout des colonnes:', err);
                            reject(err);
                        } else {
                            //console.log('✅ Colonnes ajoutées avec succès');
                            resolve();
                        }
                    });
                } else {
                    //console.log('✅ Toutes les colonnes existent déjà');
                    resolve();
                }
            });
        });
    });
}

async function insertTemplates(db, ownerData, playerData) {
    // Vérifier et créer les colonnes warlords et mercenaries si elles n'existent pas
    await ensureTemplateColumns(db);
    
    // Vérifier si la contrainte UNIQUE existe sur owner, sinon la créer
    await ensureUniqueConstraint(db);
    
    // Utiliser UPSERT avec vérification d'existence pour éviter les doublons
    const upsertQuery = `
        INSERT INTO templates (owner, crews, faces, arms, lands, warlords, mercenaries)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner) DO UPDATE SET
            crews = excluded.crews,
            faces = excluded.faces,
            arms = excluded.arms,
            lands = excluded.lands,
            warlords = excluded.warlords,
            mercenaries = excluded.mercenaries
    `;
    
    let transformedOwnerData = transformTemplateData(ownerData);
    let transformedPlayerData = transformTemplateData(playerData);
    
    // Fusionner les données en évitant les doublons par owner
    const ownerMap = new Map();
    
    // Traiter d'abord les ownerData
    transformedOwnerData.forEach(record => {
        ownerMap.set(record.owner, record);
    });
    
    // Traiter ensuite les playerData (écrase les ownerData si même owner)
    transformedPlayerData.forEach(record => {
        ownerMap.set(record.owner, record);
    });
    
    const allData = Array.from(ownerMap.values());
    
    for (const record of allData) {
        const values = [
            record.owner,
            record.crews || "{}",
            record.faces || "{}",
            record.arms || "{}",
            record.lands || "{}",
            record.warlords || "{}",
            record.mercenaries || "{}"
        ];
        
        // UPSERT évite les doublons en mettant à jour l'enregistrement existant
        await runQuery(db, upsertQuery, values);
    }
}

async function checkIfTemplateOwnerExists(db, owner) {
    const query = 'SELECT COUNT(1) AS count FROM templates WHERE owner = ?';
    return new Promise((resolve, reject) => {
        db.get(query, [owner], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

async function insertTemplateDetailsIntoDatabase(db) {
    try {
        // Insérer les templates d'Alien Worlds (format existant)
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        const insertQuery = `
            INSERT INTO templateDetails (
                schema, template_id, img, name, race, shine, attack, cardid, rarity, backimg, defense,
                element, movecost, description, affinity, artifact_type, level, key, process, type,
                ease, luck, delay, difficulty, class, score, price
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const updateQuery = `
            UPDATE templateDetails SET
                schema = ?, img = ?, name = ?, race = ?, shine = ?, attack = ?, cardid = ?, rarity = ?, backimg = ?,
                defense = ?, element = ?, movecost = ?, description = ?, affinity = ?, artifact_type = ?, level = ?, key = ?,
                process = ?, type = ?, ease = ?, luck = ?, delay = ?, difficulty = ?, class = ?, score = ?, price = ?
            WHERE template_id = ?
        `;
        for (const detail of templateDetails) {
            const attrs = detail.attributes || {};
            const templateExists = await checkIfTemplateExists(db, detail.template_id);
            const values = [
                detail.schema || null,
                attrs.img || null,
                attrs.name || null,
                attrs.race || null,
                attrs.shine || null,
                (attrs.attack !== undefined ? attrs.attack : null),
                attrs.cardid || null,
                attrs.rarity || null,
                attrs.backimg || null,
                (attrs.defense !== undefined ? attrs.defense : null),
                attrs.element || null,
                attrs.movecost || null,
                attrs.description || null,
                attrs.affinity || null,
                attrs.artifact_type || null,
                attrs.level || null,
                attrs.key || null,
                attrs.process || null,
                attrs.type || null,
                (attrs.ease !== undefined ? attrs.ease : null),
                (attrs.luck !== undefined ? attrs.luck : null),
                (attrs.delay !== undefined ? attrs.delay : null),
                (attrs.difficulty !== undefined ? attrs.difficulty : null),
                attrs.class || null,
                detail.score || null,
                detail.listing_price || null
            ];
            if (templateExists) {
                await runQuery(db, updateQuery, [...values, detail.template_id]);
            } else {
                await runQuery(db, insertQuery, [detail.schema_name || detail.schema, detail.template_id, ...values]);
            }
        }
        
        // Insérer les templates de planetarydefnft (nouveau format)
        const planetaryDefenseTemplatesPath = path.join(__dirname, 'planetarydefense_templates.json');
        try {
            const planetaryDefenseContent = await fs.readFile(planetaryDefenseTemplatesPath, 'utf-8');
            const planetaryDefenseData = JSON.parse(planetaryDefenseContent);
            
            const templates = planetaryDefenseData.templates || [];
            console.log(`🔄 [insertTemplateDetailsIntoDatabase] Insertion de ${templates.length} templates planetarydefnft`);
            
            for (const template of templates) {
                const templateExists = await checkIfTemplateExists(db, template.template_id);
                const values = [
                    template.schema_name || 'unknown',
                    template.template_id || null, // template_id
                    template.img || null, // img est le hash IPFS
                    template.name || null,
                    null, // race (pas disponible pour planetarydefnft)
                    template.shine || null,
                    template.attack || null,
                    null, // cardid (pas disponible pour planetarydefnft)
                    template.rarity || null,
                    null, // backimg (pas disponible pour planetarydefnft)
                    template.defense || null,
                    null, // element (pas disponible pour planetarydefnft)
                    template.movecost || null,
                    template.description || null,
                    null, // affinity (pas disponible pour planetarydefnft)
                    null, // artifact_type (pas disponible pour planetarydefnft)
                    null, // level (pas disponible pour planetarydefnft)
                    null, // key (pas disponible pour planetarydefnft)
                    null, // process (pas disponible pour planetarydefnft)
                    null, // type (pas disponible pour planetarydefnft)
                    null, // ease (pas disponible pour planetarydefnft)
                    null, // luck (pas disponible pour planetarydefnft)
                    null, // delay (pas disponible pour planetarydefnft)
                    null, // difficulty (pas disponible pour planetarydefnft)
                    null, // class (pas disponible pour planetarydefnft)
                    null, // score (pas disponible pour planetarydefnft)
                    null, // price (pas disponible pour planetarydefnft)
                ];
                
                if (templateExists) {
                    await runQuery(db, updateQuery, [...values, template.template_id]);
                } else {
                    await runQuery(db, insertQuery, values);
                }
            }
            
            console.log(`✅ [insertTemplateDetailsIntoDatabase] Templates planetarydefnft insérés avec succès`);
            
        } catch (error) {
            console.warn(`⚠️  [insertTemplateDetailsIntoDatabase] Fichier planetarydefense_templates.json non trouvé ou erreur: ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ [insertTemplateDetailsIntoDatabase] Erreur lors de l\'insertion des templates:', error);
    }
}

async function checkIfTemplateExists(db, template_id) {
    const query = 'SELECT COUNT(1) AS count FROM templateDetails WHERE template_id = ?';
    return new Promise((resolve, reject) => {
        db.get(query, [template_id], (err, row) => {
            if (err) reject(err);
            else resolve(row.count > 0);
        });
    });
}

async function runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function (err) {
            if (err) reject(err);
            else resolve(this.lastID);
        });
    });
}

async function closeDatabase(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                console.error('Error closing the database:', err);
                return reject(err);
            }
            resolve();
        });
    });
}

module.exports = {
    transformTemplateData,
    insertLandowners,
    insertPlayers,
    insertTemplates,
    insertTemplateDetailsIntoDatabase,
    closeDatabase
};
