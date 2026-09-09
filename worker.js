// --- Helper: Haversine Distance (in Meters) ---
function haversineMeters(p1, p2) {
    const R = 6371000;
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Exact Manhattan Main Island Polygon from Topology/GeoJSON Data ---
const MANHATTAN_POLYGON = [
    [40.6996294, -74.0154309],
    [40.710577, -73.9772546],
    [40.7338901, -73.968482],
    [40.753, -73.963],
    [40.772, -73.945],
    [40.7970811, -73.9288275],
    [40.834, -73.934],
    [40.8723982, -73.9066021],
    [40.8786511, -73.9268079],
    [40.852, -73.947],
    [40.8132074, -73.966538],
    [40.7604084, -74.0061138],
    [40.7074679, -74.0197496],
    [40.6996294, -74.0154309]
];

// Ray-Casting Point-in-Polygon Check
function isInsideManhattan(point) {
    // Quick Bounding Box Check: [-74.0197496, 40.6996294, -73.9066021, 40.8786511]
    if (point.lat < 40.6996294 || point.lat > 40.8786511 || point.lng < -74.0197496 || point.lng > -73.9066021) {
        return false;
    }

    const x = point.lat;
    const y = point.lng;
    let inside = false;

    for (let i = 0, j = MANHATTAN_POLYGON.length - 1; i < MANHATTAN_POLYGON.length; j = i++) {
        const xi = MANHATTAN_POLYGON[i][0], yi = MANHATTAN_POLYGON[i][1];
        const xj = MANHATTAN_POLYGON[j][0], yj = MANHATTAN_POLYGON[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// --- Step 1: Cluster Filter (Soft Threshold: min 2 nodes within 1.5 km) ---
function filterDenseClusters(points, radiusMeters = 1500, minNodes = 6) {
    if (points.length <= minNodes) return points;

    const validPoints = [];

    for (let i = 0; i < points.length; i++) {
        let neighborCount = 0;
        for (let j = 0; j < points.length; j++) {
            if (haversineMeters(points[i], points[j]) <= radiusMeters) {
                neighborCount++;
            }
            if (neighborCount >= minNodes) break;
        }
        
        if (neighborCount >= minNodes) {
            validPoints.push(points[i]);
        }
    }
    return validPoints;
}

// --- Step 2: 2-Opt TSP Route Optimizer ---
function twoOptTSP(points) {
    if (points.length <= 3) return points;

    let route = [...points];
    let improved = true;
    let passes = 0;
    const maxPasses = 25;

    while (improved && passes < maxPasses) {
        improved = false;
        passes++;

        for (let i = 1; i < route.length - 2; i++) {
            for (let j = i + 1; j < route.length; j++) {
                if (j - i === 1) continue;

                const currentDist = haversineMeters(route[i - 1], route[i]) + 
                                    haversineMeters(route[j], route[j + 1] || route[j]);

                const newDist = haversineMeters(route[i - 1], route[j]) + 
                                haversineMeters(route[i], route[j + 1] || route[j]);

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
    const rawPoints = e.data || [];

    // 1. Strict Geofence using provided boundary
    const manhattanPoints = rawPoints.filter(isInsideManhattan);

    if (manhattanPoints.length === 0) {
        self.postMessage([]);
        return;
    }

    // 2. Filter Clusters
    const clusteredPoints = filterDenseClusters(manhattanPoints, 1500, 2);

    // 3. Optimize Order
    const finalRoute = twoOptTSP(clusteredPoints.length > 0 ? clusteredPoints : manhattanPoints);

    self.postMessage(finalRoute);
};