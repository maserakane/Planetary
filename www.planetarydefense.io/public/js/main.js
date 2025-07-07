let forgeStatusGlobal = false;
let missionData = null;
let playersData = [];
let supportersData = null;
let ownerData = null;
let playerData = null;
let planetData = null; // Variable globale pour stocker les données de la planète
let isFetchingSupportersData = false;
let isUpdating = false; // Variable de verrouillage
$(document).ready(async function() {
    await initializePlanetData(); // Initialiser les données de la planète au chargement de la page
    await checkForUpdates();
    try {
        await fetchForgeStatusGlobal();

        if (!window.forgeStatusGlobalLeaderboard || !window.forgeStatusGlobalLeaderboard.rows) {
            console.error("Forge data not loaded properly.");
        }
    } catch (error) {
        console.error("Error fetching forge data:", error);
    }
    // Assurez-vous que les données des supporters sont bien récupérées avant de continuer
    try {
        await fetchSupportersData(); // Fetch supporters data au chargement de la page
        await waitForSupportersData();
    } catch (error) {
        console.error('Erreur lors de la récupération des données des supporters:', error);
    }

    loadContent('mission-live.html?v=1.4', ['js/mission-live.js?v=3.992', 'js/mission.js?v=1.6'], '', '', '', 'Magor');
  	await loadActions();
    manageIntervals();
  	manageIntervals2();
});

// Fonction pour gérer les intervalles de mise à jour
function manageIntervals2() {
    // Met à jour les statistiques live et actions toutes les 10 minutes
    setInterval(async () => {
        updateLiveStats();
    }, 120000); // 600000 ms = 2 minutes
}

// Fonction pour gérer les intervalles de mise à jour
function manageIntervals() {
    // Met à jour les statistiques live et actions toutes les 10 minutes
    setInterval(async () => {
		const userAccount = localStorage.getItem("userAccount");
		await fetchForgeStatusCheck();
		await fetchUserData(userAccount);
        await fetchMissionData();
        updateLiveStats();
        loadActions();
        checkForUpdates();
    }, 600000); // 600000 ms = 10 minutes
}
async function initializePlanetData() {
    const userPlanet = localStorage.getItem("userPlanet");
    if (!userPlanet) {
        console.error('No userPlanet found in localStorage');
        return;
    }
    planetData = await getPlanetData(userPlanet);
    if (!planetData) {
        console.error('No data returned for the planet');
        return;
    }

    // Vérification de la valeur de Open
    if (planetData.Open === 0) {
        console.warn(`Planet ${planetData.Name} is not open. Using default WalletMission for Magor.`);
        window.planetData.WalletMission = 'magordefense';
    }

    window.planetData = planetData; // Assigner les données à une variable globale
}

async function getPlanetData(planetName) {
    try {
        const response = await fetch(`/mission/planet-data?userPlanet=${planetName}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        window.planetData = data; // Assigner les données à une variable globale
        return data;
    } catch (error) {
        console.error('Error fetching planet data:', error);
    }
}

async function checkForUpdates() {
    try {
        const response = await fetch('/mission/update-time');
        if (!response.ok) {
            throw new Error('Failed to fetch update time data');
        }
        const data = await response.json();
        const lastUpdate = data[0].last_update;
        const lastUpdateCheck = data[0].last_update_check;

        // Mettre à jour l'affichage de l'heure de la dernière mise à jour
        const updateTimeElement = document.getElementById('update-time');
        updateTimeElement.textContent = `Last Update : ${convertToLocalTime(lastUpdate)}`;

        if (!lastUpdateCheck || new Date(lastUpdate * 1000) > new Date(lastUpdateCheck * 1000)) { // Convertir les secondes en millisecondes
            // Mise à jour nécessaire
            await updateClientData();
            await updateLastUpdateCheck(lastUpdate);
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
    }
}

async function updateLastUpdateCheck(lastUpdate) {
    try {
        const response = await fetch('/mission/update-last-check', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ lastUpdate })
        });
        if (!response.ok) {
            throw new Error('Failed to update last_update_check');
        }
    } catch (error) {
        console.error('Error updating last_update_check:', error);
    }
}

// Vérifier les mises à jour toutes les 10 minutes
setInterval(checkForUpdates, 600000);

async function updateClientData() {
    const userAccount = localStorage.getItem("userAccount");
    await fetchUserData(userAccount);
    const stats = calculateStats(window.ownerData || window.playerData);
    updateStatsDisplay(stats);

    // Mettre à jour l'affichage de l'heure de la dernière mise à jour
    const updateTimeElement = document.getElementById('update-time');
    updateTimeElement.textContent = `Last Update : ${convertToLocalTime(Date.now())}`; // Utiliser le timestamp actuel
}

async function fetchForgeStatus(userAccount) {
    const requestData = {
        code: window.planetData.WalletMission,
        table: 'forge',
        scope: window.planetData.WalletMission,
        index_position: 1,
        upper_bound: userAccount,
        lower_bound: userAccount,
        json: true
    };

    for (let endpoint of apiEndpoints) {
        try {
            const response = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
            window.forgeStatusGlobal = response;
            return response;
        } catch (error) {
            console.error(`Failed to fetch forge status from endpoint ${endpoint}. Trying next...`, error);
        }
    }
    showToast('Failed to fetch forge status after multiple attempts.', 'error');
    window.forgeStatusGlobal = ''; // Marquer comme échec global
    return null;
}

async function fetchMissionData() {
    try {
        const response = await fetch(`/mission/mission-data?cache-buster=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error('Failed to fetch mission data');
        }
        missionData = await response.json();
        window.missionData = missionData;  // Assigner les données à une variable globale
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
    }
}

