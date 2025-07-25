$(document).ready(function() {
    const avatarInfoUrl = 'https://atomic.3dkrender.com/atomicassets/v1/assets';
    const missionCache = [];
    const missionDetailsCache = {};
    const playerDetailsCache = {};
    const avatarImagesCache = {};
    const cacheDuration = 24 * 60 * 60 * 1000; // Cache duration in milliseconds (24 hours)

    // Function to extract numeric values from rewards
    $.fn.dataTable.ext.type.order['reward-pre'] = function(data) {
        return parseFloat(data.replace(' TLM', ''));
    };

    function displayErrorMessage(message) {
        const errorMessage = $('#error-message');
        errorMessage.text(message);
        errorMessage.show();
    }

    function loadAllData() {
        loadBattleHistory();
        loadAllMissionDetails();
    }

    async function loadBattleHistory(lowerBound = '') {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: 'missions',
            scope: window.planetData.WalletMission,
            limit: 1000,
            lower_bound: lowerBound
        };
        
        let lastError = null; // Stocker la dernière erreur rencontrée
        let success = false; // Variable pour savoir si un endpoint a réussi
        
        for (let endpoint of apiEndpoints) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
                missionCache.push(...response.rows);

                if (response.more) {
                    await loadBattleHistory(response.next_key);
                } else {
                    if (missionCache.length === 0) {
                        showToast('No Completed Missions at the Moment.', 'error');
                    } else {
                        renderBattleHistory();
                        const table = $('#battle-table').DataTable({
                            "paging": missionCache.length > 50,
                            "pageLength": 50,
                            "lengthChange": missionCache.length > 50,
                            "searching": false,
                            "info": missionCache.length > 50,
                            "ordering": true,
                            "autoWidth": false,
                            "scrollX": true,
                            "order": [[4, "desc"]] // Trier par la colonne Deadline en ordre décroissant
                        });

                        if (missionCache.length <= 50) {
                            table.columns.adjust().draw();
                        }
                    }
                }
                success = true; // Marquer comme succès
                break; // Stop trying other endpoints once we succeed
            } catch (error) {
                lastError = error; // Mettre à jour la dernière erreur
                console.error(`Failed to load battle history from endpoint ${endpoint}. Trying next...`);
            }
        }
        if (!success) {
            // Si aucun endpoint n'a réussi
            showToast('Error retrieving battle history. All endpoints failed.', 'error');
            console.error("All endpoints failed for battle history.");
            throw lastError; // Lancer l'erreur pour la gérer en amont
        }
    }

    async function loadAllMissionDetails(lowerBound = '') {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: 'playermiss',
            scope: window.planetData.WalletMission,
            limit: 1000,
            lower_bound: lowerBound
        };
        let lastError = null; // Stocker la dernière erreur rencontrée
        let success = false; // Variable pour savoir si un endpoint a réussi
        
        for (let endpoint of apiEndpoints) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
                response.rows.forEach(detail => {
                    if (!missionDetailsCache[detail.mission_name]) {
                        missionDetailsCache[detail.mission_name] = [];
                    }
                    missionDetailsCache[detail.mission_name].push(detail);
                });

                if (response.more) {
                    await loadAllMissionDetails(response.next_key);
                }
                success = true; // Marquer comme succès
                break; // Stop trying other endpoints once we succeed
                
            } catch (error) {
                lastError = error; // Mettre à jour la dernière erreur
                console.error(`Failed to load mission details from endpoint ${endpoint}. Trying next...`);
            }
        }
        if (!success) {
            // Si aucun endpoint n'a réussi
            showToast('Error retrieving mission details. All endpoints failed.', 'error');
            console.error("All endpoints failed for mission details.");
            throw lastError; // Lancer l'erreur pour la gérer en amont
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
        showToast('Impossible de récupérer les infos joueurs : tous les serveurs WAX sont inaccessibles.', 'error');
        console.error(`[DEBUG] Tous les endpoints sont KO pour ${player}.`);
        const defaultPlayerData = {
            avatar: '1099538252468',
            tag: 'No Tag'
        };
        playerDetailsCache[player] = defaultPlayerData;
        return defaultPlayerData;
    }

    async function getAvatarImages(avatarIds) {
        const deferred = $.Deferred();
        const idsToFetch = avatarIds.filter(id => !avatarImagesCache[id]);

        if (idsToFetch.length === 0) {
            deferred.resolve();
        } else {
            const idsString = idsToFetch.join(',');

            try {
                const response = await $.ajax({
                    url: `${avatarInfoUrl}?asset_id=${idsString}&limit=100`,
                    type: 'GET',
                    contentType: 'application/json'
                });

                response.data.forEach(asset => {
                    avatarImagesCache[asset.asset_id] = asset.data.img;
                });
                deferred.resolve();
            } catch (error) {
                console.error('Error loading avatars:', error);
                deferred.reject(error);
            }
        }

        return deferred.promise();
    }


    function renderBattleHistory() {
        const battleTableBody = $('#battle-table tbody');
        battleTableBody.empty();
        missionCache.forEach(mission => {
        const attacktlm = parseFloat(mission.reward) || '0';
        const attackshards = parseFloat(mission.shards) || '0';
          
            let status;
            if (mission.is_completed === 0 && mission.is_distributed === 0) {
              status = "Live";
            } else if (mission.is_distributed === 1) {
              if (mission.total_attack_points === mission.target_attack_points) {
                status = "Victory !";
              } else if (mission.total_attack_points < mission.target_attack_points) {
                status = "Defeat";
              }
            } else if (mission.is_completed === 1 && mission.is_distributed === 0 && mission.total_attack_points === mission.target_attack_points) {
                status = "Live";
             }
          
            const missionRow = $(`
                <tr data-id="${mission.mission_name}">
                    <td>${mission.mission_name}</td>
                    <td>${mission.total_attack_points}</td>
                    <td>${mission.target_attack_points}</td>
                    <td>${convertTimestampToUTC(mission.last_hardening_time)}</td>
                    <td>${mission.deadline.replace('T', ' ').substring(0, 19)}</td>
                    <td>${attacktlm}</td>
                    <td>${attackshards}</td>
                    <td>${status}</td>
                </tr>
            `);
            battleTableBody.append(missionRow);
        });
    }
    function calculateReward(mission, playerAttackPoints) {
        const totalAttackPoints = mission.total_attack_points;
        const targetAttackPoints = mission.target_attack_points;
        const reward = parseFloat(mission.reward);

        const playerReward = (playerAttackPoints / totalAttackPoints) * reward;
        return playerReward.toFixed(4) + ' PDT';
    }
    // mise à jours shards
    function calculateRewardShards(mission, playerAttackPoints) {
        const totalAttackPoints = mission.total_attack_points;
        const targetAttackPoints = mission.target_attack_points;
        const shards = parseFloat(mission.shards);

        const playerShards = (playerAttackPoints / totalAttackPoints) * shards;
        return playerShards.toFixed(4) + ' Shards';
    }

