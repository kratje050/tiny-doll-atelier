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

async function getBlobStore() {
  const siteID = process.env.NETLIFY_BLOBS_SITE_ID || "";
  const token = process.env.NETLIFY_BLOBS_TOKEN || "";

  if (!siteID || !token) {
    throw new Error("Online opslag is nog niet gekoppeld.");
  }

  const { getStore } = await import("@netlify/blobs");
  return getStore({ name: "tiny-doll-atelier", siteID, token });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Deze actie is niet toegestaan." });
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(payload.date || "")
      ? payload.date
      : new Date().toISOString().slice(0, 10);
    const store = await getBlobStore();
    const data = (await store.get(DATA_KEY, { type: "json" })) || {};
    const visits = Array.isArray(data.visits) ? data.visits : [];
    const existing = visits.find((visit) => visit.date === date);

    if (existing) {
      existing.count = Number(existing.count || 0) + 1;
    } else {
      visits.push({ date, count: 1 });
    }

    await store.setJSON(DATA_KEY, {
      ...data,
      visits,
      updatedAt: new Date().toISOString(),
    });

    return json(200, { ok: true });
  } catch {
    return json(200, { ok: false, message: "Bezoek kon niet online worden geteld." });
  }
};
