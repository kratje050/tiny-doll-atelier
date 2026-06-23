const tls = require("node:tls");
const crypto = require("node:crypto");

const allowedTypes = new Set([
  "order",
  "gift-card",
  "gift-card-issued",
  "payment-instructions",
  "payment-received",
  "track-trace",
  "order-status",
  "return",
  "contact",
]);
const rateLimits = new Map();
const ADMIN_COOKIE_NAME = "tiny_doll_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 2;
const DEFAULT_SHOP_BASE_URL = "https://tiny-doll-atelier.netlify.app";

const templates = {
  "gift-card": {
    customerSubject: "Je cadeaubonaanvraag bij {webshopNaam}",
    adminSubject: "Nieuwe cadeaubonaanvraag",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je cadeaubonaanvraag bij {webshopNaam}.\n\nOntvanger: {ontvangerNaam}\nE-mail ontvanger: {ontvangerEmail}\nBedrag: {bedrag}\nBericht: {bericht}\n\nDe cadeaubon wordt definitief na bevestiging en betaling. Daarna maken we de code aan en sturen we die per e-mail.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Nieuwe cadeaubonaanvraag ontvangen.\n\nNaam klant: {naam}\nE-mail klant: {email}\nOntvanger: {ontvangerNaam}\nE-mail ontvanger: {ontvangerEmail}\nBedrag: {bedrag}\nBericht: {bericht}\nDatum: {datum}",
  },
  "gift-card-issued": {
    customerSubject: "Je cadeaubon van {webshopNaam}",
    adminSubject: "Cadeaubon {cadeauboncode} is verzonden",
    customerBody:
      "Hallo {naam},\n\nWat leuk, je cadeaubon van {webshopNaam} is klaar.\n\nCode: {cadeauboncode}\nWaarde: {bedrag}\nResterend saldo: {saldo}\nGeldig tot: {geldigTot}\n\nJe kunt deze code gebruiken in je winkelmandje bij het veld Cadeauboncode.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Cadeaubon verzonden.\n\nCode: {cadeauboncode}\nOntvanger: {naam}\nE-mail ontvanger: {email}\nWaarde: {bedrag}\nResterend saldo: {saldo}\nGeldig tot: {geldigTot}\nDatum: {datum}",
  },
  "payment-instructions": {
    customerSubject: "Betaalinstructie voor je aanvraag bij Tiny Doll Atelier",
    adminSubject: "Betaalinstructie verstuurd voor {ordernummer}",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je aanvraag. We hebben je bestelling gecontroleerd.\n\nOrdernummer: {ordernummer}\n\n{bestelling}\n\nTotaalbedrag: {totaal}\nBetaalstatus: Wacht op betaling\n\nJe bestelling is pas definitief nadat alles is bevestigd en betaald.\n\nJe kunt het totaalbedrag overmaken naar:\n\nRekeninghouder: {paymentHolder}\nIBAN: {paymentIban}\nOmschrijving: {paymentDescription}\n\nLet op: vermeld altijd het ordernummer als omschrijving, zodat we je betaling goed kunnen koppelen aan je aanvraag.\n\n{paymentExtraText}\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Betaalinstructie verstuurd.\n\nOrdernummer: {ordernummer}\nKlantnaam: {naam}\nE-mail: {email}\nTotaalbedrag: {totaal}\nDatum: {datum}",
  },
  "track-trace": {
    customerSubject: "Je bestelling van Tiny Doll Atelier is verzonden",
    adminSubject: "Track & trace verstuurd voor {ordernummer}",
    customerBody:
      "Hallo {naam},\n\nGoed nieuws, je bestelling is verzonden.\n\nOrdernummer: {ordernummer}\nTrack & trace: {tracktrace}\n\nJe kunt de zending volgen met bovenstaande code. Heb je vragen over je bestelling? Reageer dan gerust op deze mail.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Track & trace mail verstuurd.\n\nOrdernummer: {ordernummer}\nKlantnaam: {naam}\nE-mail: {email}\nTrack & trace: {tracktrace}\nDatum: {datum}",
  },
  "order-status": {
    customerSubject: "Update over je bestelling {ordernummer}",
    adminSubject: "Klantmail verstuurd voor {ordernummer}",
    customerBody:
      "Hallo {naam},\n\nEr is een update over je bestelling.\n\nOrdernummer: {ordernummer}\nBestelstatus: {orderStatus}\nBetaalstatus: {paymentStatus}\n\nJe kunt je bestelling bekijken via je account als je met hetzelfde e-mailadres een account hebt aangemaakt.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Klantmail verstuurd.\n\nOrdernummer: {ordernummer}\nKlantnaam: {naam}\nE-mail: {email}\nBestelstatus: {orderStatus}\nBetaalstatus: {paymentStatus}\nDatum: {datum}",
  },
  "payment-received": {
    customerSubject: "We hebben je betaling ontvangen",
    adminSubject: "Bestelling gemarkeerd als betaald",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je bestelling. We hebben je betaling ontvangen.\n\nOrdernummer: {ordernummer}\n\n{bestelling}\n\nTotaalbedrag: {totaal}\n\nWe gaan met je bestelling aan de slag. Bij maatwerk of persoonlijke details stemmen we dit nog persoonlijk met je af.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Bestelling is gemarkeerd als betaald.\n\nOrdernummer: {ordernummer}\nKlantnaam: {naam}\nE-mail: {email}\n\n{bestelling}\n\nTotaalbedrag: {totaal}\nOpmerking: {bericht}\nDatum: {datum}",
  },
  return: {
    customerSubject: "Je retour of annulering is aangemeld",
    adminSubject: "Nieuwe retouraanmelding",
    customerBody:
      "Hallo {naam},\n\nWe hebben je retour of annulering ontvangen.\n\nOrdernummer: {ordernummer}\nProduct: {product}\nReden: {reden}\nBericht: {bericht}\n\nWe nemen zo snel mogelijk contact met je op.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Nieuwe retouraanmelding ontvangen.\n\nNaam klant: {naam}\nE-mail: {email}\nOrdernummer: {ordernummer}\nProduct: {product}\nReden: {reden}\nBericht: {bericht}\nDatum: {datum}",
  },
  contact: {
    customerSubject: "We hebben je bericht ontvangen",
    adminSubject: "Nieuw contactbericht",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je bericht. We hebben het goed ontvangen en reageren zo snel mogelijk.\n\nOnderwerp: {onderwerp}\nBericht: {bericht}\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Nieuw contactbericht ontvangen.\n\nNaam: {naam}\nE-mail: {email}\nOnderwerp: {onderwerp}\nBericht: {bericht}\nDatum: {datum}",
  },
  order: {
    customerSubject: "Je bestelverzoek {ordernummer} is ontvangen",
    adminSubject: "Nieuw bestelverzoek {ordernummer}",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je bestelverzoek {ordernummer}. We kijken je bestelling, levertijd en eventuele keuzes na en sturen daarna de betaalinformatie.\n\n{bestelling}\n\nTotaal: {totaal}\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Nieuw bestelverzoek ontvangen.\n\nOrdernummer: {ordernummer}\nNaam: {naam}\nE-mail: {email}\nTelefoon: {telefoon}\nAdres: {adres}\n\n{bestelling}\n\nTotaal: {totaal}\nOpmerking: {bericht}\nDatum: {datum}",
  },
};

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

