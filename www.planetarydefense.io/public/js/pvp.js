(async function() {
	if (window.pvpScriptLoaded) {
		return;
	}
	window.pvpScriptLoaded = true;
	
    let cooldownInterval;
    let chestData = [];
    let votepowerData = null;
    let decayData = null;
    let periodicUpdateInterval;
    let isRefreshing = false;
    
    const userAccount = localStorage.getItem("userAccount");
    async function startPeriodicUpdate() {
        if (periodicUpdateInterval) {
            clearInterval(periodicUpdateInterval);
        }
        periodicUpdateInterval = setInterval(async () => {
            if (document.getElementById('pvp-center')) { // Assuming 'pvp-center' is a unique element in pvp.html
                await periodicUpdate();
            }
        }, 1 * 60 * 1000); // 5 minutes
    }
    function stopPeriodicUpdate() {
        if (periodicUpdateInterval) {
            clearInterval(periodicUpdateInterval);
            periodicUpdateInterval = null;
        }
    }

        async function initializePvP() {
			if (!document.currentScript || !document.currentScript.src.includes("pvp.js")) {
				console.warn("Script exécuté depuis VMxxxx, arrêt...");
				return;
			}
            showLoading();
            try {
                let pvpData = await fetchPvpData();
                votepowerData = await getVotepower(pvpData.selected_player);
                decayData = await getDecay(pvpData.selected_player);
                chestData = await fetchDataChestDetail();
                // Filtrer les coffres par pvpData.land_id uniquement
                const playerChests = chestData.filter(chest => chest.land_id === pvpData.land_id);
                // Calculer le total des TLM pour ce land_id
                const totalChest = playerChests.reduce((sum, chest) => sum + chest.TLM, 0);
                const chestRewards = await calculateChestRewards(playerChests);
                displayPhase(pvpData);
                
            // Exemple d'utilisation dans initializePvP
            const avatarImage = await fetchPlayerAvatar(pvpData.selected_player);
            const avatarContainer = document.getElementById('avatar-container');
            if (avatarContainer) {
                const avatarElement = document.getElementById('avatarImagepvp');
                avatarElement.src = avatarImage || defaultAvatarUrl;
                avatarContainer.style.display = 'flex';
            }
                hideLoading();
                startPeriodicUpdate(); // Ajoutez cet appel pour démarrer les mises à jour périodiques
                window.addEventListener('beforeunload', function() {
                    stopPeriodicUpdate();
                });
            } catch (error) {
                console.error('Error initializing PvP:', error);
                hideLoading();
            }
        }

        window.initializePvP = initializePvP;
    function checkAndInitializePvP() {
        if (document.getElementById('pvp-center')) { // Assuming 'pvp-center' is a unique element in pvp.html
            initializePvP();
        } else {
            stopPeriodicUpdate();
        }
    }

    // Ajoutez un observateur de mutations pour détecter les changements de page
    const observer = new MutationObserver(checkAndInitializePvP);
    observer.observe(document.getElementById('pvp-center'), { childList: true });
	
	function handleVisibilityChange() {
		if (document.visibilityState === 'visible') {
			const pvpCenter = document.getElementById('pvp-center');

			if (pvpCenter) {
				refreshCooldownOnTabFocus();
			} else {
				console.log('pvp-center block not Found, Contact Dev on Discord.');
			}
		} else {
			if (cooldownInterval) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
			}
			stopPeriodicUpdate();
		}
	}

	// Ré-attache l'événement si jamais il a été perdu après un nettoyage
	document.removeEventListener('visibilitychange', handleVisibilityChange);
	document.addEventListener('visibilitychange', handleVisibilityChange);



    async function fetchPvpData() {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: "pvp3",
            scope: window.planetData.WalletMission,
            reverse: true,
            limit: 1,
        };
    
        let lastError = null; // Stocker la dernière erreur pour le débogage
    
        for (let endpoint of apiEndpointsLive) {
            try {
                const data = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
    
                if (data.rows && data.rows.length > 0) {
                    window.pvpGlobalData = data.rows[0]; // Rendre les données accessibles globalement
                    return data.rows[0];
                }
            } catch (error) {
                lastError = error;
                console.error(`Error fetching PVP data from ${endpoint}:`, error);
            }
        }
    
        // Si tous les endpoints échouent
        showToast('Failed to fetch PVP data after multiple attempts.', 'error');
        if (lastError) console.error('Last error:', lastError);
    
        // Retourner les données par défaut
        const defaultData = getDefaultPvpData();
        window.pvpGlobalData = defaultData;
        return defaultData;
    }

    function getDefaultPvpData() {
        return {
            id: 0,
            selected_player: "0",
            land_id: 0,
            defense_list: [""],
            attack_list: [""],
            defense_score: 0,
            attack_score: 0,
            winner: "Default",
            phase: "Default",
            defense_end_time: 0,
            attack_end_time: 0
        };
    }