// Fonctions redondantes regroupées ici
function getCurrentUserTime() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    if (offset !== 0) {
        return convertToUTC(now);
    }
    return now;
}

function getLocalTargetDate(now) {
    let targetDate;

    // Si la date actuelle est avant le 16 du mois ou le 16 avant 00:01
    if (now.getDate() < 16 || (now.getDate() === 16 && now.getHours() < 0 && now.getMinutes() < 1)) {
        targetDate = new Date(now.getFullYear(), now.getMonth(), 16, 0, 1, 0);
    } else {
        // Sinon, c'est le 1er du mois suivant à 00:01
        targetDate = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 1, 0);
    }

    return targetDate;
}

function convertToUTC(date) {
    return new Date(date.toISOString());
}

function convertToLocalTime(utcTimestamp) {
    let date;
    if (utcTimestamp.toString().length === 10) {
        // Le timestamp est probablement en secondes
        date = new Date(utcTimestamp * 1000);
    } else {
        // Le timestamp est probablement en millisecondes
        date = new Date(utcTimestamp);
    }

    return date.toLocaleString('default', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function loadContent(page, scripts, backgroundImage, color1, color2, planet) {
    // Stocker le paramètre planet dans le localStorage
    if (planet) {
        localStorage.setItem('userPlanet', planet);
        document.documentElement.setAttribute('data-planet', planet);
        initializePlanetData();
    }

    // --- Correction : Charger main.js uniquement s'il n'est pas déjà présent dans la page ---
    const mainScriptAlreadyLoaded = Array.from(document.scripts).some(s => s.src && s.src.includes('js/main.js'));
    if (!mainScriptAlreadyLoaded) {
        if (!scripts.includes('js/main.js')) {
            scripts = ['js/main.js', ...scripts];
        } else {
            const idx = scripts.indexOf('js/main.js');
            if (idx > 0) {
                scripts.splice(idx, 1);
                scripts.unshift('js/main.js');
            }
        }
    } else {
        // Si main.js est déjà chargé, on l'enlève de la liste pour éviter de le recharger
        scripts = scripts.filter(s => s !== 'js/main.js');
    }
    // -------------------------------------------------------------------------

    $('#center-bloc').load(page, async function(response, status, xhr) {
        if (window.cleanupMissionLive) {
            window.cleanupMissionLive();
            delete window.cleanupMissionLive;
        }
        if (window.cleanupLeaderboardPage) {
            window.cleanupLeaderboardPage();
            delete window.cleanupLeaderboardPage;
        }
        if (window.cleanupDonations) {
            window.cleanupDonations();
            delete window.cleanupDonations();
        }
        if (window.cleanupPvP) {
            window.cleanupPvP();
            delete window.cleanupPvP();
        }
        if (status === "error") {
            console.error(`Error loading page: ${page}`, xhr.status, xhr.statusText);
        } else {
            removeOldScripts();
            loadScripts(scripts, page);
            // Changer dynamiquement l'image de fond
            if (backgroundImage) {
                document.documentElement.style.setProperty('--background-image', backgroundImage);
            }
            // Changer dynamiquement les couleurs des classes
            if (color1) {
                document.documentElement.style.setProperty('--color1', color1);
            }
            if (color2) {
                document.documentElement.style.setProperty('--color2', color2);
            }

            // Déclencher un événement personnalisé après le chargement de forge.html
            if (page === 'forge.html') {
                const event = new CustomEvent('forgePageLoaded');
                document.dispatchEvent(event);
            }
           // Déclencher un événement personnalisé après le chargement de lore.html
            if (page === 'lore.html') {
                const event = new CustomEvent('lorePageLoaded');
                document.dispatchEvent(event);
            }
           // Déclencher un événement personnalisé après le chargement de lore.html
            if (page === 'monster.html') {
                const event = new CustomEvent('monstrePageLoaded');
                document.dispatchEvent(event);
            }
            if (page === 'detail.html') {
                const event = new CustomEvent('detailPageLoaded');
                document.dispatchEvent(event);
            }
        }
    });
}

function loadScripts(scripts, page) {
    let loadedScripts = 0;

    scripts.forEach(script => {
        const scriptElement = document.createElement('script');
        scriptElement.src = script;
        scriptElement.async = false;
        scriptElement.dataset.dynamic = 'true';
        scriptElement.onload = function() {
            loadedScripts++;
            if (loadedScripts === scripts.length) {
                // Appel de la fonction d'initialisation après chargement des scripts
                if (page === 'leaderboard.html' && typeof window.initLeaderboardPage === 'function') {
                    window.initLeaderboardPage();
                } else if (typeof window.initPage === 'function') {
                    window.initPage();
                } else if (page === 'forge.html' && typeof window.initForgePage === 'function') {
                    window.initForgePage();
                } else if (page === 'lore.html' && typeof window.initLorePage === 'function') {
                    window.initLorePage();
                } else if (page === 'monster.html' && typeof window.initMonstrePage === 'function') {
                    window.initMonstrePage();
                }
            }
        };
        document.body.appendChild(scriptElement);
    });
}

function removeOldScripts() {
    $('script[data-dynamic="true"]').remove();
}

async function fetchPlayerInfo() {
    if (!window.missionData || !window.missionData.attack) return;

    const attackTitleOnchain = window.missionData.attack.attackTitleOnchain;
    let lowerBound = attackTitleOnchain;
    let more = true;

    let playersData = []; // Réinitialiser les données des joueurs

    while (more) {
        let requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: 'playermiss',
            scope: window.planetData.WalletMission,
            lower_bound: lowerBound,
            limit: 1000
        };

        if (lowerBound === attackTitleOnchain) {
            requestData.index_position = 3;
            requestData.key_type = 'name';
            requestData.upper_bound = attackTitleOnchain;
        } else {
            requestData.index_position = 1;
        }

        for (let endpoint of apiEndpointsLive) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
                const data = response;
                playersData = playersData.concat(data.rows);

                if (data.more) {
                    lowerBound = data.rows[data.rows.length - 1].id + 1;
                } else {
                    more = false;
                }

                window.playersData = playersData; // Mettre à jour la variable globale avec les nouvelles données
                document.dispatchEvent(new Event('playersDataReady'));
                break; // Sortir de la boucle si la requête réussit
            } catch (error) {
                console.error(`Failed to fetch player info from endpoint ${endpoint}. Trying next...`, error);
            }
        }

        if (!more) {
            break; // Si nous avons récupéré toutes les données ou en cas d'erreur
        }
        showToast('Failed to fetch player info status after multiple attempts.', 'error');
        return null;
    }
    window.playersData = playersData; // Stocker les données des joueurs dans une variable globale après la boucle
}

