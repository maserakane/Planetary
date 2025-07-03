if (typeof dataCache === 'undefined') {
    var dataCache = {
        'crew.worlds': [],
        'faces.worlds': [],
        'arms.worlds': [],
        'land.worlds': []
    };
}

if (typeof ITEMS_PER_PAGE === 'undefined') {
    var ITEMS_PER_PAGE = 9; // Nombre maximum de cartes par page
}

// Assurez-vous que le script s'exécute après que le DOM soit complètement chargé
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCsearch);
} else {
    initCsearch();
}

async function initCsearch() {
    const csearchDiv = document.getElementById('csearch');

    if (!csearchDiv) {
        console.error("L'élément avec l'ID 'csearch' n'a pas été trouvé.");
        return;
    }

    // Créer les éléments HTML pour les boutons et les sections
    csearchCreateSectionButtons(csearchDiv);
    csearchCreateSections(csearchDiv);

    // Précharger les données pour chaque schéma
    try {
        await Promise.all([
            csearchFetchData('crew.worlds'),
            csearchFetchData('faces.worlds'),
            csearchFetchData('arms.worlds'),
            csearchFetchData('land.worlds')
        ]);
    } catch (error) {
        console.error('Erreur lors du préchargement des données:', error);
    }

    // Afficher la section Crews par défaut
    csearchShowSection('crew.worlds', true);  // True pour indiquer que c'est le chargement initial
}

async function csearchFetchData(schema) {
    try {
        const response = await fetch(`/mission/get-schema?schema=${encodeURIComponent(schema)}`);
        if (!response.ok) throw new Error(`Erreur lors de la récupération des données pour ${schema}.`);
        const data = await response.json();

        // Trier par rareté et par shine
        data.sort((a, b) => {
            const rarityComparison = rarityOrder(a.rarity) - rarityOrder(b.rarity);
            if (rarityComparison !== 0) return rarityComparison;
            return shineOrder(a.shine) - shineOrder(b.shine);
        });

        dataCache[schema] = data;
    } catch (error) {
        console.error(`Erreur lors du chargement des données pour ${schema}:`, error);
    }
}

// Fonction pour créer les boutons de section
function csearchCreateSectionButtons(container) {
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'd-flex justify-content-center flex-wrap my-3';
    buttonGroup.setAttribute('role', 'group');

    const buttonsInfo = [
        { id: 'btn-crews', text: 'Crews', schema: 'crew.worlds' },
        { id: 'btn-faces', text: 'Faces', schema: 'faces.worlds' },
        { id: 'btn-arms', text: 'Arms', schema: 'arms.worlds' },
        { id: 'btn-lands', text: 'Lands', schema: 'land.worlds' }
    ];

    buttonsInfo.forEach(buttonInfo => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'details-button m-2 btn-group-sm';
        button.id = buttonInfo.id;
        button.textContent = buttonInfo.text;
        button.addEventListener('click', () => csearchShowSection(buttonInfo.schema));
        buttonGroup.appendChild(button);
    });

    container.appendChild(buttonGroup);
}

// Fonction pour créer les conteneurs des sections
function csearchCreateSections(container) {
    const sectionsInfo = [
        { id: 'section-crews', schema: 'crew.worlds' },
        { id: 'section-faces', schema: 'faces.worlds' },
        { id: 'section-arms', schema: 'arms.worlds' },
        { id: 'section-lands', schema: 'land.worlds' }
    ];

    sectionsInfo.forEach(sectionInfo => {
        const sectionDiv = document.createElement('div');
        sectionDiv.id = sectionInfo.id;
        sectionDiv.className = 'section d-none text-center'; // Centré le contenu

        // Ajouter les filtres et le conteneur de cartes
        sectionDiv.innerHTML = `
            <button class="btn mb-3 csearch-filter-button" onclick="toggleFilters('${sectionInfo.id}-filters')">Show/Hide filters</button>
            <div id="${sectionInfo.id}-filters" class="filters-container mb-3 d-none">
                ${csearchCreateFilters(sectionInfo.id)}
            </div>
            <div id="${sectionInfo.id}-cards" class="cards-container row justify-content-center"></div>
            <div id="${sectionInfo.id}-pagination" class="pagination-container mt-3"></div>
        `;

        container.appendChild(sectionDiv);
    });
}