async function fetchPlayerAvatar(selectedPlayer) {
    const defaultAvatarUrl = "../images/20241021_214433_0000.png"; // Remplacez par l'URL de votre avatar par défaut

    const requestPlayerData = {
        code: "federation",
        table: "players",
        scope: "federation",
        json: true,
        limit: 1,
        lower_bound: selectedPlayer,
        upper_bound: selectedPlayer,
    };

    try {
        let allEndpointsFailed = true; // Indicateur pour vérifier si tous les endpoints échouent

        // Boucle sur les endpoints pour la requête principale
        for (const endpoint of apiEndpointsLive) {
            try {
                const playerResponse = await apiRequestWithRetryh(endpoint, requestPlayerData, 1);
                if (playerResponse && playerResponse.rows.length > 0) {
                    allEndpointsFailed = false; // Un endpoint a réussi
                    const avatarId = playerResponse.rows[0]?.avatar;

                    if (avatarId) {
                        // Récupérer les données de l'avatar
                        const assetUrl = `https://wax.api.atomicassets.io/atomicassets/v1/assets/${avatarId}`;
                        const assetResponse = await fetch(assetUrl);

                        if (assetResponse.ok) {
                            const assetData = await assetResponse.json();
                            const templateId = assetData.data?.template?.template_id;

                            if (templateId) {
                                const requestMcData = {
                                    code: "members.mc",
                                    table: "avatars",
                                    scope: "members.mc",
                                    json: true,
                                    limit: 100,
                                    lower_bound: templateId,
                                    upper_bound: templateId,
                                };

                                // Boucle sur les endpoints pour les données MC
                                for (const mcEndpoint of apiEndpointsLive) {
                                    try {
                                        const mcResponse = await apiRequestWithRetryh(mcEndpoint, requestMcData, 1);
                                        if (mcResponse && mcResponse.rows.length > 0) {
                                            return generateImgUrl(mcResponse.rows[0]?.image || defaultAvatarUrl);
                                        }
                                    } catch (mcError) {
                                        console.error(`MC Data API Error on ${mcEndpoint}:`, mcError);
                                    }
                                }

                                console.error("MC data not found for the avatar.");
                            } else {
                                console.error("Template ID not found for the avatar.");
                            }
                        } else {
                            console.error("Failed to retrieve avatar information.");
                        }
                    }
                }
            } catch (playerError) {
                console.error(`Player API Error on ${endpoint}:`, playerError);
                return defaultAvatarUrl;
            }
        }

        if (allEndpointsFailed) {
            showToast("All endpoints failed to fetch player data. Please try again later.", "error");
        }
    } catch (error) {
        console.error('Error fetching avatar:', error);
        showToast("An unexpected error occurred while fetching the avatar.", "error");
    }

    return defaultAvatarUrl;
}



function generateImgUrl(imagePath) {
    const defaultAvatarUrl = "../images/20241021_214433_0000.png"; // URL de l'avatar par défaut
    try {
        if (!imagePath) throw new Error("Invalid image path");
        return `https://beastgarden.mypinata.cloud/ipfs/${imagePath}`;
    } catch (error) {
        console.error("Error generating image URL:", error);
        return defaultAvatarUrl;
    }
}

