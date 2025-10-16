let editingId = null; // ID de l'élément en cours de modification

document.getElementById('toggleMission').addEventListener('click', function() {
    toggleSection('mission-admin');
});

document.getElementById('toggleNews').addEventListener('click', function() {
    toggleSection('news-admin');
});

document.getElementById('toggleLore').addEventListener('click', function() {
    toggleSection('lore-admin');
});

document.getElementById('toggleTarget').addEventListener('click', function() {
    toggleSection('target-admin');
});

document.getElementById('toggleSupplyAds').addEventListener('click', function() {
    const supplyAdsSection = document.getElementById('supply-ads-admin');
    supplyAdsSection.classList.toggle('d-none');
    
    if (!supplyAdsSection.classList.contains('d-none')) {
        loadProducts();
        loadDevLogs();
    }
});

document.getElementById('fetchTotalAttack').addEventListener('click', function() {
    fetchTotalAttacks();
});

function toggleSection(sectionId) {
    const sections = ['mission-admin', 'news-admin', 'lore-admin', 'target-admin', 'supply-ads-admin'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (id === sectionId) {
            section.classList.toggle('d-none');
        } else {
            section.classList.add('d-none');
        }
    });
}

// Gestion des notifications
function showSuccessToast() {
    const toast = new bootstrap.Toast(document.getElementById('successToast'));
    toast.show();
    setTimeout(() => {
        toast.hide();
    }, 2000);
}

function showErrorToast(message = 'Une erreur est survenue.') {
    const toast = new bootstrap.Toast(document.getElementById('errorToast'));
    document.getElementById('errorToast').querySelector('.toast-body').textContent = message;
    toast.show();
    setTimeout(() => {
        toast.hide();
    }, 2000);
}

function showImageErrorToast() {
    const toast = new bootstrap.Toast(document.getElementById('imageErrorToast'));
    toast.show();
    setTimeout(() => {
        toast.hide();
    }, 2000);
}

function showLoadingSpinner() {
    document.getElementById('spinnerContainer').style.display = 'flex';
}

function hideLoadingSpinner() {
    document.getElementById('spinnerContainer').style.display = 'none';
}

function validateForm(formData, formType) {
    const requiredFields = formType === 'attack' ? [
        'attackTitleSite', 'attackTitleOnchain', 'attackText', 'attackTarget', 'attackRewards', 'attackDifficulty', 'attackStartDate', 'attackEndDate', 'Planet', 'attackImage', 'attackShards'
    ] : [
        'defenseTitleSite', 'defenseTitleOnchain', 'defenseText', 'defenseTarget', 'defenseRewards', 'defenseStartDate', 'defenseEndDate', 'Planet', 'defenseImage', 'defenseShards'
    ];

    for (let field of requiredFields) {
        if (!formData.get(field)) {
            console.error(`Champ manquant: ${field}`);
            return false;
        }
    }

    const rewardsPattern = /^\d{1,11}\.\d{4} TLM$/;
    if (formType === 'attack' && !rewardsPattern.test(formData.get('attackRewards'))) {
        console.error('Format de rewards incorrect pour attackRewards');
        return false;
    }
    if (formType === 'defense' && !rewardsPattern.test(formData.get('defenseRewards'))) {
        console.error('Format de rewards incorrect pour defenseRewards');
        return false;
    }
    
    const shardsPattern = /^\d{1,11}\.\d{4} Shards$/;
    if (formType === 'attack' && !shardsPattern.test(formData.get('attackShards'))) {
        console.error('Format de Shards incorrect pour attackShards');
        return false;
    }
    if (formType === 'defense' && !shardsPattern.test(formData.get('defenseShards'))) {
        console.error('Format de Shards incorrect pour defenseShards');
        return false;
    }
    
    return true;
}

function formatDateWithSeconds(dateString) {
    const date = new Date(dateString);
    return date.toISOString().slice(0, 19);
}

