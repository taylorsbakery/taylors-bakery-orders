'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BAKERY_LAT = 39.8876;
const BAKERY_LNG = -86.1078;

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

interface Stop {
  stopNumber: number;
  lat: number;
  lng: number;
  accountName: string;
  locationName: string;
  deliveryAddress: string;
  deliveredAt: string | null;
}

interface RouteMapProps {
  stops: Stop[];
  routeGeometry: [number, number][];
}

function createNumberedIcon(num: number, delivered: boolean, outOfArea: boolean = false) {
  const color = outOfArea ? '#EF4444' : delivered ? '#059669' : '#D97706';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="${color}"/>
    <circle cx="16" cy="15" r="11" fill="white"/>
    <text x="16" y="20" text-anchor="middle" font-size="13" font-weight="bold" fill="${color}" font-family="sans-serif">${num}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -40],
  });
}

function createBakeryIcon() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.06 27.94 0 18 0z" fill="#DC2626"/>
    <circle cx="18" cy="17" r="12" fill="white"/>
    <text x="18" y="22" text-anchor="middle" font-size="16" fill="#DC2626" font-family="sans-serif">⌂</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
  });
}

const OSM_TILE_URL = 'https://' + '{s}' + '.tile.openstreetmap.org/' + '{z}' + '/' + '{x}' + '/' + '{y}' + '.png';

export function RouteMap({ stops, routeGeometry }: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !mapRef.current) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      center: [BAKERY_LAT, BAKERY_LNG],
      zoom: 11,
      scrollWheelZoom: true,
    });
    mapInstanceRef.current = map;

    L.tileLayer(OSM_TILE_URL, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Bakery marker
    L.marker([BAKERY_LAT, BAKERY_LNG], { icon: createBakeryIcon() })
      .addTo(map)
      .bindPopup('<b>Taylor\'s Bakery</b><br/>6216 Allisonville Rd');

    // Stop markers — only plot valid, in-service-area coordinates
    const bounds: L.LatLngExpression[] = [[BAKERY_LAT, BAKERY_LNG]];
    for (const stop of stops) {
      if (!isValidCoordinate(stop.lat, stop.lng)) continue;

      const outOfArea = !isInServiceArea(stop.lat, stop.lng);
      const marker = L.marker([stop.lat, stop.lng], {
        icon: createNumberedIcon(stop.stopNumber, !!stop.deliveredAt, outOfArea),
      }).addTo(map);

      const warningHtml = outOfArea ? '<br/><span style="color:#EF4444;font-weight:bold">⚠ Outside service area — verify address</span>' : '';
      marker.bindPopup(
        `<b>Stop ${stop.stopNumber}: ${stop.accountName}</b><br/>${stop.locationName}<br/><small>${stop.deliveryAddress}</small>${stop.deliveredAt ? '<br/><span style="color:#059669">\u2713 Delivered</span>' : ''}${warningHtml}`
      );

      // Only include in-area stops in the bounds calculation
      if (!outOfArea) {
        bounds.push([stop.lat, stop.lng]);
      }
    }

    // Route line
    if (routeGeometry.length > 1) {
      L.polyline(routeGeometry, {
        color: '#D97706',
        weight: 4,
        opacity: 0.8,
        dashArray: '8, 4',
      }).addTo(map);
    }

    // Fit bounds
    if (bounds.length > 1) {
      map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40] });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mounted, stops, routeGeometry]);

  if (!mounted) return <div className="h-[400px] bg-muted rounded-xl animate-pulse" />;

  return <div ref={mapRef} className="h-[400px] md:h-[500px] rounded-xl border shadow-sm z-0" />;
}