function clean(value, maxLength = 5000) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .trim()
    .slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function getEmailAddress(value) {
  const match = String(value || "").match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

function safeEquals(left = "", right = "") {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function signAdminSession(value) {
  return crypto.createHmac("sha256", process.env.ADMIN_SESSION_SECRET || "").update(value).digest("hex");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    header
      .split(";")
      .map((item) => item.trim().split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key, decodeURIComponent(value)]),
  );
}

function hasValidAdminSession(event) {
  if (!process.env.ADMIN_SESSION_SECRET) {
    return false;
  }

  const cookies = parseCookies(event.headers.cookie || event.headers.Cookie || "");
  const session = cookies[ADMIN_COOKIE_NAME];
  if (!session) {
    return false;
  }

  const [timestamp, signature] = session.split(".");
  if (!timestamp || !signature || !safeEquals(signAdminSession(timestamp), signature)) {
    return false;
  }

  const createdAt = Number(timestamp);
  return Number.isFinite(createdAt) && Date.now() - createdAt < ADMIN_SESSION_MAX_AGE * 1000;
}

function isPublicMailbox(value) {
  const email = getEmailAddress(value);
  return /@(gmail|googlemail|hotmail|outlook|live|yahoo)\./i.test(email);
}

function safeProviderMessage(value) {
  return clean(value || "De mailprovider kon het bericht niet verzenden.", 300);
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function shopBaseUrl() {
  return String(process.env.SHOP_BASE_URL || process.env.URL || DEFAULT_SHOP_BASE_URL).replace(/\/+$/, "");
}

function publicImageUrl(value = "") {
  const src = clean(value, 4000);
  if (!src || /^(data|blob|file):/i.test(src)) {
    return "";
  }
  try {
    return new URL(src, `${shopBaseUrl()}/`).href;
  } catch {
    return "";
  }
}

function publicProductUrl(productId = "", value = "") {
  const url = clean(value, 4000);
  if (url && !/^(data|blob|file):/i.test(url)) {
    try {
      return new URL(url, `${shopBaseUrl()}/`).href;
    } catch {
      // Valt terug op productId.
    }
  }
  const id = clean(productId, 160);
  return id ? `${shopBaseUrl()}/?product=${encodeURIComponent(id)}` : "";
}

function textToHtml(value) {
  return escapeHtml(value)
    .split(/\r?\n\r?\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p style="margin:0 0 16px;line-height:1.7;">${paragraph.replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

function renderLineList(value) {
  const lines = String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return "";
  }

  return lines
    .map(
      (line) => `
        <div style="padding:10px 0;border-bottom:1px solid #eadbd0;color:#342216;font-size:15px;line-height:1.5;">
          ${escapeHtml(line)}
        </div>
      `,
    )
    .join("");
}

function renderSoftBlock(title, value, multiline = false) {
  if (!value || value === "-") {
    return "";
  }

  const body = multiline
    ? renderLineList(value)
    : `<div style="color:#5d4636;font-size:15px;line-height:1.7;">${textToHtml(value)}</div>`;

  if (!body) {
    return "";
  }

  return `
    <div style="margin:22px 0 0;padding:18px;border-radius:10px;background:#fff6ed;border:1px solid #eadbd0;">
      <div style="margin-bottom:10px;color:#6f4328;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;">${escapeHtml(title)}</div>
      ${body}
    </div>
  `;
}

function sanitizeOrderItems(value) {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => ({
      productId: clean(item.productId, 160),
      name: clean(item.name || item.productName, 180),
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      lineTotal: Number(item.lineTotal) || (Number(item.price) || 0) * (Number(item.quantity) || 1),
      imageUrl: publicImageUrl(item.imageUrl || item.image),
      productUrl: publicProductUrl(item.productId, item.productUrl),
      imageAlt: clean(item.imageAlt || item.name || item.productName, 220),
      category: clean(item.category, 120),
      popSize: clean(item.popSize, 120),
      material: clean(item.material, 160),
      deliveryTime: clean(item.deliveryTime, 160),
    }))
    .filter((item) => item.name);
}

function formatEuro(value) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value) || 0);
}

