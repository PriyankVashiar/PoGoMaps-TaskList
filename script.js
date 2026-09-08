let questList = {};
let pokedexMap = {}; // Maps Pokémon ID (string) to full Pokémon data object

// Item ID to Name Mapping
const ITEM_NAMES = {
    "1": "Poké Ball",
    "2": "Great Ball",
    "3": "Ultra Ball",
    "701": "Razz Berry",
    "705": "Pinap Berry",
    "706": "Golden Razz Berry",
    "708": "Silver Pinap Berry",
    "709": "Poffin",
    "1301": "Rare Candy",
    "1302": "Rare Candy XL"
};

async function init() {
    try {
        // Fetch Quest List and Pokedex concurrently
        const [questRes, pokedexRes] = await Promise.all([
            fetch('./JSON/Quest_List.json'),
            fetch('./JSON/pokedex.json')
        ]);

        const questData = await questRes.json();
        const pokedexData = await pokedexRes.json();

        questList = questData.categories || {};

        // Build quick-lookup map for Pokedex (key: string ID)
        pokedexData.forEach(pkmn => {
            pokedexMap[String(pkmn.id)] = pkmn;
        });
        
        renderCards();
    } catch (err) {
        alert('Error loading JSON files: ' + err.message);
    }
}

function createCheckboxDropdown(l1, l2, l3, conditions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-multiselect';

    // Select Box Display Button
    const selectBox = document.createElement('div');
    selectBox.className = 'select-box';
    selectBox.textContent = 'Select...';
    wrapper.appendChild(selectBox);

    // Checkboxes Container
    const container = document.createElement('div');
    container.className = 'checkboxes-container';

    // Prevent clicks inside container from bubbling up
    container.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    // Quick Actions: Select All / Clear All
    const actions = document.createElement('div');
    actions.className = 'multiselect-actions';
    
    const selectAll = document.createElement('span');
    selectAll.className = 'action-link';
    selectAll.textContent = 'Select All';
    
    const clearAll = document.createElement('span');
    clearAll.className = 'action-link';
    clearAll.textContent = 'Clear All';

    actions.appendChild(selectAll);
    actions.appendChild(clearAll);
    container.appendChild(actions);

    // Populate Checkbox Options
    const optionsToRender = (conditions && conditions.length > 0) ? conditions : ["No Conditions"];
    const checkboxes = [];

    optionsToRender.forEach(cond => {
        const label = document.createElement('label');
        label.className = 'checkbox-option';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = cond === "No Conditions" ? "" : cond;
        cb.dataset.l1 = l1;
        cb.dataset.l2 = l2;
        cb.dataset.l3 = l3;

        label.appendChild(cb);
        label.appendChild(document.createTextNode(cond));
        container.appendChild(label);
        checkboxes.push(cb);

        cb.addEventListener('change', updateBoxText);
    });

    wrapper.appendChild(container);

    // Toggle dropdown
    selectBox.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.checkboxes-container.show').forEach(el => {
            if (el !== container) el.classList.remove('show');
        });
        container.classList.toggle('show');
    });

    selectAll.addEventListener('click', (e) => {
        e.stopPropagation();
        checkboxes.forEach(cb => cb.checked = true);
        updateBoxText();
    });

    clearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        checkboxes.forEach(cb => cb.checked = false);
        updateBoxText();
    });

    function updateBoxText() {
        const checked = checkboxes.filter(cb => cb.checked);
        if (checked.length === 0) {
            selectBox.textContent = 'Select...';
        } else if (checked.length === 1) {
            selectBox.textContent = checked[0].value || 'No Conditions';
        } else {
            selectBox.textContent = `${checked.length} Selected`;
        }
    }

    return wrapper;
}

