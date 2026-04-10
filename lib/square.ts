export const dynamic = 'force-dynamic';

const SQUARE_SANDBOX_URL = 'https://connect.squareupsandbox.com/v2';
const SQUARE_PRODUCTION_URL = 'https://connect.squareup.com/v2';

function getSquareConfig() {
  const env = process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
  const isSandbox = env === 'sandbox';
  return {
    baseUrl: isSandbox ? SQUARE_SANDBOX_URL : SQUARE_PRODUCTION_URL,
    accessToken: isSandbox
      ? (process.env.SQUARE_SANDBOX_ACCESS_TOKEN ?? '')
      : (process.env.SQUARE_PRODUCTION_ACCESS_TOKEN ?? ''),
    applicationId: isSandbox
      ? (process.env.SQUARE_SANDBOX_APPLICATION_ID ?? '')
      : (process.env.SQUARE_PRODUCTION_APPLICATION_ID ?? ''),
    environment: env,
  };
}

export function getSquareEnvironment() {
  return process.env.SQUARE_ENVIRONMENT ?? 'sandbox';
}

async function squareFetch(endpoint: string, options: any = {}) {
  const config = getSquareConfig();
  const url = `${config.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Square API Error:', JSON.stringify(data));
    throw new Error(data?.errors?.[0]?.detail ?? `Square API error: ${response.status}`);
  }
  return data;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

// Customers API
export async function createSquareCustomer(params: {
  givenName?: string;
  familyName?: string;
  companyName?: string;
  emailAddress?: string;
  phoneNumber?: string;
  address?: { addressLine1?: string; locality?: string; administrativeDistrictLevel1?: string; postalCode?: string; country?: string };
  referenceId?: string;
  note?: string;
}) {
  const body: any = { idempotency_key: generateIdempotencyKey() };
  if (params?.givenName) body.given_name = params.givenName;
  if (params?.familyName) body.family_name = params.familyName;
  if (params?.companyName) body.company_name = params.companyName;
  if (params?.emailAddress) body.email_address = params.emailAddress;
  if (params?.phoneNumber) body.phone_number = params.phoneNumber;
  if (params?.referenceId) body.reference_id = params.referenceId;
  if (params?.note) body.note = params.note;
  if (params?.address) {
    body.address = {};
    if (params.address?.addressLine1) body.address.address_line_1 = params.address.addressLine1;
    if (params.address?.locality) body.address.locality = params.address.locality;
    if (params.address?.administrativeDistrictLevel1) body.address.administrative_district_level_1 = params.address.administrativeDistrictLevel1;
    if (params.address?.postalCode) body.address.postal_code = params.address.postalCode;
    body.address.country = params.address?.country ?? 'US';
  }
  return squareFetch('/customers', { method: 'POST', body: JSON.stringify(body) });
}

export async function updateSquareCustomer(customerId: string, params: any) {
  const body: any = {};
  if (params?.givenName) body.given_name = params.givenName;
  if (params?.familyName) body.family_name = params.familyName;
  if (params?.companyName) body.company_name = params.companyName;
  if (params?.emailAddress) body.email_address = params.emailAddress;
  if (params?.phoneNumber) body.phone_number = params.phoneNumber;
  if (params?.note) body.note = params.note;
  return squareFetch(`/customers/${customerId}`, { method: 'PUT', body: JSON.stringify(body) });
}

export async function searchSquareCustomers(query: string) {
  const body = {
    query: {
      filter: {
        email_address: { fuzzy: query },
      },
    },
  };
  return squareFetch('/customers/search', { method: 'POST', body: JSON.stringify(body) });
}

// Catalog API — paginated to fetch ALL items
export async function listSquareCatalogItems() {
  const allObjects: any[] = [];
  const allRelated: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = {
      object_types: ['ITEM'],
      include_related_objects: true,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const data = await squareFetch('/catalog/search', { method: 'POST', body: JSON.stringify(body) });
    allObjects.push(...(data?.objects ?? []));
    allRelated.push(...(data?.related_objects ?? []));
    cursor = data?.cursor;
  } while (cursor);

  return { objects: allObjects, related_objects: allRelated };
}

// Fetch ALL categories from Square catalog
export async function listSquareCategories() {
  const allObjects: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = {
      object_types: ['CATEGORY'],
      include_related_objects: false,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const data = await squareFetch('/catalog/search', { method: 'POST', body: JSON.stringify(body) });
    allObjects.push(...(data?.objects ?? []));
    cursor = data?.cursor;
  } while (cursor);

  return { objects: allObjects };
}

// Fetch ALL modifier lists with pagination
export async function listSquareModifierLists() {
  const allObjects: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = {
      object_types: ['MODIFIER_LIST'],
      include_related_objects: false,
      limit: 100,
    };
    if (cursor) body.cursor = cursor;

    const data = await squareFetch('/catalog/search', { method: 'POST', body: JSON.stringify(body) });
    allObjects.push(...(data?.objects ?? []));
    cursor = data?.cursor;
  } while (cursor);

  return { objects: allObjects };
}

export async function getSquareCatalogItem(objectId: string) {
  return squareFetch(`/catalog/object/${objectId}?include_related_objects=true`, { method: 'GET' });
}

// Catalog API - Create item
export async function upsertSquareCatalogItem(params: {
  name: string;
  description?: string;
  categoryId?: string;
  variations: Array<{ name: string; priceCents: number }>;
  modifierListIds?: string[];
}) {
  const idempotencyKey = generateIdempotencyKey();

  // Build variation objects with temporary IDs
  const variationObjects = params.variations.map((v, i) => ({
    type: 'ITEM_VARIATION',
    id: `#variation_${i}`,
    item_variation_data: {
      name: v.name,
      pricing_type: 'FIXED_PRICING',
      price_money: { amount: v.priceCents, currency: 'USD' },
      available_at_all_locations: true,
    },
  }));

  const modifierListInfo = (params.modifierListIds ?? []).map(id => ({
    modifier_list_id: id,
    enabled: true,
  }));

  const itemData: any = {
    name: params.name,
    description: params.description || undefined,
    variations: variationObjects,
    modifier_list_info: modifierListInfo.length > 0 ? modifierListInfo : undefined,
    available_at_all_locations: true,
  };
  if (params.categoryId) {
    itemData.category_id = params.categoryId;
  }

  const body: any = {
    idempotency_key: idempotencyKey,
    object: {
      type: 'ITEM',
      id: '#new_item',
      item_data: itemData,
    },
  };

  const data = await squareFetch('/catalog/object', { method: 'POST', body: JSON.stringify(body) });
  const catalogObject = data?.catalog_object ?? {};
  const resultItemData = catalogObject?.item_data ?? {};
  const returnedVariations = (resultItemData?.variations ?? []).map((v: any) => ({
    id: v?.id ?? '',
    name: v?.item_variation_data?.name ?? '',
    priceCents: v?.item_variation_data?.price_money?.amount ?? 0,
  }));

  return {
    catalogItemId: catalogObject?.id ?? '',
    variations: returnedVariations,
  };
}