async function fetchDataChestDetail() {
    try {
        const limit = 1000;
        let allChests = [];
        let lower_bound = "";
        let more = true;

        while (more) {
            const requestData = {
                json: true,
                code: window.planetData.WalletMission,
                scope: window.planetData.WalletMission,
                table: 'chests',
                limit: limit,
                lower_bound: lower_bound,
            };

            let fetched = false;

            for (const endpoint of apiEndpointsLive) {
                try {
                    const response = await apiRequestWithRetryh(endpoint, requestData, 1);
                    if (response && response.rows) {
                        allChests = allChests.concat(response.rows);
                        fetched = true;

                        more = response.more;
                        if (more) {
                            lower_bound = response.next_key;
                        }

                        break;
                    }
                } catch (error) {
                    console.error(`Error fetching chest details from ${endpoint}:`, error);
                }
            }

            if (!fetched) {
                showToast("All endpoints failed to fetch chest details. Please try again later.", "error");
                return null;
            }
        }

        console.log(`Successfully fetched ${allChests.length} chests.`);

        // Exemple de transformation de données (à adapter si nécessaire)
        return allChests

    } catch (error) {
        console.error('Unexpected error:', error);
        showToast("An unexpected error occurred. Check console for details.", "error");
        return null;
    }
}



    function calculateUnprotectedChest(totalChest, protectedChest) {3
        return totalChest - protectedChest;
    }

    async function displayPhase(pvpData) {
        if (!document.getElementById('selected-player')) return;

        const countdownTimer = document.getElementById('countdown-timer');
        const now = Math.floor(getCurrentUserTime().getTime() / 1000); // Get current time in seconds
        const defenseEndTimeUTC = pvpData.defense_end_time;
        const attackEndTimeUTC = pvpData.attack_end_time;

        const defenseEndTimeLocal = new Date(defenseEndTimeUTC * 1000);
        const attackEndTimeLocal = new Date(attackEndTimeUTC * 1000);

        const defenseEndTime = defenseEndTimeLocal.getTime() / 1000;
        const attackEndTime = attackEndTimeLocal.getTime() / 1000;

        const defenseCooldownLeft = Math.max(defenseEndTime - now, 0); // Ensure no negative values
        const attackCooldownLeft = Math.max(attackEndTime - now, 0); // Ensure no negative values

        const selectedPlayerElement = document.getElementById('selected-player');
        if (selectedPlayerElement) {
            selectedPlayerElement.textContent = pvpData.selected_player;
        }

        // Fetch chest details if not already fetched
        if (chestData.length === 0) {
            chestData = await fetchDataChestDetail();
        }

        // Filter chest data for the selected player
        const playerChests = chestData.filter(chest => chest.land_id === pvpData.land_id);
        const totalChest = playerChests.reduce((sum, chest) => sum + chest.TLM, 0);
        const chestRewards = await calculateChestRewards(playerChests);
        const unprotectedChest = calculateUnprotectedChest(totalChest, chestRewards);

        // Display top 10 chests
        displayTopChests(chestData);

                if (countdownTimer && pvpData.phase === 'result') {
                    countdownTimer.style.display = "block";
                    const resultsEndTime = pvpData.attack_end_time + 2 * 24 * 60 * 60;
                    startResultCountdown(resultsEndTime);
                
            } else {
                // Handle cooldown for other phases
                updateCooldown(
                    pvpData.phase === 'defense' ? defenseCooldownLeft : attackCooldownLeft,
                    pvpData.phase,
                    () => {
                        if (cooldownElement) {
                            cooldownElement.textContent = "Phase Ended";
                        }
                    }
                );

                if (countdownTimer) {
                    countdownTimer.style.display = "none"; // Hide during other phases
                }
            }
        

        // Display phase details for all phases
        const phaseDetails = document.getElementById('phase-details');
        if (phaseDetails) {
            phaseDetails.innerHTML = `
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Total Chest: ${totalChest} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Protected Chest: ${chestRewards.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Unprotected Chest: ${unprotectedChest.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Land ID:</span>
                    <span class="land-id-value total-point">${pvpData.land_id}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Planet:</span>
                    <span class="land-id-value total-point">${window.planetData.Name}</span>
                </p>
            `;
        }

        // Call `updateCooldown` with the current phase
        if (pvpData.phase === 'defense') {
            updatePvpState(pvpData, userAccount);
            displayDefensePhase(pvpData, defenseCooldownLeft, totalChest, chestRewards, unprotectedChest);
        } else if (pvpData.phase === 'attack') {
            updatePvpState(pvpData, userAccount);
            displayAttackPhase(pvpData, attackCooldownLeft, totalChest, chestRewards, unprotectedChest);
        } else if (pvpData.phase === 'result') {
            displayVictory(pvpData, totalChest, chestRewards, unprotectedChest);
        }
    }


    let resultCountdownInterval = null; // Variable globale pour stocker l'intervalle
    
