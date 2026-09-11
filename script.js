// Application State
let questList = {};
let pokedexMap = {};
let timerInterval = null;

const CITY_CONFIGS = {
    "https://nycpokemap.com": { cityKey: "nyc", name: "New York", refreshUtcHour: 4, refreshUtcMinute: 18 },
    "https://vanpokemap.com": { cityKey: "vc", name: "Vancouver", refreshUtcHour: 7, refreshUtcMinute: 18 },
    "https://sgpokemap.com": { cityKey: "sg", name: "Singapore", refreshUtcHour: 16, refreshUtcMinute: 18 },
    "https://sydneypogomap.com": { cityKey: "syd", name: "Sydney", refreshUtcHour: 14, refreshUtcMinute: 18 },
    "https://londonpogomap.com": { cityKey: "uk", name: "London", refreshUtcHour: 0, refreshUtcMinute: 18 }
};

const ITEM_DETAILS = {
    "1": { name: "Poké Ball", file: "Poké_Ball.png" },
    "2": { name: "Great Ball", file: "Great_Ball.png" },
    "3": { name: "Ultra Ball", file: "Ultra_Ball.png" },
    "701": { name: "Razz Berry", file: "Razz_Berry.png" },
    "705": { name: "Pinap Berry", file: "Pinap_Berry.png" },
    "706": { name: "Golden Razz Berry", file: "Golden_Razz_Berry.png" },
    "708": { name: "Silver Pinap Berry", file: "Silver_Pinap_Berry.png" },
    "709": { name: "Poffin", file: "Poffin.png" },
    "1301": { name: "Rare Candy", file: "Rare_Candy.png" },
    "1302": { name: "Rare Candy XL", file: "Rare_Candy_XL.png" }
};

// Utility Helpers
const escapeXml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pad = (num) => String(num).padStart(2, '0');

function getSelectedCityConfig() {
    const select = document.getElementById('city-select');
    const url = select ? select.value : "https://nycpokemap.com";
    return {
        baseUrl: url,
        ...(CITY_CONFIGS[url] || CITY_CONFIGS["https://nycpokemap.com"])
    };
}

// Timer Functions
function updateRefreshCountdown() {
    const titleEl = document.querySelector('.main-title');
    if (!titleEl) return;

    const city = getSelectedCityConfig();
    const now = new Date();

    const target = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        city.refreshUtcHour ?? 0,
        city.refreshUtcMinute ?? 0,
        0
    ));

    if (now >= target) {
        target.setUTCDate(target.getUTCDate() + 1);
    }

    const diffMs = target - now;
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    let timerSpan = document.getElementById('refresh-timer');
    if (!timerSpan) {
        timerSpan = document.createElement('span');
        timerSpan.id = 'refresh-timer';
        titleEl.appendChild(timerSpan);
    }

    timerSpan.textContent = ` (Refreshes in ${pad(hours)}:${pad(minutes)} hours)`;
}

function startRefreshCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    updateRefreshCountdown();
    timerInterval = setInterval(updateRefreshCountdown, 10000);
}

function onCityChange() {
    updateRefreshCountdown();
}

// Core Initialization
async function init() {
    startRefreshCountdown();

    try {
        const cacheBuster = `?v=${Date.now()}`;
        const [questRes, pokedexRes] = await Promise.all([
            fetch(`./JSON/Quest_List.json${cacheBuster}`),
            fetch(`./JSON/pokedex.json${cacheBuster}`)
        ]);

        if (!questRes.ok || !pokedexRes.ok) {
            throw new Error("Failed to load JSON assets.");
        }

        const [questData, pokedexData] = await Promise.all([
            questRes.json(),
            pokedexRes.json()
        ]);

        questList = questData.categories || {};
        pokedexMap = Object.fromEntries(pokedexData.map(pkmn => [String(pkmn.id), pkmn]));

        renderCards();
    } catch (err) {
        alert(`Error loading configuration files: ${err.message}`);
    }
}

