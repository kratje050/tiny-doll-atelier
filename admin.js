const logoutButton = document.querySelector("[data-admin-logout]");

const adminState = {
  products: TinyStore.getProducts(),
  categories: TinyStore.getCategories(),
  discounts: TinyStore.getDiscounts(),
  giftCards: TinyStore.getGiftCards(),
  orders: TinyStore.getOrders(),
  customers: TinyStore.getCustomers(),
  settings: TinyStore.getSettings(),
  reviews: TinyStore.getReviews(),
  emailTemplates: TinyStore.getEmailTemplates(),
  editingProductId: "",
  editingReviewId: "",
  editingCustomerId: "",
  selectedOrderId: "",
  orderFilter: "alles",
  customerSearch: "",
  accountAccounts: [],
  accountDuplicates: [],
  accountStatuses: [],
  accountDetail: null,
  accountSearch: "",
  accountStatusFilter: "alles",
  accountTypeFilter: "alles",
  accountSort: "created-desc",
  accountOpenPaymentOnly: false,
  accountCreatedThisMonthOnly: false,
};

const money = TinyStore.formatMoney;
const orderStatuses = [
  "Nieuw",
  "Afgestemd",
  "In afwachting van betaling",
  "Wacht op betaling",
  "Betaald",
  "In productie",
  "Verzonden",
  "Afgerond",
  "Geannuleerd",
];
const paymentStatuses = [
  "Wacht op bevestiging",
  "Betaalinstructie verstuurd",
  "Wacht op betaling",
  "Betaald",
  "In productie",
  "Verzonden",
  "Geannuleerd",
];
const MAX_PRODUCT_IMAGE_SIZE = 1000;
const PRODUCT_IMAGE_QUALITY = 0.76;
const MAX_EXTRA_PRODUCT_IMAGES = 10;
const settingVisibilityKeys = [
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
];
const views = document.querySelectorAll("[data-view]");
const navButtons = document.querySelectorAll("[data-view-button]");
const productForm = document.querySelector("[data-product-form]");
const categoryForm = document.querySelector("[data-category-form]");
const discountForm = document.querySelector("[data-discount-form]");
const giftCardForm = document.querySelector("[data-gift-card-form]");
const reviewForm = document.querySelector("[data-review-form]");
const settingsForm = document.querySelector("[data-settings-form]");
const accountCreateForm = document.querySelector("[data-account-create-form]");
const productUpload = document.querySelector("[data-product-upload]");
const extraImageUpload = document.querySelector("[data-extra-image-upload]");
const uploadName = document.querySelector("[data-upload-name]");
const extraUploadName = document.querySelector("[data-extra-upload-name]");
const imagePreview = document.querySelector("[data-image-preview]");
const extraImagePreview = document.querySelector("[data-extra-image-preview]");
const cloudSaveMethods = [
  "saveProducts",
  "saveCategories",
  "saveDiscounts",
  "saveGiftCards",
  "saveOrders",
  "saveCustomers",
  "saveVisits",
  "saveSettings",
  "saveReviews",
  "saveEmailTemplates",
];
let cloudReady = false;
let cloudSyncing = false;
let cloudSaveTimer = null;
let cloudSaveInFlight = null;
let onlineEditingEnabled = false;
let cloudStatusElement = null;
let cloudStatusTimer = null;
let activeViewName = "dashboard";
let viewRefreshCounter = 0;

function setCloudStatus(message, isError = false, options = {}) {
  if (!cloudStatusElement) {
    cloudStatusElement = document.createElement("div");
    cloudStatusElement.className = "cloud-status";
    document.body.append(cloudStatusElement);
  }

  clearTimeout(cloudStatusTimer);
  cloudStatusElement.textContent = message;
  cloudStatusElement.classList.toggle("is-error", isError);
  cloudStatusElement.classList.toggle("is-ok", !isError);
  cloudStatusElement.hidden = !message;

  const duration = options.duration ?? (isError ? 9000 : 2600);
  if (message && duration > 0) {
    cloudStatusTimer = setTimeout(() => {
      cloudStatusElement.hidden = true;
    }, duration);
  }
}

function hideCloudStatus() {
  clearTimeout(cloudStatusTimer);
  if (cloudStatusElement) {
    cloudStatusElement.hidden = true;
  }
}

function setOnlineEditingEnabled(enabled, message = "", options = {}) {
  onlineEditingEnabled = enabled;
  document.body.classList.toggle("admin-offline", !enabled);
  document.querySelectorAll(".admin-main input, .admin-main select, .admin-main textarea, .admin-main button").forEach(
    (element) => {
      if (element.closest("[data-view-button]")) {
        return;
      }
      element.disabled = !enabled;
    },
  );

  if (message && (!enabled || !options.silent)) {
    setCloudStatus(message, !enabled);
  }
}

async function restoreOnlineDataAfterFailedSave() {
  cloudSyncing = true;
  try {
    await TinyStore.loadCloudData({ admin: true });
    renderAll();
  } catch {
    // De foutmelding van de mislukte save blijft zichtbaar.
  } finally {
    cloudSyncing = false;
  }
}

function queueCloudSave(successMessage = "Wijzigingen online opgeslagen.") {
  if (cloudSyncing) {
    return;
  }

  if (!cloudReady || !onlineEditingEnabled) {
    setCloudStatus(
      "Online opslag is niet klaar. De wijziging is niet opgeslagen. Controleer Netlify Blobs.",
      true,
    );
    return;
  }

  clearTimeout(cloudSaveTimer);
  setCloudStatus("Wijzigingen online opslaan...");
  cloudSaveTimer = setTimeout(async () => {
    cloudSaveTimer = null;
    try {
      cloudSaveInFlight = TinyStore.saveCloudData();
      await cloudSaveInFlight;
      setCloudStatus(successMessage);
    } catch (error) {
      setOnlineEditingEnabled(
        false,
        error.message ||
          "Online opslaan is mislukt. Lokale wijzigingen zijn teruggedraaid naar de online versie.",
      );
      await restoreOnlineDataAfterFailedSave();
    } finally {
      cloudSaveInFlight = null;
    }
  }, 80);
}

cloudSaveMethods.forEach((methodName) => {
  const originalMethod = TinyStore[methodName];
  TinyStore[methodName] = (...args) => {
    const result = originalMethod(...args);
    queueCloudSave();
    return result;
  };
});

logoutButton.addEventListener("click", () => {
  window.location.href = "/admin/logout";
});

window.addEventListener("beforeunload", (event) => {
  if (!cloudSaveTimer && !cloudSaveInFlight) {
    return;
  }

  event.preventDefault();
  event.returnValue = "";
});

function categoryName(id) {
  return adminState.categories.find((category) => category.id === id)?.name || id;
}

function stockQuantity(product) {
  if (Number.isFinite(Number(product.stockQuantity))) {
    return Number(product.stockQuantity);
  }

  const stockMatch = String(product.stock || "").match(/\d+/);
  return stockMatch ? Number(stockMatch[0]) : 0;
}

