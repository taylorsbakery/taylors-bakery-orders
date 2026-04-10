// Taylor's Bakery Dispatch Manifest Route Optimizer
// Cluster-first, sequence-second approach for dispatch readability
// Uses OSRM for real driving distances/times, haversine fallback

const BAKERY_LAT = 39.8876;
const BAKERY_LNG = -86.1078;
const OSRM_BASE = 'https://router.project-osrm.org';

// Indiana service area bounding box (generous)
const IN_LAT_MIN = 37.7;
const IN_LAT_MAX = 41.8;
const IN_LNG_MIN = -88.1;
const IN_LNG_MAX = -84.7;

function isValidCoordinate(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

function isInServiceArea(lat: number, lng: number): boolean {
  return lat >= IN_LAT_MIN && lat <= IN_LAT_MAX && lng >= IN_LNG_MIN && lng <= IN_LNG_MAX;
}

export interface RouteStop {
  orderId: string;
  orderNumber: string;
  accountName: string;
  locationName: string;
  deliveryAddress: string;
  deliveryTime: string | null;
  customerPhone: string | null;
  specialNotes: string | null;
  lat: number;
  lng: number;
  total: number;
  itemSummary: string;
  status: string;
  deliveredAt: string | null;
  deliveryNotes: string | null;
}

export interface ManifestStop extends RouteStop {
  stopNumber: number;
  distanceFromPrev: number;    // miles (leg)
  durationFromPrev: number;    // minutes (leg)
  runningDistance: number;     // cumulative miles
  runningDuration: number;     // cumulative minutes
  hasTimeConstraint: boolean;
  clusterLabel: string;        // geographic cluster name
  estimatedArrival: string;    // e.g. "6:24 AM"
}

export interface OptimizedRoute {
  stops: ManifestStop[];
  totalDistance: number;       // miles including return
  totalDuration: number;       // minutes including return
  returnDistance: number;      // last stop → bakery miles
  returnDuration: number;      // last stop → bakery minutes
  routeGeometry: [number, number][];
  orderCount: number;
  clusterCount: number;
  departureTime: string;       // e.g. "6:00 AM"
  estimatedReturn: string;     // e.g. "8:45 AM"
  skippedStops: { orderNumber: string; reason: string }[];
}

// -------------------------------------------------------------------
// Utilities
// -------------------------------------------------------------------

function parseDeliveryHour(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const normalized = timeStr.trim().toUpperCase();

  // Handle label-based times ("Early AM", "Morning", etc.)
  const labelMap: Record<string, number> = {
    'EARLY AM': 6, 'MORNING': 8, 'LATE MORNING': 10,
    'AFTERNOON': 13, 'LATE AFTERNOON': 15,
  };
  if (labelMap[normalized]) return labelMap[normalized];

  // 24h format
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) return parseInt(match24[1]) + parseInt(match24[2]) / 60;

  // 12h format
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let h = parseInt(match12[1]);
    const m = parseInt(match12[2]);
    if (match12[3] === 'PM' && h < 12) h += 12;
    if (match12[3] === 'AM' && h === 12) h = 0;
    return h + m / 60;
  }
  return null;
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3959; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Estimate drive minutes from haversine miles (avg 30mph city, 50mph highway)
function estimateDriveMinutes(miles: number): number {
  if (miles < 5) return Math.round(miles * 2.5); // ~24mph city
  if (miles < 20) return Math.round(miles * 1.8); // ~33mph mixed
  return Math.round(miles * 1.3); // ~46mph highway
}

