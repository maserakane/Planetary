if (typeof userType === 'undefined') {
    var userType = localStorage.getItem("userType");
}

$(document).ready(async function() {
	let upgradeButton;
  
    const userAccount = localStorage.getItem("userAccount");
    const userType = localStorage.getItem("userType");  // Vérifiez le type d'utilisateur

    // Vérifiez si le userType est 'owner'
    if (userType !== 'owner') {
        $('#whitelist-section').hide();  // Masquez la section whitelist si ce n'est pas un owner
        return;
    }

    // Fonction pour vérifier si l'utilisateur est déjà whitelisté
    async function checkWhitelistStatus() {

        try {
            const response = await fetch('/mission/check-whitelist-warlord', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ warlord: userAccount }),
            });
            const data = await response.json();
            return data.isWhitelisted;
        } catch (error) {
            console.error('Error checking whitelist status:', error);
            return false;
        }
    }

    // Fonction pour ajouter l'utilisateur à la whitelist
    async function addToWhitelist() {

        try {
            const response = await fetch('/mission/whitlist-warlord', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ warlord: userAccount, active: 1 }),
            });

            if (response.ok) {
                $('#whitelist-status').text("You are whitelist for payment");
                $('#whitelist-btn').hide(); // Cacher le bouton
            } else {
                console.error("Failed to add user to whitelist");
                $('#whitelist-status').text("Failed to whitelist. Please try again.");
            }
        } catch (error) {
            console.error('Error adding to whitelist:', error);
            $('#whitelist-status').text("An error occurred.");
        }
    }

    // Vérification du statut de la whitelist au chargement de la page
    const isWhitelisted = await checkWhitelistStatus();
    
    if (isWhitelisted) {
        $('#whitelist-btn').hide();
        $('#whitelist-status').text("You are whitelisted for payment");
    } else {
        $('#whitelist-btn').show();

        // Gestion du clic sur le bouton whitelist
        $('#whitelist-btn').on('click', async function(event) {
            event.preventDefault();
            await addToWhitelist();
        });
    }
});


async function fetchDataChest(tableName, lower_bound, upper_bound) {
    const requestData = {
        json: true,
        code: window.planetData.WalletMission,
        scope: window.planetData.WalletMission,
        table: tableName,
        lower_bound,
        upper_bound,
        limit: 1,
    };

    for (let endpoint of apiEndpointsLive) {
        try {
            const response = await apiRequestWithRetryh(endpoint, requestData, 1, 5000); // Utilisation de l'API externe
            return response; // Retourne les données si la requête réussit
        } catch (error) {
            console.error(`Failed to fetch data from endpoint ${endpoint}. Trying next...`, error);
        }
    }

    // Si aucun endpoint n'a fonctionné, affiche un message d'erreur avec showToast
    showToast('Failed to fetch Chest data after multiple attempts.', 'error');
    return null; // Retourne null si toutes les tentatives échouent
}


async function fetchLand() {
    const userAccount = localStorage.getItem("userAccount");
    try {
        const responseData = await fetchDataChest('owners', userAccount, userAccount);

        if (responseData && responseData.rows && responseData.rows.length > 0) {
            return responseData.rows.map(row => row.land_ids).flat();
        } else {
            document.getElementById('no-land').textContent = "You have no Land, You should buy one.";
            return [];
        }
    } catch (error) {
        console.error("Failed to fetch land data:", error);
        showToast("An error occurred while fetching land data.", "error");
        document.getElementById('no-land').textContent = "An error occurred while fetching land data.";
        return [];
    }
}

// Function to save selectedLandId to localStorage
function saveSelectedLandId(landId) {
    localStorage.setItem('selectedLandId', landId);
}

// Nouvelle fonction pour récupérer le vote power pour une planète donnée
async function getVotepower(planet) {
    const userAccount = localStorage.getItem("userAccount");
    const requestData = {
        code: 'stkvt.worlds',
        table: 'weights',
        scope: planet, // planète dynamique
        json: true,
        limit: 100,
        lower_bound: userAccount,
        upper_bound: userAccount,
    };

    for (let endpoint of apiEndpointsLive) {
        try {
            const data = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
            return data; // Retourne les données si la requête réussit
        } catch (error) {
            console.error(`Failed to fetch votepower from endpoint ${endpoint} pour ${planet}. Trying next...`, error);
        }
    }
    showToast(`Failed to fetch votepower for ${planet} after multiple attempts.`, 'error');
    throw new Error(`Failed to fetch votepower for ${planet}.`);
}

