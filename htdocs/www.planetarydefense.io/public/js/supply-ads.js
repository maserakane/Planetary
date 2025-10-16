// Variables globales pour la pagination
if (typeof currentPage === 'undefined') {
    console.log('Initialisation de currentPage');
    var currentPage = {
        'merch-today': 1,
        'conneries': 1,
        'dev-logs': 1
    };
}

if (typeof itemsPerPage === 'undefined') {
    console.log('Initialisation de itemsPerPage');
    var itemsPerPage = 6;
}

// Fonction pour formater la date
function formatDate(timestamp) {
    console.log('Formatage de la date:', timestamp);
    const date = new Date(timestamp * 1000);
    const formattedDate = date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    console.log('Date formatée:', formattedDate);
    return formattedDate;
}

// Fonction pour créer une carte de produit
function createProductCard(product) {
    console.log('Création d\'une carte produit:', product);
    const card = `
        <div class="col-md-6 col-lg-4">
            <div class="product-card">
                <div class="product-date">${formatDate(product.date)}</div>
                <h3 class="product-title">${product.title}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">${product.price} WAX</div>
                ${product.image ? `<img src="${product.image}" alt="${product.title}" class="product-image">` : ''}
            </div>
        </div>
    `;
    console.log('Carte produit créée:', card);
    return card;
}

// Fonction pour créer une carte de dev log
function createDevLogCard(log) {
    console.log('Création d\'une carte dev log:', log);
    const tags = JSON.parse(log.tags);
    console.log('Tags parsés:', tags);
    
    const tagsHtml = tags.map(tag => {
        let className = 'tag-update';
        if (tag.toLowerCase().includes('bug')) className = 'tag-bug';
        if (tag.toLowerCase().includes('feature')) className = 'tag-feature';
        return `<span class="dev-log-tag ${className}">${tag}</span>`;
    }).join('');
    console.log('HTML des tags généré:', tagsHtml);

    const card = `
        <div class="col-md-6">
            <div class="dev-log">
                <div class="dev-log-date">${formatDate(log.date)}</div>
                <h3 class="product-title">${log.title}</h3>
                <div class="dev-log-content">
                    ${log.content}
                    ${tagsHtml}
                </div>
            </div>
        </div>
    `;
    console.log('Carte dev log créée:', card);
    return card;
}

