const { Session } = require("@wharfkit/session");
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey");
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'www.planetarydefense.io/.env') });
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH;
const db = new sqlite3.Database(dbPath);

//Charger la clé privée (environnement ou autre méthode sécurisée)
const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;

//Configuration de la blockchain
const chain = {
    id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
    url: "https://wax.greymass.com",
};
const walletPlugin = new WalletPluginPrivateKey(privateKey);

const session = new Session({
    actor: "magordefense",
    permission: "owner",
    chain,
    walletPlugin,
});

// Fonction pour charger les données d'une table blockchain EOSIO avec pagination
async function chargerDonneesBlockchain(tableName) {
    try {
        console.log(`📥 Récupération de tous les coffres depuis la blockchain...`);
        
        const limit = 1000;
        let allChests = [];
        let lower_bound = "";
        let more = true;
        let pageCount = 0;

        while (more) {
            pageCount++;
            console.log(`   Page ${pageCount}...`);
            
            const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    code: 'magordefense', // Contrat EOSIO
                    table: tableName,     // Table à interroger
                    scope: 'magordefense', // Scope de la table
                    json: true,
                    limit: limit,
                    lower_bound: lower_bound,
                }),
            });

            if (!response.ok) {
                throw new Error('Problème réseau.');
            }

            const data = await response.json();
            const rows = data.rows || [];
            
            allChests = allChests.concat(rows);
            more = data.more;
            
            if (more) {
                lower_bound = data.next_key;
            }
            
            console.log(`   ✅ ${rows.length} coffres récupérés (Total: ${allChests.length})`);
        }

        console.log(`\n📊 STATISTIQUES DE RÉCUPÉRATION:`);
        console.log(`   Pages traitées: ${pageCount}`);
        console.log(`   Total coffres récupérés: ${allChests.length}`);

        // Trier les lands par TLM en ordre décroissant
        const sortedLands = allChests.sort((a, b) => b.TLM - a.TLM);

        // Extraire les 10 premiers
        const top10Lands = sortedLands.slice(0, 10);

        // Afficher les 10 lands avec le plus de TLM
        console.log("\n=== TOP 10 COFFRES PAR TLM ===");
        top10Lands.forEach((land, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `${rank}.`;
            console.log(`${emoji} ${land.owner} - Land ID: ${land.land_id} - TLM: ${land.TLM} - Level: ${land.chest_level}`);
        });

        return top10Lands;
    } catch (error) {
        console.error('Erreur lors de la récupération des données blockchain :', error);
        throw error;
    }
}

async function verifierPvP(lands) {
    const ninetyDaysAgo = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60; // Timestamp 90 jours auparavant

    try {
        const pvpRecords = await fetchAllPvPRecords(); // Récupération paginée
        console.log('\n=== VÉRIFICATION ACTIVITÉ PvP RÉCENTE ===');

        // Filtrer les lands sans activité PvP récente
        const filteredLands = lands.filter(land => {
            const landPvPRecords = pvpRecords.filter(record =>
                record.land_id === land.land_id &&
                (record.defense_end_time > ninetyDaysAgo || record.attack_end_time > ninetyDaysAgo)
            );

            if (landPvPRecords.length > 0) {
                console.log(`❌ Land ${land.land_id} (${land.owner}) - EXCLU - Activité PvP récente détectée`);
            } else {
                console.log(`✅ Land ${land.land_id} (${land.owner}) - ÉLIGIBLE - Aucune activité PvP récente`);
            }

            return landPvPRecords.length === 0; // Garder les lands sans activité PvP récente
        });

        console.log(`\n=== RÉSULTAT ===`);
        console.log(`Lands éligibles pour PvP: ${filteredLands.length}/${lands.length}`);
        
        if (filteredLands.length > 0) {
            console.log(`\n🎯 PROCHAIN CIBLE SÉLECTIONNÉ:`);
            const nextTarget = filteredLands[0];
            console.log(`   Propriétaire: ${nextTarget.owner}`);
            console.log(`   Land ID: ${nextTarget.land_id}`);
            console.log(`   TLM: ${nextTarget.TLM}`);
            console.log(`   Level: ${nextTarget.chest_level}`);
        } else {
            console.log(`\n❌ AUCUN LAND ÉLIGIBLE POUR PvP`);
        }

        return filteredLands;
    } catch (error) {
        console.error('Erreur lors de la vérification PvP :', error);
        throw error;
    }
}

// Fonction pour récupérer tous les enregistrements avec pagination
async function fetchAllPvPRecords() {
    let results = [];
    let lowerBound = '';
    let hasMore = true;

    while (hasMore) {
        const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'magordefense',
                table: 'pvp3',
                scope: 'magordefense',
                json: true,
                limit: 1000,
                lower_bound: lowerBound,
            }),
        });

        const data = await response.json();
        results = results.concat(data.rows || []);
        hasMore = data.more;
        lowerBound = data.next_key; // Si `next_key` est disponible
    }

    return results;
}


async function lancerPvP(landsQualifies) {
    // Préparer les actions pour lancer le PvP sur le premier land éligible
    if (landsQualifies.length === 0) {
        console.log("Aucun land éligible pour lancer un PvP.");
        return;
    }

    const firstLand = landsQualifies[0];
    const actions = [
        {
            account: "magordefense",
            name: "createpvp",
            authorization: [
                {
                    actor: "magordefense", // Utilisateur connecté
                    permission:"owner",
                },
            ],
            data: {
                selected_player: firstLand.owner, // Propriétaire du land
                land_id: parseInt(firstLand.land_id), // Identifiant du land
            },
        },
    ];

    try {
        console.log(actions)
        const result = await session.transact({
            actions: actions,
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        console.log(`PvP lancé avec succès ! ID de transaction : ${result.transaction_id}`);
    } catch (error) {
        console.error(`Erreur lors du lancement du PvP : ${error.message}`);
    }
}

async function main() {
    try {
        console.log("🔍 ANALYSE DES COFFRES POUR SÉLECTION PvP");
        console.log("=" .repeat(50));
        
        const top10Lands = await chargerDonneesBlockchain("chests");
        const landsSansPvPRecent = await verifierPvP(top10Lands);
        
        // Afficher le résumé final
        console.log("\n" + "=" .repeat(50));
        console.log("📊 RÉSUMÉ FINAL");
        console.log("=" .repeat(50));
        console.log(`Top 10 coffres affichés: ${top10Lands.length}`);
        console.log(`Coffres éligibles pour PvP: ${landsSansPvPRecent.length}`);
        
        if (landsSansPvPRecent.length > 0) {
            console.log(`\n🎯 PROCHAIN CIBLE: ${landsSansPvPRecent[0].owner} (Land ${landsSansPvPRecent[0].land_id})`);
            console.log(`   TLM: ${landsSansPvPRecent[0].TLM}`);
            console.log(`   Level: ${landsSansPvPRecent[0].chest_level}`);
        }
        
        await lancerPvP(landsSansPvPRecent);
    } catch (error) {
        console.error("Erreur dans l'exécution principale :", error);
    }
}

main();
