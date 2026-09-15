// Application State
let questList = {};
let pokedexMap = {};
let timerInterval = null;

const DONATE_URL = 'https://github.com/PriyankVashiar/PoGoMaps-TaskList';

const POKEMON_ARTWORK_CDN =
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork';

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

const escapeXml = (str) => String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const pad = (num) => String(num).padStart(2, '0');

function getPokemonArtworkUrl(pokemonId) {
    const raw = String(pokemonId || '').trim();
    const match = raw.match(/^(\d+)/);
    const id = match ? match[1] : raw;
    if (!id) return '';
    return `${POKEMON_ARTWORK_CDN}/${id}.png`;
}

function getSelectedCityConfig() {
    const select = document.getElementById('city-select');
    const url = select ? select.value : "https://nycpokemap.com";
    return {
        baseUrl: url,
        ...(CITY_CONFIGS[url] || CITY_CONFIGS["https://nycpokemap.com"])
    };
}

function setStatus(message, type = 'info', detail = '') {
    const el = document.getElementById('status-bar');
    if (!el) return;
    if (!message) {
        el.hidden = true;
        el.textContent = '';
        el.className = 'status-bar';
        return;
    }
    el.hidden = false;
    el.className = 'status-bar' + (type === 'error' ? ' status-error' : type === 'ok' ? ' status-ok' : '');
    el.replaceChildren();
    el.appendChild(document.createTextNode(message));
    if (detail) {
        const d = document.createElement('span');
        d.className = 'status-detail';
        d.textContent = detail;
        el.appendChild(d);
    }
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
    setStatus('');
}

function handleDonate() {
    window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
}

// --- WI-09: Filter presets (localStorage) ---
const PRESET_STORAGE_KEY = 'pogo_filter_presets_v1';

function filterKeyFromCheckbox(cb) {
    return `${cb.dataset.l1},${cb.dataset.l2},${cb.dataset.l3},${cb.value}`;
}

function loadPresetStore() {
    try {
        const raw = localStorage.getItem(PRESET_STORAGE_KEY);
        if (!raw) return {};
        const data = JSON.parse(raw);
        return data && typeof data === 'object' ? data : {};
    } catch (_) {
        return {};
    }
}

function savePresetStore(store) {
    localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(store));
}

function getCheckedFilterKeys() {
    return Array.from(
        document.querySelectorAll('.custom-multiselect input[type="checkbox"]:checked')
    ).map(filterKeyFromCheckbox);
}

