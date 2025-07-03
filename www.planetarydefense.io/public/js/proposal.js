function convertToLocalTimeProposal(utcTimestamp) {
    let date;
    if (utcTimestamp.toString().length === 10) {
        date = new Date(utcTimestamp * 1000);
    } else {
        date = new Date(utcTimestamp);
    }
    const datePart = date.toLocaleDateString('default', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const timePart = date.toLocaleTimeString('default', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    return `${datePart}<br>${timePart}`;
}

async function fetchPlayersData(owners) {
    try {
        const response = await fetch(`mission/multipleplayers?owners=${owners.join(',')}`);
        const playersData = await response.json();

        if (Array.isArray(playersData)) {
            // Associe chaque joueur à un objet contenant toutes les données nécessaires
            return playersData.reduce((acc, player) => {
                acc[player.owner] = {
                    totalDefense: player.totalDefense,
                    totalDefenseArm: player.totalDefenseArm, // Inclure la défense avec forge
                    totalAttack: player.totalAttack,
                    totalAttackArm: player.totalAttackArm, // Inclure les autres valeurs si nécessaire
                };
                return acc;
            }, {});
        } else {
            console.error('Unexpected response format:', playersData);
            return {};
        }
    } catch (error) {
        console.error("Error fetching players data:", error);
        return {};
    }
}
$(document).ready(async function () {
    // Attendre que les données de la forge soient disponibles
    const forgeDataReady = await waitForForgeData();
    if (!forgeDataReady) {
        console.error("Forge data not available in proposal.js.");
        return;
    }


    // Continuez avec votre logique existante
    updateSupportInfo();
});
async function waitForForgeData(maxRetries = 10, delay = 500) {
    let retries = 0;
    while ((!window.forgeStatusGlobalLeaderboard || !Array.isArray(window.forgeStatusGlobalLeaderboard.rows)) && retries < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay));
        retries++;
    }
    if (!window.forgeStatusGlobalLeaderboard || !Array.isArray(window.forgeStatusGlobalLeaderboard.rows)) {
        console.error("Forge data failed to load after multiple retries.");
        return false;
    }
    return true;
}

async function updateSupportInfo() {
    const userType = localStorage.getItem("userType");
    const userAccount = localStorage.getItem("userAccount");
    const route = userType === 'owner' ? '/mission/warlord' : '/mission/player';

    try {
        const response = await fetch(route, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [userType === 'owner' ? 'warlord' : 'player']: userAccount })
        });
        const data = await response.json();

        const titleDiv = document.getElementById("asksupport-title");
        const contentDiv = document.getElementById("asksupport-text-div");

        contentDiv.innerHTML = ""; 
        titleDiv.innerHTML = userType === 'owner' ? 'Request Pending' : 'Request Sent';

        const owners = data.filter(row => row.player).map(row => row.player);
        const playersData = userType === 'owner' && owners.length > 0 ? await fetchPlayersData(owners) : {};

        const statuses = ['Pending', 'Accepted', 'Declined'];
        let hasSections = false; // Variable to track if any section is displayed

        statuses.forEach(status => {
            let filteredRequests = data.filter(row => row.status.toLowerCase() === status.toLowerCase());

            if (status === 'Declined') {
                filteredRequests = filteredRequests
                    .sort((a, b) => b.request_id - a.request_id)
                    .slice(0, 2);
            }

            if (filteredRequests.length > 0) {
                hasSections = true; // Mark that a section is displayed

                const sectionDiv = document.createElement("div");
                sectionDiv.className = "mb-3 status-card";
                sectionDiv.id = `${status.toLowerCase()}-section`;

                const sectionTitle = document.createElement("h5");
                sectionTitle.className = "status-title";
                sectionTitle.innerText = status;
                sectionDiv.appendChild(sectionTitle);

                if (status === 'Pending') {
                    const expirationSpan = document.createElement("span");
                    expirationSpan.innerText = "(Expiration Time)";
                    expirationSpan.style.fontSize = "0.9em";
                    expirationSpan.style.color = "#888";
                    sectionDiv.appendChild(expirationSpan);
                }

                filteredRequests.forEach(row => displayRequest(row, sectionDiv, status, playersData));

                contentDiv.appendChild(sectionDiv);
            }
        });

        if (!hasSections) {
            const noRequestsMessage = document.createElement("p");
            noRequestsMessage.innerText = "You have no requests pending, accepted, or declined.";
            noRequestsMessage.className = "no-request";
            contentDiv.appendChild(noRequestsMessage);
        }
    } catch (error) {
        console.error("Error loading information: ", error);
        document.getElementById("asksupport-text-div").innerHTML = "Unable to load requests.";
    }
}

window.updateSupportInfo = updateSupportInfo;

