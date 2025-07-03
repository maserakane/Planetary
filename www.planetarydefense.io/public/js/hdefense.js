$(document).ready(function() {
    const construction = '0';
    if(construction === '0'){
    $('.modal').modal();
    const playerInfoUrl = 'https://api.waxsweden.org:443/v1/chain/get_table_rows';
    const avatarInfoUrl = 'https://wax.api.atomicassets.io/atomicassets/v1/assets';
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
    }

    function loadBattleHistory(lowerBound = '') {
        $.ajax({
            url: '/mission/mission-data-all-defense',
            type: 'GET',
            contentType: 'application/json',
            success: function(response) {
                missionCache.push(...response.defense);

                if (missionCache.length === 0) {
                    displayErrorMessage('No Completed Missions at the Moment.');
                } else {
                    renderBattleHistory();
                    const table = $('#battle-table').DataTable({
                        "paging": missionCache.length > 50,
                        "pageLength": 50,
                        "lengthChange": missionCache.length > 50,
                        "searching": false,
                        "info": missionCache.length > 50,
                        "ordering": true,
                        "autoWidth": false, // Ensure DataTables does not automatically set widths
                        "scrollX": true, // Enable horizontal scrolling
                        "order": [[2, "desc"]] // Trier par la colonne Start Date en ordre décroissant
                    });

                    if (missionCache.length <= 50) {
                        table.columns.adjust().draw();  // Adjust the columns after hiding the pagination and lengthChange
                    }
                }
            },
            error: function(xhr, status, error) {
                displayErrorMessage('Error loading missions: ' + error);
            }
        });
    }

    async function getPlayerInfo(player) {
        if (playerDetailsCache[player]) {
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
        
        let lastError = null; // Stocker la dernière erreur rencontrée
        
        // Essayer chaque endpoint avec retry et fallback
        for (let endpoint of apiEndpoints) {
            try {
                const response = await apiRequestWithRetryh(endpoint, requestData);
    
                if (response.rows && response.rows.length > 0) {
                    const playerInfo = response.rows[0];
                    const playerData = {
                        avatar: playerInfo.avatar || '1099538252468', // Valeur par défaut pour l'avatar
                        tag: playerInfo.tag || 'No Tag' // Valeur par défaut pour le tag
                    };
                    playerDetailsCache[player] = playerData; // Mise en cache
                    return playerData; // Retourne l'info joueur si trouvée
                } else {
                    // Utilisation des valeurs par défaut si aucun joueur trouvé
                    const defaultPlayerData = {
                        avatar: '1099538252468',
                        tag: 'No Tag'
                    };
                    playerDetailsCache[player] = defaultPlayerData; // Mise en cache des valeurs par défaut
                    return defaultPlayerData; // Retourner les valeurs par défaut
                }
            } catch (error) {
                console.error(`Failed to get player info from endpoint ${endpoint}. Trying next...`);
                showToast('Error retrieving player info. Retrying with another server.', 'error');
            }
            
        }
    
        // En cas de défaillance complète, renvoyer les valeurs par défaut
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

function renderBattleHistory() {

    const battleTableBody = $('#battle-table tbody');
    battleTableBody.empty();  // Pour éviter les doublons si la fonction est appelée plusieurs fois
	const currentTimestamp = Math.floor(Date.now() / 1000); // Timestamp actuel en secondes
    missionCache.forEach(mission => {
        if (mission.defenseStartDate > currentTimestamp) {
            // Ignorer les missions qui n'ont pas encore commencé
            return;
        }
        const attacktlm = parseFloat(mission.defenseRewards) || '0'; // Extraire la valeur numérique
        const attackshards = parseFloat(mission.defenseShards) || '0'; // Extraire la valeur numérique
        let status = mission.progress === 0 ? "Live" : "Paid";  // Statut basé sur la progression

        const missionRow = $(`
            <tr data-id="${mission.defenseTitleOnchain}" 
                data-attacktlm="${attacktlm}" 
                data-attackshards="${attackshards}"
                data-total-land="${mission.landCount}">
                <td>${mission.defenseTitleSite || 'undefined'}</td>
                <td>${mission.defenseTarget || 'undefined'}</td>
                <td>${convertTimestampToUTC(mission.defenseStartDate)}</td>
                <td>${convertTimestampToUTC(mission.defenseEndDate)}</td>
                <td>${attacktlm}</td>
                <td>${attackshards}</td>
                <td>${status}</td>
            </tr>
        `);
        battleTableBody.append(missionRow);
    });
}



function displayMissionDetails(missionName, row) {
    const attacktlm = parseFloat(row.data('attacktlm'));
    const attackshards = parseFloat(row.data('attackshards'));
    const totalLand = parseInt(row.data('total-land'));

    loadAllMissionDetails(missionName, function(details) {
        const playerRequests = details.map(detail => {
            return getPlayerInfo(detail.owner_address)
                .then(playerInfo => ({
                    avatar: playerInfo.avatar || 'N/A',  
                    player: detail.owner_address,
                    tag: playerInfo.tag || 'N/A',
                    landCount: detail.land_ids.length, // Nombre de lands pour ce warlord
                    landIds: detail.land_ids, // Land IDs
                    shards: detail.shards || [],  // <-- UTILISE DETAIL.SHARDS
                    supporters: detail.supporters // Liste des supporters
                }))
                .catch(() => ({
                    avatar: 'N/A',
                    player: detail.owner_address,
                    tag: 'N/A',
                    landCount: 0,
                    landIds: [],
                    shards: [],  // <-- PAR DÉFAUT SI ABSENT
                    supporters: []
                }));
        });

        Promise.allSettled(playerRequests).then(results => {
            const playerInfos = results.map(result => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        avatar: 'N/A',
                        player: 'N/A',
                        tag: 'N/A',
                        landCount: 0,
                        landIds: [],
                        supporters: []
                    };
                }
            });

            const avatarIds = playerInfos.map(info => info.avatar).filter(avatar => avatar !== 'N/A');

            const avatarRequests = [];
            for (let i = 0; i < avatarIds.length; i += 99) {
                const batch = avatarIds.slice(i, i + 99);
                avatarRequests.push(getAvatarImages(batch).fail(() => {
                    console.warn("Failed to load some avatars.");
                }));
            }

            Promise.allSettled(avatarRequests).then(() => {
                let detailHtml = `
                    <tr class="detail-item hover-disable" id="detail-${missionName}">
                        <td colspan="7">
                            <table class="table details-table">
                                <thead class="table-secondary">
                                    <tr>
                                        <th>Avatar</th>
                                        <th>Warlord</th>
                                        <th>Tag</th>
                                        <th>Land</th>
                                        <th>Warlords Shards</th>
                                        <th>Total PDT</th>
                                        <th>Total Shards</th>
                                        <th>Supporters</th>
                                    </tr>
                                </thead>
                                <tbody id="detail-wrapper-tbody">
                `;

                playerInfos.forEach((playerInfo, index) => {
                    const totalLand = playerInfos.reduce((sum, info) => sum + info.landCount, 0);
                    const warlordLandCount = playerInfo.landCount;
                    const warlordShards = playerInfo.shards && playerInfo.shards.length > 0 ? playerInfo.shards[0] : '0'; // Shards du warlord (premier entier)

                    // Garder les calculs pour TLM et shards basés sur les lands
                    const tlmPerWarlord = totalLand > 0 ? ((attacktlm / totalLand) * warlordLandCount).toFixed(2) : 0; 
                    const shardsPerWarlord = totalLand > 0 ? ((attackshards / totalLand) * warlordLandCount).toFixed(2) : 0;
                
                    const avatar = playerInfo.avatar !== 'N/A' ? `https://ipfs.neftyblocks.io/ipfs/${avatarImagesCache[playerInfo.avatar]}` : 'default_avatar_url';
                    const tag = playerInfo.tag || 'N/A';
                
                    const supportersLink = `<a href="#" class="open-supporters-modal" data-supporters='${JSON.stringify(playerInfo.supporters)}' data-shards='${JSON.stringify(playerInfo.shards)}'>${playerInfo.supporters.length}</a>`;
                    const landsLink = `<a href="#" class="open-lands-modal" data-lands='${JSON.stringify(playerInfo.landIds)}'>${warlordLandCount}</a>`;
                
                    detailHtml += `
                        <tr>
                            <td><img src="${avatar}" alt="Avatar" width="50"></td>
                            <td>${playerInfo.player}</td>
                            <td>${tag}</td>
                            <td>${landsLink}</td>
                            <td>${warlordShards}</td> <!-- Shards indépendants des TLM et shards calculés -->
                            <td>${tlmPerWarlord}</td> <!-- TLM calculé par land -->
                            <td>${shardsPerWarlord}</td> <!-- Shards calculé par land -->
                            <td>${supportersLink}</td>
                        </tr>
                    `;
                });

                detailHtml += `
                            </tbody>
                        </table>
                    </td>
                </tr>
                `;

                $('.detail-item').remove();
                row.after(detailHtml);

                $(`#detail-${missionName} .details-table`).DataTable({
                    "paging": false,
                    "searching": false,
                    "info": false,
                    "ordering": true,
                    "autoWidth": false
                });

                $(`#detail-${missionName}`).addClass('expanded');
                scrollToMissionRow(missionName);
                $('#loading-overlay').hide();
                $('#battlehistory-center').removeClass('blur');

                // Activer les modals pour les supporters et lands
                bindModalEvents();
            });
        }).catch(() => {
            displayErrorMessage('Error loading player details.');
            $('#loading-overlay').hide();
            $('#battlehistory-center').removeClass('blur');
        });
    });
}
function bindModalEvents() {
    // Ouvrir le modal des supporters
    $('.open-supporters-modal').on('click', function(e) {
        e.preventDefault();
    
        let supporters = $(this).data('supporters');
        let shards = $(this).data('shards'); // Récupérer les shards
        
        // Si `supporters` ou `shards` est indéfini, afficher une erreur ou utiliser des valeurs par défaut
        if (!supporters || !Array.isArray(supporters)) {
            console.error("Supporters data is invalid or undefined.");
            return;
        }
        
        if (!shards || !Array.isArray(shards)) {
            console.error("Shards data is invalid or undefined. Using default values.");
            shards = []; // Initialise une liste vide pour éviter l'erreur
        }
    
        const supporterTable = $('#supporter-table tbody');
        supporterTable.empty(); // Vider le contenu précédent du tableau
    
        supporters.forEach((supporter, index) => {
            const supporterShards = shards[index + 1] || '0'; // Le supporter commence à l'index 1 dans shards
            supporterTable.append(`
                <tr>
                    <td>${supporter}</td>
                    <td>${supporterShards}</td>
                </tr>
            `);
        });
    
        $('#supporterModal').modal('show'); // Ouvre le modal
    });

    // Ouvrir le modal des lands
    $('.open-lands-modal').on('click', function(e) {
        e.preventDefault();

        // Récupérer les land_ids
        let lands = $(this).data('lands');
        
        // Si lands est une chaîne JSON, la convertir en tableau
        if (typeof lands === 'string') {
            try {
                lands = JSON.parse(lands);
            } catch (e) {
                console.error("Invalid JSON for lands:", lands);
                return;
            }
        }

        const landList = $('#landid-list');
        landList.empty();

        lands.forEach(land => {
            landList.append(`<li>${land}</li>`);
        });

        // Utilisez la méthode correcte pour ouvrir le modal
        $('#landIdModal').modal('show'); // Bootstrap utilise "show"
    });
}


    async function loadAllMissionDetails(missionName, callback) {
        const requestData = {
            json: true,
            code: window.planetData.WalletMission,
            table: 'defwin2',
            scope: window.planetData.WalletMission,
            limit: 1000,
            lower_bound: missionName,
            upper_bound: missionName,
            key_type: 'name',
            index_position: 3
        };
    
        try {
            // Utilisation de la fonction apiRequestWithRetry pour gérer les requêtes avec retry et fallback
            let missionDetails = null;
            for (let endpoint of apiEndpoints) {
                try {
                    const response = await apiRequestWithRetryh(endpoint, requestData);
                    missionDetails = response.rows;
    
                    if (missionDetails && missionDetails.length > 0) {
                        missionDetailsCache[missionName] = missionDetails;
                        callback(missionDetails);
                    } else {
                        showToast('Mission in progress, details not yet available.', 'error');
                    }
                    
                    $('#loading-overlay').hide();
                    return; // Arrêter si la requête réussit
                } catch (error) {
                    console.error(`Error loading mission details from endpoint ${endpoint}. Trying next...`, error);
                }
            }
    
            if (!missionDetails) {
                showToast('Failed to load mission details after multiple attempts.', 'error');
                $('#loading-overlay').hide();
            }
        } catch (error) {
            showToast('Error loading mission details. Please try again later.', 'error');
            console.error('Error loading mission details:', error);
            $('#loading-overlay').hide();
        }
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
    } else {
            const constructionDiv = document.getElementById('under-construction');

            const heading = document.createElement('h1');
            heading.innerText = 'Under Construction';
            constructionDiv.appendChild(heading);

            const message = document.createElement('p');
            message.innerText = "We're working hard to improve this page. Please check back later!";
            constructionDiv.appendChild(message);
    }
});
