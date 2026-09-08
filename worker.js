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

// --- Precise Manhattan Polygon Boundary (Excludes Roosevelt, Governors, Liberty, Ellis) ---
const MANHATTAN_POLYGON = [
    [40.7005, -74.0170], // Battery Park (South tip)
    [40.7100, -73.9780], // Corlears Hook (East Side Lower)
    [40.7380, -73.9730], // Stuyvesant Town (East River Bank)
    [40.7600, -73.9570], // Midtown East (Inside East River, excludes Roosevelt Is)
    [40.7850, -73.9430], // Upper East Side Bank
    [40.8000, -73.9300], // East Harlem Bank
    [40.8350, -73.9340], // Washington Heights East
    [40.8730, -73.9110], // Inwood North (Spuyten Duyvil Creek)
    [40.8780, -73.9270], // Inwood Hill Park
    [40.8500, -73.9480], // Fort Washington (Hudson River Bank)
    [40.8100, -73.9620], // Morningside Heights Bank
    [40.7600, -73.9980], // Hell's Kitchen Bank
    [40.7180, -74.0150]  // Tribeca / Hudson River Bank
];

// Ray-Casting Algorithm to test Point-in-Polygon
function isInsideManhattanPolygon(point) {
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

// --- Step 1: Cluster Filter (DBSCAN logic: min 6 nodes within 1.5 km) ---
function filterDenseClusters(points, radiusMeters = 1500, minNodes = 6) {
    const validPoints = [];

    for (let i = 0; i < points.length; i++) {
        let neighborCount = 0;
        for (let j = 0; j < points.length; j++) {
            if (haversineMeters(points[i], points[j]) <= radiusMeters) {
                neighborCount++;
            }
            if (neighborCount >= minNodes) break; // Fast abort once criteria is met
        }
        
        if (neighborCount >= minNodes) {
            validPoints.push(points[i]);
        }
    }
    return validPoints;
}

// --- Step 2: 2-Opt TSP Solver with 1.5 km Traverse Cap ---
function twoOptWithTraverseCap(points, maxTraverseMeters = 1500) {
    if (points.length <= 3) return points;

    let route = [...points];
    let improved = true;
    let passes = 0;
    const maxPasses = 30;

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
                    const leg1 = haversineMeters(route[i - 1], route[j]);
                    const leg2 = haversineMeters(route[i], route[j + 1] || route[j]);

                    if (leg1 <= maxTraverseMeters && leg2 <= maxTraverseMeters) {
                        const reversedSub = route.slice(i, j + 1).reverse();
                        route.splice(i, reversedSub.length, ...reversedSub);
                        improved = true;
                    }
                }
            }
        }
    }

    const cappedRoute = [route[0]];
    for (let k = 1; k < route.length; k++) {
        if (haversineMeters(cappedRoute[cappedRoute.length - 1], route[k]) <= maxTraverseMeters) {
            cappedRoute.push(route[k]);
        }
    }

    return cappedRoute;
}

// --- Worker Entry Point ---
self.onmessage = function (e) {
    const rawPoints = e.data || [];

    // 1. Strict Polygon Geofence: Filter out points outside Manhattan Island
    const manhattanPoints = rawPoints.filter(isInsideManhattanPolygon);

    if (manhattanPoints.length < 6) {
        self.postMessage([]);
        return;
    }

    // 2. Filter Clusters: Minimum 6 nodes within 1.5 km
    const clusteredPoints = filterDenseClusters(manhattanPoints, 1500, 6);

    if (clusteredPoints.length === 0) {
        self.postMessage([]);
        return;
    }

    // 3. Optimize Route
    const finalRoute = twoOptWithTraverseCap(clusteredPoints, 1500);

    self.postMessage(finalRoute);
};