function displayMissionDetails(missionName, row) {
    const mission = missionCache.find(m => m.mission_name === missionName);
    const details = missionDetailsCache[missionName];

    // Map through details and create promises for each player info request
    const playerRequests = details.map(detail => {
        return getPlayerInfoOptimized(detail.player, apiEndpoints, playerDetailsCache, 200)
            .then(playerInfo => ({
                avatar: playerInfo.avatar || 'N/A',  // Utiliser N/A si l'avatar n'est pas trouvé
                player: detail.player,  // On garde le player depuis l'API des missions
                tag: playerInfo.tag || 'N/A'  // Utiliser N/A si le tag n'est pas trouvé
            }))
            .catch(() => ({
                avatar: 'N/A',
                player: detail.player,
                tag: 'N/A'
            }));
    });

    // Utiliser Promise.allSettled pour gérer les succès et les échecs
    Promise.allSettled(playerRequests).then(results => {
        const playerInfos = results.map(result => {
            if (result.status === 'fulfilled') {
                return result.value;
            } else {
                return {
                    avatar: 'N/A',
                    player: 'N/A',
                    tag: 'N/A'
                };
            }
        });

        // Ne faire les requêtes d'avatars que pour les avatars valides
        const avatarIds = playerInfos
            .map(info => info.avatar)
            .filter(avatar => avatar !== 'N/A');  // Filtrer les avatars "N/A"

        const avatarRequests = [];
        for (let i = 0; i < avatarIds.length; i += 99) {
            const batch = avatarIds.slice(i, i + 99);
            avatarRequests.push(getAvatarImages(batch).catch(() => {
                console.warn("Failed to load some avatars.");
            }));
        }

        // Après avoir récupéré les avatars, rendre les détails des missions
        Promise.allSettled(avatarRequests).then(() => {
            let detailHtml = `
                <tr class="detail-item hover-disable" id="detail-${missionName}">
                    <td colspan="8">
                        <table class="table details-table">
                            <thead class="table-secondary">
                                <tr>
                                    <th>Avatar</th>
                                    <th>Player</th>
                                    <th>Tag</th>
                                    <th>Attack Points</th>
                                    <th title="UTC">Last Participation Time</th>
                                    <th title="(Your Attack Point / Target Attack) * Rewards">Rewards</th>
                                </tr>
                            </thead>
                            <tbody id="detail-wrapper-tbody">
            `;

            details.forEach((detail, index) => {
                const playerInfo = playerInfos[index];
                // Utiliser un avatar par défaut si l'avatar n'est pas trouvé
                const avatar = playerInfo.avatar !== 'N/A' ? `https://ipfs.neftyblocks.io/ipfs/${avatarImagesCache[playerInfo.avatar]}` : 'default_avatar_url';
                const tag = playerInfo.tag || 'N/A';
                const reward = calculateReward(mission, detail.attack_points);
              	const shards = calculateRewardShards(mission, detail.attack_points);

                detailHtml += `
                    <tr>
                        <td><img src="${avatar}" alt="Avatar" width="50"></td>
                        <td>${detail.player}</td>  <!-- Utiliser le player des détails -->
                        <td>${tag}</td>
                        <td>${detail.attack_points}</td>
                        <td>${convertTimestampToUTC(detail.last_participation_time)}</td>
                        <td>${reward}<br>${shards}</td>
                    </tr>
                `;
            });

            detailHtml += `
                            </tbody>
                        </table>
                    </td>
                </tr>
            `;

            // Supprimer les lignes de détails existantes
            $('.detail-item').remove();

            // Insérer la nouvelle ligne de détails après la ligne de mission cliquée
            row.after(detailHtml);

            // Initialiser DataTables sur le tableau des détails sans pagination
            $(`#detail-${missionName} .details-table`).DataTable({
                "paging": false,
                "searching": false,
                "info": false,
                "ordering": true,
                "autoWidth": false,
                "columnDefs": [
                    { "type": "reward", "targets": 5 }
                ]
            });

            // Appliquer l'animation
            $(`#detail-${missionName}`).addClass('expanded');

            // Faire défiler jusqu'à la ligne de mission
            scrollToMissionRow(missionName);

            // Cacher le chargement
            $('#loading-overlay').hide();
            $('#battlehistory-center').removeClass('blur');
        });
    }).catch(() => {
        displayErrorMessage('Error loading player details.');
        $('#loading-overlay').hide();
        $('#battlehistory-center').removeClass('blur');
    });
}


    function convertTimestampToUTC(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    function scrollToMissionRow(missionName) {
        const row = $(`tr[data-id="${missionName}"]`);
        $('html, body').animate({
            scrollTop: row.offset().top - 100 // Adjust the offset as needed
        }, 600); // Adjust the duration as needed
    }

    loadAllData();

    $('#battle-table').on('click', 'tr', function(event) {
        const missionName = $(this).data('id');

        if (!missionName) return; // Ignore the click on the header

        const detailRow = $(`#detail-${missionName}`);

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
            // Show loading spinner
            $('#loading-overlay').show();
            $('#battlehistory-center').addClass('blur');
            displayMissionDetails(missionName, $(this));
        }
    });
});