async function downloadImageUsingCanvas(url) {
    return new Promise((resolve, reject) => {
        // Étape 1 : Précharger l'image sans `crossOrigin` pour la mettre en cache
        const imgPreload = new Image();
        imgPreload.src = url;

        imgPreload.onload = () => {
            // L'image est maintenant en cache, on peut essayer de la charger avec `crossOrigin`

            // Étape 2 : Charger l'image avec `crossOrigin = "anonymous"`
            const img = new Image();
            img.crossOrigin = "anonymous"; // Nécessaire pour permettre l'accès CORS
            img.src = url;

            img.onload = () => {
                // Créer un canvas et dessiner l'image dessus
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);

                // Convertir le canvas en Blob
                canvas.toBlob(blob => {
                    if (blob) {
                        const fileName = url.split('/').pop().split('?')[0];
                        resolve(new File([blob], fileName, { type: blob.type }));
                    } else {
                        reject(new Error("Erreur de conversion en blob."));
                    }
                }, 'image/png');
            };

            img.onerror = () => reject(new Error("Erreur de chargement de l'image avec crossOrigin"));
        };

        imgPreload.onerror = () => reject(new Error("Erreur de chargement de l'image en pré-chargement"));
    });
}

async function populateForm(data) {
    if (data.type === 'Attack') {
        document.getElementById('attackTitleSite').value = data.title || '';
        document.getElementById('attackTitleOnchain').value = data.titleOnChain || '';
        document.getElementById('attackText').value = data.text || '';
        document.getElementById('attackTarget').value = data.score || '';
        document.getElementById('attackRewards').value = data.reward || '';
        document.getElementById('attackDifficulty').value = data.difficultyIncrease || '';
        document.getElementById('attackStartDate').value = new Date(data.startDate * 1000).toISOString().slice(0, 19);
        document.getElementById('attackEndDate').value = new Date(data.endDate * 1000).toISOString().slice(0, 19);
        document.getElementById('Planet').value = data.planet || '';
        document.getElementById('attackShards').value = data.shards || '';

        if (data.image) {
            const file = await downloadImageUsingCanvas(data.image);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('attackImage').files = dataTransfer.files;
        }
    } else if (data.type === 'Defense') {
        document.getElementById('defenseTitleSite').value = data.title || '';
        document.getElementById('defenseTitleOnchain').value = data.titleOnChain || '';
        document.getElementById('defenseText').value = data.text || '';
        document.getElementById('defenseTarget').value = data.score || '';
        document.getElementById('defenseRewards').value = data.reward || '';
        document.getElementById('defenseStartDate').value = new Date(data.startDate * 1000).toISOString().slice(0, 19);
        document.getElementById('defenseEndDate').value = new Date(data.endDate * 1000).toISOString().slice(0, 19);
        document.getElementById('Planet').value = data.planet || '';
        document.getElementById('defenseShards').value = data.shards || '';

        if (data.image) {
            const file = await downloadImageUsingCanvas(data.image);
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('defenseImage').files = dataTransfer.files;
        }
    }
}

document.getElementById('jsonForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.onload = async function(e) {
            const json = JSON.parse(e.target.result);
            await populateForm(json);
        };
        reader.readAsText(file);
    }
});

function convertToTimestampUTC(dateString) {
    const date = new Date(dateString);
    const utcTimestamp = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds()
    ) / 1000;
    return utcTimestamp;
}

document.getElementById('attackForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    formData.set('attackStartDate', convertToTimestampUTC(formData.get('attackStartDate')));
    formData.set('attackEndDate', convertToTimestampUTC(formData.get('attackEndDate')));

    if (!validateForm(formData, 'attack')) {
        showErrorToast();
        return;
    }

    showLoadingSpinner();

    fetch('/admin/update-attack', {
        method: 'POST',
        body: formData,
        cache: 'no-cache',
        credentials: 'same-origin'
    })
    .then(response => {
        hideLoadingSpinner();
        if (!response.ok) {
            showImageErrorToast();
            return response.json().then(err => { throw err });
        }
        return response.json();
    })
    .then(data => {
        showSuccessToast();
        loadData(); // Rafraîchir les données après ajout
    })
    .catch(error => {
        hideLoadingSpinner();
        console.error('Erreur:', error);
        showImageErrorToast();
    });
});

