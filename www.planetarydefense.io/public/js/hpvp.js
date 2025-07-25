$(document).ready(function() {
    const avatarInfoUrl = 'https://atomic.3dkrender.com/atomicassets/v1/assets';
    let pvpCache = [];
    const playerDetailsCache = {};
    const avatarImagesCache = {};
    const cacheDuration = 24 * 60 * 60 * 1000; // Cache duration in milliseconds (24 hours)

    function displayErrorMessage(message) {
        const errorMessage = $('#error-message');
        errorMessage.text(message);
        errorMessage.show();
    }

    function loadAllData() {
        loadPvPHistory();
    }

    async function loadPvPHistory(lowerBound = '') {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: 'pvp3',
            scope: window.planetData.WalletMission,
            limit: 1000,
            lower_bound: lowerBound
        };
    
        for (let endpoint of apiEndpoints) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
    
                pvpCache.push(...response.rows);
    
                if (response.more) {
                    await loadPvPHistory(response.next_key);
                } else {
                    if (pvpCache.length === 0) {
                        showToast('No PvP History at the Moment.', 'error');
                    } else {
                        const filteredCache = pvpCache.filter(mission => mission.phase === 'result');
                        renderPvPHistory(filteredCache);
                    }
                }
                break; // Arrêter la boucle si la requête réussit
            } catch (error) {
                console.error(`Error loading PvP history from endpoint ${endpoint}. Trying next...`, error);
            }
            showToast('Error loading PvP history.', 'error');
        }
    }

    // Helper pour attendre un délai
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Helper pour tourner sur les endpoints
    let endpointIndex = 0;
    function getNextEndpoint(apiEndpoints) {
        endpointIndex = (endpointIndex + 1) % apiEndpoints.length;
        return apiEndpoints[endpointIndex];
    }
    // Version optimisée de getPlayerInfo
    // Liste dynamique d'endpoints actifs pour la session
    let activeApiEndpoints = [...apiEndpoints];
    let endpointFailures = {};

    async function getPlayerInfoOptimized(player, apiEndpoints, playerDetailsCache, throttleMs = 200) {
        if (playerDetailsCache[player]) {
            console.log(`[DEBUG] Cache hit pour le joueur ${player}`);
            return playerDetailsCache[player];
        }
        const requestData = {
            json: true,
            code: 'federation',
            table: 'players',
            scope: 'federation',
            limit: 1,
            lower_bound: player,
            upper_bound: player
        };
        console.log(`[DEBUG] Début de la récupération des infos pour ${player}`);
        for (let i = 0; i < activeApiEndpoints.length; i++) {
            const endpoint = activeApiEndpoints[i];
            console.log(`[DEBUG] Tentative ${i + 1}/${activeApiEndpoints.length} : endpoint = ${endpoint}`);
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
                console.log(`[DEBUG] Succès endpoint ${endpoint} pour ${player} :`, response);
                if (response.rows && response.rows.length > 0) {
                    const playerInfo = response.rows[0];
                    playerDetailsCache[player] = playerInfo;
                    await sleep(throttleMs);
                    // Reset failure count on success
                    endpointFailures[endpoint] = 0;
                    console.log(`[DEBUG] Infos trouvées pour ${player} sur ${endpoint}. Cache mis à jour.`);
                    return playerInfo;
                } else {
                    console.warn(`[DEBUG] Réponse vide pour ${player} sur ${endpoint}`);
                }
            } catch (error) {
                // Compte les échecs pour chaque endpoint
                endpointFailures[endpoint] = (endpointFailures[endpoint] || 0) + 1;
                console.error(`[DEBUG] Échec endpoint ${endpoint} pour ${player} (tentative ${endpointFailures[endpoint]}) :`, error);
                // Si l'endpoint échoue 3 fois, on le retire temporairement
                let remove = false;
                // Erreurs réseau/CORS/SSL détectées par readyState 0 ou status 0
                if (
                    (error && error.status === 0) ||
                    (error && error.statusText && error.statusText.toLowerCase().includes('cors')) ||
                    (error && error.statusText && error.statusText.toLowerCase().includes('ssl')) ||
                    (error && error.readyState === 0)
                ) {
                    remove = true;
                    console.warn(`[DEBUG] Endpoint ${endpoint} retiré (CORS/SSL/Network error détecté)`);
                }
                if (endpointFailures[endpoint] >= 3) {
                    remove = true;
                    console.warn(`[DEBUG] Endpoint ${endpoint} retiré (3 échecs consécutifs)`);
                }
                if (remove) {
                    activeApiEndpoints = activeApiEndpoints.filter(e => e !== endpoint);
                    console.log(`[DEBUG] Endpoints actifs restants :`, activeApiEndpoints);
                }
            }
            await sleep(throttleMs);
        }
        // Si tous les endpoints échouent, on affiche une seule erreur utilisateur
        showErrorToastOnce('Impossible de récupérer les infos joueurs : tous les serveurs WAX sont inaccessibles.');
        console.error(`[DEBUG] Tous les endpoints sont KO pour ${player}.`);
        const defaultPlayerData = {
            avatar: '1099538252468',
            tag: 'No Tag'
        };
        playerDetailsCache[player] = defaultPlayerData;
        return defaultPlayerData;
    }


    function getAvatarImages(avatarIds) {
        const deferred = $.Deferred();
        const idsToFetch = avatarIds.filter(id => !avatarImagesCache[id]);

        if (idsToFetch.length === 0) {
            deferred.resolve();
        } else {
            const idsString = idsToFetch.join(',');

            $.ajax({
                url: `${avatarInfoUrl}?asset_id=${idsString}&limit=100`,
                type: 'GET',
                contentType: 'application/json',
                success: function(response) {
                    response.data.forEach(asset => {
                        avatarImagesCache[asset.asset_id] = asset.data.img;
                    });
                    deferred.resolve();
                },
                error: function(xhr, status, error) {
                    displayErrorMessage('Error loading avatars: ' + error);
                    deferred.reject(error);
                }
            });
        }

        return deferred.promise();
    }
    
    function convertTimestampToUserTime(timestamp) {
        const date = new Date(timestamp * 1000); // Convertir le timestamp en millisecondes
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        }); // Pas de timeZoneName
    }

    function renderPvPHistory(filteredCache) {
        const pvpTableBody = $('#battle-table tbody');
        const playerRequests = filteredCache.map(mission => getPlayerInfoOptimized(mission.selected_player, apiEndpoints, playerDetailsCache, 200));

        $.when.apply($, playerRequests).done(function() {
            let playerInfos;
            if (playerRequests.length === 1) {
                playerInfos = [arguments[0]];
            } else {
                playerInfos = Array.prototype.slice.call(arguments);
            }

            const avatarIds = playerInfos.map(info => info.avatar);
            const avatarRequests = [];

            for (let i = 0; i < avatarIds.length; i += 99) {
                const batch = avatarIds.slice(i, i + 99);
                avatarRequests.push(getAvatarImages(batch));
            }

            $.when.apply($, avatarRequests).done(function() {
                filteredCache.forEach((mission, index) => {
                    const playerInfo = playerInfos[index];
                    const avatar = playerInfo ? avatarImagesCache[playerInfo.avatar] : '';
                    const winner = mission.winner ? (mission.winner === 'defense' ? 'Defense' : 'Attack') : '';
                    const missionRow = $(`
                        <tr data-id="${mission.id}" id="mission-${mission.id}">
                            <td><img src="https://ipfs.neftyblocks.io/ipfs/${avatar}" alt="Avatar" width="50"></td>
                            <td>${mission.selected_player}</td>
                            <td>${mission.land_id}</td>
                            <td>${mission.defense_score}</td>
                            <td>${mission.attack_score}</td>
                            <td>${winner}</td>
                            <td>${mission.rewards}</td>
                            <td>${convertTimestampToUserTime(mission.defense_end_time)}</td>
                            <td>${convertTimestampToUserTime(mission.attack_end_time)}</td>
                        </tr>
                    `);
                    pvpTableBody.append(missionRow);
                });

                initializeDataTable(filteredCache);
                setUpRowClickHandler();
            }).fail(function() {
                displayErrorMessage('Error loading avatars.');
                $('#loading-overlay').hide();
                $('#battlehistory-center').removeClass('blur');
            });
        }).fail(function() {
            displayErrorMessage('Error loading player details.');
            $('#loading-overlay').hide();
            $('#battlehistory-center').removeClass('blur');
        });
    }

    function initializeDataTable(filteredCache) {
        const table = $('#battle-table').DataTable({
            "paging": filteredCache.length > 50,
            "pageLength": 50,
            "lengthChange": filteredCache.length > 50,
            "searching": false,
            "info": filteredCache.length > 50,
            "ordering": true,
            "autoWidth": false,
            "scrollX": true,
            "order": [[8, 'desc']], // Trier par la 9ème colonne (index 8, attack_end_time) en décroissant
            "columnDefs": [
                { "type": "datetime", "targets": 8 } // Indique que la colonne 8 contient des dates/horaires
            ]
        });

        if (filteredCache.length <= 50) {
            table.columns.adjust().draw();
        }
    }

    function setUpRowClickHandler() {
        $('#battle-table').on('click', 'tr', function(event) {
            const missionId = $(this).data('id');

            if (missionId === undefined || missionId === null) return; // Ignore the click on the header

            const detailRow = $(`#detail-${missionId}`);

            if (detailRow.length) {
                detailRow.slideUp(function() {
                    detailRow.remove();
                    $('#loading-overlay').hide();
                    $('#battlehistory-center').removeClass('blur');
                });
            } else {
                $('.detail-item').slideUp(function() {
                    $(this).remove();
                });
                // Afficher le loading
                console.log('[DEBUG] Affichage du loading pour chargement des détails PvP...');
                $('#loading-overlay').show();
                $('#battlehistory-center').addClass('blur');
                displayMissionDetails(missionId, $(this));
            }
        });
    }