function renderOrderItemsHtml(items) {
  if (!items.length) {
    return "";
  }

  return `
    <div style="margin:22px 0 0;padding:18px;border-radius:10px;background:#fff6ed;border:1px solid #eadbd0;">
      <div style="margin-bottom:12px;color:#6f4328;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;">Bestelling</div>
      ${items
        .map((item) => {
          const productLink = item.productUrl;
          const image = item.imageUrl
            ? `<td width="92" style="padding:0 14px 14px 0;vertical-align:top;">
                ${
                  productLink
                    ? `<a href="${escapeHtml(productLink)}" style="display:block;text-decoration:none;"><img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.name)}" width="78" height="78" style="display:block;width:78px;height:78px;object-fit:cover;border-radius:8px;border:1px solid #eadbd0;background:#efe3d6;"></a>`
                    : `<img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.imageAlt || item.name)}" width="78" height="78" style="display:block;width:78px;height:78px;object-fit:cover;border-radius:8px;border:1px solid #eadbd0;background:#efe3d6;">`
                }
              </td>`
            : `<td width="92" style="padding:0 14px 14px 0;vertical-align:top;">
                <div style="display:grid;place-items:center;width:78px;height:78px;border-radius:8px;border:1px solid #eadbd0;background:#efe3d6;color:#806a59;font-size:11px;font-weight:800;text-align:center;line-height:1.15;">Geen afbeelding</div>
              </td>`;
          const detailLine = [item.category, item.popSize, item.material, item.deliveryTime].filter(Boolean).join(" - ");

          return `
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-bottom:1px solid #eadbd0;margin-bottom:14px;">
              <tr>
                ${image}
                <td style="padding:0 0 14px;vertical-align:top;color:#342216;">
                  <strong style="display:block;font-size:16px;margin-bottom:7px;">
                    ${
                      productLink
                        ? `<a href="${escapeHtml(productLink)}" style="color:#342216;text-decoration:underline;text-decoration-color:#dcc8b7;">${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}</a>`
                        : `${escapeHtml(item.quantity)}x ${escapeHtml(item.name)}`
                    }
                  </strong>
                  ${detailLine ? `<div style="color:#806a59;font-size:13px;line-height:1.5;margin-bottom:4px;">${escapeHtml(detailLine)}</div>` : ""}
                  <div style="color:#806a59;font-size:14px;line-height:1.7;">Prijs per stuk: ${escapeHtml(formatEuro(item.price))}</div>
                  <div style="color:#342216;font-size:15px;font-weight:800;line-height:1.7;">Totaal bedrag: ${escapeHtml(formatEuro(item.lineTotal || item.price * item.quantity))}</div>
                </td>
              </tr>
            </table>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCostOverview(values) {
  const rows = [
    ["Subtotaal", values.subtotaal],
    values.kortingscode ? [`Kortingscode ${values.kortingscode}`, `-${values.korting}`] : null,
    values.cadeauboncode ? [`Cadeaubon ${values.cadeauboncode}`, `-${values.cadeaubonBedrag}`] : null,
    values.cadeaubonSaldo ? ["Resterend cadeaubonsaldo na betaling", values.cadeaubonSaldo] : null,
    values.gratisVerzending === "Ja" ? ["Verzending", "Gratis via kortingscode"] : ["Verzending", "Wordt afgestemd"],
    ["Totaal", values.totaal],
  ].filter(Boolean);

  return `
    <div style="margin:22px 0 0;padding:18px;border-radius:10px;background:#efe3d6;border:1px solid #dcc8b7;">
      <div style="margin-bottom:10px;color:#6f4328;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;">Kostenoverzicht</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:8px 0;color:#806a59;font-size:14px;font-weight:700;">${escapeHtml(label)}</td>
                <td style="padding:8px 0;color:#342216;font-size:14px;font-weight:900;text-align:right;">${escapeHtml(value || "-")}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
    </div>
  `;
}

function renderPaymentInstructionBlock(values) {
  if (!values.paymentHolder && !values.paymentIban && !values.paymentDescription) {
    return "";
  }

  const rows = [
    ["Totaalbedrag", values.totaal],
    ["Rekeninghouder", values.paymentHolder],
    ["IBAN", values.paymentIban],
    ["Omschrijving", values.paymentDescription || values.ordernummer],
  ].filter(([, value]) => value);

  return `
    <div style="margin:22px 0 0;padding:18px;border-radius:10px;background:#fff6ed;border:1px solid #eadbd0;">
      <div style="margin-bottom:10px;color:#6f4328;font-size:13px;letter-spacing:.08em;text-transform:uppercase;font-weight:800;">Betaalinstructie</div>
      <p style="margin:0 0 12px;color:#5d4636;font-size:15px;line-height:1.7;">Je kunt het totaalbedrag overmaken naar:</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        ${rows
          .map(
            ([label, value]) => `
              <tr>
                <td style="padding:8px 0;color:#806a59;font-size:14px;font-weight:700;">${escapeHtml(label)}</td>
                <td style="padding:8px 0;color:#342216;font-size:14px;font-weight:900;text-align:right;">${escapeHtml(value)}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
      <p style="margin:12px 0 0;color:#6f4328;font-size:14px;line-height:1.6;font-weight:800;">Let op: vermeld altijd het ordernummer als omschrijving, zodat we je betaling goed kunnen koppelen aan je aanvraag.</p>
      ${values.paymentExtraText ? `<p style="margin:10px 0 0;color:#806a59;font-size:14px;line-height:1.6;">${escapeHtml(values.paymentExtraText)}</p>` : ""}
    </div>
  `;
}

function renderIntroHtml({ type, audience, values }) {
  const name = values.naam || "daar";
  const intros = {
    customer: {
      order: `Hallo ${name},\n\nBedankt voor je bestelverzoek. We kijken je bestelling, levertijd en eventuele keuzes zorgvuldig na en sturen daarna de betaalinformatie.`,
      "gift-card": `Hallo ${name},\n\nBedankt voor je cadeaubonaanvraag. De cadeaubon wordt definitief na bevestiging en betaling. Daarna maken we de code aan en sturen we die per e-mail.`,
      "gift-card-issued": `Hallo ${name},\n\nWat leuk, je cadeaubon is klaar. Hieronder vind je de code en alle gegevens overzichtelijk bij elkaar.`,
      "payment-instructions": `Hallo ${name},\n\nBedankt voor je aanvraag. We hebben je bestelling gecontroleerd. Hieronder vind je de informatie om de betaling persoonlijk af te stemmen.`,
      "payment-received": `Hallo ${name},\n\nBedankt voor je bestelling. We hebben je betaling ontvangen en gaan met je bestelling aan de slag.`,
      "track-trace": `Hallo ${name},\n\nGoed nieuws, je bestelling is verzonden. Je kunt de zending volgen met de track & trace code hieronder. Heb je vragen over je bestelling? Reageer dan gerust op deze mail.`,
      "order-status": `Hallo ${name},\n\nEr is een update over je bestelling. Hieronder vind je de huidige status en de producten van je aanvraag.`,
      return: `Hallo ${name},\n\nWe hebben je retour of annulering ontvangen. We bekijken je aanvraag en nemen zo snel mogelijk persoonlijk contact met je op.`,
      contact: `Hallo ${name},\n\nBedankt voor je bericht. We hebben het goed ontvangen en reageren zo snel mogelijk.`,
    },
    admin: {
      order: `Er is een nieuw bestelverzoek binnengekomen via de webshop. Hieronder staan de gegevens overzichtelijk bij elkaar.`,
      "gift-card": `Er is een nieuwe cadeaubonaanvraag binnengekomen. Maak de code pas aan nadat de betaling is afgestemd.`,
      "gift-card-issued": `De cadeaubon is opgeslagen en de gegevens zijn naar de ontvanger verzonden.`,
      "payment-instructions": `Er is een betaalinstructie naar de klant verzonden.`,
      "payment-received": `De bestelling is handmatig gemarkeerd als betaald.`,
      "track-trace": `Er is een track & trace mail naar de klant verzonden.`,
      "order-status": `Er is een statusmail naar de klant verzonden.`,
      return: `Er is een nieuwe retour- of annuleringsaanvraag binnengekomen via de website.`,
      contact: `Er is een nieuw contactbericht binnengekomen via de website.`,
    },
  };

  return textToHtml(intros[audience]?.[type] || "");
}

function encodeHeader(value) {
  const text = String(value || "");
  return /^[\x00-\x7F]*$/.test(text) ? text : `=?UTF-8?B?${Buffer.from(text).toString("base64")}?=`;
}

function normalizeLineBreaks(value) {
  return String(value || "").replace(/\r?\n/g, "\r\n");
}

function dotStuff(value) {
  return normalizeLineBreaks(value).replace(/^\./gm, "..");
}

function renderEmailHtml({ subject, text, values, type, audience }) {
  const typeLabels = {
    order: "Bestelverzoek",
    "gift-card": "Cadeaubonaanvraag",
    "gift-card-issued": "Cadeaubon",
    "payment-instructions": "Betaalinstructie",
    "payment-received": "Betaling ontvangen",
    "track-trace": "Verzonden",
    "order-status": "Statusupdate",
    return: "Retour of annulering",
    contact: "Contactbericht",
  };
  const rowsByType = {
    order: [
      ["Ordernummer", values.ordernummer],
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Telefoon", values.telefoon],
      ["Adres", values.adres],
      ["Kortingscode", values.kortingscode || "-"],
      ["Cadeaubon", values.cadeauboncode || "-"],
      ["Totaal", values.totaal],
    ],
    "gift-card": [
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Ontvanger", values.ontvangerNaam],
      ["E-mail ontvanger", values.ontvangerEmail],
      ["Bedrag", values.bedrag],
      ["Datum", values.datum],
    ],
    "gift-card-issued": [
      ["Code", values.cadeauboncode],
      ["Ontvanger", values.naam],
      ["E-mail ontvanger", values.email],
      ["Waarde", values.bedrag],
      ["Resterend saldo", values.saldo],
      ["Geldig tot", values.geldigTot],
    ],
    "payment-instructions": [
      ["Ordernummer", values.ordernummer],
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Kortingscode", values.kortingscode || "-"],
      ["Cadeaubon", values.cadeauboncode || "-"],
      ["Totaal", values.totaal],
    ],
    "payment-received": [
      ["Ordernummer", values.ordernummer],
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Kortingscode", values.kortingscode || "-"],
      ["Cadeaubon", values.cadeauboncode || "-"],
      ["Totaal", values.totaal],
    ],
    "track-trace": [
      ["Ordernummer", values.ordernummer],
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Track & trace", values.tracktrace],
      ["Totaal", values.totaal],
    ],
    "order-status": [
      ["Ordernummer", values.ordernummer],
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Bestelstatus", values.orderStatus],
      ["Betaalstatus", values.paymentStatus],
      ["Totaal", values.totaal],
    ],
    return: [
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Ordernummer", values.ordernummer],
      ["Product", values.product],
      ["Reden", values.reden],
      ["Datum", values.datum],
    ],
    contact: [
      ["Naam", values.naam],
      ["E-mail", values.email],
      ["Onderwerp", values.onderwerp],
      ["Datum", values.datum],
    ],
  };
  const detailRows = (rowsByType[type] || [])
    .filter(([, value]) => value && value !== "-")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;color:#806a59;font-size:14px;font-weight:700;">${escapeHtml(label)}</td>
          <td style="padding:10px 0;color:#342216;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(value)}</td>
        </tr>
      `,
    )
    .join("");
  const badge = audience === "admin" ? "Beheer" : "Bevestiging";
  const preheader =
    audience === "admin"
      ? `Nieuwe melding via ${values.webshopNaam}`
      : `Bedankt voor je bericht aan ${values.webshopNaam}`;
  const hasOrderMail = ["order", "payment-instructions", "payment-received", "track-trace", "order-status"].includes(type);
  const orderBlock = hasOrderMail
    ? values.orderItems.length
      ? `${renderOrderItemsHtml(values.orderItems)}${renderCostOverview(values)}`
      : `${renderSoftBlock("Bestelling", values.bestelling, true)}${renderCostOverview(values)}`
    : "";
  const paymentInstructionBlock =
    type === "payment-instructions" ? renderPaymentInstructionBlock(values) : "";
  const messageTitles = {
    order: "Opmerking",
    "gift-card": "Persoonlijk bericht",
    "gift-card-issued": "Extra bericht",
    "payment-instructions": "Opmerking",
    "payment-received": "Opmerking",
    return: "Toelichting",
    contact: "Bericht",
  };
  const messageBlock = renderSoftBlock(messageTitles[type] || "Bericht", values.bericht);

  return `<!doctype html>
<html lang="nl">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#fbf6ef;color:#342216;font-family:Arial,'Helvetica Neue',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbf6ef;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf4;border:1px solid #dcc8b7;border-radius:12px;overflow:hidden;box-shadow:0 18px 48px rgba(79,48,28,0.12);">
            <tr>
              <td style="background:#6f4328;padding:28px 30px;color:#fff;">
                <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#efe3d6;">${escapeHtml(badge)} - ${escapeHtml(typeLabels[type] || "Bericht")}</div>
                <h1 style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.1;color:#fff;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                <div style="font-size:16px;color:#5d4636;">
                  ${renderIntroHtml({ type, audience, values })}
                </div>
                ${
                  detailRows
                    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-top:1px solid #dcc8b7;border-bottom:1px solid #dcc8b7;">${detailRows}</table>`
                    : ""
                }
                ${orderBlock}
                ${paymentInstructionBlock}
                ${
                  audience === "customer" && type === "track-trace" && values.ordernummer
                    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(`${shopBaseUrl()}/login?returnTo=${encodeURIComponent(`/account/order/${values.ordernummer}`)}`)}" style="display:inline-block;background:#6f4328;color:#fff;text-decoration:none;padding:13px 18px;border-radius:8px;font-weight:800;">Bekijk mijn bestelling</a></p>`
                    : ""
                }
                ${messageBlock}
                <div style="margin-top:22px;padding:18px;border-radius:10px;background:#efe3d6;color:#6f4328;font-size:14px;line-height:1.6;">
                  <strong style="display:block;margin-bottom:4px;color:#342216;">${escapeHtml(values.webshopNaam)}</strong>
                  Handgemaakte poppenkleding in zachte atelierstijl. We reageren zo persoonlijk en zorgvuldig mogelijk.
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;background:#f4eadf;color:#806a59;font-size:12px;line-height:1.5;text-align:center;">
                Deze e-mail is automatisch verzonden via ${escapeHtml(values.webshopNaam)}.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function composeEmail({ from, to, subject, text, html, replyTo }) {
  const boundary = `tiny-doll-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeader(subject)}`,
    "MIME-Version: 1.0",
    html
      ? `Content-Type: multipart/alternative; boundary="${boundary}"`
      : "Content-Type: text/plain; charset=utf-8",
    !html ? "Content-Transfer-Encoding: 8bit" : "",
    `Date: ${new Date().toUTCString()}`,
  ].filter(Boolean);

  if (!html) {
    return `${headers.join("\r\n")}\r\n\r\n${dotStuff(text)}`;
  }

  return `${headers.join("\r\n")}\r\n\r\n--${boundary}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(text)}\r\n--${boundary}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n${dotStuff(html)}\r\n--${boundary}--`;
}