document.getElementById('defenseForm').addEventListener('submit', function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    formData.set('defenseStartDate', convertToTimestampUTC(formData.get('defenseStartDate')));
    formData.set('defenseEndDate', convertToTimestampUTC(formData.get('defenseEndDate')));

    if (!validateForm(formData, 'defense')) {
        showErrorToast();
        return;
    }

    showLoadingSpinner();

    fetch('/admin/update-defense', {
        method: 'POST',
        body: formData,
        cache: 'no-cache',
        credentials: 'same-origin'
    })
    .then(response => {
        hideLoadingSpinner();
        if (!response.ok) {
            showImageErrorToast();
            return response.json().then(err => { throw err });
        }
        return response.json();
    })
    .then(data => {
        showSuccessToast();
        loadData(); // Rafraîchir les données après ajout
    })
    .catch(error => {
        hideLoadingSpinner();
        console.error('Erreur:', error);
        showImageErrorToast();
    });
});

function loadData() {
    fetch('/admin/data', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-cache'
    })
    .then(response => response.json())
    .then(data => {
        const attackTableBody = document.getElementById('attack-table-body');
        const defenseTableBody = document.getElementById('defense-table-body');
        attackTableBody.innerHTML = '';
        defenseTableBody.innerHTML = '';

        data.forEach(row => {
            if (row.attackimg || row.attackTitleSite) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td><a href="#" class="text-white" onclick="showDetails(${row.id}, 'attack')">${row.attackTitleSite}</a></td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteMission(${row.id}, 'attack')">X</button></td>
                `;
                attackTableBody.appendChild(tr);
            }
            if (row.defenseimg || row.defenseTitleSite) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td><a href="#" class="text-white" onclick="showDetails(${row.id}, 'defense')">${row.defenseTitleSite}</a></td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteMission(${row.id}, 'defense')">X</button></td>
                `;
                defenseTableBody.appendChild(tr);
            }
        });
    })
    .catch(error => console.error('Erreur:', error));
}

function deleteMission(id, type) {
    const endpoint = type === 'attack' ? '/admin/delete-attack/' : '/admin/delete-defense/';
    fetch(endpoint + id, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-cache'
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => { throw err });
        }
        showDeleteSuccessToast(); // Afficher le toast de succès après suppression
        loadData(); // Rafraîchir les données après suppression
    })
    .catch(error => console.error('Erreur:', error));
}

function formatTimestampUTC(timestamp) {
    const date = new Date(timestamp * 1000); // Convertir le timestamp en millisecondes
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
}

function showDetails(id, type) {
    const endpoint = type === 'attack' ? '/admin/data-attack/' : '/admin/data-defense/';
    fetch(endpoint + id, {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-cache'
    })
    .then(response => response.json())
    .then(data => {
        const modalBody = document.getElementById('detailsModalBody');
        let difficultyHtml = '';

        if (type === 'attack' && data.attackDifficulty) {
            difficultyHtml = `<p><strong>Difficulté:</strong> ${data.attackDifficulty}</p>`;
        }

        modalBody.innerHTML = `
            <p><strong>ID:</strong> ${data.id}</p>
            <p><strong>Title:</strong> ${type === 'attack' ? data.attackTitleSite : data.defenseTitleSite}</p>
            <p><strong>T.Onchain:</strong> ${type === 'attack' ? data.attackTitleOnchain : data.defenseTitleOnchain}</p>
            <p><strong>Text:</strong> ${type === 'attack' ? data.attacktext : data.defensetext}</p>
            ${difficultyHtml}
            <p><strong>Target:</strong> ${type === 'attack' ? data.attackTarget : data.defenseTarget}</p>
            <p><strong>Rewards TLM:</strong> ${type === 'attack' ? data.attackRewards : data.defenseRewards}</p>
            <p><strong>Rewards Shards:</strong> ${type === 'attack' ? data.attackShards : data.defenseShards}</p>
            <p><strong>Start Date:</strong> ${formatTimestampUTC(type === 'attack' ? data.attackStartDate : data.defenseStartDate)}</p>
            <p><strong>End Date:</strong> ${formatTimestampUTC(type === 'attack' ? data.attackEndDate : data.defenseEndDate)}</p>
            <p><strong>Planet:</strong> ${type === 'attack' ? data.Planet : data.Planet}</p>
            <p><strong>Image:</strong> <img src="/images/${type === 'attack' ? data.attackimg : data.defenseimg}" alt="Image" class="img-fluid"></p>
        `;

        const modal = new bootstrap.Modal(document.getElementById('detailsModal'));
        modal.show();
    })
    .catch(error => console.error('Erreur:', error));
}
class MyUploadAdapter {
    constructor(loader) {
        this.loader = loader;
        this.url = '/admin/upload-image'; // Votre endpoint d'upload d'image
    }

