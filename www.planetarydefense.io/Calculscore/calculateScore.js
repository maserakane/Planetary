// calculateScore.js
// Calcul des scores pour chaque joueur ou propriétaire selon leurs assets
// ------------------------------------------------------------
// - Prend en compte la rareté, le shine, les bonus, les slots, etc.
// - Utilisé pour générer les scores dans allResults.json et ownerscore.json
// ------------------------------------------------------------

const fs = require('fs').promises;

// ==================== CONSTANTES DE BONUS ====================
const rarityDefenseBonus = {
    "Abundant": 0,
    "Common": 1,
    "Rare": 3,
    "Epic": 7,
    "Legendary": 25,
    "Mythical": 50
};

const shineBonus = {
    "Stone": 0,
    "Gold": 2,
    "Stardust": 4,
    "Antimatter": 6,
    "XDimension": 8
};

const faceShineBonus = [
    ["Common", [
        { "Gold": 10 },
        { "Stardust": 15 }
    ]],
    ["Rare", [
        { "Gold": 20 },
        { "Stardust": 30 },
        { "Antimatter": 40 },
        { "XDimension": 50 }
    ]],
    ["Epic", [
        { "Gold": 40 },
        { "Stardust": 60 },
        { "Antimatter": 80 },
        { "XDimension": 100 }
    ]],
    ["Legendary", [
        { "Gold": 80 },
        { "Stardust": 120 },
        { "Antimatter": 160 },
        { "XDimension": 200 }
    ]]
];

const faceRarityValues = { "Abundant": 0, "Common": 1, "Rare": 3, "Epic": 7, "Legendary": 25, "Mythic": 50 };
const landRarityValues = { "Common": 5, "Rare": 15, "Epic": 35, "Legendary": 125 };

// ==================== CALCUL DES SLOTS ====================
// Calcule le nombre total de slots disponibles selon les faces et lands
async function calculateSlots(facesList, landWorlds) {
    let totalSlots = 0;
    const calculateTotal = (list, rarityValues, applyShineBonus = false) => {
        list.forEach(item => {
            const rarity = item.details.attributes.rarity || "Abundant";
            const shine = item.details.attributes.shine || "Stone";
            const assets = parseInt(item.assets) || 0;
            let bonus = (rarityValues[rarity] * assets) || 0;
            if (applyShineBonus) {
                const shineValue = shineBonus[shine] || 0;
                bonus *= (1 + shineValue);
            }
            totalSlots += bonus;
        });
    };
    calculateTotal(facesList, faceRarityValues, true); // Bonus shine pour faces
    calculateTotal(landWorlds, landRarityValues); // Pas de bonus shine pour lands
    return totalSlots;
}

// ==================== CALCUL DES BONUS ====================
function calculateBonuses(item) {
    const attack = item.details.attributes.attack || 0;
    const defense = item.details.attributes.defense || 0;
    const rarity = item.details.attributes.rarity || "Abundant";
    const shine = item.details.attributes.shine || "Stone";
    let bonusAttack = attack + (rarityDefenseBonus[rarity] || 0);
    let bonusDefense = defense + (rarityDefenseBonus[rarity] || 0);
    if (rarity === "Abundant") {
        bonusAttack = 1;
        bonusDefense = 1;
    }
    const shineMultiplier = 1 + (shineBonus[shine] || 0);
    bonusAttack *= shineMultiplier;
    bonusDefense *= shineMultiplier;
    return { bonusAttack, bonusDefense };
}

// ==================== CALCUL DES ATTRIBUTS TOTAUX ====================
function calculateTotalAttributes(sortedItems, faceValue, owner, type, slotsUsedByCrew = null) {
    let totalAttack = 0, totalDefense = 0, totalMoveCost = 0;
    let slotsFilled = 0;
    for (const item of sortedItems) {
        if (slotsFilled >= faceValue) break;
        if (slotsUsedByCrew !== null && type === 'Arm' && slotsFilled >= slotsUsedByCrew) break;
        const assets = parseInt(item.assets) || 0;
        const moveCost = item.details.attributes.movecost || 0;
        const { bonusAttack, bonusDefense } = calculateBonuses(item);
        for (let i = 0; i < assets; i++) {
            if (slotsFilled >= faceValue) break;
            if (slotsUsedByCrew !== null && type === 'Arm' && slotsFilled >= slotsUsedByCrew) break;
            totalAttack += bonusAttack;
            totalDefense += bonusDefense;
            totalMoveCost += moveCost;
            slotsFilled++;
        }
    }
    return { totalAttack, totalDefense, totalMoveCost, slotsFilled };
}