async function fetchSupporters(userAccount) {
    if (!window.supportersData) {
        await fetchSupportersData();
    }

    const userRow = window.supportersData && window.supportersData.find(row => row.owner_address === userAccount);
    return userRow ? userRow.supporters : [];
}

async function fetchSupportersData() {
    if (isFetchingSupportersData) {
        return;
    }
    if (!window.planetData || !window.planetData.WalletPlanet) {
        console.error('No WalletPlanet found in planet data');
        return;
    }
    isFetchingSupportersData = true;
    let hasMore = true;
    let nextKey = '';

    window.supportersData = []; // Initialiser comme une liste vide avant de commencer

    while (hasMore) {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            scope: window.planetData.WalletMission,
            table: 'supports',
            lower_bound: nextKey,
            limit: 1000
        };

        let success = false;

        for (let endpoint of apiEndpointsLive) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
                const data = response;

                window.supportersData = window.supportersData.concat(data.rows);  // Ajouter les nouvelles données aux anciennes
                hasMore = data.more;
                nextKey = data.next_key || '';

                success = true; // Marquer le succès et arrêter de tenter avec d'autres endpoints
                break;
            } catch (error) {
                console.error(`Failed to fetch supporters from endpoint ${endpoint}. Trying next...`, error);
              	window.supportersData = [];
            }
        }

        if (!success) {
            console.error('Failed to fetch supporters data after trying all endpoints.');
            showToast('Unable to fetch supporters data. Please try again later.', 'error');
            break;
        }

        if (!hasMore) {
            break; // Arrêter la boucle si toutes les données ont été récupérées
        }
        showToast('Failed to fetch supporters status after multiple attempts.', 'error');
        return null;
    }

    isFetchingSupportersData = false;
}

function displayActions(data, type) {
    const actionContainerId = type === 'attack' ? 'action-news-a-text' : 'action-news-s-text';
    const actionsContainer = document.getElementById(actionContainerId);
    actionsContainer.innerHTML = ''; // Clear existing content without removing the element

    if (!data || !data.simple_actions) {
        actionsContainer.innerHTML = 'Something Wrong, Wait or Refresh.';
        return;
    }

    const filteredActions = data.simple_actions.filter(action =>
        action.action === (type === 'attack' ? 'sendattack' : 'addsupport')
    );

    if (filteredActions.length === 0) {
        actionsContainer.innerHTML = 'Something Wrong, Wait or Refresh.';
        return;
    }

    // Trier les actions par date (plus récente en premier)
    filteredActions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    filteredActions.forEach(action => {
        const localTime = convertToLocalTime(action.timestamp);
        const actionText = type === 'attack' ?
            `<span>${localTime} <span id="c-red">Attack</span> : ${action.data.player}</span>` :
            `<span>${localTime} ${action.data.player} <span id="c-blue">Support</span> : ${action.data.new_owner}</span>`;

        const actionElement = document.createElement('span');
        actionElement.innerHTML = actionText + '<br>';
        actionsContainer.appendChild(actionElement);
    });
}

async function loadActions() {
    const supportUrl = 'https://wax.eosdac.io/v2/history/get_actions?limit=30&account=magordefense&filter=*%3Aaddsupport&simple=true';
    const attackUrl = 'https://wax.eosdac.io/v2/history/get_actions?limit=30&account=magordefense&filter=*%3Asendattack&simple=true';

    try {
        const [supportData, attackData] = await Promise.all([fetchData(supportUrl), fetchData(attackUrl)]);
        displayActions(supportData, 'support');
        displayActions(attackData, 'attack');
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
    }
}