    upload() {
        return this.loader.file
            .then(file => new Promise((resolve, reject) => {
                const data = new FormData();
                data.append('upload', file);

                fetch(this.url, {
                    method: 'POST',
                    body: data,
                    credentials: 'same-origin'
                })
                .then(response => response.json())
                .then(response => {
                    if (response.error) {
                        return reject(response.error.message);
                    }

                    resolve({
                        default: response.url
                    });
                })
                .catch(error => {
                    reject('Erreur lors de l\'upload de l\'image.');
                });
            }));
    }

    abort() {
        // Handle aborting the upload
    }
}

function MyCustomUploadAdapterPlugin(editor) {
    editor.plugins.get('FileRepository').createUploadAdapter = (loader) => {
        return new MyUploadAdapter(loader);
    };
}
function showDeleteSuccessToast() {
    const toast = new bootstrap.Toast(document.getElementById('deleteSuccessToast'));
    toast.show();
    setTimeout(() => {
        toast.hide();
        loadData(); // Rafraîchir les données sans recharger la page
    }, 2000); // Affiche le toast pendant 2 secondes puis rafraîchit les données
}

// Gestion News

document.getElementById('newsForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!newsEditor) {
        showErrorToast('L\'éditeur n\'est pas prêt.');
        return;
    }
    
    const formData = new FormData();
    const newsContent = newsEditor.getData(); // Utilisez la variable globale pour obtenir le contenu

    if (!newsContent.trim()) {
        console.error('Erreur: Le contenu des news est vide.');
        showErrorToast('Le contenu des news ne doit pas être vide.');
        return;
    }

    formData.append('newsContent', newsContent);

    fetch('/admin/update-news', {
        method: 'POST',
        body: formData,
        cache: 'no-cache',
        credentials: 'same-origin'
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erreur lors de la requête:', response);
            return response.json().then(err => { throw err });
        }
        return response.json();
    })
    .then(data => {
        showSuccessToast();
        loadNewsData();
    })
    .catch(error => {
        console.error('Erreur lors de l\'envoi des données:', error);
        showErrorToast();
    });
});

function loadNewsData() {
    fetch('/admin/data-news', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-cache'
    })
    .then(response => response.json())
    .then(data => {
        const newsTableBody = document.getElementById('news-table-body');
        const noNewsMessage = document.getElementById('no-news-message');
        const newsTable = document.getElementById('news-table');

        newsTableBody.innerHTML = '';

        if (data.length === 0) {
            noNewsMessage.classList.remove('d-none');
            newsTable.classList.add('d-none');
        } else {
            noNewsMessage.classList.add('d-none');
            newsTable.classList.remove('d-none');

            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${row.id}</td>
                    <td>${row.newsfeed}</td>
                    <td>${formatTimestampUTC(row.date)}</td>
                    <td><button class="btn btn-danger btn-sm" onclick="deleteNews(${row.id})">X</button></td>
                `;
                newsTableBody.appendChild(tr);
            });
        }
    })
    .catch(error => console.error('Erreur lors du chargement des données:', error));
}

function deleteNews(id) {
    fetch(`/admin/delete-news/${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
        cache: 'no-cache'
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erreur lors de la requête de suppression:', response);
            return response.json().then(err => { throw err });
        }
        showDeleteSuccessToast();
        loadNewsData();
    })
    .catch(error => {
        console.error('Erreur lors de la suppression de la news:', error);
        showErrorToast('Erreur lors de la suppression de la news.');
    });
}

