const crypto = require("crypto");
const {
  readSiteData,
  writeSiteData,
  productsFromData,
  ordersFromData,
  normalizeMoney,
  stockQuantity,
  orderSummary,
  formatMoney,
  mapMollieStatus,
} = require("./lib/shop-data");
const { handler: sendEmailHandler } = require("./send-email");

function text(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body,
  };
}

function internalSignature() {
  return crypto
    .createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "")
    .update("payment-paid")
    .digest("hex");
}

async function getMolliePayment(paymentId) {
  if (!process.env.MOLLIE_API_KEY) {
    throw new Error("MOLLIE_API_KEY ontbreekt.");
  }

  const response = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    headers: {
      Authorization: `Bearer ${process.env.MOLLIE_API_KEY}`,
    },
  });
  const payment = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payment.detail || payment.message || "Mollie payment kon niet worden opgehaald.");
  }

  return payment;
}

function paidStatusLabel(status) {
  const labels = {
    paid: "Betaald",
    failed: "Mislukt",
    canceled: "Geannuleerd",
    expired: "Verlopen",
    pending_payment: "Wacht op betaling",
  };
  return labels[status] || "Wacht op betaling";
}

function reducePaidStock(products, order) {
  return products.map((product) => {
    const orderItem = order.items.find((item) => item.productId === product.id);
    if (!orderItem || !Number.isFinite(Number(product.stockQuantity))) {
      return product;
    }

    return {
      ...product,
      stockQuantity: Math.max(0, stockQuantity(product) - Number(orderItem.quantity || 0)),
    };
  });
}

async function sendPaidEmails(order) {
  const response = await sendEmailHandler({
    httpMethod: "POST",
    headers: {
      "x-tiny-internal": internalSignature(),
      "x-nf-client-connection-ip": "mollie-webhook",
    },
    body: JSON.stringify({
      type: "payment-paid",
      webshopNaam: process.env.WEBSHOP_NAME || "Tiny Doll Atelier",
      orderId: order.id,
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      total: formatMoney(order.total),
      orderSummary: orderSummary(order),
      message: order.notes || "-",
      paymentStatus: "Betaald",
    }),
  });

  const data = JSON.parse(response.body || "{}");
  if (!response.statusCode || response.statusCode >= 400 || data.ok === false) {
    throw new Error(data.message || "Betaalbevestiging kon niet worden verzonden.");
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return text(405, "method not allowed");
  }

  try {
    const params = new URLSearchParams(event.body || "");
    const paymentId = params.get("id");
    if (!paymentId) {
      return text(200, "missing id");
    }

    const payment = await getMolliePayment(paymentId);
    const orderId = payment.metadata?.orderId;
    if (!orderId) {
      return text(200, "missing order metadata");
    }

    const data = await readSiteData();
    const orders = ordersFromData(data);
    const order = orders.find((item) => item.id === orderId || item.molliePaymentId === paymentId);
    if (!order) {
      return text(200, "order not found");
    }

    const previousPaymentStatus = order.paymentStatus || "pending_payment";
    const paymentStatus = mapMollieStatus(payment.status);
    const paid = paymentStatus === "paid";
    const updatedOrder = {
      ...order,
      molliePaymentId: payment.id,
      paymentStatus,
      paymentMethod: payment.method || order.paymentMethod || "",
      paidAt: paid ? payment.paidAt || new Date().toISOString() : order.paidAt || "",
      status: paid ? "Betaald" : paidStatusLabel(paymentStatus),
      statusHistory: [
        ...(order.statusHistory || []),
        ...(previousPaymentStatus !== paymentStatus
          ? [
              {
                at: new Date().toISOString(),
                type: "payment",
                from: previousPaymentStatus,
                to: paymentStatus,
              },
            ]
          : []),
      ],
    };

    let products = productsFromData(data);
    if (paid && !order.paymentHandled) {
      products = reducePaidStock(products, order);
      updatedOrder.paymentHandled = true;
    }

    let paidEmailSent = Boolean(order.paidEmailSent);
    let emailError = "";
    if (paid && !paidEmailSent) {
      try {
        await sendPaidEmails(updatedOrder);
        paidEmailSent = true;
      } catch (error) {
        emailError = error.message || "Betaalbevestiging kon niet worden verzonden.";
      }
    }
    updatedOrder.paidEmailSent = paidEmailSent;
    if (emailError) {
      updatedOrder.adminNotes = [updatedOrder.adminNotes, `Mailfout na betaling: ${emailError}`]
        .filter(Boolean)
        .join("\n");
    }

    await writeSiteData({
      ...data,
      products,
      orders: orders.map((item) => (item.id === order.id ? updatedOrder : item)),
    });

    return text(200, "ok");
  } catch (error) {
    return text(200, "processed with warning");
  }
};