function displayMissionDetails(missionId, row) {
    const mission = pvpCache.find(m => m.id === missionId);
    if (!mission) {
        console.error('Mission not found.');
        displayErrorMessage('Mission not found.');
        $('#loading-overlay').hide();
        $('#battlehistory-center').removeClass('blur');
        return;
    }

    const details = [];
    mission.defense_list.forEach(player => {
        details.push({ player, type: 'defense' });
    });
    mission.attack_list.forEach(player => {
        details.push({ player, type: 'attack' });
    });

    const playerRequests = details.map(detail => getPlayerInfoOptimized(detail.player, apiEndpoints, playerDetailsCache, 200));

    $.when.apply($, playerRequests).done(function() {
        let playerInfos;
        if (playerRequests.length === 1) {
            playerInfos = [arguments[0]];
        } else {
            playerInfos = Array.prototype.slice.call(arguments);
        }

        const avatarIds = playerInfos.map(info => info.avatar);

        const avatarRequests = [];
        for (let i = 0; i < avatarIds.length; i += 99) {
            const batch = avatarIds.slice(i, i + 99);
            avatarRequests.push(getAvatarImages(batch));
        }

        $.when.apply($, avatarRequests).done(function() {
          let rewardsValue = 0;

          if (typeof mission.rewards === 'string' && mission.rewards.includes(' ')) {
              const updatedRewards = mission.rewards.replace('TLM', 'PDT');

              const rewardParts = updatedRewards.split(' ');

              rewardsValue = parseFloat(rewardParts[0]);

          } else {
              console.error('Unexpected rewards format:', mission.rewards);
              rewardsValue = 0;
          }

            const attackRewardsPerPlayer = mission.attack_list.length > 0 ? rewardsValue / mission.attack_list.length : 0;

            let detailHtml = `
                <tr class="detail-item hover-disable" id="detail-${missionId}">
                    <td colspan="10">
                        <table class="table details-table">
                            <thead class="table-secondary">
                                <tr>
                                    <th>Avatar Defense Players</th>
                                    <th>Players Defense List</th>
                                    <th>Avatar Attack Players</th>
                                    <th>Players Attack List</th>
                                    <th>Rewards per Player</th>
                                </tr>
                            </thead>
                            <tbody id="detail-wrapper-tbody">
            `;

            const maxRows = Math.max(mission.defense_list.length, mission.attack_list.length);
            for (let i = 0; i < maxRows; i++) {
                const defensePlayer = mission.defense_list[i] || '';
                const attackPlayer = mission.attack_list[i] || '';
                const defensePlayerInfo = playerInfos.find(info => info.account === defensePlayer);
                const attackPlayerInfo = playerInfos.find(info => info.account === attackPlayer);
                const defenseAvatar = defensePlayerInfo ? avatarImagesCache[defensePlayerInfo.avatar] : '';
                const attackAvatar = attackPlayerInfo ? avatarImagesCache[attackPlayerInfo.avatar] : '';

                detailHtml += `
                    <tr>
                        <td>${defensePlayer ? `<img src="https://ipfs.neftyblocks.io/ipfs/${defenseAvatar}" alt="Avatar" width="50">` : ''}</td>
                        <td>${defensePlayer}</td>
                        <td>${attackPlayer ? `<img src="https://ipfs.neftyblocks.io/ipfs/${attackAvatar}" alt="Avatar" width="50">` : ''}</td>
                        <td>${attackPlayer}</td>
                        <td>${attackPlayer ? attackRewardsPerPlayer.toFixed(4) + ' PDT' : ''}</td>
                    </tr>
                `;
            }

            detailHtml += `
                            </tbody>
                        </table>
                    </td>
                </tr>
            `;

            // Remove any existing detail rows
            $('.detail-item').remove();

            // Insert the new detail row after the clicked mission row
            row.after(detailHtml);

            // Initialize DataTables on the details table without pagination or length change
            $(`#detail-${missionId} .details-table`).DataTable({
                "paging": false,
                "searching": false,
                "info": false,
                "ordering": true,
                "autoWidth": false
            });

            // Apply animation
            $(`#detail-${missionId}`).addClass('expanded');

            // Scroll to the mission row
            scrollToMissionRow(missionId);

            // Hide loading
            console.log('[DEBUG] Masquage du loading : données PvP prêtes à afficher.');
            $('#loading-overlay').hide();
            $('#battlehistory-center').removeClass('blur');
        }).fail(function() {
            displayErrorMessage('Error loading avatars.');
            console.log('[DEBUG] Masquage du loading : erreur lors du chargement des avatars.');
            $('#loading-overlay').hide();
            $('#battlehistory-center').removeClass('blur');
        });
    }).fail(function() {
        displayErrorMessage('Error loading player details.');
        console.log('[DEBUG] Masquage du loading : erreur lors du chargement des infos joueurs.');
        $('#loading-overlay').hide();
        $('#battlehistory-center').removeClass('blur');
    });
}




    function convertTimestampToUTC(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    function scrollToMissionRow(missionId) {
        const row = $(`tr[data-id="${missionId}"]`);
        $('html, body').animate({
            scrollTop: row.offset().top - 100 // Adjust the offset as needed
        }, 600); // Adjust the duration as needed
    }

    // Protection anti-spam pour les toasts d'erreur
    let lastErrorToastTime = 0;
    function showErrorToastOnce(message) {
        const now = Date.now();
        if (now - lastErrorToastTime > 5000) { // 5 secondes entre deux toasts identiques
            showToast(message, 'error');
            lastErrorToastTime = now;
        } else {
            console.log('[DEBUG] Toast d\'erreur ignoré pour éviter le spam :', message);
        }
    }

    loadAllData();
});