async function fetchLiveDefenseData(filteredSupporters, defenseTarget) {
    const requestData = { owners: filteredSupporters, defenseTarget };

    try {
        const response = await fetch('/mission/live-defense', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error('Failed to fetch live defense data');
        }

        const data = await response.json();
        console.log(data)
        window.livedefenseData = data;
        return data.totalLandCount ? data.totalLandCount : 0;
    } catch (error) {
        console.error('Error fetching live defense data:', error);
        return 0;
    }
}

async function waitForSupportersData() {
    while (!window.supportersData || window.supportersData.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 100)); // Attendre 100ms avant de vérifier à nouveau
    }
}

// Fonction utilitaire pour attendre l'initialisation de window.totalAttackPlayer
function waitForTotalAttackPlayer() {
    return new Promise(resolve => {
        const interval = setInterval(() => {
            if (typeof window.totalAttackPlayer !== 'undefined' && window.totalAttackPlayer > 0) {
                clearInterval(interval);
                resolve();
            }
        }, 100); // Vérifie toutes les 100 ms
    });
}

async function fetchForgeStatusGlobal() {
	const requestData = {
		code: window.planetData.WalletMission,
		table: 'forge',
		scope: window.planetData.WalletMission,
		limit: 1000,
		json: true
	};

	for (let endpoint of apiEndpoints) {
		try {
			const response = await apiRequestWithRetryh(endpoint, requestData, 1, 5000);
			window.forgeStatusGlobalLeaderboard = response;
			return response;
		} catch (error) {
			console.error(`Failed to fetch forge status from endpoint ${endpoint}. Trying next...`, error);
		}
	}

	// Si aucun endpoint n'a réussi, afficher un message d'erreur
	showToast('Failed to fetch forge status global after multiple attempts.', 'error');
	window.forgeStatusGlobalLeaderboard = ''; // Marquer comme échec global
	return null;
}
async function fetchForgeStatusCheck() {
	await fetchForgeStatusGlobal(); // Appelle la fonction que vous avez déjà définie
	const forgePlayers = new Set(
		window.forgeStatusGlobalLeaderboard?.rows.map(row => row.player_address) || []
	);
	return forgePlayers;
}

