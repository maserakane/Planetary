// fetchPrices.js
// Récupération et association des prix de marché pour chaque template
// ------------------------------------------------------------
// - Récupère les prix via l'API AtomicMarket
// - Enrichit les assets avec les prix
// - Génère le fichier enriched_assets.json
// ------------------------------------------------------------

const fs = require('fs');

// ==================== Découpage en chunks ====================
function chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

// ==================== Récupération des prix pour un chunk de templates ====================
async function fetchPricesForTemplates(templateIds) {
    const url = `https://wax.api.atomicassets.io/atomicmarket/v1/sales/templates?state=1&symbol=WAX&template_id=${templateIds.join(',')}`;
    const response = await fetch(url);
    if (!response.ok) {
        console.error(`[fetchPricesForTemplates] Erreur lors de la requête API: ${response.statusText}`);
        throw new Error(`[fetchPricesForTemplates] Erreur lors de la requête API: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data.map(sale => ({
        template_id: sale.assets[0].template.template_id,
        listing_price: sale.price.amount ? (sale.price.amount / 100000000).toFixed(4) : null
    }));
}

// ==================== Fonction principale ====================
async function getAndAssociatePrices() {
    console.log('[getAndAssociatePrices] Début du processus pour récupérer et associer les prix...');
    // Charger les données JSON
    const data = JSON.parse(fs.readFileSync('Details.json', 'utf-8'));
    // Extraire les template_id
    const templateIds = data.map(item => item.template_id);
    // Diviser les template_id en groupes de 99
    const templateIdChunks = chunkArray(templateIds, 99);
    const allResults = [];
    for (let i = 0; i < templateIdChunks.length; i++) {
        const chunk = templateIdChunks[i];
        try {
            const prices = await fetchPricesForTemplates(chunk);
            allResults.push(...prices);
        } catch (error) {
            console.error(`[getAndAssociatePrices] Erreur lors de la récupération des prix pour le groupe ${i + 1}: ${error.message}`);
        }
    }
    // Associer les prix au fichier original
    const enrichedData = data.map(item => {
        const foundPrice = allResults.find(price => price.template_id === item.template_id);
        return {
            ...item,
            listing_price: foundPrice ? foundPrice.listing_price : null
        };
    });
    // Sauvegarde des résultats dans un fichier JSON
    const outputFilePath = 'enriched_assets.json';
    fs.writeFileSync(outputFilePath, JSON.stringify(enrichedData, null, 2), 'utf-8');
    console.log(`[getAndAssociatePrices] Sauvegarde terminée avec succès dans "${outputFilePath}".`);
}

module.exports = { getAndAssociatePrices };
