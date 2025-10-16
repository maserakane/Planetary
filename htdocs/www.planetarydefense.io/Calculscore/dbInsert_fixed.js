// dbInsert_fixed.js
// Version corrigée de dbInsert.js avec la fonction insertTemplateDetailsIntoDatabase réparée

const fs = require('fs').promises;
const path = require('path');

const templateDetailsPath = path.join(__dirname, 'enriched_assets.json');

async function runQuery(db, query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

async function checkIfTemplateExists(db, template_id) {
    const query = 'SELECT COUNT(1) AS count FROM templateDetails WHERE template_id = ?';
    return new Promise((resolve, reject) => {
        db.get(query, [template_id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row.count > 0);
            }
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
            const templateExists = await checkIfTemplateExists(db, detail.template_id);
            const values = [
                detail.schema_name || detail.schema, // Utiliser schema_name en priorité
                detail.img || null,
                detail.name || null,
                detail.race || null,
                detail.shine || null,
                detail.attack || null,
                detail.cardid || null,
                detail.rarity || null,
                detail.backimg || null,
                detail.defense || null,
                detail.element || null,
                detail.movecost || null,
                detail.description || null,
                detail.affinity || null,
                detail.artifact_type || null,
                detail.level || null,
                detail.key || null,
                detail.process || null,
                detail.type || null,
                detail.ease || null,
                detail.luck || null,
                detail.delay || null,
                detail.difficulty || null,
                detail.class || null,
                detail.score || null,
                detail.listing_price || null
            ];
            if (templateExists) {
                await runQuery(db, updateQuery, [...values, detail.template_id]);
            } else {
                await runQuery(db, insertQuery, [detail.schema_name || detail.schema, detail.template_id, ...values]);
            }
        }
        
        // Insérer les templates de planetarydefnft (nouveau format) - VERSION CORRIGÉE
        const planetaryDefenseTemplatesPath = path.join(__dirname, 'planetarydefense_templates.json');
        try {
            const planetaryDefenseContent = await fs.readFile(planetaryDefenseTemplatesPath, 'utf-8');
            const planetaryDefenseData = JSON.parse(planetaryDefenseContent);
            
            const templates = planetaryDefenseData.templates || [];
            console.log(`🔄 [insertTemplateDetailsIntoDatabase] Insertion de ${templates.length} templates planetarydefnft`);
            
            // Requête simplifiée pour éviter l'erreur de colonnes
            const simpleInsertQuery = `
                INSERT OR REPLACE INTO templateDetails 
                (template_id, name, schema, rarity, shine, img, attack, defense, movecost, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const template of templates) {
                try {
                    await new Promise((resolve, reject) => {
                        db.run(simpleInsertQuery, [
                            template.template_id,
                            template.name,
                            template.schema_name,
                            template.rarity,
                            template.shine,
                            template.img,
                            template.attack || 0,
                            template.defense || 0,
                            template.movecost || 0,
                            template.description || ''
                        ], function(err) {
                            if (err) {
                                console.error(`❌ Erreur pour ${template.name}:`, err.message);
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error(`❌ Erreur lors de l'insertion de ${template.name}:`, error.message);
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

module.exports = {
    insertTemplateDetailsIntoDatabase
};
