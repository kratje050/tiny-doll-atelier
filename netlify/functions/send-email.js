const allowedTypes = new Set(["order", "gift-card", "return", "contact"]);
const rateLimits = new Map();

const templates = {
  "gift-card": {
    customerSubject: "Je cadeaubonaanvraag bij {webshopNaam}",
    adminSubject: "Nieuwe cadeaubonaanvraag",
    customerBody:
      "Hallo {naam},\n\nBedankt voor je cadeaubonaanvraag bij {webshopNaam}.\n\nOntvanger: {ontvangerNaam}\nE-mail ontvanger: {ontvangerEmail}\nBedrag: {bedrag}\nBericht: {bericht}\n\nDe cadeaubon wordt definitief na bevestiging en betaling. Daarna maken we de code aan en sturen we die per e-mail.\n\nLiefs,\n{webshopNaam}",
    adminBody:
      "Nieuwe cadeaubonaanvraag ontvangen.\n\nNaam klant: {naam}\nE-mail klant: {email}\nOntvanger: {ontvangerNaam}\nE-mail ontvanger: {ontvangerEmail}\nBedrag: {bedrag}\nBericht: {bericht}\nDatum: {datum}",
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
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => values[key] || "-");
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
    onderwerp: clean(payload.subject, 180),
    bericht: clean(payload.message || payload.notes, 4000),
    ordernummer: clean(payload.orderNumber || payload.orderId, 80),
    product: clean(payload.product, 180),
    reden: clean(payload.reason, 500),
    bedrag: clean(payload.amount, 80),
    ontvangerNaam: clean(payload.recipient, 160),
    ontvangerEmail: clean(payload.recipientEmail, 200),
    totaal: clean(payload.total, 80),
    bestelling: clean(payload.orderSummary, 5000),
    datum: new Date().toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam" }),
  };

  if (!values.naam || !isEmail(values.email)) {
    throw new Error("Vul een geldige naam en e-mailadres in.");
  }

  const required = {
    contact: ["onderwerp", "bericht"],
    return: ["ordernummer", "product", "bericht"],
    "gift-card": ["bedrag"],
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

async function sendWithResend({ to, subject, text, replyTo }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("E-mail is nog niet geconfigureerd.");
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
      reply_to: replyTo,
    }),
  });

  if (!response.ok) {
    throw new Error("De mailprovider kon het bericht niet verzenden.");
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
    const adminMail = {
      to: adminEmail,
      subject: applyTemplate(template.adminSubject, values),
      text: applyTemplate(template.adminBody, values),
      replyTo: values.email,
    };

    const provider = clean(process.env.EMAIL_PROVIDER || "resend", 40).toLowerCase();
    if (provider !== "resend") {
      return json(503, {
        ok: false,
        message: "Deze e-mailprovider is nog niet geactiveerd.",
      });
    }

    await sendWithResend(customerMail);
    await sendWithResend(adminMail);
    return json(200, { ok: true, message: "Je bericht is verzonden." });
  } catch (error) {
    return json(400, {
      ok: false,
      message: error.message || "Verzenden is mislukt.",
    });
  }
};