// Gestion Lore
document.getElementById('loreForm').addEventListener('submit', function(e) {
    e.preventDefault();

    if (!loreEditor) {
        console.error('Erreur: CKEditor n\'est pas initialisé.');
        showErrorToast('L\'éditeur n\'est pas prêt.');
        return;
    }

    // Log du contenu de l'éditeur
    const loreHtmlContent = loreEditor.getData();
    console.log('Contenu de l\'éditeur CKEditor:', loreHtmlContent);

    // Mettez à jour la valeur du textarea avec le contenu de l'éditeur
    document.getElementById('loreHtml').value = loreHtmlContent;
    
    // Log de la valeur mise à jour du textarea
    console.log('Valeur du textarea loreHtml après mise à jour:', document.getElementById('loreHtml').value);

    const formData = new FormData(e.target);
    const loreData = {
        page: formData.get('lorePage'),
        titre: formData.get('loreTitle'),
        lore_html: formData.get('loreHtml'),
        section: formData.get('loreSection')
    };

    // Log des données du formulaire
    console.log('Données du formulaire avant envoi:', loreData);

    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `/admin/lore/${editingId}` : '/admin/lore';

    fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(loreData)
    })
    .then(response => {
        if (!response.ok) {
            console.error('Erreur lors de la requête:', response);
            showErrorToast();
            return response.json().then(err => { throw err });
        }
        return response.json();
    })
    .then(data => {
        console.log('Réponse du serveur après envoi:', data);
        showSuccessToast();
        loadLoreData();
        resetForm();
    })
    .catch(error => {
        console.error('Erreur lors de l\'envoi des données:', error);
        showErrorToast();
    });
});


function resetForm() {
    document.getElementById('lorePage').value = '';
    document.getElementById('loreTitle').value = '';
    document.getElementById('loreHtml').value = '';
    loreEditor.setData('');
    document.getElementById('validateModification').classList.add('d-none');
    document.getElementById('submitButton').classList.remove('d-none');
    editingId = null;
}

function loadLoreData() {
    fetch('/admin/lore', {
        method: 'GET'
    })
    .then(response => response.json())
    .then(data => {
        const loreTableBody = document.getElementById('lore-table-body');
        const monstreTableBody = document.getElementById('monstre-table-body');
        loreTableBody.innerHTML = '';
        monstreTableBody.innerHTML = '';

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.page}</td>
                <td>${row.titre}</td>
                <td>${row.section}</td>
                <td>${row.valide}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="editLore(${row.id})">Modifier</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteLore(${row.id})">Supprimer</button>
                    <button class="btn btn-success btn-sm" onclick="validateLore(${row.id})">Valider</button>
                </td>
            `;

            if (row.section === 'Lore') {
                loreTableBody.appendChild(tr);
            } else if (row.section === 'Monstre') {
                monstreTableBody.appendChild(tr);
            }
        });
    })
    .catch(error => console.error('Erreur:', error));
}

function editLore(id) {
    fetch(`/admin/lore/${id}`)
    .then(response => response.json())
    .then(data => {
        document.getElementById('lorePage').value = data.page;
        document.getElementById('loreTitle').value = data.titre;
        document.getElementById('loreHtml').value = data.lore_html;
        document.getElementById('loreSection').value = data.section;

        if (loreEditor) {
            loreEditor.setData(data.lore_html);
        }

        document.getElementById('validateModification').classList.remove('d-none');
        document.getElementById('submitButton').classList.add('d-none');
        editingId = id; // Définir l'ID de l'élément en cours de modification
    })
    .catch(error => console.error('Erreur lors de la récupération des données:', error));
}

document.getElementById('validateModification').addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('loreForm').dispatchEvent(new Event('submit')); // Déclenche la soumission du formulaire
});

function deleteLore(id) {
    fetch(`/admin/lore/${id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        showDeleteSuccessToast();
        loadLoreData();
    })
    .catch(error => {
        console.error('Erreur:', error);
        showErrorToast();
    });
}

