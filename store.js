const TinyStore = (() => {
  const keys = {
    products: "tiny-doll-products",
    categories: "tiny-doll-categories",
    discounts: "tiny-doll-discounts",
    giftCards: "tiny-doll-gift-cards",
    orders: "tiny-doll-orders",
    customers: "tiny-doll-customers",
    visits: "tiny-doll-visits",
    settings: "tiny-doll-settings",
    reviews: "tiny-doll-reviews",
    emailTemplates: "tiny-doll-email-templates",
  };

  const defaultCategories = [
    { id: "linnen", name: "Linnen" },
    { id: "setjes", name: "Setjes" },
    { id: "accessoires", name: "Accessoires" },
  ];

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

  const defaultDiscounts = [
    {
      id: "welkom10",
      code: "WELKOM10",
      type: "percent",
      value: 10,
      freeShipping: false,
      freeShippingFrom: 0,
      active: true,
      uses: 0,
    },
    {
      id: "atelier5",
      code: "ATELIER5",
      type: "fixed",
      value: 5,
      freeShipping: false,
      freeShippingFrom: 0,
      active: true,
      uses: 1,
    },
  ];

  const defaultGiftCards = [];

  const defaultCustomers = [];

  const defaultOrders = [];

  const defaultVisits = [
    { date: "2026-06-14", count: 12 },
    { date: "2026-06-15", count: 18 },
    { date: "2026-06-16", count: 21 },
    { date: "2026-06-17", count: 17 },
    { date: "2026-06-18", count: 27 },
    { date: "2026-06-19", count: 25 },
    { date: "2026-06-20", count: 32 },
  ];

  const defaultSettings = {
    shopName: "Tiny Doll Atelier",
    email: "ddytuber@gmail.com",
    phone: "",
    instagramUrl: "https://www.instagram.com/tinydoll.atelier/",
    shippingNl: 6.95,
    shippingBe: 0,
    freeShippingFrom: 75,
    giftWrapPrice: 2.95,
    paymentHolder: "R Stavasius",
    paymentIban: "NL25 RABO 0316 0597 49",
    paymentDescription: "ordernummer",
    paymentExtraText: "Vermeld altijd het ordernummer als omschrijving, zodat we je betaling goed kunnen koppelen aan je aanvraag.",
    stockLeadTime: "1 tot 3 werkdagen",
    customLeadTime: "3 tot 10 werkdagen",
    heroLabel: "Nieuw in het atelier",
    heroTitle: "Zachte linnen setjes voor poppen.",
    heroText:
      "Handgemaakte poppenkleding in naturel tinten, met rustige stoffen, fijne strikjes en een warme atelierstijl.",
    heroPrimaryButton: "Bekijk collectie",
    heroSecondaryButton: "Vraag maatwerk aan",
    aboutLabel: "Over ons",
    aboutTitle: "Met zorg gemaakt in het atelier",
    aboutText1:
      "Tiny Doll Atelier maakt handgemaakte poppenkleding en lieve accessoires in zachte, rustige tinten. Elk setje wordt met zorg samengesteld en kan naar wens worden aangepast. Of je nu zoekt naar een compleet poppensetje, een los kledingstuk of een persoonlijk cadeautje, wij denken graag met je mee.",
    aboutText2:
      "Onze stijl is zacht, tijdloos en met liefde gemaakt. Perfect voor kleine poppenmoeders, verjaardagen, kraamcadeautjes of gewoon zomaar.",
    shippingLabel: "Verzenden",
    shippingTitle: "Zorgvuldig ingepakt",
    shippingText:
      "Wij pakken elke bestelling met zorg in. Omdat veel producten met de hand worden gemaakt of op aanvraag worden samengesteld, kan de levertijd per bestelling verschillen.",
    shippingAfterText: "Na je bestelling ontvang je een bevestiging met verdere informatie.",
    returnLabel: "Retourneren",
    returnTitle: "Retour of annulering",
    returnLine1: "Standaardproducten kunnen binnen 14 dagen worden aangemeld voor retour.",
    returnLine2: "Het product moet ongebruikt en netjes zijn.",
    returnLine3: "Retourkosten zijn voor de klant, tenzij anders afgesproken.",
    returnLine4:
      "Maatwerkproducten kunnen mogelijk niet retour als ze speciaal volgens persoonlijke wensen zijn gemaakt.",
    returnButtonText: "Retour of annulering aanmelden",
    faqLabel: "FAQ",
    faqTitle: "Veelgestelde vragen",
    faq1Question: "Past de kleding op elke pop?",
    faq1Answer:
      "Onze kleding wordt gemaakt voor poppen van ongeveer 34 cm. Twijfel je? Stuur ons gerust de maat van je pop, dan kijken we met je mee.",
    faq2Question: "Zit de pop erbij inbegrepen?",
    faq2Answer:
      "Alleen wanneer dit duidelijk bij het product staat. Bij losse kledingstukken wordt de pop niet meegeleverd.",
    faq3Question: "Kan ik zelf een stof of kleur kiezen?",
    faq3Answer: "Ja, bij maatwerk kun je wensen doorgeven. We stemmen samen af wat mogelijk is.",
    faq4Question: "Hoe lang duurt mijn bestelling?",
    faq4Answer:
      "Producten op voorraad worden meestal binnen 1 tot 3 werkdagen verzonden. Maatwerk duurt gemiddeld 3 tot 10 werkdagen.",
    faq5Question: "Kan ik mijn bestelling retourneren?",
    faq5Answer:
      "Standaardproducten kunnen binnen 14 dagen worden aangemeld voor retour. Maatwerkproducten kunnen mogelijk niet retour als ze speciaal volgens jouw wensen zijn gemaakt.",
    faq6Question: "Kan ik een bestelling cadeau laten verpakken?",
    faq6Answer: "Ja, cadeauverpakking kan als extra optie worden toegevoegd.",
    faq7Question: "Hebben jullie cadeaubonnen?",
    faq7Answer: "Ja, via de cadeaubonsectie kun je een cadeaubon aanvragen.",
    customSectionLabel: "Maatwerk",
    customSectionTitle: "Ook op aanvraag",
    customSectionText:
      "Kies een stijl, geef de popmaat door en stem samen stof, kleur en details af. Setjes kunnen persoonlijk worden samengesteld voordat de bestelling definitief wordt.",
    customNote:
      "Let op: producten die speciaal op verzoek en volgens persoonlijke wensen worden gemaakt, kunnen mogelijk niet retour. Dit wordt altijd vooraf duidelijk met je afgestemd voordat de bestelling definitief wordt.",
    customCard1Title: "Popmaat",
    customCard1Text: "32 cm, 34 cm, 36 cm of eigen maat",
    customCard2Title: "Stofkeuze",
    customCard2Text: "Linnenlook, katoen, mousseline, tricot of zachte naturelstof",
    customCard3Title: "Kleurkeuze",
    customCard3Text: "Naturel, zand, zachtroze, wit of een rustige tint in overleg",
    customCard4Title: "Afwerking",
    customCard4Text: "Strikjes, haarbanden, elastiek, knoopjes of fijne randjes",
    customCard5Title: "Extra accessoires",
    customCard5Text: "Bijpassende haarband, strik, mutsje of klein cadeaudetail",
    customCard6Title: "Verwachte levertijd",
    customCard6Text: "Meestal 3 tot 10 werkdagen, afhankelijk van stof en wensen",
    orderRequestText:
      "Je plaatst eerst een aanvraag. Daarna controleren we voorraad, maatwerk en levertijd. Je ontvangt van ons persoonlijk de betaalinformatie. Je bestelling is pas definitief nadat alles is bevestigd en betaald.",
    orderSuccessText: "Bedankt, je aanvraag is verzonden. Je ontvangt persoonlijk de betaalinformatie na bevestiging.",
    contactText: "Heb je een vraag over een setje, maatwerk of een bestelling? Stuur gerust een bericht.",
  };

  const visibilityDefaults = Object.fromEntries(
    [
      "showStockLeadTime",
      "showCustomLeadTime",
      "showShippingNl",
      "showShippingBe",
      "showFreeShipping",
      "showGiftWrapOption",
      "showHeroLabel",
      "showHeroTitle",
      "showHeroText",
      "showHeroPrimaryButton",
      "showHeroSecondaryButton",
      "showAboutLabel",
      "showAboutTitle",
      "showAboutText1",
      "showAboutText2",
      "showCustomSectionLabel",
      "showCustomSectionTitle",
      "showCustomSectionText",
      "showCustomNote",
      "showCustomCard1",
      "showCustomCard2",
      "showCustomCard3",
      "showCustomCard4",
      "showCustomCard5",
      "showCustomCard6",
      "showShippingLabel",
      "showShippingTitle",
      "showShippingText",
      "showShippingAfterText",
      "showReturnLabel",
      "showReturnTitle",
      "showReturnButton",
      "showReturnLine1",
      "showReturnLine2",
      "showReturnLine3",
      "showReturnLine4",
      "showFaqLabel",
      "showFaqTitle",
      "showFaq1",
      "showFaq2",
      "showFaq3",
      "showFaq4",
      "showFaq5",
      "showFaq6",
      "showFaq7",
      "showOrderRequestText",
      "showContactText",
    ].map((key) => [key, true]),
  );

  const defaultReviews = [];

  const defaultEmailTemplates = [
    {
      id: "order-received",
      title: "Bestelverzoek ontvangen",
      subject: "Je bestelverzoek bij Tiny Doll Atelier",
      body: "Hallo {naam},\n\nBedankt voor je bestelverzoek {bestelnummer}. Ik kijk de beschikbaarheid en levertijd na en stuur je daarna de betaalinformatie.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "payment-request",
      title: "Betaalinstructie",
      subject: "Betaalinformatie voor {bestelnummer}",
      body: "Hallo {naam},\n\nJe aanvraag {bestelnummer} is gecontroleerd. Het totaalbedrag is {totaal}.\n\nRekeninghouder: {paymentHolder}\nIBAN: {paymentIban}\nOmschrijving: {paymentDescription}\n\nVermeld altijd het ordernummer als omschrijving.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "shipped",
      title: "Verzonden",
      subject: "Je bestelling {bestelnummer} is verzonden",
      body: "Hallo {naam},\n\nJe bestelling is verzonden. Track & trace: {tracktrace}\n\nVeel plezier ermee!\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "account-created",
      title: "Account aangemaakt",
      subject: "Je account bij Tiny Doll Atelier",
      body: "Hallo {{customerName}},\n\nJe account is aangemaakt. Je kunt nu je aanvragen, betaalstatus en track & trace bekijken.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "password-reset",
      title: "Wachtwoord resetten",
      subject: "Wachtwoord resetten voor Tiny Doll Atelier",
      body: "Hallo {{customerName}},\n\nGebruik deze link om je wachtwoord opnieuw in te stellen: {{resetLink}}\n\nDeze link is tijdelijk geldig.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "account-invite",
      title: "Account uitnodiging",
      subject: "Je account bij Tiny Doll Atelier",
      body: "Hallo {{customerName}},\n\nEr is een account voor je aangemaakt bij Tiny Doll Atelier. Via onderstaande link kun je zelf veilig een wachtwoord instellen:\n\n{{inviteLink}}\n\nDe link is tijdelijk geldig. Heb je dit niet verwacht? Dan hoef je niets te doen.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "account-blocked",
      title: "Account geblokkeerd",
      subject: "Update over je Tiny Doll Atelier account",
      body: "Hallo {{customerName}},\n\nJe account is tijdelijk geblokkeerd. Neem gerust contact op via {{contactEmail}} als je hierover vragen hebt.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "account-unblocked",
      title: "Account gedeblokkeerd",
      subject: "Je Tiny Doll Atelier account is weer actief",
      body: "Hallo {{customerName}},\n\nJe account is weer actief. Je kunt opnieuw inloggen en je gegevens bekijken.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "account-updated",
      title: "Klantgegevens aangepast",
      subject: "Je accountgegevens zijn aangepast",
      body: "Hallo {{customerName}},\n\nJe accountgegevens bij Tiny Doll Atelier zijn aangepast. Klopt er iets niet? Reageer dan gerust op deze mail.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "customer-general",
      title: "Algemene klantmail",
      subject: "Bericht van Tiny Doll Atelier",
      body: "Hallo {{customerName}},\n\n{{message}}\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "custom-work",
      title: "Maatwerk afstemmen",
      subject: "Maatwerk afstemmen voor je aanvraag",
      body: "Hallo {{customerName}},\n\nIk stem graag nog even de maat, stof, kleur en afwerking met je af. Reageer gerust op deze mail met je wensen.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "gift-card-info",
      title: "Cadeaubon informatie",
      subject: "Informatie over je cadeaubon",
      body: "Hallo {{customerName}},\n\nHierbij ontvang je informatie over je cadeaubon van Tiny Doll Atelier.\n\nCode: {{giftCardCode}}\nSaldo: {{giftCardBalance}}\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "track-trace",
      title: "Track & trace verzonden",
      subject: "Je bestelling van Tiny Doll Atelier is verzonden",
      body: "Hallo {{customerName}},\n\nGoed nieuws, je bestelling is verzonden.\n\nOrdernummer: {{orderNumber}}\nTrack & trace: {{trackTrace}}\n\nHeb je vragen over je bestelling? Reageer dan gerust op deze mail.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "order-status",
      title: "Orderstatus gewijzigd",
      subject: "Update over je bestelling {{orderNumber}}",
      body: "Hallo {{customerName}},\n\nDe status van je bestelling is bijgewerkt naar: {{orderStatus}}.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "gift-card-send",
      title: "Cadeaubon versturen",
      subject: "Je cadeaubon van Tiny Doll Atelier",
      body: "Hallo {naam},\n\nHierbij ontvang je de cadeauboncode: {cadeauboncode}\nWaarde: {waarde}\nGeldig tot: {geldig_tot}\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "gift-card-request-customer",
      title: "Cadeaubonaanvraag klant",
      subject: "Je cadeaubonaanvraag bij Tiny Doll Atelier",
      body: "Hallo {naam},\n\nBedankt voor je cadeaubonaanvraag. De cadeaubon wordt definitief na bevestiging en betaling.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "gift-card-request-admin",
      title: "Cadeaubonaanvraag beheerder",
      subject: "Nieuwe cadeaubonaanvraag",
      body: "Nieuwe cadeaubonaanvraag ontvangen van {naam} ({email}).\nBedrag: {bedrag}\nOntvanger: {ontvangerNaam}",
    },
    {
      id: "return-customer",
      title: "Retourbevestiging klant",
      subject: "Je retour of annulering is aangemeld",
      body: "Hallo {naam},\n\nWe hebben je retour of annulering ontvangen en nemen zo snel mogelijk contact op.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "return-admin",
      title: "Retourmelding beheerder",
      subject: "Nieuwe retouraanmelding",
      body: "Nieuwe retouraanmelding ontvangen van {naam} ({email}).\nOrdernummer: {ordernummer}\nProduct: {product}",
    },
    {
      id: "contact-customer",
      title: "Contactbevestiging klant",
      subject: "We hebben je bericht ontvangen",
      body: "Hallo {naam},\n\nBedankt voor je bericht. We reageren zo snel mogelijk.\n\nLiefs,\nTiny Doll Atelier",
    },
    {
      id: "contact-admin",
      title: "Contactmelding beheerder",
      subject: "Nieuw contactbericht",
      body: "Nieuw contactbericht ontvangen van {naam} ({email}).\nOnderwerp: {onderwerp}\nBericht: {bericht}",
    },
    {
      id: "order-admin",
      title: "Bestelverzoek beheerder",
      subject: "Nieuw bestelverzoek {ordernummer}",
      body: "Nieuw bestelverzoek ontvangen.\n\nKlant: {naam}\nE-mail: {email}\nTotaal: {totaal}\n\n{bestelling}",
    },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function read(key, fallback) {
    const value = localStorage.getItem(key);
    if (!value) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return clone(fallback);
    }

    try {
      return JSON.parse(value);
    } catch {
      localStorage.setItem(key, JSON.stringify(fallback));
      return clone(fallback);
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function formatMoney(amount) {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
      Number(amount || 0),
    );
  }

  function generateGiftCardCode() {
    const existingCodes = new Set(getGiftCards().map((giftCard) => giftCard.code));
    let code = "";
    do {
      code = `TINY-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`;
    } while (existingCodes.has(code));
    return code;
  }

  function getCategories() {
    return read(keys.categories, defaultCategories);
  }

  function saveCategories(categories) {
    return write(keys.categories, categories);
  }

  function getProducts() {
    return read(keys.products, defaultProducts);
  }

  function saveProducts(products) {
    return write(keys.products, products);
  }

  function getDiscounts() {
    return read(keys.discounts, defaultDiscounts);
  }

  function saveDiscounts(discounts) {
    return write(keys.discounts, discounts);
  }

  function getGiftCards() {
    const giftCards = read(keys.giftCards, defaultGiftCards);
    const cleaned = giftCards.filter((giftCard) => !String(giftCard.email || "").endsWith("@example.nl"));
    if (cleaned.length !== giftCards.length) {
      saveGiftCards(cleaned);
    }
    return cleaned;
  }

  function saveGiftCards(giftCards) {
    return write(keys.giftCards, giftCards);
  }

  function getOrders() {
    const orders = read(keys.orders, defaultOrders);
    const cleaned = orders.filter((order) => !String(order.customer?.email || "").endsWith("@example.nl"));
    if (cleaned.length !== orders.length) {
      saveOrders(cleaned);
    }
    return cleaned;
  }

  function saveOrders(orders) {
    return write(keys.orders, orders);
  }

  function getCustomers() {
    const customers = read(keys.customers, defaultCustomers);
    const cleaned = customers.filter((customer) => !String(customer.email || "").endsWith("@example.nl"));
    if (cleaned.length !== customers.length) {
      saveCustomers(cleaned);
    }
    return cleaned;
  }

  function saveCustomers(customers) {
    return write(keys.customers, customers);
  }

  function getVisits() {
    return read(keys.visits, defaultVisits);
  }

  function saveVisits(visits) {
    return write(keys.visits, visits);
  }

  function getSettings() {
    return { ...defaultSettings, ...visibilityDefaults, ...read(keys.settings, defaultSettings) };
  }

  function saveSettings(settings) {
    return write(keys.settings, { ...defaultSettings, ...visibilityDefaults, ...settings });
  }

  function getReviews() {
    return read(keys.reviews, defaultReviews);
  }

  function saveReviews(reviews) {
    return write(keys.reviews, reviews);
  }

  function getEmailTemplates() {
    const savedTemplates = read(keys.emailTemplates, defaultEmailTemplates);
    const mergedTemplates = [
      ...savedTemplates,
      ...defaultEmailTemplates.filter(
        (template) => !savedTemplates.some((savedTemplate) => savedTemplate.id === template.id),
      ),
    ];
    if (mergedTemplates.length !== savedTemplates.length) {
      saveEmailTemplates(mergedTemplates);
    }
    return mergedTemplates;
  }

  function saveEmailTemplates(templates) {
    return write(keys.emailTemplates, templates);
  }

  function getBackupData() {
    return {
      exportedAt: new Date().toISOString(),
      version: 1,
      storage: "netlify-blobs",
      products: getProducts(),
      categories: getCategories(),
      discounts: getDiscounts(),
      giftCards: getGiftCards(),
      orders: getOrders(),
      customers: getCustomers(),
      visits: getVisits(),
      settings: getSettings(),
      reviews: getReviews(),
      emailTemplates: getEmailTemplates(),
    };
  }

  function importBackupData(data) {
    if (!data || typeof data !== "object") {
      throw new Error("Ongeldig backupbestand.");
    }

    const collectionKeys = [
      "products",
      "categories",
      "discounts",
      "giftCards",
      "orders",
      "customers",
      "visits",
      "reviews",
      "emailTemplates",
    ];
    collectionKeys.forEach((collectionKey) => {
      if (collectionKey in data && !Array.isArray(data[collectionKey])) {
        throw new Error(`Ongeldige data voor ${collectionKey}.`);
      }
    });

    if (data.products) saveProducts(data.products);
    if (data.categories) saveCategories(data.categories);
    if (data.discounts) saveDiscounts(data.discounts);
    if (data.giftCards) saveGiftCards(data.giftCards);
    if (data.orders) saveOrders(data.orders);
    if (data.customers) saveCustomers(data.customers);
    if (data.visits) saveVisits(data.visits);
    if (data.settings && typeof data.settings === "object") saveSettings(data.settings);
    if (data.reviews) saveReviews(data.reviews);
    if (data.emailTemplates) saveEmailTemplates(data.emailTemplates);
    return getBackupData();
  }

  function hasCollectionData(data) {
    return Boolean(
      data &&
        typeof data === "object" &&
        [
          "products",
          "categories",
          "discounts",
          "giftCards",
          "orders",
          "customers",
          "visits",
          "settings",
          "reviews",
          "emailTemplates",
        ].some((key) => key in data),
    );
  }

  function applyCloudData(data) {
    if (!hasCollectionData(data)) {
      return false;
    }

    importBackupData(data);
    return true;
  }

  async function loadCloudData(options = {}) {
    if (typeof fetch !== "function") {
      return { ok: false, changed: false, message: "Online opslag is niet beschikbaar." };
    }

    const admin = Boolean(options.admin);
    const response = await fetch(`/.netlify/functions/data${admin ? "?private=1" : ""}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Online gegevens konden niet worden opgehaald.");
    }

    if (!hasCollectionData(result.data)) {
      if (admin) {
        await saveCloudData();
        return { ok: true, changed: false, seeded: true, message: "Lokale gegevens online gezet." };
      }
      return { ok: true, changed: false, message: "Geen online gegevens gevonden." };
    }

    const changed = applyCloudData(result.data);

    return {
      ok: true,
      changed,
      merged: false,
      updatedAt: result.updatedAt || "",
    };
  }

  async function getCloudStatus() {
    if (typeof fetch !== "function") {
      return {
        ok: false,
        blobsConfigured: false,
        storageMode: "local",
        writable: false,
        message: "Online opslag is niet beschikbaar.",
      };
    }

    const response = await fetch("/.netlify/functions/data?status=1", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Online opslagstatus kon niet worden opgehaald.");
    }

    return result;
  }

  async function saveCloudData() {
    if (typeof fetch !== "function") {
      return { ok: false, message: "Online opslag is niet beschikbaar." };
    }

    const response = await fetch("/.netlify/functions/data", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: getBackupData() }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || !result.ok) {
      throw new Error(result.message || "Wijzigingen konden niet online worden opgeslagen.");
    }

    return result;
  }

  function recordVisit() {
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `tiny-doll-visit-${today}`;
    if (sessionStorage.getItem(sessionKey)) {
      return false;
    }

    const visits = getVisits();
    const existing = visits.find((visit) => visit.date === today);
    if (existing) {
      existing.count += 1;
    } else {
      visits.push({ date: today, count: 1 });
    }
    saveVisits(visits);
    sessionStorage.setItem(sessionKey, "1");
    return true;
  }

  function upsertCustomer(customer, total, date) {
    const customers = getCustomers();
    const normalizedEmail = customer.email.toLowerCase();
    const existing = customers.find((item) => item.email.toLowerCase() === normalizedEmail);

    if (existing) {
      existing.name = customer.name;
      existing.phone = customer.phone;
      existing.address = customer.address || existing.address || "";
      existing.postalCode = customer.postalCode || existing.postalCode || "";
      existing.city = customer.city || existing.city || "";
      existing.country = customer.country || existing.country || "";
      existing.deliveryNote = customer.deliveryNote || existing.deliveryNote || "";
      existing.notes = existing.notes || "";
      existing.orderCount += 1;
      existing.totalSpent = Number((existing.totalSpent + total).toFixed(2));
      existing.lastOrderAt = date.slice(0, 10);
    } else {
      customers.unshift({
        id: `klant-${slugify(customer.name)}-${Date.now()}`,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address || "",
        postalCode: customer.postalCode || "",
        city: customer.city || "",
        country: customer.country || "",
        deliveryNote: customer.deliveryNote || "",
        notes: "",
        orderCount: 1,
        totalSpent: total,
        lastOrderAt: date.slice(0, 10),
      });
    }

    saveCustomers(customers);
  }

  function createOrder({ customer, items, discountCode = "", giftCardCode = "", notes = "" }) {
    const discounts = getDiscounts();
    const giftCards = getGiftCards();
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const discount = discounts.find(
      (item) => item.active && item.code.toUpperCase() === discountCode.toUpperCase(),
    );
    const discountAmount = discount
      ? discount.type === "percent"
        ? subtotal * (discount.value / 100)
        : discount.value
      : 0;
    const safeDiscount = Math.min(subtotal, discountAmount);
    const afterDiscount = subtotal - safeDiscount;
    const freeShippingFrom = Number(discount?.freeShippingFrom || 0);
    const freeShippingByCode = Boolean(
      discount && (discount.freeShipping || (freeShippingFrom > 0 && subtotal >= freeShippingFrom)),
    );
    const today = new Date().toISOString().slice(0, 10);
    const giftCard = giftCards.find(
      (item) =>
        item.active &&
        item.balance > 0 &&
        item.code.toUpperCase() === giftCardCode.toUpperCase() &&
        (!item.expiresAt || item.expiresAt >= today),
    );
    const giftCardInitialBalance = giftCard ? Number(giftCard.balance) : 0;
    const giftCardAmount = giftCard ? Math.min(afterDiscount, giftCardInitialBalance) : 0;
    const giftCardRemainingBalance = giftCard
      ? Number((giftCardInitialBalance - giftCardAmount).toFixed(2))
      : 0;
    const order = {
      id: `TD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
        Math.random() * 900 + 100,
      )}`,
      createdAt: new Date().toISOString(),
      status: "Nieuw",
      paymentStatus: "Wacht op bevestiging",
      customer,
      items,
      discountCode: discount ? discount.code : "",
      discountAmount: Number(safeDiscount.toFixed(2)),
      freeShipping: freeShippingByCode,
      freeShippingFrom: discount ? freeShippingFrom : 0,
      giftCardCode: giftCard ? giftCard.code : "",
      giftCardAmount: Number(giftCardAmount.toFixed(2)),
      giftCardInitialBalance: Number(giftCardInitialBalance.toFixed(2)),
      giftCardRemainingBalance,
      total: Number((afterDiscount - giftCardAmount).toFixed(2)),
      notes,
      adminNotes: "",
      trackTrace: "",
      shippingMethod: "Wordt afgestemd",
      statusHistory: [
        {
          at: new Date().toISOString(),
          type: "order",
          from: "",
          to: "Nieuw",
        },
        {
          at: new Date().toISOString(),
          type: "payment",
          from: "",
          to: "Wacht op bevestiging",
        },
      ],
    };

    saveOrders([order, ...getOrders()]);

    if (discount) {
      discount.uses += 1;
      saveDiscounts(discounts);
    }

    if (giftCard) {
      giftCard.balance = giftCardRemainingBalance;
      saveGiftCards(giftCards);
    }

    reduceStock(items);
    upsertCustomer(customer, order.total, order.createdAt);
    return order;
  }

  function createGiftCardOrder({ customer, amount, recipient = "", recipientEmail = "", message = "" }) {
    const order = createOrder({
      customer,
      items: [
        {
          productId: "cadeaubon",
          name: `Cadeaubon ${formatMoney(amount)}`,
          price: Number(amount),
          quantity: 1,
        },
      ],
      notes: [
        "Cadeaubonaanvraag: code pas aanmaken na handmatige betaling.",
        `Cadeaubon voor: ${recipient || "-"}`,
        `E-mail ontvanger: ${recipientEmail || customer.email}`,
        `Bericht: ${message || "-"}`,
      ].join("\n"),
    });
    return { order };
  }

  function nextYearDate() {
    const date = new Date();
    date.setFullYear(date.getFullYear() + 1);
    return date.toISOString().slice(0, 10);
  }

  function reduceStock(items) {
    const products = getProducts();
    const updatedProducts = products.map((product) => {
      const orderedItem = items.find((item) => item.productId === product.id);
      if (!orderedItem || !Number.isFinite(Number(product.stockQuantity))) {
        return product;
      }

      return {
        ...product,
        stockQuantity: Math.max(0, Number(product.stockQuantity) - orderedItem.quantity),
      };
    });
    saveProducts(updatedProducts);
  }

  function startOfWeek(date) {
    const current = new Date(date);
    const day = current.getDay() || 7;
    current.setHours(0, 0, 0, 0);
    current.setDate(current.getDate() - day + 1);
    return current;
  }

  function getDashboard() {
    const orders = getOrders();
    const visits = getVisits();
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const inRange = (date, start) => new Date(date) >= start;
    const weekOrders = orders.filter((order) => inRange(order.createdAt, weekStart));
    const monthOrders = orders.filter((order) => inRange(order.createdAt, monthStart));
    const weekRevenue = weekOrders.reduce((sum, order) => sum + order.total, 0);
    const monthRevenue = monthOrders.reduce((sum, order) => sum + order.total, 0);
    const weekVisitors = visits
      .filter((visit) => inRange(`${visit.date}T00:00:00`, weekStart))
      .reduce((sum, visit) => sum + visit.count, 0);
    const monthVisitors = visits
      .filter((visit) => inRange(`${visit.date}T00:00:00`, monthStart))
      .reduce((sum, visit) => sum + visit.count, 0);
    const sellers = new Map();

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const current = sellers.get(item.name) || { name: item.name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity;
        current.revenue += item.quantity * item.price;
        sellers.set(item.name, current);
      });
    });

    return {
      weekRevenue,
      monthRevenue,
      weekVisitors,
      monthVisitors,
      weekOrders: weekOrders.length,
      monthOrders: monthOrders.length,
      bestsellers: [...sellers.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5),
      visits: visits.slice(-7),
    };
  }

  return {
    formatMoney,
    getCategories,
    saveCategories,
    getProducts,
    saveProducts,
    getDiscounts,
    saveDiscounts,
    getGiftCards,
    saveGiftCards,
    getOrders,
    saveOrders,
    getCustomers,
    saveCustomers,
    getVisits,
    saveVisits,
    getSettings,
    saveSettings,
    getReviews,
    saveReviews,
    getEmailTemplates,
    saveEmailTemplates,
    getBackupData,
    importBackupData,
    applyCloudData,
    loadCloudData,
    getCloudStatus,
    saveCloudData,
    recordVisit,
    createOrder,
    createGiftCardOrder,
    getDashboard,
    slugify,
  };
})();
