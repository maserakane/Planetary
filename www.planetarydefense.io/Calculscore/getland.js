const fs = require('fs');

async function getEyekeLands() {
     
  let page = 1;
  let hasMore = true;
  let allLands = [];
  const eyekePlanetId = '6310955965768028672';

  while (hasMore) {
    const url = `https://atomic.3dkrender.com/atomicassets/v1/assets?collection_name=alien.worlds&schema_name=land.worlds&page=${page}&limit=100&order=asc&sort=asset_id`;
    console.log(`Requête page ${page} : ${url}`);
    const response = await fetch(url);
    const data = await response.json();

    if (!data.success || !data.data) {
      console.error("Échec de la requête ou pas de données retournées :", data.message);
      break;
    }

    // Afficher tous les IDs de planète rencontrés sur cette page
    const planetIds = [...new Set(data.data.map(asset => asset.data.planet))];
    console.log(`Planètes trouvées sur la page ${page} :`, planetIds);

    // Filtrer les lands situés sur Eyeke (ID numérique)
    const eyekeLands = data.data.filter(asset => asset.data.planet === eyekePlanetId);
    console.log(`Lands Eyeke trouvés sur la page ${page} : ${eyekeLands.length}`);
    allLands = allLands.concat(eyekeLands);

    hasMore = data.data.length === 100;
    page++;
  }

  // Extraire uniquement les asset_id
  const assetIds = allLands.map(land => land.asset_id);

  // Afficher les IDs des lands Eyeke
  console.log("IDs des lands Eyeke :");
  console.log(assetIds);
  console.log(`Nombre total de lands Eyeke trouvés : ${assetIds.length}`);

  // Sauvegarder uniquement la liste des asset_id dans un fichier JSON
  fs.writeFileSync(
    'eyeke_lands.json',
    JSON.stringify(assetIds, null, 2),
    'utf-8'
  );
  console.log('Liste des asset_id sauvegardée dans eyeke_lands.json');
}

getEyekeLands();