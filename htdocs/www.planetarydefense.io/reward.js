const { Session } = require("@wharfkit/session")
const { WalletPluginPrivateKey } = require("@wharfkit/wallet-plugin-privatekey")
const landIds = require('./Calculscore/landIDs.json');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const chain = {
  id: "1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4",
  url: "https://wax.pink.gg",
}

const privateKey = process.env.PRIVATE_KEY;
const accountName = process.env.ACCOUNT_NAME;
const permissionName = process.env.PERMISSION_NAME;
const walletPlugin = new WalletPluginPrivateKey(privateKey)

const session = new Session({
  actor: accountName,
  permission: permissionName,
  chain,
  walletPlugin,
})

const fs = require('fs').promises;

// Nouvelle fonction pour récupérer le VP pour une planète donnée
async function getVotepower(owner, planet) {
  try {
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'stkvt.worlds',
        table: 'weights',
        scope: planet,
        json: true,
        limit: 100,
        lower_bound: owner,
        upper_bound: owner,
      }),
    });
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Erreur lors de la récupération du VP pour ${planet} :`, error);
    return { rows: [] };
  }
}

// Fonction pour additionner le VP des six planètes (incluant les planètes unn)
async function getTotalVotepower(owner) {
  const planets = ['magor', 'kavian', 'eyeke','naron','nerix','veles','velesunn','neriunn', 'naronunn', 'magorunn', 'kavianunn', 'eyekeunn'];
  let total = 0;
  let details = [];
  for (const planet of planets) {
    const response = await getVotepower(owner, planet);
    let vp = 0;
    if (response.rows.length > 0) {
      vp = response.rows[0].weight / 10000;
    }
    total += vp;
    details.push({ planet, vp });
    console.log(`VP pour ${owner} sur ${planet} :`, vp);
  }
  console.log('--- Détail VP par planète ---');
  details.forEach(d => console.log(`${d.planet} : ${d.vp}`));
  console.log(`VP total pour ${owner} (toutes planètes) :`, total);
  return total;
}

// Nouvelle fonction pour récupérer le decay (vote_time_stamp) pour une planète donnée
async function getDecay(planet, user) {
  try {
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'dao.worlds',
        table: 'votes',
        scope: planet,
        json: true,
        limit: 100,
        lower_bound: user,
        upper_bound: user,
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching decay data for ${planet}:`, error);
    throw error;
  }
}

