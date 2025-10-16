// calculateScore.js
// Calcul des scores pour chaque joueur ou propriétaire selon leurs assets
// ------------------------------------------------------------
// - Prend en compte la rareté, le shine, les bonus, les slots, etc.
// - Utilisé pour générer les scores dans allResults.json et ownerscore.json
// ------------------------------------------------------------

const fs = require('fs').promises;
const { getWarlordSlotsForOwner } = require('./processData');

// ==================== CHARGEMENT DES FORGES ====================
async function loadForgeOwners() {
    try {
        const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                code: 'magordefense',
                table: 'forge',
                scope: 'magordefense',
                json: true,
                limit: 1000,
                reverse: false,
                show_payer: false
            }),
        });

        if (!response.ok) {
            console.error(`[loadForgeOwners] Erreur lors de la récupération des forges: ${response.status}`);
            return new Set();
        }

        const forgeData = await response.json();
        const forgeOwners = new Set(forgeData.rows.map(row => row.player_address));
        
        return forgeOwners;
    } catch (error) {
        console.error(`[loadForgeOwners] Erreur lors du chargement des forges:`, error);
        return new Set();
    }
}

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
// Calcule le nombre total de slots disponibles selon les faces, lands et warlord
async function calculateSlots(facesList, landWorlds, warlordSlots = 0) {
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
    
    // Ajouter les slots warlord
    totalSlots += warlordSlots;
    
    if (warlordSlots > 0) {
        // Slots warlord ajoutés
    }
    
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
async function defense_score(crew, faceValue, arms, owner, mercenariesCount = 0) {
    const sortedCrews = crew.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    const sortedArms = arms.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    const crewAttributes = calculateTotalAttributes(sortedCrews, faceValue, owner, 'Crew');
    
    // Calculer la limite d'armes de la même façon que dans processArmsData
    const maxArmsForCrew = crewAttributes.slotsFilled;
    const maxArmsForMercenaries = mercenariesCount;
    const totalMaxArms = maxArmsForCrew + maxArmsForMercenaries;
    
    const armAttributes = calculateTotalAttributes(sortedArms, totalMaxArms, owner, 'Arm');
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
        const templateId = item.template?.template_id || item.template_id;
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

function processArmsData(armsWorlds, slotsUsedByCrew, totalSlots, templateData, usedTemplateIds, owner, mercenariesCount = 0) {
    let slotsUsed = 0;
    let armsUsed = 0;
    const sortedArms = armsWorlds.sort((a, b) => calculateCardScore(b) - calculateCardScore(a));
    
    // Les armes peuvent être utilisées par les crew ET les mercenaires
    const maxArmsForCrew = slotsUsedByCrew;
    const maxArmsForMercenaries = mercenariesCount;
    const totalMaxArms = maxArmsForCrew + maxArmsForMercenaries;
    
    // Max armes: totalMaxArms (maxArmsForCrew crew + maxArmsForMercenaries mercenaires)
    
    for (const item of sortedArms) {
        if (slotsUsed >= totalSlots || armsUsed >= totalMaxArms) break;
        const templateId = item.template?.template_id || item.template_id;
        let assets = parseInt(item.assets) || 0;
        if (slotsUsed + assets > totalSlots) {
            assets = totalSlots - slotsUsed;
        }
        if (armsUsed + assets > totalMaxArms) {
            assets = totalMaxArms - armsUsed;
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

// ==================== FONCTION PRINCIPALE DE CALCUL (OPTIMISÉE) ====================
async function calculateScore(results, ownersLandData = null) {
    try {
        // Charger la liste des propriétaires de forge une seule fois
        const forgeOwners = await loadForgeOwners();
        
        // Traitement par batches pour optimiser les performances
        const batchSize = 10;
        let totalScores = [];
        
        for (let i = 0; i < results.length; i += batchSize) {
            const batch = results.slice(i, i + batchSize);
            
            // Traitement parallèle du batch
            const batchPromises = batch.map(async (result) => {
                try {
                    return await calculateSinglePlayerScore(result, ownersLandData, forgeOwners);
                } catch (error) {
                    return null;
                }
            });
            
            const batchResults = await Promise.all(batchPromises);
            totalScores.push(...batchResults.filter(score => score !== null));
        }
        
        return totalScores;
    } catch (error) {
        console.error(`[calculateScore] Erreur globale: ${error.message}`);
        throw error;
    }
}

// Fonction optimisée pour calculer le score d'un seul joueur
async function calculateSinglePlayerScore(result, ownersLandData = null, forgeOwners = new Set()) {
    const { owner, armsWorlds = [], crewWorlds = [], facesWorlds = [], landWorlds = [], warlordTemplates = [], mercenaryTemplates = [] } = result;
    let totalSlots = 0;
    let movecostreduce = 0;
    
    // Récupérer les slots warlord pour cet owner
    let warlordSlots = 0;
    try {
        const warlordInfo = await getWarlordSlotsForOwner(owner);
        warlordSlots = warlordInfo.totalSlots;
    } catch (error) {
        // Erreur silencieuse
    }
    
    if (facesWorlds.length > 0 || landWorlds.length > 0 || warlordSlots > 0) {
        totalSlots = await calculateSlots(facesWorlds, landWorlds, warlordSlots);
    }
    
    // Calcul de la réduction du coût de mouvement basée sur les shine des faces
    for (const face of facesWorlds) {
        const shine = face.details.attributes.shine || "Stone";
        const assets = parseInt(face.assets) || 0;
        const shineBonusValue = faceShineBonus.find(([rarity]) => rarity === face.details.attributes.rarity)?.[1]?.find(bonus => bonus[shine])?.[shine] || 0;
        movecostreduce += shineBonusValue * assets;
    }
    
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
    
    // Calculer le nombre de mercenaires
    const mercenariesCount = result.extraMercenaries ? result.extraMercenaries.length : 0;
    
    // Les mercenaires utilisent des slots en priorité
    let slotsUsedByMercenaries = 0;
    if (mercenariesCount > 0) {
        slotsUsedByMercenaries = Math.min(mercenariesCount, totalSlots);
    }
    
    // Calculer les slots restants pour les crews
    const remainingSlots = totalSlots - slotsUsedByMercenaries;
    
    // Traitement des données des crew avec les slots restants
    let slotsUsedByCrew = 0;
    if (crewWorlds.length > 0 && remainingSlots > 0) {
        slotsUsedByCrew = processTemplateData(crewWorlds, 'crew', remainingSlots, templateData, usedTemplateIds, owner);
    }
    
    // Vérifier si le joueur possède une forge avant de permettre l'utilisation des armes
    const hasForge = forgeOwners.has(owner);
    
    // Traitement des données des armes (uniquement si le joueur possède une forge)
    let armsUsage = { slotsUsed: 0, armsUsed: 0 };
    if (armsWorlds.length > 0 && hasForge) {
        armsUsage = processArmsData(armsWorlds, slotsUsedByCrew, totalSlots, templateData, usedTemplateIds, owner, mercenariesCount);
    }
    totalArm = armsUsage.armsUsed;
    
    // Calcul du totalCrew : slots réellement utilisés par les crews + mercenaires
    totalCrew = slotsUsedByCrew + slotsUsedByMercenaries;
    // Calcul des defenseScores s'il y a des crew ou arms
    if (totalCrew > 0 || totalArm > 0) {
        defenseScores = await defense_score(crewWorlds, totalSlots, armsWorlds, owner, mercenariesCount);
    }
    
    // Appliquer la réduction du coût de mouvement calculée à partir des faces
    defenseScores.totalMoveCost = Math.max(0, defenseScores.totalMoveCost - movecostreduce);
    
    const usedTemplates = Object.values(templateData).filter(template => usedTemplateIds.has(template.template_id));
    
    // Ajout des facesWorlds aux templates
    const facesTemplates = facesWorlds.map(face => ({
        template_id: face.template?.template_id || face.template_id,
        count: parseInt(face.assets),
        type: 'faces'
    }));
    
    // Ajout des landWorlds aux templates
    const landTemplates = landWorlds.map(land => ({
        template_id: land.template?.template_id || land.template_id,
        count: parseInt(land.assets),
        type: 'land'
    }));
    
    // Ajout des warlords aux templates
    const warlordTemplatesFinal = warlordTemplates.map(warlord => ({
        template_id: warlord.template?.template_id || warlord.template_id,
        count: warlord.count,
        type: 'warlord'
    }));
    
    // Ajout des mercenaries aux templates
    const mercenaryTemplatesFinal = mercenaryTemplates.map(mercenary => ({
        template_id: mercenary.template?.template_id || mercenary.template_id,
        count: mercenary.count,
        type: 'mercenary'
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
    
    // Construction du résultat final pour ce owner
    return {
        owner,
        totalSlots,
        warlordSlots,
        mercenariesCount,
        defenseScores,
        totalArm,
        totalCrew,
        templates: [
            ...usedTemplates,
            ...facesTemplates,
            ...landTemplates,
            ...warlordTemplatesFinal,
            ...mercenaryTemplatesFinal
        ],
        landIds: ownersLandData && ownersLandData[owner] ? ownersLandData[owner].lands : [],
        landCount: ownersLandData && ownersLandData[owner] ? ownersLandData[owner].count : 0,
        extraMercenaries: result.extraMercenaries || []
    };
}

module.exports = {
    calculateScore
};