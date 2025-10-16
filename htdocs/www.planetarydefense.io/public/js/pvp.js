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
    
    // Cache pour améliorer les performances
    const cache = {
        pvpData: null,
        chestData: null,
        votepowerData: null,
        decayData: null,
        avatarData: {},
        lastUpdate: 0,
        cacheDuration: 30000 // 30 secondes de cache
    };
    
    const userAccount = localStorage.getItem("userAccount");
    
    // Fonction optimisée pour les requêtes API avec cache et timeout réduit
    async function optimizedApiRequest(endpoint, requestData, timeout = 3000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Timeout');
            }
            throw error;
        }
    }
    
    // Fonction pour faire des requêtes en parallèle avec fallback rapide
    async function parallelApiRequest(requestData, timeout = 3000) {
        const promises = apiEndpointsLive.map(endpoint => 
            optimizedApiRequest(endpoint, requestData, timeout)
                .catch(error => ({ error, endpoint }))
        );
        
        // Attendre le premier succès ou tous les échecs
        const results = await Promise.allSettled(promises);
        
        for (const result of results) {
            if (result.status === 'fulfilled' && !result.value.error) {
                return result.value;
            }
        }
        
        throw new Error('Tous les endpoints ont échoué');
    }
    
    async function startPeriodicUpdate() {
        if (periodicUpdateInterval) {
            clearInterval(periodicUpdateInterval);
        }
        periodicUpdateInterval = setInterval(async () => {
            if (document.getElementById('pvp-center')) {
                await periodicUpdate();
            }
        }, 2 * 60 * 1000); // Réduit à 2 minutes au lieu de 5
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
            // Vérifier le cache d'abord
            const now = Date.now();
            if (cache.pvpData && (now - cache.lastUpdate) < cache.cacheDuration) {
                console.log('Utilisation du cache PvP');
                displayPhase(cache.pvpData);
                hideLoading();
                startPeriodicUpdate();
                return;
            }
            
            // Récupérer les données en parallèle
            const [pvpData, chestDataResult] = await Promise.all([
                fetchPvpData(),
                fetchDataChestDetail()
            ]);
            
            // Mettre à jour le cache
            cache.pvpData = pvpData;
            cache.chestData = chestDataResult;
            cache.lastUpdate = now;
            
            // Récupérer les données de vote power et decay en parallèle
            const [votepowerResult, decayResult] = await Promise.all([
                getVotepower(pvpData.selected_player),
                getDecay(pvpData.selected_player)
            ]);
            
            votepowerData = votepowerResult;
            decayData = decayResult;
            
            // Filtrer les coffres par pvpData.land_id uniquement
            const playerChests = chestDataResult.filter(chest => chest.land_id === pvpData.land_id);
            const totalChest = playerChests.reduce((sum, chest) => sum + chest.TLM, 0);
            const chestRewards = calculateChestRewards(playerChests);
            
            displayPhase(pvpData);
            
            // Charger l'avatar en arrière-plan
            fetchPlayerAvatar(pvpData.selected_player).then(avatarImage => {
                const avatarContainer = document.getElementById('avatar-container');
                if (avatarContainer) {
                    const avatarElement = document.getElementById('avatarImagepvp');
                    if (avatarElement) {
                        avatarElement.src = avatarImage || defaultAvatarUrl;
                        avatarContainer.style.display = 'flex';
                    }
                }
            });
            
            hideLoading();
            startPeriodicUpdate();
            window.addEventListener('beforeunload', function() {
                stopPeriodicUpdate();
            });
        } catch (error) {
            console.error('Error initializing PvP:', error);
            hideLoading();
            showToast('Erreur lors du chargement des données PvP', 'error');
        }
    }

    window.initializePvP = initializePvP;
    
    function checkAndInitializePvP() {
        if (document.getElementById('pvp-center')) {
            initializePvP();
        } else {
            stopPeriodicUpdate();
        }
    }

    // Ajouter un observateur de mutations pour détecter les changements de page
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
    
        try {
            const data = await parallelApiRequest(requestData, 3000);
            
            if (data.rows && data.rows.length > 0) {
                window.pvpGlobalData = data.rows[0];
                return data.rows[0];
            }
        } catch (error) {
            console.error('Error fetching PVP data:', error);
        }
    
        // Si tous les endpoints échouent
        showToast('Échec de récupération des données PvP', 'error');
    
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
    const defaultAvatarUrl = "../images/20241021_214433_0000.png";
    
    // Vérifier le cache d'abord
    if (cache.avatarData[selectedPlayer]) {
        return cache.avatarData[selectedPlayer];
    }

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
        const playerResponse = await parallelApiRequest(requestPlayerData, 2000);
        
        if (playerResponse && playerResponse.rows.length > 0) {
            const avatarId = playerResponse.rows[0]?.avatar;

            if (avatarId) {
                // Récupérer les données de l'avatar avec timeout court
                const assetUrl = `https://wax.api.atomicassets.io/atomicassets/v1/assets/${avatarId}`;
                const assetResponse = await fetch(assetUrl, { 
                    signal: AbortSignal.timeout(2000) 
                });

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

                        const mcResponse = await parallelApiRequest(requestMcData, 2000);
                        
                        if (mcResponse && mcResponse.rows.length > 0) {
                            const avatarUrl = generateImgUrl(mcResponse.rows[0]?.image || defaultAvatarUrl);
                            cache.avatarData[selectedPlayer] = avatarUrl;
                            return avatarUrl;
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error fetching avatar:', error);
    }

    cache.avatarData[selectedPlayer] = defaultAvatarUrl;
    return defaultAvatarUrl;
}

function generateImgUrl(imagePath) {
    const defaultAvatarUrl = "../images/20241021_214433_0000.png";
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
        let attempts = 0;
        const maxAttempts = 5; // Limiter le nombre de tentatives

        while (more && attempts < maxAttempts) {
            const requestData = {
                json: true,
                code: window.planetData.WalletMission,
                scope: window.planetData.WalletMission,
                table: 'chests',
                limit: limit,
                lower_bound: lower_bound,
            };

            try {
                const response = await parallelApiRequest(requestData, 5000);
                
                if (response && response.rows) {
                    allChests = allChests.concat(response.rows);
                    more = response.more;
                    if (more) {
                        lower_bound = response.next_key;
                    }
                } else {
                    more = false;
                }
            } catch (error) {
                console.error('Error fetching chest details:', error);
                more = false;
            }
            
            attempts++;
        }

        console.log(`Successfully fetched ${allChests.length} chests.`);
        return allChests;

    } catch (error) {
        console.error('Unexpected error:', error);
        showToast("Erreur lors de la récupération des coffres", "error");
        return [];
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
        const chestRewards = calculateChestRewards(playerChests);
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


    function calculateChestRewards(chests) {
        let rewards = 0;
        // Cache pour les pourcentages de protection
        const protectionCache = {};
        
        for (const chest of chests) {
            let protectionPercentage;
            if (protectionCache[chest.chest_level]) {
                protectionPercentage = protectionCache[chest.chest_level];
            } else {
                protectionPercentage = calculateProtectionPercentage(chest.chest_level);
                protectionCache[chest.chest_level] = protectionPercentage;
            }
            
            const rewardAmount = chest.TLM * protectionPercentage / 100;
            rewards += rewardAmount;
        }
        return rewards;
    }

    function calculateProtectionPercentage(chestLevel) {
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

        try {
            const response = await parallelApiRequest(requestData, 2000);
            if (response && response.rows.length > 0) {
                votepowerData = response.rows[0].weight / 10000;
                return votepowerData;
            }
        } catch (error) {
            console.error('Error fetching vote power:', error);
        }

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

        try {
            const response = await parallelApiRequest(requestData, 2000);
            if (response && response.rows.length > 0) {
                decayData = new Date(response.rows[0].vote_time_stamp);
                return decayData;
            }
        } catch (error) {
            console.error('Error fetching decay data:', error);
        }

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

    try {
        const data = await parallelApiRequest(requestData, 3000);
        if (data.rows && data.rows.length > 0) {
            return data.rows;
        }
    } catch (error) {
        console.error('Error fetching PVP3 data:', error);
    }

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
    // Charger les données PvP3 en arrière-plan pour ne pas bloquer l'affichage
    const validPlayersPromise = processPvp3Data();
    
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
        
        // Afficher d'abord les coffres sans les données PvP3
        sortedChests.forEach((chest, index) => {
            let colorClass = '';
            if (index === 0) colorClass = 'red-text';
            else if (index >= 1 && index <= 4) colorClass = 'orange-text';
        
            const chestHTML = `<p class="${colorClass}">#${index + 1}. ${chest.owner}, Level: ${chest.chest_level}, PDT: ${chest.TLM}, Land ID: ${chest.land_id}</p>`;
        
            if (index < 5) column1.innerHTML += chestHTML;
            else column2.innerHTML += chestHTML;
        });

        description.innerHTML = `
            <p class="lato pvp-chest-description planet-color-dynamique">
                In PvP, the player with the most PDT in their chest becomes the primary target! This puts their chest in the spotlight, making it an attractive target for attacks from other players.<br><br>
                To avoid being targeted, they should upgrade their chest to speed up TLM extraction and gain a protection percentage (keeping part of their TLM safe from being stolen).<br><br>
                If they're still in the spotlight, they must strengthen their defenses and rally allies to help secure their chest.<br><br>
                Once the 72-hour defense phase ends, attackers will have a 48-hour window to attempt breaking through and looting any unprotected PDT.
            </p>
        `;
        
        // Mettre à jour avec les données PvP3 une fois disponibles
        try {
            const validPlayers = await validPlayersPromise;
            const seenPlayers = new Set();
            
            column1.innerHTML = '';
            column2.innerHTML = '';
            
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
        } catch (error) {
            console.error('Error updating top chests with PvP data:', error);
        }
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
    // Fonction pour nettoyer le cache périodiquement
    function clearCache() {
        const now = Date.now();
        if (cache.lastUpdate && (now - cache.lastUpdate) > 5 * 60 * 1000) { // 5 minutes
            cache.pvpData = null;
            cache.chestData = null;
            cache.votepowerData = null;
            cache.decayData = null;
            cache.lastUpdate = 0;
            console.log('Cache PvP nettoyé');
        }
    }
    
    // Nettoyer le cache toutes les 5 minutes
    setInterval(clearCache, 5 * 60 * 1000);
    
    window.startPvpIntervals = async function(){
        // Réduire le délai de démarrage
        setTimeout(() => {
            window.initializePvP();
        }, 500); // Réduit de 1000ms à 500ms
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