async function updateLiveStats() {
    // Si la fonction est déjà en cours d'exécution, on quitte
    if (isUpdating) return;
    
    isUpdating = true; // Verrouille la fonction

    try {
    const userAccount = localStorage.getItem("userAccount");
    const userType = localStorage.getItem("userType");

    // Fetch player info
    await fetchPlayerInfo();
    const playerData = window.playersData.find(player => player.player === userAccount);
    const attackPoints = playerData ? playerData.attack_points : 0;

    const liveStatsTextElement = document.getElementById('live-stats-text');
    liveStatsTextElement.innerHTML = attackPoints ? `Your Attack for Current Mission : <span class="color-point">${attackPoints}</span>` : 'No data available';

    // Fetch forge status mettre à jours pour le endpoint tournant : 27/11/2024
    const forgeStatus = await fetchForgeStatus(userAccount);
    // Vérifier si les rows sont présentes et non vides
    const isForgeActive = forgeStatus && forgeStatus.rows && forgeStatus.rows.length > 0;
    // Déterminer le texte et la couleur du statut
    const forgeStatusText = isForgeActive ? 'ACTIVE' : 'Not Activated';
    const forgeStatusColor = isForgeActive ? 'green' : 'red';
    // Afficher le statut
    liveStatsTextElement.innerHTML += `<br>Forge : <span style="color: ${forgeStatusColor}">${forgeStatusText}</span>`;
    // Number of attackers
    const numberOfAttackers = window.playersData.length;
    liveStatsTextElement.innerHTML += `<br>Mercenary Attacking : <span class="color-point">${numberOfAttackers}</span>`;
  
    // Attendre que window.totalAttackPlayer soit disponible avant de calculer les récompenses
    await waitForTotalAttackPlayer();
  
    // Current rewards for the userAccount Ajout shards mise à jours.
    const attackTarget = missionData.attack.attackTarget;
    const attackRewards = parseFloat(missionData.attack.attackRewards); // Extraire la valeur numérique
    const attackShards = parseFloat(missionData.attack.attackShards); // Extraire la valeur numérique
    const currentRewards = attackTarget && attackRewards ? (attackPoints / window.totalAttackPlayer) * attackRewards : 0;
    const currentShards = attackTarget && attackShards ? (attackPoints / window.totalAttackPlayer) * attackShards : 0;
    liveStatsTextElement.innerHTML += `<br>Live Attack PDT : <span class="color-point">${currentRewards.toFixed(4)}</span>`;
    liveStatsTextElement.innerHTML += `<br>Live Attack Shards : <span class="color-point">${currentShards.toFixed(4)}</span>`;

    // Fetch supporters data
    await waitForSupportersData();

    // Filtrer les supporters dont le total_defense_score est >= defenseTarget
    const defenseTarget = window.missionData.defense.defenseTarget;
    const filteredSupporters = window.supportersData.filter(supporter => {
        return supporter.total_defense_score >= defenseTarget;
    }).map(supporter => ({ owner_address: supporter.owner_address, total_defense_score: supporter.total_defense_score }));

    // Vérification des supporters filtrés
    if (filteredSupporters.length > 0) {
        // Récupérer les données de défense
        const totalLandCount = await fetchLiveDefenseData(filteredSupporters, defenseTarget);
        const NbPlanet = window.planetData.NbPlanet;
        // Afficher le totalLandCount
        liveStatsTextElement.innerHTML += `<br>Lands Fully Defended: <span class="color-point">${sanitizeHTML(totalLandCount)}</span> / <span class="color-point">${NbPlanet}</span>`;
    } else {
        // Si aucun supporter ne répond aux critères, afficher 0
        liveStatsTextElement.innerHTML += `<br>Lands at 100% / Land of the planet: 0`;
    }

    // If user is owner, use ownerData
    if (userType === "owner" && window.ownerData) {
        liveStatsTextElement.innerHTML += `<br>Owned Lands: <span class="color-point">${sanitizeHTML(window.ownerData.landCount)}</span>`;
 

    // Récupérer les supporters directement depuis window.supportersData
    const userSupportersData = window.supportersData.find(supporter => supporter.owner_address === userAccount);
    const supporters = userSupportersData ? userSupportersData.supporters : [];

        if (supporters.length > 0) {
            const supportLink = `<br>Support : <a href="#" id="supportLink" data-bs-toggle="modal" data-bs-target="#supportModal"> Click here</a>`;
            liveStatsTextElement.innerHTML += supportLink;
        
        document.getElementById('supportLink').addEventListener('click', async () => {
            try {
                // Récupérer la liste des forges actives
                const forgePlayers = await fetchForgeStatusCheck();
        
                // Envoyer les supporters à la route multipleplayers pour récupérer les defenses
                const response = await fetch(`/mission/multipleplayers?owners=${supporters.join(',')}`);
                const playersData = await response.json();
        
                if (Array.isArray(playersData)) {
                    // Calculer le total des defenses avec prise en compte de l'état Forge
                    let totalDefense = 0;
        
                    // Créer le tableau pour afficher les données
                    const tableHtml = `
                        <table class="table text-white table-borderless table-centered text-center">
                            <thead>
                                <tr>
                                    <th>Supporters</th>
                                    <th>Defense</th>
                                    <th>Forge</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${playersData.map(player => {
                                    const isForgeActive = forgePlayers.has(player.owner);
                                    const defenseValue = isForgeActive ? player.totalDefenseArm : player.totalDefense;
                                    totalDefense += defenseValue;
        
                                    return `
                                        <tr>
                                            <td>${player.owner}</td>
                                            <td>${defenseValue}</td>
                                            <td>${isForgeActive ? '<span style="color: green;">Active</span>' : '<span style="color: red;">Inactive</span>'}</td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="1"><strong>Total</strong></td>
                                    <td><strong>${totalDefense}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    `;
        
                    // Ajouter le tableau dans le modal
                    document.getElementById('supportList').innerHTML = tableHtml;
                } else {
                    document.getElementById('supportList').innerHTML = `<p>Error: Unable to fetch data</p>`;
                    console.error('Unexpected response format:', playersData);
                }
            } catch (error) {
                document.getElementById('supportList').innerHTML = `<p>Error loading data</p>`;
                console.error('Error fetching supporters data:', error);
            }
        });

		} else {
			liveStatsTextElement.innerHTML += `<br>No supporters available.`;
		}
    }
		} finally {
				isUpdating = false; // Déverrouille la fonction après exécution
			}
}

// Ajoutez cette fonction utilitaire pour attendre que window.supportersData soit rempli
function waitForSupportersData() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            if (window.supportersData && Array.isArray(window.supportersData) && window.supportersData.length > 0) {
                clearInterval(interval);
                resolve();
            } else if (attempts > 20) { // Limite à 20 tentatives (10 secondes)
                clearInterval(interval);
                reject('window.supportersData is not defined or empty after waiting');
            }
            attempts++;
        }, 500); // Vérifier toutes les 500 ms
    });
}


// Fonction pour nettoyer les entrées HTML
function sanitizeHTML(str) {
    var temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}
document.addEventListener('DOMContentLoaded', () => {
    const userType = localStorage.getItem("userType");
    const payoutContainer = document.getElementById('latest-payouts');
    
    // Création du bouton Latest Payouts
    if(userType === 'owner') {
    payoutContainer.innerHTML = '<button id="payout-button" class="btn btn-light planet-color-dynamique mt-1" style="font-size: 0.75rem;font-weight: 100;padding: 4px;border-color: unset;background-color: #ffffff2e;">Latest Payouts</button>';
    } else {
        return;
    }
    // Création du modal et ajout au DOM
    const modalHTML = `
        <div id="payout-modal" class="modal fade" tabindex="-1" aria-labelledby="payoutModalLabel" aria-hidden="true">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="payoutModalLabel">Latest Payouts</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div id="payout-content" class="text-center">Loading...</div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const payoutButton = document.getElementById('payout-button');
    const payoutModal = new bootstrap.Modal(document.getElementById('payout-modal'));
    
    payoutButton.addEventListener('click', () => {
        payoutModal.show();
        fetchLatestPayouts();
    });
});

async function fetchLatestPayouts() {
    const userAccount = localStorage.getItem("userAccount");
    const payoutContainer = document.getElementById('payout-content');
    payoutContainer.innerHTML = 'Loading...';

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const day = now.getUTCDate();

    let requests = [];

    if (day >= 1) {
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }
        const afterDatePrev16 = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-16T00:00:00.000Z`;
        const beforeDatePrev16 = `${prevYear}-${prevMonth.toString().padStart(2, '0')}-16T01:00:00.000Z`;
        requests.push({ after: afterDatePrev16, before: beforeDatePrev16 });
    }

    if (day >= 16) {
        const afterDateCurrent16 = `${year}-${month.toString().padStart(2, '0')}-16T00:00:00.000Z`;
        const beforeDateCurrent16 = `${year}-${month.toString().padStart(2, '0')}-16T01:00:00.000Z`;
        requests.push({ after: afterDateCurrent16, before: beforeDateCurrent16 });
    }

    const afterDateCurrent01 = `${year}-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`;
    const beforeDateCurrent01 = `${year}-${month.toString().padStart(2, '0')}-01T01:00:00.000Z`;
    requests.push({ after: afterDateCurrent01, before: beforeDateCurrent01 });

    let payments = [];
    for (const { after, before } of requests) {
        const url = `https://history.waxsweden.org/v2/history/get_actions?account=${userAccount}&limit=100&sort=desc&skip=0&after=${after}&before=${before}&filter=alien.worlds:*`;
        try {
            const response = await fetch(url);
            const data = await response.json();
            if (data.actions) {
                const filteredPayments = data.actions.filter(action => 
                    action.act.data.memo === "Reward planetary defense"
                ).map(action => ({
                    quantity: action.act.data.quantity,
                    trx_id: action.trx_id,
                    timestamp: new Date(action['@timestamp']).toLocaleString()
                }));
                payments = payments.concat(filteredPayments);
            }
        } catch (error) {
            console.error('Erreur lors de la récupération des paiements:', error);
        }
    }

    payments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    payments = payments.slice(0, 100).reverse();

    payoutContainer.innerHTML = payments.length > 0 ? payments.map(payment => 
        `<div class="d-flex justify-content-between">
            <span>${payment.timestamp}</span>
            <a href="https://wax.bloks.io/transaction/${payment.trx_id}" target="_blank">${payment.quantity}</a>
        </div>`
    ).join('<br>') : 'No recent payouts.';
}


function startPayoutCountdown() {
    const countdownElement = document.getElementById('payout-time-countdown');

    function updateCountdown() {
        const now = getCurrentUserTime();  // On utilise toujours getCurrentUserTime pour obtenir l'heure actuelle

        const targetDate = getLocalTargetDate(now);  // On calcule la date cible en fonction de l'heure locale

        let timeDifference = targetDate - now;

        const days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDifference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDifference % (1000 * 60)) / 1000);

        countdownElement.textContent = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        setTimeout(updateCountdown, 1000);
    }

    updateCountdown();
}


// Modification de la fonction generateImgUrl pour gérer les erreurs 404
async function generateImgUrl(chemin) {
    const baseUrl = "https://beastgarden.mypinata.cloud/ipfs/";
    const imgUrl = `${baseUrl}${chemin}`;

    try {
        const response = await fetch(imgUrl, { method: 'HEAD' }); // Vérifie uniquement si l'image existe
        if (response.ok) {
            return imgUrl; // Retourner l'URL si l'image est trouvée
        } else {
            console.warn(`Image not found: ${imgUrl}, using default image.`);
            return "../images/20241021_214433_0000.png"; // Retourner l'image par défaut
        }
    } catch (error) {
        console.error(`Error fetching image URL: ${imgUrl}`, error);
        return "../images/20241021_214433_0000.png"; // Retourner l'image par défaut en cas d'erreur
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await fetchMissionData(); // Fetch mission data au chargement de la page
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    const userAccount = localStorage.getItem("userAccount");
    if (!isLoggedIn || isLoggedIn !== "true") {
        window.location.href = "login-wax.html";
        return; // Stop further execution if not logged in
    }

    document.getElementById("wam").textContent = userAccount;

    try {
        const requestData = {
            code: "federation",
            table: "players",
            scope: "federation",
            json: true,
            limit: 100,
            lower_bound: userAccount,
            upper_bound: userAccount,
        };

        let playerResponse;
        for (let endpoint of apiEndpoints) {
            try {
                playerResponse = await apiRequestWithRetryh(endpoint, requestData);
                if (playerResponse) break; // Si la requête réussit, on arrête la boucle
            } catch (error) {
                console.warn(`Failed to retrieve player data from ${endpoint}, trying next...`);
            }
        }

        if (!playerResponse) {
            throw new Error("Unable to retrieve player data from all endpoints.");
        }

        window.playerData = playerResponse; // Assigner les données à une variable globale
        
        const playerAvatar = playerResponse.rows[0]?.avatar || "1099538252468";
        const playerTag = playerResponse.rows[0]?.tag || "No Tag";
        
        document.getElementById("name-info").textContent = playerTag;

        // Récupérer l'avatar
        try {
            const assetResponse = await $.ajax({
                url: `https://atomic.3dkrender.com//atomicassets/v1/assets/${playerAvatar}`,
                type: 'GET',
                contentType: 'application/json',
            });

            const templateId = assetResponse.data?.template?.template_id;

            if (templateId) {
                const mcRequestData = {
                    code: "members.mc",
                    table: "avatars",
                    scope: "members.mc",
                    json: true,
                    limit: 100,
                    lower_bound: templateId,
                    upper_bound: templateId,
                };

                let mcResponse;
                for (let endpoint of apiEndpoints) {
                    try {
                        mcResponse = await apiRequestWithRetryh(endpoint, mcRequestData);
                        if (mcResponse) break;
                    } catch (error) {
                        console.warn(`Failed to retrieve MC data from ${endpoint}, trying next...`);
                    }
                }

                if (mcResponse && mcResponse.rows.length > 0) {
                    const imageUrl = await generateImgUrl(mcResponse.rows[0].image);
                    document.getElementById("avatarImage").src = imageUrl; // Assigner l'URL de l'image
                } else {
                    document.getElementById("avatarImage").src = "../images/20241021_214433_0000.png"; // Afficher l'image par défaut
                }
            } else {
                document.getElementById("avatarImage").src = "../images/20241021_214433_0000.png"; // Afficher l'image par défaut
            }
        } catch (assetError) {
            const defaultImageUrl = "../images/20241021_214433_0000.png";
            document.getElementById("avatarImage").src = defaultImageUrl; // Afficher l'image par défaut
            console.error("Error fetching avatar information:", assetError);
            showToast("Failed to retrieve avatar information.", "error");
        }

    } catch (error) {
        console.error("Error fetching player data:", error);
        showToast("Failed to retrieve player data.", "error");
    }
    await fetchUserData(userAccount); // Utiliser la nouvelle fonction pour récupérer les données de l'utilisateur

    updateLiveStats(); // Assurez-vous que les statistiques en direct sont mises à jour
    startPayoutCountdown();

    var dropdownElements = document.querySelectorAll('.nav-item.dropdown');

    dropdownElements.forEach(function (dropdown) {
        let timeout;
        var toggle = dropdown.querySelector('.dropdown-toggle');
        var dropdownMenu = dropdown.querySelector('.dropdown-menu');
    
        if (!toggle || !dropdownMenu) {
            console.error('Element not found:', dropdown);
            return;
        }
    
        // Fonction pour montrer le dropdown
        function showDropdown() {
            clearTimeout(timeout);
            var dropdownInstance = new bootstrap.Dropdown(toggle);
            dropdownInstance.show();
        }
    
        // Fonction pour cacher le dropdown
        function hideDropdown() {
            var dropdownInstance = new bootstrap.Dropdown(toggle);
            timeout = setTimeout(function() {
                dropdownInstance.hide();
            }, 300);
        }
    
        // Événements pour ordinateurs de bureau
        dropdown.addEventListener('mouseenter', showDropdown);
        dropdown.addEventListener('mouseleave', hideDropdown);
        dropdownMenu.addEventListener('mouseenter', function () {
            clearTimeout(timeout);
        });
        dropdownMenu.addEventListener('mouseleave', hideDropdown);
    
        // Événements pour mobiles (touchstart et touchend) avec gestionnaire passif
        dropdown.addEventListener('touchstart', function (e) {
            e.stopPropagation();
            if (!toggle.classList.contains('show')) {
                showDropdown();
            } else {
                hideDropdown();
            }
        }, { passive: true });  // Marquer l'événement comme passif
    
        // Empêche le menu de se fermer immédiatement après son ouverture
        document.addEventListener('touchend', function (e) {
            if (!dropdown.contains(e.target)) {
                hideDropdown();
            }
        });
    
        // Empêche le comportement de fermeture immédiate après le premier clic/touch
        document.addEventListener('click', function (e) {
            if (!dropdown.contains(e.target)) {
                hideDropdown();
            }
        });
    });
});

function logout() {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userAccount");
	localStorage.removeItem("userType");
    window.location.href = "login-wax.html";
}

async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) { // Ajoutez cette vérification pour capturer les erreurs HTTP
            console.error(`HTTP error! Status: ${response.status}`);
            return null; // Retourner null si une erreur HTTP est rencontrée
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Erreur lors de la récupération des données:', error);
        return null; // Retourner null en cas d'erreur de requête
    }
}

async function fetchUserData(userAccount) {
    let userType = localStorage.getItem("userType");
    let data = null;
    let previousUserType = userType;

    // Essayer de récupérer les données de l'utilisateur
    if (userType === "owner") {
        data = await fetchData(`/mission/data/${userAccount}`);

        if (!data) {
            data = await fetchData(`/mission/players/${userAccount}`);
            if (data) {
                window.playerData = data;
                userType = 'player';
                localStorage.setItem("userType", userType);
            } else {
                console.error("Player data not found either.");
            }
        } else {
            window.ownerData = data;
        }
    } else {
        data = await fetchData(`/mission/players/${userAccount}`);

        if (!data) {
            data = await fetchData(`/mission/data/${userAccount}`);
            if (data) {
                window.ownerData = data;
                userType = 'owner';
                localStorage.setItem("userType", userType);
            } else {
                console.error("Owner data not found either.");
            }
        } else {
            window.playerData = data;
        }
    }

    // Vérifier une dernière fois si nous avons des données après les tentatives
    if (!data) {
        console.error("No data found for user:", userAccount);
        return;
    }

    // Afficher un message personnalisé si le type d'utilisateur a changé
    if (previousUserType !== userType) {
        showUserTypeChangeModal(previousUserType, userType);
    }

    const stats = calculateStats(userType === "owner" ? window.ownerData : window.playerData);
    updateStatsDisplay(stats);
}

function showUserTypeChangeModal(previousUserType, newUserType) {
    const modal = document.getElementById("userTypeChangeModal");
    const message = document.getElementById("userTypeChangeMessage");

    // Définir un message personnalisé avec un retour à la ligne
    if (previousUserType === "player" && newUserType === "owner") {
        message.innerHTML = "<b>Congratulations !</b><br> Now that you own a land, you're officially a warlord. A whole new world awaits you !<br> Please log out and log back in again.";
    } else if (previousUserType === "owner" && newUserType === "player") {
        message.innerHTML = "You no longer own any land !<br>A warlord is retiring from the field, but perhaps a fresh start as a mercenary will bring you greater success !<br> Please log out and log back in again.";
    } else {
        message.innerHTML = `You have changed from ${previousUserType} to ${newUserType}.`;
    }

    // Afficher le modal
    modal.style.display = "flex";
}

function calculateStats(data) {
    if (data) {
        return {
            totalDefense: data.totalDefense || 0,
            totalDefenseArm: data.totalDefenseArm || 0,
            totalAttack: data.totalAttack || 0,
            totalAttackArm: data.totalAttackArm || 0,
            totalMoveCost: data.totalMoveCost || 0,
            totalCrewSlots: data.totalSlots || 0,
            totalCrewNumber: data.totalCrew || 0,
            totalArmNumber: data.totalArm || 0,
        };
    } else {
        return {
            totalDefense: 0,
            totalDefenseArm: 0,
            totalAttack: 0,
            totalAttackArm: 0,
            totalMoveCost: 0,
            totalCrewSlots: 0,
            totalCrewNumber: 0,
            totalArmNumber: 0,
        };
    }
}

function updateStatsDisplay(stats) {

    const defenseScoreElement = document.getElementById("defenseScore");
    const defenseArmScoreElement = document.getElementById("defenseArmScore");
    const attackScoreElement = document.getElementById("attackScore");
    const attackArmScoreElement = document.getElementById("attackArmScore");
    const moveCostElement = document.getElementById("moveCost");
    const crewSlotsAvailableElement = document.getElementById("crewSlotsAvailable");
    const crewNumberElement = document.getElementById("crewNumber");
    const weaponsCountElement = document.getElementById("weaponsCount");

    if (defenseScoreElement && defenseArmScoreElement && attackScoreElement && attackArmScoreElement &&
        moveCostElement && crewSlotsAvailableElement && crewNumberElement && weaponsCountElement) {
        defenseScoreElement.textContent = `${stats.totalDefense}`;
        defenseArmScoreElement.textContent = `${stats.totalDefenseArm}`;
        attackScoreElement.textContent = `${stats.totalAttack}`;
        attackArmScoreElement.textContent = `${stats.totalAttackArm}`;
        moveCostElement.textContent = `${stats.totalMoveCost}`;
        crewSlotsAvailableElement.textContent = `${stats.totalCrewSlots}`;
        crewNumberElement.textContent = `${stats.totalCrewNumber}`;
        weaponsCountElement.textContent = `${stats.totalArmNumber}`;
    } else {
        console.error("One or more elements not found:", {
            defenseScoreElement,
            defenseArmScoreElement,
            attackScoreElement,
            attackArmScoreElement,
            moveCostElement,
            crewSlotsAvailableElement,
            crewNumberElement,
            weaponsCountElement
        });
    }
}

function waitForSupportersData() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            if (window.supportersData && Array.isArray(window.supportersData) && window.supportersData.length > 0) {
                clearInterval(interval);
                resolve();
            } else if (attempts > 20) { // Limite à 20 tentatives (10 secondes)
                clearInterval(interval);
                reject('window.supportersData is not defined or empty after waiting');
            }
            attempts++;
        }, 500); // Vérifier toutes les 500 ms
    });
}