function csearchShowSection(schema, isInitialLoad = false) {
    
    // Cacher toutes les sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.add('d-none');
    });

    // Afficher la section sélectionnée
    const sectionIdMap = {
        'crew.worlds': 'section-crews',
        'faces.worlds': 'section-faces',
        'arms.worlds': 'section-arms',
        'land.worlds': 'section-lands'
    };

    const selectedSectionId = sectionIdMap[schema];
    const selectedSection = document.getElementById(selectedSectionId);
    
    if (selectedSection) {
        selectedSection.classList.remove('d-none');
        csearchDisplayData(schema, selectedSection, 1, isInitialLoad); // Afficher la première page par défaut
    } else {
        console.error(`Erreur : La section avec l'ID ${selectedSectionId} n'a pas été trouvée.`);
    }
}

function csearchCreateFilters(sectionId) {
    if (sectionId === 'section-crews') {
        // Section "crews" avec 8 filtres répartis sur deux lignes de quatre, plus le tri par Ranking et la rentabilité
        return `
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createInputFilterName(`${sectionId}-filter-name`, 'text', 'Name')}
            </div>
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createSelectFilter(`${sectionId}-filter-rarity`, 'Rarity', ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical'])}
                ${createSelectFilter(`${sectionId}-filter-shine`, 'Shine', ['Stone', 'Gold', 'Stardust', 'Antimatter', 'XDimension'])}
                ${createSelectFilter(`${sectionId}-filter-race`, 'Race', ['Grey', 'Human', 'Human Augmented', 'LGP', 'Nordic', 'Reptiloid', 'Robotron', 'Unknown'])}
                ${createSelectFilter(`${sectionId}-filter-element`, 'Element', ['Neutral', 'Air', 'Fire', 'Gem', 'Metal', 'Nature'])}
            </div>
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createRangeFilter(sectionId, 'Attack')}
                ${createRangeFilter(sectionId, 'Defense')}
            </div>
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createRangeFilter(sectionId, 'Price')}
                ${createSelectFilter(`${sectionId}-filter-ranking`, 'Sort By', ['Best Ranking', 'Best Attack', 'Best Defense', 'MoveCost (Low to High)'], true)}
                ${createSelectFilter(`${sectionId}-filter-rentability`, 'Best Value By', ['Attack / MoveCost', 'Defense', 'All Stats'], true)}
            </div>
            ${createApplyButton(sectionId)}
        `;
    } else if (sectionId === 'section-arms') {
        // Mise à jour des filtres pour la section "arms"
        return `
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createInputFilter(`${sectionId}-filter-name`, 'text', 'Name')}
                ${createSelectFilter(`${sectionId}-filter-rarity`, 'Rarity', ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical'])}
                ${createSelectFilter(`${sectionId}-filter-shine`, 'Shine', ['Stone', 'Gold', 'Stardust', 'Antimatter', 'XDimension'])}
            </div>
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createRangeFilter(sectionId, 'Attack')}
                ${createRangeFilter(sectionId, 'Defense')}
            </div>
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createRangeFilter(sectionId, 'Price')}
                ${createSelectFilter(`${sectionId}-filter-ranking`, 'Sort By', ['Best Ranking', 'Best Attack', 'Best Defense'], true)}
                ${createSelectFilter(`${sectionId}-filter-rentability`, 'Best Value By', ['Attack', 'Defense', 'All Stats'], true)}
            </div>
            ${createApplyButton(sectionId)}
        `;
    } else if (sectionId === 'section-faces') {
        // Filtrage spécifique pour la section "faces"
        return `
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createInputFilter(`${sectionId}-filter-name`, 'text', 'Name')}
                ${createSelectFilter(`${sectionId}-filter-rarity`, 'Rarity', ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical'])}
                ${createSelectFilter(`${sectionId}-filter-shine`, 'Shine', ['Stone', 'Gold', 'Stardust', 'Antimatter', 'XDimension'])}
                ${createSelectFilter(`${sectionId}-filter-type`, 'Type', ['Aioshi', 'Celestial Terror', 'Female Cyborg T8', 'Female Grey', 'Female Little Green Person', 'Female Nordic', 'Female Reptiloid', 'Human Augmented', 'Human Female', 'Human Male', 'Leader', 'Male Cyborg T15', 'Male Grey', 'Male Little Green Person', 'Male Nordic', 'Male Reptiloid', 'Robotron Soldier', 'Starship Officer'])}
                ${createRangeFilter(sectionId, 'Price')}
            </div>
            ${createApplyButton(sectionId)}
        `;
    } else if (sectionId === 'section-lands') {
        // Filtrage spécifique pour la section "lands"
        return `
            <div class="filter-container row g-1 mb-2 justify-content-center align-items-center">
                ${createInputFilter(`${sectionId}-filter-name`, 'text', 'Name')}
                ${createSelectFilter(`${sectionId}-filter-rarity`, 'Rarity', ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical'])}
                ${createRangeFilter(sectionId, 'Ease')}
                ${createRangeFilter(sectionId, 'Luck')}
                ${createRangeFilter(sectionId, 'Delay')}
                ${createRangeFilter(sectionId, 'Price')}
            </div>
            ${createApplyButton(sectionId)}
        `;
    } else {
        return ''; // Retourne une chaîne vide si la section n'est pas reconnue
    }
}