function startResultCountdown(endTime, containerId) {
    const countdownTimer = document.getElementById('countdown-timer');
    if (!countdownTimer) return;

    // Nettoyer tout intervalle existant pour éviter des doublons
    if (resultCountdownInterval) {
        clearInterval(resultCountdownInterval);
    }

    // Créer la structure HTML une fois
    countdownTimer.innerHTML = `
        <span class="planet-color-dynamique m-auto">Next PvP in :</span>
        <div id="countdown-container">
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-days">0</span>
                <span class="countdown-label">Days</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-hours">0</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-minutes">0</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-seconds">0</span>
                <span class="countdown-label">Seconds</span>
            </div>
        </div>
    `;

    const daysElement = document.getElementById(`${containerId}-days`);
    const hoursElement = document.getElementById(`${containerId}-hours`);
    const minutesElement = document.getElementById(`${containerId}-minutes`);
    const secondsElement = document.getElementById(`${containerId}-seconds`);

    // Fonction pour mettre à jour le compte à rebours
    const updateCountdown = () => {
        const now = Math.floor(Date.now() / 1000); // Temps actuel en secondes
        const timeLeft = endTime - now; // Temps restant en secondes

        if (timeLeft <= 0) {
            clearInterval(resultCountdownInterval);
            resultCountdownInterval = null; // Réinitialiser l'intervalle
            countdownTimer.textContent = "The results phase has ended!";
        } else {
            const days = Math.floor(timeLeft / (24 * 3600));
            const hours = Math.floor((timeLeft % (24 * 3600)) / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;

            // Mettre à jour les éléments HTML
            daysElement.textContent = days;
            hoursElement.textContent = hours;
            minutesElement.textContent = minutes;
            secondsElement.textContent = seconds;
        }
    };

    // Démarrer le compte à rebours
    updateCountdown(); // Mise à jour immédiate pour éviter le décalage initial
    resultCountdownInterval = setInterval(updateCountdown, 1000);

    // Gérer la visibilité de la page
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateCountdown(); // Recalcule immédiatement à chaque retour sur l'onglet
        }
    });
}


    async function calculateChestRewards(chests) {
        let rewards = 0;
        for (const chest of chests) {
            const protectionPercentage = await calculateProtectionPercentage(chest.chest_level);
            //const votePower = await getVotepower(chest.owner);
            //const decay = await getDecay(chest.owner);
            //const voteAfterDecay = calculateVoteAfterDecay(votePower, decay);
            //const rewardPercentage = calculateRewardPercentage(voteAfterDecay);
            const rewardAmount = chest.TLM * protectionPercentage / 100;
            rewards += rewardAmount;
        }
        return rewards;
    }

    async function calculateProtectionPercentage(chestLevel) {
        const bonusMapDetail = {
            1: 2.5, 2: 5, 3: 7.5, 4: 10, 5: 12.5,
            6: 15, 7: 17.5, 8: 20, 9: 22.5, 10: 25,
            11: 27.5, 12: 30, 13: 32.5, 14: 35, 15: 37.5,
            16: 40
        };
        return bonusMapDetail[chestLevel] || 0;
    }

    async function getVotepower(owner) {
        if (votepowerData) return votepowerData;

        const requestData = {
            code: 'stkvt.worlds',
            table: 'weights',
            scope: window.planetData.Name.toLowerCase(),
            json: true,
            limit: 100,
            lower_bound: owner,
            upper_bound: owner,
        };

        for (const endpoint of apiEndpointsLive) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData, 1);
                if (response && response.rows.length > 0) {
                    votepowerData = response.rows[0].weight / 10000;
                    return votepowerData;
                }
            } catch (error) {
                console.error(`Error fetching vote power from ${endpoint}:`, error);
            }
        }

        showToast("All endpoints failed to fetch vote power. Please try again later.", "error");
        return 0;
    }

    async function getDecay(owner) {
        if (decayData) return decayData;

        const requestData = {
            code: 'dao.worlds',
            table: 'votes',
            scope: window.planetData.Name.toLowerCase(),
            json: true,
            limit: 100,
            lower_bound: owner,
            upper_bound: owner,
        };

        for (const endpoint of apiEndpointsLive) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData, 1);
                if (response && response.rows.length > 0) {
                    decayData = new Date(response.rows[0].vote_time_stamp);
                    return decayData;
                }
            } catch (error) {
                console.error(`Error fetching decay data from ${endpoint}:`, error);
            }
        }

        showToast("All endpoints failed to fetch decay data. Please try again later.", "error");
        return new Date();
    }


    function calculateVoteAfterDecay(weight, voteTimeStamp) {
        const currentTime = new Date();
        const timeDifference = (currentTime - voteTimeStamp) / 1000;
        const fraction_s = timeDifference / 2629800;

        return weight > 0 ? weight / Math.pow(2, fraction_s) : 0;
    }

    function calculateRewardPercentage(voteafterdecay) {
        const thresholds = [
            1, 1000, 3000, 5000, 10000, 15000, 20000, 25000, 50000, 75000, 100000,
            125000, 150000, 200000, 250000, 300000, 350000, 400000, 450000,
            500000, 600000, 700000, 800000, 900000, 1000000, 1250000, 1500000,
            2000000, 2500000, 3000000, 3500000, 4000000, 4500000, 5000000,
            6000000, 7000000, 8000000, 9000000, 10000000, 15000000
        ];

        for (let i = 0; i < thresholds.length; i++) {
            if (voteafterdecay < thresholds[i]) {
                return i === 0 ? 1.5 : i * 0.5; // Ajoute le premier palier à 0.5% et incrémente par 0.5%
            }
        }
        return 21; // Retourne 20% pour les valeurs au-dessus du dernier palier
    }

    function displayDefensePhase(pvpData, cooldownLeft, totalChest, chestRewards, unprotectedChest) {
        document.getElementById('phase-title').innerHTML = `<h1 class="title-defense ethno">Defense Phase</h1><br><p class="land-id-text lato fs-5 text-center">Score : <span class="land-id-value title-defense">${pvpData.defense_score}</span></p>`;
        const phaseDetails = document.getElementById('phase-details');
        if (phaseDetails) {
            phaseDetails.innerHTML = `
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Total Chest:</span>
                    <span class="land-id-value total-point">${totalChest} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Protected Chest:</span>
                    <span class="land-id-value total-point">${chestRewards.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Unprotected Chest:</span>
                    <span class="land-id-value total-point">${unprotectedChest.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Land ID:</span>
                    <span class="land-id-value total-point">${pvpData.land_id}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Planet:</span>
                    <span class="land-id-value total-point">${window.planetData.Name}</span>
                </p>
            `;
        }
        document.getElementById('attack-list').innerHTML = ''; // Clear the attack list
        document.getElementById('pvp_defense').style.display = 'block';
        document.getElementById('pvp_attack').style.display = 'none';
        displayList('defense-list', pvpData.defense_list, 'defense');
        updateCooldown(cooldownLeft, 'defense', () => {
            const cooldownElement = document.getElementById('cooldown');
            if (cooldownElement) {
                cooldownElement.textContent = "Phase Ended";
            }
            document.getElementById('pvp_defense').classList.add('disabled');
        });
    }

    function displayAttackPhase(pvpData, cooldownLeft, totalChest, chestRewards, unprotectedChest) {
        const totalDefenseScore = pvpData.defense_score;
        
        // Vérifiez si totalDefenseScore est 0 pour éviter une division par zéro
        const attackProgress = totalDefenseScore > 0
            ? (pvpData.attack_score / totalDefenseScore) * 100
            : 100; // Si totalDefenseScore est 0, définissez attackProgress à 0

        document.getElementById('phase-title').innerHTML = `<h1 class="title-attack ethno">Attack Phase</h1>`;
        const phaseDetails = document.getElementById('phase-details');
        if (phaseDetails) {
            phaseDetails.innerHTML = `
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Total Chest:</span>
                    <span class="land-id-value total-point">${totalChest} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Protected Chest:</span>
                    <span class="land-id-value total-point">${chestRewards.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Unprotected Chest:</span>
                    <span class="land-id-value total-point">${unprotectedChest.toFixed(2)} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Land ID:</span>
                    <span class="land-id-value total-point">${pvpData.land_id}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Planet:</span>
                    <span class="land-id-value total-point">${window.planetData.Name}</span>
                </p>
            `;
        }
        document.getElementById('defense-list').innerHTML = ''; // Clear the defense list
        document.getElementById('pvp_defense').style.display = 'none';
        document.getElementById('pvp_attack').style.display = 'block';
        displayList('attack-list', pvpData.attack_list, 'attack', attackProgress, pvpData.attack_score, totalDefenseScore);
        updateCooldown(cooldownLeft, 'attack', () => {
            const cooldownElement = document.getElementById('cooldown');
            if (cooldownElement) {
                cooldownElement.textContent = "Phase Ended";
            }
            document.getElementById('pvp_attack').classList.add('disabled');
        });
    }
        function formatRewards(rewards) {
            // Convertir la récompense en un nombre et la formater avec 4 décimales
            const rewardValue = parseFloat(rewards);
            return rewardValue.toFixed(0); // Retourne un format avec 4 chiffres après la virgule
        }
    function displayVictory(pvpData, totalChest, chestRewards, unprotectedChest) {
        if (!document.getElementById('phase-title')) return;

        let result = 'Draw';
        if (pvpData.defense_score >= pvpData.attack_score) {
            result = `Defense Victory`;
            document.getElementById('phase-title').innerHTML = `<h1 class="title-defense ethno">${result}</h1>`;
        } else {
            result = `Attack Victory`;
            document.getElementById('phase-title').innerHTML = `<h1 class="title-attack ethno">${result}</h1>`;
        }
        const phaseDetails = document.getElementById('phase-details');
        if (phaseDetails) {
            if (result === 'Attack Victory') {
            const formattedRewards = formatRewards(pvpData.rewards);    
            phaseDetails.innerHTML = `
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Reward Total:</span>
                    <span class="land-id-value total-point">${formattedRewards} PDT</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Land ID:</span>
                    <span class="land-id-value total-point">${pvpData.land_id}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Planet:</span>
                    <span class="land-id-value total-point">${window.planetData.Name}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Attack Score:</span>
                    <span class="land-id-value title-attack">${pvpData.attack_score}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Defense Score:</span>
                    <span class="land-id-value title-defense">${pvpData.defense_score}</span>
                </p>
            `;
            } else if (result === 'Defense Victory') {
            phaseDetails.innerHTML = `
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Reward Total:</span>
                    <span class="land-id-value total-point">200 PDT In Chest</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Land ID:</span>
                    <span class="land-id-value total-point">${pvpData.land_id}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Planet:</span>
                    <span class="land-id-value total-point">${window.planetData.Name}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Attack Score:</span>
                    <span class="land-id-value title-attack">${pvpData.attack_score}</span>
                </p>
                <p class="planet-color-dynamique">
                    <span class="land-id-text lato">Defense Score:</span>
                    <span class="land-id-value title-defense">${pvpData.defense_score}</span>
                </p>
            `;
            }
        }
        document.getElementById('cooldown').textContent = 'PvP Ended';
        document.getElementById('pvp_defense').style.display = 'none';
        document.getElementById('pvp_attack').style.display = 'none';
        document.getElementById('defense-list').innerHTML = ''; // Clear the defense list
        document.getElementById('attack-list').innerHTML = ''; // Clear the attack list
    }