function getIp(event) {
  return (
    event.headers["x-nf-client-connection-ip"] ||
    event.headers["client-ip"] ||
    event.headers["x-forwarded-for"] ||
    "unknown"
  )
    .split(",")[0]
    .trim();
}

function checkRateLimit(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const current = rateLimits.get(ip) || { count: 0, start: now };
  if (now - current.start > windowMs) {
    rateLimits.set(ip, { count: 1, start: now });
    return true;
  }

  current.count += 1;
  rateLimits.set(ip, current);
  return current.count <= 8;
}

function applyTemplate(template, values) {
  return template
    .replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => values[key] || "-")
    .replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => values[key] || "-");
}

function normalizePayload(payload) {
  const type = clean(payload.type, 40);
  if (!allowedTypes.has(type)) {
    throw new Error("Onbekend formulier.");
  }
  if (clean(payload.website, 200)) {
    throw new Error("Bericht geweigerd.");
  }

  const values = {
    webshopNaam: clean(payload.webshopNaam || process.env.WEBSHOP_NAME || "Tiny Doll Atelier", 120),
    naam: clean(payload.name, 160),
    email: clean(payload.email, 200).toLowerCase(),
    telefoon: clean(payload.phone, 80),
    adres: clean(payload.address, 240),
    postcode: clean(payload.postalCode, 40),
    plaats: clean(payload.city, 120),
    land: clean(payload.country, 120),
    aflevernotitie: clean(payload.deliveryNote, 1000),
    onderwerp: clean(payload.subject, 180),
    bericht: clean(payload.message || payload.notes, 4000),
    ordernummer: clean(payload.orderNumber || payload.orderId, 80),
    product: clean(payload.product, 180),
    reden: clean(payload.reason, 500),
    bedrag: clean(payload.amount, 80),
    saldo: clean(payload.balance, 80),
    cadeauboncode: clean(payload.giftCardCode, 80).toUpperCase(),
    geldigTot: clean(payload.expiresAt, 80) || "Geen einddatum",
    ontvangerNaam: clean(payload.recipient, 160),
    ontvangerEmail: clean(payload.recipientEmail, 200),
    totaal: clean(payload.total, 80),
    bestelling: clean(payload.orderSummary, 5000),
    subtotaal: clean(payload.subtotal, 80),
    kortingscode: clean(payload.discountCode, 80).toUpperCase(),
    korting: clean(payload.discountAmount, 80),
    cadeaubonBedrag: clean(payload.giftCardAmount, 80),
    cadeaubonSaldo: clean(payload.giftCardRemainingBalance, 80),
    gratisVerzending: clean(payload.freeShipping, 20),
    paymentHolder: clean(payload.paymentHolder, 160) || "R Stavasius",
    paymentIban: clean(payload.paymentIban, 80) || "NL25 RABO 0316 0597 49",
    paymentDescription: clean(payload.paymentDescription, 120) || clean(payload.orderNumber || payload.orderId, 80),
    paymentExtraText: clean(payload.paymentExtraText, 1000),
    tracktrace: clean(payload.trackTrace, 160),
    orderStatus: clean(payload.orderStatus, 120),
    paymentStatus: clean(payload.paymentStatus, 120),
    customerName: clean(payload.name, 160),
    orderNumber: clean(payload.orderNumber || payload.orderId, 80),
    orderTotal: clean(payload.total, 80),
    products: clean(payload.orderSummary, 5000),
    shopName: clean(payload.webshopNaam || process.env.WEBSHOP_NAME || "Tiny Doll Atelier", 120),
    orderItems: sanitizeOrderItems(payload.orderItems),
    datum: new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }),
  };

  if (!values.naam || !isEmail(values.email)) {
    throw new Error("Vul een geldige naam en e-mailadres in.");
  }

  const required = {
    contact: ["onderwerp", "bericht"],
    return: ["ordernummer", "product", "bericht"],
    "gift-card": ["bedrag"],
    "gift-card-issued": ["cadeauboncode", "bedrag", "saldo"],
    "payment-instructions": ["ordernummer", "bestelling", "totaal"],
    "payment-received": ["ordernummer", "bestelling", "totaal"],
    "track-trace": ["ordernummer", "tracktrace"],
    "order-status": ["ordernummer", "orderStatus", "paymentStatus"],
    order: ["ordernummer", "bestelling", "totaal"],
  }[type];

  required.forEach((field) => {
    if (!values[field]) {
      throw new Error("Niet alle verplichte velden zijn ingevuld.");
    }
  });

  if (values.ontvangerEmail && !isEmail(values.ontvangerEmail)) {
    throw new Error("Het e-mailadres van de ontvanger lijkt niet geldig.");
  }

  values.adres = [values.adres, values.postcode, values.plaats, values.land].filter(Boolean).join(", ");
  return { type, values };
}