// UI Dropdown Builder
function createCheckboxDropdown(l1, l2, l3, conditions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-multiselect';

    const selectBox = document.createElement('div');
    selectBox.className = 'select-box';
    selectBox.textContent = 'Select...';

    const container = document.createElement('div');
    container.className = 'checkboxes-container';
    container.addEventListener('click', (e) => e.stopPropagation());

    const optionsToRender = (conditions && conditions.length > 0) ? conditions : ["No Conditions"];
    const checkboxes = [];

    const updateBoxText = () => {
        const checked = checkboxes.filter(cb => cb.checked);
        if (checked.length === 0) {
            selectBox.textContent = 'Select...';
        } else if (checked.length === 1) {
            selectBox.textContent = checked[0].value || 'No Conditions';
        } else {
            selectBox.textContent = `${checked.length} Selected`;
        }
    };

    optionsToRender.forEach(cond => {
        const label = document.createElement('label');
        label.className = 'checkbox-option';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = cond === "No Conditions" ? "" : cond;
        cb.dataset.l1 = l1;
        cb.dataset.l2 = l2;
        cb.dataset.l3 = l3;
        cb.addEventListener('change', updateBoxText);

        label.appendChild(cb);
        label.appendChild(document.createTextNode(cond));
        container.appendChild(label);
        checkboxes.push(cb);
    });

    selectBox.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShowing = container.classList.contains('show');

        document.querySelectorAll('.checkboxes-container.show').forEach(el => {
            if (el !== container) el.classList.remove('show', 'drop-up');
        });

        if (!isShowing) {
            container.classList.add('show');
            const cardBody = wrapper.closest('.card-body');
            if (cardBody) {
                const cardRect = cardBody.getBoundingClientRect();
                const boxRect = selectBox.getBoundingClientRect();
                if ((cardRect.bottom - boxRect.bottom) < 200) {
                    container.classList.add('drop-up');
                } else {
                    container.classList.remove('drop-up');
                }
            }
        } else {
            container.classList.remove('show', 'drop-up');
        }
    });

    wrapper.appendChild(selectBox);
    wrapper.appendChild(container);
    return wrapper;
}