// ==================== SCORE D'UNE CARTE ====================
function calculateCardScore(card) {
    let attack = card.details.attributes.attack;
    let defense = card.details.attributes.defense;
    const rarity = card.details.attributes.rarity || "Abundant";
    const shine = card.details.attributes.shine || "Stone";
    if (rarity === "Abundant") {
        attack = 1;
        defense = 1;
    }
    const rarityBonus = rarityDefenseBonus[rarity];
    const shineMultiplier = shineBonus[shine];
    const score = (attack + defense + 2 * rarityBonus) * (1 + shineMultiplier);
    return score;
}

// ==================== CALCUL DE LA DEFENSE ====================
async function defense_score(crew, faceValue, arms, owner) {
    const sortedCrews = crew.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    const sortedArms = arms.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    const crewAttributes = calculateTotalAttributes(sortedCrews, faceValue, owner, 'Crew');
    const armAttributes = calculateTotalAttributes(sortedArms, faceValue, owner, 'Arm', crewAttributes.slotsFilled);
    const attackWithArm = armAttributes.totalAttack + crewAttributes.totalAttack;
    const defenseWithArm = armAttributes.totalDefense + crewAttributes.totalDefense;
    return {
        totalDefense: Math.round(crewAttributes.totalDefense),
        totalAttack: Math.round(crewAttributes.totalAttack),
        totalMoveCost: Math.round(crewAttributes.totalMoveCost),
        totalAttackArm: Math.round(attackWithArm),
        totalDefenseArm: Math.round(defenseWithArm)
    };
}

// ==================== TRAITEMENT DES TEMPLATES ====================
function processTemplateData(world, type, totalSlots, templateData, usedTemplateIds, owner) {
    let slotsUsed = 0;
    const sortedWorld = world.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    for (const item of sortedWorld) {
        if (slotsUsed >= totalSlots) break;
        const templateId = item.template_id;
        let assets = parseInt(item.assets) || 0;
        if (slotsUsed + assets > totalSlots) {
            assets = totalSlots - slotsUsed;
        }
        const assetsToAdd = assets;
        slotsUsed += assetsToAdd;
        const { bonusAttack, bonusDefense } = calculateBonuses(item);
        const totalAttack = bonusAttack * assetsToAdd;
        const totalDefense = bonusDefense * assetsToAdd;
        if (templateData[templateId]) {
            templateData[templateId].count += assetsToAdd;
            templateData[templateId].totalAttack += totalAttack;
            templateData[templateId].totalDefense += totalDefense;
        } else {
            templateData[templateId] = {
                template_id: templateId,
                count: assetsToAdd,
                totalAttack: totalAttack,
                totalDefense: totalDefense,
                type
            };
        }
        if (assetsToAdd > 0) {
            usedTemplateIds.add(templateId);
        }
    }
    return slotsUsed;
}

function processArmsData(armsWorlds, slotsUsedByCrew, totalSlots, templateData, usedTemplateIds, owner) {
    let slotsUsed = 0;
    let armsUsed = 0;
    const sortedArms = armsWorlds.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    for (const item of sortedArms) {
        if (slotsUsed >= totalSlots || armsUsed >= slotsUsedByCrew) break;
        const templateId = item.template_id;
        let assets = parseInt(item.assets) || 0;
        if (slotsUsed + assets > totalSlots) {
            assets = totalSlots - slotsUsed;
        }
        if (armsUsed + assets > slotsUsedByCrew) {
            assets = slotsUsedByCrew - armsUsed;
        }
        const assetsToAdd = assets;
        slotsUsed += assetsToAdd;
        armsUsed += assetsToAdd;
        const { bonusAttack, bonusDefense } = calculateBonuses(item);
        const totalAttack = bonusAttack * assetsToAdd;
        const totalDefense = bonusDefense * assetsToAdd;
        if (templateData[templateId]) {
            templateData[templateId].count += assetsToAdd;
            templateData[templateId].totalAttack += totalAttack;
            templateData[templateId].totalDefense += totalDefense;
        } else {
            templateData[templateId] = {
                template_id: templateId,
                count: assetsToAdd,
                totalAttack: totalAttack,
                totalDefense: totalDefense,
                type: 'arms'
            };
        }
        if (assetsToAdd > 0) {
            usedTemplateIds.add(templateId);
        }
    }
    return { slotsUsed, armsUsed };
}