// Fonctions utilitaires pour créer des champs de filtre
function createInputFilter(id, type, placeholder) {
    return `
        <div class="col-3 col-md-2 mb-1">
            <input type="${type}" id="${id}" class="form-control form-control-sm" placeholder="${placeholder}" aria-label="${placeholder}">
        </div>
    `;
}
function createInputFilterName(id, type, placeholder) {
    return `
        <div class="col-5 col-md-2 mb-1">
            <input type="${type}" id="${id}" class="form-control form-control-sm" placeholder="${placeholder}" aria-label="${placeholder}">
        </div>
    `;
}
function createSelectFilter(id, label, options, includeEmpty = false) {
    return `
        <div class="col-3 col-md-2 mb-1">
            <select id="${id}" class="form-select form-select-sm" aria-label="${label}">
                ${includeEmpty ? `<option value="">${label}</option>` : `<option value="">${label}</option>`}
                ${options.map(option => `<option value="${option}">${option}</option>`).join('')}
            </select>
        </div>
    `;
}

function createRangeFilter(sectionId, label) {
    return `
        <div class="col-3 col-md-2 mb-1">
            <input type="number" id="${sectionId}-filter-${label.toLowerCase()}-min" class="form-control form-control-sm" placeholder="${label} Min" min="0" aria-label="Minimum ${label}">
        </div>
        <div class="col-3 col-md-2 mb-1">
            <input type="number" id="${sectionId}-filter-${label.toLowerCase()}-max" class="form-control form-control-sm" placeholder="${label} Max" min="0" aria-label="Maximum ${label}">
        </div>
    `;
}

function createCheckboxFilter(id, label) {
    return `
        <div class="col-4 col-md-2 mb-1">
            <div class="">
                <input type="checkbox" id="${id}" class="" aria-label="${label}">
                <label for="${id}" class="form-check-label">${label}</label>
            </div>
        </div>
    `;
}

function createApplyButton(sectionId) {
    return `
        <div class="row justify-content-center mt-2">
            <div class="mt-1">
                <ul class="text-sm-start fs-6 d-inline-block">
                    <li>Sort by Attack / Defense uses the original statistics of the Cards.</li>
                    <li>Best Value Attack / Defense do not take shine rarity into account.</li>
                    <li>Best Value stats are based on all stats, including shine and rarity.</li>
                    <li>Abundant (1 attack / 1 defense): Entry-level units that provide 1 attack and 1 defense,<br> regardless of the NFT card. Ideal for starting out.</li>
                    <li>Here is the Medium link for <a href="https://medium.com/@planetarydefense.io/planetary-defense-263bcac13b97" target="_blank">Planetary Defense</a> to learn about card bonuses.</li>
                </ul>
            </div>
            <div class="col-6 col-md-2 text-center mt-0">
                <button class="btn btn-sm btn-primary w-100" onclick="applyFilters('${sectionId}')">Apply filters</button>
            </div>
        </div>
    `;
}