function validateLore(id) {
    fetch(`/admin/lore/validate/${id}`, {
        method: 'PUT'
    })
    .then(response => response.json())
    .then(data => {
        showSuccessToast();
        loadLoreData();
    })
    .catch(error => {
        console.error('Erreur:', error);
        showErrorToast();
    });
}

async function fetchTotalAttacks() {
    try {
        showLoadingSpinner(); // Affiche le spinner de chargement

        let totalAttacks = 0;
        let totalParticipants = 0;

        // Récupération des données des joueurs
        const playerData = await fetchData('players');
        totalAttacks += calculateTotalAttacks(playerData); // Ajout des attaques des joueurs
        totalParticipants += playerData.length;

        // Récupération des données des propriétaires
        const ownerData = await fetchData('owners');

        // Récupération de la liste des propriétaires actifs
        const activeLandowners = await fetchActiveLandowners();

        const filteredOwnerData = ownerData.filter(owner => {
            // Vérifier que `owner_address` est défini et est une chaîne
            if (owner.owner_address && typeof owner.owner_address === 'string') {
                return activeLandowners.includes(owner.owner_address.toLowerCase());
            }
            return false; // Exclure les entrées sans `owner_address`
        });

        // Ajout des attaques des propriétaires actifs
        totalAttacks += calculateTotalAttacks(filteredOwnerData);
        totalParticipants += filteredOwnerData.length;

        // Mise à jour des résultats dans l'interface
        document.getElementById('totalAttacks').textContent = totalAttacks;
        document.getElementById('totalParticipants').textContent = totalParticipants;

        hideLoadingSpinner(); // Masque le spinner de chargement
        showSuccessToast('Les données ont été récupérées avec succès.');

    } catch (error) {
        hideLoadingSpinner(); // Masque le spinner de chargement en cas d'erreur
        console.error('Erreur lors de la récupération des données:', error);
        showErrorToast('Erreur lors de la récupération des données.');
    }
}

async function fetchData(table) {
    let allData = [];
    let moreDataAvailable = true;
    let lowerBound = null;

    while (moreDataAvailable) {
        try {
            const response = await fetch('https://api.waxsweden.org:443/v1/chain/get_table_rows', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    code: 'magordefense',
                    table: table,
                    scope: 'magordefense',
                    json: true,
                    limit: 1000,  // Ajuster la limite si nécessaire
                    lower_bound: lowerBound
                })
            });

            const data = await response.json();

            if (response.ok) {
                allData = allData.concat(data.rows);
                moreDataAvailable = data.more;
                lowerBound = data.next_key;
            } else {
                console.error('Erreur de la réponse API:', data);
                showErrorToast('Erreur de la réponse API.');
                break;
            }
        } catch (error) {
            console.error('Erreur de requête API:', error);
            showErrorToast('Erreur lors de la requête API.');
            break;
        }
    }

    return allData;
}

async function fetchActiveLandowners() {
    try {
        const response = await fetch('mission/check-landowner-status');
        const data = await response.json();

        if (response.ok) {
            return Object.keys(data.landowners).filter(key => data.landowners[key] === 1); // Récupère uniquement les clés actives
        } else {
            console.error('Erreur lors de la récupération des propriétaires actifs:', data);
            showErrorToast('Erreur lors de la récupération des propriétaires actifs.');
            return [];
        }
    } catch (error) {
        console.error('Erreur lors de la requête pour les propriétaires actifs:', error);
        showErrorToast('Erreur lors de la requête pour les propriétaires actifs.');
        return [];
    }
}