// Fonction pour charger les produits
async function loadProducts(section) {
    console.log(`[loadProducts] Début du chargement des produits pour la section: ${section}`);
    const spinner = document.querySelector(`#${section} .loading-spinner`);
    const container = document.querySelector(`#${section} .row`);
    
    if (!spinner || !container) {
        console.error(`[loadProducts] Éléments non trouvés pour la section ${section}:`, { spinner, container });
        return;
    }
    
    try {
        console.log(`[loadProducts] Activation du spinner pour ${section}`);
        spinner.classList.add('active');
        
        const url = `/api/products?section=${section}&page=${currentPage[section]}&limit=${itemsPerPage}`;
        console.log(`[loadProducts] Requête API: ${url}`);
        
        const response = await fetch(url);
        console.log(`[loadProducts] Réponse reçue:`, response);
        
        // Vérifier le type de contenu de la réponse
        const contentType = response.headers.get('content-type');
        console.log(`[loadProducts] Type de contenu de la réponse:`, contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`[loadProducts] Réponse non-JSON reçue:`, contentType);
            const text = await response.text();
            console.error(`[loadProducts] Contenu de la réponse:`, text);
            throw new Error('La réponse du serveur n\'est pas au format JSON');
        }
        
        const data = await response.json();
        console.log(`[loadProducts] Données reçues:`, data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Erreur lors du chargement des produits');
        }

        if (!data.products || !Array.isArray(data.products)) {
            console.error(`[loadProducts] Format de données invalide:`, data);
            throw new Error('Format de données invalide reçu du serveur');
        }

        console.log(`[loadProducts] Mise à jour du conteneur avec ${data.products.length} produits`);
        container.innerHTML = data.products.map(createProductCard).join('');
        
        console.log(`[loadProducts] Ajout de la pagination pour ${data.totalPages} pages`);
        addPagination(section, data.totalPages);
    } catch (error) {
        console.error('[loadProducts] Erreur:', error);
        showError(error.message);
        // Afficher un message d'erreur dans le conteneur
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erreur lors du chargement des produits: ${error.message}
                </div>
            </div>
        `;
    } finally {
        console.log(`[loadProducts] Désactivation du spinner pour ${section}`);
        spinner.classList.remove('active');
    }
}

// Fonction pour charger les dev logs
async function loadDevLogs() {
    console.log('[loadDevLogs] Début du chargement des dev logs');
    const spinner = document.querySelector('#dev-logs .loading-spinner');
    const container = document.querySelector('#dev-logs .row');
    
    if (!spinner || !container) {
        console.error('[loadDevLogs] Éléments non trouvés:', { spinner, container });
        return;
    }
    
    try {
        console.log('[loadDevLogs] Activation du spinner');
        spinner.classList.add('active');
        
        const url = `/api/dev-logs?page=${currentPage['dev-logs']}&limit=${itemsPerPage}`;
        console.log(`[loadDevLogs] Requête API: ${url}`);
        
        const response = await fetch(url);
        console.log('[loadDevLogs] Réponse reçue:', response);
        
        // Vérifier le type de contenu de la réponse
        const contentType = response.headers.get('content-type');
        console.log(`[loadDevLogs] Type de contenu de la réponse:`, contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
            console.error(`[loadDevLogs] Réponse non-JSON reçue:`, contentType);
            const text = await response.text();
            console.error(`[loadDevLogs] Contenu de la réponse:`, text);
            throw new Error('La réponse du serveur n\'est pas au format JSON');
        }
        
        const data = await response.json();
        console.log('[loadDevLogs] Données reçues:', data);
        
        if (!response.ok) {
            throw new Error(data.error || 'Erreur lors du chargement des dev logs');
        }

        if (!data.logs || !Array.isArray(data.logs)) {
            console.error(`[loadDevLogs] Format de données invalide:`, data);
            throw new Error('Format de données invalide reçu du serveur');
        }

        console.log(`[loadDevLogs] Mise à jour du conteneur avec ${data.logs.length} dev logs`);
        container.innerHTML = data.logs.map(createDevLogCard).join('');
        
        console.log(`[loadDevLogs] Ajout de la pagination pour ${data.totalPages} pages`);
        addPagination('dev-logs', data.totalPages);
    } catch (error) {
        console.error('[loadDevLogs] Erreur:', error);
        showError(error.message);
        // Afficher un message d'erreur dans le conteneur
        container.innerHTML = `
            <div class="col-12 text-center">
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    Erreur lors du chargement des dev logs: ${error.message}
                </div>
            </div>
        `;
    } finally {
        console.log('[loadDevLogs] Désactivation du spinner');
        spinner.classList.remove('active');
    }
}

// Fonction pour ajouter la pagination
function addPagination(section, totalPages) {
    console.log(`[addPagination] Ajout de la pagination pour ${section} avec ${totalPages} pages`);
    const container = document.querySelector(`#${section}`);
    let paginationContainer = container.querySelector('.pagination-container');
    
    if (!paginationContainer) {
        console.log(`[addPagination] Création du conteneur de pagination pour ${section}`);
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        container.appendChild(paginationContainer);
    }

    let paginationHtml = '<nav><ul class="pagination justify-content-center">';
    
    // Bouton précédent
    paginationHtml += `
        <li class="page-item ${currentPage[section] === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage('${section}', ${currentPage[section] - 1})">Précédent</a>
        </li>
    `;

    // Pages
    for (let i = 1; i <= totalPages; i++) {
        paginationHtml += `
            <li class="page-item ${currentPage[section] === i ? 'active' : ''}">
                <a class="page-link" href="#" onclick="changePage('${section}', ${i})">${i}</a>
            </li>
        `;
    }

    // Bouton suivant
    paginationHtml += `
        <li class="page-item ${currentPage[section] === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" onclick="changePage('${section}', ${currentPage[section] + 1})">Suivant</a>
        </li>
    `;

    paginationHtml += '</ul></nav>';
    console.log(`[addPagination] HTML de pagination généré pour ${section}:`, paginationHtml);
    paginationContainer.innerHTML = paginationHtml;
}