async function sendWithResend({ to, subject, text, html, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("E-mail is nog niet geconfigureerd.");
  }

  if (isPublicMailbox(process.env.EMAIL_FROM)) {
    throw new Error(
      "Resend accepteert geen Gmail/Hotmail/Outlook als afzender. Gebruik een geverifieerd domein als EMAIL_FROM, bijvoorbeeld Tiny Doll Atelier <mail@jouwdomein.nl>.",
    );
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
      html,
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let providerMessage = errorText;
    try {
      providerMessage = JSON.parse(errorText).message || errorText;
    } catch {
      providerMessage = errorText;
    }
    throw new Error(`Mailprovider melding: ${safeProviderMessage(providerMessage)}`);
  }
}

function createSmtpClient({ host, port }) {
  const socket = tls.connect({
    host,
    port,
    servername: host,
  });
  socket.setEncoding("utf8");

  let buffer = "";
  const waitForResponse = () =>
    new Promise((resolve, reject) => {
      const onData = (chunk) => {
        buffer += chunk;
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1] || "";
        if (/^\d{3} /.test(lastLine)) {
          socket.off("data", onData);
          socket.off("error", onError);
          const response = buffer;
          buffer = "";
          const code = Number(lastLine.slice(0, 3));
          resolve({ code, response });
        }
      };
      const onError = (error) => {
        socket.off("data", onData);
        reject(error);
      };
      socket.on("data", onData);
      socket.once("error", onError);
    });

  const command = async (line, expectedCodes = []) => {
    socket.write(`${line}\r\n`);
    const result = await waitForResponse();
    if (expectedCodes.length && !expectedCodes.includes(result.code)) {
      throw new Error(`SMTP melding: ${safeProviderMessage(result.response)}`);
    }
    return result;
  };

  const close = () => {
    socket.end();
  };

  return { command, close, waitForResponse };
}

