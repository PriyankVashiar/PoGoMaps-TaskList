// --- Geometric & Projection Constants ---
const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_LAT = 110540;
const METERS_PER_LNG = 111320;
const SQRT_3 = Math.sqrt(3);

const AXIAL_DIRECTIONS = [
    [1, 0], [1, -1], [0, -1],
    [-1, 0], [-1, 1], [0, 1]
];

// --- Per-point planar projection ---
function projectPoint(pt) {
    const latRad = pt.lat * DEG_TO_RAD;
    return {
        ...pt,
        x: pt.lng * METERS_PER_LNG * Math.cos(latRad),
        y: pt.lat * METERS_PER_LAT
    };
}

function distSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

function dist(p1, p2) {
    return Math.sqrt(distSq(p1, p2));
}

// ============================================================
// Hex grid math & embedded city configurations
// ============================================================

const CITY_CONFIGS = {
    nyc: {
        hexSizeMeters: 700,
        bbox: [
            [-74.2561216, 40.9176132],
            [-73.650657, 40.9176132],
            [-73.650657, 40.4902703],
            [-74.2561216, 40.4902703],
            [-74.2561216, 40.9176132],
        ]
    },
    uk: {
        hexSizeMeters: 600,
        bbox: [
            [-0.2330444, 51.5739191],
            [0.0171043, 51.5739191],
            [0.0171043, 51.4599168],
            [-0.2330444, 51.4599168],
            [-0.2330444, 51.5739191]
        ]
    },
    sg: {
        hexSizeMeters: 800,
        bbox: [
            [103.65026593111105, 1.4745776977361658],
            [104.03530627684654, 1.4745776977361658],
            [104.03530627684654, 1.236640927766203],
            [103.65026593111105, 1.236640927766203],
            [103.65026593111105, 1.4745776977361658]
        ]
    },
    syd: {
        hexSizeMeters: 700,
        bbox: [
            [151.3058271, -34.002121],
            [150.9580065, -34.002121],
            [150.9580065, -33.7599584],
            [151.3058271, -33.7599584],
            [151.3058271, -34.002121]
        ]
    },
    vc: {
        hexSizeMeters: 1000,
        bbox: [
            [-123.20701971073987, 49.31401],
            [-122.87392354605953, 49.314010728183234],
            [-122.87392354605953, 49.112986578992206],
            [-123.20701971073987, 49.112986578992206],
            [-123.20701971073987, 49.314010728183234]
        ]
    }
};

function computeGridFromBbox(bbox, hexSizeMeters) {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    for (let i = 0; i < bbox.length; i++) {
        const [lng, lat] = bbox[i];
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
    }

    return {
        hexSizeMeters,
        origin: { lat: minLat, lng: minLng },
        refLat: (minLat + maxLat) / 2
    };
}

function getHexGrid(cityKey, customGrid) {
    if (customGrid) return customGrid;

    const config = CITY_CONFIGS[cityKey];
    if (!config) {
        const available = Object.keys(CITY_CONFIGS).join(", ");
        throw new Error(`No hex grid config found for city "${cityKey}". Available: ${available || "none"}`);
    }

    return computeGridFromBbox(config.bbox, config.hexSizeMeters);
}

function hexProject(lat, lng, origin, refLatRad) {
    return {
        x: (lng - origin.lng) * METERS_PER_LNG * Math.cos(refLatRad),
        y: (lat - origin.lat) * METERS_PER_LAT
    };
}

function pixelToAxialFrac(x, y, size) {
    return {
        q: (2 / 3) * x / size,
        r: ((-1 / 3) * x + (SQRT_3 / 3) * y) / size
    };
}

function axialRound(qFrac, rFrac) {
    let rx = Math.round(qFrac);
    let rz = Math.round(rFrac);
    let ry = Math.round(-qFrac - rFrac);

    const xDiff = Math.abs(rx - qFrac);
    const yDiff = Math.abs(ry - (-qFrac - rFrac));
    const zDiff = Math.abs(rz - rFrac);

    if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
    else if (yDiff > zDiff) ry = -rx - rz;
    else rz = -rx - ry;

    return { q: rx, r: rz };
}

function binPointsToHexagons(points, grid) {
    const origin = grid.origin;
    const refLatRad = grid.refLat * DEG_TO_RAD;
    const size = grid.hexSizeMeters;
    const map = new Map();

    for (let i = 0; i < points.length; i++) {
        const pt = points[i];
        const { x, y } = hexProject(pt.lat, pt.lng, origin, refLatRad);
        const frac = pixelToAxialFrac(x, y, size);
        const { q, r } = axialRound(frac.q, frac.r);
        const id = `${q},${r}`;
        
        let entry = map.get(id);
        if (!entry) {
            entry = { q, r, points: [] };
            map.set(id, entry);
        }
        entry.points.push(pt);
    }
    return map;
}