// Fonction pour changer de page
function changePage(section, page) {
    console.log(`[changePage] Changement de page pour ${section}: ${currentPage[section]} -> ${page}`);
    currentPage[section] = page;
    if (section === 'dev-logs') {
        console.log('[changePage] Chargement des dev logs');
        loadDevLogs();
    } else {
        console.log(`[changePage] Chargement des produits pour ${section}`);
        loadProducts(section);
    }
}

// Fonction pour afficher les erreurs
function showError(message) {
    console.error('[showError] Affichage d\'une erreur:', message);
    Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: message,
        confirmButtonColor: '#ff9c00'
    });
}

// Initialisation au chargement de la page
$(document).ready(function() {
    console.log('[DOMContentLoaded] Initialisation de la page');
    
    // Charger les produits pour chaque section
    console.log('[DOMContentLoaded] Chargement des produits pour merch-today');
    loadProducts('merch-today');
    
    console.log('[DOMContentLoaded] Chargement des produits pour conneries');
    loadProducts('conneries');
    
    console.log('[DOMContentLoaded] Chargement des dev logs');
    loadDevLogs();

    // Ajouter les animations au survol des cartes
    console.log('[DOMContentLoaded] Configuration des animations de survol');
    $(document).on('mouseover', '.product-card, .dev-log', function() {
        console.log('[mouseover] Animation sur la carte:', this);
        $(this).css({
            'transform': 'translateY(-5px)',
            'box-shadow': '0 5px 15px rgba(255, 156, 0, 0.3)'
        });
    });

    $(document).on('mouseout', '.product-card, .dev-log', function() {
        console.log('[mouseout] Fin de l\'animation sur la carte:', this);
        $(this).css({
            'transform': 'translateY(0)',
            'box-shadow': 'none'
        });
    });
});

// Fonction pour ajouter un nouveau produit
function addNewProduct(product, section) {
    console.log('[addNewProduct] Ajout d\'un nouveau produit:', { product, section });
    const productContainer = document.querySelector(`#${section} .row`);
    if (!productContainer) {
        console.error(`[addNewProduct] Conteneur non trouvé pour la section ${section}`);
        return;
    }
    
    const newProduct = document.createElement('div');
    newProduct.className = 'col-md-6 col-lg-4';
    newProduct.innerHTML = `
        <div class="product-card">
            <div class="product-date">${new Date().toLocaleDateString()}</div>
            <h3 class="product-title">${product.title}</h3>
            <p class="product-description">${product.description}</p>
            <div class="product-price">${product.price} WAX</div>
        </div>
    `;
    console.log('[addNewProduct] Nouvelle carte produit créée:', newProduct.innerHTML);
    productContainer.insertBefore(newProduct, productContainer.firstChild);
}

// Fonction pour ajouter un nouveau dev log
function addNewDevLog(log) {
    console.log('[addNewDevLog] Ajout d\'un nouveau dev log:', log);
    const devLogContainer = document.querySelector('#dev-logs .row');
    if (!devLogContainer) {
        console.error('[addNewDevLog] Conteneur des dev logs non trouvé');
        return;
    }
    
    const newLog = document.createElement('div');
    newLog.className = 'col-md-6';
    newLog.innerHTML = `
        <div class="dev-log">
            <div class="dev-log-date">${new Date().toLocaleDateString()}</div>
            <h3 class="product-title">${log.title}</h3>
            <div class="dev-log-content">
                <p>${log.content}</p>
                ${log.tags.map(tag => `<span class="dev-log-tag tag-${tag.toLowerCase()}">${tag}</span>`).join('')}
            </div>
        </div>
    `;
    console.log('[addNewDevLog] Nouvelle carte dev log créée:', newLog.innerHTML);
    devLogContainer.insertBefore(newLog, devLogContainer.firstChild);
}

// Fonction pour mettre à jour les prix
function updatePrices() {
    console.log('[updatePrices] Mise à jour des prix');
    const prices = document.querySelectorAll('.product-price');
    console.log(`[updatePrices] ${prices.length} prix trouvés`);
    
    prices.forEach(price => {
        const currentPrice = parseFloat(price.textContent);
        const newPrice = (currentPrice * 1.1).toFixed(2); // Augmentation de 10%
        console.log(`[updatePrices] Mise à jour du prix: ${currentPrice} -> ${newPrice}`);
        price.textContent = `${newPrice} WAX`;
    });
} 