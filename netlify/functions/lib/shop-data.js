const STORE_NAME = "tiny-doll-atelier";
const DATA_KEY = "site-data";

const defaultProducts = [
  {
    id: "linnen-set",
    name: "Linnen broekset",
    categoryId: "linnen",
    price: 24.5,
    stockQuantity: 2,
    stock: "2 op voorraad",
    badge: "Pop 32-36 cm",
    image: "assets/tiny-look-card.png",
    description: "Tweedelige naturel set met wijde broek en zachte top.",
    active: true,
  },
  {
    id: "strik-haarband",
    name: "Strik haarband",
    categoryId: "accessoires",
    price: 8.5,
    stockQuantity: 0,
    stock: "Op bestelling",
    badge: "Mix & match",
    image: "assets/tiny-bow-closeup.png",
    description: "Zachte linnenlook haarband met grote strik voor een rustige naturel look.",
    active: true,
  },
  {
    id: "linnen-top-broek",
    name: "Top met broek",
    categoryId: "setjes",
    price: 22.5,
    stockQuantity: 1,
    stock: "1 op voorraad",
    badge: "Pop 32-38 cm",
    image: "assets/tiny-linnen-set.png",
    description: "Luchtig setje met cropped top, wijde broek en bijpassende haarband.",
    active: true,
  },
  {
    id: "romper-ruches",
    name: "Romper met ruches",
    categoryId: "linnen",
    price: 19.5,
    stockQuantity: 0,
    stock: "Op bestelling",
    badge: "Maatwerk mogelijk",
    image: "assets/tiny-romper.png",
    description: "Romper in ribbelstof met zachte ruches en elastische pasvorm.",
    active: true,
  },
];

function blobConfig() {
  return {
    siteID: process.env.NETLIFY_BLOBS_SITE_ID || "",
    token: process.env.NETLIFY_BLOBS_TOKEN || "",
  };
}

function blobsConfigured() {
  const config = blobConfig();
  return Boolean(config.siteID && config.token);
}

async function getStore() {
  const config = blobConfig();
  if (!config.siteID || !config.token) {
    throw new Error("Netlify Blobs is nog niet geconfigureerd.");
  }

  const blobs = await import("@netlify/blobs");
  return blobs.getStore({
    name: STORE_NAME,
    siteID: config.siteID,
    token: config.token,
  });
}

async function readSiteData() {
  const store = await getStore();
  return (await store.get(DATA_KEY, { type: "json" })) || {};
}

async function writeSiteData(data) {
  const store = await getStore();
  const nextData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  await store.setJSON(DATA_KEY, nextData);
  return nextData;
}

async function updateSiteData(updater) {
  const current = await readSiteData();
  const next = await updater(current);
  return writeSiteData(next);
}

function productsFromData(data) {
  return Array.isArray(data.products) && data.products.length ? data.products : defaultProducts;
}

function ordersFromData(data) {
  return Array.isArray(data.orders) ? data.orders : [];
}

function discountsFromData(data) {
  return Array.isArray(data.discounts) ? data.discounts : [];
}

function giftCardsFromData(data) {
  return Array.isArray(data.giftCards) ? data.giftCards : [];
}

function normalizeMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function stockQuantity(product) {
  if (Number.isFinite(Number(product.stockQuantity))) {
    return Number(product.stockQuantity);
  }

  const stockMatch = String(product.stock || "").match(/\d+/);
  return stockMatch ? Number(stockMatch[0]) : 0;
}

function isDirectPayable(product) {
  return Boolean(product && product.active !== false && !product.madeToOrder && !product.soldOut && stockQuantity(product) > 0);
}

function orderSummary(order) {
  return order.items
    .map((item) => `- ${item.quantity}x ${item.name} (${formatMoney(item.price)} per stuk)`)
    .join("\n");
}

function formatMoney(amount) {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    Number(amount || 0),
  );
}

function mapMollieStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "failed") return "failed";
  if (normalized === "canceled") return "canceled";
  if (normalized === "expired") return "expired";
  return "pending_payment";
}

module.exports = {
  blobsConfigured,
  readSiteData,
  writeSiteData,
  updateSiteData,
  productsFromData,
  ordersFromData,
  discountsFromData,
  giftCardsFromData,
  normalizeMoney,
  stockQuantity,
  isDirectPayable,
  orderSummary,
  formatMoney,
  mapMollieStatus,
};
