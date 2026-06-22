const {
  blobsConfigured,
  readSiteData,
  writeSiteData,
  productsFromData,
  ordersFromData,
  discountsFromData,
  giftCardsFromData,
  normalizeMoney,
  isDirectPayable,
  stockQuantity,
  formatMoney,
} = require("./lib/shop-data");

const DIRECT_PAYMENT_NOTE =
  "Dit product wordt eerst afgestemd. Je ontvangt betaalinformatie nadat we je aanvraag hebben bevestigd.";

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

function clean(value, maxLength = 1000) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function mollieHeaders() {
  // Voor live betalingen moet MOLLIE_API_KEY in Netlify worden vervangen door een live Mollie API key.
  if (!process.env.MOLLIE_API_KEY) {
    throw new Error("Mollie is nog niet ingesteld. Voeg MOLLIE_API_KEY toe in Netlify.");
  }

  return {
    Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function baseUrl() {
  return (process.env.SHOP_BASE_URL || process.env.URL || "").replace(/\/$/, "");
}

function makeOrderId(prefix = "TD") {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
    Math.random() * 900 + 100,
  )}`;
}

function activeDiscount(discounts, code) {
  return discounts.find(
    (discount) => discount.active && discount.code?.toUpperCase() === String(code || "").toUpperCase(),
  );
}

function activeGiftCard(giftCards, code) {
  const today = new Date().toISOString().slice(0, 10);
  return giftCards.find(
    (giftCard) =>
      giftCard.active &&
      Number(giftCard.balance || 0) > 0 &&
      giftCard.code?.toUpperCase() === String(code || "").toUpperCase() &&
      (!giftCard.expiresAt || giftCard.expiresAt >= today),
  );
}

function buildCustomer(payload) {
  const customer = {
    name: clean(payload.customer?.name, 160),
    email: clean(payload.customer?.email, 200).toLowerCase(),
    phone: clean(payload.customer?.phone, 80),
    address: clean(payload.customer?.address, 240),
    postalCode: clean(payload.customer?.postalCode, 40),
    city: clean(payload.customer?.city, 120),
    country: clean(payload.customer?.country || "Nederland", 120),
  };

  if (!customer.name || !isEmail(customer.email)) {
    throw new Error("Vul een geldige naam en e-mailadres in.");
  }

  return customer;
}

function buildCartOrder(payload, data) {
  const products = productsFromData(data);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    throw new Error("Je winkelmandje is nog leeg.");
  }

  const orderItems = items.map((item) => {
    const product = products.find((candidate) => candidate.id === clean(item.productId, 120));
    const quantity = Math.max(1, Math.min(20, Number(item.quantity || 1)));

    if (!product) {
      throw new Error("Een product uit je winkelmandje is niet gevonden.");
    }
    if (!isDirectPayable(product)) {
      throw new Error(DIRECT_PAYMENT_NOTE);
    }
    if (quantity > stockQuantity(product)) {
      throw new Error(`${product.name} is niet meer voldoende op voorraad.`);
    }

    return {
      productId: product.id,
      name: product.name,
      price: normalizeMoney(product.price),
      quantity,
      image: product.image || "",
    };
  });

  if (payload.giftWrap) {
    const price = normalizeMoney(data.settings?.giftWrapPrice || 2.95);
    orderItems.push({
      productId: "cadeauverpakking",
      name: "Cadeauverpakking",
      price,
      quantity: 1,
    });
  }

  const subtotal = normalizeMoney(orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const discount = activeDiscount(discountsFromData(data), payload.discountCode);
  const discountAmount = discount
    ? Math.min(
        subtotal,
        normalizeMoney(discount.type === "percent" ? subtotal * (Number(discount.value || 0) / 100) : discount.value),
      )
    : 0;
  const afterDiscount = normalizeMoney(subtotal - discountAmount);
  const giftCard = activeGiftCard(giftCardsFromData(data), payload.giftCardCode);
  const giftCardAmount = giftCard ? Math.min(afterDiscount, normalizeMoney(giftCard.balance)) : 0;
  const total = normalizeMoney(afterDiscount - giftCardAmount);

  if (total < 0.01) {
    throw new Error("Het totaalbedrag moet minimaal 1 cent zijn om online te betalen.");
  }

  return {
    id: makeOrderId("TD"),
    type: "cart",
    createdAt: new Date().toISOString(),
    status: "Wacht op betaling",
    paymentStatus: "pending_payment",
    paymentProvider: "mollie",
    paymentHandled: false,
    paidEmailSent: false,
    customer: buildCustomer(payload),
    items: orderItems,
    discountCode: discount ? discount.code : "",
    discountAmount,
    giftCardCode: giftCard ? giftCard.code : "",
    giftCardAmount,
    total,
    notes: [clean(payload.notes, 2000), payload.giftWrap ? `Persoonlijk kaartje: ${clean(payload.giftMessage, 1000) || "-"}` : ""]
      .filter(Boolean)
      .join("\n"),
    adminNotes: "",
    trackTrace: "",
    shippingMethod: "Wordt afgestemd",
    statusHistory: [
      {
        at: new Date().toISOString(),
        type: "payment",
        from: "",
        to: "pending_payment",
      },
    ],
  };
}

function buildGiftCardOrder(payload) {
  const amount = normalizeMoney(payload.amount);
  const allowedAmounts = [15, 25, 50, 75];
  if (!allowedAmounts.includes(amount)) {
    throw new Error("Kies een geldig cadeaubonbedrag.");
  }

  const customer = buildCustomer(payload);
  const recipient = clean(payload.recipient, 160);
  const recipientEmail = clean(payload.recipientEmail || customer.email, 200).toLowerCase();
  if (recipientEmail && !isEmail(recipientEmail)) {
    throw new Error("Vul een geldig e-mailadres voor de ontvanger in.");
  }

  return {
    id: makeOrderId("CB"),
    type: "gift-card",
    createdAt: new Date().toISOString(),
    status: "Wacht op betaling",
    paymentStatus: "pending_payment",
    paymentProvider: "mollie",
    paymentHandled: false,
    paidEmailSent: false,
    customer,
    recipient,
    recipientEmail,
    items: [
      {
        productId: "cadeaubon",
        name: `Cadeaubon ${formatMoney(amount)}`,
        price: amount,
        quantity: 1,
      },
    ],
    total: amount,
    notes: [
      "Cadeaubonaanvraag: cadeauboncode pas aanmaken vanuit beheer na betaling.",
      `Cadeaubon voor: ${recipient || "-"}`,
      `E-mail ontvanger: ${recipientEmail || customer.email}`,
      `Bericht: ${clean(payload.message, 2000) || "-"}`,
    ].join("\n"),
    adminNotes: "",
    statusHistory: [
      {
        at: new Date().toISOString(),
        type: "payment",
        from: "",
        to: "pending_payment",
      },
    ],
  };
}

async function createMolliePayment(order) {
  const shopBaseUrl = baseUrl();
  if (!shopBaseUrl) {
    throw new Error("SHOP_BASE_URL is nog niet ingesteld in Netlify.");
  }

  const response = await fetch("https://api.mollie.com/v2/payments", {
    method: "POST",
    headers: mollieHeaders(),
    body: JSON.stringify({
      amount: {
        currency: "EUR",
        value: order.total.toFixed(2),
      },
      description: `${order.id} - Tiny Doll Atelier`,
      redirectUrl: `${shopBaseUrl}/bedankt.html?orderId=${encodeURIComponent(order.id)}`,
      webhookUrl: `${shopBaseUrl}/.netlify/functions/mollie-webhook`,
      metadata: {
        orderId: order.id,
        orderType: order.type,
      },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || data.message || "Mollie betaling kon niet worden aangemaakt.");
  }

  return {
    id: data.id,
    checkoutUrl: data._links?.checkout?.href,
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Alleen POST is toegestaan." });
  }

  try {
    if (!blobsConfigured()) {
      return json(503, {
        ok: false,
        message: "Online opslag is nodig voor online betalen. Controleer Netlify Blobs instellingen.",
      });
    }

    if ((process.env.PAYMENT_PROVIDER || "mollie").toLowerCase() !== "mollie") {
      return json(503, { ok: false, message: "Mollie betalingen zijn nog niet geactiveerd." });
    }

    const payload = JSON.parse(event.body || "{}");
    if (clean(payload.website, 200)) {
      return json(400, { ok: false, message: "Betaling geweigerd." });
    }

    const data = await readSiteData();
    const order = payload.type === "gift-card" ? buildGiftCardOrder(payload) : buildCartOrder(payload, data);
    const payment = await createMolliePayment(order);
    if (!payment.checkoutUrl) {
      throw new Error("Mollie gaf geen checkoutUrl terug.");
    }

    order.molliePaymentId = payment.id;
    order.paymentCheckoutUrl = payment.checkoutUrl;

    await writeSiteData({
      ...data,
      orders: [order, ...ordersFromData(data).filter((existingOrder) => existingOrder.id !== order.id)],
    });

    return json(200, {
      ok: true,
      orderId: order.id,
      checkoutUrl: payment.checkoutUrl,
    });
  } catch (error) {
    return json(400, {
      ok: false,
      message: error.message || "Betaling kon niet worden gestart.",
    });
  }
};