function renderCards() {
    const categories = ['2', '3', '7', '12'];

    categories.forEach(cat => {
        const container = document.getElementById(`card-${cat}`);
        if (!container || !questList[cat]) return;

        container.innerHTML = '';

        if (cat === '3') {
            // Stardust Card Layout
            const level2Obj = questList['3']['0'] || {};
            Object.keys(level2Obj).forEach(stardustAmount => {
                const conditions = level2Obj[stardustAmount] || [];
                
                const row = document.createElement('div');
                row.className = 'row-item';

                const label = document.createElement('span');
                label.className = 'row-label';
                label.textContent = stardustAmount;

                const customDropdown = createCheckboxDropdown('3', '0', stardustAmount, conditions);

                row.appendChild(label);
                row.appendChild(customDropdown);
                container.appendChild(row);
            });
        } else if (cat === '7' || cat === '12') {
            // Pokémon Encounters (7) & Mega Energy (12) Flat Row Layout
            const level2Obj = questList[cat] || {};
            
            Object.keys(level2Obj).forEach(pokemonId => {
                const pokemonData = pokedexMap[pokemonId];
                const pokemonName = pokemonData?.name?.english || `ID: ${pokemonId}`;
                const iconSrc = pokemonData?.image?.hires || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`;

                // Extract conditions from nested level 3 (amount is usually 1 for encounters, 10 for Mega Energy)
                const level3Obj = level2Obj[pokemonId] || {};
                const amountKey = Object.keys(level3Obj)[0] || (cat === '12' ? '10' : '1');
                const conditions = level3Obj[amountKey] || [];

                const row = document.createElement('div');
                row.className = 'row-item';

                // Label Wrapper with Pokémon Image Icon and Name
                const labelWrapper = document.createElement('div');
                labelWrapper.className = 'row-label-wrapper';

                const iconImg = document.createElement('img');
                iconImg.src = iconSrc;
                iconImg.alt = pokemonName;
                iconImg.className = 'encounter-icon';
                labelWrapper.appendChild(iconImg);

                const labelText = document.createElement('span');
                labelText.className = 'row-label';
                labelText.textContent = pokemonName;
                labelWrapper.appendChild(labelText);

                const customDropdown = createCheckboxDropdown(cat, pokemonId, amountKey, conditions);

                row.appendChild(labelWrapper);
                row.appendChild(customDropdown);
                container.appendChild(row);
            });
        } else {
            // Accordion Layout for Items (2)
            const level2Obj = questList[cat] || {};
            Object.keys(level2Obj).forEach(l2Id => {
                const level3Obj = level2Obj[l2Id] || {};
                
                const accBtn = document.createElement('button');
                accBtn.className = 'accordion';
                
                let displayName = `ID: ${l2Id}`;
                let iconFileName = "";

                if (cat === '2' && ITEM_NAMES[l2Id]) {
                    displayName = ITEM_NAMES[l2Id];
                    iconFileName = displayName.replace(/ /g, '_') + '.png';
                }

                const headerTitle = document.createElement('span');
                headerTitle.className = 'accordion-title';

                if (iconFileName) {
                    const iconImg = document.createElement('img');
                    iconImg.src = `assets/icons/${iconFileName}`;
                    iconImg.alt = displayName;
                    iconImg.className = 'accordion-icon';
                    headerTitle.appendChild(iconImg);
                }

                headerTitle.appendChild(document.createTextNode(displayName));
                accBtn.appendChild(headerTitle);

                const panel = document.createElement('div');
                panel.className = 'panel';

                let hasContent = false;
                Object.keys(level3Obj).forEach(l3Amount => {
                    const conditions = level3Obj[l3Amount] || [];

                    hasContent = true;
                    const row = document.createElement('div');
                    row.className = 'row-item';

                    const label = document.createElement('span');
                    label.className = 'row-label';
                    label.textContent = `Qty: ${l3Amount}`;

                    const customDropdown = createCheckboxDropdown(cat, l2Id, l3Amount, conditions);

                    row.appendChild(label);
                    row.appendChild(customDropdown);
                    panel.appendChild(row);
                });

                if (hasContent) {
                    accBtn.addEventListener('click', function() {
                        this.classList.toggle('active');
                        if (panel.style.maxHeight) {
                            panel.style.maxHeight = null;
                            panel.classList.remove('open-overflow');
                        } else {
                            panel.style.maxHeight = (panel.scrollHeight + 100) + "px";
                            setTimeout(() => {
                                if (this.classList.contains('active')) {
                                    panel.classList.add('open-overflow');
                                }
                            }, 250);
                        }
                    });

                    container.appendChild(accBtn);
                    container.appendChild(panel);
                }
            });
        }
    });
}

// Close open dropdowns when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.checkboxes-container.show').forEach(el => el.classList.remove('show'));
});

// --- Distance & 2-Opt Optimization Logic ---
function haversineDistance(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateTotalDistance(route) {
    let dist = 0;
    for (let i = 0; i < route.length - 1; i++) {
        dist += haversineDistance(route[i], route[i + 1]);
    }
    return dist;
}

function twoOptOptimize(points) {
    if (points.length <= 3) return points;
    let bestRoute = [...points];
    let bestDistance = calculateTotalDistance(bestRoute);
    let improved = true;

    while (improved) {
        improved = false;
        for (let i = 1; i < bestRoute.length - 2; i++) {
            for (let j = i + 1; j < bestRoute.length; j++) {
                if (j - i === 1) continue;
                const newRoute = bestRoute.slice(0, i).concat(
                    bestRoute.slice(i, j + 1).reverse(),
                    bestRoute.slice(j + 1)
                );
                const newDistance = calculateTotalDistance(newRoute);
                if (newDistance < bestDistance) {
                    bestRoute = newRoute;
                    bestDistance = newDistance;
                    improved = true;
                }
            }
        }
    }
    return bestRoute;
}

// --- GPX Generator ---
async function generateAndDownloadGPX() {
    const activeFilters = new Set();
    const checkedBoxes = document.querySelectorAll('.custom-multiselect input[type="checkbox"]:checked');

    checkedBoxes.forEach(cb => {
        const l1 = cb.dataset.l1;
        const l2 = cb.dataset.l2;
        const l3 = cb.dataset.l3;
        const cond = cb.value;
        activeFilters.add(`${l1},${l2},${l3},${cond}`);
    });

    if (activeFilters.size === 0) {
        alert('Please check at least one condition filter checkbox.');
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const questsPath = `./JSON/quests_${todayStr}.json`;

    try {
        const res = await fetch(questsPath);
        if (!res.ok) throw new Error(`Could not locate active file: ${questsPath}`);
        const data = await res.json();
        const quests = data.quests || [];

        const matchedCoords = [];
        quests.forEach(q => {
            const l1 = String(q.rewards_types || '').trim();
            const l2 = String(q.rewards_ids || '0').trim();
            const l3 = String(q.rewards_amounts || '0').trim();
            const cond = String(q.conditions_string || '').trim();
            const filterKey = `${l1},${l2},${l3},${cond}`;

            if (activeFilters.has(filterKey)) {
                matchedCoords.push({
                    lat: parseFloat(q.lat),
                    lng: parseFloat(q.lng),
                    name: q.name || 'Pokestop'
                });
            }
        });

        if (matchedCoords.length === 0) {
            alert('No matching pokestops found for active filters.');
            return;
        }

        const optimizedRoute = twoOptOptimize(matchedCoords);

        let gpxStr = `<?xml version="1.0" encoding="UTF-8"?>\n`;
        gpxStr += `<gpx version="1.1" creator="PoGo-Route-Optimizer">\n  <trk>\n    <name>Optimized Quests Route ${todayStr}</name>\n    <trkseg>\n`;
        optimizedRoute.forEach(pt => {
            gpxStr += `      <trkpt lat="${pt.lat}" lon="${pt.lng}">\n        <name>${pt.name}</name>\n      </trkpt>\n`;
        });
        gpxStr += `    </trkseg>\n  </trk>\n</gpx>`;

        const blob = new Blob([gpxStr], { type: 'application/gpx+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${todayStr}_sorted.gpx`;
        link.click();

    } catch (err) {
        alert('Error generating GPX: ' + err.message);
    }
}

window.onload = init;