function csearchDisplayData(schema, container, page, isInitialLoad = false) {
    if (!schema) {
        console.error("Erreur : Le schéma est indéfini.");
        return;
    }
    
    const data = dataCache[schema];
    if (!data) {
        console.error(`Erreur : Données non trouvées pour le schéma ${schema}.`);
        return;
    }

    const filteredData = csearchApplyFilters(data, container.id); // Appliquer les filtres basés sur la section
    const paginatedData = filteredData.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const cardsContainer = container.querySelector('.cards-container');
    const paginationContainer = container.querySelector('.pagination-container');

    cardsContainer.innerHTML = ''; // Effacer le contenu précédent
    paginationContainer.innerHTML = ''; // Effacer la pagination précédente

    if (paginatedData.length === 0) {
        cardsContainer.innerHTML = '<p>Aucun résultat trouvé pour ce schéma.</p>';
        return;
    }

    paginatedData.forEach(item => {
        const cardWrapper = document.createElement('div');
        cardWrapper.className = 'col-md-4 mb-3 d-flex flex-column align-items-center';  // Ajout de flex-column pour aligner les éléments verticalement
        
        // Générer les informations au-dessus de la carte
        let infoContent = `
            <div class="card-info mb-2 text-center">
        `;
        
       // Afficher le Ranking uniquement pour "crew.worlds" et "arms.worlds"
        if (schema === 'crew.worlds' || schema === 'arms.worlds') {
            infoContent += `
                <p class="csearch-card-info lato mb-0">Ranking: <i class="info-icon" data-info="(attack + defense + 2 * rarityBonus) * (1 + shineMultiplier)">${item.score}</i></p>
            `;
        }

        infoContent += `
            <p class="csearch-card-info lato fs-6">Lowest Price: <a class="text-white" href="https://wax.atomichub.io/market?primary_chain=wax-mainnet&template_id=${item.template_id}&blockchain=wax-mainnet&order=asc&sort=price#sales" target="_blank">${item.price !== null && item.price !== undefined ? item.price + ' WAX' : 'No Lowest Price'}</a></p>
        </div>
        `;

        
        // Générer le contenu de la carte en fonction du schéma
        let cardContent = '';
        if (schema === 'crew.worlds') {
            cardContent = `
                <p class="csearch-card-text">Rarity: ${item.rarity}</p>
                <p class="csearch-card-text">Race: ${item.race}</p>
                <p class="csearch-card-text">Shine: ${item.shine}</p>
                <p class="csearch-card-text">Attack: ${item.attack}</p>
                <p class="csearch-card-text">Defense: ${item.defense}</p>
                <p class="csearch-card-text">Element: ${item.element}</p>
                <p class="csearch-card-text">Move Cost: ${item.movecost}</p>
            `;
        } else if (schema === 'faces.worlds') {
            cardContent = `
                <p class="csearch-card-text">Rarity: ${item.rarity}</p>
                <p class="csearch-card-text">Type: ${item.type}</p>
                <p class="csearch-card-text">Shine: ${item.shine}</p>
            `;
        } else if (schema === 'arms.worlds') {
            cardContent = `
                <p class="csearch-card-text">Rarity: ${item.rarity}</p>
                <p class="csearch-card-text">Shine: ${item.shine}</p>
                <p class="csearch-card-text">Attack: ${item.attack}</p>
                <p class="csearch-card-text">Defense: ${item.defense}</p>
                <p class="csearch-card-text">Element: ${item.element}</p>
            `;
        } else if (schema === 'land.worlds') {
            cardContent = `
                <p class="csearch-card-text">Rarity: ${item.rarity}</p>
                <p class="csearch-card-text">Ease: ${item.ease}</p>
                <p class="csearch-card-text">Luck: ${item.luck}</p>
                <p class="csearch-card-text">Delay: ${item.delay}</p>
            `;
        }

        const cardHTML = `
            <div class="card-placeholder">
                <div class="card-img-container" style="position: relative; width: 100%;">
                    <div class="loading-spinner d-flex justify-content-center align-items-center" style="visibility: visible; width: 200px; height: 300px; position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center;">
                        <div class="spinner-border text-light" role="status"></div>
                        <span style="margin-top: 5px;">Loading...</span>
                    </div>
                    <img src="https://ipfs.alienworlds.io/ipfs/${item.img}" class="card-img-top img-fluid d-none" alt="${item.name}" onload="imageLoaded(this)" style="max-width: 200px;">
                    <div class="card-body d-flex flex-column justify-content-center align-items-center text-center" style="visibility: hidden; position: absolute; top: 0; left: 0; right: 0; bottom: 0; color: rgb(255 255 255); padding: 10px; overflow: hidden;">
                        ${cardContent}
                    </div>
                </div>
            </div>
        `;

        // Ajouter les informations et la carte dans le wrapper
        cardWrapper.innerHTML = infoContent + cardHTML;

        // Événements de survol de la souris pour afficher le flou et les statistiques
        cardWrapper.querySelector('.card-placeholder').addEventListener('mouseover', function() {
            const cardBody = this.querySelector('.card-body');
            cardBody.style.visibility = 'visible';
            const img = this.querySelector('.card-img-top');
            img.style.filter = 'blur(4px)'; // Augmenter le niveau de flou
        });

        cardWrapper.querySelector('.card-placeholder').addEventListener('mouseout', function() {
            const cardBody = this.querySelector('.card-body');
            cardBody.style.visibility = 'hidden';
            const img = this.querySelector('.card-img-top');
            img.style.filter = 'none';
        });

        cardsContainer.appendChild(cardWrapper);
    });

    // Créer la pagination avancée
    csearchCreatePagination(filteredData.length, page, paginationContainer, (newPage) => {
        csearchDisplayData(schema, container, newPage);
    });

    // Appliquer les filtres par défaut lors du chargement initial de la section Crews
    if (isInitialLoad && schema === 'crew.worlds') {
        applyFilters('section-crews');
    }
}

