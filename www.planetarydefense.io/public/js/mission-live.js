(async function() {
    const userPlanet = localStorage.getItem("userPlanet");
    let interval = null;
    let attackInterval = null;
    let defenseInterval = null;
    const landownerStatusCache = {};
    const userType = localStorage.getItem("userType");
    const userAccount = localStorage.getItem("userAccount");
  
    function isMissionActive(progress) {
        return progress === 0 || progress === 1;
    }

    function convertTimestampToDate(timestamp) {
        return new Date(timestamp * 1000);
    }

    async function startCountdown(startDate, endDate, containerId) {
        const end = convertTimestampToDate(endDate);
        const now = getCurrentUserTime();

        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Element with ID ${containerId} not found`);
            return;
        }

        // Génération dynamique du HTML pour le countdown
        container.innerHTML = `
            <div id="countdown-container">
                <div class="countdown">
                    <span class="countdown-value" id="${containerId}-days" >0</span>
                    <span class="countdown-label" >Days</span>
                </div>
                <div class="countdown">
                    <span class="countdown-value" id="${containerId}-hours" >0</span>
                    <span class="countdown-label" >Hours</span>
                </div>
                <div class="countdown">
                    <span class="countdown-value" id="${containerId}-minutes" >0</span>
                    <span class="countdown-label" >Minutes</span>
                </div>
                <div class="countdown">
                    <span class="countdown-value" id="${containerId}-seconds" >0</span>
                    <span class="countdown-label" >Seconds</span>
                </div>
            </div>
        `;

        // Validation de la date de fin
        if (isNaN(end.getTime())) {
            console.error('Invalid end date:', endDate);
            container.innerHTML = '<p style="color: red;">Invalid end date</p>';
            return;
        }

        if (now > end) {
            container.innerHTML = '<p>Wait for the Next Mission !</p>';
            return;
        }

        const daysElement = document.getElementById(`${containerId}-days`);
        const hoursElement = document.getElementById(`${containerId}-hours`);
        const minutesElement = document.getElementById(`${containerId}-minutes`);
        const secondsElement = document.getElementById(`${containerId}-seconds`);

        const interval = setInterval(() => {
            const now = getCurrentUserTime();
            const timeLeft = end - now;

            if (timeLeft <= 0) {
                clearInterval(interval);
                container.innerHTML = '<p>Wait for the Next Mission !</p>';
                return;
            }

            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            daysElement.innerText = days;
            hoursElement.innerText = hours;
            minutesElement.innerText = minutes;
            secondsElement.innerText = seconds;
        }, 1000);
    }
    async function fetchOwnerLandCount(ownerAddress) {
        try {
            const response = await fetch(`/mission/data/${ownerAddress}`);
            if (!response.ok) {
                throw new Error('Failed to fetch owner data');
            }
            const ownerData = await response.json();
            return ownerData.landCount;
        } catch (error) {
            console.error('Error fetching owner land count:', error);
            return 1;
        }
    }

    async function fetchAttackProgress() {
        if (!window.missionData || !window.missionData.attack) return;
    
        const {
            attackTitleOnchain,
            attackTarget,
            attackImgV,
            attackTextV,
            attackImgD,
            attackTextD,
            attackimg: attackImg,
            attacktext: attackText,
            progress
        } = window.missionData.attack;
    
        const requestData = {
            code: window.planetData.WalletMission,
            table: 'missions',
            scope: window.planetData.WalletMission,
            index_position: 1,
            upper_bound: attackTitleOnchain,
            lower_bound: attackTitleOnchain,
            json: true
        };
    
        for (let endpoint of apiEndpointsLive) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
    
                // Sauvegarder la réponse globalement pour déboguer ou un autre usage
                window.attackProgressResponse = response;
    
                // Vérifier la validité des données
                if (response.rows && response.rows.length > 0) {
                    const mission = response.rows[0];
                    const totalAttackPoints = mission.total_attack_points;
                    window.totalAttackPlayer = totalAttackPoints;
    
                    updateProgress(
                        totalAttackPoints,
                        attackTarget,
                        progress,
                        attackImgV,
                        attackTextV,
                        attackImgD,
                        attackTextD,
                        attackImg,
                        attackText,
                        'progress__text_att',
                        'progress__fill_att',
                        'img-att',
                        'missiontext_att',
						'attack'
                    );
    
                    updateCooldownOnTabFocus(totalAttackPoints, attackTarget);
                    return response; // Retourner la réponse si succès
                } else {
                    console.warn('No data found for the specified attack title.');
                    handleNoMissionData();
                    return null;
                }
            } catch (error) {
                console.error(`Failed to fetch Attack Data status from endpoint ${endpoint}. Trying next...`, error);
            }
        }
    
        // Si aucun endpoint n'a réussi, afficher un message d'erreur
        showToast('Failed to fetch Attack Data status after multiple attempts.', 'error');
        return null;
    }
    
    function handleNoMissionData() {
        const imgElement = document.getElementById('img-att');
        const missionTextElement = document.getElementById('missiontext_att');
    
        imgElement.src = '../images/attack.webp' || 'default.png';
        missionTextElement.innerHTML = 'Wait for the Next Mission !' || 'No text available';
    }
    window.fetchAttackProgress = fetchAttackProgress;

async function fetchDefenseProgress() {
    if (!window.missionData || !window.missionData.defense) return;

    const defenseTargetBase = window.missionData.defense.defenseTarget;
    const defenseImgV = window.missionData.defense.defenseimgV;
    const defenseTextV = window.missionData.defense.defensetextV;
    const defenseImgD = window.missionData.defense.defenseimgD;
    const defenseTextD = window.missionData.defense.defensetextD;
    const defenseImg = window.missionData.defense.defenseimg;
    const defenseText = window.missionData.defense.defensetext;
    const progress = window.missionData.defense.progress;

    let landCount;
    let ownerLandCount;
    let defenseTarget;
    if(userType === "player" || userType === "owner") {
        await initializeLandownerCache();
    }
    try {
        // Wait until supportersData is not empty
        while (!window.supportersData || window.supportersData.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const data = window.supportersData || [];
        let userRow = null;
        let ownerAddress = 'No Warlord';  // Default value
        let totalDefenseScore = 0;
      
        // If userType is "player", search only in supporters
        if (userType === "player") {
            userRow = data.find(row => row.supporters.includes(userAccount));
            if (userRow) {
                ownerAddress = userRow.owner_address;
                totalDefenseScore = userRow.total_defense_score;
            }
        } 
        // If userType is "owner", search only in owner_address
        else if (userType === "owner") {
            userRow = data.find(row => row.owner_address === userAccount);
            if (userRow) {
                ownerAddress = userRow.owner_address;
                totalDefenseScore = userRow.total_defense_score;
            }
        }

        // If no userRow is found, set ownerAddress to 'No Warlord'
        if (!userRow) {
            ownerAddress = 'No Warlord';
            totalDefenseScore = 0;
        }

        // Calculate defense target based on user type
        if (userType === "owner" && window.ownerData) {
            landCount = window.ownerData.landCount;
        } else if (userType === "player" && userRow) {
            ownerLandCount = await fetchOwnerLandCount(userRow.owner_address);
        } else {
            landCount = 1;
        }

        defenseTarget = userType === "owner" ? defenseTargetBase * landCount : (ownerLandCount > 1 ? defenseTargetBase * ownerLandCount : defenseTargetBase);

        updateProgress(
            totalDefenseScore,
            defenseTarget,
            progress,
            defenseImgV,
            defenseTextV,
            defenseImgD,
            defenseTextD,
            defenseImg,
            defenseText,
            'progress__text_def',
            'progress__fill_def',
            'img-def',
            'missiontext_def',
			'defense'
        );

        if (userType === "owner") {
            document.getElementById('progress-def').innerText = 'Your Warlord is: You SIR !';
            document.getElementById('filter-input').disabled = true;
            document.getElementById('support').classList.add('disabled');
        } else {
            document.getElementById('progress-def').innerText = `Your Warlord is: ${ownerAddress}`;

            // Listener pour input changes
            const filterInput = document.getElementById('filter-input');
            const supportButton = document.getElementById('support');
            const landownerStatusMessage = document.getElementById('landowner-status'); // Assurez-vous que cet élément existe dans le DOM

            if (filterInput && landownerStatusMessage) {
                filterInput.addEventListener('input', function () {
                    const inputValue = filterInput.value.trim();

                    // Check if ownerAddress is defined and matches input
                    if (ownerAddress && inputValue === ownerAddress) {
                        supportButton.classList.add('disabled');
                    } else {
                        supportButton.classList.remove('disabled');
                    }
                    // Ne pas afficher le message si l'input est vide
                    if (inputValue === '') {
                        landownerStatusMessage.innerText = "";  // Effacer le message si input est vide
                        return;
                    }
                    // Vérification du statut du landowner via le cache
                    const isActive = landownerStatusCache[inputValue];

                    // Si le landowner est inactif, afficher un message
                    if (isActive === undefined || isActive === 0) {
                        landownerStatusMessage.innerText = "This Warlord is inactive, shards will not be sent to this land.";
                    } else {
                        landownerStatusMessage.innerText = "";  // Effacer le message si actif
                    }
                });
            }
        }
    if(userType === "player") {
        
        // Vérification du Warlord actuel via le cache
        const currentWarlord = document.getElementById('progress-def').innerText.split(': ')[1].trim();

        const isActive = landownerStatusCache[currentWarlord];

        // Si le Warlord est inactif, désactiver le bouton et afficher un message
        if (currentWarlord === 'No Warlord') {
            document.getElementById('landowner-status').innerText = "Please, choose a Warlord to participate in the Defense.";
        } else if (isActive === undefined || isActive === 0 && document.getElementById('landowner-status')) {
            document.getElementById('landowner-status').innerText = "This Warlord is inactive, shards will not be sent to this land.";
        }
    }
    } catch (error) {
        console.error('Error fetching defense progress:', error);

        const ownerAddress = 'No Warlord';
        const totalDefenseScore = 0;
        updateProgress(
            totalDefenseScore,
            defenseTargetBase,
            progress,
            defenseImgV,
            defenseTextV,
            defenseImgD,
            defenseTextD,
            defenseImg,
            defenseText,
            'progress__text_def',
            'progress__fill_def',
            'img-def',
            'missiontext_def',
			'defense'
        );

        document.getElementById('progress-def').innerText = `Your Warlord is: ${ownerAddress}`;
    }
}
    window.fetchDefenseProgress = fetchDefenseProgress;

    function updateProgress(
        totalPoints,
        target,
        progress,
        imgV,
        textV,
        imgD,
        textD,
        img,
        text,
        progressTextId,
        progressBarId,
        imgId,
        missionTextId,
		type
    ) {
        const progressText = document.getElementById(progressTextId);
        const progressBar = document.getElementById(progressBarId);
        const imgElement = document.getElementById(imgId);
        const missionTextElement = document.getElementById(missionTextId);

        progressText.innerText = `${totalPoints}/${target}`;
        progressBar.setAttribute('aria-valuenow', totalPoints);
        progressBar.setAttribute('aria-valuemax', target);
        const progressPercentage = (totalPoints / target) * 100;
        progressBar.style.width = `${progressPercentage}%`;
          
		const defenseEndDate = type === "defense" && window.missionData && window.missionData.defense ? window.missionData.defense.defenseEndDate : null;
    	const now = getCurrentUserTime(); // Assurez-vous d'avoir une fonction pour obtenir l'heure actuelle de l'utilisateur
        if (progress === 1) {
            if (totalPoints >= target && type === "defense" || totalPoints >= target && type === "attack") {
                imgElement.src = `../images/${imgV || 'default.png'}`;
                missionTextElement.innerHTML = textV || 'No text available';
            } else {
                imgElement.src = `../images/${imgD || 'default.png'}`;
                missionTextElement.innerHTML = textD || 'No text available';
            }
        } else if (progress === 0 && totalPoints >= target && now >= convertTimestampToDate(defenseEndDate) && type === "defense" || progress === 0 && totalPoints <= target && now >= convertTimestampToDate(window.missionData.attack.attackEndDate) && type === "attack") {
            imgElement.src = `../images/${imgV || 'default.png'}`;
            missionTextElement.innerHTML = textV || 'No text available';
        } else if (progress === 0 && totalPoints <= target && now >= convertTimestampToDate(defenseEndDate) && type === "defense" || progress === 0 && totalPoints <= target && now >= convertTimestampToDate(window.missionData.attack.attackEndDate) && type === "attack") {
            imgElement.src = `../images/${imgD || 'default.png'}`;
            missionTextElement.innerHTML = `${textD || 'No text available'}`;
        } else if (progress === 0 && totalPoints >= target && type === "attack") {
            imgElement.src = `../images/${img || 'default.png'}`;
            missionTextElement.innerHTML = `${textV || 'No text available'}<br>----------<br>${text || 'No text available'}`;
        } else {
            imgElement.src = `../images/${img || 'default.png'}`;
            missionTextElement.innerHTML = text || 'No text available';
        }
    }

    function updateMissionContent(data) {
        if (data) {
            if (data.attack) {
                const missionTitleAtt = document.getElementById('missiontitle_att');
                const rewardAtt = document.getElementById('reward_att');
                const timeEndAtt = document.getElementById('time_end_att');
                const progressTextAtt = document.getElementById('progress__text_att');

                if (missionTitleAtt) {
                    missionTitleAtt.innerText = data.attack.attackTitleSite || 'No title available';
                }

                if (rewardAtt) {
                    const rewardCurrency = "PDT"; // La nouvelle devise à utiliser
                    const attackRewards = data.attack.attackRewards ? data.attack.attackRewards.split(' ')[0].split('.')[0] + ' ' + rewardCurrency : null;
                    const attackShards = data.attack.attackShards ? data.attack.attackShards.split(' ')[0].split('.')[0] + ' Shards' : null;
                    rewardAtt.innerText = attackRewards && attackShards ? `Rewards: ${attackRewards} / ${attackShards}` : 'No rewards available';
                }

                if (timeEndAtt) {
                    if (isMissionActive(data.attack.progress)) {
                        if (data.attack.attackStartDate && data.attack.attackEndDate && data.attack.progress === 0) {
                            startCountdown(data.attack.attackStartDate, data.attack.attackEndDate, 'time_end_att');
                            fetchAttackProgress();
                        } else {
                            timeEndAtt.innerText = 'Wait for the Next Mission !';
                          	fetchAttackProgress();
                        }
                    } else {
                        timeEndAtt.innerText = 'Wait for the Next Mission !';
                    }
                }

                if (progressTextAtt) {
                    const attackTarget = data.attack.attackTarget || 0;
                    progressTextAtt.setAttribute('data-target', attackTarget);
                }
            } else {
                const timeEndAtt = document.getElementById('time_end_att');
                if (timeEndAtt) {
                    timeEndAtt.innerText = 'Wait for the Next Mission !';
                }
            }
            if (data.defense) {
                const missionTitleDef = document.getElementById('missiontitle__def');
                const rewardDef = document.getElementById('reward_def');
                const timeEndDef = document.getElementById('time_end_def');
                const progressTextDef = document.getElementById('progress__text_def');

                if (missionTitleDef) {
                    missionTitleDef.innerText = data.defense.defenseTitleSite || 'No title available';
                }

                if (rewardDef) {
                    const rewardCurrency = "PDT"; // La nouvelle devise à utiliser
                    const defenseRewards = data.defense.defenseRewards ? data.defense.defenseRewards.split(' ')[0].split('.')[0] + ' ' + rewardCurrency : null;
                    const defenseShards = data.defense.defenseShards ? data.defense.defenseShards.split(' ')[0].split('.')[0] + ' Shards' : null;
                    rewardDef.innerText = defenseRewards && defenseShards ? `Rewards: ${defenseRewards} / ${defenseShards}` : 'No rewards available';
                }

                if (timeEndDef) {
                    if (isMissionActive(data.defense.progress)) {
                        if (data.defense.defenseStartDate && data.defense.defenseEndDate) {
                            startCountdown(data.defense.defenseStartDate, data.defense.defenseEndDate, 'time_end_def');
                            fetchDefenseProgress();
                        } else {
                            timeEndDef.innerText = 'Wait for the Next Mission !';
                        }
                    } else {
                        timeEndDef.innerText = 'Wait for the Next Mission !';
                    }
                }

            if (progressTextDef) {
                const defenseTarget = data.defense.defenseTarget || 0;
                progressTextDef.setAttribute('data-target', defenseTarget);
            }

            // Vérifier si la mission de défense est terminée
            const now = getCurrentUserTime();
            const defenseEndDate = data.defense.defenseEndDate ? convertTimestampToDate(data.defense.defenseEndDate) : null;
			const supportButton = document.getElementById('support');
              
            if (defenseEndDate && now >= defenseEndDate) {
                if (supportButton) {
                    supportButton.classList.add('disabled');
                    supportButton.disabled = true;
                }
            }
            } else {
                const timeEndDef = document.getElementById('time_end_def');
                if (timeEndDef) {
                    timeEndDef.innerText = 'Wait for the Next Mission !';
                }
            }
        }
    }
  
    function updateCooldownOnTabFocus(totalAttackPoints, attackTarget) {
        const nextAttackElement = document.getElementById('nextattack');
        if (nextAttackElement) {
            if (!window.playersData || !Array.isArray(window.playersData) || window.playersData.length === 0) {
                nextAttackElement.innerText = 'You Can Attack!';
                return;
            }

            const playerData = window.playersData.find(player => player.player === userAccount);
            if (playerData) {
                const lastParticipationTime = playerData.last_participation_time;
                const totalMoveCost = window.ownerData ? window.ownerData.totalMoveCost : window.playerData.totalMoveCost;

                // Utiliser la fonction calculateCooldown mise à jour pour déterminer le message à afficher
                const cooldownMessage = calculateCooldown(lastParticipationTime, totalMoveCost);

                nextAttackElement.innerText = cooldownMessage;
            } else {
                nextAttackElement.innerText = 'You Can Attack!';
            }

            // Mise à jour de l'état du bouton d'attaque
            const attackButton = document.getElementById('attack');
            const isCooldownActive = nextAttackElement && nextAttackElement.innerText !== 'You Can Attack!';
            if (attackButton) {
                if (window.totalAttackPlayer >= window.missionData.attack.attackTarget || isCooldownActive || window.missionData.attack.progress === 1) {
                    attackButton.disabled = true;
                    attackButton.classList.add('disabled');
                } else {
                    attackButton.disabled = false;
                    attackButton.classList.remove('disabled');
                }
            }
        }
    }

    function calculateCooldown(lastParticipationTime, totalMoveCost) {
        // Vérifier la progression de la mission d'abord
      	const nowover = getCurrentUserTime();
        if (window.missionData.attack.progress === 1 || window.totalAttackPlayer >= window.missionData.attack.attackTarget || nowover >= convertTimestampToDate(window.missionData.attack.attackEndDate)) {
            return 'Mission is over';
        }

        // Calculer le temps de cooldown
        const cooldownTime = lastParticipationTime + (3 * 60 * 60) + (10 * totalMoveCost); // 3H + 10 secondes * totalMoveCost
        const now = Math.floor(Date.now() / 1000);
        const timeLeft = cooldownTime - now;

        // Déterminer le message de cooldown ou de possibilité d'attaque
        if (timeLeft <= 0) {
            return 'You Can Attack!';
        }

        const hours = Math.floor(timeLeft / 3600);
        const minutes = Math.floor((timeLeft % 3600) / 60);
        const seconds = timeLeft % 60;

        return `${hours}h ${minutes}m ${seconds}s left`;
    }

    window.calculateCooldown = calculateCooldown;
    window.updateCooldownOnTabFocus = updateCooldownOnTabFocus;

    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible') {
            updateCooldownOnTabFocus();
        }
    });

    // Update cooldown every second
    setInterval(updateCooldownOnTabFocus, 1000);
      // Fonction pour initialiser le cache des landowners
    async function initializeLandownerCache() {
        try {
            const response = await fetch(`/mission/check-landowner-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
    
            const data = await response.json();
    
            // Remplir le cache avec les landowners actifs
            const landowners = data.landowners;
            for (const owner in landowners) {
                landownerStatusCache[owner] = landowners[owner];
            }
          	window.landownerStatusCache = landownerStatusCache;
        } catch (error) {
            console.error('Error initializing landowner cache:', error);
        }
    }

    function startProgreIntervals() {
        attackInterval = setInterval(fetchAttackProgress, 60000);
        defenseInterval = setInterval(fetchDefenseProgress, 60000);
    }
    // Mise à jours Bouton click
    document.addEventListener('click', (event) => {
        // Remonte au bouton parent si un enfant est cliqué
        const button = event.target.closest('#support, #attack');
        if (button) {
            // Désactiver le bouton pour éviter des clics multiples
            button.disabled = true;
            const originalText = button.querySelector('.button-transform').textContent;
            button.querySelector('.button-transform').textContent = 'Processing...';
			console.log('Processing');
          	console.log('Texte Original', originalText);
            // Rétablir l'état initial après 5 secondes
            setTimeout(() => {
                button.disabled = false;
              	console.log('Texte Original Time Out', originalText);
                button.querySelector('.button-transform').textContent = originalText;
            }, 5000);
        }
    });
    $(document).ready(async function() {
        if (!window.missionData) {
            await fetchMissionData();
        }
        updateMissionContent(window.missionData);
        startProgreIntervals();

        try {
            await waitForPlayersData(); // Attendre l'initialisation de window.playersData
            updateCooldownOnTabFocus(); // Appeler la fonction pour afficher le cooldown lors du chargement de la page
        } catch (error) {
            console.error(error);
        }
    });

    window.startProgressIntervals1 = function() {
        window.attackInterval = fetchAttackProgress();
    }

    window.cleanupMissionLive = () => {
        if (attackInterval) {
            clearInterval(attackInterval);
            attackInterval = null;
        }
        if (defenseInterval) {
            clearInterval(defenseInterval);
            defenseInterval = null;
        }
        if (interval) {
            clearInterval(interval);
            interval = null;
        }
    };
})();
