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
            lands: {}
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
            }
        });
        return {
            owner: record.owner,
            crews: JSON.stringify(templateCounts.crews),
            faces: JSON.stringify(templateCounts.faces),
            arms: JSON.stringify(templateCounts.arms),
            lands: JSON.stringify(templateCounts.lands)
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
        if (!record.owner) {
            console.warn('[insertLandowners] Donnée avec owner null :', JSON.stringify(record, null, 2));
            continue;
        }

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

async function insertTemplates(db, ownerData, playerData) {
    const insertQuery = `
        INSERT INTO templates (owner, crews, faces, arms, lands)
        VALUES (?, ?, ?, ?, ?)
    `;
    const updateQuery = `
        UPDATE templates SET crews = ?, faces = ?, arms = ?, lands = ?
        WHERE owner = ?
    `;
    let transformedOwnerData = transformTemplateData(ownerData);
    let transformedPlayerData = transformTemplateData(playerData);
    const allData = [...transformedOwnerData, ...transformedPlayerData];
    for (const record of allData) {
        const ownerExists = await checkIfTemplateOwnerExists(db, record.owner);
        const values = [
            record.crews || "{}",
            record.faces || "{}",
            record.arms || "{}",
            record.lands || "{}"
        ];
        if (ownerExists) {
            await runQuery(db, updateQuery, [...values, record.owner]);
        } else {
            await runQuery(db, insertQuery, [record.owner, ...values]);
        }
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
        const templateDetailsContent = await fs.readFile(templateDetailsPath, 'utf-8');
        const templateDetails = JSON.parse(templateDetailsContent);
        const insertQuery = `
            INSERT INTO templateDetails (
                schema, template_id, img, name, race, shine, attack, cardid, rarity, backimg, defense,
                element, movecost, description, affinity, artifact_type, level, key, process, type,
                ease, luck, delay, difficulty, class, score, price
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                detail.schema,
                detail.attributes.img || null,
                detail.attributes.name || null,
                detail.attributes.race || null,
                detail.attributes.shine || null,
                detail.attributes.attack || null,
                detail.attributes.cardid || null,
                detail.attributes.rarity || null,
                detail.attributes.backimg || null,
                detail.attributes.defense || null,
                detail.attributes.element || null,
                detail.attributes.movecost || null,
                detail.attributes.description || null,
                detail.attributes.affinity || null,
                detail.attributes.artifact_type || null,
                detail.attributes.level || null,
                detail.attributes.key || null,
                detail.attributes.process || null,
                detail.attributes.type || null,
                detail.attributes.ease || null,
                detail.attributes.luck || null,
                detail.attributes.delay || null,
                detail.attributes.difficulty || null,
                detail.attributes.class || null,
                detail.score || null,
                detail.listing_price || null
            ];
            if (templateExists) {
                await runQuery(db, updateQuery, [...values, detail.template_id]);
            } else {
                await runQuery(db, insertQuery, [detail.schema, detail.template_id, ...values]);
            }
        }
    } catch (error) {
        console.error('Error inserting or updating template details:', error);
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
    insertLandowners,
    insertPlayers,
    insertTemplates,
    insertTemplateDetailsIntoDatabase,
    closeDatabase
};
