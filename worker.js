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

// Ray-casting point-in-polygon (fallback for custom polygon rings)
function pointInPolygon(lat, lng, ring) {
    if (!ring || ring.length < 3) return true;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const intersect = ((yi > lat) !== (yj > lat))
            && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || 1e-15) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function filterPoints(points, grid) {
    if (!grid) return points;
    if (grid.bounds) {
        const { minLat, maxLat, minLng, maxLng } = grid.bounds;
        return points.filter(pt => 
            pt.lat >= minLat && pt.lat <= maxLat && pt.lng >= minLng && pt.lng <= maxLng
        );
    }
    if (grid.ring && grid.ring.length >= 3) {
        return points.filter(pt => pointInPolygon(pt.lat, pt.lng, grid.ring));
    }
    return points;
}

// ============================================================
// Embedded City Configurations & Hex Grid Math
// ============================================================

const CITY_CONFIGS = {
    nyc: {
        hexSizeMeters: 700,
        minLat: 40.4902703,
        maxLat: 40.9176132,
        minLng: -74.2561216,
        maxLng: -73.650657
    },
    uk: {
        hexSizeMeters: 600,
        minLat: 51.4599168,
        maxLat: 51.5739191,
        minLng: -0.2330444,
        maxLng: 0.0171043
    },
    sg: {
        hexSizeMeters: 800,
        minLat: 1.236640927766203,
        maxLat: 1.4745776977361658,
        minLng: 103.65026593111105,
        maxLng: 104.03530627684654
    },
    syd: {
        hexSizeMeters: 700,
        minLat: -34.002121,
        maxLat: -33.7599584,
        minLng: 150.9580065,
        maxLng: 151.3058271
    },
    vc: {
        hexSizeMeters: 1000,
        minLat: 49.112986578992206,
        maxLat: 49.314010728183234,
        minLng: -123.20701971073987,
        maxLng: -122.87392354605953
    }
};

function getHexGrid(cityKey, customGrid) {
    if (customGrid) return customGrid;

    const config = CITY_CONFIGS[cityKey];
    if (!config) {
        const available = Object.keys(CITY_CONFIGS).join(", ");
        throw new Error(`No hex grid config found for city "${cityKey}". Available: ${available || "none"}`);
    }

    return {
        hexSizeMeters: config.hexSizeMeters,
        origin: { lat: config.minLat, lng: config.minLng },
        refLat: (config.minLat + config.maxLat) / 2,
        bounds: {
            minLat: config.minLat,
            maxLat: config.maxLat,
            minLng: config.minLng,
            maxLng: config.maxLng
        }
    };
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

// Maps axial (q, r) to a unique 32-bit integer key to eliminate string allocations
function getHexKey(q, r) {
    return ((q + 32768) << 16) | ((r + 32768) & 0xFFFF);
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
        const id = getHexKey(q, r);

        let entry = map.get(id);
        if (!entry) {
            entry = { q, r, points: [] };
            map.set(id, entry);
        }
        entry.points.push(pt);
    }
    return map;
}

function pickDeterministicHexPoint(pts) {
    if (pts.length === 1) return 0;
    let sumLat = 0, sumLng = 0;
    for (let i = 0; i < pts.length; i++) {
        sumLat += pts[i].lat;
        sumLng += pts[i].lng;
    }
    const cLat = sumLat / pts.length;
    const cLng = sumLng / pts.length;
    let bestIdx = 0;
    let bestD = Infinity;

    for (let i = 0; i < pts.length; i++) {
        const dLat = pts[i].lat - cLat;
        const dLng = pts[i].lng - cLng;
        const d = dLat * dLat + dLng * dLng;
        if (d < bestD) {
            bestD = d;
            bestIdx = i;
        }
    }
    return bestIdx;
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
            const neighborKey = getHexKey(entry.q + dq, entry.r + dr);
            if (activeIds.has(neighborKey)) activeNeighborCount++;
        }
        if (activeNeighborCount >= minActiveNeighbors) filtered.add(id);
    }
    return filtered;
}

