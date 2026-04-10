import { prisma } from '@/lib/db';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const GEOCODE_CACHE_DAYS = 90; // Re-geocode after 90 days

interface GeoResult {
  lat: number;
  lng: number;
  cached: boolean;
}

// Rate limit: 1 request per second for Nominatim
let lastRequestTime = 0;
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: { 'User-Agent': 'TaylorsBakeryOrders/1.0 (scottburrowsinbox@gmail.com)' },
  });
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const res = await rateLimitedFetch(`${NOMINATIM_URL}?q=${encoded}&format=json&limit=1&countrycodes=us`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch (err) {
    console.error('Geocoding error for:', address, err);
    return null;
  }
}

export async function geocodeChildLocation(locationId: string): Promise<GeoResult | null> {
  const loc = await prisma.childLocation.findUnique({ where: { id: locationId } });
  if (!loc || !loc.deliveryAddress) return null;

  // Check cache
  if (loc.latitude && loc.longitude && loc.geocodedAt) {
    const daysSinceGeocoded = (Date.now() - loc.geocodedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceGeocoded < GEOCODE_CACHE_DAYS) {
      return { lat: loc.latitude, lng: loc.longitude, cached: true };
    }
  }

  // Geocode
  const result = await geocodeAddress(loc.deliveryAddress);
  if (!result) return null;

  // Cache in DB
  await prisma.childLocation.update({
    where: { id: locationId },
    data: { latitude: result.lat, longitude: result.lng, geocodedAt: new Date() },
  });

  return { lat: result.lat, lng: result.lng, cached: false };
}

// Also geocode from a raw delivery address (for orders that override location address)
export async function geocodeOrderAddress(address: string, childLocationId: string): Promise<{ lat: number; lng: number } | null> {
  // First try the child location cache
  const loc = await prisma.childLocation.findUnique({ where: { id: childLocationId } });
  if (loc?.deliveryAddress === address && loc.latitude && loc.longitude) {
    return { lat: loc.latitude, lng: loc.longitude };
  }

  // Geocode the specific address
  return geocodeAddress(address);
}