function formatDuration(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

// Default departure: 6:00 AM = 360 minutes from midnight
const DEFAULT_DEPARTURE_MINUTES = 360;

function minutesToClockTime(totalMinutes: number): string {
  const mins = Math.round(totalMinutes);
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

// -------------------------------------------------------------------
// Step B: Geographic Clustering (DBSCAN-style)
// -------------------------------------------------------------------

interface Cluster {
  label: string;
  centroidLat: number;
  centroidLng: number;
  stops: RouteStop[];
}

function buildGeographicClusters(stops: RouteStop[], maxRadiusMiles: number = 12): Cluster[] {
  if (stops.length <= 3) {
    // Too few stops to bother clustering
    const centroid = stops.reduce((acc, s) => ({ lat: acc.lat + s.lat / stops.length, lng: acc.lng + s.lng / stops.length }), { lat: 0, lng: 0 });
    return [{
      label: inferClusterLabel(stops),
      centroidLat: centroid.lat,
      centroidLng: centroid.lng,
      stops,
    }];
  }

  // Simple greedy clustering: assign each stop to nearest existing cluster or create new
  const clusters: Cluster[] = [];
  const assigned = new Set<string>();

  // Sort stops by distance from bakery (process far stops first to form distant clusters)
  const sorted = [...stops].sort((a, b) =>
    haversineDistance(BAKERY_LAT, BAKERY_LNG, b.lat, b.lng) -
    haversineDistance(BAKERY_LAT, BAKERY_LNG, a.lat, a.lng)
  );

  for (const stop of sorted) {
    if (assigned.has(stop.orderId)) continue;

    // Find nearest cluster centroid
    let bestCluster: Cluster | null = null;
    let bestDist = Infinity;
    for (const cluster of clusters) {
      const d = haversineDistance(stop.lat, stop.lng, cluster.centroidLat, cluster.centroidLng);
      if (d < bestDist) { bestDist = d; bestCluster = cluster; }
    }

    if (bestCluster && bestDist <= maxRadiusMiles) {
      bestCluster.stops.push(stop);
      assigned.add(stop.orderId);
      // Recompute centroid
      const n = bestCluster.stops.length;
      bestCluster.centroidLat = bestCluster.stops.reduce((s, st) => s + st.lat, 0) / n;
      bestCluster.centroidLng = bestCluster.stops.reduce((s, st) => s + st.lng, 0) / n;
    } else {
      // Create new cluster
      const newCluster: Cluster = {
        label: '',
        centroidLat: stop.lat,
        centroidLng: stop.lng,
        stops: [stop],
      };
      clusters.push(newCluster);
      assigned.add(stop.orderId);
    }
  }

  // Label clusters
  for (const cluster of clusters) {
    cluster.label = inferClusterLabel(cluster.stops);
  }

  return clusters;
}

function inferClusterLabel(stops: RouteStop[]): string {
  // Use most common city from addresses
  const cities: Record<string, number> = {};
  for (const s of stops) {
    const parts = s.deliveryAddress.split(',').map(p => p.trim());
    // Typically: "123 Main St, City, ST 12345" or "123 Main St, City, State"
    if (parts.length >= 2) {
      const cityPart = parts[parts.length - 2] || parts[1];
      // Remove state abbreviation if appended
      const city = cityPart.replace(/\s+(IN|OH|IL|KY|MI)$/i, '').trim();
      if (city && city.length > 1) {
        cities[city] = (cities[city] || 0) + 1;
      }
    }
  }
  const sorted = Object.entries(cities).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'Area';
}

// -------------------------------------------------------------------
// Step C: Order Clusters from Depot
// -------------------------------------------------------------------

function orderClusters(clusters: Cluster[]): Cluster[] {
  if (clusters.length <= 1) return clusters;

  // Greedy nearest-cluster from depot
  const ordered: Cluster[] = [];
  const remaining = [...clusters];
  let currentLat = BAKERY_LAT;
  let currentLng = BAKERY_LNG;

  // Prioritize clusters with time-constrained stops (earliest first)
  const getEarliestTime = (c: Cluster): number => {
    let earliest = Infinity;
    for (const s of c.stops) {
      const h = parseDeliveryHour(s.deliveryTime);
      if (h !== null && h < earliest) earliest = h;
    }
    return earliest;
  };

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      const dist = haversineDistance(currentLat, currentLng, c.centroidLat, c.centroidLng);
      const earliestTime = getEarliestTime(c);
      // Score: distance weighted + time urgency
      const score = dist * 0.6 + (earliestTime === Infinity ? 100 : earliestTime) * 0.4;
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }

    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    currentLat = next.centroidLat;
    currentLng = next.centroidLng;
  }

  return ordered;
}

// -------------------------------------------------------------------
// Step D: Sequence Stops Within a Cluster
// -------------------------------------------------------------------