// Orders API
export async function createSquareOrder(params: {
  lineItems: Array<{
    name: string;
    quantity: string;
    basePriceMoney: { amount: number; currency: string };
    note?: string;
    catalogObjectId?: string; // Square catalog variation ID
  }>;
  customerId?: string;
  referenceId?: string;
  fulfillmentType?: string; // 'PICKUP' or 'SHIPMENT' (delivery)
  fulfillmentRecipient?: {
    displayName?: string;
    phoneNumber?: string;
    address?: string;
  };
}) {
  const config = getSquareConfig();
  const locationsData = await squareFetch('/locations', { method: 'GET' });
  const locationId = locationsData?.locations?.[0]?.id ?? '';
  
  const body: any = {
    idempotency_key: generateIdempotencyKey(),
    order: {
      location_id: locationId,
      line_items: (params?.lineItems ?? []).map((item: any) => {
        const amountCents = Math.round((item?.basePriceMoney?.amount ?? 0) * 100);
        const lineItem: any = {
          quantity: String(item?.quantity ?? '1'),
          name: item?.name ?? 'Item',
          base_price_money: {
            amount: amountCents,
            currency: item?.basePriceMoney?.currency ?? 'USD',
          },
        };
        // Attach catalog_object_id if available for Square reporting
        if (item?.catalogObjectId) {
          lineItem.catalog_object_id = item.catalogObjectId;
        }
        if (item?.note) lineItem.note = item.note;
        return lineItem;
      }),
      reference_id: params?.referenceId ?? undefined,
      // Add fulfillment so the order shows in Square Dashboard Orders tab
      fulfillments: [{
        type: params?.fulfillmentType === 'PICKUP' ? 'PICKUP' : 'SHIPMENT',
        state: 'PROPOSED',
        ...(params?.fulfillmentType === 'PICKUP' ? {
          pickup_details: {
            recipient: {
              display_name: params?.fulfillmentRecipient?.displayName ?? 'Taylor\'s Bakery Customer',
              phone_number: params?.fulfillmentRecipient?.phoneNumber ?? undefined,
            },
            schedule_type: 'SCHEDULED',
            pickup_at: new Date(Date.now() + 86400000).toISOString(),
          },
        } : {
          shipment_details: {
            recipient: {
              display_name: params?.fulfillmentRecipient?.displayName ?? 'Taylor\'s Bakery Customer',
              phone_number: params?.fulfillmentRecipient?.phoneNumber ?? undefined,
              ...(params?.fulfillmentRecipient?.address ? {
                address: {
                  address_line_1: params.fulfillmentRecipient.address,
                  country: 'US',
                },
              } : {}),
            },
            expected_shipped_at: new Date(Date.now() + 86400000).toISOString(),
          },
        }),
      }],
    },
  };
  if (params?.customerId) {
    body.order.customer_id = params.customerId;
  }
  return squareFetch('/orders', { method: 'POST', body: JSON.stringify(body) });
}