function filterActiveHexagons(hexMap, minPoints, minActiveNeighbors) {
    const activeIds = new Set();
    for (const [id, entry] of hexMap.entries()) {
        if (entry.points.length >= minPoints) activeIds.add(id);
    }

    const filtered = new Set();
    for (const id of activeIds) {
        const entry = hexMap.get(id);
        let activeNeighborCount = 0;
        for (let i = 0; i < 6; i++) {
            const [dq, dr] = AXIAL_DIRECTIONS[i];
            if (activeIds.has(`${entry.q + dq},${entry.r + dr}`)) activeNeighborCount++;
        }
        if (activeNeighborCount >= minActiveNeighbors) filtered.add(id);
    }
    return filtered;
}

function filterLargestConnectedComponent(activeIds, hexMap) {
    if (activeIds.size <= 1) return activeIds;

    const visited = new Set();
    let largestComponent = new Set();

    for (const id of activeIds) {
        if (visited.has(id)) continue;

        const currentComponent = new Set();
        const queue = [id];
        let queueHead = 0;
        visited.add(id);

        while (queueHead < queue.length) {
            const currId = queue[queueHead++];
            currentComponent.add(currId);

            const entry = hexMap.get(currId);
            if (!entry) continue;

            for (let i = 0; i < 6; i++) {
                const [dq, dr] = AXIAL_DIRECTIONS[i];
                const neighborId = `${entry.q + dq},${entry.r + dr}`;
                if (activeIds.has(neighborId) && !visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            }
        }

        if (currentComponent.size > largestComponent.size) {
            largestComponent = currentComponent;
        }
    }

    return largestComponent;
}

// ============================================================
// High-Performance TSP Solvers & Local Search
// ============================================================

function nearestNeighborTSP(points, startIdx = 0) {
    const n = points.length;
    if (n <= 2) return [...points];

    const visited = new Uint8Array(n);
    const route = new Array(n);
    
    route[0] = points[startIdx];
    visited[startIdx] = 1;

    let currentIdx = startIdx;
    for (let count = 1; count < n; count++) {
        const currentPt = points[currentIdx];
        let bestIdx = -1, minDist = Infinity;

        for (let i = 0; i < n; i++) {
            if (!visited[i]) {
                const d = distSq(currentPt, points[i]);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }
        }
        visited[bestIdx] = 1;
        route[count] = points[bestIdx];
        currentIdx = bestIdx;
    }
    return route;
}

function routeLength(route) {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
        total += dist(route[i], route[i + 1]);
    }
    return total;
}

function reverseRange(arr, i, j) {
    while (i < j) {
        const temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
        i++;
        j--;
    }
}

// Fixed-distance cached 2-opt pass
function twoOptPass(route) {
    const n = route.length;
    if (n <= 3) return false;
    let improved = false;

    for (let i = 1; i < n - 1; i++) {
        const p1 = route[i - 1];
        const p2 = route[i];
        const d12 = dist(p1, p2);

        for (let j = i + 1; j < n; j++) {
            if (j - i === 1) continue;

            const p3 = route[j];
            const hasP4 = j + 1 < n;

            let delta;
            if (hasP4) {
                const p4 = route[j + 1];
                delta = (dist(p1, p3) + dist(p2, p4)) - (d12 + dist(p3, p4));
            } else {
                delta = dist(p1, p3) - d12;
            }

            if (delta < -1e-9) {
                reverseRange(route, i, j);
                improved = true;
            }
        }
    }
    return improved;
}

// In-place segment shifting buffer for zero-allocation Or-opt
const segBuffer = [];

function shiftSegmentInPlace(route, i, segLen, insertAt, reverse) {
    segBuffer.length = segLen;
    for (let k = 0; k < segLen; k++) {
        segBuffer[k] = route[i + k];
    }
    if (reverse) segBuffer.reverse();

    if (insertAt < i) {
        for (let k = i - 1; k >= insertAt; k--) {
            route[k + segLen] = route[k];
        }
        for (let k = 0; k < segLen; k++) {
            route[insertAt + k] = segBuffer[k];
        }
    } else {
        const shiftCount = insertAt - (i + segLen);
        for (let k = 0; k < shiftCount; k++) {
            route[i + k] = route[i + segLen + k];
        }
        const targetStart = i + shiftCount;
        for (let k = 0; k < segLen; k++) {
            route[targetStart + k] = segBuffer[k];
        }
    }
}