// ==================== FONCTION PRINCIPALE DE CALCUL ====================
async function calculateScore(results, ownersLandData = null) {
    try {
        let totalScores = [];
        for (const result of results) {
            const { owner, armsWorlds = [], crewWorlds = [], facesWorlds = [], landWorlds = [] } = result;
            let totalSlots = 0;
            let movecostreduce = 0;
            if (facesWorlds.length > 0 || landWorlds.length > 0) {
                totalSlots = await calculateSlots(facesWorlds, landWorlds);
            }
            // Calcul de la réduction du coût de mouvement basée sur les shine des faces
            let shineCount = {};
            for (const face of facesWorlds) {
                const shine = face.details.attributes.shine || "Stone";
                const assets = parseInt(face.assets) || 0;
                const shineBonusValue = faceShineBonus.find(([rarity]) => rarity === face.details.attributes.rarity)?.[1]?.find(bonus => bonus[shine])?.[shine] || 0;
                movecostreduce += shineBonusValue * assets;
                if (!shineCount[shine]) shineCount[shine] = 0;
                shineCount[shine] += assets;
            }
            // Afficher le log pour tous les owners, même si aucun shine
            console.log(`[MoveCostReduce] Owner: ${owner} | Faces par shine: ${JSON.stringify(shineCount)} | movecostreduce appliqué: ${movecostreduce}`);
            let defenseScores = {
                totalDefense: 0,
                totalAttack: 0,
                totalAttackArm: 0,
                totalDefenseArm: 0,
                totalMoveCost: 0
            };
            let totalArm = 0;
            let totalCrew = 0;
            let templateData = {};
            let usedTemplateIds = new Set();
            // Traitement des données des crew et land
            let slotsUsedByCrew = 0;
            if (crewWorlds.length > 0) {
                slotsUsedByCrew = processTemplateData(crewWorlds, 'crew', totalSlots, templateData, usedTemplateIds, owner);
            }
            // Traitement des données des armes
            let armsUsage = { slotsUsed: 0, armsUsed: 0 };
            if (armsWorlds.length > 0) {
                armsUsage = processArmsData(armsWorlds, slotsUsedByCrew, totalSlots, templateData, usedTemplateIds);
            }
            totalArm = armsUsage.armsUsed;
            // Mise à jour du totalCrew en fonction des slots utilisés par les crew
            crewWorlds.forEach(crew => {
                totalCrew += parseInt(crew.assets) || 0;
            });
            // Ajustement de totalCrew pour qu'il ne dépasse pas slotsUsedByCrew
            totalCrew = Math.min(totalCrew, slotsUsedByCrew);
            // Calcul des defenseScores s'il y a des crew ou arms
            if (totalCrew > 0 || totalArm > 0) {
                defenseScores = await defense_score(crewWorlds, totalSlots, armsWorlds, owner);
            }
            // Appliquer la réduction du coût de mouvement calculée à partir des faces
            defenseScores.totalMoveCost = Math.max(0, defenseScores.totalMoveCost - movecostreduce);
            const usedTemplates = Object.values(templateData).filter(template => usedTemplateIds.has(template.template_id));
            // Ajout des facesWorlds aux templates
            const facesTemplates = facesWorlds.map(face => ({
                template_id: face.template_id,
                count: parseInt(face.assets),
                type: 'faces'
            }));
            // Ajout des landWorlds aux templates
            const landTemplates = landWorlds.map(land => ({
                template_id: land.template_id,
                count: parseInt(land.assets),
                type: 'land'
            }));
            // Ajout de la contribution des mercenaires planetdefnft (extraMercenaries)
            let extraAttack = 0, extraDefense = 0, extraMoveCost = 0;
            if (result.extraMercenaries && Array.isArray(result.extraMercenaries)) {
                for (const nft of result.extraMercenaries) {
                    extraAttack += parseInt(nft.attack) || 0;
                    extraDefense += parseInt(nft.defense) || 0;
                    extraMoveCost += parseInt(nft.movecost) || 0;
                }
            }
            defenseScores.totalAttack += extraAttack;
            defenseScores.totalDefense += extraDefense;
            defenseScores.totalMoveCost += extraMoveCost;
            defenseScores.totalAttackArm += extraAttack;
            defenseScores.totalDefenseArm += extraDefense;
            if (result.extraMercenaries && result.extraMercenaries.length > 0) {
                // console.log(`[Mercenaires] ${owner} : ${result.extraMercenaries.length} mercenaires ajoutés. Total attack: ${extraAttack}, defense: ${extraDefense}, movecost: ${extraMoveCost}`);
            }
            // Construction du résultat final pour ce owner
            totalScores.push({
                owner,
                totalSlots,
                defenseScores,
                totalArm,
                totalCrew,
                templates: [
                    ...usedTemplates,
                    ...facesTemplates,
                    ...landTemplates
                ],
                landIds: ownersLandData && ownersLandData[owner] ? ownersLandData[owner].lands : [],
                landCount: ownersLandData && ownersLandData[owner] ? ownersLandData[owner].lands.length : 0,
                extraMercenaries: result.extraMercenaries || []
            });
        }
        // console.log(totalScores);
        return totalScores;
    } catch (error) {
        console.error('[calculateScore] Erreur lors du calcul des scores :', error);
        return [];
    }
}

module.exports = {
    calculateScore
};