// Nouvelle fonction pour récupérer le VP total et le dernier vote_time_stamp sur toutes les planètes
async function getTotalVotepowerAndLastVoteTime(owner) {
  let total = 0;
  let lastVoteTimeStamp = null;
  const planets = ['magor', 'kavian', 'eyeke','naron','nerix','veles','velesunn','neriunn', 'naronunn', 'magorunn', 'kavianunn', 'eyekeunn'];
  let details = [];
  
  for (const planet of planets) {
    // VP
    let vp = 0;
    try {
      const vpResponse = await getVotepower(owner, planet);
      if (vpResponse.rows.length > 0) {
        vp = vpResponse.rows[0].weight / 10000;
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération du VP pour ${planet} :`, error);
    }
    total += vp;

    // Decay (vote_time_stamp)
    let vote_time_stamp = null;
    try {
      const decayResponse = await getDecay(planet, owner);
      if (decayResponse.rows.length > 0 && decayResponse.rows[0].vote_time_stamp) {
        vote_time_stamp = new Date(decayResponse.rows[0].vote_time_stamp);
      }
    } catch (error) {
      console.error(`Erreur lors de la récupération du decay pour ${planet} :`, error);
    }
    details.push({ planet, vp, vote_time_stamp });
    if (vote_time_stamp && (!lastVoteTimeStamp || vote_time_stamp > lastVoteTimeStamp)) {
      lastVoteTimeStamp = vote_time_stamp;
    }
  }
  
  // Affichage détaillé
  console.log('--- Détail VP par planète ---');
  details.forEach(d => console.log(`${d.planet} : ${d.vp} (vote_time_stamp: ${d.vote_time_stamp})`));
  console.log('VP total (toutes planètes) :', total);
  if (lastVoteTimeStamp) {
    console.log('Dernier vote_time_stamp trouvé :', lastVoteTimeStamp.toISOString());
  } else {
    console.log('Aucun vote_time_stamp trouvé.');
  }
  return { totalVP: total, lastVoteTimeStamp };
}

async function chest(landid) {
  try {
    const response = await fetch('https://wax.cryptolions.io/v1/chain/get_table_rows', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: 'magordefense', // Le contrat intelligent (smart contract) EOSIO
        table: 'chests', // La table que vous souhaitez interroger
        scope: 'magordefense', // La portée de la table
        json: true, // Demande des résultats au format JSON
        limit: 100, // Limite le nombre de résultats retournés
        //lower_bound et upper_bound sont facultatifs, vous pouvez les définir si nécessaire
        lower_bound: landid, // Clé de début (facultatif)
        upper_bound: landid, // Clé de fin (facultatif)
      }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    return data; // Retourne les données sous forme d'objet JSON
  } catch (error) {
    console.error('Error:', error);
    throw error; // Propage l'erreur pour être gérée par l'appelant
  }
}

function calculateRewardPercentage(voteafterdecay) {
  if (voteafterdecay < 1) {
    return 0;
  } else if (voteafterdecay < 1000) {
    return 0.5;
  } else if (voteafterdecay < 3000) {
    return 1.0;
  } else if (voteafterdecay < 5000) {
    return 1.5;
  } else if (voteafterdecay < 10000) {
    return 2.0;
  } else if (voteafterdecay < 15000) {
    return 2.5;
  } else if (voteafterdecay < 20000) {
    return 3.0;
  } else if (voteafterdecay < 25000) {
    return 3.5;
  } else if (voteafterdecay < 50000) {
    return 4.0;
  } else if (voteafterdecay < 75000) {
    return 4.5;
  } else if (voteafterdecay < 100000) {
    return 5.0;
  } else if (voteafterdecay < 125000) {
    return 5.5;
  } else if (voteafterdecay < 150000) {
    return 6.0;
  } else if (voteafterdecay < 200000) {
    return 6.5;
  } else if (voteafterdecay < 250000) {
    return 7.0;
  } else if (voteafterdecay < 300000) {
    return 7.5;
  } else if (voteafterdecay < 350000) {
    return 8.0;
  } else if (voteafterdecay < 400000) {
    return 8.5;
  } else if (voteafterdecay < 450000) {
    return 9.0;
  } else if (voteafterdecay < 500000) {
    return 9.5;
  } else if (voteafterdecay < 600000) {
    return 10.0;
  } else if (voteafterdecay < 700000) {
    return 10.5;
  } else if (voteafterdecay < 800000) {
    return 11.0;
  } else if (voteafterdecay < 900000) {
    return 11.5;
  } else if (voteafterdecay < 1000000) {
    return 12.0;
  } else if (voteafterdecay < 1250000) {
    return 12.5;
  } else if (voteafterdecay < 1500000) {
    return 13.0;
  } else if (voteafterdecay < 2000000) {
    return 13.5;
  } else if (voteafterdecay < 2500000) {
    return 14.0;
  } else if (voteafterdecay < 3000000) {
    return 14.5;
  } else if (voteafterdecay < 3500000) {
    return 15.0;
  } else if (voteafterdecay < 4000000) {
    return 15.5;
  } else if (voteafterdecay < 4500000) {
    return 16.0;
  } else if (voteafterdecay < 5000000) {
    return 16.5;
  } else if (voteafterdecay < 6000000) {
    return 17.0;
  } else if (voteafterdecay < 7000000) {
    return 17.5;
  } else if (voteafterdecay < 8000000) {
    return 18.0;
  } else if (voteafterdecay < 9000000) {
    return 18.5;
  } else if (voteafterdecay < 10000000) {
    return 19.0;
  } else if (voteafterdecay < 15000000) {
    return 19.5;
  } else {
    return 20.0;
  }
}


function calculateProtectionPercentage(chestLevel) {
  switch (chestLevel) {
    case 1:
      return 2.5;
    case 2:
      return 5;
    case 3:
      return 7.5;
    case 4:
      return 10;
    case 5:
      return 12.5;
    case 6:
      return 15;
    case 7:
      return 17.5;
    case 8:
      return 20;
    case 9:
      return 22.5;
    case 10:
      return 25;
    case 11:
      return 27.5;
    case 12:
      return 30;
    case 13:
      return 32.5;
    case 14:
      return 35;
    case 15:
      return 37.5;
    case 16:
      return 40;
    default:
      return 0; // Si le niveau du coffre est invalide, la protection est de 0%
  }
}

async function sendReward(landId, owner, totalreward) {
  if (!session) {
    console.warn('Session non initialisée.');
    return;
  }

  try {
    // Exécution de l'action "withdrawtlm" sur le compte "magordefense"
    console.log("on retire");
    const result = await session.transact({
      actions: [
        {
          account: "magordefense",
          name: "modifychest",
          authorization: [
            {
              actor: session.actor,
              permission: session.permission,
            },
          ],
          data: {
            land_id: landId,
            tlm_to_withdraw: totalreward,
          },
        },
      ],
    });
    console.log("retirer");

    // Vérification de l'état du propriétaire
    const response = await fetch(`https://www.planetarydefense.io/mission/check-landowner-status`);
    const data = await response.json();

    // Vérifier si le owner est dans la liste des landowners
    if (data.landowners[owner]) {
      // Exécution de l'action "transfer" sur le compte "alien.worlds"
      const transferResult = await session.transact(
        {
          actions: [
            {
              account: 'alien.worlds',
              name: 'transfer',
              authorization: [
                {
                  actor: session.actor,
                  permission: session.permission,
                },
              ],
              data: {
                from: "magordefense",
                to: owner,
                quantity: totalreward.toFixed(4) + " TLM", // Format correct de la chaîne de caractères,
                memo: "Reward planetary defense",
              },
            },
          ],
        },
        {
          blocksBehind: 3,
          expireSeconds: 30,
        }
      );
      console.log("envoyer");
    } else {
      console.log(`Le propriétaire ${owner} n'est pas éligible pour le transfert.`);
    }
    
  } catch (error) {
    console.error("Erreur lors de l'exécution de l'action : ", error);
  }
}

async function reward(landid) {
  try {
    const chestdata = await chest(landid);
    console.log(chestdata);

    if (chestdata && chestdata.rows && chestdata.rows.length > 0) {
      const firstRow = chestdata.rows[0];
      const owner = firstRow.owner;
      const chestLevel = firstRow.chest_level;
      const TLM = firstRow.TLM;

      // Utiliser le total VP (incluant les unn) et appliquer le decay
      let weight = 0;
      let voteTimeStamp = new Date();
      try {
        const { totalVP, lastVoteTimeStamp } = await getTotalVotepowerAndLastVoteTime(owner);
        weight = totalVP;
        if (lastVoteTimeStamp) {
          voteTimeStamp = lastVoteTimeStamp;
        }
      } catch (error) {
        console.error("Erreur lors de la récupération du votepower et decay :", error);
      }

      const currentTime = new Date();
      const timeDifference = (currentTime - voteTimeStamp) / 1000;
      const fraction_s = timeDifference / 2629800;

      const voteafterdecay = weight > 0 ? weight / Math.pow(2, fraction_s) : 0; // Calculez voteafterdecay si weight > 0, sinon 0

      console.log(`time difference ${fraction_s}`);
      console.log(voteafterdecay);
      console.log(calculateProtectionPercentage(chestLevel), calculateRewardPercentage(voteafterdecay));

      const rewardpercentage = calculateProtectionPercentage(chestLevel) + calculateRewardPercentage(voteafterdecay) + 1;
      console.log(rewardpercentage);

      const totalreward = rewardpercentage * TLM / 100;
      console.log(totalreward);
      // Ne pas envoyer de récompense si totalreward est nul
      if (totalreward > 0) {
        console.log("Envoi de la récompense");
        await sendReward(landid, owner, totalreward);
      } else {
        console.log("Aucune récompense à envoyer pour ce land ID.");
      }
    } else {
      console.error("Aucune donnée de coffre n'a été trouvée pour ce land ID.");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération des données de la fonction chest :", error);
  }
}

// Fonction de pause pour créer un délai
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function processRewardsWithDelay(landIds, delay) {
  for (const landId of landIds) {
    try {
      await reward(landId);
      console.log(`Récompense traitée pour landID: ${landId}`);
    } catch (error) {
      console.error(`Erreur pour landID ${landId}:`, error);
    }
    await sleep(delay); // Attend le délai spécifié avant de traiter le prochain landId
  }
}


//Pensé a appeler info.js avant
async function executeRewardProcesses() {
  try {
      // Appeler processRewardsWithDelay après la complétion de distributeRewards
      await processRewardsWithDelay(landIds, 500);
      console.log("processRewardsWithDelay completed");
  } catch (error) {
      console.error("Error during reward processes:", error);
  }
}

// Appeler la fonction pour exécuter les processus de récompense
executeRewardProcesses();
