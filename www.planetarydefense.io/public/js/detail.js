
if (typeof window.ITEMS_PER_PAGE === 'undefined') {
    window.ITEMS_PER_PAGE = 9; // Number of cards per page
}

function fetchDataDetail() {
    const userAccount = localStorage.getItem("userAccount");

    if (!userAccount) {
        console.error("User account not found in localStorage");
        return;
    }

    fetch(`/mission/user-templates?userAccount=${userAccount}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            const templates = data.data;
            if (!templates || templates.length === 0) {
                return;
            }

            const templateIds = templates.flatMap(template => {
                return ['crews', 'faces', 'arms', 'lands'].flatMap(key => {
                    const items = JSON.parse(template[key] || '{}');
                    return Object.keys(items);
                });
            }).filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates

            if (templateIds.length === 0) {
                return;
            }

            return fetch(`/mission/template-details?templateIds=${templateIds.join(',')}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok ' + response.statusText);
                    }
                    return response.json();
                })
                .then(data => {
                    displayTemplates(data.data, templates[0]);
                    displayTotals(data.data, templates[0]);
                });
        })
        .catch(error => console.error('Error:', error));
}

function calculateStats(detail, quantity, category) {
    const rarityBonuses = {
        'Mythical': 50,
        'Legendary': 25,
        'Epic': 7,
        'Rare': 3,
        'Common': 1,
        'Abundant': (category === 'faces') ? 0 : 0
    };

    const landSlots = {
        'Legendary': 125,
        'Epic': 35,
        'Rare': 15,
        'Common': 5
    };

    const shineBonuses = {
        'Stone': 0,
        'Gold': 3,
        'Stardust': 5,
        'Antimatter': 7,
        'XDimension': 9
    };

    const faceShineBonus = [
        ["Common", [
            { "Gold": 10 },
            { "Stardust": 15 }
        ]],
        ["Rare", [
            { "Gold": 20 },
            { "Stardust": 30 },
            { "Antimatter": 40 },
            { "XDimension": 50 }
        ]],
        ["Epic", [
            { "Gold": 40 },
            { "Stardust": 60 },
            { "Antimatter": 80 },
            { "XDimension": 100 }
        ]],
        ["Legendary", [
            { "Gold": 80 },
            { "Stardust": 120 },
            { "Antimatter": 160 },
            { "XDimension": 200 }
        ]]
    ];

    let attackBonus = rarityBonuses[detail.rarity] || 0;
    let defenseBonus = rarityBonuses[detail.rarity] || 0;
    let totalAttack = detail.attack;
    let totalDefense = detail.defense;
    let totalMoveCost = detail.movecost;
    let slots = (category === 'lands') ? (landSlots[detail.rarity] || 0) : (rarityBonuses[detail.rarity] || 0);
    let shineBonus = (category === 'crews' || category === 'arms' || category === 'faces') ? shineBonuses[detail.shine] || 0 : 0;
    let moveCostReduction = 0;
    let totalTime = 0;
    let perCardTime = 0;

    if (category === 'faces') {
        const shineBonusData = faceShineBonus.find(([rarity]) => rarity === detail.rarity);
        if (shineBonusData) {
            const bonus = shineBonusData[1].find(b => b[detail.shine]);
            if (bonus) {
                moveCostReduction = bonus[detail.shine] * quantity;
            }
        }
    }

    if (detail.rarity === 'Abundant' && (category === 'crews' || category === 'arms')) {
        totalAttack = 1;
        totalDefense = 1;
    } else {
        totalAttack += attackBonus;
        totalDefense += defenseBonus;
    }

    if (category === 'crews' || category === 'arms') {
        if (shineBonus > 0) {
            totalAttack = Math.floor(totalAttack * shineBonus);
            totalDefense = Math.floor(totalDefense * shineBonus);
        }
        if (category === 'crews') {
            totalTime = 10 * totalMoveCost * quantity; // Base attack time without reduction
            perCardTime = 10 * totalMoveCost;
        }
    } else if (category === 'faces') {
        if (shineBonus > 0) {
            slots = Math.floor(slots * shineBonus);
        } else {
            // Si le shineBonus est 0, on garde les valeurs de base
            slots = slots;
        }
        totalAttack = 0;
        totalDefense = 0;
        totalMoveCost = 0;
    } else if (category === 'lands') {
        totalAttack = 0;
        totalDefense = 0;
        totalMoveCost = 0;
    }

    return {
        totalAttack: totalAttack * quantity,
        totalDefense: totalDefense * quantity,
        totalMoveCost: totalMoveCost * quantity,
        slots: slots * quantity,
        moveCostReduction,
        totalTime,
        perCardTime,
        perCard: {
            attack: totalAttack,
            defense: totalDefense,
            moveCost: totalMoveCost,
            shine: detail.shine,
            shineBonus,
            rarity: detail.rarity,
            rarityBonus: attackBonus,
            slots: slots
        },
        totalRarityBonus: attackBonus * quantity
    };
}
function displayTemplates(templateDetails, userTemplates) {
    const categories = ['crews', 'faces', 'arms', 'lands'];

    categories.forEach(category => {
        const container = document.getElementById(category);
        if (!container) return;

        container.innerHTML = '';

        const items = JSON.parse(userTemplates[category] || '{}');
        if (Object.keys(items).length === 0) {
            container.innerHTML = `<p>You have no ${category}</p>`;
            return;
        }

        const cards = Object.keys(items).map(templateId => {
            const detail = templateDetails.find(t => t.template_id == templateId);
            if (detail) {
                const quantity = items[templateId];
                const stats = calculateStats(detail, quantity, category);
                let statsHtml = '';

                if (category === 'crews') {
                    statsHtml = `
                        <p><img class="image-stat-detail" src="../images/Attack.png" alt="logo attaque">Attack: ${stats.perCard.attack} (Total: ${stats.totalAttack})</p>
                        <p><img class="image-stat-detail" src="../images/Defense.png" alt="logo defense">Defense: ${stats.perCard.defense} (Total: ${stats.totalDefense})</p>
                        <p><img class="image-stat-detail" src="../images/Move.png" alt="logo move">Move Cost: ${stats.perCard.moveCost} (Total: ${stats.totalMoveCost})</p>
                        <p>Rarity: ${stats.perCard.rarity} (+${stats.perCard.rarityBonus} per card, Total: +${stats.totalRarityBonus})</p>
                        <p>Shine: ${stats.perCard.shine} (*${stats.perCard.shineBonus})</p>
                        <p>Attack Time per Card: ${Math.floor(stats.perCardTime / 3600)}h ${Math.floor((stats.perCardTime % 3600) / 60)}m ${stats.perCardTime % 60}s</p>
                        <p>Total Attack Time: ${Math.floor(stats.totalTime / 3600)}h ${Math.floor((stats.totalTime % 3600) / 60)}m ${stats.totalTime % 60}s</p>
                    `;
                } else if (category === 'faces') {
                    statsHtml = `
                        <p>Rarity: ${stats.perCard.rarity} (+${stats.perCard.rarityBonus} per card)</p>
                        <p>Shine: ${stats.perCard.shine} (*${stats.perCard.shineBonus})</p>
                        <p><img class="image-stat-detail" src="../images/crew.png" alt="logo crew">Slots: ${stats.perCard.slots} (Total: ${stats.slots})</p>
                        <p>Move Cost Reduction per Card: ${stats.moveCostReduction / quantity} (Total: ${stats.moveCostReduction})</p>
                    `;
                } else if (category === 'arms') {
                    statsHtml = `
                        <p><img class="image-stat-detail" src="../images/Attack.png" alt="logo attaque">Attack: ${stats.perCard.attack} (Total: ${stats.totalAttack})</p>
                        <p><img class="image-stat-detail" src="../images/Defense.png" alt="logo defense">Defense: ${stats.perCard.defense} (Total: ${stats.totalDefense})</p>
                        <p>Rarity: ${stats.perCard.rarity} (+${stats.perCard.rarityBonus} per card, Total: +${stats.totalRarityBonus})</p>
                        <p>Shine: ${stats.perCard.shine} (*${stats.perCard.shineBonus})</p>
                    `;
                } else if (category === 'lands') {
                    statsHtml = `
                        <p><img class="image-stat-detail" src="../images/crew.png" alt="logo crew">Slots: ${stats.perCard.slots} (Total: ${stats.slots})</p>
                    `;
                }

                return `
                    <div class="col-4">
                        <div class="template-card">
                            <div class="template-info">
                                <p>${detail.name} - x${quantity}</p>
                            </div>
                            <div class="template-img">
                                <img src="https://ipfs.alienworlds.io/ipfs/${detail.img}" alt="${detail.name}" class="img-fluid-detail">
                            </div>
                            <div class="template-stats lato">
                                ${statsHtml}
                            </div>
                        </div>
                    </div>
                `;
            }
            return '';
        }).join('');

        const pages = Math.ceil(Object.keys(items).length / window.ITEMS_PER_PAGE);
        let paginationHtml = '';

        for (let i = 0; i < pages; i++) {
            paginationHtml += `<button class="btn btn-secondary m-2 pagination-btn" data-page="${i}">${i + 1}</button>`;
        }

        container.innerHTML = `
            <div class="cards-container d-flex flex-wrap">${cards}</div>
            <div class="pagination-container d-flex justify-content-center">${paginationHtml}</div>
        `;

        showPage(container, 0);

        container.querySelectorAll('.pagination-btn').forEach(button => {
            button.addEventListener('click', function() {
                const page = parseInt(this.getAttribute('data-page'));
                showPage(container, page);
            });
        });
    });

    attachToggleEvents();
}

