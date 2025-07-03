(function () {

    async function updateForgeStatusDisplay() {
        const forgeImage = document.getElementById('forgeimage');
        const forgeStatus = document.getElementById('forge-status');
        const forgeStatusText = document.getElementById('forge-status-text');
        const buyForgeButton = document.getElementById('buyforge-button');
        const forgeUpgradeText = document.getElementById('forgeupgrade');

        if (!forgeImage || !forgeStatus || !forgeStatusText || !buyForgeButton || !forgeUpgradeText) {
            return; // Assurez-vous que les éléments existent
        }

        const userAccount = localStorage.getItem("userAccount");

        if (!userAccount) {
            console.error("No user account found in localStorage.");
            return;
        }

        try {
            // Appel à fetchForgeStatus pour récupérer le statut
            const forgeStatusData = await fetchForgeStatus(userAccount);

            const isForgeActive = forgeStatusData && forgeStatusData.rows && forgeStatusData.rows.length > 0;

            if (isForgeActive) {
                // Cas 1 : Forge ACTIVE
                forgeImage.src = '../images/Forge-activated-final.png'; // Remplacez par le chemin de votre image pour le statut actif
                forgeImage.alt = 'Forge Active';

                forgeStatus.style.color = 'green';
                forgeStatus.innerText = 'Forge is ACTIVE';

                forgeStatusText.innerText = 'Your arms.world NFTs are now taken into account in your statistics. Later, you will be able to use it for crafting and more.';

                // Masquer le bouton d'activation de la forge et le texte
                buyForgeButton.style.display = 'none';
                forgeUpgradeText.style.display = 'none';
            } else {
                // Cas 2 : Forge Not Activated
                forgeImage.src = '../images/Forge-deactivated-final.png'; // Remplacez par le chemin de votre image pour le statut inactif
                forgeImage.alt = 'Forge Not Active';

                forgeStatus.style.color = 'red';
                forgeStatus.innerText = 'Forge is NOT ACTIVE';

                forgeStatusText.innerText = 'Buy it for 10,000 PDT to use your arms.world NFTs on Attack and Defense missions. Later, you will be able to use it for crafting and more.';

                // Afficher le bouton d'activation de la forge et le texte
                buyForgeButton.style.display = 'block';
                forgeUpgradeText.style.display = 'block';
            }
        } catch (error) {
            // Cas 3 : Échec de la requête
            console.error("Error fetching forge status:", error);

            forgeImage.src = '../images/Forge-error-final.png'; // Image pour l'état d'erreur
            forgeImage.alt = 'Forge Status Error';

            forgeStatus.style.color = 'orange';
            forgeStatus.innerText = 'Forge Status UNKNOWN';

            forgeStatusText.innerText = 'There was an error fetching the forge status. Please try again later.';

            // Afficher le bouton d'activation de la forge et le texte pour permettre une nouvelle tentative
            buyForgeButton.style.display = 'block';
            forgeUpgradeText.style.display = 'block';
        }
    }

    function checkElementsReady() {
        const forgeImage = document.getElementById('forgeimage');
        const forgeStatus = document.getElementById('forge-status');
        const forgeStatusText = document.getElementById('forge-status-text');
        const buyForgeButton = document.getElementById('buyforge-button');
        const forgeUpgradeText = document.getElementById('forgeupgrade');

        if (forgeImage && forgeStatus && forgeStatusText && buyForgeButton && forgeUpgradeText) {
            updateForgeStatusDisplay();
        } else {
            setTimeout(checkElementsReady, 100); // Réessayer après un autre délai
        }
    }

    // Point d'entrée appelé après le chargement de forge.html
    window.initForgePage = function () {
        checkElementsReady();
    };

    // Assurez-vous que la fonction est appelée après le chargement de forge.html
    document.addEventListener('forgePageLoaded', function () {
        if (typeof window.initForgePage === 'function') {
            window.initForgePage();
        }
    });
})();