// Invoices API
export async function createSquareInvoice(params: {
  orderId: string;
  customerId: string;
  dueDate: string;
  title?: string;
  paymentRequests?: Array<{ requestType: string; dueDate: string }>;
}) {
  const locationsData = await squareFetch('/locations', { method: 'GET' });
  const locationId = locationsData?.locations?.[0]?.id ?? '';

  const body: any = {
    idempotency_key: generateIdempotencyKey(),
    invoice: {
      location_id: locationId,
      order_id: params?.orderId ?? '',
      primary_recipient: {
        customer_id: params?.customerId ?? '',
      },
      payment_requests: [{
        request_type: 'BALANCE',
        due_date: params?.dueDate ?? new Date().toISOString().split('T')[0],
        automatic_payment_source: 'NONE',
        reminders: [
          {
            relative_scheduled_days: -7,
            message: 'Your invoice from Taylor\'s Bakery is due in 7 days. Please submit payment at your earliest convenience.',
          },
          {
            relative_scheduled_days: -1,
            message: 'Friendly reminder: Your invoice from Taylor\'s Bakery is due tomorrow.',
          },
          {
            relative_scheduled_days: 0,
            message: 'Your invoice from Taylor\'s Bakery is due today. Please submit payment.',
          },
          {
            relative_scheduled_days: 7,
            message: 'Your invoice from Taylor\'s Bakery is now 7 days past due. Please submit payment as soon as possible.',
          },
          {
            relative_scheduled_days: 14,
            message: 'Your invoice from Taylor\'s Bakery is 14 days past due. Please contact us if you have any questions about your balance.',
          },
        ],
      }],
      delivery_method: 'EMAIL',
      title: params?.title ?? 'Taylor\'s Bakery Order',
      accepted_payment_methods: {
        card: true,
        bank_account: false,
        square_gift_card: false,
        buy_now_pay_later: false,
      },
    },
  };
  return squareFetch('/invoices', { method: 'POST', body: JSON.stringify(body) });
}

export async function publishSquareInvoice(invoiceId: string, version: number) {
  const body = {
    idempotency_key: generateIdempotencyKey(),
    version: version,
  };
  return squareFetch(`/invoices/${invoiceId}/publish`, { method: 'POST', body: JSON.stringify(body) });
}

export async function getSquareLocations() {
  return squareFetch('/locations', { method: 'GET' });
}

// Fetch ALL customers from Square with pagination
export async function listAllSquareCustomers() {
  const allCustomers: any[] = [];
  let cursor: string | undefined;

  do {
    const body: any = { limit: 100 };
    if (cursor) body.cursor = cursor;

    const data = await squareFetch('/customers/search', {
      method: 'POST',
      body: JSON.stringify({ query: { filter: {}, sort: { field: 'CREATED_AT', order: 'ASC' } }, limit: 100, ...(cursor ? { cursor } : {}) }),
    });
    allCustomers.push(...(data?.customers ?? []));
    cursor = data?.cursor;
  } while (cursor);

  return allCustomers;
}