function assetUrl(path) {
  if (!path) {
    return "";
  }

  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function buildCustomerMail(order) {
  const template =
    adminState.emailTemplates.find((item) => item.id === "order-received")?.body ||
    "Hallo {naam},\n\nBedankt voor je bestelverzoek {bestelnummer}.";
  return template
    .replaceAll("{naam}", order.customer.name)
    .replaceAll("{bestelnummer}", order.id)
    .replaceAll("{totaal}", money(order.total))
    .replaceAll("{tracktrace}", order.trackTrace || "-")
    .replaceAll("{cadeauboncode}", order.giftCardCode || "-")
    .replaceAll("{waarde}", money(order.giftCardAmount || 0));
}

function orderSummaryText(order) {
  const productLines = order.items
    .map((item) => `- ${item.quantity}x ${item.name} (${money(item.price)} per stuk)`)
    .join("\n");
  const costLines = [
    "",
    `Subtotaal: ${money(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`,
    order.discountCode ? `Kortingscode ${order.discountCode}: -${money(order.discountAmount || 0)}` : "",
    order.giftCardCode ? `Cadeaubon ${order.giftCardCode}: -${money(order.giftCardAmount || 0)}` : "",
    order.giftCardCode
      ? `Resterend cadeaubonsaldo na betaling: ${money(order.giftCardRemainingBalance || 0)}`
      : "",
    order.freeShipping ? "Verzending: gratis via kortingscode" : "Verzending: wordt afgestemd",
    `Totaal: ${money(order.total)}`,
  ].filter(Boolean);

  return [productLines, costLines.join("\n")].filter(Boolean).join("\n\n");
}

async function sendOrderPaymentMail(order, type) {
  await sendEmail({
    type,
    orderId: order.id,
    name: order.customer.name,
    email: order.customer.email,
    phone: order.customer.phone || "",
    total: money(order.total),
    orderSummary: orderSummaryText(order),
    orderItems: order.items,
    paymentHolder: adminState.settings.paymentHolder || "R Stavasius",
    paymentIban: adminState.settings.paymentIban || "NL25 RABO 0316 0597 49",
    paymentDescription: order.id,
    paymentExtraText:
      adminState.settings.paymentExtraText ||
      "Vermeld altijd het ordernummer als omschrijving, zodat we je betaling goed kunnen koppelen aan je aanvraag.",
    subtotal: money(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
    discountCode: order.discountCode || "",
    discountAmount: money(order.discountAmount || 0),
    giftCardCode: order.giftCardCode || "",
    giftCardAmount: money(order.giftCardAmount || 0),
    giftCardRemainingBalance: order.giftCardCode ? money(order.giftCardRemainingBalance || 0) : "",
    freeShipping: order.freeShipping ? "Ja" : "Nee",
    message: order.notes || "-",
  });
}

async function sendTrackTraceMail(order) {
  await sendEmail({
    type: "track-trace",
    orderId: order.id,
    name: order.customer.name,
    email: order.customer.email,
    phone: order.customer.phone || "",
    total: money(order.total),
    orderSummary: orderSummaryText(order),
    orderItems: order.items,
    trackTrace: order.trackTrace || "",
  });
}

async function sendOrderStatusMail(order) {
  await sendEmail({
    type: "order-status",
    orderId: order.id,
    name: order.customer.name,
    email: order.customer.email,
    total: money(order.total),
    orderSummary: orderSummaryText(order),
    orderItems: order.items,
    orderStatus: order.status || "Aanvraag ontvangen",
    paymentStatus: order.paymentStatus || "Wacht op bevestiging",
  });
}

async function accountAdminRequest(action, payload = null, method = "POST") {
  const query = action.includes("&") ? `action=${action}` : `action=${encodeURIComponent(action)}`;
  const response = await fetch(`/.netlify/functions/admin-accounts?${query}`, {
    method,
    credentials: "same-origin",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json().catch(() => ({ message: "Klantaccountactie is mislukt." }));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Klantaccountactie is mislukt.");
  }
  return data;
}

async function refreshAccountAccounts(options = {}) {
  try {
    const data = await accountAdminRequest("list", null, "GET");
    adminState.accountAccounts = data.accounts || [];
    adminState.accountDuplicates = data.duplicates || [];
    adminState.accountStatuses = data.statuses || [];
    fillAccountStatusFilter();
    if (options.detailId) {
      await loadAccountDetail(options.detailId);
    } else {
      renderAccountManagement();
    }
  } catch (error) {
    const table = document.querySelector("[data-account-table]");
    if (table) {
      table.innerHTML = `<tr><td colspan="7">${escapeHtml(error.message)}</td></tr>`;
    }
  }
}

async function getAccountBackupData() {
  try {
    const data = await accountAdminRequest("backup", null, "GET");
    return data.accountBackup || { accounts: [] };
  } catch {
    return { accounts: [], note: "Klantaccounts konden niet uit online opslag worden opgehaald." };
  }
}

function fillAccountStatusFilter() {
  const filter = document.querySelector("[data-account-status-filter]");
  if (!filter || filter.dataset.loaded === "1") {
    return;
  }
  filter.innerHTML = '<option value="alles">Alle statussen</option>' + adminState.accountStatuses
    .map((status) => `<option value="${escapeAttribute(status)}">${escapeHtml(status)}</option>`)
    .join("");
  filter.dataset.loaded = "1";
}

function accountMatchesSearch(account) {
  const query = adminState.accountSearch.toLowerCase();
  if (!query) {
    return true;
  }
  const fields = [
    account.name,
    account.email,
    account.phone,
    account.address,
    account.city,
    account.postalCode,
    account.statusReason,
    ...(account.labels || []),
    ...(account.notes || []).flatMap((note) => [note.title, note.text, note.label]),
    account.metrics?.latestOrderId,
  ];
  return fields.some((value) => String(value || "").toLowerCase().includes(query));
}

function filteredAccounts() {
  const monthPrefix = new Date().toISOString().slice(0, 7);
  return adminState.accountAccounts
    .filter(accountMatchesSearch)
    .filter((account) => adminState.accountStatusFilter === "alles" || account.status === adminState.accountStatusFilter)
    .filter((account) => {
      const count = Number(account.metrics?.orderCount || 0);
      if (adminState.accountTypeFilter === "nieuw") return count === 0;
      if (adminState.accountTypeFilter === "terugkerend") return count > 1;
      if (adminState.accountTypeFilter === "zonder-bestellingen") return count === 0;
      if (adminState.accountTypeFilter === "met-bestellingen") return count > 0;
      return true;
    })
    .filter((account) => !adminState.accountOpenPaymentOnly || account.metrics?.openPayment)
    .filter((account) => !adminState.accountCreatedThisMonthOnly || String(account.createdAt || "").startsWith(monthPrefix))
    .sort((a, b) => {
      if (adminState.accountSort === "name") return String(a.name).localeCompare(String(b.name));
      if (adminState.accountSort === "email") return String(a.email).localeCompare(String(b.email));
      if (adminState.accountSort === "spent-desc") return Number(b.metrics?.totalSpent || 0) - Number(a.metrics?.totalSpent || 0);
      if (adminState.accountSort === "latest-desc") return new Date(b.metrics?.latestOrderAt || 0) - new Date(a.metrics?.latestOrderAt || 0);
      if (adminState.accountSort === "login-desc") return new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0);
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

function renderAccountManagement() {
  const table = document.querySelector("[data-account-table]");
  if (!table) {
    return;
  }
  const accounts = filteredAccounts();
  document.querySelector("[data-account-admin-summary]").textContent =
    `${accounts.length} van ${adminState.accountAccounts.length} accounts` +
    (adminState.accountDuplicates.length ? ` - ${adminState.accountDuplicates.length} mogelijke duplicaatgroep(en)` : "");

  table.innerHTML = accounts.length
    ? accounts
        .map((account) => {
          const labels = (account.labels || []).slice(0, 4);
          return `
            <tr>
              <td data-label="Klant">
                <strong>${escapeHtml(account.name || "-")}</strong>
                <span class="muted">${escapeHtml(account.email || "-")}</span>
                <span class="muted">${escapeHtml(account.phone || "")}</span>
              </td>
              <td data-label="Status"><span class="status-pill">${escapeHtml(account.status || "Actief")}</span></td>
              <td data-label="Bestellingen">
                <strong>${account.metrics?.orderCount || 0}</strong>
                <span class="muted">Laatste bestelling: ${escapeHtml(account.metrics?.latestOrderId || "Geen")}</span>
              </td>
              <td data-label="Omzet">
                <strong>${money(account.metrics?.totalSpent || 0)}</strong>
                <span class="muted">Openstaand: ${money(account.metrics?.openAmount || 0)}</span>
              </td>
              <td data-label="Laatst actief">${account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString("nl-NL") : "-"}</td>
              <td data-label="Labels">
                <div class="tag-list">${labels.map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>
              </td>
              <td data-label="Acties">
                <div class="table-actions">
                  <button class="row-button" type="button" data-account-detail-id="${account.id}">Bekijk</button>
                </div>
              </td>
            </tr>
          `;
        })
        .join("")
    : '<tr><td colspan="7">Geen klantaccounts gevonden.</td></tr>';
}

async function loadAccountDetail(accountId) {
  const data = await accountAdminRequest(`detail&id=${encodeURIComponent(accountId)}`, null, "GET");
  adminState.accountDetail = data;
  renderAccountDetail();
}

function renderAccountDetail() {
  const detail = document.querySelector("[data-account-detail]");
  if (!detail || !adminState.accountDetail?.account) {
    return;
  }
  const { account, orders = [], giftCards = [], suggestions = [] } = adminState.accountDetail;
  const resetText = account.resetActive
    ? `Resetlink actief. Laatste resetmail: ${account.lastResetSentAt ? new Date(account.lastResetSentAt).toLocaleString("nl-NL") : "-"}`
    : `Geen actieve resetlink. Laatste resetmail: ${account.lastResetSentAt ? new Date(account.lastResetSentAt).toLocaleString("nl-NL") : "-"}`;

  detail.innerHTML = `
    <div class="panel-heading">
      <div>
        <h2>${escapeHtml(account.name || "Klantaccount")}</h2>
        <span class="muted">${escapeHtml(account.email)} - ${escapeHtml(account.id)}</span>
      </div>
      <button class="ghost-button" type="button" data-account-export="${account.id}">Export klantgegevens</button>
    </div>
    <div class="account-detail-tabs">
      <a href="#account-overview">Overzicht</a>
      <a href="#account-data">Gegevens</a>
      <a href="#account-orders">Bestellingen</a>
      <a href="#account-notes">Notities</a>
      <a href="#account-security">Beveiliging</a>
      <a href="#account-history">Geschiedenis</a>
    </div>

    <section id="account-overview" class="detail-card">
      <h3>Overzicht</h3>
      <dl class="detail-list">
        <div><dt>Status</dt><dd>${escapeHtml(account.status)}</dd></div>
        <div><dt>Aangemaakt</dt><dd>${account.createdAt ? new Date(account.createdAt).toLocaleString("nl-NL") : "-"}</dd></div>
        <div><dt>Laatst ingelogd</dt><dd>${account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString("nl-NL") : "-"}</dd></div>
        <div><dt>Bestellingen</dt><dd>${account.metrics.orderCount}</dd></div>
        <div><dt>Totaal uitgegeven</dt><dd>${money(account.metrics.totalSpent)}</dd></div>
        <div><dt>Gemiddeld orderbedrag</dt><dd>${money(account.metrics.averageOrder)}</dd></div>
        <div><dt>Openstaand bedrag</dt><dd>${money(account.metrics.openAmount)}</dd></div>
        <div><dt>Cadeaubonnen</dt><dd>${account.metrics.giftCardCount}</dd></div>
      </dl>
      <div class="tag-list">${(account.labels || []).map((label) => `<span>${escapeHtml(label)}</span>`).join("")}</div>
    </section>

    <form id="account-data" class="detail-card" data-account-edit-form>
      <h3>Gegevens aanpassen</h3>
      <input name="id" type="hidden" value="${escapeAttribute(account.id)}" />
      <div class="settings-grid">
        <label>Volledige naam <input name="name" value="${escapeAttribute(account.name)}" required /></label>
        <label>E-mail <input name="email" type="email" value="${escapeAttribute(account.email)}" required /></label>
        <label>Voornaam <input name="firstName" value="${escapeAttribute(account.firstName)}" /></label>
        <label>Achternaam <input name="lastName" value="${escapeAttribute(account.lastName)}" /></label>
        <label>Telefoon <input name="phone" value="${escapeAttribute(account.phone)}" /></label>
        <label>Geboortedatum <input name="birthday" type="date" value="${escapeAttribute(account.birthday)}" /></label>
        <label>Voorkeurscontact <input name="preferredContact" value="${escapeAttribute(account.preferredContact)}" /></label>
        <label>Status
          <select name="status">
            ${adminState.accountStatuses.map((status) => `<option ${status === account.status ? "selected" : ""}>${escapeHtml(status)}</option>`).join("")}
          </select>
        </label>
        <label>Blokkade/status reden <input name="statusReason" value="${escapeAttribute(account.statusReason)}" /></label>
        <label>Labels <input name="labels" value="${escapeAttribute((account.labels || []).join(", "))}" /></label>
        <label>Straat <input name="street" value="${escapeAttribute(account.street)}" /></label>
        <label>Huisnummer <input name="houseNumber" value="${escapeAttribute(account.houseNumber)}" /></label>
        <label>Toevoeging <input name="addition" value="${escapeAttribute(account.addition)}" /></label>
        <label>Postcode <input name="postalCode" value="${escapeAttribute(account.postalCode)}" /></label>
        <label>Plaats <input name="city" value="${escapeAttribute(account.city)}" /></label>
        <label>Land <input name="country" value="${escapeAttribute(account.country)}" /></label>
      </div>
      <label>Adresregel <input name="address" value="${escapeAttribute(account.address)}" /></label>
      <label>Afleverinstructie <textarea name="deliveryInstructions" rows="2">${escapeHtml(account.deliveryInstructions)}</textarea></label>
      <label>Standaard verzendadres <textarea name="shippingAddress" rows="2">${escapeHtml(account.shippingAddress)}</textarea></label>
      <label>Extra adres <textarea name="extraAddress" rows="2">${escapeHtml(account.extraAddress)}</textarea></label>
      <label>Aflevernotitie <textarea name="deliveryNote" rows="2">${escapeHtml(account.deliveryNote)}</textarea></label>
      <label>Cadeauvoorkeuren <textarea name="giftPreferences" rows="2">${escapeHtml(account.giftPreferences)}</textarea></label>
      <button class="primary-button" type="submit">Gegevens opslaan</button>
    </form>

    <section id="account-orders" class="detail-card">
      <h3>Bestellingen en cadeaubonnen</h3>
      ${orders.length ? orders.map((order) => `
        <article class="account-order-admin">
          <strong>${escapeHtml(order.id)}</strong>
          <span>${order.createdAt ? new Date(order.createdAt).toLocaleDateString("nl-NL") : "-"} - ${money(order.total)} - ${escapeHtml(order.status || "-")} - ${escapeHtml(order.paymentStatus || "-")}</span>
          <span>${escapeHtml(order.productNames || "")}</span>
          <button class="row-button" type="button" data-unlink-order="${order.id}" data-account-id="${account.id}">Ontkoppel</button>
        </article>
      `).join("") : '<p class="muted">Deze klant heeft nog geen bestellingen.</p>'}
      <h4>Voorstellen met hetzelfde e-mailadres</h4>
      ${
        suggestions.length
          ? `<button class="row-button" type="button" data-link-all-suggestions="${account.id}">Alles koppelen</button>`
          : ""
      }
      ${suggestions.length ? suggestions.map((order) => `
        <article class="account-order-admin">
          <strong>${escapeHtml(order.id)}</strong>
          <span>${money(order.total)} - ${escapeHtml(order.status || "-")}</span>
          <button class="row-button" type="button" data-link-order="${order.id}" data-account-id="${account.id}">Koppel</button>
        </article>
      `).join("") : '<p class="muted">Geen losse bestellingen gevonden met hetzelfde e-mailadres.</p>'}
      <form class="inline-form" data-manual-link-form>
        <input name="accountId" type="hidden" value="${escapeAttribute(account.id)}" />
        <label>Ordernummer handmatig koppelen <input name="orderId" /></label>
        <button class="row-button" type="submit">Koppel bestelling</button>
      </form>
      <h4>Cadeaubonnen</h4>
      ${giftCards.length ? giftCards.map((card) => `<p><strong>${escapeHtml(card.code)}</strong> - ${money(card.balance)} saldo - ${escapeHtml(card.paymentStatus || "Actief")}</p>`).join("") : '<p class="muted">Geen cadeaubonnen gekoppeld.</p>'}
    </section>

    <section id="account-notes" class="detail-card">
      <h3>Interne notities</h3>
      <form data-account-note-form>
        <input name="id" type="hidden" value="${escapeAttribute(account.id)}" />
        <div class="settings-grid">
          <label>Titel <input name="title" /></label>
          <label>Label
            <select name="label">
              ${["Belangrijk", "Wacht op reactie", "Voorkeur", "Probleem", "Betaling", "Maatwerk", "Cadeaubon", "Retour"].map((label) => `<option>${label}</option>`).join("")}
            </select>
          </label>
        </div>
        <label>Tekst <textarea name="text" rows="3" required></textarea></label>
        <button class="row-button" type="submit">Notitie toevoegen</button>
      </form>
      <div class="history-list">
        ${(account.notes || []).map((note) => `
          <article>
            <strong>${escapeHtml(note.label || "Notitie")} ${note.title ? `- ${escapeHtml(note.title)}` : ""}</strong>
            <span>${note.createdAt ? new Date(note.createdAt).toLocaleString("nl-NL") : "-"}</span>
            <p>${escapeHtml(note.text || "")}</p>
          </article>
        `).join("") || '<p class="muted">Nog geen interne notities.</p>'}
      </div>
    </section>

    <section id="account-security" class="detail-card">
      <h3>Beveiliging en privacy</h3>
      <p class="muted">${escapeHtml(resetText)} Mislukte loginpogingen: ${account.failedLoginAttempts || 0}</p>
      <div class="manual-payment-actions">
        <button class="row-button" type="button" data-send-account-reset="${account.id}">Wachtwoordreset sturen</button>
        <button class="row-button" type="button" data-send-account-invite="${account.id}">Uitnodigingsmail sturen</button>
        <button class="row-button" type="button" data-invalidate-account-reset="${account.id}">Resetlink ongeldig maken</button>
        <button class="row-button" type="button" data-account-block="${account.id}">Blokkeren</button>
        <button class="row-button" type="button" data-account-unblock="${account.id}">Deblokkeren</button>
        <button class="row-button" type="button" data-account-anonymize="${account.id}">Anonimiseren</button>
        <button class="row-button" type="button" data-print-account>Print klantoverzicht</button>
      </div>
      <form data-account-mail-form>
        <h4>Klantmail sturen</h4>
        <label>Template
          <select name="template">
            <option>Algemene mail</option>
            <option>Vraag over bestelling</option>
            <option>Betaalinstructie</option>
            <option>Betaling ontvangen</option>
            <option>Maatwerk afstemmen</option>
            <option>Bestelling in productie</option>
            <option>Bestelling verzonden</option>
            <option>Cadeaubon informatie</option>
            <option>Retour/annulering</option>
          </select>
        </label>
        <label>Onderwerp <input name="subject" value="Bericht van Tiny Doll Atelier" required /></label>
        <label>Bericht <textarea name="text" rows="5" required>Hallo ${escapeHtml(account.name)},&#10;&#10;</textarea></label>
        <button class="primary-button" type="submit">Klantmail sturen</button>
      </form>
    </section>

    <section id="account-history" class="detail-card">
      <h3>Accountgeschiedenis</h3>
      <div class="history-list">
        ${(account.history || []).map((entry) => `
          <article>
            <strong>${escapeHtml(entry.action || "-")} <span class="muted">(${escapeHtml(entry.actor || "systeem")})</span></strong>
            <span>${entry.at ? new Date(entry.at).toLocaleString("nl-NL") : "-"}</span>
            <p>${escapeHtml(entry.description || "")}</p>
          </article>
        `).join("") || '<p class="muted">Nog geen accountgeschiedenis.</p>'}
      </div>
    </section>
  `;
}

async function sendEmail(payload) {
  const response = await fetch("/.netlify/functions/send-email", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webshopNaam: adminState.settings.shopName,
      ...payload,
    }),
  });
  const data = await response.json().catch(() => ({ message: "Verzenden is mislukt." }));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Verzenden is mislukt.");
  }
  return data;
}

function appendStatusHistory(order, type, from, to) {
  return {
    ...order,
    statusHistory: [
      ...(order.statusHistory || []),
      {
        at: new Date().toISOString(),
        type,
        from: from || "-",
        to,
      },
    ],
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function printOrder(orderId, type) {
  const order = adminState.orders.find((item) => item.id === orderId);
  if (!order) {
    return;
  }

  const products = order.items
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${item.quantity}</td>
          <td>${money(item.price)}</td>
          ${type === "order" ? `<td>${money(item.price * item.quantity)}</td>` : ""}
        </tr>
      `,
    )
    .join("");
  const html = `
    <!doctype html>
    <html lang="nl">
      <head>
        <meta charset="utf-8">
        <title>${type === "order" ? "Bestelling" : "Pakbon"} ${order.id}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #342216; padding: 28px; }
          h1 { margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border-bottom: 1px solid #dcc8b7; padding: 10px; text-align: left; }
          .muted { color: #806a59; }
        </style>
      </head>
      <body>
        <h1>${type === "order" ? "Bestelling" : "Pakbon"} ${order.id}</h1>
        <p class="muted">${new Date(order.createdAt).toLocaleString("nl-NL")}</p>
        <p><strong>Klant:</strong> ${escapeHtml(order.customer.name)}<br>
        <strong>E-mail:</strong> ${escapeHtml(order.customer.email)}<br>
        <strong>Telefoon:</strong> ${escapeHtml(order.customer.phone || "-")}</p>
        <p><strong>Status:</strong> ${escapeHtml(order.status)}<br>
        <strong>Betaalstatus:</strong> ${escapeHtml(order.paymentStatus || "Wacht op bevestiging")}<br>
        <strong>Verzending:</strong> ${escapeHtml(order.shippingMethod || "-")}<br>
        <strong>Track & trace:</strong> ${escapeHtml(order.trackTrace || "-")}</p>
        <table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Aantal</th>
              <th>Prijs</th>
              ${type === "order" ? "<th>Totaal</th>" : ""}
            </tr>
          </thead>
          <tbody>${products}</tbody>
        </table>
        ${type === "order" ? `<h2>Totaal: ${money(order.total)}</h2>` : ""}
        <p><strong>Opmerking:</strong><br>${escapeHtml(order.notes || "-")}</p>
      </body>
    </html>
  `;
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function refreshData() {
  adminState.products = TinyStore.getProducts();
  adminState.categories = TinyStore.getCategories();
  adminState.discounts = TinyStore.getDiscounts();
  adminState.giftCards = TinyStore.getGiftCards();
  adminState.orders = TinyStore.getOrders();
  adminState.customers = TinyStore.getCustomers();
  adminState.settings = TinyStore.getSettings();
  adminState.reviews = TinyStore.getReviews();
  adminState.emailTemplates = TinyStore.getEmailTemplates();
}

function setView(viewName, options = {}) {
  activeViewName = viewName;
  views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === viewName));
  navButtons.forEach((button) =>
    button.classList.toggle("is-active", button.dataset.viewButton === viewName),
  );

  if (options.refresh !== false) {
    refreshViewFromCloud(viewName);
  }
  if (viewName === "customeraccounts") {
    refreshAccountAccounts();
  }
}

function renderDashboard() {
  const data = TinyStore.getDashboard();
  document.querySelector("[data-metrics]").innerHTML = [
    ["Omzet deze week", money(data.weekRevenue), `${data.weekOrders} bestellingen`],
    ["Omzet deze maand", money(data.monthRevenue), `${data.monthOrders} bestellingen`],
    ["Bezoekers deze week", data.weekVisitors, "lokaal gemeten"],
    ["Bezoekers deze maand", data.monthVisitors, "lokaal gemeten"],
  ]
    .map(
      ([label, value, detail]) => `
        <article class="metric">
          <span>${label}</span>
          <strong>${value}</strong>
          <span>${detail}</span>
        </article>
      `,
    )
    .join("");

  const maxVisits = Math.max(...data.visits.map((visit) => visit.count), 1);
  document.querySelector("[data-visit-chart]").innerHTML = data.visits
    .map((visit) => {
      const height = Math.max(8, Math.round((visit.count / maxVisits) * 210));
      const label = new Date(`${visit.date}T00:00:00`).toLocaleDateString("nl-NL", {
        weekday: "short",
      });
      return `
        <div class="bar">
          <span>${visit.count}</span>
          <div class="bar-fill" style="height:${height}px"></div>
          <span>${label}</span>
        </div>
      `;
    })
    .join("");

  document.querySelector("[data-bestsellers]").innerHTML =
    data.bestsellers
      .map(
        (item) => `
          <article class="seller-row">
            <div>
              <strong>${item.name}</strong>
              <span class="muted">${item.quantity} verkocht</span>
            </div>
            <strong>${money(item.revenue)}</strong>
          </article>
        `,
      )
      .join("") || '<p class="muted">Nog geen verkoopdata.</p>';
}

function renderProductFormOptions() {
  productForm.elements.categoryId.innerHTML = adminState.categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join("");
}

function setImagePreview(src, label = "") {
  if (!src) {
    imagePreview.hidden = true;
    imagePreview.querySelector("img").removeAttribute("src");
    uploadName.textContent = "Geen bestand gekozen";
    return;
  }

  imagePreview.hidden = false;
  imagePreview.querySelector("img").src = src;
  uploadName.textContent = label || (src.startsWith("data:image") ? "Geuploade afbeelding" : src);
}

function extraImageList() {
  return productForm.elements.extraImages.value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function setExtraImagePreview(images = extraImageList(), label = "") {
  extraImagePreview.innerHTML = "";
  extraImagePreview.hidden = !images.length;
  extraUploadName.textContent =
    label || (images.length ? `${images.length} extra afbeelding${images.length === 1 ? "" : "en"}` : "Geen extra bestanden gekozen");

  images.slice(0, 12).forEach((src) => {
    const image = document.createElement("img");
    image.src = src;
    image.alt = "Extra productafbeelding";
    extraImagePreview.append(image);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.src = "";
      reject(new Error("Afbeelding laden duurde te lang."));
    }, 12000);
    image.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve(image);
    });
    image.addEventListener("error", () => {
      window.clearTimeout(timeout);
      reject(new Error("Afbeelding kon niet worden gelezen."));
    });
    image.src = src;
  });
}

async function resizeImageFile(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Kies een afbeeldingsbestand.");
  }

  const dataUrl = await fileToDataUrl(file);

  try {
    const image = await loadImage(dataUrl);
    const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, MAX_PRODUCT_IMAGE_SIZE / largestSide);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Afbeelding kon niet worden verkleind.");
    }
    context.fillStyle = "#fffaf4";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const resized = canvas.toDataURL("image/jpeg", PRODUCT_IMAGE_QUALITY);
    canvas.width = 1;
    canvas.height = 1;
    return resized;
  } catch (error) {
    if (dataUrl.length > 950000) {
      throw new Error("Deze foto is te groot of wordt door iPhone/Safari niet goed gelezen. Kies een kleinere JPG-foto of maak een screenshot van de foto en upload die.");
    }
    return dataUrl;
  }
}

function renderProducts() {
  renderProductFormOptions();
  document.querySelector("[data-product-count]").textContent =
    `${adminState.products.length} producten`;
  document.querySelector("[data-product-table]").innerHTML = adminState.products
    .map((product) => {
      const quantity = stockQuantity(product);
      const stockStatus = product.soldOut
        ? "Tijdelijk uitverkocht"
        : quantity > 0
          ? `${quantity} op voorraad`
          : product.madeToOrder
            ? "Op bestelling"
            : "Geen voorraad";
      const tags = [
        product.featured ? "Uitgelicht" : "",
        product.bestseller ? "Bestseller" : "",
        product.madeToOrder ? "Op bestelling" : "",
        product.soldOut ? "Tijdelijk uitverkocht" : "",
      ].filter(Boolean);
      return `
        <tr>
          <td data-label="Product">
            <strong>${product.name}</strong>
            <span class="muted">${tags.length ? tags.join(" / ") : product.stock}</span>
          </td>
          <td data-label="Categorie">${categoryName(product.categoryId)}</td>
          <td data-label="Prijs">${money(product.price)}</td>
          <td data-label="Voorraad"><strong>${stockStatus}</strong><span class="muted">${product.leadTime || ""}</span></td>
          <td data-label="Status"><span class="status-pill">${product.active ? "Zichtbaar" : "Verborgen"}</span></td>
          <td data-label="Acties">
            <div class="table-actions">
              <button class="row-button" type="button" data-edit-product="${product.id}">Bewerk</button>
              <button class="row-button" type="button" data-delete-product="${product.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCategories() {
  document.querySelector("[data-category-list]").innerHTML = adminState.categories
    .map(
      (category) => `
        <span class="chip">
          ${category.name}
          <button type="button" data-delete-category="${category.id}" aria-label="${category.name} verwijderen">x</button>
        </span>
      `,
    )
    .join("");
}

function renderDiscounts() {
  document.querySelector("[data-discount-table]").innerHTML = adminState.discounts
    .map((discount) => {
      const value = discount.type === "percent" ? `${discount.value}%` : money(discount.value);
      const shippingRules = [
        discount.freeShipping ? "Gratis verzending" : "",
        Number(discount.freeShippingFrom) > 0
          ? `Gratis vanaf ${money(discount.freeShippingFrom)}`
          : "",
      ].filter(Boolean);
      return `
        <tr>
          <td data-label="Code"><strong>${discount.code}</strong></td>
          <td data-label="Korting">${value}</td>
          <td data-label="Verzending">${shippingRules.length ? shippingRules.join("<br>") : "-"}</td>
          <td data-label="Gebruikt">${discount.uses}</td>
          <td data-label="Status"><span class="status-pill">${discount.active ? "Actief" : "Uit"}</span></td>
          <td data-label="Acties">
            <div class="table-actions">
              <button class="row-button" type="button" data-toggle-discount="${discount.id}">
                ${discount.active ? "Zet uit" : "Zet aan"}
              </button>
              <button class="row-button" type="button" data-delete-discount="${discount.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderGiftCards() {
  document.querySelector("[data-gift-card-table]").innerHTML = adminState.giftCards
    .map((giftCard) => {
      const isExpired = giftCard.expiresAt && giftCard.expiresAt < new Date().toISOString().slice(0, 10);
      const status =
        giftCard.paymentStatus ||
        (!giftCard.active ? "Uit" : isExpired ? "Verlopen" : giftCard.balance <= 0 ? "Gebruikt" : "Actief");
      return `
        <tr>
          <td data-label="Code"><strong>${giftCard.code}</strong></td>
          <td data-label="Ontvanger">
            <strong>${giftCard.recipient || "-"}</strong>
            <span class="muted">${giftCard.email || ""}</span>
          </td>
          <td data-label="Waarde">${money(giftCard.initialValue)}</td>
          <td data-label="Saldo">${money(giftCard.balance)}</td>
          <td data-label="Geldig tot">${giftCard.expiresAt || "-"}</td>
          <td data-label="Status"><span class="status-pill">${status}</span></td>
          <td data-label="Acties">
            <div class="table-actions">
              <button class="row-button" type="button" data-edit-gift-card="${giftCard.id}">Bewerk</button>
              <button class="row-button" type="button" data-toggle-gift-card="${giftCard.id}">
                ${giftCard.active ? "Zet uit" : "Zet aan"}
              </button>
              <button class="row-button" type="button" data-delete-gift-card="${giftCard.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderCustomers() {
  const query = adminState.customerSearch.toLowerCase();
  const customers = adminState.customers.filter((customer) =>
    [
      customer.name,
      customer.email,
      customer.phone,
      customer.address,
      customer.postalCode,
      customer.city,
      customer.country,
      customer.notes,
    ].some((value) =>
      String(value).toLowerCase().includes(query),
    ),
  );
  document.querySelector("[data-customer-table]").innerHTML = customers
    .map(
      (customer) => `
        <tr>
          <td data-label="Klant">
            <strong>${escapeHtml(customer.name)}</strong>
            <span class="muted">Laatste: ${escapeHtml(customer.lastOrderAt || "-")}</span>
          </td>
          <td data-label="Contact">
            ${escapeHtml(customer.email)}
            <span class="muted">${escapeHtml(customer.phone || "-")}</span>
          </td>
          <td data-label="Adres">
            ${escapeHtml(customer.address || "-")}
            <span class="muted">${escapeHtml([customer.postalCode, customer.city, customer.country].filter(Boolean).join(" ") || "-")}</span>
          </td>
          <td data-label="Bestellingen">${customer.orderCount || 0}</td>
          <td data-label="Omzet">${money(customer.totalSpent)}</td>
          <td data-label="Acties">
            <div class="table-actions">
              <button class="row-button" type="button" data-edit-customer="${customer.id}">Bewerk</button>
              <button class="row-button" type="button" data-delete-customer="${customer.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join("") || '<tr><td colspan="6">Nog geen klanten gevonden.</td></tr>';

  if (adminState.editingCustomerId) {
    renderCustomerDetail(adminState.editingCustomerId);
  }
}

function customerOrders(customer) {
  return adminState.orders.filter(
    (order) => order.customer?.email?.toLowerCase() === customer.email?.toLowerCase(),
  );
}

function renderCustomerDetail(customerId) {
  const customer = adminState.customers.find((item) => item.id === customerId);
  const panel = document.querySelector("[data-customer-detail]");
  if (!customer) {
    adminState.editingCustomerId = "";
    panel.innerHTML = `
      <div class="panel-heading"><h2>Klantdetail</h2></div>
      <p class="muted">Klik op bewerk bij een klant om gegevens en notities aan te passen.</p>
    `;
    return;
  }

  adminState.editingCustomerId = customerId;
  const orders = customerOrders(customer);
  panel.innerHTML = `
    <div class="panel-heading">
      <h2>Klant bewerken</h2>
      <button class="ghost-button" type="button" data-cancel-customer>Annuleren</button>
    </div>
    <form class="customer-form" data-customer-form>
      <input name="id" type="hidden" value="${escapeAttribute(customer.id)}" />
      <div class="settings-grid">
        <label>Naam <input name="name" value="${escapeAttribute(customer.name)}" required /></label>
        <label>E-mail <input name="email" type="email" value="${escapeAttribute(customer.email)}" required /></label>
        <label>Telefoon <input name="phone" value="${escapeAttribute(customer.phone || "")}" /></label>
        <label>Land <input name="country" value="${escapeAttribute(customer.country || "")}" /></label>
        <label>Adres <input name="address" value="${escapeAttribute(customer.address || "")}" /></label>
        <label>Postcode <input name="postalCode" value="${escapeAttribute(customer.postalCode || "")}" /></label>
        <label>Plaats <input name="city" value="${escapeAttribute(customer.city || "")}" /></label>
      </div>
      <label>Interne notities <textarea name="notes" rows="4">${escapeHtml(customer.notes || "")}</textarea></label>
      <div class="detail-card">
        <h3>Overzicht</h3>
        <dl class="detail-list">
          <div><dt>Aantal bestellingen</dt><dd>${customer.orderCount || 0}</dd></div>
          <div><dt>Totaal besteed</dt><dd>${money(customer.totalSpent)}</dd></div>
          <div><dt>Laatste bestelling</dt><dd>${escapeHtml(customer.lastOrderAt || "-")}</dd></div>
        </dl>
      </div>
      <div class="customer-orders">
        <h3>Eerdere bestellingen</h3>
        ${
          orders.length
            ? orders
                .map(
                  (order) => `
                    <article>
                      <strong>${escapeHtml(order.id)}</strong>
                      <span>${new Date(order.createdAt).toLocaleDateString("nl-NL")} - ${money(order.total)} - ${escapeHtml(order.status || "-")}</span>
                    </article>
                  `,
                )
                .join("")
            : '<p class="muted">Geen eerdere bestellingen gevonden.</p>'
        }
      </div>
      <div class="form-actions">
        <button class="primary-button" type="submit">Opslaan</button>
        <button class="ghost-button" type="button" data-cancel-customer>Annuleren</button>
      </div>
    </form>
  `;
}

function renderOrders() {
  const orders =
    adminState.orderFilter === "alles"
      ? adminState.orders
      : adminState.orders.filter((order) => order.status === adminState.orderFilter);
  document.querySelector("[data-order-table]").innerHTML = orders
    .map(
      (order) => {
        const paymentStatus = order.paymentStatus || "Wacht op bevestiging";
        return `
        <tr>
          <td data-label="Bestelling">
            <strong>${order.id}</strong>
            <span class="muted">${new Date(order.createdAt).toLocaleDateString("nl-NL")}</span>
          </td>
          <td data-label="Klant">
            <strong>${order.customer.name}</strong>
            <span class="muted">${order.customer.email}</span>
          </td>
          <td data-label="Items">${order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
          <td data-label="Totaal">${money(order.total)}</td>
          <td data-label="Betaalstatus"><span class="payment-pill payment-${String(paymentStatus).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}">${paymentStatus}</span></td>
          <td data-label="Status">
            <select data-order-status="${order.id}">
              ${orderStatuses
                .map(
                  (status) =>
                    `<option ${status === order.status ? "selected" : ""}>${status}</option>`,
                )
                .join("")}
            </select>
          </td>
          <td data-label="Acties">
            <div class="table-actions">
              <button class="row-button" type="button" data-order-detail="${order.id}">Details</button>
              <button class="row-button" type="button" data-delete-order="${order.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `;
      },
    )
    .join("");
}

function renderOrderDetail(orderId) {
  const order = adminState.orders.find((item) => item.id === orderId);
  const detail = document.querySelector("[data-order-detail-panel]");
  if (!order) {
    detail.classList.remove("is-open");
    detail.innerHTML = "";
    return;
  }

  adminState.selectedOrderId = orderId;
  const itemSubtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const createdAt = new Date(order.createdAt);
  const shippingText = order.freeShipping
    ? `Gratis via ${order.discountCode || "kortingscode"}`
    : order.shippingMethod || "Wordt afgestemd";
  const paymentStatus = order.paymentStatus || "Wacht op bevestiging";
  const history = order.statusHistory || [];
  detail.classList.add("is-open");
  detail.innerHTML = `
    <div class="order-detail-header">
      <div>
        <p class="eyebrow">Bestelling</p>
        <h2>${order.id}</h2>
        <p class="muted">${createdAt.toLocaleDateString("nl-NL", {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })} om ${createdAt.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      <div class="detail-actions">
        <button class="row-button" type="button" data-print-order="${order.id}">Print bestelling</button>
        <button class="row-button" type="button" data-print-packing-slip="${order.id}">Pakbon</button>
        <button class="row-button" type="button" data-delete-order="${order.id}">Verwijder</button>
      </div>
    </div>

    <div class="order-detail-grid">
      <section class="detail-card">
        <h3>Klantgegevens</h3>
        <dl class="detail-list">
          <div><dt>Naam</dt><dd>${order.customer.name}</dd></div>
          <div><dt>E-mail</dt><dd>${order.customer.email}</dd></div>
          <div><dt>Telefoon</dt><dd>${order.customer.phone || "-"}</dd></div>
        </dl>
      </section>

      <section class="detail-card">
        <h3>Status en inhoud</h3>
        <dl class="detail-list">
          <div><dt>Status</dt><dd>${order.status}</dd></div>
          <div><dt>Betaalstatus</dt><dd>${paymentStatus}</dd></div>
          <div><dt>Betaalinstructie verstuurd</dt><dd>${order.paymentInstructionsSentAt ? "Ja" : "Nee"}</dd></div>
          <div><dt>Betaalinstructie op</dt><dd>${order.paymentInstructionsSentAt ? new Date(order.paymentInstructionsSentAt).toLocaleString("nl-NL") : "-"}</dd></div>
          <div><dt>Betaaldatum</dt><dd>${order.paidAt ? new Date(order.paidAt).toLocaleString("nl-NL") : "-"}</dd></div>
          <div><dt>Track mail verstuurd</dt><dd>${order.trackTraceMailSentAt ? "Ja" : "Nee"}</dd></div>
          <div><dt>Track mail op</dt><dd>${order.trackTraceMailSentAt ? new Date(order.trackTraceMailSentAt).toLocaleString("nl-NL") : "-"}</dd></div>
          <div><dt>Productregels</dt><dd>${order.items.length}</dd></div>
          <div><dt>Aantal items</dt><dd>${itemCount}</dd></div>
          <div><dt>Volgende stap</dt><dd>${order.status === "Nieuw" ? "Stem levertijd en betaling af." : "Werk status, betaling en verzending bij."}</dd></div>
        </dl>
      </section>
    </div>

    <section class="detail-card">
      <h3>Betaalgegevens voor klant</h3>
      <dl class="detail-list">
        <div><dt>Rekeninghouder</dt><dd>${escapeHtml(adminState.settings.paymentHolder || "R Stavasius")}</dd></div>
        <div><dt>IBAN</dt><dd>${escapeHtml(adminState.settings.paymentIban || "NL25 RABO 0316 0597 49")}</dd></div>
        <div><dt>Omschrijving</dt><dd>${escapeHtml(order.id)}</dd></div>
      </dl>
    </section>

    <section class="detail-card">
      <h3>Beheeracties</h3>
      <div class="order-admin-grid">
        <label>
          Betaalstatus
          <select data-payment-status="${order.id}">
            ${paymentStatuses
              .map(
                (status) =>
                  `<option ${status === paymentStatus ? "selected" : ""}>${status}</option>`,
              )
              .join("")}
          </select>
        </label>
        <label>Verzendmethode <input data-order-shipping-method="${order.id}" value="${escapeAttribute(
          order.shippingMethod || "",
        )}" /></label>
        <label>Track & trace <input data-order-track-trace="${order.id}" value="${escapeAttribute(
          order.trackTrace || "",
        )}" /></label>
        <label class="wide-field">Interne notitie <textarea rows="3" data-order-admin-notes="${order.id}">${escapeHtml(
          order.adminNotes || "",
        )}</textarea></label>
      </div>
      <button class="primary-button" type="button" data-save-order-admin="${order.id}">Ordergegevens opslaan</button>
      <div class="manual-payment-actions">
        <button class="row-button" type="button" data-send-payment-instructions="${order.id}">Betaalinstructie versturen</button>
        <button class="row-button" type="button" data-mark-paid="${order.id}">Markeer als betaald</button>
        <button class="row-button" type="button" data-resend-track="${order.id}">Track & trace mail opnieuw versturen</button>
        <button class="row-button" type="button" data-mark-shipped="${order.id}">Markeer als verzonden</button>
        <button class="row-button" type="button" data-send-status-mail="${order.id}">Klantmail sturen</button>
      </div>
      <p class="form-note">${order.paymentInstructionsSentAt ? `Betaalinstructie verstuurd op ${new Date(order.paymentInstructionsSentAt).toLocaleString("nl-NL")}.` : "Betaalinformatie volgt na bevestiging."}</p>
    </section>

    <section class="detail-card order-products-card">
      <div class="detail-card-heading">
        <h3>Producten</h3>
        <span>${itemCount} items</span>
      </div>
      <div class="order-lines">
        ${order.items
          .map((item) => {
            const lineTotal = item.price * item.quantity;
            const imageLink = item.image
              ? `<a class="image-link" href="${assetUrl(item.image)}" target="_blank" rel="noreferrer">Afbeelding bekijken</a>`
              : "";
            return `
              <article class="order-line-card">
                ${item.image ? `<img class="order-line-image" src="${item.image}" alt="">` : ""}
                <div>
                  <strong>${item.name}</strong>
                  <span>${item.quantity} x ${money(item.price)} per stuk</span>
                  ${imageLink}
                </div>
                <strong>${money(lineTotal)}</strong>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>

    <div class="order-detail-grid">
      <section class="detail-card">
        <h3>Kostenoverzicht</h3>
        <dl class="detail-list">
          <div><dt>Subtotaal</dt><dd>${money(itemSubtotal)}</dd></div>
          <div><dt>Korting</dt><dd>${order.discountCode || "-"} ${order.discountAmount ? `(-${money(order.discountAmount)})` : ""}</dd></div>
          <div><dt>Verzending</dt><dd>${shippingText}</dd></div>
          <div><dt>Track & trace</dt><dd>${order.trackTrace || "-"}</dd></div>
          <div><dt>Cadeaubon</dt><dd>${order.giftCardCode || "-"} ${order.giftCardAmount ? `(-${money(order.giftCardAmount)})` : ""}</dd></div>
          <div class="total-row"><dt>Totaal</dt><dd>${money(order.total)}</dd></div>
        </dl>
      </section>

      <section class="detail-card">
        <h3>Opmerking</h3>
        <p class="order-note">${order.notes || "Geen opmerking ingevuld."}</p>
        <h3>Interne notitie</h3>
        <p class="order-note">${order.adminNotes || "Geen interne notitie."}</p>
      </section>
    </div>

    <section class="detail-card">
      <h3>Statusgeschiedenis</h3>
      <div class="history-list">
        ${
          history.length
            ? history
                .map(
                  (entry) => `
                    <article>
                      <strong>${entry.type === "payment" ? "Betaalstatus" : "Orderstatus"}</strong>
                      <span>${new Date(entry.at).toLocaleString("nl-NL")}</span>
                      <p>${entry.from || "-"} naar ${entry.to}</p>
                    </article>
                  `,
                )
                .join("")
            : '<p class="muted">Nog geen statusgeschiedenis.</p>'
        }
      </div>
    </section>
  `;
}

function renderReviews() {
  const table = document.querySelector("[data-review-table]");
  table.innerHTML =
    adminState.reviews
      .map(
        (review) => `
          <tr>
            <td data-label="Klant">
              <strong>${escapeHtml(review.name)}</strong>
              <span class="muted">${escapeHtml(review.product || "")}</span>
            </td>
            <td data-label="Review">${escapeHtml(review.text)}</td>
            <td data-label="Status"><span class="status-pill">${review.visible ? "Zichtbaar" : "Verborgen"}</span></td>
            <td data-label="Acties">
              <div class="table-actions">
                <button class="row-button" type="button" data-edit-review="${review.id}">Bewerk</button>
                <button class="row-button" type="button" data-toggle-review="${review.id}">${review.visible ? "Verberg" : "Toon"}</button>
                <button class="row-button" type="button" data-delete-review="${review.id}">Verwijder</button>
              </div>
            </td>
          </tr>
        `,
      )
      .join("") || '<tr><td colspan="4">Nog geen reviews toegevoegd.</td></tr>';
}

function renderEmailTemplates() {
  document.querySelector("[data-email-template-list]").innerHTML = adminState.emailTemplates
    .map(
      (template) => `
        <article class="template-card" data-template-card="${template.id}">
          <label>Titel <input data-template-field="title" value="${escapeAttribute(template.title)}" /></label>
          <label>Onderwerp <input data-template-field="subject" value="${escapeAttribute(template.subject)}" /></label>
          <label>Tekst <textarea rows="7" data-template-field="body">${escapeHtml(template.body)}</textarea></label>
        </article>
      `,
    )
    .join("");
}

function renderSettings() {
  Object.entries(adminState.settings).forEach(([key, value]) => {
    if (settingsForm.elements[key]) {
      if (settingsForm.elements[key].type === "checkbox") {
        settingsForm.elements[key].checked = Boolean(value);
      } else {
        settingsForm.elements[key].value = value ?? "";
      }
    }
  });
}

function renderAll() {
  refreshData();
  renderDashboard();
  renderProducts();
  renderCategories();
  renderDiscounts();
  renderGiftCards();
  renderReviews();
  renderEmailTemplates();
  renderSettings();
  renderCustomers();
  renderAccountManagement();
  renderOrders();
  if (adminState.selectedOrderId) {
    renderOrderDetail(adminState.selectedOrderId);
  }
  if (!onlineEditingEnabled) {
    setOnlineEditingEnabled(false);
  }
}

async function refreshCloudDataQuietly() {
  if (!cloudReady || cloudSyncing) {
    return;
  }

  cloudSyncing = true;
  try {
    const result = await TinyStore.loadCloudData({ admin: true });
    if (result.changed) {
      renderAll();
      setCloudStatus("Online gegevens bijgewerkt.");
    }
  } catch {
    // De bestaande data blijft zichtbaar als online verversen tijdelijk niet lukt.
  } finally {
    cloudSyncing = false;
  }
}

async function refreshViewFromCloud(viewName) {
  if (!cloudReady || cloudSyncing || !onlineEditingEnabled) {
    return;
  }

  if (cloudSaveTimer || cloudSaveInFlight) {
    setCloudStatus("Wacht even: wijzigingen worden nog online opgeslagen...");
    return;
  }

  const refreshId = ++viewRefreshCounter;
  cloudSyncing = true;

  try {
    const result = await TinyStore.loadCloudData({ admin: true });
    if (refreshId !== viewRefreshCounter) {
      return;
    }

    renderAll();
    setView(viewName, { refresh: false });
    if (result.changed) {
      setCloudStatus("Online gegevens bijgewerkt.");
    }
  } catch (error) {
    setCloudStatus(error.message || "Online gegevens konden niet worden opgehaald.", true);
  } finally {
    cloudSyncing = false;
  }
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewButton));
});

document.addEventListener(
  "submit",
  (event) => {
    if (onlineEditingEnabled) {
      return;
    }

    event.preventDefault();
    setCloudStatus("Online opslag is verplicht. Log opnieuw in of controleer Netlify Blobs.", true);
  },
  true,
);

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = productForm.querySelector('button[type="submit"]');
  const originalText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = "Product opslaan...";

  try {
    const data = new FormData(productForm);
    const id = data.get("id") || TinyStore.slugify(data.get("name"));
    const product = {
      id,
      name: data.get("name").trim(),
      categoryId: data.get("categoryId"),
      price: Number(data.get("price")),
      stockQuantity: Number(data.get("stockQuantity")),
      stock: data.get("stock").trim(),
      badge: data.get("badge").trim(),
      image: data.get("image").trim(),
      description: data.get("description").trim(),
      longDescription: data.get("longDescription").trim(),
      material: data.get("material").trim(),
      size: data.get("size").trim(),
      leadTime: data.get("leadTime").trim(),
      washCare: data.get("washCare").trim(),
      extraImages: data
        .get("extraImages")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
      featured: data.get("featured") === "on",
      bestseller: data.get("bestseller") === "on",
      madeToOrder: data.get("madeToOrder") === "on",
      soldOut: data.get("soldOut") === "on",
      active: data.get("active") === "on",
    };
    const products = adminState.products.filter((item) => item.id !== id);
    TinyStore.saveProducts([product, ...products]);
    productForm.reset();
    productForm.elements.active.checked = true;
    productForm.elements.featured.checked = false;
    productForm.elements.bestseller.checked = false;
    productForm.elements.madeToOrder.checked = false;
    productForm.elements.soldOut.checked = false;
    productForm.querySelector("[data-cancel-product]").hidden = true;
    setImagePreview("");
    setExtraImagePreview([]);
    setCloudStatus("Product opgeslagen. Online opslaan...");
    renderAll();
  } catch (error) {
    setCloudStatus(error.message || "Product opslaan is mislukt.", true);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = originalText;
  }
});

document.querySelector("[data-cancel-product]").addEventListener("click", () => {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.active.checked = true;
  productForm.elements.featured.checked = false;
  productForm.elements.bestseller.checked = false;
  productForm.elements.madeToOrder.checked = false;
  productForm.elements.soldOut.checked = false;
  setImagePreview("");
  setExtraImagePreview([]);
  document.querySelector("[data-cancel-product]").hidden = true;
});

productUpload.addEventListener("change", async () => {
  const file = productUpload.files[0];
  if (!file) {
    return;
  }

  try {
    uploadName.textContent = "Afbeelding verkleinen...";
    productUpload.disabled = true;
    const imageData = await resizeImageFile(file);
    productForm.elements.image.value = imageData;
    setImagePreview(imageData, `${file.name} toegevoegd`);
  } catch (error) {
    uploadName.textContent = error.message || "Afbeelding uploaden is mislukt.";
  } finally {
    productUpload.disabled = false;
    productUpload.value = "";
  }
});

extraImageUpload.addEventListener("change", async () => {
  const files = Array.from(extraImageUpload.files || []);
  if (!files.length) {
    return;
  }

  const currentImages = extraImageList();
  const roomLeft = Math.max(0, MAX_EXTRA_PRODUCT_IMAGES - currentImages.length);
  if (!roomLeft) {
    extraUploadName.textContent = `Maximaal ${MAX_EXTRA_PRODUCT_IMAGES} extra afbeeldingen per product.`;
    extraImageUpload.value = "";
    return;
  }

  const filesToUpload = files.slice(0, roomLeft);
  const uploadedImages = [];
  extraImageUpload.disabled = true;

  try {
    for (const [index, file] of filesToUpload.entries()) {
      extraUploadName.textContent = `${index + 1} van ${filesToUpload.length} afbeelding${filesToUpload.length === 1 ? "" : "en"} verkleinen...`;
      uploadedImages.push(await resizeImageFile(file));
    }

    const images = [...currentImages, ...uploadedImages];
    productForm.elements.extraImages.value = images.join("\n");
    const skipped = files.length > filesToUpload.length ? ` ${files.length - filesToUpload.length} bestand(en) overgeslagen.` : "";
    setExtraImagePreview(
      images,
      `${uploadedImages.length} extra afbeelding${uploadedImages.length === 1 ? "" : "en"} toegevoegd.${skipped}`,
    );
  } catch (error) {
    extraUploadName.textContent = error.message || "Extra afbeelding uploaden is mislukt. Probeer een kleinere foto.";
  } finally {
    extraImageUpload.disabled = false;
    extraImageUpload.value = "";
  }
});

productForm.elements.image.addEventListener("input", (event) => {
  setImagePreview(event.target.value.trim());
});

productForm.elements.extraImages.addEventListener("input", () => {
  setExtraImagePreview();
});

document.addEventListener("click", async (event) => {
  const editProduct = event.target.closest("[data-edit-product]");
  const deleteProduct = event.target.closest("[data-delete-product]");
  const deleteCategory = event.target.closest("[data-delete-category]");
  const toggleDiscount = event.target.closest("[data-toggle-discount]");
  const deleteDiscount = event.target.closest("[data-delete-discount]");
  const editGiftCard = event.target.closest("[data-edit-gift-card]");
  const toggleGiftCard = event.target.closest("[data-toggle-gift-card]");
  const deleteGiftCard = event.target.closest("[data-delete-gift-card]");
  const orderDetail = event.target.closest("[data-order-detail]");
  const deleteOrder = event.target.closest("[data-delete-order]");
  const editReview = event.target.closest("[data-edit-review]");
  const toggleReview = event.target.closest("[data-toggle-review]");
  const deleteReview = event.target.closest("[data-delete-review]");
  const editCustomer = event.target.closest("[data-edit-customer]");
  const deleteCustomer = event.target.closest("[data-delete-customer]");
  const cancelCustomer = event.target.closest("[data-cancel-customer]");
  const saveOrderAdmin = event.target.closest("[data-save-order-admin]");
  const sendPaymentInstructions = event.target.closest("[data-send-payment-instructions]");
  const markPaid = event.target.closest("[data-mark-paid]");
  const resendTrack = event.target.closest("[data-resend-track]");
  const markShipped = event.target.closest("[data-mark-shipped]");
  const sendStatusMail = event.target.closest("[data-send-status-mail]");
  const printOrderButton = event.target.closest("[data-print-order]");
  const printPackingSlipButton = event.target.closest("[data-print-packing-slip]");
  const exportButton = event.target.closest("[data-export-key]");
  const accountDetailButton = event.target.closest("[data-account-detail-id]");
  const sendAccountReset = event.target.closest("[data-send-account-reset]");
  const sendAccountInvite = event.target.closest("[data-send-account-invite]");
  const invalidateAccountReset = event.target.closest("[data-invalidate-account-reset]");
  const accountBlock = event.target.closest("[data-account-block]");
  const accountUnblock = event.target.closest("[data-account-unblock]");
  const accountAnonymize = event.target.closest("[data-account-anonymize]");
  const accountExport = event.target.closest("[data-account-export]");
  const linkOrder = event.target.closest("[data-link-order]");
  const linkAllSuggestions = event.target.closest("[data-link-all-suggestions]");
  const unlinkOrder = event.target.closest("[data-unlink-order]");
  const printAccount = event.target.closest("[data-print-account]");

  if (editProduct) {
    const product = adminState.products.find((item) => item.id === editProduct.dataset.editProduct);
    if (!product) {
      return;
    }
    productForm.elements.id.value = product.id;
    productForm.elements.name.value = product.name;
    productForm.elements.categoryId.value = product.categoryId;
    productForm.elements.price.value = product.price;
    productForm.elements.stockQuantity.value = stockQuantity(product);
    productForm.elements.stock.value = product.stock;
    productForm.elements.badge.value = product.badge;
    productForm.elements.image.value = product.image;
    productForm.elements.description.value = product.description;
    productForm.elements.longDescription.value = product.longDescription || "";
    productForm.elements.material.value = product.material || "";
    productForm.elements.size.value = product.size || "";
    productForm.elements.leadTime.value = product.leadTime || "";
    productForm.elements.washCare.value = product.washCare || "";
    productForm.elements.extraImages.value = Array.isArray(product.extraImages)
      ? product.extraImages.join("\n")
      : "";
    productForm.elements.featured.checked = Boolean(product.featured);
    productForm.elements.bestseller.checked = Boolean(product.bestseller);
    productForm.elements.madeToOrder.checked = Boolean(product.madeToOrder);
    productForm.elements.soldOut.checked = Boolean(product.soldOut);
    productForm.elements.active.checked = product.active;
    setImagePreview(product.image);
    setExtraImagePreview(Array.isArray(product.extraImages) ? product.extraImages : []);
    productForm.querySelector("[data-cancel-product]").hidden = false;
    setView("products");
  }

  if (deleteProduct) {
    if (!confirm("Weet je zeker dat je dit product wilt verwijderen?")) {
      return;
    }
    TinyStore.saveProducts(
      adminState.products.filter((product) => product.id !== deleteProduct.dataset.deleteProduct),
    );
    renderAll();
  }

  if (deleteCategory) {
    if (!confirm("Weet je zeker dat je deze categorie wilt verwijderen?")) {
      return;
    }
    TinyStore.saveCategories(
      adminState.categories.filter((category) => category.id !== deleteCategory.dataset.deleteCategory),
    );
    renderAll();
  }

  if (toggleDiscount) {
    const discounts = adminState.discounts.map((discount) =>
      discount.id === toggleDiscount.dataset.toggleDiscount
        ? { ...discount, active: !discount.active }
        : discount,
    );
    TinyStore.saveDiscounts(discounts);
    renderAll();
  }

  if (deleteDiscount) {
    if (!confirm("Weet je zeker dat je deze kortingscode wilt verwijderen?")) {
      return;
    }
    TinyStore.saveDiscounts(
      adminState.discounts.filter((discount) => discount.id !== deleteDiscount.dataset.deleteDiscount),
    );
    renderAll();
  }

  if (editGiftCard) {
    const giftCard = adminState.giftCards.find((item) => item.id === editGiftCard.dataset.editGiftCard);
    if (!giftCard) {
      return;
    }

    giftCardForm.elements.id.value = giftCard.id;
    giftCardForm.elements.code.value = giftCard.code;
    giftCardForm.elements.initialValue.value = giftCard.initialValue;
    giftCardForm.elements.balance.value = giftCard.balance;
    giftCardForm.elements.recipient.value = giftCard.recipient || "";
    giftCardForm.elements.email.value = giftCard.email || "";
    giftCardForm.elements.expiresAt.value = giftCard.expiresAt || "";
    giftCardForm.elements.paymentStatus.value = giftCard.paymentStatus || "Betaald";
    giftCardForm.elements.active.checked = giftCard.active;
    giftCardForm.elements.sendEmail.checked = false;
    document.querySelector("[data-gift-card-message]").textContent =
      "Bewerk je alleen gegevens? Laat het mail-vinkje uit. Zet het aan als je de cadeaubon opnieuw wilt mailen.";
    document.querySelector("[data-gift-card-form-title]").textContent = "Cadeaubon bewerken";
    giftCardForm.querySelector("[data-cancel-gift-card]").hidden = false;
    setView("giftcards");
  }

  if (toggleGiftCard) {
    const giftCards = adminState.giftCards.map((giftCard) =>
      giftCard.id === toggleGiftCard.dataset.toggleGiftCard
        ? { ...giftCard, active: !giftCard.active }
        : giftCard,
    );
    TinyStore.saveGiftCards(giftCards);
    renderAll();
  }

  if (deleteGiftCard) {
    if (!confirm("Weet je zeker dat je deze cadeaubon wilt verwijderen?")) {
      return;
    }
    TinyStore.saveGiftCards(
      adminState.giftCards.filter((giftCard) => giftCard.id !== deleteGiftCard.dataset.deleteGiftCard),
    );
    renderAll();
  }

  if (orderDetail) {
    renderOrderDetail(orderDetail.dataset.orderDetail);
  }

  if (deleteOrder) {
    const orderId = deleteOrder.dataset.deleteOrder;
    if (!confirm("Weet je zeker dat je deze bestelling wilt verwijderen?")) {
      return;
    }
    TinyStore.saveOrders(adminState.orders.filter((order) => order.id !== orderId));
    if (adminState.selectedOrderId === orderId) {
      adminState.selectedOrderId = "";
    }
    renderAll();
  }

  if (editCustomer) {
    renderCustomerDetail(editCustomer.dataset.editCustomer);
    setView("customers");
  }

  if (deleteCustomer) {
    if (!confirm("Weet je zeker dat je deze klant wilt verwijderen? Bestellingen blijven bestaan.")) {
      return;
    }
    TinyStore.saveCustomers(
      adminState.customers.filter((customer) => customer.id !== deleteCustomer.dataset.deleteCustomer),
    );
    adminState.editingCustomerId = "";
    renderAll();
  }

  if (cancelCustomer) {
    adminState.editingCustomerId = "";
    renderCustomerDetail("");
  }

  if (editReview) {
    const review = adminState.reviews.find((item) => item.id === editReview.dataset.editReview);
    if (!review) return;
    reviewForm.elements.id.value = review.id;
    reviewForm.elements.name.value = review.name;
    reviewForm.elements.text.value = review.text;
    reviewForm.elements.product.value = review.product || "";
    reviewForm.elements.rating.value = review.rating || 5;
    reviewForm.elements.visible.checked = Boolean(review.visible);
    document.querySelector("[data-review-form-title]").textContent = "Review bewerken";
    reviewForm.querySelector("[data-cancel-review]").hidden = false;
    setView("reviews");
  }

  if (toggleReview) {
    TinyStore.saveReviews(
      adminState.reviews.map((review) =>
        review.id === toggleReview.dataset.toggleReview
          ? { ...review, visible: !review.visible }
          : review,
      ),
    );
    renderAll();
  }

  if (deleteReview) {
    if (!confirm("Weet je zeker dat je deze review wilt verwijderen?")) {
      return;
    }
    TinyStore.saveReviews(adminState.reviews.filter((review) => review.id !== deleteReview.dataset.deleteReview));
    renderAll();
  }

  if (saveOrderAdmin) {
    const orderId = saveOrderAdmin.dataset.saveOrderAdmin;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    const previousTrack = order.trackTrace || "";
    const nextTrack = document.querySelector(`[data-order-track-trace="${orderId}"]`).value.trim();
    let updatedOrder = {
      ...order,
      shippingMethod: document.querySelector(`[data-order-shipping-method="${orderId}"]`).value.trim(),
      trackTrace: nextTrack,
      adminNotes: document.querySelector(`[data-order-admin-notes="${orderId}"]`).value.trim(),
    };
    if (nextTrack && nextTrack !== previousTrack) {
      updatedOrder = appendStatusHistory(updatedOrder, "track", previousTrack || "-", nextTrack);
      try {
        await sendTrackTraceMail(updatedOrder);
        const now = new Date().toISOString();
        updatedOrder = appendStatusHistory(
          {
            ...updatedOrder,
            status: "Verzonden",
            trackTraceMailSent: true,
            trackTraceMailSentAt: now,
            trackTraceLastSentCode: nextTrack,
          },
          "shipping",
          "Track & trace mail",
          `Verzonden naar ${updatedOrder.customer.email}`,
        );
        alert("Track & trace mail is verzonden naar de klant.");
      } catch (error) {
        alert(error.message);
      }
    }
    TinyStore.saveOrders(adminState.orders.map((item) => (item.id === orderId ? updatedOrder : item)));
    renderAll();
  }

  if (sendPaymentInstructions) {
    const orderId = sendPaymentInstructions.dataset.sendPaymentInstructions;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    if (order.paymentInstructionsSentAt && !confirm("Betaalinstructie is al eerder verstuurd. Wil je opnieuw versturen?")) {
      return;
    }

    sendPaymentInstructions.disabled = true;
    sendPaymentInstructions.textContent = "Versturen...";
    try {
      await sendOrderPaymentMail(order, "payment-instructions");
      const now = new Date().toISOString();
      TinyStore.saveOrders(
        adminState.orders.map((item) =>
          item.id === orderId
            ? appendStatusHistory(
                {
                  ...item,
                  paymentStatus: "Wacht op betaling",
                  paymentInstructionsSent: true,
                  paymentInstructionsSentAt: now,
                  status: item.status === "Nieuw" ? "In afwachting van betaling" : item.status,
                },
                "payment",
                item.paymentStatus || "Wacht op bevestiging",
                "Wacht op betaling",
              )
            : item,
        ),
      );
      renderAll();
    } catch (error) {
      sendPaymentInstructions.disabled = false;
      sendPaymentInstructions.textContent = "Betaalinstructie versturen";
      alert(error.message);
    }
  }

  if (markPaid) {
    const orderId = markPaid.dataset.markPaid;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }

    markPaid.disabled = true;
    markPaid.textContent = "Opslaan...";
    try {
      await sendOrderPaymentMail(order, "payment-received");
      const now = new Date().toISOString();
      TinyStore.saveOrders(
        adminState.orders.map((item) =>
          item.id === orderId
            ? appendStatusHistory(
                {
                  ...item,
                  paymentStatus: "Betaald",
                  paidAt: now,
                  status: item.status === "Nieuw" || item.status === "In afwachting van betaling" ? "Betaald" : item.status,
                },
                "payment",
                item.paymentStatus || "Wacht op bevestiging",
                "Betaald",
              )
            : item,
        ),
      );
      renderAll();
    } catch (error) {
      markPaid.disabled = false;
      markPaid.textContent = "Markeer als betaald";
      alert(error.message);
    }
  }

  if (resendTrack) {
    const orderId = resendTrack.dataset.resendTrack;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order?.trackTrace) {
      alert("Vul eerst een track & trace code in.");
      return;
    }
    if (!confirm("Weet je zeker dat je de track & trace mail opnieuw wilt versturen?")) {
      return;
    }
    resendTrack.disabled = true;
    resendTrack.textContent = "Versturen...";
    try {
      await sendTrackTraceMail(order);
      const now = new Date().toISOString();
      TinyStore.saveOrders(
        adminState.orders.map((item) =>
          item.id === orderId
            ? appendStatusHistory(
                {
                  ...item,
                  trackTraceMailSent: true,
                  trackTraceMailSentAt: now,
                  trackTraceLastSentCode: item.trackTrace,
                },
                "shipping",
                "Track & trace mail",
                `Opnieuw verzonden naar ${item.customer.email}`,
              )
            : item,
        ),
      );
      renderAll();
    } catch (error) {
      resendTrack.disabled = false;
      resendTrack.textContent = "Track & trace mail opnieuw versturen";
      alert(error.message);
    }
  }

  if (markShipped) {
    const orderId = markShipped.dataset.markShipped;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    TinyStore.saveOrders(
      adminState.orders.map((item) =>
        item.id === orderId
          ? appendStatusHistory({ ...item, status: "Verzonden" }, "status", item.status || "-", "Verzonden")
          : item,
      ),
    );
    renderAll();
  }

  if (sendStatusMail) {
    const orderId = sendStatusMail.dataset.sendStatusMail;
    const order = adminState.orders.find((item) => item.id === orderId);
    if (!order) {
      return;
    }
    sendStatusMail.disabled = true;
    sendStatusMail.textContent = "Versturen...";
    try {
      await sendOrderStatusMail(order);
      TinyStore.saveOrders(
        adminState.orders.map((item) =>
          item.id === orderId
            ? appendStatusHistory(item, "status", "Klantmail", `Verstuurd naar ${item.customer.email}`)
            : item,
        ),
      );
      renderAll();
    } catch (error) {
      sendStatusMail.disabled = false;
      sendStatusMail.textContent = "Klantmail sturen";
      alert(error.message);
    }
  }

  if (printOrderButton) {
    printOrder(printOrderButton.dataset.printOrder, "order");
  }

  if (printPackingSlipButton) {
    printOrder(printPackingSlipButton.dataset.printPackingSlip, "packing");
  }

  if (exportButton) {
    const backup = TinyStore.getBackupData();
    const key = exportButton.dataset.exportKey;
    if (key === "accountBackup") {
      downloadJson("tiny-doll-klantaccounts.json", await getAccountBackupData());
    } else {
      downloadJson(`tiny-doll-${key}.json`, backup[key]);
    }
  }

  if (accountDetailButton) {
    await loadAccountDetail(accountDetailButton.dataset.accountDetailId);
  }

  if (sendAccountReset || sendAccountInvite || invalidateAccountReset) {
    const id =
      sendAccountReset?.dataset.sendAccountReset ||
      sendAccountInvite?.dataset.sendAccountInvite ||
      invalidateAccountReset?.dataset.invalidateAccountReset;
    const action = sendAccountInvite ? "send-invite" : invalidateAccountReset ? "invalidate-reset" : "send-reset";
    try {
      await accountAdminRequest(action, { id });
      await refreshAccountAccounts({ detailId: id });
      alert(action === "invalidate-reset" ? "Resetlink is ongeldig gemaakt." : "Mail is verzonden.");
    } catch (error) {
      alert(error.message);
    }
  }

  if (accountBlock || accountUnblock) {
    const id = accountBlock?.dataset.accountBlock || accountUnblock?.dataset.accountUnblock;
    const account = adminState.accountAccounts.find((item) => item.id === id) || adminState.accountDetail?.account;
    const reason = accountBlock ? prompt("Waarom blokkeer je dit account?") || "Geblokkeerd door admin" : "";
    try {
      await accountAdminRequest("update", {
        ...(account || {}),
        id,
        status: accountBlock ? "Geblokkeerd" : "Actief",
        statusReason: reason,
      });
      await refreshAccountAccounts({ detailId: id });
    } catch (error) {
      alert(error.message);
    }
  }

  if (accountAnonymize) {
    const id = accountAnonymize.dataset.accountAnonymize;
    if (!confirm("Weet je zeker dat je dit account wilt anonimiseren? Persoonsgegevens worden vervangen, bestellingen blijven voor statistieken bestaan.")) {
      return;
    }
    try {
      await accountAdminRequest("anonymize", { id });
      await refreshAccountAccounts({ detailId: id });
    } catch (error) {
      alert(error.message);
    }
  }

  if (accountExport) {
    try {
      const data = await accountAdminRequest(`export&id=${encodeURIComponent(accountExport.dataset.accountExport)}`, null, "GET");
      downloadJson(`tiny-doll-account-${accountExport.dataset.accountExport}.json`, data.export);
    } catch (error) {
      alert(error.message);
    }
  }

  if (linkOrder || unlinkOrder) {
    const action = linkOrder ? "link-order" : "unlink-order";
    const button = linkOrder || unlinkOrder;
    try {
      await accountAdminRequest(action, {
        id: button.dataset.accountId,
        orderId: button.dataset.linkOrder || button.dataset.unlinkOrder,
      });
      await refreshAccountAccounts({ detailId: button.dataset.accountId });
    } catch (error) {
      alert(error.message);
    }
  }

  if (linkAllSuggestions) {
    const id = linkAllSuggestions.dataset.linkAllSuggestions;
    try {
      const data = await accountAdminRequest("link-suggestions", { id });
      await refreshAccountAccounts({ detailId: id });
      alert(`${data.linked || 0} bestelling(en) gekoppeld.`);
    } catch (error) {
      alert(error.message);
    }
  }

  if (printAccount) {
    window.print();
  }
});

document.addEventListener("submit", async (event) => {
  const accountEditForm = event.target.closest("[data-account-edit-form]");
  const accountNoteForm = event.target.closest("[data-account-note-form]");
  const accountMailForm = event.target.closest("[data-account-mail-form]");
  const manualLinkForm = event.target.closest("[data-manual-link-form]");

  if (accountEditForm) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(accountEditForm));
    try {
      await accountAdminRequest("update", payload);
      await refreshAccountAccounts({ detailId: payload.id });
      alert("Klantgegevens opgeslagen.");
    } catch (error) {
      alert(error.message);
    }
  }

  if (accountNoteForm) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(accountNoteForm));
    try {
      await accountAdminRequest("add-note", payload);
      await refreshAccountAccounts({ detailId: payload.id });
    } catch (error) {
      alert(error.message);
    }
  }

  if (accountMailForm) {
    event.preventDefault();
    const accountId = adminState.accountDetail?.account?.id;
    const payload = Object.fromEntries(new FormData(accountMailForm));
    try {
      await accountAdminRequest("send-mail", { id: accountId, ...payload });
      await refreshAccountAccounts({ detailId: accountId });
      alert("Klantmail is verzonden.");
    } catch (error) {
      alert(error.message);
    }
  }

  if (manualLinkForm) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(manualLinkForm));
    try {
      await accountAdminRequest("link-order", { id: payload.accountId, orderId: payload.orderId });
      await refreshAccountAccounts({ detailId: payload.accountId });
    } catch (error) {
      alert(error.message);
    }
  }
});

document.querySelector("[data-account-search]")?.addEventListener("input", (event) => {
  adminState.accountSearch = event.target.value;
  renderAccountManagement();
});

document.querySelector("[data-account-status-filter]")?.addEventListener("change", (event) => {
  adminState.accountStatusFilter = event.target.value;
  renderAccountManagement();
});

document.querySelector("[data-account-type-filter]")?.addEventListener("change", (event) => {
  adminState.accountTypeFilter = event.target.value;
  renderAccountManagement();
});

document.querySelector("[data-account-sort]")?.addEventListener("change", (event) => {
  adminState.accountSort = event.target.value;
  renderAccountManagement();
});

document.querySelector("[data-account-open-payment]")?.addEventListener("change", (event) => {
  adminState.accountOpenPaymentOnly = event.target.checked;
  renderAccountManagement();
});

document.querySelector("[data-account-active-this-month]")?.addEventListener("change", (event) => {
  adminState.accountCreatedThisMonthOnly = event.target.checked;
  renderAccountManagement();
});

accountCreateForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(accountCreateForm));
  data.sendInvite = accountCreateForm.elements.sendInvite.checked;
  try {
    await accountAdminRequest("create", data);
    accountCreateForm.reset();
    accountCreateForm.elements.sendInvite.checked = true;
    document.querySelector("[data-account-create-message]").textContent = "Account aangemaakt.";
    await refreshAccountAccounts();
  } catch (error) {
    document.querySelector("[data-account-create-message]").textContent = error.message;
  }
});

categoryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = new FormData(categoryForm).get("name").trim();
  TinyStore.saveCategories([...adminState.categories, { id: TinyStore.slugify(name), name }]);
  categoryForm.reset();
  renderAll();
});

discountForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(discountForm);
  const code = data.get("code").trim().toUpperCase();
  const discount = {
    id: TinyStore.slugify(code),
    code,
    type: data.get("type"),
    value: Number(data.get("value")),
    freeShipping: data.get("freeShipping") === "on",
    freeShippingFrom: Number(data.get("freeShippingFrom")) || 0,
    active: data.get("active") === "on",
    uses: 0,
  };
  TinyStore.saveDiscounts([
    discount,
    ...adminState.discounts.filter((item) => item.id !== discount.id),
  ]);
  discountForm.reset();
  discountForm.elements.active.checked = true;
  renderAll();
});

giftCardForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(giftCardForm);
  const existingId = data.get("id");
  const existingGiftCard = adminState.giftCards.find((item) => item.id === existingId);
  const code = data.get("code").trim().toUpperCase();
  const initialValue = Number(data.get("initialValue"));
  const balance = data.get("balance") === "" ? initialValue : Number(data.get("balance"));
  const sendGiftCardEmail = data.get("sendEmail") === "on";
  const giftCardMessage = document.querySelector("[data-gift-card-message]");
  const submitButton = giftCardForm.querySelector('button[type="submit"]');
  const giftCard = {
    id: existingId || TinyStore.slugify(code),
    code,
    initialValue,
    balance,
    recipient: data.get("recipient").trim(),
    email: data.get("email").trim(),
    expiresAt: data.get("expiresAt"),
    paymentStatus: data.get("paymentStatus") || "Aangevraagd",
    active: data.get("active") === "on",
    createdAt: existingGiftCard?.createdAt || new Date().toISOString(),
  };

  giftCardMessage.textContent = "Cadeaubon wordt opgeslagen...";
  submitButton.disabled = true;

  TinyStore.saveGiftCards([
    giftCard,
    ...adminState.giftCards.filter((item) => item.id !== giftCard.id && item.id !== existingId),
  ]);

  try {
    if (sendGiftCardEmail && giftCard.email) {
      giftCardMessage.textContent = "Cadeaubon opgeslagen. Mail wordt verzonden...";
      await sendEmail({
        type: "gift-card-issued",
        name: giftCard.recipient || giftCard.email,
        email: giftCard.email,
        giftCardCode: giftCard.code,
        amount: money(giftCard.initialValue),
        balance: money(giftCard.balance),
        expiresAt: giftCard.expiresAt || "Geen einddatum",
      });
      giftCard.paymentStatus = "Cadeaubon verstuurd";
      TinyStore.saveGiftCards([
        giftCard,
        ...adminState.giftCards.filter((item) => item.id !== giftCard.id && item.id !== existingId),
      ]);
      giftCardMessage.textContent = `Cadeaubon opgeslagen en gemaild naar ${giftCard.email}.`;
    } else if (sendGiftCardEmail && !giftCard.email) {
      giftCardMessage.textContent = "Cadeaubon opgeslagen. Er is geen mail verstuurd omdat het e-mailadres ontbreekt.";
    } else {
      giftCardMessage.textContent = "Cadeaubon opgeslagen. Er is geen mail verstuurd.";
    }
  } catch (error) {
    giftCardMessage.textContent = `Cadeaubon opgeslagen, maar de mail is niet verzonden: ${error.message}`;
  } finally {
    giftCardForm.reset();
    giftCardForm.elements.active.checked = true;
    giftCardForm.elements.paymentStatus.value = "Aangevraagd";
    giftCardForm.elements.sendEmail.checked = true;
    document.querySelector("[data-gift-card-form-title]").textContent = "Cadeaubon aanmaken";
    giftCardForm.querySelector("[data-cancel-gift-card]").hidden = true;
    submitButton.disabled = false;
    renderAll();
  }
});

giftCardForm.querySelector("[data-cancel-gift-card]").addEventListener("click", () => {
  giftCardForm.reset();
  giftCardForm.elements.id.value = "";
  giftCardForm.elements.active.checked = true;
  giftCardForm.elements.paymentStatus.value = "Aangevraagd";
  giftCardForm.elements.sendEmail.checked = true;
  document.querySelector("[data-gift-card-message]").textContent = "";
  document.querySelector("[data-gift-card-form-title]").textContent = "Cadeaubon aanmaken";
  giftCardForm.querySelector("[data-cancel-gift-card]").hidden = true;
});

reviewForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(reviewForm);
  const existingId = data.get("id");
  const review = {
    id: existingId || `review-${Date.now()}`,
    name: data.get("name").trim(),
    text: data.get("text").trim(),
    product: data.get("product").trim(),
    rating: Number(data.get("rating")) || 5,
    visible: data.get("visible") === "on",
    createdAt:
      adminState.reviews.find((item) => item.id === existingId)?.createdAt || new Date().toISOString(),
  };
  TinyStore.saveReviews([
    review,
    ...adminState.reviews.filter((item) => item.id !== review.id && item.id !== existingId),
  ]);
  reviewForm.reset();
  reviewForm.elements.visible.checked = true;
  reviewForm.elements.rating.value = 5;
  document.querySelector("[data-review-form-title]").textContent = "Review toevoegen";
  reviewForm.querySelector("[data-cancel-review]").hidden = true;
  renderAll();
});

reviewForm.querySelector("[data-cancel-review]").addEventListener("click", () => {
  reviewForm.reset();
  reviewForm.elements.id.value = "";
  reviewForm.elements.visible.checked = true;
  reviewForm.elements.rating.value = 5;
  document.querySelector("[data-review-form-title]").textContent = "Review toevoegen";
  reviewForm.querySelector("[data-cancel-review]").hidden = true;
});

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(settingsForm);
  TinyStore.saveSettings({
    ...Object.fromEntries(settingVisibilityKeys.map((key) => [key, data.get(key) === "on"])),
    shopName: data.get("shopName").trim(),
    email: data.get("email").trim(),
    phone: data.get("phone").trim(),
    instagramUrl: data.get("instagramUrl").trim(),
    shippingNl: Number(data.get("shippingNl")) || 0,
    shippingBe: Number(data.get("shippingBe")) || 0,
    freeShippingFrom: Number(data.get("freeShippingFrom")) || 0,
    giftWrapPrice: Number(data.get("giftWrapPrice")) || 0,
    stockLeadTime: data.get("stockLeadTime").trim(),
    customLeadTime: data.get("customLeadTime").trim(),
    heroLabel: data.get("heroLabel").trim(),
    heroTitle: data.get("heroTitle").trim(),
    heroText: data.get("heroText").trim(),
    heroPrimaryButton: data.get("heroPrimaryButton").trim(),
    heroSecondaryButton: data.get("heroSecondaryButton").trim(),
    aboutLabel: data.get("aboutLabel").trim(),
    aboutTitle: data.get("aboutTitle").trim(),
    aboutText1: data.get("aboutText1").trim(),
    aboutText2: data.get("aboutText2").trim(),
    customSectionLabel: data.get("customSectionLabel").trim(),
    customSectionTitle: data.get("customSectionTitle").trim(),
    customSectionText: data.get("customSectionText").trim(),
    customNote: data.get("customNote").trim(),
    customCard1Title: data.get("customCard1Title").trim(),
    customCard1Text: data.get("customCard1Text").trim(),
    customCard2Title: data.get("customCard2Title").trim(),
    customCard2Text: data.get("customCard2Text").trim(),
    customCard3Title: data.get("customCard3Title").trim(),
    customCard3Text: data.get("customCard3Text").trim(),
    customCard4Title: data.get("customCard4Title").trim(),
    customCard4Text: data.get("customCard4Text").trim(),
    customCard5Title: data.get("customCard5Title").trim(),
    customCard5Text: data.get("customCard5Text").trim(),
    customCard6Title: data.get("customCard6Title").trim(),
    customCard6Text: data.get("customCard6Text").trim(),
    shippingLabel: data.get("shippingLabel").trim(),
    shippingTitle: data.get("shippingTitle").trim(),
    shippingText: data.get("shippingText").trim(),
    shippingAfterText: data.get("shippingAfterText").trim(),
    returnLabel: data.get("returnLabel").trim(),
    returnTitle: data.get("returnTitle").trim(),
    returnLine1: data.get("returnLine1").trim(),
    returnLine2: data.get("returnLine2").trim(),
    returnLine3: data.get("returnLine3").trim(),
    returnLine4: data.get("returnLine4").trim(),
    returnButtonText: data.get("returnButtonText").trim(),
    faqLabel: data.get("faqLabel").trim(),
    faqTitle: data.get("faqTitle").trim(),
    faq1Question: data.get("faq1Question").trim(),
    faq1Answer: data.get("faq1Answer").trim(),
    faq2Question: data.get("faq2Question").trim(),
    faq2Answer: data.get("faq2Answer").trim(),
    faq3Question: data.get("faq3Question").trim(),
    faq3Answer: data.get("faq3Answer").trim(),
    faq4Question: data.get("faq4Question").trim(),
    faq4Answer: data.get("faq4Answer").trim(),
    faq5Question: data.get("faq5Question").trim(),
    faq5Answer: data.get("faq5Answer").trim(),
    faq6Question: data.get("faq6Question").trim(),
    faq6Answer: data.get("faq6Answer").trim(),
    faq7Question: data.get("faq7Question").trim(),
    faq7Answer: data.get("faq7Answer").trim(),
    orderRequestText: data.get("orderRequestText").trim(),
    orderSuccessText: data.get("orderSuccessText").trim(),
    contactText: data.get("contactText").trim(),
    paymentHolder: data.get("paymentHolder").trim(),
    paymentIban: data.get("paymentIban").trim(),
    paymentDescription: data.get("paymentDescription").trim(),
    paymentExtraText: data.get("paymentExtraText").trim(),
  });
  document.querySelector("[data-settings-message]").textContent = "Instellingen opgeslagen.";
  renderAll();
});

document.querySelector("[data-save-email-templates]").addEventListener("click", () => {
  const templates = [...document.querySelectorAll("[data-template-card]")].map((card) => ({
    id: card.dataset.templateCard,
    title: card.querySelector('[data-template-field="title"]').value.trim(),
    subject: card.querySelector('[data-template-field="subject"]').value.trim(),
    body: card.querySelector('[data-template-field="body"]').value.trim(),
  }));
  TinyStore.saveEmailTemplates(templates);
  document.querySelector("[data-email-template-message]").textContent = "Mailteksten opgeslagen.";
  renderAll();
});

document.querySelector("[data-download-backup]").addEventListener("click", async () => {
  const backup = TinyStore.getBackupData();
  backup.accountBackup = await getAccountBackupData();
  downloadJson(`tiny-doll-backup-${new Date().toISOString().slice(0, 10)}.json`, backup);
});

document.querySelector("[data-import-backup]").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  if (!confirm("Weet je zeker dat je deze back-up wilt importeren? Bestaande beheerdata wordt overschreven.")) {
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      TinyStore.importBackupData(JSON.parse(reader.result));
      document.querySelector("[data-backup-message]").textContent = "Back-up geimporteerd.";
      queueCloudSave("Back-up online opgeslagen.");
      renderAll();
    } catch (error) {
      document.querySelector("[data-backup-message]").textContent = error.message;
    }
    event.target.value = "";
  });
  reader.readAsText(file);
});

document.querySelector("[data-customer-search]").addEventListener("input", (event) => {
  adminState.customerSearch = event.target.value;
  renderCustomers();
});

document.querySelector("[data-customer-detail]").addEventListener("submit", (event) => {
  const form = event.target.closest("[data-customer-form]");
  if (!form) {
    return;
  }

  event.preventDefault();
  const data = new FormData(form);
  const id = data.get("id");
  TinyStore.saveCustomers(
    adminState.customers.map((customer) =>
      customer.id === id
        ? {
            ...customer,
            name: data.get("name").trim(),
            email: data.get("email").trim(),
            phone: data.get("phone").trim(),
            address: data.get("address").trim(),
            postalCode: data.get("postalCode").trim(),
            city: data.get("city").trim(),
            country: data.get("country").trim(),
            notes: data.get("notes").trim(),
          }
        : customer,
    ),
  );
  renderAll();
});

document.querySelector("[data-order-status-filter]").addEventListener("change", (event) => {
  adminState.orderFilter = event.target.value;
  renderOrders();
});

document.addEventListener("change", (event) => {
  const statusSelect = event.target.closest("[data-order-status]");
  const paymentSelect = event.target.closest("[data-payment-status]");
  if (!statusSelect && !paymentSelect) {
    return;
  }

  if (statusSelect) {
    TinyStore.saveOrders(
      adminState.orders.map((order) =>
        order.id === statusSelect.dataset.orderStatus
          ? appendStatusHistory({ ...order, status: statusSelect.value }, "order", order.status, statusSelect.value)
          : order,
      ),
    );
  }

  if (paymentSelect) {
    TinyStore.saveOrders(
      adminState.orders.map((order) =>
        order.id === paymentSelect.dataset.paymentStatus
          ? appendStatusHistory(
              { ...order, paymentStatus: paymentSelect.value },
              "payment",
              order.paymentStatus || "Wacht op bevestiging",
              paymentSelect.value,
            )
          : order,
      ),
    );
  }
  renderAll();
});

async function initializeAdmin() {
  hideCloudStatus();
  setOnlineEditingEnabled(false);
  cloudSyncing = true;
  let readyForOnlineEditing = false;
  let readyMessage = "";
  try {
    const status = await TinyStore.getCloudStatus();
    if (!status.blobsConfigured) {
      throw new Error(status.message || "Online opslag is nog niet gekoppeld.");
    }
    if (!status.writable) {
      throw new Error(
        status.message ||
          "Online opslag is ingesteld, maar schrijven naar Netlify Blobs lukt nog niet. Controleer tokenrechten.",
      );
    }

    const result = await TinyStore.loadCloudData({ admin: true });
    if (result.seeded) {
      readyMessage = "Online opslag is aangemaakt. Winkeldata wordt centraal opgeslagen.";
    } else if (result.merged) {
      readyMessage = "Online opslag is gekoppeld. Winkeldata wordt centraal opgeslagen.";
    } else {
      readyMessage = "Online opslag is gekoppeld. Winkeldata wordt centraal opgeslagen.";
    }
    readyForOnlineEditing = true;
  } catch (error) {
    readyMessage =
      error.message ||
      "Online opslag kon niet worden geladen. Beheer is alleen-lezen zodat niets lokaal blijft hangen.";
  } finally {
    cloudSyncing = false;
    cloudReady = readyForOnlineEditing;
    onlineEditingEnabled = readyForOnlineEditing;
    renderAll();
    setOnlineEditingEnabled(readyForOnlineEditing, readyMessage, { silent: readyForOnlineEditing });
  }
}

initializeAdmin();

window.setInterval(() => {
  if (activeViewName === "dashboard" || activeViewName === "orders") {
    refreshCloudDataQuietly();
  }
}, 60000);