function clearAllFilters() {
    document.querySelectorAll('.custom-multiselect input[type="checkbox"]').forEach(cb => {
        if (cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function applyFilterKeys(keys) {
    const want = new Set(keys || []);
    document.querySelectorAll('.custom-multiselect input[type="checkbox"]').forEach(cb => {
        const on = want.has(filterKeyFromCheckbox(cb));
        if (cb.checked !== on) {
            cb.checked = on;
            cb.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

function refreshPresetSelect() {
    const select = document.getElementById('preset-select');
    if (!select) return;
    const store = loadPresetStore();
    const names = Object.keys(store).sort((a, b) => a.localeCompare(b));
    const current = select.value;
    select.replaceChildren();
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— none —';
    select.appendChild(empty);
    names.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
    });
    if (names.includes(current)) select.value = current;
}

function handlePresetSave() {
    const name = window.prompt('Name for this filter preset:');
    if (name === null) return;
    const trimmed = name.trim();
    if (!trimmed) {
        setStatus('Preset name cannot be empty.', 'error');
        return;
    }
    const keys = getCheckedFilterKeys();
    if (keys.length === 0) {
        setStatus('Select at least one filter before saving a preset.', 'error');
        return;
    }
    const store = loadPresetStore();
    store[trimmed] = keys;
    savePresetStore(store);
    refreshPresetSelect();
    const select = document.getElementById('preset-select');
    if (select) select.value = trimmed;
    setStatus(`Saved preset “${trimmed}” (${keys.length} filters).`, 'ok');
}

function handlePresetLoad() {
    const select = document.getElementById('preset-select');
    const name = select?.value;
    if (!name) {
        setStatus('Choose a preset to load.', 'error');
        return;
    }
    const store = loadPresetStore();
    const keys = store[name];
    if (!keys) {
        setStatus(`Preset “${name}” not found.`, 'error');
        return;
    }
    applyFilterKeys(keys);
    const applied = getCheckedFilterKeys().length;
    setStatus(`Loaded preset “${name}” (${applied} filters active).`, 'ok');
}

function handlePresetDelete() {
    const select = document.getElementById('preset-select');
    const name = select?.value;
    if (!name) {
        setStatus('Choose a preset to delete.', 'error');
        return;
    }
    if (!window.confirm(`Delete preset “${name}”?`)) return;
    const store = loadPresetStore();
    delete store[name];
    savePresetStore(store);
    refreshPresetSelect();
    setStatus(`Deleted preset “${name}”.`, 'ok');
}

function handlePresetClear() {
    clearAllFilters();
    setStatus('All filters cleared.', 'info');
}

function bindUiEvents() {
    const citySelect = document.getElementById('city-select');
    if (citySelect) citySelect.addEventListener('change', onCityChange);

    const generateBtn = document.getElementById('generateRouteBtn');
    if (generateBtn) generateBtn.addEventListener('click', () => { handleRouteGeneration(); });

    const donateBtn = document.getElementById('donateBtn');
    if (donateBtn) donateBtn.addEventListener('click', handleDonate);

    const loadBtn = document.getElementById('preset-load-btn');
    if (loadBtn) loadBtn.addEventListener('click', handlePresetLoad);
    const saveBtn = document.getElementById('preset-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', handlePresetSave);
    const delBtn = document.getElementById('preset-delete-btn');
    if (delBtn) delBtn.addEventListener('click', handlePresetDelete);
    const clearBtn = document.getElementById('preset-clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', handlePresetClear);
}

async function init() {
    bindUiEvents();
    startRefreshCountdown();

    try {
        setStatus('Loading quest filters…');
        const cacheBuster = `?v=${Date.now()}`;
        const [questRes, pokedexRes] = await Promise.all([
            fetch(`./JSON/Quest_List.json${cacheBuster}`),
            fetch(`./JSON/pokedex.json${cacheBuster}`)
        ]);

        if (!questRes.ok || !pokedexRes.ok) {
            throw new Error('Failed to load JSON assets.');
        }

        const [questData, pokedexData] = await Promise.all([
            questRes.json(),
            pokedexRes.json()
        ]);

        questList = questData.categories || {};
        pokedexMap = Object.fromEntries(pokedexData.map(pkmn => [String(pkmn.id), pkmn]));

        renderCards();
        refreshPresetSelect();
        setStatus('Ready — select filters and generate a route.', 'ok');
    } catch (err) {
        setStatus(`Error loading configuration: ${err.message}`, 'error');
    }
}

function closeAllMultiselects(exceptContainer = null) {
    document.querySelectorAll('.checkboxes-container.show').forEach(el => {
        if (el !== exceptContainer) {
            el.classList.remove('show', 'drop-up');
            const box = el.previousElementSibling;
            if (box && box.classList.contains('select-box')) {
                box.setAttribute('aria-expanded', 'false');
            }
        }
    });
}

function createCheckboxDropdown(l1, l2, l3, conditions) {
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-multiselect';

    const selectBox = document.createElement('div');
    selectBox.className = 'select-box';
    selectBox.textContent = 'Select...';
    selectBox.setAttribute('role', 'button');
    selectBox.setAttribute('tabindex', '0');
    selectBox.setAttribute('aria-haspopup', 'listbox');
    selectBox.setAttribute('aria-expanded', 'false');
    selectBox.setAttribute('aria-label', 'Select quest conditions');

    const container = document.createElement('div');
    container.className = 'checkboxes-container';
    container.setAttribute('role', 'listbox');
    container.setAttribute('aria-multiselectable', 'true');
    container.addEventListener('click', (e) => e.stopPropagation());

    const optionsToRender = (conditions && conditions.length > 0) ? conditions : ['No Conditions'];
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

    const toggleOpen = () => {
        const isShowing = container.classList.contains('show');
        closeAllMultiselects(container);
        if (!isShowing) {
            container.classList.add('show');
            selectBox.setAttribute('aria-expanded', 'true');
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
            selectBox.setAttribute('aria-expanded', 'false');
        }
    };

    optionsToRender.forEach(cond => {
        const label = document.createElement('label');
        label.className = 'checkbox-option';
        label.setAttribute('role', 'option');

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = cond === 'No Conditions' ? '' : cond;
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
        toggleOpen();
    });

    selectBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
        } else if (e.key === 'Escape') {
            container.classList.remove('show', 'drop-up');
            selectBox.setAttribute('aria-expanded', 'false');
        }
    });

    wrapper.appendChild(selectBox);
    wrapper.appendChild(container);
    return wrapper;
}

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
                iconImg.src = getPokemonArtworkUrl(pokemonId);
                iconImg.alt = pokemonName;
                iconImg.className = 'encounter-icon';
                iconImg.loading = 'lazy';
                iconImg.referrerPolicy = 'no-referrer';
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
                accBtn.type = 'button';
                accBtn.className = 'accordion';
                accBtn.setAttribute('aria-expanded', 'false');

                let displayName = `ID: ${l2Id}`;
                let iconUrl = '';

                if (cat === '2' && ITEM_DETAILS[l2Id]) {
                    displayName = ITEM_DETAILS[l2Id].name;
                    iconUrl = `./assets/icons/${ITEM_DETAILS[l2Id].file}`;
                }

                const headerTitle = document.createElement('span');
                headerTitle.className = 'accordion-title';

                if (iconUrl) {
                    const iconImg = document.createElement('img');
                    iconImg.src = iconUrl;
                    iconImg.alt = '';
                    iconImg.className = 'accordion-icon';
                    iconImg.onerror = () => { iconImg.style.display = 'none'; };
                    headerTitle.appendChild(iconImg);
                }

                headerTitle.appendChild(document.createTextNode(displayName));
                accBtn.appendChild(headerTitle);

                const panel = document.createElement('div');
                panel.className = 'panel';
                panel.setAttribute('role', 'region');

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
                        const open = this.classList.toggle('active');
                        this.setAttribute('aria-expanded', open ? 'true' : 'false');
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

document.addEventListener('click', () => closeAllMultiselects());
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllMultiselects();
});

function getCustomStartLocation() {
    const inputEl = document.getElementById('currentLocationInput') || document.getElementById('start-location');
    const rawInput = inputEl?.value?.trim();
    if (!rawInput) return null;

    const parts = rawInput.split(',').map(str => str.trim());
    if (parts.length !== 2) {
        setStatus("Enter coordinates as 'lat, lon' (e.g. 40.7128, -74.0060).", 'error');
        return false;
    }

    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        setStatus('Invalid coordinates. Latitude −90…90, longitude −180…180.', 'error');
        return false;
    }

    return { lat, lng };
}