// Dynamic Card Rendering
function renderCards() {
    const categories = ['2', '3', '7', '12'];

    categories.forEach(cat => {
        const container = document.getElementById(`card-${cat}`);
        if (!container || !questList[cat]) return;

        container.replaceChildren();
        const fragment = document.createDocumentFragment();

        if (cat === '3') {
            const level2Obj = questList['3']['0'] || {};
            Object.entries(level2Obj).forEach(([stardustAmount, conditions]) => {
                const row = document.createElement('div');
                row.className = 'row-item';

                const label = document.createElement('span');
                label.className = 'row-label';
                label.textContent = stardustAmount;

                row.appendChild(label);
                row.appendChild(createCheckboxDropdown('3', '0', stardustAmount, conditions));
                fragment.appendChild(row);
            });
        } else if (cat === '7' || cat === '12') {
            const level2Obj = questList[cat] || {};

            Object.entries(level2Obj).forEach(([pokemonId, level3Obj]) => {
                const pokemonData = pokedexMap[pokemonId];
                const pokemonName = pokemonData?.name?.english || `ID: ${pokemonId}`;
                const amountKey = Object.keys(level3Obj)[0] || (cat === '12' ? '10' : '1');
                const conditions = level3Obj[amountKey] || [];

                const row = document.createElement('div');
                row.className = 'row-item';

                const labelWrapper = document.createElement('div');
                labelWrapper.className = 'row-label-wrapper';

                const iconImg = document.createElement('img');
                iconImg.src = `./assets/pokeapi-official-artwork/${pokemonId}.png`;
                iconImg.alt = pokemonName;
                iconImg.className = 'encounter-icon';
                iconImg.onerror = () => { iconImg.style.display = 'none'; };

                const labelText = document.createElement('span');
                labelText.className = 'row-label';
                labelText.textContent = pokemonName;

                labelWrapper.appendChild(iconImg);
                labelWrapper.appendChild(labelText);

                row.appendChild(labelWrapper);
                row.appendChild(createCheckboxDropdown(cat, pokemonId, amountKey, conditions));
                fragment.appendChild(row);
            });
        } else {
            const level2Obj = questList[cat] || {};

            Object.entries(level2Obj).forEach(([l2Id, level3Obj]) => {
                const accBtn = document.createElement('button');
                accBtn.className = 'accordion';

                let displayName = `ID: ${l2Id}`;
                let iconUrl = "";

                if (cat === '2' && ITEM_DETAILS[l2Id]) {
                    displayName = ITEM_DETAILS[l2Id].name;
                    iconUrl = `./assets/icons/${ITEM_DETAILS[l2Id].file}`;
                }

                const headerTitle = document.createElement('span');
                headerTitle.className = 'accordion-title';

                if (iconUrl) {
                    const iconImg = document.createElement('img');
                    iconImg.src = iconUrl;
                    iconImg.alt = displayName;
                    iconImg.className = 'accordion-icon';
                    iconImg.onerror = () => { iconImg.style.display = 'none'; };
                    headerTitle.appendChild(iconImg);
                }

                headerTitle.appendChild(document.createTextNode(displayName));
                accBtn.appendChild(headerTitle);

                const panel = document.createElement('div');
                panel.className = 'panel';

                let hasContent = false;
                Object.entries(level3Obj).forEach(([l3Amount, conditions]) => {
                    hasContent = true;
                    const row = document.createElement('div');
                    row.className = 'row-item';

                    const label = document.createElement('span');
                    label.className = 'row-label';
                    label.textContent = `Qty: ${l3Amount}`;

                    row.appendChild(label);
                    row.appendChild(createCheckboxDropdown(cat, l2Id, l3Amount, conditions));
                    panel.appendChild(row);
                });

                if (hasContent) {
                    accBtn.addEventListener('click', function () {
                        this.classList.toggle('active');
                        if (panel.style.maxHeight) {
                            panel.style.maxHeight = null;
                            panel.classList.remove('open-overflow');
                        } else {
                            panel.style.maxHeight = `${panel.scrollHeight + 100}px`;
                            setTimeout(() => {
                                if (this.classList.contains('active')) {
                                    panel.classList.add('open-overflow');
                                }
                            }, 250);
                        }
                    });

                    fragment.appendChild(accBtn);
                    fragment.appendChild(panel);
                }
            });
        }

        container.appendChild(fragment);
    });
}

// Global Event Listeners
document.addEventListener('click', () => {
    document.querySelectorAll('.checkboxes-container.show').forEach(el => el.classList.remove('show', 'drop-up'));
});

// Location Parser
function getCustomStartLocation() {
    const inputEl = document.getElementById('currentLocationInput') || document.getElementById('start-location');
    const rawInput = inputEl?.value?.trim();
    if (!rawInput) return null;

    const parts = rawInput.split(',').map(str => str.trim());
    if (parts.length !== 2) {
        alert("Please enter coordinates in 'lat, lon' format (e.g., 40.7128, -74.0060).");
        return false;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        alert("Please enter valid Latitude (-90 to 90) and Longitude (-180 to 180) values.");
        return false;
    }

    return { lat, lng };
}