// Fonction de gestion du chargement des images
window.imageLoaded = function(imgElement) {
    if (imgElement.complete && imgElement.naturalWidth !== 0) {
        imgElement.classList.remove('d-none'); // Afficher l'image
        imgElement.parentElement.classList.remove('card-placeholder'); // Supprimer la classe placeholder une fois l'image chargée
        const spinner = imgElement.parentNode.querySelector('.loading-spinner');
        if (spinner) {
            spinner.style.visibility = 'hidden'; // Masquer le spinner
        }
    } else {
        console.log(`Chargement de l'image: ${imgElement.src}`);
        imgElement.onload = () => {
            imgElement.classList.remove('d-none'); // Afficher l'image
            imgElement.parentElement.classList.remove('card-placeholder'); // Supprimer la classe placeholder une fois l'image chargée
            const spinner = imgElement.parentNode.querySelector('.loading-spinner');
            if (spinner) {
                spinner.style.visibility = 'hidden'; // Masquer le spinner
            }
        };
    }
};

function csearchCreatePagination(totalItems, currentPage, container, onPageChange) {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const nextPagesToShow = 2;  // Nombre de pages à montrer après les ellipses

    // Effacer le conteneur de pagination existant
    container.innerHTML = '';

    // Bouton "First"
    const firstButton = document.createElement('button');
    firstButton.className = 'btn btn-outline-light mx-1';
    firstButton.textContent = 'First';
    firstButton.disabled = currentPage === 1;
    firstButton.addEventListener('click', () => onPageChange(1));
    container.appendChild(firstButton);

    // Bouton "Previous"
    if (currentPage > 1) {
        const prevButton = document.createElement('button');
        prevButton.className = 'btn btn-outline-light mx-1';
        prevButton.textContent = currentPage - 1;
        prevButton.addEventListener('click', () => onPageChange(currentPage - 1));
        container.appendChild(prevButton);
    }

    // Bouton de la page actuelle
    const currentPageButton = document.createElement('button');
    currentPageButton.className = 'btn btn-outline-light mx-1 csearch-active';
    currentPageButton.textContent = currentPage;
    container.appendChild(currentPageButton);

    // Bouton "Next"
    if (currentPage < totalPages) {
        const nextButton = document.createElement('button');
        nextButton.className = 'btn btn-outline-light mx-1';
        nextButton.textContent = currentPage + 1;
        nextButton.addEventListener('click', () => onPageChange(currentPage + 1));
        container.appendChild(nextButton);
    }

    // Ajouter les ellipses cliquables et les pages suivantes
    if (currentPage < totalPages - nextPagesToShow) {
        const ellipsisButton = document.createElement('button');
        ellipsisButton.className = 'btn btn-outline-light mx-1';
        ellipsisButton.textContent = '...';
        ellipsisButton.addEventListener('click', () => onPageChange(Math.min(currentPage + 3, totalPages)));
        container.appendChild(ellipsisButton);

        // Afficher les deux pages suivantes après les ellipses
        for (let i = 1; i <= nextPagesToShow; i++) {
            const pageNumber = currentPage + 1 + i;  // Correction ici pour afficher les pages suivantes correctement
            if (pageNumber <= totalPages) {
                const nextPageButton = document.createElement('button');
                nextPageButton.className = 'btn btn-outline-light mx-1';
                nextPageButton.textContent = pageNumber;
                nextPageButton.addEventListener('click', () => onPageChange(pageNumber));
                container.appendChild(nextPageButton);
            }
        }
    }

    // Bouton "Last"
    const lastButton = document.createElement('button');
    lastButton.className = 'btn btn-outline-light mx-1';
    lastButton.textContent = 'Last';
    lastButton.disabled = currentPage === totalPages;
    lastButton.addEventListener('click', () => onPageChange(totalPages));
    container.appendChild(lastButton);
}

