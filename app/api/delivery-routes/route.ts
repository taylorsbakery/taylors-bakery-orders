export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/db';
import { geocodeAddress, geocodeOrderAddress, geocodeChildLocation } from '@/lib/geocoding';
import { optimizeRoute, RouteStop } from '@/lib/route-optimizer';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any).role;
    if (role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 });

    const dateStr = req.nextUrl.searchParams.get('date');
    if (!dateStr) return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });

    const dateObj = new Date(dateStr + 'T00:00:00.000Z');
    const nextDay = new Date(dateObj);
    nextDay.setDate(nextDay.getDate() + 1);

    // Fetch delivery orders for the date
    const orders = await prisma.order.findMany({
      where: {
        deliveryDate: { gte: dateObj, lt: nextDay },
        status: { notIn: ['cancelled', 'draft'] },
        pickupOrDelivery: 'delivery',
      },
      include: {
        parentAccount: { select: { displayName: true } },
        childLocation: { select: { id: true, locationName: true, deliveryAddress: true, latitude: true, longitude: true, deliveryContactPhone: true } },
        orderItems: { select: { productName: true, quantity: true } },
      },
      orderBy: { deliveryTime: 'asc' },
    });

    if (orders.length === 0) {
      return NextResponse.json({ stops: [], totalDistance: 0, totalDuration: 0, returnDistance: 0, returnDuration: 0, routeGeometry: [], orderCount: 0, clusterCount: 0 });
    }

    // Geocode all addresses
    const stops: RouteStop[] = [];
    const geocodeErrors: string[] = [];

    for (const order of orders) {
      const address = order.deliveryAddress || order.childLocation?.deliveryAddress;
      if (!address) {
        geocodeErrors.push(`Order ${order.orderNumber}: No delivery address`);
        continue;
      }

      let coords: { lat: number; lng: number } | null = null;

      // Try cached child location first
      if (order.childLocation?.latitude && order.childLocation?.longitude) {
        coords = { lat: order.childLocation.latitude, lng: order.childLocation.longitude };
      } else if (order.childLocationId) {
        const cached = await geocodeChildLocation(order.childLocationId);
        if (cached) coords = { lat: cached.lat, lng: cached.lng };
      }

      // Fallback to geocoding the delivery address
      if (!coords && address) {
        if (order.childLocationId) {
          coords = await geocodeOrderAddress(address, order.childLocationId);
        } else {
          coords = await geocodeAddress(address);
        }
      }

      if (!coords) {
        geocodeErrors.push(`Order ${order.orderNumber}: Could not geocode "${address}"`);
        continue;
      }

      // Validate coordinates are within Indiana service area
      const IN_LAT_MIN = 37.7, IN_LAT_MAX = 41.8, IN_LNG_MIN = -88.1, IN_LNG_MAX = -84.7;
      if (
        isNaN(coords.lat) || isNaN(coords.lng) ||
        coords.lat < IN_LAT_MIN || coords.lat > IN_LAT_MAX ||
        coords.lng < IN_LNG_MIN || coords.lng > IN_LNG_MAX
      ) {
        console.warn(`[Route] Order ${order.orderNumber}: coords (${coords.lat}, ${coords.lng}) outside Indiana service area — skipping`);
        geocodeErrors.push(`Order ${order.orderNumber}: Address "${address}" geocoded outside service area (${coords.lat.toFixed(2)}, ${coords.lng.toFixed(2)})`);
        continue;
      }

      const itemSummary = (order.orderItems || [])
        .map((i: any) => `${i.quantity}x ${i.productName}`)
        .join(', ');

      stops.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        accountName: order.parentAccount?.displayName || 'Unknown',
        locationName: order.childLocation?.locationName || '',
        deliveryAddress: address,
        deliveryTime: order.deliveryTime,
        customerPhone: order.customerPhone || order.childLocation?.deliveryContactPhone || null,
        specialNotes: order.specialNotes,
        lat: coords.lat,
        lng: coords.lng,
        total: order.total,
        itemSummary,
        status: order.status,
        deliveredAt: order.deliveredAt?.toISOString() || null,
        deliveryNotes: order.deliveryNotes,
      });
    }

    // Optimize route
    const optimized = await optimizeRoute(stops);

    // Save stop numbers back to orders
    for (const stop of optimized.stops) {
      await prisma.order.update({
        where: { id: stop.orderId },
        data: { deliveryStop: stop.stopNumber },
      });
    }

    return NextResponse.json({
      ...optimized,
      orderCount: orders.length,
      geocodeErrors,
    });
  } catch (err: any) {
    console.error('GET /api/delivery-routes error:', err);
    return NextResponse.json({ error: 'Failed to generate route' }, { status: 500 });
  }
}