document.addEventListener('DOMContentLoaded', function () {
    const imageModal = new bootstrap.Modal(document.getElementById('imageModal'));
    const modalImage = document.getElementById('modalImage');

    // Délégation d'événements pour détecter les clics sur les images dans des figures ou directement sur les images
    document.addEventListener('click', function (event) {
        // Vérifier si l'élément cliqué est une image dans une figure ou une image avec les classes spécifiques
        const clickedImage = event.target;
        if ((clickedImage.closest('figure') && clickedImage.tagName === 'IMG') || clickedImage.classList.contains('img-atk') || clickedImage.classList.contains('img-def')) {
            modalImage.src = clickedImage.src;
            imageModal.show();
        }
    });

    // Fermer le modal si l'utilisateur clique en dehors de l'image
    document.querySelector('#imageModal .modal-body').addEventListener('click', function (event) {
        if (event.target === this) { // Vérifie si le clic était sur le fond (hors de l'image)
            imageModal.hide();
        }
    });
});

function waitForPlayersData() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(() => {
            if (window.playersData && Array.isArray(window.playersData) && window.playersData.length > 0) {
                clearInterval(interval);
                resolve();
            } else if (attempts > 20) { // Limite à 20 tentatives (10 secondes)
                clearInterval(interval);
                reject('window.playersData is not defined or empty after waiting');
            }
            attempts++;
        }, 500); // Vérifier toutes les 500 ms
    });
}


window.startProgressIntervals = async function(){
    window.fetchAttackProgress();
    await fetchSupportersData();
    if (typeof window.fetchDefenseProgress === 'function') {
        window.fetchDefenseProgress();
    } 

    // Met à jour fetchPlayerInfo
    await fetchPlayerInfo();
    updateLiveStats();
};