// Fonction d'affichage d'une requête
function displayRequest(row, container, status, playersData) {
    const userType = localStorage.getItem("userType");
    const { request_id, player, warlord, expiration_time } = row;

    const lineDiv = document.createElement("div");
    lineDiv.className = "d-flex align-items-center justify-content-around mb-2";

    const userDiv = document.createElement("div");
	userDiv.className = "col-4 col-sm-4 col-md-4 col-lg-4 col-xl-4 col-xxl-4";
    userDiv.innerText = userType === 'owner' ? player : warlord;

    // Vérification des données dans playersData
    if (userType === 'owner' && playersData[player]) {
        const totalDefenseDiv = document.createElement("div");
        if (status === 'Pending') {    
             if (!window.forgeStatusGlobalLeaderboard || !Array.isArray(window.forgeStatusGlobalLeaderboard.rows)) {
                  console.error("Forge data is not available in displayRequest.");
                  const errorDiv = document.createElement("div");
                  errorDiv.innerText = "Error: Forge data unavailable.";
                  errorDiv.style.color = "red";
                  userDiv.appendChild(errorDiv);
                  lineDiv.appendChild(userDiv);
                  container.appendChild(lineDiv);
                  return;
              }
              const forgePlayers = new Set(
                  window.forgeStatusGlobalLeaderboard.rows.map(row => row.player_address)
              );

              const isForgeActive = forgePlayers.has(player); // Vérifie si la forge est activée
              const defenseValue = isForgeActive
                  ? playersData[player]?.totalDefenseArm || 'N/A'
                  : playersData[player]?.totalDefense || 'N/A';

              const totalDefenseDiv = document.createElement("div");
              totalDefenseDiv.innerText = `Defense: ${defenseValue}`;
              totalDefenseDiv.style.fontSize = "0.85em";
              totalDefenseDiv.style.color = "#888";

              userDiv.appendChild(totalDefenseDiv);
        }
    }

    lineDiv.appendChild(userDiv);


    // Afficher expiration_time uniquement pour Pending
    if (status === 'Pending') {
        const timeDiv = document.createElement("div");
        timeDiv.innerHTML = convertToLocalTimeProposal(expiration_time);
        timeDiv.className = "col-4 col-sm-4 col-md-4 col-lg-4 col-xl-4 col-xxl-4";
        lineDiv.appendChild(timeDiv);
    }

    // Gestion des boutons en fonction du type d'utilisateur et statut
    if (userType === 'owner') {
        // Bouton engage uniquement pour Pending
        if (status === 'Pending') {
            const checkButton = document.createElement("button");
            checkButton.id = "engage";
            checkButton.innerText = "✔";
            checkButton.className = "btn custom-btn-bg-valid btn-sm mx-1";
            checkButton.setAttribute("data-row-id", request_id);
            checkButton.setAttribute("data-action", "respondreq-accept");
            lineDiv.appendChild(checkButton);
        }

        // Bouton notengage pour Pending et Accepted
        if (['Pending'].includes(status)) {
            const crossButton = document.createElement("button");
            crossButton.id = "notengage";
            crossButton.innerText = "✖";
            crossButton.className = "btn custom-btn-bg-denied btn-danger btn-sm";
            crossButton.setAttribute("data-row-id", request_id);
            crossButton.setAttribute("data-action", "respondreq-decline");
            lineDiv.appendChild(crossButton);
            
        } else if (['Accepted'].includes(status)) { 
            const crossButton = document.createElement("button");
            crossButton.id = "notengage_fired";
            crossButton.innerText = "✖";
            crossButton.className = "btn custom-btn-bg-denied btn-danger btn-sm";
            crossButton.setAttribute("data-row-id", request_id);
            crossButton.setAttribute("data-row-player", player);
            crossButton.setAttribute("data-action", "delsupport");
            lineDiv.appendChild(crossButton);
        }
        
    } else if (userType === 'player') {
        // Pour les players, uniquement bouton notengage dans Pending et Accepted
        if (['Pending'].includes(status)) {
            const crossButton = document.createElement("button");
            crossButton.id = "notengage_player";
            crossButton.innerText = "✖";
            crossButton.className = "btn custom-btn-bg-denied btn-danger btn-sm";
            crossButton.setAttribute("data-row-id", request_id);
            crossButton.setAttribute("data-action", "cancelreq");
            lineDiv.appendChild(crossButton);
            
        } else if (['Accepted'].includes(status)) { 
            const crossButton = document.createElement("button");
            crossButton.id = "notengage_leave";
            crossButton.innerText = "✖";
            crossButton.className = "btn custom-btn-bg-denied btn-danger btn-sm";
            crossButton.setAttribute("data-row-id", request_id);
            crossButton.setAttribute("data-action", "leaveowner");
            lineDiv.appendChild(crossButton);
        }
        // Aucun bouton engage pour les players
    }

    container.appendChild(lineDiv);
}

// Définition de la fonction globale
window.startrequestIntervals = function() {
    updateSupportInfo();
};

// Rafraîchissement automatique toutes les 5 minutes
setInterval(updateSupportInfo, 1 * 60 * 1000);
// Appel initial pour charger les informations

