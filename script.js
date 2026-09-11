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

function getSelectedCityConfig() {
    const select = document.getElementById('city-select');
    const url = select ? select.value : "https://nycpokemap.com";
    return {
        baseUrl: url,
        ...(CITY_CONFIGS[url] || CITY_CONFIGS["https://nycpokemap.com"])
    };
}

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

    const pad = (num) => String(num).padStart(2, '0');
    const timeText = ` (Refreshes in ${pad(hours)}:${pad(minutes)} hours)`;

    let timerSpan = document.getElementById('refresh-timer');
    if (!timerSpan) {
        timerSpan = document.createElement('span');
        timerSpan.id = 'refresh-timer';
        titleEl.appendChild(timerSpan);
    }

    timerSpan.textContent = timeText;
}

function startRefreshCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    updateRefreshCountdown();
    timerInterval = setInterval(updateRefreshCountdown, 10000);
}

window.onCityChange = function onCityChange() {
    const city = getSelectedCityConfig();
    console.log(`City switched to: ${city.name} (${city.baseUrl})`);
    updateRefreshCountdown();
};

async function init() {
    startRefreshCountdown();

    try {
        const [questRes, pokedexRes] = await Promise.all([
            fetch('./JSON/Quest_List.json?v=' + Date.now()),
            fetch('./JSON/pokedex.json?v=' + Date.now())
        ]);

        const questData = await questRes.json();
        const pokedexData = await pokedexRes.json();

        questList = questData.categories || {};

        pokedexData.forEach(pkmn => {
            pokedexMap[String(pkmn.id)] = pkmn;
        });
        
        renderCards();
    } catch (err) {
        alert('Error loading JSON configuration files: ' + err.message);
    }
}

function createCheckboxDropdown(l1, l2, l3, conditions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-multiselect';

    const selectBox = document.createElement('div');
    selectBox.className = 'select-box';
    selectBox.textContent = 'Select...';
    wrapper.appendChild(selectBox);

    const container = document.createElement('div');
    container.className = 'checkboxes-container';

    container.addEventListener('click', (e) => e.stopPropagation());

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
        const fragment = document.createDocumentFragment();

        if (cat === '3') {
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
                fragment.appendChild(row);
            });
        } else if (cat === '7' || cat === '12') {
            const level2Obj = questList[cat] || {};
            
            Object.keys(level2Obj).forEach(pokemonId => {
                const pokemonData = pokedexMap[pokemonId];
                const pokemonName = pokemonData?.name?.english || `ID: ${pokemonId}`;
                const iconSrc = `./assets/pokeapi-official-artwork/${pokemonId}.png`;

                const level3Obj = level2Obj[pokemonId] || {};
                const amountKey = Object.keys(level3Obj)[0] || (cat === '12' ? '10' : '1');
                const conditions = level3Obj[amountKey] || [];

                const row = document.createElement('div');
                row.className = 'row-item';

                const labelWrapper = document.createElement('div');
                labelWrapper.className = 'row-label-wrapper';

                const iconImg = document.createElement('img');
                iconImg.src = iconSrc;
                iconImg.alt = pokemonName;
                iconImg.className = 'encounter-icon';
                iconImg.onerror = function() { this.style.display = 'none'; };
                
                labelWrapper.appendChild(iconImg);

                const labelText = document.createElement('span');
                labelText.className = 'row-label';
                labelText.textContent = pokemonName;
                labelWrapper.appendChild(labelText);

                const customDropdown = createCheckboxDropdown(cat, pokemonId, amountKey, conditions);

                row.appendChild(labelWrapper);
                row.appendChild(customDropdown);
                fragment.appendChild(row);
            });
        } else {
            const level2Obj = questList[cat] || {};
            Object.keys(level2Obj).forEach(l2Id => {
                const level3Obj = level2Obj[l2Id] || {};
                
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
                    iconImg.onerror = function() { this.style.display = 'none'; };
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

                    fragment.appendChild(accBtn);
                    fragment.appendChild(panel);
                }
            });
        }
        
        container.appendChild(fragment);
    });
}

document.addEventListener('click', () => {
    document.querySelectorAll('.checkboxes-container.show').forEach(el => el.classList.remove('show', 'drop-up'));
});

async function generateAndDownloadGPX() {
    const activeFilters = new Set();
    const checkedBoxes = document.querySelectorAll('.custom-multiselect input[type="checkbox"]:checked');

    checkedBoxes.forEach(cb => {
        activeFilters.add(`${cb.dataset.l1},${cb.dataset.l2},${cb.dataset.l3},${cb.value}`);
    });

    if (activeFilters.size === 0) {
        alert('Please check at least one condition filter checkbox.');
        return;
    }

    const city = getSelectedCityConfig();
    const btn = document.querySelector('.btn-generate');
    
    btn.textContent = `Fetching ${city.name} Quest Data...`;
    btn.disabled = true;

    try {
        const todayStr = new Date().toISOString().split('T')[0];
        const questJsonUrl = `./JSON/${city.cityKey}_quests.json?v=` + Date.now();
        
        const res = await fetch(questJsonUrl);
        if (!res.ok) {
            throw new Error(`Could not load quest data for ${city.name} (${city.cityKey}_quests.json).`);
        }
        
        const data = await res.json();
        const quests = data.quests || [];

        const matchedCoords = [];
        for (let i = 0; i < quests.length; i++) {
            const q = quests[i];
            const l1 = String(q.rewards_types || '').trim();
            const l2 = String(q.rewards_ids || '0').trim();
            const l3 = String(q.rewards_amounts || '0').trim();
            const cond = String(q.conditions_string || '').trim();

            if (activeFilters.has(`${l1},${l2},${l3},${cond}`)) {
                matchedCoords.push({
                    lat: parseFloat(q.lat),
                    lng: parseFloat(q.lng),
                    name: (q.name || 'Pokestop').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                });
            }
        }

        if (matchedCoords.length === 0) {
            alert(`No matching Pokéstops found for active filters in ${city.name}.`);
            btn.textContent = 'Generate & Download GPX';
            btn.disabled = false;
            return;
        }

        btn.textContent = `Filtering ${city.name} Clusters & Optimizing...`;

        const worker = new Worker('./worker.js?v=' + Date.now());
        
        worker.postMessage({
            points: matchedCoords,
            city: city.cityKey
        });

        worker.onmessage = function(e) {
            if (e.data && e.data.error) {
                alert(`Worker error: ${e.data.error}`);
                btn.textContent = 'Generate & Download GPX';
                btn.disabled = false;
                worker.terminate();
                return;
            }

            const optimizedRoute = e.data;

            if (!Array.isArray(optimizedRoute) || optimizedRoute.length === 0) {
                alert(`No clusters or pokéstops found within ${city.name} geofence for selected filters.`);
                btn.textContent = 'Generate & Download GPX';
                btn.disabled = false;
                worker.terminate();
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

            btn.textContent = 'Generate & Download GPX';
            btn.disabled = false;
            worker.terminate();
        };

        worker.onerror = function(err) {
            alert('Worker error: ' + err.message);
            btn.textContent = 'Generate & Download GPX';
            btn.disabled = false;
            worker.terminate();
        };

    } catch (err) {
        alert('Error generating GPX: ' + err.message);
        btn.textContent = 'Generate & Download GPX';
        btn.disabled = false;
    }
}

window.generateAndDownloadGPX = generateAndDownloadGPX;
window.onload = init;