function displayList(elementId, list, phase, attackProgress = null, attackScore = null, defenseScore = null) {
    const listElement = document.getElementById(elementId);

    if (listElement) {
        // Vider l'élément cible
        listElement.innerHTML = '';

        // Ajouter un conteneur principal pour le titre, la barre de progression (si applicable) et la liste
        const container = document.createElement('div');
        container.classList.add('d-flex', 'flex-column', 'align-items-center', 'w-100');

        // Ajouter le titre en fonction de la phase
        const title = document.createElement('h4');
        title.classList.add('text-center', 'mb-3', 'planet-color-dynamique', 'm-auto');
        title.textContent = phase === 'defense' ? 'Defense Roster' : 'Attack Roster';
        container.appendChild(title);

        // Ajouter la barre de progression si la phase est "attack"
        if (phase === 'attack' && attackProgress !== null && attackScore !== null && defenseScore !== null) {
            const progressContainer = document.createElement('div');
            progressContainer.classList.add('progress', 'mb-3', 'progress-bar-back', 'position-relative');
            progressContainer.style.width = '300px';
            progressContainer.style.height = '30px';

            const progressBar = document.createElement('div');
            progressBar.classList.add('progress-bar', 'bg-danger-pvp', 'progress-bar-custom');
            progressBar.setAttribute('role', 'progressbar');
            progressBar.style.width = `${attackProgress.toFixed(2)}%`;
            progressBar.setAttribute('aria-valuenow', attackScore);
            progressBar.setAttribute('aria-valuemin', '0');
            progressBar.setAttribute('aria-valuemax', defenseScore);

            const progressText = document.createElement('span');
            progressText.classList.add('position-absolute', 'w-100', 'text-center');
            progressText.style.color = 'black';
            progressText.style.lineHeight = '30px';
            progressText.textContent = `${attackScore} / ${defenseScore}`;

            progressContainer.appendChild(progressBar);
            progressContainer.appendChild(progressText);
            container.appendChild(progressContainer);
        }

        // Ajouter la liste
        const listContainer = document.createElement('div');
        listContainer.classList.add('d-flex', 'flex-wrap', 'justify-content-center');
        for (let i = 0; i < list.length; i += 10) {
            const columnDiv = document.createElement('div');
            columnDiv.classList.add('mx-2'); // Ajustez le style des colonnes ici
            const sublist = list.slice(i, i + 10);
            sublist.forEach(item => {
                const itemElement = document.createElement('div');
                itemElement.textContent = item;
                itemElement.classList.add('text-center');
                columnDiv.appendChild(itemElement);
            });
            listContainer.appendChild(columnDiv);
        }
        container.appendChild(listContainer);
        // Ajouter le conteneur principal à l'élément cible
        listElement.appendChild(container);
    }
}