async function sendWithSmtp({ to, subject, text, html, replyTo }) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!user || !pass || !from) {
    throw new Error(
      "Gmail SMTP is nog niet compleet ingesteld. Vul SMTP_USER, SMTP_PASS en EMAIL_FROM in bij Netlify.",
    );
  }

  if (port !== 465) {
    throw new Error("Gebruik voor Gmail SMTP poort 465 met beveiligde verbinding.");
  }

  const client = createSmtpClient({ host, port });
  try {
    const greeting = await client.waitForResponse();
    if (greeting.code !== 220) {
      throw new Error(`SMTP melding: ${safeProviderMessage(greeting.response)}`);
    }

    await client.command("EHLO tiny-doll-atelier.netlify.app", [250]);
    await client.command(
      `AUTH PLAIN ${Buffer.from(`\u0000${user}\u0000${pass}`).toString("base64")}`,
      [235],
    );
    await client.command(`MAIL FROM:<${getEmailAddress(from)}>`, [250]);
    await client.command(`RCPT TO:<${to}>`, [250, 251]);
    await client.command("DATA", [354]);
    await client.command(`${composeEmail({ from, to, subject, text, html, replyTo })}\r\n.`, [250]);
    await client.command("QUIT", [221]);
  } finally {
    client.close();
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { ok: false, message: "Alleen POST is toegestaan." });
  }

  try {
    if (!checkRateLimit(getIp(event))) {
      return json(429, { ok: false, message: "Te veel pogingen. Probeer het later opnieuw." });
    }

    const payload = JSON.parse(event.body || "{}");
    const { type, values } = normalizePayload(payload);
    const adminEmail = process.env.ADMIN_EMAIL;
    const emailFrom = process.env.EMAIL_FROM;

    if (["gift-card-issued", "payment-instructions", "payment-received", "track-trace", "order-status"].includes(type) && !hasValidAdminSession(event)) {
      return json(403, {
        ok: false,
        message: "Log opnieuw in bij beheer om deze mail te versturen.",
      });
    }

    if (!adminEmail || !emailFrom) {
      return json(503, {
        ok: false,
        message: "E-mail is nog niet ingesteld in Netlify.",
      });
    }

    const template = templates[type];
    const customerMail = {
      to: values.email,
      subject: applyTemplate(template.customerSubject, values),
      text: applyTemplate(template.customerBody, values),
      replyTo: adminEmail,
    };
    customerMail.html = renderEmailHtml({
      subject: customerMail.subject,
      text: customerMail.text,
      values,
      type,
      audience: "customer",
    });

    const adminMail = {
      to: adminEmail,
      subject: applyTemplate(template.adminSubject, values),
      text: applyTemplate(template.adminBody, values),
      replyTo: values.email,
    };
    adminMail.html = renderEmailHtml({
      subject: adminMail.subject,
      text: adminMail.text,
      values,
      type,
      audience: "admin",
    });
    const mailsToSend = type === "gift-card-issued" ? [customerMail] : [customerMail, adminMail];

    const provider = clean(process.env.EMAIL_PROVIDER || (process.env.SMTP_HOST ? "smtp" : "resend"), 40).toLowerCase();
    if (provider === "smtp" || provider === "gmail") {
      for (const mail of mailsToSend) {
        await sendWithSmtp(mail);
      }
      return json(200, { ok: true, message: "Je bericht is verzonden." });
    }

    if (provider !== "resend") {
      return json(503, {
        ok: false,
        message: "Deze e-mailprovider is nog niet geactiveerd.",
      });
    }

    for (const mail of mailsToSend) {
      await sendWithResend(mail);
    }
    return json(200, { ok: true, message: "Je bericht is verzonden." });
  } catch (error) {
    const statusCode =
      error.message.includes("Resend accepteert") || error.message.includes("Mailprovider melding")
      || error.message.includes("SMTP melding")
      || error.message.includes("Gmail SMTP")
        ? 503
        : 400;
    return json(statusCode, {
      ok: false,
      message: error.message || "Verzenden is mislukt.",
    });
  }
};