function csearchApplyFilters(data, sectionId) {
    if (!data) return []; // Assurez-vous que les données existent avant de les filtrer

    // Récupérer les éléments des filtres pour la section spécifique avec vérification d'existence
    const filterNameElement = document.getElementById(`${sectionId}-filter-name`);
    const filterRarityElement = document.getElementById(`${sectionId}-filter-rarity`);
    const filterShineElement = document.getElementById(`${sectionId}-filter-shine`);
    const filterRaceElement = document.getElementById(`${sectionId}-filter-race`);
    const filterElementElement = document.getElementById(`${sectionId}-filter-element`);
    const filterTypeElement = document.getElementById(`${sectionId}-filter-type`);
    const filterAttackMinElement = document.getElementById(`${sectionId}-filter-attack-min`);
    const filterAttackMaxElement = document.getElementById(`${sectionId}-filter-attack-max`);
    const filterDefenseMinElement = document.getElementById(`${sectionId}-filter-defense-min`);
    const filterDefenseMaxElement = document.getElementById(`${sectionId}-filter-defense-max`);
    const filterMovecostMinElement = document.getElementById(`${sectionId}-filter-movecost-min`);
    const filterMovecostMaxElement = document.getElementById(`${sectionId}-filter-movecost-max`);
    const filterEaseMinElement = document.getElementById(`${sectionId}-filter-ease-min`);
    const filterEaseMaxElement = document.getElementById(`${sectionId}-filter-ease-max`);
    const filterLuckMinElement = document.getElementById(`${sectionId}-filter-luck-min`);
    const filterLuckMaxElement = document.getElementById(`${sectionId}-filter-luck-max`);
    const filterDelayMinElement = document.getElementById(`${sectionId}-filter-delay-min`);
    const filterDelayMaxElement = document.getElementById(`${sectionId}-filter-delay-max`);
    const filterRankingElement = document.getElementById(`${sectionId}-filter-ranking`); // Nouveau filtre pour le tri
    const filterPriceMinElement = document.getElementById(`${sectionId}-filter-price-min`); // Nouveau filtre pour le prix minimum
    const filterPriceMaxElement = document.getElementById(`${sectionId}-filter-price-max`); // Nouveau filtre pour le prix maximum
    const filterRentabilityElement = document.getElementById(`${sectionId}-filter-rentability`); // Nouveau filtre pour la rentabilité

    // Utilisation de vérifications pour éviter les erreurs de null
    const filterName = filterNameElement ? filterNameElement.value.toLowerCase() : '';
    const filterRarity = filterRarityElement ? filterRarityElement.value : '';
    const filterShine = filterShineElement ? filterShineElement.value.toLowerCase() : '';
    const filterRace = filterRaceElement ? filterRaceElement.value.toLowerCase() : '';
    const filterElement = filterElementElement ? filterElementElement.value.toLowerCase() : '';
    const filterType = filterTypeElement ? filterTypeElement.value.toLowerCase() : '';
    const filterAttackMin = filterAttackMinElement ? filterAttackMinElement.value : '';
    const filterAttackMax = filterAttackMaxElement ? filterAttackMaxElement.value : '';
    const filterDefenseMin = filterDefenseMinElement ? filterDefenseMinElement.value : '';
    const filterDefenseMax = filterDefenseMaxElement ? filterDefenseMaxElement.value : '';
    const filterMovecostMin = filterMovecostMinElement ? filterMovecostMinElement.value : '';
    const filterMovecostMax = filterMovecostMaxElement ? filterMovecostMaxElement.value : '';
    const filterEaseMin = filterEaseMinElement ? filterEaseMinElement.value : '';
    const filterEaseMax = filterEaseMaxElement ? filterEaseMaxElement.value : '';
    const filterLuckMin = filterLuckMinElement ? filterLuckMinElement.value : '';
    const filterLuckMax = filterLuckMaxElement ? filterLuckMaxElement.value : '';
    const filterDelayMin = filterDelayMinElement ? filterDelayMinElement.value : '';
    const filterDelayMax = filterDelayMaxElement ? filterDelayMaxElement.value : '';
    const filterRanking = filterRankingElement ? filterRankingElement.value : ''; // Récupération du filtre de tri
    const filterPriceMin = filterPriceMinElement ? filterPriceMinElement.value : ''; // Récupération du filtre de prix min
    const filterPriceMax = filterPriceMaxElement ? filterPriceMaxElement.value : ''; // Récupération du filtre de prix max
    const filterRentability = filterRentabilityElement ? filterRentabilityElement.value : ''; // Récupération du filtre de rentabilité

    let filteredData = data.filter(item => {
        return (
            (filterName === '' || item.name.toLowerCase().includes(filterName)) &&
            (filterRarity === '' || item.rarity === filterRarity) &&
            (filterShine === '' || item.shine && item.shine.toLowerCase().includes(filterShine)) &&
            (filterRace === '' || item.race && item.race.toLowerCase().includes(filterRace)) &&
            (filterElement === '' || item.element && item.element.toLowerCase().includes(filterElement)) &&
            (filterType === '' || item.type && item.type.toLowerCase().includes(filterType)) &&
            (filterAttackMin === '' || item.attack >= parseFloat(filterAttackMin)) &&
            (filterAttackMax === '' || item.attack <= parseFloat(filterAttackMax)) &&
            (filterDefenseMin === '' || item.defense >= parseFloat(filterDefenseMin)) &&
            (filterDefenseMax === '' || item.defense <= parseFloat(filterDefenseMax)) &&
            (filterMovecostMin === '' || item.movecost >= parseFloat(filterMovecostMin)) &&
            (filterMovecostMax === '' || item.movecost <= parseFloat(filterMovecostMax)) &&
            (filterEaseMin === '' || item.ease >= parseFloat(filterEaseMin)) &&
            (filterEaseMax === '' || item.ease <= parseFloat(filterEaseMax)) &&
            (filterLuckMin === '' || item.luck >= parseFloat(filterLuckMin)) &&
            (filterLuckMax === '' || item.luck <= parseFloat(filterLuckMax)) &&
            (filterDelayMin === '' || item.delay >= parseFloat(filterDelayMin)) &&
            (filterDelayMax === '' || item.delay <= parseFloat(filterDelayMax)) &&
            (filterPriceMin === '' || (item.price !== null && item.price >= parseFloat(filterPriceMin))) &&
            (filterPriceMax === '' || (item.price !== null && item.price <= parseFloat(filterPriceMax)))
        );
    });

    // Appliquer le tri selon le filtre choisi
    if (sectionId === 'section-crews') {
        switch (filterRanking) {
            case 'Best Ranking':
                filteredData.sort((a, b) => b.score - a.score);
                break;
            case 'Best Attack':
                filteredData.sort((a, b) => b.attack - a.attack);
                break;
            case 'Best Defense':
                filteredData.sort((a, b) => b.defense - a.defense);
                break;
            case 'MoveCost (Low to High)':
                filteredData.sort((a, b) => a.movecost - b.movecost);
                break;
            default:
                break;
        }

        // Appliquer le tri par rentabilité si le filtre est sélectionné
        if (filterRentability) {
            switch (filterRentability) {
            case 'Attack / MoveCost':
                filteredData.sort((a, b) => {
                    // Ajuster l'attaque pour les cartes avec rareté "Abundant"
                    const attackA = a.rarity === 'Abundant' ? 1 : a.attack;
                    const attackB = b.rarity === 'Abundant' ? 1 : b.attack;
                    const rentabilityA = a.price !== null && a.price > 0 && a.movecost > 0 ? (attackA / a.movecost) / a.price : 0;
                    const rentabilityB = b.price !== null && b.price > 0 && b.movecost > 0 ? (attackB / b.movecost) / b.price : 0;
                    return rentabilityB - rentabilityA;
                });
                break;
            case 'Defense':
                filteredData.sort((a, b) => {
                    // Ajuster la défense pour les cartes avec rareté "Abundant"
                    const defenseA = a.rarity === 'Abundant' ? 1 : a.defense;
                    const defenseB = b.rarity === 'Abundant' ? 1 : b.defense;
                    const rentabilityA = a.price !== null && a.price > 0 ? defenseA / a.price : 0;
                    const rentabilityB = b.price !== null && b.price > 0 ? defenseB / b.price : 0;
                    return rentabilityB - rentabilityA;
                });
                break;
                case 'All Stats':
                    filteredData.sort((a, b) => {
                        const rentabilityA = a.price !== null && a.price > 0 && a.movecost > 0 ? (a.score / a.movecost) / a.price : 0;
                        const rentabilityB = b.price !== null && b.price > 0 && b.movecost > 0 ? (b.score / b.movecost) / b.price : 0;
                        return rentabilityB - rentabilityA;
                    });
                    break;
                default:
                    break;
            }
        }
    } else if (sectionId === 'section-arms') {
        // Appliquer le tri selon le filtre choisi pour la section "arms"
        switch (filterRanking) {
            case 'Best Ranking':
                filteredData.sort((a, b) => b.score - a.score);
                break;
            case 'Best Attack':
                filteredData.sort((a, b) => b.attack - a.attack);
                break;
            case 'Best Defense':
                filteredData.sort((a, b) => b.defense - a.defense);
                break;
            default:
                break;
        }

        // Appliquer le tri par rentabilité si le filtre est sélectionné
        if (filterRentability) {
            switch (filterRentability) {
            case 'Attack':
                filteredData.sort((a, b) => {
                    // Ajuster l'attaque pour les cartes avec rareté "Abundant"
                    const attackA = a.rarity === 'Abundant' ? 1 : a.attack;
                    const attackB = b.rarity === 'Abundant' ? 1 : b.attack;
                    const rentabilityA = a.price !== null && a.price > 0 ? attackA / a.price : 0;
                    const rentabilityB = b.price !== null && b.price > 0 ? attackB / b.price : 0;
                    return rentabilityB - rentabilityA;
                });
                break;
            case 'Defense':
                filteredData.sort((a, b) => {
                    // Ajuster la défense pour les cartes avec rareté "Abundant"
                    const defenseA = a.rarity === 'Abundant' ? 1 : a.defense;
                    const defenseB = b.rarity === 'Abundant' ? 1 : b.defense;
                    const rentabilityA = a.price !== null && a.price > 0 ? defenseA / a.price : 0;
                    const rentabilityB = b.price !== null && b.price > 0 ? defenseB / b.price : 0;
                    return rentabilityB - rentabilityA;
                });
                break;
                case 'All Stats':
                    filteredData.sort((a, b) => {
                        const rentabilityA = a.price !== null && a.price > 0 ? a.score / a.price : 0;
                        const rentabilityB = b.price !== null && b.price > 0 ? b.score / b.price : 0;
                        return rentabilityB - rentabilityA;
                    });
                    break;
                default:
                    break;
            }
        }
    }

    return filteredData;
}