function updatePvpState(pvpData, userAccount) {
    const defenseElement = document.getElementById('pvp_defense');
    const attackElement = document.getElementById('pvp_attack');
    
    // Gestion des listes et affichage des sections
    if (pvpData.phase === 'defense') {
        displayList('defense-list', pvpData.defense_list);
        if (defenseElement) {
            defenseElement.style.display = 'block';
            defenseElement.classList.remove('disabled');
        }
        if (attackElement) {
            attackElement.style.display = 'none';
            attackElement.classList.add('disabled');
        }
    } else if (pvpData.phase === 'attack') {
        displayList('attack-list', pvpData.attack_list);
        if (attackElement) {
            attackElement.style.display = 'block';
            attackElement.classList.remove('disabled');
        }
        if (defenseElement) {
            defenseElement.style.display = 'none';
            defenseElement.classList.add('disabled');
        }
    } else {
        if (defenseElement) {
            defenseElement.style.display = 'none';
            defenseElement.classList.add('disabled');
        }
        if (attackElement) {
            attackElement.style.display = 'none';
            attackElement.classList.add('disabled');
        }
    }

    // Désactiver les boutons si le joueur est dans la liste correspondante
    if (pvpData.defense_list && pvpData.defense_list.includes(userAccount)) {
        if (defenseElement) {
            defenseElement.classList.add('disabled');
            defenseElement.setAttribute('disabled', 'true');
        }
    }
    if (pvpData.attack_list && pvpData.attack_list.includes(userAccount) || pvpData.defense_list && pvpData.defense_list.includes(userAccount)) {
        if (attackElement) {
            attackElement.classList.add('disabled');
            attackElement.setAttribute('disabled', 'true');
        }
    }
}

    function updateCooldown(cooldownLeft, phase, callback) {
        const cooldownElement = document.getElementById('cooldown');
        if (cooldownElement) {
            if (phase === 'result') {
                cooldownElement.textContent = "PvP Ended"; // Message spécifique pour la phase "result"
            } else if (cooldownLeft <= 0) {
                cooldownElement.textContent = "Phase Ended"; // Si le temps est écoulé, afficher "Phase Ended"
                callback(); // Exécuter le callback immédiatement
                return; // Ne pas continuer le compte à rebours
            } else {
                formatCooldown(cooldownLeft, 'cooldown');
            }
        }
    
        // Clear any existing interval to prevent multiple intervals running
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
        }
    
        // Update the countdown every second
        cooldownInterval = setInterval(() => {
            cooldownLeft--;
    
            if (cooldownLeft <= 0) {
                clearInterval(cooldownInterval);
                cooldownInterval = null;
                if (cooldownElement) {
                    cooldownElement.textContent = "Phase Ended";
                }
                callback();
            } else {
                if (cooldownElement) {
                    if (phase === 'result') {
                        cooldownElement.textContent = "PvP Ended"; // Toujours afficher "PvP Ended" pour "result"
                    } else {
                        formatCooldown(cooldownLeft, 'cooldown');
                    }
                }
            }
        }, 1000);
    }