async function handleRouteGeneration() {
    const checkedBoxes = document.querySelectorAll('.custom-multiselect input[type="checkbox"]:checked');
    if (checkedBoxes.length === 0) {
        setStatus('Check at least one condition filter.', 'error');
        return;
    }

    const customStartPoint = getCustomStartLocation();
    if (customStartPoint === false) return;

    const isCustom = !!customStartPoint;
    const activeFilters = new Set(
        Array.from(checkedBoxes).map(cb => `${cb.dataset.l1},${cb.dataset.l2},${cb.dataset.l3},${cb.value}`)
    );

    const city = getSelectedCityConfig();
    const btnTarget = document.getElementById('generateRouteBtn') || document.querySelector('.btn-primary');

    const setBusy = (label) => {
        if (btnTarget) {
            btnTarget.textContent = label;
            btnTarget.disabled = true;
        }
    };

    const resetButton = () => {
        if (btnTarget) {
            btnTarget.textContent = 'Generate Route';
            btnTarget.disabled = false;
        }
    };

    let worker = null;

    try {
        setBusy(`Fetching ${city.name} Quests...`);
        setStatus(`Fetching ${city.name} quest data…`);

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

        const stopCount = isCustom ? matchedCoords.length - 1 : matchedCoords.length;
        const minRequired = isCustom ? 2 : 1;
        if (matchedCoords.length < minRequired) {
            setStatus(`No matching Pokéstops in ${city.name} for the selected filters.`, 'error');
            return;
        }

        const sampleNames = matchedCoords
            .filter(p => p.name !== 'Start Location')
            .slice(0, 5)
            .map(p => p.name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
            .join(' · ');
        const more = stopCount > 5 ? ` · +${stopCount - 5} more` : '';
        setStatus(
            `Matched ${stopCount} Pokéstop${stopCount === 1 ? '' : 's'} in ${city.name} — optimizing route…`,
            'info',
            sampleNames ? `Preview: ${sampleNames}${more}` : ''
        );

        setBusy('Optimizing Route...');

        worker = new Worker(`./worker.js?v=${Date.now()}`);

        const optimizedRoute = await new Promise((resolve, reject) => {
            worker.onmessage = (e) => {
                if (e.data && e.data.error) {
                    reject(new Error(e.data.error));
                    return;
                }
                resolve(e.data);
            };
            worker.onerror = (err) => {
                reject(new Error(err.message || 'Worker failed'));
            };
            worker.postMessage({
                points: matchedCoords,
                city: city.cityKey,
                isCustom: isCustom,
                timeLimitMs: 8000
            });
        });

        if (!Array.isArray(optimizedRoute) || optimizedRoute.length === 0) {
            setStatus(`No clusters within ${city.name} geofence for selected filters.`, 'error');
            return;
        }

        setStatus(
            `Optimized route: ${optimizedRoute.length} stop${optimizedRoute.length === 1 ? '' : 's'} — downloading GPX…`,
            'ok'
        );

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
        URL.revokeObjectURL(link.href);

        setStatus(
            `Downloaded ${todayStr}_${city.cityKey}_route.gpx (${optimizedRoute.length} stops).`,
            'ok'
        );
    } catch (err) {
        setStatus(`Error generating GPX: ${err.message}`, 'error');
    } finally {
        if (worker) {
            try { worker.terminate(); } catch (_) { /* ignore */ }
        }
        resetButton();
    }
}

window.onCityChange = onCityChange;
window.handleRouteGeneration = handleRouteGeneration;
window.handleDonate = handleDonate;
window.generateAndDownloadGPX = handleRouteGeneration;
window.onload = init;