// Unified GPX Generation and Route Optimization Handler
async function handleRouteGeneration() {
    const checkedBoxes = document.querySelectorAll('.custom-multiselect input[type="checkbox"]:checked');
    if (checkedBoxes.length === 0) {
        alert('Please check at least one condition filter checkbox.');
        return;
    }

    const customStartPoint = getCustomStartLocation();
    if (customStartPoint === false) return; // Validation error already alerted

    const isCustom = !!customStartPoint;
    const activeFilters = new Set(
        Array.from(checkedBoxes).map(cb => `${cb.dataset.l1},${cb.dataset.l2},${cb.dataset.l3},${cb.value}`)
    );

    const city = getSelectedCityConfig();
    const btnTarget = document.getElementById('generateRouteBtn') || document.querySelector('.btn-primary');

    if (btnTarget) {
        btnTarget.textContent = `Fetching ${city.name} Quests...`;
        btnTarget.disabled = true;
    }

    const resetButton = () => {
        if (btnTarget) {
            btnTarget.textContent = 'Generate Route';
            btnTarget.disabled = false;
        }
    };

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const res = await fetch(`./JSON/${city.cityKey}_quests.json?v=${Date.now()}`);
        
        if (!res.ok) {
            throw new Error(`Could not load quest data for ${city.name} (${city.cityKey}_quests.json).`);
        }

        const data = await res.json();
        const quests = data.quests || [];
        const matchedCoords = [];

        if (isCustom) {
            matchedCoords.push({
                lat: customStartPoint.lat,
                lng: customStartPoint.lng,
                name: 'Start Location'
            });
        }

        for (let i = 0; i < quests.length; i++) {
            const q = quests[i];
            const key = `${String(q.rewards_types || '').trim()},${String(q.rewards_ids || '0').trim()},${String(q.rewards_amounts || '0').trim()},${String(q.conditions_string || '').trim()}`;

            if (activeFilters.has(key)) {
                matchedCoords.push({
                    lat: parseFloat(q.lat),
                    lng: parseFloat(q.lng),
                    name: escapeXml(q.name || 'Pokestop')
                });
            }
        }

        const minRequired = isCustom ? 2 : 1;
        if (matchedCoords.length < minRequired) {
            alert(`No matching Pokéstops found for active filters in ${city.name}.`);
            resetButton();
            return;
        }

        if (btnTarget) {
            btnTarget.textContent = 'Optimizing Route...';
        }

        const worker = new Worker(`./worker.js?v=${Date.now()}`);

        worker.postMessage({
            points: matchedCoords,
            city: city.cityKey,
            isCustom: isCustom,
            timeLimitMs: 8000
        });

        worker.onmessage = (e) => {
            try {
                if (e.data && e.data.error) {
                    alert(`Worker error: ${e.data.error}`);
                    return;
                }

                const optimizedRoute = e.data;
                if (!Array.isArray(optimizedRoute) || optimizedRoute.length === 0) {
                    alert(`No clusters or pokéstops found within ${city.name} geofence for selected filters.`);
                    return;
                }

                const gpxParts = [
                    '<?xml version="1.0" encoding="UTF-8"?>\n',
                    '<gpx version="1.1" creator="Priyank Vashiar">\n',
                    '  <rte>\n',
                    `    <name>${city.name} Quest Route ${todayStr}</name>\n`
                ];

                for (let i = 0; i < optimizedRoute.length; i++) {
                    const pt = optimizedRoute[i];
                    gpxParts.push(
                        `    <rtept lat="${pt.lat}" lon="${pt.lng}">\n`,
                        `      <name>${i + 1}. ${pt.name}</name>\n`,
                        `    </rtept>\n`
                    );
                }

                gpxParts.push('  </rte>\n</gpx>');

                const blob = new Blob([gpxParts.join('')], { type: 'application/gpx+xml' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${todayStr}_${city.cityKey}_route.gpx`;
                link.click();
            } finally {
                resetButton();
                worker.terminate();
            }
        };

        worker.onerror = (err) => {
            alert(`Worker error: ${err.message}`);
            resetButton();
            worker.terminate();
        };

    } catch (err) {
        alert(`Error generating GPX: ${err.message}`);
        resetButton();
    }
}

// Global Scope Bindings
window.onCityChange = onCityChange;
window.handleRouteGeneration = handleRouteGeneration;
window.generateAndDownloadGPX = handleRouteGeneration;
window.onload = init;