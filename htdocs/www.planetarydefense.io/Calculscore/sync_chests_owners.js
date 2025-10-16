// sync_chests_owners.js
// Script pour synchroniser les land_id de la table chests avec les bons propriétaires
// ================================================================================

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuration
const config = {
    dbPath: process.env.DATABASE_PATH || path.join(__dirname, 'planetary.db'),
    contractAccount: 'magordefense', // Compte du contrat
    apiEndpoint: 'https://wax.cryptolions.io/v1/chain/get_table_rows'
};

//console.log("🔍 ANALYSE DES DIFFÉRENCES DE PROPRIÉTÉ");
//console.log("=" .repeat(50));

// Fonctions utilitaires
function log(message) {
    //console.log(`🔄 ${message}`);
}

function success(message) {
    //console.log(`✅ ${message}`);
}

function error(message, err) {
    console.error(`❌ ${message}`);
    if (err) console.error(err.message);
}

// Outil générique pour récupérer *toutes* les lignes d'une table EOSIO/WAX
async function fetchAllTableRows({
  endpoint = 'https://wax.cryptolions.io/v1/chain/get_table_rows',
  code,
  scope,
  table,
  index_position = '1',
  key_type = 'i64',
  batch = 1000,
  pauseMs = 150,
  maxRetries = 5,
  log = console.log,
  error = console.error,
}) {
  if (!code || !scope || !table) throw new Error('Paramètres {code, scope, table} requis');

  let lower_bound = null;
  let hasMore = true;
  const allRows = [];

  // devine au besoin le champ primary key si next_key n'est pas fourni
  const guessPrimaryKeyField = (row) => {
    if (!row || typeof row !== 'object') return null;
    if ('id' in row) return 'id';
    // préférer un champ qui finit par _id
    const idLike = Object.keys(row).filter(k => /(^id$|_id$)/i.test(k));
    if (idLike.length) return idLike.sort((a,b)=>a.length-b.length)[0];
    // sinon, essaie un entier plausible
    const ints = Object.entries(row).filter(([k,v]) => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)));
    return ints.length ? ints[0][0] : null;
  };

  while (hasMore) {
    const body = {
      json: true,
      code,
      scope,
      table,
      limit: batch,
      reverse: false,
      show_payer: false,
      index_position,
      key_type,
    };
    if (lower_bound !== null) body.lower_bound = String(lower_bound);

    let attempt = 0;
    // petite boucle de retry
    // (les endpoints WAX peuvent throttler/timeout)
    // backoff exponentiel: 300ms, 600ms, 1200ms...
    for (;;) {
      try {
        log(`📄 Lecture (limit=${batch})${lower_bound!==null ? `, lower_bound=${lower_bound}` : ''} ...`);
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const data = await res.json();

        if (!data || !Array.isArray(data.rows)) {
          error('❌ Structure inattendue:', JSON.stringify(data, null, 2));
          throw new Error('Structure de données inattendue (pas de "rows")');
        }

        const rows = data.rows;
        log(`📦 ${rows.length} lignes récupérées`);

        allRows.push(...rows);

        // Gestion de la pagination
        const more = data.more;            // bool ou string selon le nodeos
        const nextKey = data.next_key;     // présent sur la plupart des nodes récents

        if (more === true || (typeof more === 'string' && more.length)) {
          // Avancer le curseur
          if (nextKey && String(nextKey).length) {
            lower_bound = nextKey;
          } else if (typeof more === 'string' && more.length) {
            // certains nodes renvoient le "next lower_bound" directement dans more
            lower_bound = more;
          } else {
            // fallback : +1 sur le PK deviné
            const last = rows[rows.length - 1];
            const pkField = guessPrimaryKeyField(last);
            if (!pkField) {
              throw new Error('Impossible de deviner le champ primary key pour continuer la pagination.');
            }
            const v = last[pkField];
            // manipuler en BigInt pour éviter les débordements
            const asBig = typeof v === 'string' ? BigInt(v) : BigInt(v);
            lower_bound = (asBig + 1n).toString();
          }
          log(`➡️ Suite disponible, next lower_bound = ${lower_bound}`);
          // courte pause pour ne pas cogner l'API
          await new Promise(r => setTimeout(r, pauseMs));
        } else {
          hasMore = false;
          log('✅ Fin de pagination (more=false)');
        }

        break; // sortie de la boucle retry

      } catch (e) {
        attempt++;
        if (attempt > maxRetries) {
          error('🛑 Abandon après retries:', e);
          throw e;
        }
        const wait = 300 * Math.pow(2, attempt - 1);
        log(`⚠️ Erreur tentative ${attempt}/${maxRetries}: ${e.message} — retry dans ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
      }
    }
  }

  log(`\n🎯 RÉSUMÉ: total ${allRows.length} lignes agrégées`);
  return allRows;
}

// Récupérer tous les chests avec la méthode générique
async function fetchAllChests() {
  return fetchAllTableRows({
    code: 'magordefense',
    scope: 'magordefense',
    table: 'chests',
    batch: 1000,
    pauseMs: 200,
    log: (...args) => log?.(...args) ?? //console.log(...args),
    error: (...args) => error?.(...args) ?? console.error(...args),
  });
}

// Récupérer la liste des land_id depuis la blockchain
async function fetchChestsLandIds() {
  log('Récupération de tous les land_id depuis la blockchain...');
  
  const rows = await fetchAllChests();
  const set = new Set();
  for (const r of rows) if (r && r.land_id !== undefined) set.add(r.land_id);
  const list = Array.from(set);
  
  // logs "jolis" compatibles avec ta fonction
  log(`📊 Total chests: ${rows.length}`);
  log(`📍 land_id uniques: ${list.length}`);
  list.slice(0, 10).forEach((id, i) => log(`   ${i+1}. ${id}`));
  if (list.length > 10) log(`   ... et ${list.length - 10} autres`);
  
  return list;
}

// Récupérer tous les land_id
async function fetchAllLandIds() {
    log('🔄 Récupération des land_id...');
    
    try {
        const landIds = await fetchChestsLandIds();
        log(`✅ ${landIds.length} land_id récupérés`);
        return landIds;
    } catch (err) {
        error('Erreur lors de la récupération', err);
        throw err;
    }
}
// Récupérer les données des propriétaires depuis la base locale
async function fetchLocalOwnersData() {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(config.dbPath, sqlite3.OPEN_READONLY);
        
        const query = `
            SELECT owner, landIds 
            FROM Landowners 
            WHERE landIds IS NOT NULL AND landIds != '[]'
        `;
        
        db.all(query, [], (err, rows) => {
            db.close();
            if (err) {
                error('Erreur lors de la récupération des données locales', err);
                reject(err);
                return;
            }
            
            log(`📊 ${rows.length} propriétaires actifs récupérés depuis la base locale`);
            resolve(rows);
        });
    });
}

// Créer une map des propriétaires par land_id
function createOwnerMap(ownersData) {
    const ownerMap = new Map();
    let totalLandIds = 0;
    let errorCount = 0;
    
    for (const ownerData of ownersData) {
        try {
            const landIds = JSON.parse(ownerData.landIds);
            if (Array.isArray(landIds)) {
                totalLandIds += landIds.length;
                for (const landId of landIds) {
                    // Convertir en string pour la comparaison (les landIds sont stockés comme strings)
                    const landIdStr = String(landId);
                    ownerMap.set(landIdStr, ownerData.owner);
                }
            }
        } catch (err) {
            errorCount++;
            console.warn(`⚠️  Erreur parsing landIds pour ${ownerData.owner}: ${err.message}`);
        }
    }
    
    log(`📋 ${ownerMap.size} associations land_id -> owner créées`);
    log(`📊 ${totalLandIds} landIds traités, ${errorCount} erreurs de parsing`);
    return ownerMap;
}

// Récupérer les données des chests depuis la blockchain avec les owners
async function fetchChestsWithOwners() {
    log('Récupération des chests avec leurs owners depuis la blockchain...');
    
    const rows = await fetchAllChests();
    const chestsWithOwners = [];
    
    for (const chest of rows) {
        if (chest && chest.land_id !== undefined && chest.owner) {
            chestsWithOwners.push({
                land_id: chest.land_id,
                owner: chest.owner
            });
        }
    }
    
    log(`📊 ${chestsWithOwners.length} chests avec owners récupérés`);
    return chestsWithOwners;
}

// Analyser les différences entre land_id blockchain et base locale
async function analyzeLandIdDifferences(blockchainLandIds, ownerMap) {
    const fs = require('fs');
    const path = require('path');
    
    // Récupérer les chests avec leurs owners depuis la blockchain
    const blockchainChests = await fetchChestsWithOwners();
    const blockchainOwnerMap = new Map();
    
    // Créer une map des owners blockchain
    for (const chest of blockchainChests) {
        blockchainOwnerMap.set(String(chest.land_id), chest.owner);
    }
    
    const discrepancies = [];
    let foundInLocalDb = 0;
    let notFoundInLocalDb = 0;
    let ownerMismatch = 0;
    let ownerMatch = 0;
    
    log('🔍 Analyse des différences de land_id et owners...');
    
    // Analyser chaque land_id de la blockchain
    for (const landId of blockchainLandIds) {
        const landIdStr = String(landId);
        const localOwner = ownerMap.get(landIdStr);
        const blockchainOwner = blockchainOwnerMap.get(landIdStr);
        
        if (localOwner) {
            foundInLocalDb++;
            
            // Vérifier si les owners correspondent
            if (blockchainOwner && localOwner === blockchainOwner) {
                ownerMatch++;
                discrepancies.push({
                    land_id: landId,
                    local_owner: localOwner,
                    blockchain_owner: blockchainOwner,
                    status: 'OWNER_MATCH'
                });
            } else if (blockchainOwner && localOwner !== blockchainOwner) {
                ownerMismatch++;
                discrepancies.push({
                    land_id: landId,
                    local_owner: localOwner,
                    blockchain_owner: blockchainOwner,
                    status: 'OWNER_MISMATCH'
                });
            } else {
                discrepancies.push({
                    land_id: landId,
                    local_owner: localOwner,
                    blockchain_owner: blockchainOwner,
                    status: 'FOUND_IN_LOCAL_DB_NO_BLOCKCHAIN_OWNER'
                });
            }
        } else {
            notFoundInLocalDb++;
            discrepancies.push({
                land_id: landId,
                local_owner: null,
                blockchain_owner: blockchainOwner,
                status: 'NOT_IN_LOCAL_DB'
            });
        }
    }
    
    // Analyser les land_id de la base locale qui ne sont pas dans la blockchain
    const blockchainLandIdSet = new Set(blockchainLandIds.map(id => String(id)));
    const localLandIds = Array.from(ownerMap.keys());
    const localOnlyLandIds = localLandIds.filter(landId => !blockchainLandIdSet.has(landId));
    
    log(`🔍 Analyse des land_id uniquement en base locale...`);
    log(`📊 ${localOnlyLandIds.length} land_id trouvés uniquement en base locale`);
    
    // Ajouter les land_id uniquement en base locale
    for (const landId of localOnlyLandIds) {
        const localOwner = ownerMap.get(landId);
        discrepancies.push({
            land_id: landId,
            local_owner: localOwner,
            blockchain_owner: null,
            status: 'ONLY_IN_LOCAL_DB'
        });
    }
    
    // Filtrer seulement les différences d'owners
    const ownerMismatches = discrepancies.filter(item => item.status === 'OWNER_MISMATCH');
    
    // Créer le fichier JSON avec seulement les différences d'owners
    const outputData = {
        analysis_date: new Date().toISOString(),
        summary: {
            total_land_ids_analyzed: blockchainLandIds.length,
            owner_matches: ownerMatch,
            owner_mismatches: ownerMismatch,
            description: "Seules les différences d'owners sont affichées. La base de données locale est considérée comme la référence correcte."
        },
        owner_discrepancies: ownerMismatches.map(item => ({
            land_id: item.land_id,
            correct_owner_from_database: item.local_owner,
            incorrect_owner_from_blockchain: item.blockchain_owner,
            action_needed: `Mettre à jour la blockchain pour ${item.land_id} : ${item.blockchain_owner} → ${item.local_owner}`
        }))
    };
    
    const outputPath = path.join(__dirname, 'land_ids_analysis.json');
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    log(`📄 Fichier JSON créé: ${outputPath}`);
    log(`📊 Résumé: ${foundInLocalDb} trouvés dans la base locale, ${notFoundInLocalDb} non trouvés`);
    log(`📊 Résumé: ${localOnlyLandIds.length} land_id uniquement en base locale`);
    log(`📊 Résumé: ${ownerMatch} owners correspondent, ${ownerMismatch} owners ne correspondent pas`);
    
    return {
        found: foundInLocalDb,
        notFound: notFoundInLocalDb,
        localOnly: localOnlyLandIds.length,
        totalLocal: localLandIds.length,
        ownerMatch: ownerMatch,
        ownerMismatch: ownerMismatch,
        filePath: outputPath
    };
}

// Afficher les statistiques des différences
function displayDiscrepancyStats(analysisResults) {
    log(`\n📊 STATISTIQUES DES LAND_ID:`);
    log(`   🔗 Total blockchain: ${analysisResults.found + analysisResults.notFound}`);
    log(`   🏠 Total base locale: ${analysisResults.totalLocal}`);
    log(`   ✅ Trouvés dans la base locale: ${analysisResults.found}`);
    log(`   ❓ Non trouvés dans la base locale: ${analysisResults.notFound}`);
    log(`   🏠 Uniquement en base locale: ${analysisResults.localOnly}`);
    log(`   📄 Fichier JSON: ${analysisResults.filePath}`);
    
    log(`\n👥 STATISTIQUES DES OWNERS:`);
    log(`   ✅ Owners qui correspondent: ${analysisResults.ownerMatch}`);
    log(`   ❌ Owners qui ne correspondent pas: ${analysisResults.ownerMismatch}`);
    
    if (analysisResults.ownerMismatch > 0) {
        log(`\n⚠️ ATTENTION: ${analysisResults.ownerMismatch} owners ne correspondent pas entre blockchain et base locale !`);
    }
    
    if (analysisResults.notFound > 0) {
        log(`\n❓ INFO: ${analysisResults.notFound} land_id de la blockchain ne sont pas dans la base locale (nouveaux propriétaires ?)`);
    }
    
    if (analysisResults.localOnly > 0) {
        log(`\n🏠 INFO: ${analysisResults.localOnly} land_id de la base locale ne sont pas dans la blockchain (anciens propriétaires ?)`);
    }
    
    // Vérifier la cohérence
    const totalUnique = analysisResults.found + analysisResults.notFound + analysisResults.localOnly;
    log(`\n🔍 COHÉRENCE:`);
    log(`   📊 Total unique: ${totalUnique}`);
    log(`   🔗 Blockchain: ${analysisResults.found + analysisResults.notFound}`);
    log(`   🏠 Base locale: ${analysisResults.totalLocal}`);
    
    if (totalUnique === analysisResults.found + analysisResults.notFound + analysisResults.localOnly) {
        log(`   ✅ Cohérence vérifiée`);
    } else {
        log(`   ⚠️ Incohérence détectée`);
    }
    
    // Vérifier la cohérence des owners
    if (analysisResults.ownerMatch + analysisResults.ownerMismatch === analysisResults.found) {
        log(`   ✅ Cohérence des owners vérifiée`);
    } else {
        log(`   ⚠️ Incohérence des owners détectée`);
    }
}

// Fonction principale
async function main() {
    const startTime = Date.now();
    
    try {
        log('🚀 Début de l\'analyse des différences de propriété');
        
        // 1. Récupérer tous les land_id depuis la blockchain
        const blockchainLandIds = await fetchAllLandIds();
        
        // 2. Récupérer les données des propriétaires depuis la base locale
        const ownersData = await fetchLocalOwnersData();
        
        // 3. Créer la map des propriétaires
        const ownerMap = createOwnerMap(ownersData);
        
        // 4. Analyser les différences de propriété
        log('🔍 Analyse des différences entre blockchain et base locale...');
        const analysisResults = await analyzeLandIdDifferences(blockchainLandIds, ownerMap);
        
        // 5. Afficher les statistiques des différences
        displayDiscrepancyStats(analysisResults);
        
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        success(`🎉 Analyse terminée en ${duration}s`);
        success(`📊 Résumé: ${analysisResults.found} trouvés dans la base locale, ${analysisResults.notFound} non trouvés`);
        
    } catch (err) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        error(`💥 Erreur lors de l'analyse après ${duration}s`, err);
        process.exit(1);
    }
}

// Exécution du script
if (require.main === module) {
    main();
}

module.exports = { main, fetchLocalOwnersData };
