(function() {
    if (window.lorePageInitialized) return;
    window.lorePageInitialized = true;

    function getParameterByName(name, url = window.location.href) {
        name = name.replace(/[\[\]]/g, '\\$&');
        const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(url);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    }
    
    let currentPage = parseInt(getParameterByName('page')) || 1;
    let totalPages = 1;
    let groupedData = {};
    let validPages = [];

    window.initLorePage = function() {
        fetchLore();
    };

    async function fetchLore() {
        try {
            const response = await fetch('/mission/lore');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            processLoreData(data);
            displayPage(currentPage);
        } catch (error) {
            console.error('Error fetching lore:', error);
        }
    }

    function processLoreData(data) {
        const userAccount = localStorage.getItem("userAccount");

        groupedData = data.reduce((acc, lore) => {
            if (!acc[lore.page]) {
                acc[lore.page] = [];
            }
            acc[lore.page].push(lore);
            return acc;
        }, {});

        validPages = Object.keys(groupedData).filter(page => {
            return groupedData[page].some(lore => lore.valide === 1 || (lore.valide === 0 && userAccount === "gq2.a.c.wam"));
        }).map(Number).sort((a, b) => a - b);

        totalPages = validPages.length;
        createPaginationControls();
    }

    function createPaginationControls() {
        const userAccount = localStorage.getItem("userAccount");
        const paginationControls = document.getElementById('pagination-controls');
        paginationControls.innerHTML = ''; // Clear existing controls

        if (totalPages === 0) return; // No pages to display

        const firstButton = createPaginationButton('Index', () => changePage(validPages[0]));
        const prevButton = createPaginationButton('Previous', () => changePage(validPages[Math.max(0, validPages.indexOf(currentPage) - 1)]));

        paginationControls.appendChild(firstButton);
        paginationControls.appendChild(prevButton);

        // Case 1: If total pages are 7 or less, show all pages without dots
        if (totalPages <= 7) {
            validPages.forEach(page => {
                const pageButton = createPaginationButton(page, () => changePage(page));
                paginationControls.appendChild(pageButton);
            });
        } else {
            // Case 2: More than 7 pages, show the first 3, dots, and last 3 pages

            // Always show the first 3 pages
            for (let i = 0; i < Math.min(3, totalPages); i++) {
                const pageButton = createPaginationButton(validPages[i], () => changePage(validPages[i]));
                paginationControls.appendChild(pageButton);
            }

            // If currentPage > 4, add dots
            if (currentPage > 4) {
                const dots = document.createElement('span');
                dots.innerText = '...';
                dots.classList.add('pagination-dots');
                paginationControls.appendChild(dots);
            }

            // Show currentPage and the next two pages if there is space
            const start = Math.max(3, currentPage - 1);
            const end = Math.min(totalPages - 3, currentPage + 1);
            for (let i = start; i <= end; i++) {
                const pageButton = createPaginationButton(validPages[i], () => changePage(validPages[i]));
                paginationControls.appendChild(pageButton);
            }

            // Add dots before the last 3 pages if currentPage is far from the end
            if (currentPage + 3 < totalPages - 1) {
                const dots = document.createElement('span');
                dots.innerText = '...';
                dots.classList.add('pagination-dots');
                paginationControls.appendChild(dots);
            }

            // Always show the last 3 pages
            for (let i = Math.max(totalPages - 3, 0); i < totalPages; i++) {
                const pageButton = createPaginationButton(validPages[i], () => changePage(validPages[i]));
                paginationControls.appendChild(pageButton);
            }
        }

        const nextButton = createPaginationButton('Next', () => changePage(validPages[Math.min(totalPages - 1, validPages.indexOf(currentPage) + 1)]));
        const lastButton = createPaginationButton('Last', () => changePage(validPages[validPages.length - 1]));

        paginationControls.appendChild(nextButton);
        paginationControls.appendChild(lastButton);

        // Hide pagination if the user is not "gq2.a.c.wam" and there are no valid pages
        if (userAccount !== "gq2.a.c.wam" && validPages.length === 0) {
            paginationControls.style.display = 'none';
        } else {
            paginationControls.style.display = 'flex';
        }
    }

    function createPaginationButton(text, onClick) {
        const button = document.createElement('button');
        button.innerText = text;
        button.classList.add('pagination-btn', 'm-1');
        button.style.backgroundColor = 'transparent';
        button.addEventListener('click', onClick);
        return button;
    }

    window.changePage = function(page) {
        if (!validPages.includes(page)) return;
        currentPage = page;
        displayPage(currentPage);
    };

    function displayPage(page) {
        const loreCenter = document.getElementById('lore-center');
        loreCenter.innerHTML = ''; // Clear existing content

        if (groupedData[page]) {
            groupedData[page].sort((a, b) => a.id - b.id).forEach(lore => {
                const userAccount = localStorage.getItem("userAccount");
                if (lore.valide === 1 || (lore.valide === 0 && userAccount === "gq2.a.c.wam")) {
                    const loreDiv = document.createElement('div');
                    loreDiv.classList.add('lore-page'); // Add the class here
                    loreDiv.innerHTML = lore.lore_html;
                    loreCenter.appendChild(loreDiv);
                }
            });
        }
    }
    document.addEventListener('lorePageLoaded', initLorePage);
})();

function displayMonstreContent(content) {
    const monstreCenter = document.getElementById('monstre-center');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;

    // Attacher les événements pour les boutons "View More"
    const buttons = tempDiv.querySelectorAll('.view-more-btn');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            showMore(this);
        });
    });

    monstreCenter.appendChild(tempDiv);
}


function showMore(button) {
    let moreContent = button.parentElement.nextElementSibling;
    while (moreContent && !moreContent.classList.contains('more-content')) {
        moreContent = moreContent.nextElementSibling;
    }

    if (moreContent && moreContent.classList.contains('more-content')) {
        if (moreContent.style.display === "none" || moreContent.style.display === "") {
            moreContent.style.display = "flex";

        } else {
            moreContent.style.display = "none";
        }
    } else {
        console.error('Element more-content not found or misconfigured.');
    }
}