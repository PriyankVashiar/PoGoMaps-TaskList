// --- Helper: Fast Planar Projection for City-Scale Distance Checks ---
function projectPoint(pt) {
    const latRad = pt.lat * Math.PI / 180;
    return {
        ...pt,
        // Approximate meters relative to equator/prime meridian
        x: pt.lng * 111320 * Math.cos(latRad),
        y: pt.lat * 110540
    };
}

// Fast Euclidean Squared Distance (No Math.sqrt needed for comparisons)
function distSq(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return dx * dx + dy * dy;
}

// Haversine Distance (Used only when exact meter distance is needed)
function haversineMeters(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Geofence Configurations ---
const GEOFENCES = {
    "nyc": {
        type: "polygon",
        bbox: [40.6996294, 40.8786511, -74.0197496, -73.9066021],
        polygon: [
            [40.6996294, -74.0154309], [40.710577, -73.9772546], [40.7338901, -73.968482],
            [40.753, -73.963], [40.772, -73.945], [40.7970811, -73.9288275],
            [40.834, -73.934], [40.8723982, -73.9066021], [40.8786511, -73.9268079],
            [40.852, -73.947], [40.8132074, -73.966538], [40.7604084, -74.0061138],
            [40.7074679, -74.0197496], [40.6996294, -74.0154309]
        ]
    },
    "vancouver": {
        type: "polygon",
        bbox: [49.1954514, 49.3124924, -123.165553, -122.8817871],
        polygon: [
            [49.2001528, -123.1358717], [49.2091965, -123.0716264], [49.1954514, -122.951696],
            [49.2244104, -122.8817871], [49.2903183, -122.8855786], [49.2926984, -122.9882005],
            [49.2929908, -123.0518704], [49.2831415, -123.0842692], [49.3124924, -123.142971],
            [49.301048, -123.1578014], [49.27234, -123.165553], [49.2001528, -123.1358717]
        ]
    },
    "singapore": {
        type: "polygon",
        bbox: [1.2644338, 1.4317288, 103.8258868, 104.0372755],
        polygon: [
            [1.2655376, 103.8258868], [1.2644338, 103.9752533], [1.3116773, 104.0163067],
            [1.3672344, 104.0372755], [1.4317288, 103.8748829], [1.3953192, 103.831487],
            [1.2655376, 103.8258868]
        ]
    },
    "sydney": {
        type: "polygon",
        bbox: [-33.9467882, -33.8462107, 151.128141, 151.284419],
        polygon: [
            [-33.9153566, 151.128141], [-33.9467882, 151.256957], [-33.9140488, 151.2715366],
            [-33.8738737, 151.284419], [-33.8576186, 151.2296514], [-33.8462107, 151.1842048],
            [-33.8693291, 151.1410604], [-33.9153566, 151.128141]
        ]
    },
    "london": {
        type: "bbox",
        bbox: [51.450, 51.550, -0.250, 0.050]
    }
};

function isInsidePolygon(point, polygon) {
    const x = point.lat, y = point.lng;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function isInsideBBox(point, bbox) {
    const [minLat, maxLat, minLng, maxLng] = bbox;
    return point.lat >= minLat && point.lat <= maxLat && point.lng >= minLng && point.lng <= maxLng;
}

function isInsideGeofence(point, cityKey) {
    const config = GEOFENCES[cityKey];
    if (!config) return true;
    if (!isInsideBBox(point, config.bbox)) return false;
    if (config.type === "polygon") return isInsidePolygon(point, config.polygon);
    return true;
}

// --- Fast Cluster Filter ---
function filterDenseClusters(points, radiusMeters = 1500, minNodes = 2) {
    if (points.length <= minNodes) return points;
    const radiusSq = radiusMeters * radiusMeters;
    const validPoints = [];

    for (let i = 0; i < points.length; i++) {
        let count = 0;
        for (let j = 0; j < points.length; j++) {
            if (distSq(points[i], points[j]) <= radiusSq) {
                count++;
                if (count >= minNodes) break;
            }
        }
        if (count >= minNodes) validPoints.push(points[i]);
    }
    return validPoints;
}

// --- Step 1: Greedy Nearest Neighbor Route ---
function nearestNeighborTSP(points) {
    if (points.length <= 2) return points;
    const unvisited = [...points];
    const route = [unvisited.shift()];

    while (unvisited.length > 0) {
        const last = route[route.length - 1];
        let bestIdx = 0;
        let minDist = Infinity;

        for (let i = 0; i < unvisited.length; i++) {
            const d = distSq(last, unvisited[i]);
            if (d < minDist) {
                minDist = d;
                bestIdx = i;
            }
        }
        route.push(unvisited.splice(bestIdx, 1)[0]);
    }
    return route;
}

// --- Step 2: 2-Opt Optimization ---
function twoOptTSP(points) {
    if (points.length <= 3) return points;

    // Start with a smart nearest-neighbor route
    let route = nearestNeighborTSP(points);
    let improved = true;
    let passes = 0;
    const maxPasses = 25;

    while (improved && passes < maxPasses) {
        improved = false;
        passes++;

        for (let i = 1; i < route.length - 2; i++) {
            for (let j = i + 1; j < route.length; j++) {
                if (j - i === 1) continue;

                const p1 = route[i - 1], p2 = route[i];
                const p3 = route[j], p4 = route[j + 1] || route[j];

                const currentDist = distSq(p1, p2) + distSq(p3, p4);
                const newDist = distSq(p1, p3) + distSq(p2, p4);

                if (newDist < currentDist) {
                    const reversedSub = route.slice(i, j + 1).reverse();
                    route.splice(i, reversedSub.length, ...reversedSub);
                    improved = true;
                }
            }
        }
    }
    return route;
}

// --- Worker Message Listener ---
self.onmessage = function (e) {
    const rawPoints = e.data.points || e.data || [];
    const cityKey = e.data.city || "nyc";

    // 1. Geofence Check
    const geofenced = rawPoints.filter(pt => isInsideGeofence(pt, cityKey));
    if (geofenced.length === 0) {
        self.postMessage([]);
        return;
    }

    // 2. Project Lat/Lng to X/Y Planar Coordinates
    const projectedPoints = geofenced.map(projectPoint);

    // 3. Cluster Filter
    const clustered = filterDenseClusters(projectedPoints, 1500, 2);
    const targetPoints = clustered.length > 0 ? clustered : projectedPoints;

    // 4. Optimize TSP Route
    const optimizedRoute = twoOptTSP(targetPoints);

    // 5. Clean projected x/y fields before returning
    const finalRoute = optimizedRoute.map(({ x, y, ...pt }) => pt);

    self.postMessage(finalRoute);
};