function formatCooldown(seconds, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }
    
    const days = Math.floor(seconds / (24 * 3600));
    seconds %= 24 * 3600;
    const hours = Math.floor(seconds / 3600);
    seconds %= 3600;
    const minutes = Math.floor(seconds / 60);
    seconds %= 60;
    
    container.innerHTML = `
        <div id="countdown-container">
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-days">${days}</span>
                <span class="countdown-label">Days</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-hours">${hours}</span>
                <span class="countdown-label">Hours</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-minutes">${minutes}</span>
                <span class="countdown-label">Minutes</span>
            </div>
            <div class="countdown">
                <span class="countdown-value" id="${containerId}-seconds">${seconds}</span>
                <span class="countdown-label">Seconds</span>
            </div>
        </div>
    `;
    
}
    function refreshCooldownOnTabFocus() {
        if (!isRefreshing) {
            isRefreshing = true;
            return fetchPvpData().then(pvpData => {
                displayPhase(pvpData);
                updatePvpState(pvpData, userAccount);
                isRefreshing = false;
                startPeriodicUpdate(); // Assurez-vous que les mises à jour périodiques redémarrent
            }).catch(() => {
                isRefreshing = false;
            });
        }
    }

    function periodicUpdate() {
        return fetchPvpData().then(pvpData => {
            displayPhase(pvpData);
            updatePvpState(pvpData, userAccount);
        });
    }