function filterLargestConnectedComponent(activeIds, hexMap) {
    if (activeIds.size <= 1) return activeIds;

    const visited = new Set();
    let largestComponent = new Set();
    const ids = [...activeIds].sort((a, b) => a - b);

    for (const id of ids) {
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
                const neighborId = getHexKey(entry.q + dq, entry.r + dr);
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
// High-Performance Matrix-Based TSP Solvers & Local Search
// ============================================================

function buildDistanceMatrix(points) {
    const n = points.length;
    const matrix = new Float64Array(n * n);
    for (let i = 0; i < n; i++) {
        const pi = points[i];
        const iOffset = i * n;
        for (let j = i + 1; j < n; j++) {
            const pj = points[j];
            const dx = pi.x - pj.x;
            const dy = pi.y - pj.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            matrix[iOffset + j] = d;
            matrix[j * n + i] = d;
        }
    }
    return matrix;
}

function nearestNeighborTSP(n, matrix, startIdx = 0) {
    const route = new Int32Array(n);
    if (n <= 2) {
        for (let i = 0; i < n; i++) route[i] = i;
        if (startIdx === 1 && n === 2) { route[0] = 1; route[1] = 0; }
        return route;
    }

    const visited = new Uint8Array(n);
    route[0] = startIdx;
    visited[startIdx] = 1;

    let currentIdx = startIdx;
    for (let count = 1; count < n; count++) {
        const rowOffset = currentIdx * n;
        let bestIdx = -1, minDist = Infinity;

        for (let i = 0; i < n; i++) {
            if (!visited[i]) {
                const d = matrix[rowOffset + i];
                if (d < minDist) {
                    minDist = d;
                    bestIdx = i;
                }
            }
        }
        visited[bestIdx] = 1;
        route[count] = bestIdx;
        currentIdx = bestIdx;
    }
    return route;
}

function routeLength(route, matrix, n) {
    let total = 0;
    for (let i = 0; i < n - 1; i++) {
        total += matrix[route[i] * n + route[i + 1]];
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

function twoOptPass(route, matrix, n) {
    if (n <= 3) return false;
    let improved = false;

    for (let i = 1; i < n - 1; i++) {
        const u1 = route[i - 1];
        const u2 = route[i];
        const rowU1 = u1 * n;
        const rowU2 = u2 * n;
        const d12 = matrix[rowU1 + u2];

        for (let j = i + 1; j < n; j++) {
            if (j - i === 1) continue;

            const u3 = route[j];
            const rowU3 = u3 * n;

            let delta;
            if (j + 1 < n) {
                const u4 = route[j + 1];
                delta = (matrix[rowU1 + u3] + matrix[rowU2 + u4]) - (d12 + matrix[rowU3 + u4]);
            } else {
                delta = matrix[rowU1 + u3] - d12;
            }

            if (delta < -1e-9) {
                reverseRange(route, i, j);
                improved = true;
            }
        }
    }
    return improved;
}

let segBuffer = new Int32Array(10);

function shiftSegmentInPlace(route, i, segLen, insertAt, reverse) {
    if (segBuffer.length < segLen) segBuffer = new Int32Array(segLen);

    for (let k = 0; k < segLen; k++) {
        segBuffer[k] = route[i + k];
    }
    if (reverse) {
        let left = 0, right = segLen - 1;
        while (left < right) {
            const tmp = segBuffer[left];
            segBuffer[left] = segBuffer[right];
            segBuffer[right] = tmp;
            left++;
            right--;
        }
    }

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

function orOptPass(route, segLen, matrix, n) {
    if (n <= segLen + 2) return false;

    for (let i = 1; i <= n - segLen - 1; i++) {
        const prev = route[i - 1];
        const segStart = route[i];
        const segEnd = route[i + segLen - 1];
        const next = route[i + segLen];

        const rowPrev = prev * n;
        const rowSegEnd = segEnd * n;

        const removeCost = matrix[rowPrev + segStart] + matrix[rowSegEnd + next] - matrix[rowPrev + next];
        if (removeCost <= 1e-9) continue;

        for (let j = 0; j < n - 1; j++) {
            if (j >= i - 1 && j <= i + segLen - 1) continue;

            const a = route[j];
            const b = route[j + 1];
            const rowA = a * n;
            const rowSegStart = segStart * n;

            const insertFwd = matrix[rowA + segStart] + matrix[rowSegEnd + b] - matrix[rowA + b];
            const insertRev = matrix[rowA + segEnd] + matrix[rowSegStart + b] - matrix[rowA + b];
            const reversed = insertRev < insertFwd;
            const insertCost = Math.min(insertFwd, insertRev);

            if (insertCost - removeCost < -1e-9) {
                shiftSegmentInPlace(route, i, segLen, j + 1, reversed);
                return true;
            }
        }
    }
    return false;
}

function localSearch(route, deadline, matrix, n) {
    let improved = true;
    let checkCounter = 0;

    while (improved) {
        improved = false;
        if (twoOptPass(route, matrix, n)) improved = true;

        if ((++checkCounter & 3) === 0 && Date.now() > deadline) break;

        for (let segLen = 1; segLen <= 3; segLen++) {
            if ((++checkCounter & 3) === 0 && Date.now() > deadline) break;
            if (orOptPass(route, segLen, matrix, n)) improved = true;
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

    const matrix = buildDistanceMatrix(points);

    const startIndices = (options.startIndices && options.startIndices.length > 0)
        ? options.startIndices
        : pickStartIndices(n, options.starts || 6);

    let bestRouteIndices = null;
    let bestLen = Infinity;

    for (let s = 0; s < startIndices.length; s++) {
        if (Date.now() > overallDeadline) break;

        let route = nearestNeighborTSP(n, matrix, startIndices[s]);
        const remaining = overallDeadline - Date.now();
        const perStartDeadline = Date.now() + Math.max(remaining / (startIndices.length - s), 200);

        route = localSearch(route, Math.min(perStartDeadline, overallDeadline), matrix, n);

        const len = routeLength(route, matrix, n);
        if (len < bestLen) {
            bestLen = len;
            bestRouteIndices = route;
        }
    }

    if (!bestRouteIndices) return points;

    const result = new Array(n);
    for (let i = 0; i < n; i++) {
        result[i] = points[bestRouteIndices[i]];
    }
    return result;
}

// ============================================================
// Worker Message Handling
// ============================================================

self.onmessage = async function (e) {
    const rawPointsIn = e.data.points || e.data || [];
    const cityKey = e.data.city || "nyc";
    const minPointsPerHex = e.data.minPointsPerHex ?? 3;
    const minActiveNeighbors = e.data.minActiveNeighbors ?? 2;
    const timeLimitMs = e.data.timeLimitMs || 8000;
    const isCustom = e.data.isCustom || false;

    let baseGrid;
    if (!isCustom) {
        try {
            baseGrid = getHexGrid(cityKey, e.data.hexGrid);
        } catch (err) {
            self.postMessage({ error: err.message });
            return;
        }
    }

    const rawPoints = (!isCustom && baseGrid)
        ? filterPoints(rawPointsIn, baseGrid)
        : rawPointsIn;

    let currentHexSize = baseGrid ? baseGrid.hexSizeMeters : 0;
    let bestFallbackRoute = [];
    let bestDiffTo250 = Infinity;
    const visitedSizes = new Set();

    while (true) {
        if (visitedSizes.has(currentHexSize) || currentHexSize <= 0) {
            break;
        }
        visitedSizes.add(currentHexSize);

        let targetPointsRaw = [];
        let candidateStartIndices = [];

        if (isCustom || rawPoints.length <= 70) {
            targetPointsRaw = rawPoints;
            candidateStartIndices = [0];
        } else {
            const grid = {
                ...baseGrid,
                hexSizeMeters: currentHexSize
            };

            const hexMap = binPointsToHexagons(rawPoints, grid);
            const activeHexIds = filterActiveHexagons(hexMap, minPointsPerHex, minActiveNeighbors);
            const connectedHexIds = filterLargestConnectedComponent(activeHexIds, hexMap);

            const sortedHexIds = [...connectedHexIds].sort((a, b) => a - b);

            for (const hexId of sortedHexIds) {
                const entry = hexMap.get(hexId);
                if (!entry || entry.points.length === 0) continue;

                const pts = entry.points;
                const pickIdx = pickDeterministicHexPoint(pts);
                candidateStartIndices.push(targetPointsRaw.length + pickIdx);
                targetPointsRaw.push(...pts);
            }

            if (targetPointsRaw.length === 0 && rawPoints.length > 0) {
                targetPointsRaw = rawPoints;
                candidateStartIndices = [0];
            }
        }

        let currentRoute = [];
        if (targetPointsRaw.length > 0) {
            const projectedPoints = targetPointsRaw.map(projectPoint);
            const optimizedRoute = twoOptTSP(projectedPoints, {
                startIndices: candidateStartIndices,
                timeLimitMs
            });

            if (optimizedRoute) {
                currentRoute = optimizedRoute;
                for (let i = 0; i < currentRoute.length; i++) {
                    delete currentRoute[i].x;
                    delete currentRoute[i].y;
                }
            }
        }

        const count = currentRoute.length;
        const diff = Math.abs(count - 250);

        if (diff < bestDiffTo250 && count > 0) {
            bestDiffTo250 = diff;
            bestFallbackRoute = currentRoute;
        }

        if (isCustom || (count > 70 && count <= 250) || rawPoints.length <= 70) {
            bestFallbackRoute = currentRoute;
            break;
        }

        if (count <= 70) {
            currentHexSize += 200;
        } else if (count > 250) {
            currentHexSize -= 100;
        }
    }

    if (bestFallbackRoute.length === 0 && rawPoints.length > 0) {
        const projectedPoints = rawPoints.map(projectPoint);
        const optimizedRoute = twoOptTSP(projectedPoints, { startIndices: [0], timeLimitMs });
        if (optimizedRoute) {
            bestFallbackRoute = optimizedRoute;
            for (let i = 0; i < bestFallbackRoute.length; i++) {
                delete bestFallbackRoute[i].x;
                delete bestFallbackRoute[i].y;
            }
        }
    }

    self.postMessage(bestFallbackRoute);
};