function sequenceWithinCluster(
  stops: RouteStop[],
  entryLat: number,
  entryLng: number
): RouteStop[] {
  if (stops.length <= 1) return stops;

  // Separate time-constrained and flexible
  const timed: (RouteStop & { hour: number })[] = [];
  const flexible: RouteStop[] = [];

  for (const stop of stops) {
    const hour = parseDeliveryHour(stop.deliveryTime);
    if (hour !== null) {
      timed.push({ ...stop, hour });
    } else {
      flexible.push(stop);
    }
  }

  timed.sort((a, b) => a.hour - b.hour);

  // Build sequence: timed stops anchored in order, flexible inserted via nearest-neighbor
  const result: RouteStop[] = [];
  const usedFlexible = new Set<string>();
  let curLat = entryLat;
  let curLng = entryLng;

  for (const timedStop of timed) {
    // Insert nearby flexible stops before this timed stop
    const distToTimed = haversineDistance(curLat, curLng, timedStop.lat, timedStop.lng);
    const nearby = flexible
      .filter(f => !usedFlexible.has(f.orderId))
      .map(f => ({
        ...f,
        distFromCur: haversineDistance(curLat, curLng, f.lat, f.lng),
        distToTimed: haversineDistance(f.lat, f.lng, timedStop.lat, timedStop.lng),
      }))
      .filter(f => f.distFromCur + f.distToTimed < distToTimed * 1.5)
      .sort((a, b) => a.distFromCur - b.distFromCur);

    for (const flex of nearby) {
      result.push(flex);
      usedFlexible.add(flex.orderId);
      curLat = flex.lat;
      curLng = flex.lng;
    }

    result.push(timedStop);
    curLat = timedStop.lat;
    curLng = timedStop.lng;
  }

  // Remaining flexible: nearest-neighbor
  const remaining = flexible.filter(f => !usedFlexible.has(f.orderId));
  const unvisited = [...remaining];

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < unvisited.length; i++) {
      const d = haversineDistance(curLat, curLng, unvisited[i].lat, unvisited[i].lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    const next = unvisited.splice(nearestIdx, 1)[0];
    result.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  // 2-opt improvement pass
  return twoOptImprove(result);
}

function twoOptImprove(route: RouteStop[]): RouteStop[] {
  if (route.length <= 3) return route;

  const result = [...route];
  let improved = true;
  let iterations = 0;
  const maxIterations = route.length * 2;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 0; i < result.length - 2; i++) {
      // Skip time-constrained stops (don't reorder them)
      if (parseDeliveryHour(result[i].deliveryTime) !== null) continue;

      for (let j = i + 2; j < result.length; j++) {
        if (parseDeliveryHour(result[j].deliveryTime) !== null) continue;

        const prevI = i === 0
          ? { lat: BAKERY_LAT, lng: BAKERY_LNG }
          : result[i - 1];
        const nextJ = j + 1 < result.length ? result[j + 1] : null;

        const currentDist =
          haversineDistance(prevI.lat, prevI.lng, result[i].lat, result[i].lng) +
          (nextJ ? haversineDistance(result[j].lat, result[j].lng, nextJ.lat, nextJ.lng) : 0);

        const newDist =
          haversineDistance(prevI.lat, prevI.lng, result[j].lat, result[j].lng) +
          (nextJ ? haversineDistance(result[i].lat, result[i].lng, nextJ.lat, nextJ.lng) : 0);

        if (newDist < currentDist - 0.1) {
          // Reverse the segment between i and j
          const reversed = result.slice(i, j + 1).reverse();
          result.splice(i, j - i + 1, ...reversed);
          improved = true;
        }
      }
    }
  }

  return result;
}

// -------------------------------------------------------------------
// Step E: OSRM Driving Distances/Times
// -------------------------------------------------------------------