async function fetchPvp3Data() {
    const requestData = {
        json: true,
        code: window.planetData.WalletMission,
        table: "pvp3",
        scope: window.planetData.WalletMission,
        reverse: true,
        limit: 16,
    };

    for (let endpoint of apiEndpointsLive) {
        try {
            const data = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
            if (data.rows && data.rows.length > 0) {
                return data.rows;
            }
        } catch (error) {
            console.error(`Error fetching PVP3 data from ${endpoint}:`, error);
        }
    }

    showToast('Failed to fetch PVP3 data after multiple attempts.', 'error');
    return [];
}

async function processPvp3Data() {
    const pvp3Data = await fetchPvp3Data();
    const now = Math.floor(Date.now() / 1000);
    const ninetyDaysInSeconds = 90 * 24 * 60 * 60;
    
    const validPlayers = pvp3Data
        .filter(entry => entry.attack_end_time + ninetyDaysInSeconds >= now)
        .map(entry => entry.selected_player.toLowerCase());
    
    return validPlayers;
}
async function displayTopChests(chests) {
    const validPlayers = await processPvp3Data();
    const topChestsContainer = document.getElementById('top-chests-container');
    const column1 = document.getElementById('top-chests-list-column-1');
    const column2 = document.getElementById('top-chests-list-column-2');
    const description = document.getElementById('description-container');

    if (topChestsContainer && column1 && column2 && description) {
        topChestsContainer.style.display = 'flex';
        description.style.display = 'block';
        column1.innerHTML = ''; 
        column2.innerHTML = ''; 
        description.innerHTML = ''; 

        const sortedChests = chests.sort((a, b) => b.TLM - a.TLM).slice(0, 10);
        const seenPlayers = new Set();
        
        sortedChests.forEach((chest, index) => {
            let colorClass = '';
            if (index === 0) colorClass = 'red-text';
            else if (index >= 1 && index <= 4) colorClass = 'orange-text';
        
            let chestOwner = chest.owner.toLowerCase();
            let playerLandKey = `${chestOwner}-${chest.land_id}`;
        
            let displayIndex;
            if (validPlayers.includes(chestOwner) && !seenPlayers.has(playerLandKey)) {
                displayIndex = '#P';
                seenPlayers.add(playerLandKey);
            } else {
                displayIndex = `#${index + 1}`;
            }
        
            const chestHTML = `<p class="${colorClass}">${displayIndex}. ${chest.owner}, Level: ${chest.chest_level}, PDT: ${chest.TLM}, Land ID: ${chest.land_id}</p>`;
        
            if (index < 5) column1.innerHTML += chestHTML;
            else column2.innerHTML += chestHTML;
        });

        description.innerHTML = `
            <p class="lato pvp-chest-description planet-color-dynamique">
                In PvP, the player with the most PDT in their chest becomes the primary target! This puts their chest in the spotlight, making it an attractive target for attacks from other players.<br><br>
                To avoid being targeted, they should upgrade their chest to speed up TLM extraction and gain a protection percentage (keeping part of their TLM safe from being stolen).<br><br>
                If they’re still in the spotlight, they must strengthen their defenses and rally allies to help secure their chest.<br><br>
                Once the 72-hour defense phase ends, attackers will have a 48-hour window to attempt breaking through and looting any unprotected PDT.
            </p>
        `;
    }
}
    // Show loading overlay
    function showLoading() {
        const loadingOverlay = document.getElementById('loading-overlay-pvp');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'flex';
        }
    }

    // Hide loading overlay
    function hideLoading() {
        const loadingOverlay = document.getElementById('loading-overlay-pvp');
        if (loadingOverlay) {
            loadingOverlay.style.display = 'none';
        }
    }
    window.startPvpIntervals = async function(){
        setTimeout(() => {
            window.initializePvP();
        }, 1000); // 1000 millisecondes = 1 seconde
    };
	
	checkAndInitializePvP();
	
	window.cleanupPvP = () => {

		// Supprime les écouteurs d'événements
		window.removeEventListener('beforeunload', window.cleanupPvP);
		document.removeEventListener('visibilitychange', handleVisibilityChange);

		// Supprime les intervalles
		if (periodicUpdateInterval) {
			clearInterval(periodicUpdateInterval);
			periodicUpdateInterval = null;
		}
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
			cooldownInterval = null;
		}

		// Réinitialiser la variable pour permettre le rechargement du script
		window.pvpScriptLoaded = false;
	};

	// Ajouter la gestion propre du changement de visibilité
	document.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('beforeunload', window.cleanupPvP);

		

})();