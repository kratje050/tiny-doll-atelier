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

function clean(value = "", max = 120) {
  return String(value).trim().slice(0, max);
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

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const code = clean(payload.code, 80).toUpperCase();

    if (!code) {
      return json(400, { ok: false, message: "Vul een cadeauboncode in." });
    }

    const store = await getBlobStore();
    const data = (await store.get(DATA_KEY, { type: "json" })) || {};
    const today = new Date().toISOString().slice(0, 10);
    const giftCard = Array.isArray(data.giftCards)
      ? data.giftCards.find((item) => String(item.code || "").toUpperCase() === code)
      : null;

    if (!giftCard || giftCard.active === false) {
      return json(200, { ok: true, valid: false, code, message: "Deze cadeaubon is niet gevonden." });
    }

    if (giftCard.expiresAt && giftCard.expiresAt < today) {
      return json(200, { ok: true, valid: false, code, message: "Deze cadeaubon is verlopen." });
    }

    const balance = Number(giftCard.balance || 0);
    if (balance <= 0) {
      return json(200, { ok: true, valid: false, code, message: "Deze cadeaubon heeft geen saldo meer." });
    }

    return json(200, {
      ok: true,
      valid: true,
      code: giftCard.code,
      balance,
      initialValue: Number(giftCard.initialValue || balance),
      expiresAt: giftCard.expiresAt || "",
    });
  } catch (error) {
    return json(500, {
      ok: false,
      message: error.message || "Cadeaubon kon niet worden gecontroleerd.",
    });
  }
};