// Fonction pour afficher/masquer les filtres
window.toggleFilters = function(filtersId) {
    const filtersContainer = document.getElementById(filtersId);
    if (filtersContainer) {
        filtersContainer.classList.toggle('d-none');
    }
};

window.applyFilters = function(sectionId) {

    const activeSection = document.getElementById(sectionId);
    if (activeSection) {
        // Assurez-vous que la correspondance de sectionId est correcte
        const schema = Object.keys(dataCache).find(key => sectionId.includes(key.split('.')[0]));
        
        if (schema) {
            csearchDisplayData(schema, activeSection, 1);
        } else {
            console.error("Erreur : Schéma non trouvé.");
        }
    } else {
        console.error("Erreur : Section active non trouvée.");
    }
};

// Fonction pour ordonner les raretés
function rarityOrder(rarity) {
    const order = ['Abundant', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythical'];
    return order.indexOf(rarity);
}

function shineOrder(shine) {
    const order = ['Stone', 'Gold', 'Stardust', 'Antimatter', 'XDimension'];
    return order.indexOf(shine);
}

// Fonction de gestion du chargement des images
window.imageLoaded = function(imgElement) {
    if (imgElement.complete && imgElement.naturalWidth !== 0) {
        imgElement.classList.remove('d-none'); // Afficher l'image
        const spinner = imgElement.parentNode.querySelector('.loading-spinner');
        if (spinner) {
            spinner.style.visibility = 'hidden'; // Masquer le spinner
        }
    } else {
        imgElement.onload = () => {
            console.log(`Image chargée: ${imgElement.src}`);
            imgElement.classList.remove('d-none'); // Afficher l'image
            const spinner = imgElement.parentNode.querySelector('.loading-spinner');
            if (spinner) {
                spinner.style.visibility = 'hidden'; // Masquer le spinner
            }
        };
    }
};