function showPage(container, page) {
    const start = page * window.ITEMS_PER_PAGE;
    const end = start + window.ITEMS_PER_PAGE;
    const cards = container.querySelectorAll('.col-4');

    cards.forEach((card, index) => {
        card.style.display = (index >= start && index < end) ? 'block' : 'none';
    });
}

function displayTotals(templateDetails, userTemplates) {
    const totals = {
        crews: {
            attack: 0,
            defense: 0,
            moveCost: 0,
            attackTime: 0,
            shine: {},
            rarity: {},
            moveCostReduction: 0
        },
        faces: {
            slots: 0,
            rarity: {},
            shine: {},
            moveCostReduction: 0
        },
        arms: {
            attack: 0,
            defense: 0,
            shine: {},
            rarity: {}
        },
        lands: {
            slots: 0,
            rarity: {}
        }
    };

    const categories = ['crews', 'faces', 'arms', 'lands'];

    categories.forEach(category => {
        const items = JSON.parse(userTemplates[category] || '{}');
        Object.keys(items).forEach(templateId => {
            const detail = templateDetails.find(t => t.template_id == templateId);
            if (detail) {
                const quantity = items[templateId];
                const stats = calculateStats(detail, quantity, category);

                if (category === 'crews') {
                    totals.crews.attack += stats.totalAttack;
                    totals.crews.defense += stats.totalDefense;
                    totals.crews.moveCost += stats.totalMoveCost;
                    totals.crews.attackTime += stats.totalTime;
                    totals.crews.shine[detail.shine] = (totals.crews.shine[detail.shine] || 0) + quantity;
                    totals.crews.rarity[detail.rarity] = (totals.crews.rarity[detail.rarity] || 0) + quantity;
                } else if (category === 'faces') {
                    totals.faces.slots += stats.slots;
                    totals.faces.rarity[detail.rarity] = (totals.faces.rarity[detail.rarity] || 0) + quantity;
                    totals.faces.shine[detail.shine] = (totals.faces.shine[detail.shine] || 0) + quantity;
                    totals.faces.moveCostReduction += stats.moveCostReduction;
                } else if (category === 'arms') {
                    totals.arms.attack += stats.totalAttack;
                    totals.arms.defense += stats.totalDefense;
                    totals.arms.shine[detail.shine] = (totals.arms.shine[detail.shine] || 0) + quantity;
                    totals.arms.rarity[detail.rarity] = (totals.arms.rarity[detail.rarity] || 0) + quantity;
                } else if (category === 'lands') {
                    totals.lands.slots += stats.slots;
                    totals.lands.rarity[detail.rarity] = (totals.lands.rarity[detail.rarity] || 0) + quantity;
                }
            }
        });
    });

    const baseAttackTime = totals.crews.moveCost * 10; // Temps sans réduction
    const reducedAttackTime = Math.max(0, baseAttackTime - (totals.faces.moveCostReduction * 10)); // Appliquer réduction

    const sectionContainer = document.getElementById('section');
    if (!sectionContainer) return;

    sectionContainer.innerHTML = `
        <div class="totals-container d-flex justify-content-center flex-wrap">
            <div class="card lato">
                <h3 class="category-heading ethno">Crews</h3>
                <ul>
                    <li>Total Defense: <span class="total-point">${totals.crews.defense}</span></li>
                    <li>Total Attack: <span class="total-point">${totals.crews.attack}</span></li>
                    <li>Total Move Cost: <span class="total-point">${totals.crews.moveCost}</span></li>
                    <li>Attack Time Cards: <span class="total-point">${Math.floor(baseAttackTime / 3600)}h ${Math.floor((baseAttackTime % 3600) / 60)}m ${baseAttackTime % 60}s</span></li>
                    <li>Move Cost Reduction: <span class="total-point">${Math.floor((totals.faces.moveCostReduction * 10) / 3600)}h ${Math.floor(((totals.faces.moveCostReduction * 10) % 3600) / 60)}m ${(totals.faces.moveCostReduction * 10) % 60}s</span></li>
                    <li>Total Attack Time: <span class="total-point">3 Hours + ${Math.floor(reducedAttackTime / 3600)}h ${Math.floor((reducedAttackTime % 3600) / 60)}m ${reducedAttackTime % 60}s</span></li>
                    <li>Total Rarity: <span class="total-point">${Object.entries(totals.crews.rarity).map(([rarity, total]) => `${rarity}: ${total}`).join(', ')}</span></li>
                    <li>Total Shine: <span class="total-point">${Object.entries(totals.crews.shine).map(([shine, total]) => `${shine}: ${total}`).join(', ')}</span></li>
                </ul>
            </div>
            <div class="card lato">
                <h3 class="category-heading ethno">Faces</h3>
                <ul>
                    <li>Total Slots: <span class="total-point">${totals.faces.slots}</span></li>
                    <li>Total Move Cost Reduction: <span class="total-point">${Math.floor((totals.faces.moveCostReduction * 10) / 3600)}h ${Math.floor(((totals.faces.moveCostReduction * 10) % 3600) / 60)}m ${(totals.faces.moveCostReduction * 10) % 60}s</span></li>
                    <li>Total Rarity: <span class="total-point">${Object.entries(totals.faces.rarity).map(([rarity, total]) => `${rarity}: ${total}`).join(', ')}</span></li>
                    <li>Total Shine: <span class="total-point">${Object.entries(totals.faces.shine).map(([shine, total]) => `${shine}: ${total}`).join(', ')}</span></li>
                </ul>
            </div>
            <div class="card lato">
                <h3 class="category-heading ethno">Arms</h3>
                <ul>
                    <li>Total Defense: <span class="total-point">${totals.arms.defense}</span></li>
                    <li>Total Attack: <span class="total-point">${totals.arms.attack}</span></li>
                    <li>Total Rarity: <span class="total-point">${Object.entries(totals.arms.rarity).map(([rarity, total]) => `${rarity}: ${total}`).join(', ')}</span></li>
                    <li>Total Shine: <span class="total-point">${Object.entries(totals.arms.shine).map(([shine, total]) => `${shine}: ${total}`).join(', ')}</span></li>
                </ul>
            </div>
            <div class="card lato">
                <h3 class="category-heading ethno">Lands</h3>
                <ul>
                    <li>Total Slots: <span class="total-point">${totals.lands.slots}</span></li>
                    <li>Total Rarity: <span class="total-point">${Object.entries(totals.lands.rarity).map(([rarity, total]) => `${rarity}: ${total}`).join(', ')}</span></li>
                </ul>
            </div>
        </div>
    `;
}



function attachToggleEvents() {
    document.querySelectorAll('.buttons-container button').forEach(button => {
        button.addEventListener('click', function() {
            const category = this.getAttribute('data-toggle');
            const containers = document.querySelectorAll('.templates-container');
            containers.forEach(container => {
                if (container.id === category) {
                    container.classList.toggle('d-none');
                } else {
                    container.classList.add('d-none');
                }
            });
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        fetchDataDetail();
    });
} else {
    fetchDataDetail();
}

window.addEventListener('load', function() {
    fetchDataDetail();
});