// Fonction pour calculer le total des attaques, incluant le prorata pour les intervalles > 24h
function calculateTotalAttacks(data) {
    let totalAttacks = 0;
    const SECONDS_IN_A_DAY = 86400; // Nombre de secondes dans 24 heures

    data.forEach(item => {
        const attackPoints = item.totalAttack; // Points d'attaque par action
        const moveCostSeconds = 3 * 60 * 60 + 10 * item.totalMoveCost; // Calcul du coût de déplacement en secondes

        if (moveCostSeconds > SECONDS_IN_A_DAY) {
            // Si l'intervalle d'attaque dépasse 24 heures, applique le prorata
            const proratedAttacks = 24 / (moveCostSeconds / 3600); // Pro-rata sur 24 heures
            totalAttacks += proratedAttacks * attackPoints;
        } else {
            // Calcul normal pour les intervalles <= 24 heures
            const attacksPerDay = Math.floor(SECONDS_IN_A_DAY / moveCostSeconds); // Nombre d'attaques possibles
            totalAttacks += attacksPerDay * attackPoints;
        }
    });

    return Math.floor(totalAttacks); // Retourne le total des attaques arrondi
}



// Charger les données au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
    loadLoreData();
    loadNewsData();
    loadData();
    
    // Charger les produits et dev logs si on est sur l'onglet Supply Ads
    const toggleSupplyAds = document.getElementById('toggleSupplyAds');
    if (toggleSupplyAds) {
        toggleSupplyAds.addEventListener('click', () => {
            loadProducts();
            loadDevLogs();
        });
    }
});

// Gestion de la déconnexion
document.getElementById('logout').addEventListener('click', function(e) {
    e.preventDefault();
    fetch('/admin/logout')
        .then(response => {
            // Forcer l'effacement du cookie côté client
            document.cookie = 'connect.sid=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
            window.location.href = '/login';
        })
        .catch(error => console.error('Erreur:', error));
});

// Gestion des produits
document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    try {
        const response = await fetch('/admin/products', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'Produit ajouté avec succès',
                confirmButtonColor: '#ff9c00'
            });
            e.target.reset();
            
            // Mettre à jour l'affichage dans l'interface d'administration
            loadProducts();
            
            // Mettre à jour l'affichage sur la page supply-ads
            const section = formData.get('section');
            if (typeof loadProducts === 'function' && typeof addNewProduct === 'function') {
                // Recharger les produits pour la section correspondante
                loadProducts(section);
            }
        } else {
            throw new Error(data.error || 'Erreur lors de l\'ajout du produit');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
});

// Gestion des dev logs
document.getElementById('devLogForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        title: formData.get('title'),
        content: formData.get('content'),
        tags: formData.get('tags').split(',').map(tag => tag.trim())
    };
    
    try {
        const response = await fetch('/admin/dev-logs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Succès',
                text: 'Dev log ajouté avec succès',
                confirmButtonColor: '#ff9c00'
            });
            e.target.reset();
            loadDevLogs();
        } else {
            throw new Error(responseData.error || 'Erreur lors de l\'ajout du dev log');
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
});

