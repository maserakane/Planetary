// common.js

// Liste des endpoints accessibles à l'ensemble du site
const apiEndpoints = [
    'https://wax.eosdac.io/v1/chain/get_table_rows',
    'https://api.waxsweden.org/v1/chain/get_table_rows',
  	'https://wax.greymass.com/v1/chain/get_table_rows',
    'https://wax.api.eosnation.io/v1/chain/get_table_rows'
];

const apiEndpointsLive = [
    'https://api.wax.bountyblok.io/v1/chain/get_table_rows',
    'https://wax.cryptolions.io/v1/chain/get_table_rows',
    'https://wax.eosdac.io/v1/chain/get_table_rows',
    'https://wax.api.eosnation.io/v1/chain/get_table_rows',
    'https://api.waxsweden.org/v1/chain/get_table_rows',
  	'https://wax.cryptolions.io/v1/chain/get_table_rows'
];

// Fonction pour afficher les messages d'erreur via Toasts
function showToast(message, type = 'info') {
    const toastContainer = $('#toast-container');
    const toastElement = $(`
        <div class="toast show toast-${type}">
            <div class="toast-body">
                <span class="toast-icon">${type === 'error' ? '❌' : '✔️'}</span>
                <span class="toast-message">${message}</span>
                <div class="toast-progress"></div>
            </div>
        </div>
    `);
    
    toastContainer.append(toastElement);

    // Barre de progression
    const progressBar = toastElement.find('.toast-progress');
    let duration = 5000; // durée en millisecondes (5 secondes)
    
    progressBar.animate({ width: "100%" }, duration, "linear", function() {
        toastElement.remove();
    });

    setTimeout(() => toastElement.remove(), duration);
}


// Fonction pour gérer les requêtes avec retry, backoff et fallback
const apiRequestWithRetry = async (url, table, walletMission, nextKey = '', userAccount = null, retries = 1, backoff = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: createRequestBody(table, walletMission, nextKey, 1000, userAccount)
      }, 5000); // Timeout de 5 secondes

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Erreur lors de la tentative ${i + 1} pour ${url}:`, error.message);
      if (i === retries - 1) {
        console.error(`Échec après ${retries} tentatives`);
        return false;
      }
      await new Promise(resolve => setTimeout(resolve, backoff));
      backoff *= 2;
    }
  }
};


async function apiRequestWithRetryh(url, requestData, retries = 1, backoff = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            // Effectuer la requête avec jQuery AJAX
            const response = await $.ajax({
                url,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                timeout: 5000 // Timeout explicite de 5 secondes
            });
            // Si la requête réussit, retourne la réponse
            return response;

        } catch (error) {
            console.error(`Error during request attempt ${i + 1} to ${url}:`, error);

            // Si c'est la dernière tentative, relancer l'erreur
            if (i === retries - 1) {
                console.error(`Exhausted all retries for ${url}`);
                throw error;
            }

            // Attendre avant de réessayer (backoff exponentiel)
            await new Promise(resolve => setTimeout(resolve, backoff));
            backoff *= 2; // Augmenter le délai de backoff
        }
    }

    // Retourner null explicitement si tout échoue
    console.error(`All retries failed for ${url}`);
    return null;
}