function orOptPass(route, segLen) {
    const n = route.length;
    if (n <= segLen + 2) return false;

    for (let i = 1; i <= n - segLen - 1; i++) {
        const prev = route[i - 1];
        const segStart = route[i];
        const segEnd = route[i + segLen - 1];
        const next = route[i + segLen];

        const removeCost = dist(prev, segStart) + dist(segEnd, next) - dist(prev, next);
        if (removeCost <= 1e-9) continue;

        for (let j = 0; j < n - 1; j++) {
            if (j >= i - 1 && j <= i + segLen - 1) continue;

            const a = route[j];
            const b = route[j + 1];
            const insertFwd = dist(a, segStart) + dist(segEnd, b) - dist(a, b);
            const insertRev = dist(a, segEnd) + dist(segStart, b) - dist(a, b);
            const reversed = insertRev < insertFwd;
            const insertCost = Math.min(insertFwd, insertRev);

            if (insertCost - removeCost < -1e-9) {
                let insertAt = j + 1;
                shiftSegmentInPlace(route, i, segLen, insertAt, reversed);
                return true;
            }
        }
    }
    return false;
}

function localSearch(route, deadline) {
    let improved = true;
    while (improved && Date.now() < deadline) {
        improved = false;
        if (twoOptPass(route)) improved = true;
        if (Date.now() > deadline) break;

        for (let segLen = 1; segLen <= 3; segLen++) {
            if (Date.now() > deadline) break;
            if (orOptPass(route, segLen)) improved = true;
        }
    }
    return route;
}

function pickStartIndices(n, count) {
    const starts = new Set();
    for (let i = 0; i < count; i++) {
        starts.add(Math.floor((i * n) / count));
    }
    return [...starts];
}

function twoOptTSP(points, options = {}) {
    const n = points.length;
    if (n <= 3) return [...points];

    const timeLimitMs = options.timeLimitMs || 8000;
    const overallDeadline = Date.now() + timeLimitMs;
    
    // Safety check: ensure startIndices is not empty
    const startIndices = (options.startIndices && options.startIndices.length > 0)
        ? options.startIndices
        : pickStartIndices(n, options.starts || 6);

    let bestRoute = null;
    let bestLen = Infinity;

    for (let s = 0; s < startIndices.length; s++) {
        if (Date.now() > overallDeadline) break;

        let route = nearestNeighborTSP(points, startIndices[s]);
        const remaining = overallDeadline - Date.now();
        const perStartDeadline = Date.now() + Math.max(remaining / (startIndices.length - s), 200);

        route = localSearch(route, Math.min(perStartDeadline, overallDeadline));

        const len = routeLength(route);
        if (len < bestLen) {
            bestLen = len;
            bestRoute = route;
        }
    }
    return bestRoute;
}

// ============================================================
// Worker Message Handling
// ============================================================

self.onmessage = async function (e) {
    const rawPoints = e.data.points || e.data || [];
    const cityKey = e.data.city || "nyc";
    const minPointsPerHex = e.data.minPointsPerHex ?? 3;
    const minActiveNeighbors = e.data.minActiveNeighbors ?? 2;
    const timeLimitMs = e.data.timeLimitMs || 8000;
    const isCustom = e.data.isCustom || false;

    let targetPointsRaw = [];
    let candidateStartIndices = [];

    if (isCustom) {
        targetPointsRaw = rawPoints;
        candidateStartIndices = [0];
    } else {
        let grid;
        try {
            grid = getHexGrid(cityKey, e.data.hexGrid);
        } catch (err) {
            self.postMessage({ error: err.message });
            return;
        }

        const hexMap = binPointsToHexagons(rawPoints, grid);
        const activeHexIds = filterActiveHexagons(hexMap, minPointsPerHex, minActiveNeighbors);
        const connectedHexIds = filterLargestConnectedComponent(activeHexIds, hexMap);

        for (const hexId of connectedHexIds) {
            const entry = hexMap.get(hexId);
            if (!entry || entry.points.length === 0) continue;

            const pts = entry.points;
            const randomPtIdx = Math.floor(Math.random() * pts.length);
            candidateStartIndices.push(targetPointsRaw.length + randomPtIdx);
            targetPointsRaw.push(...pts);
        }
    }

    if (targetPointsRaw.length === 0) {
        self.postMessage([]);
        return;
    }

    const projectedPoints = targetPointsRaw.map(projectPoint);
    const optimizedRoute = twoOptTSP(projectedPoints, { 
        startIndices: candidateStartIndices, 
        timeLimitMs 
    });
    
    if (!optimizedRoute) {
        self.postMessage([]);
        return;
    }

    const finalRoute = optimizedRoute.map(({ x, y, ...pt }) => pt);
    self.postMessage(finalRoute);
};