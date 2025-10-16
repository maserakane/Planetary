window.initLeaderboardPage = function() {
    const userAccount = localStorage.getItem("userAccount");
    const userType = localStorage.getItem("userType");
    function addLandCountToSupport(supportData, missionData) {
        const ownerLandCountMap = {};
        missionData.forEach(item => {
            ownerLandCountMap[item.owner] = item.landCount || 0;
        });
    
        supportData.forEach(support => {
            support.landCount = ownerLandCountMap[support.owner_address] || 0;
        });
    
        return supportData;
    }
    
    function fetchData(endpoint, callback) {
        fetch(endpoint)
            .then(response => response.json())
            .then(data => {
                if (Array.isArray(data)) {
                    callback(data);
                } else {
                    callback([data]);
                }
            })
            .catch(error => console.error("Error fetching data:", error));
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
                const response = await apiRequestWithRetryh(endpoint, requestData, 1, 500);
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
    
    function fetchSupportData(callback) {
        const endpoint = 'https://api.wax.bountyblok.io/v1/chain/get_table_rows';
        const requestData = {
            "json": true,
            "code": window.planetData.WalletMission,
            "table": "supports",
            "scope": window.planetData.WalletMission,
            "limit": 1000
        };

        fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => callback(data.rows))
        .catch(error => console.error("Error fetching support data:", error));
    }

    function clearOldControls() {
        $('#table-filter').empty();
        $('#table-length').empty();
        $('#table-info-text').empty();
        $('#table-pagination').empty();
    }

    // Fonctions de tri personnalisées pour les colonnes spécifiques
    $.fn.dataTable.ext.type.order['total-crew-pre'] = function(data) {
        var parts = data.split('/');
        var crew = parseInt(parts[0].trim(), 10);
        var slots = parseInt(parts[1].trim(), 10);

        return (crew * 1000) + slots;
    };
    
    $.fn.dataTable.ext.type.order['percent-pre'] = function(data) {

        const match = data.match(/([\d.]+)%/);
        const number = match ? match[1] : 0;
        return parseFloat(number);             
    };
        
    $.fn.dataTable.ext.type.order['supporters-count-pre'] = function(data) {
        var count = parseInt($(data).text().trim(), 10);
        return count || 0;
    };

    const tableConfigurations = {
        players: {
            columns: [
                { title: "Owner" },
                { title: "Total Crew / Total Slots", type: 'total-crew' },
                { title: "Total Defense" },
                { title: "Total Attack" },
                { title: "Total Attack Arm" },
                { title: "Total Defense Arm" },
                { title: "Total Move Cost" },
                { title: "Total Arm" },
                { title: "Forge" }
            ]
        },
        owners: {
            columns: [
                { title: "Owner" },
                { title: "Total Crew / Total Slots", type: 'total-crew' },
                { title: "Total Defense" },
                { title: "Total Attack" },
                { title: "Total Attack Arm" },
                { title: "Total Defense Arm" },
                { title: "Total Move Cost" },
                { title: "Total Arm" },
                { title: "Forge" }
            ]
        },
        support: {
            columns: [
                { title: "Owner Address" },
                { title: "Supporters", type: 'supporters-count' },
                { title: "Total Defense Score" },
                { title: "Total Attack Score" },
                { title: "Total Move Cost" },
                { title: "Land Count" },
                { title: "Active" },
                { title: "Live Defense", type: 'percent' }
            ]
        }
    };

    function createTable(type) {
        const config = tableConfigurations[type];
        
        if ($.fn.dataTable.isDataTable('#leaderboard-table-ld')) {
            $('#leaderboard-table-ld').DataTable().clear().destroy();
            clearOldControls();
        }

        $('#leaderboard-table-ld thead tr').empty();
        config.columns.forEach(col => {
            $('#leaderboard-table-ld thead tr').append(`<th>${col.title}</th>`);
        });

        const columnDefs = config.columns.map((col, index) => {
            if (col.type) {
                return { targets: index, type: col.type };
            }
        }).filter(def => def !== undefined);

        $('#leaderboard-table-ld').DataTable({
            paging: true,
            searching: true,
            info: true,
            responsive: true,
            autoWidth: false,
            pagingType: 'simple',
            columns: config.columns,
            dom: '<"top"lf>rt<"bottom"ip><"clear">',
            columnDefs: columnDefs,
            initComplete: function() {
                moveControls();
                bindSearchInput();
            },
            drawCallback: function() {
                moveControls();
            }
        });
    }

    async function populateTable(data, type) {
        createTable(type);
        const table = $('#leaderboard-table-ld').DataTable();
        table.clear();
        const forgePlayers = await fetchForgeStatusCheck();
        data.forEach(row => {
            let rowData = [];

            if (type === 'players' || type === 'owners') {
                const forgeStatus = forgePlayers.has(row.owner) ? "Active" : "Inactive";
                rowData = [
                    row.owner,
                    `${row.totalCrew} / ${row.totalSlots}`,
                    row.totalDefense,
                    row.totalAttack,
                    row.totalAttackArm,
                    row.totalDefenseArm,
                    row.totalMoveCost,
                    row.totalArm,
                    forgeStatus
                    ];
            } else if (type === 'support') {
                const landCount = row.landCount != null && row.landCount > 0 ? row.landCount : 0;
                const defenseTarget = window.missionData.defense.defenseTarget * row.landCount;
                let defensePercentage = defenseTarget > 0 ? (row.total_defense_score / defenseTarget) * 100 : 0;
                defensePercentage = Math.min(Math.max(defensePercentage, 0), 100);
                const defenseDisplay = defensePercentage.toFixed(2) + '%';
                const tooltipContent = `Defense: ${row.total_defense_score} / Target: ${defenseTarget}`;
                const status = window.landownerStatusCache && window.landownerStatusCache[row.owner_address] ? 'Active' : 'Inactive';
                rowData = [
                    row.owner_address,
                    `<span class="support-count" data-supporters='${JSON.stringify(row.supporters)}' title="Click to view supporters">${row.supporters.length}</span>`,
                    row.total_defense_score,
                    row.total_attack_score,
                    row.totalMoveCost,
                    row.landCount || '0',
                    status,
                    `<span title="${tooltipContent}">${defenseDisplay}</span>`
                ];
            }

            table.row.add(rowData).draw();
        });

        $('[data-toggle="tooltip"]').tooltip();
    }

    function downloadCSV(data, filename) {
        let csv = [];
        if ($('#btn-support-ld').hasClass('activeleaderboard')) {
            csv = data.map(row => 
                `${row.owner_address},${Array.isArray(row.supporters) ? row.supporters.join(', ') : ''},${row.total_defense_score},${row.total_attack_score},${row.totalMoveCost}`
            );
            csv.unshift("Owner Address,Supporters,Total Defense Score,Total Attack Score,Total Move Cost");
        } else {
            csv = data.map(row => 
                `${row.owner},${row.totalCrew} / ${row.totalSlots},${row.totalDefense},${row.totalAttack},${row.totalAttackArm},${row.totalDefenseArm},${row.totalMoveCost},${row.totalArm}`
            );
            csv.unshift("Owner,Total Crew / Total Slots,Total Defense,Total Attack,Total Attack Arm,Total Defense Arm,Total Move Cost,Total Arm");
        }

        const csvString = csv.join("\n");
        const blob = new Blob([csvString], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.setAttribute("hidden", "");
        a.setAttribute("href", url);
        a.setAttribute("download", `${filename}.csv`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    $('#btn-players-ld').on('click', function() {
        $('#btn-players-ld').addClass('activeleaderboard');
        $('#btn-landowners-ld').removeClass('activeleaderboard');
        $('#btn-support-ld').removeClass('activeleaderboard');
        fetchData('/mission/players', data => populateTable(data, 'players'));
    });

    $('#btn-landowners-ld').on('click', function() {
        $('#btn-players-ld').removeClass('activeleaderboard');
        $('#btn-landowners-ld').addClass('activeleaderboard');
        $('#btn-support-ld').removeClass('activeleaderboard');
        fetchData('/mission/data', data => populateTable(data, 'owners'));
    });

    $('#btn-support-ld').on('click', function() {
        $('#btn-players-ld').removeClass('activeleaderboard');
        $('#btn-landowners-ld').removeClass('activeleaderboard');
        $('#btn-support-ld').addClass('activeleaderboard');
        fetchSupportData(supportData => {
            fetchData('/mission/data', missionData => {
                const updatedSupportData = addLandCountToSupport(supportData, missionData);
                populateTable(updatedSupportData, 'support');
            });
        });
    });

    $('#download-csv-ld').on('click', function() {
        const table = $('#leaderboard-table-ld').DataTable();
        const data = table.rows({ search: 'applied' }).data().toArray();
        const endpoint = $('#btn-landowners-ld').hasClass('activeleaderboard') ? '/mission/data' : ($('#btn-support-ld').hasClass('activeleaderboard') ? 'support' : '/mission/players');
        if (endpoint === 'support') {
            fetchSupportData(fullData => downloadCSV(fullData, 'support'));
        } else {
            fetchData(endpoint, fullData => downloadCSV(fullData, endpoint === '/mission/data' ? 'landowners' : 'players'));
        }
    });

    function moveControls() {
        const lengthControl = $('#leaderboard-table-ld_length');
        const paginationControl = $('#leaderboard-table-ld_paginate');
        const infoControl = $('#leaderboard-table-ld_info');
        const filterControl = $('#leaderboard-table-ld_filter');

        if (filterControl.length && !$('#table-filter').children().length) {
            $('#table-filter').empty().append(filterControl);
        }
        if (lengthControl.length && !$('#table-length').children().length) {
            $('#table-length').empty().append(lengthControl);
        }
        if (infoControl.length && !$('#table-info-text').children().length) {
            $('#table-info-text').empty().append(infoControl);
        }
        if (paginationControl.length && !$('#table-pagination').children().length) {
            $('#table-pagination').empty().append(paginationControl);
        }

        filterControl.css('float', 'left');
        infoControl.css('float', 'left');
        paginationControl.css('text-align', 'center');
        lengthControl.css('float', 'right');
        paginationControl.css('margin-top', '10px');
        infoControl.css('margin-top', '16px');
    }

    function bindSearchInput() {
        const filterInput = $('#table-filter input');
        filterInput.off('keyup').on('input', function() {
            const value = $(this).val();
            const table = $('#leaderboard-table-ld').DataTable();
            table.search(value).draw();
        });
    }

    $('#leaderboard-table-ld').on('click', '.support-count', async function () {
        const supportersString = $(this).data('supporters');
        let supportersArray = [];
        try {
            if (supportersString && typeof supportersString === 'string') {
                supportersArray = JSON.parse(supportersString);
            } else if (Array.isArray(supportersString)) {
                supportersArray = supportersString;
            }
        } catch (e) {
            console.error("Error parsing supporters:", e);
        }
    
        // Récupération du statut Forge
        const forgePlayers = await fetchForgeStatusCheck();
    
        // Récupérer les données des joueurs via l'API multipleplayers
        let playersData = {};
        try {
            const response = await fetch(`/mission/multipleplayers?owners=${supportersArray.join(',')}`);
            const data = await response.json();
            // Convertir les données pour les rendre accessibles par `owner`
            playersData = data.reduce((acc, player) => {
                acc[player.owner] = player;
                return acc;
            }, {});
        } catch (error) {
            console.error("Error fetching player data:", error);
        }
    
        // Construction du tableau HTML
        let tableContent = `
            <table class="text-white table table-bordered">
                <thead>
                    <tr>
                        <th>Supporter</th>
                        <th>Defense</th>
                        <th>Forge Status</th>
                    </tr>
                </thead>
                <tbody>
        `;
    
        supportersArray.forEach(supporter => {
            const forgeStatus = forgePlayers.has(supporter) ? "Active" : "Inactive";
            const playerData = playersData[supporter] || {};
            const defenseValue = forgeStatus === "Active" 
                ? playerData.totalDefenseArm || "0" 
                : playerData.totalDefense || "0";
    
            tableContent += `
                <tr>
                    <td>${supporter}</td>
                    <td>${defenseValue}</td>
                    <td>${forgeStatus}</td>
                </tr>
            `;
        });
    
        tableContent += `
                </tbody>
            </table>
        `;
    
        // Ajout du tableau dans la modale
        $('#landIdsContent').html(tableContent);
        $('#landIdsModalLabel').text('Supporters Details');
        $('#landIdsModal').modal('show');
    });

    if (userType === "player") {
        $('#btn-players-ld').addClass('activeleaderboard');
        fetchData('/mission/players', data => populateTable(data, 'players'));
    } else {
        $('#btn-landowners-ld').addClass('activeleaderboard');
        fetchData('/mission/data', data => populateTable(data, 'owners'));
    }
};

window.cleanupLeaderboardPage = function() {
    if (typeof clearOldControls === 'function') {
        clearOldControls();
    } else {
        console.warn('clearOldControls is not defined');
    }
};
