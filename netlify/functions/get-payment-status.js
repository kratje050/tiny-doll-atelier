const { readSiteData, ordersFromData, formatMoney } = require("./lib/shop-data");

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

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return json(405, { ok: false, message: "Alleen GET is toegestaan." });
  }

  try {
    const orderId = new URLSearchParams(event.rawQuery || "").get("orderId") || "";
    if (!orderId) {
      return json(400, { ok: false, message: "Ordernummer ontbreekt." });
    }

    const data = await readSiteData();
    const order = ordersFromData(data).find((item) => item.id === orderId);
    if (!order) {
      return json(404, { ok: false, message: "Bestelling niet gevonden." });
    }

    return json(200, {
      ok: true,
      orderId: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus || "pending_payment",
      total: formatMoney(order.total),
    });
  } catch (error) {
    return json(500, { ok: false, message: "Betaalstatus kon niet worden opgehaald." });
  }
};