// Nouvelle fonction pour additionner le vote power des trois planètes
async function getTotalVotepower() {
    let total = 0;
    const planets = ['magor', 'kavian', 'eyeke'];
    for (const planet of planets) {
        try {
            const response = await getVotepower(planet);
            if (response.rows.length > 0) {
                total += response.rows[0].weight / 10000;
            }
        } catch (error) {
            console.error(`Erreur lors de la récupération du votepower pour ${planet} :`, error);
        }
    }
    return total;
}

async function getDecay() {
    const userAccount = localStorage.getItem("userAccount");
    const requestData = {
        code: 'dao.worlds',
        table: 'votes',
        scope: 'magor',
        json: true,
        limit: 100,
        lower_bound: userAccount,
        upper_bound: userAccount,
    };

    for (let endpoint of apiEndpointsLive) {
        try {
            const data = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
            return data; // Retourne les données si la requête réussit
        } catch (error) {
            console.error(`Failed to fetch decay data from endpoint ${endpoint}. Trying next...`, error);
        }
    }

    // Si aucun endpoint n'a fonctionné, afficher un message d'erreur
    showToast('Failed to fetch decay data after multiple attempts.', 'error');
    throw new Error('Failed to fetch decay data.');
}


async function calculateVoteAfterDecay() {
  let weight = 0;
  try {
    const votepowerResponse = await getVotepower();
    if (votepowerResponse.rows.length > 0) {
      weight = votepowerResponse.rows[0].weight / 10000;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du votepower :", error);
  }

  let voteTimeStamp = new Date();
  try {
    const decayResponse = await getDecay();
    if (decayResponse.rows.length > 0) {
      voteTimeStamp = new Date(decayResponse.rows[0].vote_time_stamp);
    }
  } catch (error) {
    console.error("Erreur lors de la récupération du decay :", error);
  }

  const currentTime = new Date();
  const timeDifference = (currentTime - voteTimeStamp) / 1000;
  const fraction_s = timeDifference / 2629800;

  const voteafterdecay = weight > 0 ? Math.floor(weight / Math.pow(2, fraction_s)) : 0;
  return voteafterdecay;
}

if (typeof upgradeButton === 'undefined') {
    var upgradeButton;
}

function loadChestScript(callback) {
    const existingScript = document.querySelector('script[src="/js/chest.js"]');
    if (existingScript) {
        existingScript.remove();
    }


    const script = document.createElement("script");
    script.src = "/js/chest.js";
    script.onload = function() {
        if (typeof callback === "function") callback();
    };
    script.onerror = function() {
        console.error("Loading error with chest.js.");
    };
    document.head.appendChild(script);
}

async function fetchChest(landId) {
    try {
        const responseData = await fetchDataChest('chests', landId, landId);

        if (responseData && responseData.rows && responseData.rows.length > 0) {
            const chestData = responseData.rows[0];
            const bonus = await getBonusChest(chestData.chest_level);
            const upgradeCost = await getUpgradeCost(chestData.chest_level);
            const chestImageUrl = getChestImageUrl(chestData.chest_level);
            const chestTier = getTier(chestData.chest_level);
            const voteafterdecay = await getTotalVotepower();
            // Ajout des logs pour le debug du calcul du VP Percentage
            const vpMagor = await getVotepower('magor');
            const vpKavian = await getVotepower('kavian');
            const vpEyeke = await getVotepower('eyeke');
            let magorVP = 0, kavianVP = 0, eyekeVP = 0;
            if (vpMagor.rows.length > 0) magorVP = vpMagor.rows[0].weight / 10000;
            if (vpKavian.rows.length > 0) kavianVP = vpKavian.rows[0].weight / 10000;
            if (vpEyeke.rows.length > 0) eyekeVP = vpEyeke.rows[0].weight / 10000;
            const totalVP = magorVP + kavianVP + eyekeVP;
            console.log('VP Magor:', magorVP);
            console.log('VP Kavian:', kavianVP);
            console.log('VP Eyeke:', eyekeVP);
            console.log('Total VP:', totalVP);
            const bonusVP = await getBonusVP(totalVP);
            console.log('Bonus VP (%):', bonusVP);
            console.log('chestData.TLM:', chestData.TLM);
            const vpReward = (bonusVP / 100) * chestData.TLM;
            console.log('VP Reward:', vpReward);

            const baseReward = (1 / 100) * chestData.TLM;
            const chestLevelReward = (bonus / 100) * chestData.TLM;
            const totalReward = baseReward + chestLevelReward + vpReward;

            const table = `
              <table>
                <tr>
                  <td><img src="../images/level.png" class="img-fluid img-chest"><p>Level Chest</p></td>
                  <td><img src="../images/bonus.png" class="img-fluid img-chest"><p>Bonus Level</p></td>
                </tr>
                <tr>
                  <td class="color-point fs-6">${chestData.chest_level}</td>
                  <td class="color-point fs-6">${bonus}%</td>
                </tr>
                <tr>
                  <td><img src="../images/vpdecay.png" class="img-fluid img-chest"><p>VP After Decay</p></td>
                  <td><img src="../images/bonusvp.png" class="img-fluid img-chest"><p>Bonus VP</p></td>
                </tr>
                <tr>
                  <td class="color-point fs-6">${voteafterdecay}</td>
                  <td class="color-point fs-6">${bonusVP}%</td>
                </tr>
                <tr>
                  <td><img src="../images/storage.png" class="img-fluid img-chest"><p>PDT Stored</p></td>
                  <td><img src="../images/upgrade.png" class="img-fluid img-chest"><p>Upgrade cost</p></td>
                </tr>
                <tr>
                  <td class="color-point fs-6">${chestData.TLM}</td>
                  <td class="color-point fs-6">${upgradeCost}</td>
                </tr>
              </table>
              <div id="btn-forge-upgrade"></div>
            `;
          
		  const payoutContent = `
			<h4 class="mb-4"><b>Estimated Payout Calculation</b></h4>
			<p>Base Reward<br>1% of ${chestData.TLM}<br><span class="color-point fs-6">${baseReward.toFixed(2)}</span></p>
			<p>Chest Percentage<br>${bonus}% of ${chestData.TLM}<br><span class="color-point fs-6">${chestLevelReward.toFixed(2)}</span></p>
			<p>VP Percentage<br> ${bonusVP}% of ${chestData.TLM}<br><span class="color-point fs-6">${vpReward.toFixed(2)}</span></p>
			<p>Total<br> ${baseReward.toFixed(2)} + ${chestLevelReward.toFixed(2)} + ${vpReward.toFixed(2)}<br><span class="color-point fs-6"><strong>${totalReward.toFixed(2)}</strong></span></p>
			<p><em>This calculation is an approximation and may vary slightly.</em></p>
		  `;
		     const chestCalcPayoutElement = document.getElementById('chest-calcpayout');
              if (chestCalcPayoutElement) {
                chestCalcPayoutElement.innerHTML = payoutContent;
              }
          
            const chestInfoElement = document.getElementById('chest-info');
            if (chestInfoElement) {
                chestInfoElement.innerHTML = table;
            }

            const chestImageElement = document.getElementById('chestimage');
            if (chestImageElement) {
                chestImageElement.src = chestImageUrl;
            }

            const chestTierElement = document.getElementById('chest-tier');
            if (chestTierElement) {
                chestTierElement.textContent = chestTier;
            }

            const upgradeButtonContainer = document.getElementById('btn-forge-upgrade');
            if (upgradeButtonContainer) {
                upgradeButtonContainer.innerHTML = '';
                upgradeButton = document.createElement('img'); 
                upgradeButton.src = "../images/upgrade_button.png";
                upgradeButton.alt = "Upgrade";
                upgradeButton.id = "upgrade";
                upgradeButton.classList.add("img-fluid", "chestbtn-hover", "disabled");

                upgradeButtonContainer.appendChild(upgradeButton);
            }

            loadChestScript(function() {
                if (upgradeButton) {
                    upgradeButton.classList.remove("disabled");
                }
            });

            return upgradeCost;
        } else {
            throw new Error("No chest data found for the provided land ID.");
        }
    } catch (error) {
        console.error("Failed to fetch chest data:", error);
        const chestInfoElement = document.getElementById('chest-info');
        if (chestInfoElement) {
            chestInfoElement.textContent = "Failed to load chest data.";
        }
    }
}


// Get tier based on chest level
function getTier(chestLevel) {
    if (chestLevel >= 1 && chestLevel <= 5) {
        return 'Tier I';
    } else if (chestLevel >= 6 && chestLevel <= 10) {
        return 'Tier II';
    } else if (chestLevel >= 11 && chestLevel <= 15) {
        return 'Tier III';
    } else if (chestLevel === 16) {
        return 'Tier X';
    } else {
        return 'Unknown Tier';
    }
}

async function getBonusVP(votePower) {
  const bonusVPMap = [
    { threshold: 1, bonus: 0.5 },
    { threshold: 1000, bonus: 1 },
    { threshold: 3000, bonus: 1.5 },
    { threshold: 5000, bonus: 2 },
    { threshold: 10000, bonus: 2.5 },
    { threshold: 15000, bonus: 3 },
    { threshold: 20000, bonus: 3.5 },
    { threshold: 25000, bonus: 4 },
    { threshold: 50000, bonus: 4.5 },
    { threshold: 75000, bonus: 5 },
    { threshold: 100000, bonus: 5.5 },
    { threshold: 125000, bonus: 6 },
    { threshold: 150000, bonus: 6.5 },
    { threshold: 200000, bonus: 7 },
    { threshold: 250000, bonus: 7.5 },
    { threshold: 300000, bonus: 8 },
    { threshold: 350000, bonus: 8.5 },
    { threshold: 400000, bonus: 9 },
    { threshold: 450000, bonus: 9.5 },
    { threshold: 500000, bonus: 10 },
    { threshold: 600000, bonus: 10.5 },
    { threshold: 700000, bonus: 11 },
    { threshold: 800000, bonus: 11.5 },
    { threshold: 900000, bonus: 12 },
    { threshold: 1000000, bonus: 12.5 },
    { threshold: 1250000, bonus: 13 },
    { threshold: 1500000, bonus: 13.5 },
    { threshold: 2000000, bonus: 14 },
    { threshold: 2500000, bonus: 14.5 },
    { threshold: 3000000, bonus: 15 },
    { threshold: 3500000, bonus: 15.5 },
    { threshold: 4000000, bonus: 16 },
    { threshold: 4500000, bonus: 16.5 },
    { threshold: 5000000, bonus: 17 },
    { threshold: 6000000, bonus: 17.5 },
    { threshold: 7000000, bonus: 18 },
    { threshold: 8000000, bonus: 18.5 },
    { threshold: 9000000, bonus: 19 },
    { threshold: 10000000, bonus: 19.5 },
    { threshold: 15000000, bonus: 20 }
  ];

  // Parcourir le tableau pour trouver le bonus correspondant au palier le plus bas pour le votePower donné
  let applicableBonus = 0;
  for (const entry of bonusVPMap) {
    if (votePower >= entry.threshold) {
      applicableBonus = entry.bonus;
    } else {
      break; // Arrêter la boucle une fois que le threshold est dépassé
    }
  }
  return applicableBonus;
}


// Get bonus percentage based on chest level
async function getBonusChest(chestLevel) {
    const bonusMap = {
        1: 2.5, 2: 5, 3: 7.5, 4: 10, 5: 12.5,
        6: 15, 7: 17.5, 8: 20, 9: 22.5, 10: 25,
        11: 27.5, 12: 30, 13: 32.5, 14: 35, 15: 37.5,
        16: 40
    };
    return bonusMap[chestLevel] || 0;
}

// Get upgrade cost based on chest level
async function getUpgradeCost(chestLevel) {
    const costMap = {
        0: 100, 1: 200, 2: 300, 3: 400, 4: 500,
        5: 1000, 6: 1500, 7: 2000, 8: 2500, 9: 3000,
        10: 3500, 11: 4000, 12: 5000, 13: 6000, 14: 7500,
        15: 10000
    };
    return costMap[chestLevel] || 0;
}

// Get chest image URL based on chest level
function getChestImageUrl(chestLevel) {
    const baseUrl = "../images/";
    const imageMap = {
        0: "Level1.png", 1: "Level2.png", 2: "Level3.png", 3: "Level4.png", 4: "Level5.png",
        5: "Level6.png", 6: "Level7.png", 7: "Level8.png", 8: "Level9.png", 9: "Level10.png",
        10: "Level1.png", 11: "Level12.png", 12: "Level13.png", 13: "Level14.png", 14: "Level15.png",
        15: "Level16.png"
    };
    return baseUrl + (imageMap[chestLevel] || "default_chest.png");
}

// Function to reset the active class from all land elements
function resetLands() {
    document.querySelectorAll('.land-id').forEach(land => land.classList.remove('active'));
}

// Display lands for a given player name
async function displayPlayerLands(playerName) {
    try {
        const landData = await fetchLand(playerName);
        const landListParagraph = document.getElementById('landlist');
        landListParagraph.innerHTML = ''; // Clear existing content

        if (landData.length > 0) {
            let selectedLandId = null; // This variable will hold the selected land ID

            for (const landId of landData) {
                try {
                    const templateResponse = await fetch(`https://atomic.3dkrender.com/atomicassets/v1/assets/${landId}`);
                    const templateData = await templateResponse.json();
                    const landElement = document.createElement('div');
                    landElement.textContent = `Land ID: ${landId} - ${templateData.data.name}`;
                    landElement.setAttribute('data-landid', landId);
                    landElement.classList.add('land-id'); // Add the land-id class to each element

                    landElement.addEventListener('click', function () {
                        resetLands(); // Reset the active class from all land elements
                        landElement.classList.add('active'); // Add the active class to the clicked element
                        selectedLandId = landId;
                        fetchChest(selectedLandId);
                        saveSelectedLandId(selectedLandId); // Save selected land ID to localStorage
                        addExplanatoryText();
                    // Activer la mise en cache globale pour éviter le paramètre anti-cache
                    $.ajaxSetup({ cache: true });
                    
                    // Ajouter un délai avant de charger le script
                    setTimeout(function() {
                        $.getScript("js/chest.js", function() {
                        }).fail(function(jqxhr, settings, exception) {
                            console.error("Error loading chest script:", exception);
                        });
                    }, 500);
                    });

                    landListParagraph.appendChild(landElement);
                } catch (templateError) {
                    console.error("Error fetching template data:", templateError);
                    const landElement = document.createElement('div');
                    landElement.textContent = `Land ID: ${landId} (Details unavailable)`;
                    landElement.classList.add('land-id'); // Add the land-id class to each element
                    landListParagraph.appendChild(landElement);
                }
            }
        } else {
            const spanElement = document.createElement('span');
            spanElement.textContent = 'No Land.';
            addExplanatoryText();
            landListParagraph.appendChild(spanElement);
        }
    } catch (error) {
        console.error("Error displaying lands:", error);
        landListParagraph.textContent = 'Failed to display lands.';
    }
}
function addExplanatoryText() {
    const explanatoryTextElement = document.getElementById('explanatory-content');
    if (explanatoryTextElement) {
        explanatoryTextElement.innerHTML = "This section provides details about your land chests.<br>Click on a land ID to view and manage its chest.<br>As you progress through the chest levels, both your protection percentage and payouts will increase. This allows you to automatically claim a larger portion of the chest funds with each payout instance. Additionally, the chests provide protection if you become a target in PvP. Make sure to manage your resources wisely!";
    }
}

// Retrieve userAccount from localStorage
var userAccount = localStorage.getItem("userAccount");

// Initialize the display with the user account
displayPlayerLands(userAccount);