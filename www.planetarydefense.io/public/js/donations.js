// donations.js
(async function() {
    const userPlanet = localStorage.getItem("userPlanet");
	await getPlanetData(userPlanet);
    if (!userPlanet) {
        console.error('No userPlanet found in localStorage');
        return;
    }

    // Vérifier si les données de la planète ont été chargées dans la variable globale
    if (!window.planetData) {
        console.error('Planet data is not available. Make sure it is loaded correctly.');
        return;
    }

    const walletPlanet = window.planetData.WalletPlanet || 'narondefense';
    const MAX_PROGRESS = 250000;
  	const leaderboardDiv = document.getElementById("donationstop");
    if (planetData.Open === 0) {
      console.warn(`Planet ${planetData.Name} is not open. Using default WalletMission for Magor.`);
      window.planetData.WalletMission = 'magordefense';
    }
  
    let progressBarInterval;

    async function getCurrencyBalance({ code, account, symbol }, retries = 3) {
        if (!code || !account || !symbol) {
            throw new Error("Missing required parameters: code, account, and symbol are required.");
        }

        const fetchCurrencyBalance = async () => {
            const response = await fetch('https://api.waxsweden.org/v1/chain/get_currency_balance', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ code, account, symbol }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        };

        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                const data = await fetchCurrencyBalance();
                return data;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} - Could not fetch the currency balance:`, error);
                if (attempt < retries - 1) {
                    await new Promise(res => setTimeout(res, 1000));
                } else {
                    throw new Error("Exceeded maximum retries. Could not fetch the currency balance.");
                }
            }
        }
    }

    $(document).ready(function() {
        getCurrencyBalance({ code: 'alien.worlds', account: walletPlanet, symbol: 'TLM' })
            .then(balance => {
                $('#balance-info').text(`Balance: ${balance}`);
                updateProgressBar(balance);
            })
            .catch(error => console.error("Final error:", error));
    });

    function updateProgressBar(balance) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        if (!progressBar || !progressText) {
            console.error("Progress bar elements not found");
            return;
        }

        const currentBalance = parseFloat(balance[0]) || 0;
        const progress = Math.min((currentBalance / MAX_PROGRESS) * 100, 100);
        progressBar.style.width = progress + '%';
        progressBar.setAttribute('aria-valuenow', progress);
        progressText.textContent = formatPercentage(progress) + '%';
    }

    function formatPercentage(value) {
        const valueStr = value.toString();
        const decimalIndex = valueStr.indexOf('.');
        if (decimalIndex === -1) {
            return valueStr;
        }
        let significantDigits = 1;
        for (let i = decimalIndex + 1; i < valueStr.length; i++) {
            if (valueStr[i] !== '0') {
                significantDigits = i - decimalIndex;
                break;
            }
        }
        return value.toFixed(significantDigits);
    }
    if (!leaderboardDiv) {
        console.error("Leaderboard container not found.");
        return;
    }

    async function fetchDonations(wallet, before = null) {
        const url = new URL("https://history.waxsweden.org/v2/history/get_actions");
        url.searchParams.set("limit", "1000");
        url.searchParams.set("skip", "0");
        url.searchParams.set("account", wallet);
        url.searchParams.set("filter", "alien.worlds:transfer");
        url.searchParams.set("sort", "desc");
        url.searchParams.set("simple", "true");
        if (before) url.searchParams.set("before", before);

        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error("Error fetching donations:", error);
            return null;
        }
    }

    async function getLeaderboard(wallet) {
        let donations = [];
        let before = null;

        while (true) {
            const data = await fetchDonations(wallet, before);
            if (!data || !data.simple_actions || data.simple_actions.length === 0) {
                break;
            }

            donations = donations.concat(data.simple_actions);

            const oldestTimestamp = data.simple_actions[data.simple_actions.length - 1].timestamp;
            before = new Date(new Date(oldestTimestamp).getTime() - 1000).toISOString();
        }

        const donationMap = {};

        donations.forEach(action => {
            const from = action.data.from;
            const quantity = parseFloat(action.data.quantity.split(" ")[0]);

            if (!donationMap[from]) {
                donationMap[from] = 0;
            }

            donationMap[from] += quantity;
        });

        const leaderboard = Object.entries(donationMap)
            .map(([from, total]) => ({ from, total }))
            .sort((a, b) => b.total - a.total);

        return leaderboard;
    }

    function displayLeaderboard(leaderboard) {
        leaderboardDiv.innerHTML = "";

        const table = document.createElement("table");
        table.classList.add("table", "table-striped", "table-responsive", "text-white", "border-0", "lato", "w-50", "m-auto");

        const thead = document.createElement("thead");
        thead.innerHTML = `
            <tr>
                <th>Rank</th>
                <th>Donor</th>
                <th>Total (TLM)</th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement("tbody");

        leaderboard.forEach((entry, index) => {
            const row = document.createElement("tr");
            row.classList.add(index % 2 === 0 ? "text-white" : "text-white");
          	row.classList.add(index % 2 === 0 ? "border-0" : "border-0");
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.from}</td>
                <td>${entry.total.toFixed(0)}</td>
            `;
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        leaderboardDiv.appendChild(table);
    }

    try {
        const leaderboard = await getLeaderboard(walletPlanet);
        displayLeaderboard(leaderboard);
    } catch (error) {
        console.error("Error generating leaderboard:", error);
        leaderboardDiv.innerHTML = "<p>Error generating leaderboard. Please try again later.</p>";
    }
  
    document.getElementById('donation').addEventListener('click', function (event) {
        const donationInput = document.getElementById('filter-input');
        if (donationInput.checkValidity()) {
            event.preventDefault();
            getCurrencyBalance({ code: 'alien.worlds', account: walletPlanet, symbol: 'TLM' })
                .then(balance => {
                    updateProgressBar(balance);
                })
                .catch(error => console.error('Error fetching progress:', error));
        }
    });

    progressBarInterval = setInterval(function() {
        getCurrencyBalance({ code: 'alien.worlds', account: walletPlanet, symbol: 'TLM' })
            .then(balance => {
                updateProgressBar(balance);
            })
            .catch(error => console.error('Error fetching progress:', error));
    }, 60000);

    window.cleanupDonations = () => {
        if (progressBarInterval) clearInterval(progressBarInterval);
    };
})();