// Charger les produits
async function loadProducts() {
    try {
        const supplyAdsSection = document.getElementById('supply-ads-admin');
        if (!supplyAdsSection || supplyAdsSection.classList.contains('d-none')) {
            console.log('La section Supply Ads n\'est pas visible');
            return;
        }

        const response = await fetch('/admin/products');
        const products = await response.json();
        
        const tbody = document.getElementById('products-table-body');
        if (!tbody) {
            console.error('Élément products-table-body non trouvé dans le DOM');
            return;
        }
        
        tbody.innerHTML = products.map(product => `
            <tr>
                <td>${product.id}</td>
                <td>${product.title}</td>
                <td>${product.section}</td>
                <td>${product.price}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editProduct(${product.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${product.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des produits:', error);
    }
}

// Charger les dev logs
async function loadDevLogs() {
    try {
        const response = await fetch('/admin/dev-logs');
        const logs = await response.json();
        
        const tbody = document.getElementById('devLogsList');
        tbody.innerHTML = logs.map(log => `
            <tr>
                <td>${log.title}</td>
                <td>${JSON.parse(log.tags).join(', ')}</td>
                <td>${new Date(log.date * 1000).toLocaleDateString()}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editDevLog(${log.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDevLog(${log.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erreur lors du chargement des dev logs:', error);
    }
}

// Éditer un produit
async function editProduct(id) {
    try {
        const response = await fetch(`/admin/products/${id}`);
        const product = await response.json();
        
        const result = await Swal.fire({
            title: 'Modifier le produit',
            html: `
                <form id="editProductForm">
                    <div class="mb-3">
                        <label class="form-label">Section</label>
                        <select class="form-select" name="section" required>
                            <option value="merch-today" ${product.section === 'merch-today' ? 'selected' : ''}>Merch Today</option>
                            <option value="conneries" ${product.section === 'conneries' ? 'selected' : ''}>Des conneries</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Titre</label>
                        <input type="text" class="form-control" name="title" value="${product.title}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Description</label>
                        <textarea class="form-control" name="description" required>${product.description}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Prix (WAX)</label>
                        <input type="number" class="form-control" name="price" value="${product.price}" step="0.01" required>
                    </div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: 'Modifier',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ff9c00',
            preConfirm: () => {
                const form = document.getElementById('editProductForm');
                const formData = new FormData(form);
                return Object.fromEntries(formData.entries());
            }
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/products/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result.value)
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Produit modifié avec succès',
                    confirmButtonColor: '#ff9c00'
                });
                loadProducts();
            } else {
                throw new Error('Erreur lors de la modification du produit');
            }
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
}

// Supprimer un produit
async function deleteProduct(id) {
    try {
        const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: 'Cette action est irréversible !',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff9c00',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/products/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Produit supprimé avec succès',
                    confirmButtonColor: '#ff9c00'
                });
                loadProducts();
            } else {
                throw new Error('Erreur lors de la suppression du produit');
            }
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
}

// Éditer un dev log
async function editDevLog(id) {
    try {
        const response = await fetch(`/admin/dev-logs/${id}`);
        const log = await response.json();
        
        const result = await Swal.fire({
            title: 'Modifier le dev log',
            html: `
                <form id="editDevLogForm">
                    <div class="mb-3">
                        <label class="form-label">Titre</label>
                        <input type="text" class="form-control" name="title" value="${log.title}" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Contenu</label>
                        <textarea class="form-control" name="content" required>${log.content}</textarea>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Tags (séparés par des virgules)</label>
                        <input type="text" class="form-control" name="tags" value="${JSON.parse(log.tags).join(', ')}" required>
                    </div>
                </form>
            `,
            showCancelButton: true,
            confirmButtonText: 'Modifier',
            cancelButtonText: 'Annuler',
            confirmButtonColor: '#ff9c00',
            preConfirm: () => {
                const form = document.getElementById('editDevLogForm');
                const formData = new FormData(form);
                const data = Object.fromEntries(formData.entries());
                data.tags = data.tags.split(',').map(tag => tag.trim());
                return data;
            }
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/dev-logs/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(result.value)
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Dev log modifié avec succès',
                    confirmButtonColor: '#ff9c00'
                });
                loadDevLogs();
            } else {
                throw new Error('Erreur lors de la modification du dev log');
            }
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
}

// Supprimer un dev log
async function deleteDevLog(id) {
    try {
        const result = await Swal.fire({
            title: 'Êtes-vous sûr ?',
            text: 'Cette action est irréversible !',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ff9c00',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Oui, supprimer',
            cancelButtonText: 'Annuler'
        });

        if (result.isConfirmed) {
            const response = await fetch(`/admin/dev-logs/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Succès',
                    text: 'Dev log supprimé avec succès',
                    confirmButtonColor: '#ff9c00'
                });
                loadDevLogs();
            } else {
                throw new Error('Erreur lors de la suppression du dev log');
            }
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Erreur',
            text: error.message,
            confirmButtonColor: '#ff9c00'
        });
    }
}
