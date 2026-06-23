const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function clean(value = "", max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function getBlobStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || "";

  if (!siteID || !token) {
    throw new Error("Online opslag is nog niet gekoppeld.");
  }

  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: STORE_NAME, siteID, token });
}

function sanitizeOrder(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Ongeldige bestelling.");
  }

  const items = Array.isArray(input.items)
    ? input.items
        .map((item) => ({
          productId: clean(item.productId, 120),
          name: clean(item.name, 180),
          price: number(item.price),
          quantity: Math.max(1, Math.min(99, Math.round(number(item.quantity) || 1))),
          image: clean(item.image, 4000),
        }))
        .filter((item) => item.productId && item.name && item.price >= 0)
    : [];

  if (!items.length) {
    throw new Error("Bestelling heeft geen producten.");
  }

  const customer = {
    name: clean(input.customer?.name, 160),
    email: clean(input.customer?.email, 220).toLowerCase(),
    phone: clean(input.customer?.phone, 80),
    address: clean(input.customer?.address, 220),
    postalCode: clean(input.customer?.postalCode, 40),
    city: clean(input.customer?.city, 120),
    country: clean(input.customer?.country, 120),
  };

  if (!customer.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) {
    throw new Error("Klantgegevens zijn niet compleet.");
  }

  return {
    id: clean(input.id, 80) || `TD-${Date.now()}`,
    createdAt: clean(input.createdAt, 80) || new Date().toISOString(),
    status: clean(input.status, 80) || "Nieuw",
    paymentStatus: clean(input.paymentStatus, 120) || "Wacht op bevestiging",
    customer,
    items,
    discountCode: clean(input.discountCode, 80).toUpperCase(),
    discountAmount: number(input.discountAmount),
    freeShipping: Boolean(input.freeShipping),
    freeShippingFrom: number(input.freeShippingFrom),
    giftCardCode: clean(input.giftCardCode, 80).toUpperCase(),
    giftCardAmount: number(input.giftCardAmount),
    giftCardInitialBalance: number(input.giftCardInitialBalance),
    giftCardRemainingBalance: number(input.giftCardRemainingBalance),
    total: number(input.total),
    notes: clean(input.notes, 4000),
    adminNotes: "",
    trackTrace: "",
    trackTraceMailSent: false,
    trackTraceMailSentAt: "",
    paymentInstructionsSent: false,
    paymentInstructionsSentAt: "",
    shippingMethod: clean(input.shippingMethod, 120) || "Wordt afgestemd",
    statusHistory: [
      {
        at: clean(input.createdAt, 80) || new Date().toISOString(),
        type: "created",
        from: "-",
        to: "Aanvraag ontvangen",
      },
      ...(Array.isArray(input.statusHistory) ? input.statusHistory.slice(0, 10) : []),
    ],
  };
}

function upsertCustomer(customers, order) {
  const existing = customers.find(
    (customer) => String(customer.email || "").toLowerCase() === order.customer.email,
  );

  if (existing) {
    existing.name = order.customer.name;
    existing.phone = order.customer.phone || existing.phone || "";
    existing.address = order.customer.address || existing.address || "";
    existing.postalCode = order.customer.postalCode || existing.postalCode || "";
    existing.city = order.customer.city || existing.city || "";
    existing.country = order.customer.country || existing.country || "";
    existing.orderCount = Number(existing.orderCount || 0) + 1;
    existing.totalSpent = Number((Number(existing.totalSpent || 0) + order.total).toFixed(2));
    existing.lastOrderAt = order.createdAt.slice(0, 10);
    return customers;
  }

  return [
    {
      id: `klant-${Date.now()}`,
      ...order.customer,
      notes: "",
      orderCount: 1,
      totalSpent: order.total,
      lastOrderAt: order.createdAt.slice(0, 10),
    },
    ...customers,
  ];
}

function reduceStock(products, order) {
  return products.map((product) => {
    const ordered = order.items.find((item) => item.productId === product.id);
    if (!ordered || !Number.isFinite(Number(product.stockQuantity))) {
      return product;
    }

    return {
      ...product,
      stockQuantity: Math.max(0, Number(product.stockQuantity) - ordered.quantity),
    };
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const order = sanitizeOrder(payload.order);
    const store = await getBlobStore();
    const data = (await store.get(DATA_KEY, { type: "json" })) || {};
    const orders = Array.isArray(data.orders) ? data.orders : [];

    if (orders.some((item) => item.id === order.id)) {
      return json(200, { ok: true, duplicate: true });
    }

    const discounts = Array.isArray(data.discounts) ? data.discounts : [];
    const giftCards = Array.isArray(data.giftCards) ? data.giftCards : [];
    const updatedDiscounts = order.discountCode
      ? discounts.map((discount) =>
          String(discount.code || "").toUpperCase() === order.discountCode
            ? { ...discount, uses: Number(discount.uses || 0) + 1 }
            : discount,
        )
      : discounts;
    const updatedGiftCards = order.giftCardCode
      ? giftCards.map((giftCard) =>
          String(giftCard.code || "").toUpperCase() === order.giftCardCode
            ? {
                ...giftCard,
                balance: Math.max(0, Number((Number(giftCard.balance || 0) - order.giftCardAmount).toFixed(2))),
              }
            : giftCard,
        )
      : giftCards;

    await store.setJSON(DATA_KEY, {
      ...data,
      orders: [order, ...orders],
      customers: upsertCustomer(Array.isArray(data.customers) ? data.customers : [], order),
      products: reduceStock(Array.isArray(data.products) ? data.products : [], order),
      discounts: updatedDiscounts,
      giftCards: updatedGiftCards,
      updatedAt: new Date().toISOString(),
    });

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { ok: false, message: error.message || "Bestelling kon niet online worden opgeslagen." });
  }
};