async function getOSRMLegMetrics(coordinates: [number, number][]): Promise<{
  distances: number[];  // miles per leg
  durations: number[];  // minutes per leg
  geometry: [number, number][];  // lat/lng pairs
} | null> {
  if (coordinates.length < 2) return null;

  try {
    // OSRM expects lng,lat order
    const coordStr = coordinates.map(c => `${c[1]},${c[0]}`).join(';');
    const url = `${OSRM_BASE}/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=false&annotations=distance,duration`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const res = await fetch(url, {
      headers: { 'User-Agent': 'TaylorsBakeryOrders/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      console.warn('OSRM returned non-OK status:', res.status);
      return null;
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.routes?.[0]) {
      console.warn('OSRM response code:', data.code);
      return null;
    }

    const route = data.routes[0];
    const legs = route.legs || [];
    const distances = legs.map((l: any) => Math.round(((l.distance || 0) / 1609.34) * 10) / 10);
    const durations = legs.map((l: any) => Math.round((l.duration || 0) / 60));
    const geometry: [number, number][] = (route.geometry?.coordinates || []).map((c: number[]) => [c[1], c[0]]);

    return { distances, durations, geometry };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.warn('OSRM request timed out');
    } else {
      console.error('OSRM route error:', err);
    }
    return null;
  }
}

// For large routes, OSRM URL can exceed limits. Split into chunks.
async function getOSRMRouteChunked(coordinates: [number, number][]): Promise<{
  distances: number[];
  durations: number[];
  geometry: [number, number][];
} | null> {
  // OSRM has a URL limit (~8000 chars). Each coordinate is ~20 chars.
  // Safe limit: ~350 coordinates per request
  const MAX_COORDS_PER_REQUEST = 100;

  if (coordinates.length <= MAX_COORDS_PER_REQUEST) {
    return getOSRMLegMetrics(coordinates);
  }

  // Split into overlapping chunks
  const allDistances: number[] = [];
  const allDurations: number[] = [];
  const allGeometry: [number, number][] = [];

  for (let start = 0; start < coordinates.length - 1; start += MAX_COORDS_PER_REQUEST - 1) {
    const end = Math.min(start + MAX_COORDS_PER_REQUEST, coordinates.length);
    const chunk = coordinates.slice(start, end);

    const result = await getOSRMLegMetrics(chunk);
    if (!result) return null; // If any chunk fails, fall back entirely

    allDistances.push(...result.distances);
    allDurations.push(...result.durations);
    // Skip first geometry point of subsequent chunks to avoid duplicates
    if (start === 0) {
      allGeometry.push(...result.geometry);
    } else {
      allGeometry.push(...result.geometry.slice(1));
    }
  }

  return { distances: allDistances, durations: allDurations, geometry: allGeometry };
}

// -------------------------------------------------------------------
// Step F: Build Dispatch Manifest
// -------------------------------------------------------------------

export async function optimizeRoute(stops: RouteStop[]): Promise<OptimizedRoute> {
  const emptyResult: OptimizedRoute = {
    stops: [],
    totalDistance: 0,
    totalDuration: 0,
    returnDistance: 0,
    returnDuration: 0,
    routeGeometry: [],
    orderCount: 0,
    clusterCount: 0,
    departureTime: minutesToClockTime(DEFAULT_DEPARTURE_MINUTES),
    estimatedReturn: minutesToClockTime(DEFAULT_DEPARTURE_MINUTES),
    skippedStops: [],
  };

  if (stops.length === 0) return emptyResult;

  // Filter out stops with invalid or out-of-area coordinates
  const validStops: RouteStop[] = [];
  const skippedStops: { orderNumber: string; reason: string }[] = [];

  for (const stop of stops) {
    if (!isValidCoordinate(stop.lat, stop.lng)) {
      console.warn(`[Route] Skipping ${stop.orderNumber}: invalid coords (${stop.lat}, ${stop.lng})`);
      skippedStops.push({ orderNumber: stop.orderNumber, reason: 'Invalid coordinates' });
      continue;
    }
    if (!isInServiceArea(stop.lat, stop.lng)) {
      console.warn(`[Route] Skipping ${stop.orderNumber}: outside service area (${stop.lat}, ${stop.lng})`);
      skippedStops.push({ orderNumber: stop.orderNumber, reason: `Outside service area (${stop.lat.toFixed(2)}, ${stop.lng.toFixed(2)})` });
      continue;
    }
    validStops.push(stop);
  }

  if (validStops.length === 0) return { ...emptyResult, skippedStops };

  // Step B: Build geographic clusters
  const clusters = buildGeographicClusters(validStops);
  console.log(`[Route] ${stops.length} stops → ${clusters.length} cluster(s): ${clusters.map(c => `${c.label} (${c.stops.length})`).join(', ')}`);

  // Step C: Order clusters from depot
  const orderedClusters = orderClusters(clusters);

  // Step D: Sequence stops within each cluster
  const sequenced: (RouteStop & { clusterLabel: string })[] = [];
  let entryLat = BAKERY_LAT;
  let entryLng = BAKERY_LNG;

  for (const cluster of orderedClusters) {
    const clusterSequence = sequenceWithinCluster(cluster.stops, entryLat, entryLng);
    for (const stop of clusterSequence) {
      sequenced.push({ ...stop, clusterLabel: cluster.label });
    }
    if (clusterSequence.length > 0) {
      const last = clusterSequence[clusterSequence.length - 1];
      entryLat = last.lat;
      entryLng = last.lng;
    }
  }

  // Step E: Build coordinate list for OSRM (bakery → all stops → bakery)
  const coords: [number, number][] = [
    [BAKERY_LAT, BAKERY_LNG],
    ...sequenced.map(s => [s.lat, s.lng] as [number, number]),
    [BAKERY_LAT, BAKERY_LNG], // return to depot
  ];

  // Get OSRM driving metrics
  const osrmResult = await getOSRMRouteChunked(coords);
  if (osrmResult) {
    console.log(`[Route] OSRM returned ${osrmResult.distances.length} legs, ${osrmResult.geometry.length} geometry points`);
  } else {
    console.warn('[Route] OSRM unavailable, using haversine fallback');
  }

  // Step F: Build manifest with running totals
  let runningDistance = 0;
  let runningDuration = 0;

  const manifestStops: ManifestStop[] = sequenced.map((stop, i) => {
    const hour = parseDeliveryHour(stop.deliveryTime);

    let legDistance: number;
    let legDuration: number;

    if (osrmResult && i < osrmResult.distances.length) {
      legDistance = osrmResult.distances[i];
      legDuration = osrmResult.durations[i];
    } else {
      // Haversine fallback with drive time estimate
      const prevLat = i === 0 ? BAKERY_LAT : sequenced[i - 1].lat;
      const prevLng = i === 0 ? BAKERY_LNG : sequenced[i - 1].lng;
      legDistance = Math.round(haversineDistance(prevLat, prevLng, stop.lat, stop.lng) * 10) / 10;
      legDuration = estimateDriveMinutes(legDistance);
    }

    // Duplicate address handling: if same exact coords as previous, zero leg
    if (i > 0) {
      const prev = sequenced[i - 1];
      if (Math.abs(stop.lat - prev.lat) < 0.0001 && Math.abs(stop.lng - prev.lng) < 0.0001) {
        legDistance = 0;
        legDuration = 0;
      }
    }

    runningDistance += legDistance;
    runningDuration += legDuration;

    const arrivalMinutes = DEFAULT_DEPARTURE_MINUTES + runningDuration;

    return {
      ...stop,
      stopNumber: i + 1,
      distanceFromPrev: legDistance,
      durationFromPrev: legDuration,
      runningDistance: Math.round(runningDistance * 10) / 10,
      runningDuration: Math.round(runningDuration),
      hasTimeConstraint: hour !== null,
      clusterLabel: stop.clusterLabel,
      estimatedArrival: minutesToClockTime(arrivalMinutes),
    };
  });

  // Return leg (last stop → bakery)
  const lastLegIdx = sequenced.length; // index into OSRM distances array
  let returnDistance: number;
  let returnDuration: number;

  if (osrmResult && lastLegIdx < osrmResult.distances.length) {
    returnDistance = osrmResult.distances[lastLegIdx];
    returnDuration = osrmResult.durations[lastLegIdx];
  } else if (sequenced.length > 0) {
    const last = sequenced[sequenced.length - 1];
    returnDistance = Math.round(haversineDistance(last.lat, last.lng, BAKERY_LAT, BAKERY_LNG) * 10) / 10;
    returnDuration = estimateDriveMinutes(returnDistance);
  } else {
    returnDistance = 0;
    returnDuration = 0;
  }

  const totalDistance = Math.round((runningDistance + returnDistance) * 10) / 10;
  const totalDuration = Math.round(runningDuration + returnDuration);

  const departureTime = minutesToClockTime(DEFAULT_DEPARTURE_MINUTES);
  const estimatedReturnMinutes = DEFAULT_DEPARTURE_MINUTES + totalDuration;
  const estimatedReturn = minutesToClockTime(estimatedReturnMinutes);

  console.log(`[Route] Depart ${departureTime}, Return ~${estimatedReturn} | ${totalDistance} mi, ${totalDuration} min, ${manifestStops.length} stops, return leg: ${returnDistance} mi`);
  if (skippedStops.length > 0) {
    console.warn(`[Route] ${skippedStops.length} stop(s) skipped:`, skippedStops.map(s => s.orderNumber).join(', '));
  }

  return {
    stops: manifestStops,
    totalDistance,
    totalDuration,
    returnDistance: Math.round(returnDistance * 10) / 10,
    returnDuration: Math.round(returnDuration),
    routeGeometry: osrmResult?.geometry || [],
    orderCount: stops.length,
    clusterCount: clusters.length,
    departureTime,
    estimatedReturn,
    skippedStops,
  };
}
