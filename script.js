const formatMoney = TinyStore.formatMoney;

const state = {
  activeFilter: "alles",
  searchQuery: "",
  cart: JSON.parse(localStorage.getItem("poppenatelier-cart") || "{}"),
  products: TinyStore.getProducts().filter((product) => product.active),
  categories: TinyStore.getCategories(),
  settings: TinyStore.getSettings(),
  reviews: TinyStore.getReviews(),
  checkoutVisible: false,
  giftWrap: false,
  giftMessage: "",
  giftCardLookup: null,
  selectedProductId: "",
  account: null,
};

const GIFT_WRAP_PRICE = Number(state.settings.giftWrapPrice || 2.95);
const DEFAULT_WASH_CARE =
  "Was met de hand of op een fijnwasprogramma. Niet in de droger. Laat liggend drogen voor het mooiste resultaat.";
const PRODUCT_DETAILS = {
  "linnen-set": {
    size: "34 cm",
    contents: "Broekje en topje",
    material: "Katoen/mousseline",
    leadTime: "3 tot 7 werkdagen",
    stockStatus: "Op aanvraag beschikbaar",
    options: "Kleur en haarband in overleg",
  },
  "strik-haarband": {
    size: "32 tot 36 cm",
    contents: "Haarband met strik",
    material: "Linnenlook katoen",
    leadTime: "3 tot 7 werkdagen",
    stockStatus: "Op bestelling beschikbaar",
    options: "Strikmaat en kleur in overleg",
  },
  "linnen-top-broek": {
    size: "34 cm",
    contents: "Wijde broek, topje en haarband",
    material: "Katoen/mousseline",
    leadTime: "1 tot 3 werkdagen bij voorraad",
    stockStatus: "Beperkt op voorraad",
    options: "Bijpassende haarband mogelijk",
  },
  "romper-ruches": {
    size: "34 cm",
    contents: "Romper met ruches",
    material: "Zachte ribstof",
    leadTime: "3 tot 10 werkdagen",
    stockStatus: "Op aanvraag beschikbaar",
    options: "Kleur en afwerking in overleg",
  },
};

const grid = document.querySelector("[data-product-grid]");
const productTemplate = document.querySelector("#product-card-template");
const filterTabs = document.querySelector("[data-filter-tabs]");
const productSearch = document.querySelector("[data-product-search]");
const resultCount = document.querySelector("[data-result-count]");
const cartPanel = document.querySelector("[data-cart-panel]");
const menuOverlay = document.querySelector("[data-menu-overlay]");
const openMenuButton = document.querySelector("[data-open-menu]");
const cartItems = document.querySelector("[data-cart-items]");
const cartBreakdown = document.querySelector("[data-cart-breakdown]");
const cartTotal = document.querySelector("[data-cart-total]");
const cartCount = document.querySelector("[data-cart-count]");
const checkoutForm = document.querySelector("[data-checkout-form]");
const checkoutToggle = document.querySelector("[data-show-checkout]");
const giftWrapInput = document.querySelector("[data-gift-wrap]");
const giftMessageInput = document.querySelector("[data-gift-message]");
const orderMessage = document.querySelector("[data-order-message]");
const discountFeedback = document.querySelector("[data-discount-feedback]");
const giftCardFeedback = document.querySelector("[data-gift-card-feedback]");
const giftCardOrderForm = document.querySelector("[data-gift-card-order-form]");
const giftCardMessage = document.querySelector("[data-gift-card-message]");
const giftCardBalanceForm = document.querySelector("[data-gift-card-balance-form]");
const giftCardBalanceMessage = document.querySelector("[data-gift-card-balance-message]");
const productModal = document.querySelector("[data-product-modal]");
const modalAddButton = document.querySelector("[data-modal-add]");
const contactForm = document.querySelector("[data-contact-form]");
const returnForm = document.querySelector("[data-return-form]");
const accountButton = document.querySelector(".account-button");

const visitRecorded = TinyStore.recordVisit();
let giftCardLookupTimer = null;

function saveCart() {
  localStorage.setItem("poppenatelier-cart", JSON.stringify(state.cart));
}

function categoryName(categoryId) {
  return state.categories.find((category) => category.id === categoryId)?.name || categoryId;
}

function stockQuantity(product) {
  if (Number.isFinite(Number(product.stockQuantity))) {
    return Number(product.stockQuantity);
  }

  const stockMatch = String(product.stock || "").match(/\d+/);
  return stockMatch ? Number(stockMatch[0]) : 0;
}

function stockLabel(product) {
  const quantity = stockQuantity(product);
  const extra = product.stock && !String(product.stock).match(/^\d+\s+op voorraad$/i)
    ? ` - ${product.stock}`
    : "";
  return `Nog ${quantity} op voorraad${extra}`;
}

function dollNotice(product) {
  const text = [
    product.includesDoll,
    product.contents,
    product.description,
    product.longDescription,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /inclusief\s+pop|pop\s+inbegrepen/.test(text)
    ? "Inclusief pop"
    : "Pop niet inbegrepen, tenzij anders vermeld";
}

function getProductDetails(product) {
  return {
    size: product.size || PRODUCT_DETAILS[product.id]?.size || product.badge || "34 cm",
    contents: product.contents || PRODUCT_DETAILS[product.id]?.contents || "Handgemaakt kledingstuk",
    material: product.material || PRODUCT_DETAILS[product.id]?.material || "Katoen/mousseline",
    leadTime:
      product.leadTime ||
      PRODUCT_DETAILS[product.id]?.leadTime ||
      (product.madeToOrder ? state.settings.customLeadTime : state.settings.stockLeadTime),
    stockStatus: product.soldOut
      ? "Tijdelijk uitverkocht"
      : stockQuantity(product) <= 0 && product.madeToOrder
        ? "Op bestelling mogelijk"
        : product.stockStatus || PRODUCT_DETAILS[product.id]?.stockStatus || stockLabel(product),
    washCare: product.washCare || PRODUCT_DETAILS[product.id]?.washCare || DEFAULT_WASH_CARE,
    options: product.options || PRODUCT_DETAILS[product.id]?.options || "Maatwerk in overleg mogelijk",
  };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character],
  );
}

function renderFilters() {
  const filters = [{ id: "alles", name: "Alles" }, ...state.categories];
  filterTabs.innerHTML = filters
    .map(
      (filter) =>
        `<button class="${filter.id === state.activeFilter ? "is-active" : ""}" type="button" data-filter="${filter.id}">${filter.name}</button>`,
    )
    .join("");
}

function visibleProducts() {
  const query = state.searchQuery.trim().toLowerCase();
  const filteredProducts =
    state.activeFilter === "alles"
      ? state.products
      : state.products.filter((product) => product.categoryId === state.activeFilter);

  if (!query) {
    return filteredProducts;
  }

  return filteredProducts.filter((product) => {
    const searchableText = [
      product.name,
      categoryName(product.categoryId),
      product.description,
      product.badge,
      product.stock,
      stockLabel(product),
      getProductDetails(product).size,
      getProductDetails(product).contents,
      getProductDetails(product).material,
      getProductDetails(product).leadTime,
      formatMoney(product.price),
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(query);
  });
}

function renderProducts() {
  grid.innerHTML = "";
  const products = visibleProducts();

  resultCount.textContent = `${products.length} ${products.length === 1 ? "product" : "producten"} gevonden`;

  if (!products.length) {
    grid.innerHTML = '<p class="empty-results">Geen producten gevonden. Probeer een andere zoekterm of filter.</p>';
    return;
  }

  products.forEach((product) => {
    const card = productTemplate.content.firstElementChild.cloneNode(true);
    const details = getProductDetails(product);
    const image = card.querySelector("img");
    image.src = product.image;
    image.alt = product.name;
    image.addEventListener("error", () => {
      image.hidden = true;
      image.closest(".product-photo")?.classList.add("has-image-error");
    });
    card.querySelector(".product-badge").textContent = product.badge;
    card.querySelector(".product-category").textContent = categoryName(product.categoryId);
    card.querySelector("h3").textContent = product.name;
    card.querySelector(".product-description").textContent = product.description;
    card.querySelector(".product-size").textContent = details.size;
    card.querySelector(".product-contents").textContent = details.contents;
    card.querySelector(".product-material").textContent = details.material;
    card.querySelector(".product-leadtime").textContent = details.leadTime;
    card.querySelector(".product-doll-note").textContent = dollNotice(product);
    card.querySelector(".product-price").textContent = formatMoney(product.price);
    card.querySelector(".product-stock").textContent = details.stockStatus;
    card.querySelector(".view-button").addEventListener("click", () => openProductModal(product.id));
    const addButton = card.querySelector(".add-button");
    const canOrder = !product.soldOut && (stockQuantity(product) > 0 || product.madeToOrder);
    addButton.disabled = !canOrder;
    addButton.textContent = canOrder ? "Toevoegen aan aanvraag" : "Tijdelijk uitverkocht";
    addButton.addEventListener("click", () => addToCart(product.id));
    grid.append(card);
  });
}

function applySettings() {
  const setVisible = (selector, visible) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.hidden = !visible;
    });
  };
  const setParentVisible = (selector, visible) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.parentElement.hidden = !visible;
    });
  };

  document.querySelectorAll("[data-public-email]").forEach((element) => {
    element.textContent = state.settings.email;
  });

  document.querySelectorAll('a[href*="instagram.com"]').forEach((link) => {
    if (state.settings.instagramUrl) {
      link.href = state.settings.instagramUrl;
    }
  });

  document.querySelector("[data-stock-lead-time]")?.replaceChildren(
    document.createTextNode(`Product op voorraad: ${state.settings.stockLeadTime}`),
  );
  document.querySelector("[data-custom-lead-time]")?.replaceChildren(
    document.createTextNode(`Maatwerk of op aanvraag: ${state.settings.customLeadTime}`),
  );
  document.querySelector("[data-shipping-nl]")?.replaceChildren(
    document.createTextNode(`Nederland: ${formatMoney(state.settings.shippingNl)}`),
  );
  document.querySelector("[data-shipping-be]")?.replaceChildren(
    document.createTextNode("Belgie: in overleg"),
  );
  document.querySelector("[data-free-shipping]")?.replaceChildren(
    document.createTextNode(`Gratis verzending vanaf: ${formatMoney(state.settings.freeShippingFrom)}`),
  );
  document.querySelector("[data-order-request-text]")?.replaceChildren(
    document.createTextNode(state.settings.orderRequestText),
  );
  document.querySelector("[data-contact-text]")?.replaceChildren(
    document.createTextNode(state.settings.contactText),
  );
  setVisible("[data-stock-lead-time]", state.settings.showStockLeadTime);
  setVisible("[data-custom-lead-time]", state.settings.showCustomLeadTime);
  setVisible("[data-shipping-nl]", state.settings.showShippingNl);
  setVisible("[data-shipping-be]", state.settings.showShippingBe);
  setVisible("[data-free-shipping]", state.settings.showFreeShipping);
  setVisible("[data-order-request-text]", state.settings.showOrderRequestText);
  setVisible("[data-contact-text]", state.settings.showContactText);

  document.querySelector("[data-hero-label]")?.replaceChildren(document.createTextNode(state.settings.heroLabel));
  document.querySelector("[data-hero-title]")?.replaceChildren(document.createTextNode(state.settings.heroTitle));
  document.querySelector("[data-hero-text]")?.replaceChildren(document.createTextNode(state.settings.heroText));
  document.querySelector("[data-hero-primary-button]")?.replaceChildren(
    document.createTextNode(state.settings.heroPrimaryButton),
  );
  document.querySelector("[data-hero-secondary-button]")?.replaceChildren(
    document.createTextNode(state.settings.heroSecondaryButton),
  );
  setVisible("[data-hero-label]", state.settings.showHeroLabel);
  setVisible("[data-hero-title]", state.settings.showHeroTitle);
  setVisible("[data-hero-text]", state.settings.showHeroText);
  setVisible("[data-hero-primary-button]", state.settings.showHeroPrimaryButton);
  setVisible("[data-hero-secondary-button]", state.settings.showHeroSecondaryButton);
  document.querySelector("[data-about-label]")?.replaceChildren(document.createTextNode(state.settings.aboutLabel));
  document.querySelector("[data-about-title]")?.replaceChildren(document.createTextNode(state.settings.aboutTitle));
  document.querySelector("[data-about-text-1]")?.replaceChildren(document.createTextNode(state.settings.aboutText1));
  document.querySelector("[data-about-text-2]")?.replaceChildren(document.createTextNode(state.settings.aboutText2));
  setVisible("[data-about-label]", state.settings.showAboutLabel);
  setVisible("[data-about-title]", state.settings.showAboutTitle);
  setVisible("[data-about-text-1]", state.settings.showAboutText1);
  setVisible("[data-about-text-2]", state.settings.showAboutText2);

  document.querySelector("[data-custom-section-label]")?.replaceChildren(
    document.createTextNode(state.settings.customSectionLabel),
  );
  document.querySelector("[data-custom-section-title]")?.replaceChildren(
    document.createTextNode(state.settings.customSectionTitle),
  );
  document.querySelector("[data-custom-section-text]")?.replaceChildren(
    document.createTextNode(state.settings.customSectionText),
  );
  document.querySelector("[data-custom-note]")?.replaceChildren(
    document.createTextNode(state.settings.customNote),
  );

  for (let index = 1; index <= 6; index += 1) {
    document.querySelector(`[data-custom-card-title="${index}"]`)?.replaceChildren(
      document.createTextNode(state.settings[`customCard${index}Title`]),
    );
    document.querySelector(`[data-custom-card-text="${index}"]`)?.replaceChildren(
      document.createTextNode(state.settings[`customCard${index}Text`]),
    );
  }
  setVisible("[data-custom-section-label]", state.settings.showCustomSectionLabel);
  setVisible("[data-custom-section-title]", state.settings.showCustomSectionTitle);
  setVisible("[data-custom-section-text]", state.settings.showCustomSectionText);
  setVisible("[data-custom-note]", state.settings.showCustomNote);
  for (let index = 1; index <= 6; index += 1) {
    setParentVisible(`[data-custom-card-title="${index}"]`, state.settings[`showCustomCard${index}`]);
  }

  document.querySelector("[data-shipping-label]")?.replaceChildren(document.createTextNode(state.settings.shippingLabel));
  document.querySelector("[data-shipping-title]")?.replaceChildren(document.createTextNode(state.settings.shippingTitle));
  document.querySelector("[data-shipping-text]")?.replaceChildren(document.createTextNode(state.settings.shippingText));
  document.querySelector("[data-shipping-after-text]")?.replaceChildren(
    document.createTextNode(state.settings.shippingAfterText),
  );
  setVisible("[data-shipping-label]", state.settings.showShippingLabel);
  setVisible("[data-shipping-title]", state.settings.showShippingTitle);
  setVisible("[data-shipping-text]", state.settings.showShippingText);
  setVisible("[data-shipping-after-text]", state.settings.showShippingAfterText);
  document.querySelector("[data-return-label]")?.replaceChildren(document.createTextNode(state.settings.returnLabel));
  document.querySelector("[data-return-title]")?.replaceChildren(document.createTextNode(state.settings.returnTitle));
  document.querySelector("[data-return-button-text]")?.replaceChildren(
    document.createTextNode(state.settings.returnButtonText),
  );
  for (let index = 1; index <= 4; index += 1) {
    document.querySelector(`[data-return-line="${index}"]`)?.replaceChildren(
      document.createTextNode(state.settings[`returnLine${index}`]),
    );
    setVisible(`[data-return-line="${index}"]`, state.settings[`showReturnLine${index}`]);
  }
  setVisible("[data-return-label]", state.settings.showReturnLabel);
  setVisible("[data-return-title]", state.settings.showReturnTitle);
  setVisible("[data-return-button-text]", state.settings.showReturnButton);

  document.querySelector("[data-faq-label]")?.replaceChildren(document.createTextNode(state.settings.faqLabel));
  document.querySelector("[data-faq-title]")?.replaceChildren(document.createTextNode(state.settings.faqTitle));
  for (let index = 1; index <= 7; index += 1) {
    document.querySelector(`[data-faq-question="${index}"]`)?.replaceChildren(
      document.createTextNode(state.settings[`faq${index}Question`]),
    );
    document.querySelector(`[data-faq-answer="${index}"]`)?.replaceChildren(
      document.createTextNode(state.settings[`faq${index}Answer`]),
    );
    setParentVisible(`[data-faq-question="${index}"]`, state.settings[`showFaq${index}`]);
  }
  setVisible("[data-faq-label]", state.settings.showFaqLabel);
  setVisible("[data-faq-title]", state.settings.showFaqTitle);

  const giftWrapLabel = document.querySelector('[data-gift-wrap]')?.closest("label");
  if (giftWrapLabel) {
    giftWrapLabel.lastChild.textContent = ` Cadeauverpakking toevoegen voor ${formatMoney(GIFT_WRAP_PRICE)}`;
    giftWrapLabel.hidden = !state.settings.showGiftWrapOption;
  }
}

function renderReviews() {
  const reviewGrid = document.querySelector("[data-review-grid]");
  if (!reviewGrid) {
    return;
  }

  const visibleReviews = state.reviews.filter((review) => review.visible);
  reviewGrid.innerHTML =
    visibleReviews
      .map(
        (review) => `
          <article>
            "${escapeHtml(review.text)}"
            <span>${escapeHtml(review.name)}${review.product ? ` - ${escapeHtml(review.product)}` : ""}</span>
          </article>
        `,
      )
      .join("") || "<article>Binnenkort delen we hier lieve reacties van klanten.</article>";
}

function productImages(product) {
  return [
    product.image,
    ...(Array.isArray(product.extraImages) ? product.extraImages : []),
  ].filter(Boolean);
}

function renderProductGallery(product) {
  const gallery = productModal.querySelector("[data-modal-gallery]");
  const modalImage = productModal.querySelector("[data-modal-image]");
  const images = productImages(product);
  gallery.replaceChildren();
  gallery.hidden = images.length <= 1;

  images.forEach((src, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "is-active" : "";
    button.setAttribute("aria-label", `Bekijk productafbeelding ${index + 1}`);

    const image = document.createElement("img");
    image.src = src;
    image.alt = "";
    button.append(image);

    button.addEventListener("click", () => {
      modalImage.src = src;
      gallery.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
    });

    gallery.append(button);
  });
}

function openProductModal(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }

  const details = getProductDetails(product);
  state.selectedProductId = productId;
  productModal.querySelector("[data-modal-image]").src = product.image;
  productModal.querySelector("[data-modal-image]").alt = product.name;
  productModal.querySelector("[data-modal-category]").textContent = categoryName(product.categoryId);
  productModal.querySelector("[data-modal-title]").textContent = product.name;
  productModal.querySelector("[data-modal-price]").textContent = formatMoney(product.price);
  productModal.querySelector("[data-modal-description]").textContent = product.description;
  renderProductGallery(product);
  productModal.querySelector("[data-modal-details]").innerHTML = [
    product.longDescription ? ["Extra details", product.longDescription] : null,
    ["Geschikte popmaat", details.size],
    ["Wat zit erbij", details.contents],
    ["Materiaal", details.material],
    ["Levertijd", details.leadTime],
    ["Voorraadstatus", details.stockStatus],
    ["Pop", dollNotice(product)],
    ["Keuzeopties", details.options],
  ]
    .filter(Boolean)
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");
  productModal.classList.add("is-open");
  productModal.setAttribute("aria-hidden", "false");
  modalAddButton.disabled = Boolean(product.soldOut) || (stockQuantity(product) <= 0 && !product.madeToOrder);
  modalAddButton.textContent = modalAddButton.disabled ? "Tijdelijk uitverkocht" : "Toevoegen aan winkelmandje";
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  productModal.classList.remove("is-open");
  productModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function addToCart(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product || product.soldOut || (stockQuantity(product) <= 0 && !product.madeToOrder)) {
    return;
  }

  state.cart[productId] = (state.cart[productId] || 0) + 1;
  saveCart();
  renderCart();
  openCart();
}

function resetCheckoutExtras() {
  state.checkoutVisible = false;
  state.giftWrap = false;
  state.giftMessage = "";
  giftWrapInput.checked = false;
  giftMessageInput.value = "";
}

function resetCheckoutIfEmpty() {
  if (!Object.values(state.cart).some((quantity) => quantity > 0)) {
    resetCheckoutExtras();
  }
}

function setCartQuantity(productId, quantity) {
  if (quantity <= 0) {
    delete state.cart[productId];
  } else {
    state.cart[productId] = quantity;
  }

  resetCheckoutIfEmpty();
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete state.cart[productId];
  resetCheckoutIfEmpty();
  saveCart();
  renderCart();
}

function clearCart() {
  state.cart = {};
  resetCheckoutExtras();
  checkoutForm.reset();
  orderMessage.textContent = "";
  saveCart();
  renderCart();
}

function cartEntries() {
  return Object.entries(state.cart)
    .map(([id, quantity]) => ({
      product: state.products.find((item) => item.id === id),
      quantity,
    }))
    .filter((entry) => entry.product && entry.quantity > 0);
}

function checkoutCodeValue(name) {
  return checkoutForm.elements[name]?.value.trim() || "";
}

function codeMatches(savedCode, enteredCode) {
  return String(savedCode || "").toUpperCase() === String(enteredCode || "").toUpperCase();
}

function calculateCartPreview(entries, discountCode = "", giftCardCode = "") {
  const itemSubtotal = entries.reduce((sum, entry) => sum + entry.product.price * entry.quantity, 0);
  const giftWrapTotal = state.giftWrap && entries.length ? GIFT_WRAP_PRICE : 0;
  const subtotal = Number((itemSubtotal + giftWrapTotal).toFixed(2));
  const discounts = TinyStore.getDiscounts();
  const today = new Date().toISOString().slice(0, 10);
  const cleanDiscountCode = discountCode.trim();
  const cleanGiftCardCode = giftCardCode.trim();
  const discount = cleanDiscountCode
    ? discounts.find((item) => item.active && codeMatches(item.code, cleanDiscountCode))
    : null;
  const rawDiscountAmount = discount
    ? discount.type === "percent"
      ? subtotal * (Number(discount.value) / 100)
      : Number(discount.value)
    : 0;
  const discountAmount = Number(Math.min(subtotal, Math.max(0, rawDiscountAmount)).toFixed(2));
  const afterDiscount = Number((subtotal - discountAmount).toFixed(2));
  const lookupMatches = state.giftCardLookup && codeMatches(state.giftCardLookup.code, cleanGiftCardCode);
  const localGiftCard = cleanGiftCardCode && !lookupMatches
    ? TinyStore.getGiftCards().find((item) => item.active && codeMatches(item.code, cleanGiftCardCode))
    : null;
  const onlineGiftCard =
    state.giftCardLookup?.valid && lookupMatches
      ? {
          code: state.giftCardLookup.code,
          balance: Number(state.giftCardLookup.balance),
          expiresAt: state.giftCardLookup.expiresAt || "",
          active: true,
        }
      : null;
  const giftCard = onlineGiftCard || localGiftCard;
  const giftCardUsable = Boolean(
    giftCard && Number(giftCard.balance) > 0 && (!giftCard.expiresAt || giftCard.expiresAt >= today),
  );
  const giftCardAmount = giftCardUsable
    ? Number(Math.min(afterDiscount, Number(giftCard.balance)).toFixed(2))
    : 0;
  const freeShippingFrom = Number(discount?.freeShippingFrom || 0);
  const freeShipping = Boolean(
    discount && (discount.freeShipping || (freeShippingFrom > 0 && subtotal >= freeShippingFrom)),
  );

  return {
    subtotal,
    giftWrapTotal,
    discount,
    discountCode: discount?.code || cleanDiscountCode,
    discountAmount,
    discountStatus: !cleanDiscountCode ? "empty" : discount ? "valid" : "invalid",
    freeShipping,
    giftCard,
    giftCardCode: giftCard?.code || cleanGiftCardCode,
    giftCardAmount,
    giftCardStatus: !cleanGiftCardCode ? "empty" : giftCardUsable ? "valid" : "invalid",
    total: Number((afterDiscount - giftCardAmount).toFixed(2)),
  };
}

function setCodeFeedback(element, status, message) {
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.toggle("is-valid", status === "valid");
  element.classList.toggle("is-invalid", status === "invalid");
}

function renderCartBreakdown(preview, entries) {
  cartBreakdown.hidden = !entries.length;

  if (!entries.length) {
    cartBreakdown.innerHTML = "";
    setCodeFeedback(discountFeedback, "empty", "");
    setCodeFeedback(giftCardFeedback, "empty", "");
    return;
  }

  const rows = [`<div><span>Subtotaal</span><strong>${formatMoney(preview.subtotal)}</strong></div>`];

  if (preview.discountStatus === "valid" && preview.discountAmount > 0) {
    rows.push(
      `<div class="discount-row"><span>Korting ${escapeHtml(preview.discount.code)}</span><strong>-${formatMoney(
        preview.discountAmount,
      )}</strong></div>`,
    );
  }

  if (preview.giftCardStatus === "valid" && preview.giftCardAmount > 0) {
    rows.push(
      `<div class="discount-row"><span>Cadeaubon ${escapeHtml(preview.giftCard.code)}</span><strong>-${formatMoney(
        preview.giftCardAmount,
      )}</strong></div>`,
    );
  }

  cartBreakdown.innerHTML = rows.join("");

  if (preview.discountStatus === "valid") {
    const messages = [
      preview.discountAmount > 0
        ? `Kortingscode geldig: ${formatMoney(preview.discountAmount)} korting toegepast.`
        : "Kortingscode geldig.",
    ];
    if (preview.freeShipping) {
      messages.push("Gratis verzending geldt voor deze aanvraag.");
    }
    setCodeFeedback(discountFeedback, "valid", messages.join(" "));
  } else if (preview.discountStatus === "invalid") {
    setCodeFeedback(discountFeedback, "invalid", "Deze kortingscode is niet geldig of staat uit.");
  } else {
    setCodeFeedback(discountFeedback, "empty", "");
  }

  if (preview.giftCardStatus === "valid") {
    setCodeFeedback(
      giftCardFeedback,
      "valid",
      `Cadeaubon geldig: ${formatMoney(preview.giftCardAmount)} wordt verrekend.`,
    );
  } else if (preview.giftCardStatus === "invalid") {
    setCodeFeedback(giftCardFeedback, "invalid", "Deze cadeauboncode is niet geldig, verlopen of heeft geen saldo.");
  } else {
    setCodeFeedback(giftCardFeedback, "empty", "");
  }
}

function renderCart() {
  const entries = cartEntries();
  cartItems.innerHTML = "";

  if (!entries.length) {
    cartItems.innerHTML = '<p class="cart-empty">Je winkelmandje is nog leeg.</p>';
  }

  entries.forEach(({ product, quantity }) => {
    const line = document.createElement("article");
    const productName = escapeHtml(product.name);
    const productImage = escapeHtml(product.image);
    line.className = "cart-line";
    line.innerHTML = `
      <img src="${productImage}" alt="${productName}">
      <div>
        <strong>${productName}</strong>
        <span>${formatMoney(product.price)} per stuk</span>
      </div>
      <div class="quantity-controls" aria-label="Aantal voor ${productName}">
        <button type="button" data-cart-action="decrease" data-product-id="${product.id}" aria-label="Minder ${productName}">-</button>
        <span class="quantity">${quantity}x</span>
        <button type="button" data-cart-action="increase" data-product-id="${product.id}" aria-label="Meer ${productName}">+</button>
        <button class="remove-item" type="button" data-cart-action="remove" data-product-id="${product.id}">Verwijder</button>
      </div>
    `;
    cartItems.append(line);
  });

  if (state.giftWrap && entries.length) {
    const giftLine = document.createElement("article");
    giftLine.className = "cart-line gift-wrap-line";
    giftLine.innerHTML = `
      <div class="gift-icon" aria-hidden="true">G</div>
      <div>
        <strong>Cadeauverpakking</strong>
        <span>${formatMoney(GIFT_WRAP_PRICE)} inclusief persoonlijk kaartje</span>
      </div>
      <button class="remove-item single-remove" type="button" data-cart-action="remove-gift-wrap">Verwijder</button>
    `;
    cartItems.append(giftLine);
  }

  const preview = calculateCartPreview(
    entries,
    checkoutCodeValue("discountCode"),
    checkoutCodeValue("giftCardCode"),
  );
  const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  renderCartBreakdown(preview, entries);
  cartTotal.textContent = formatMoney(preview.total);
  cartCount.textContent = count;
  checkoutToggle.disabled = !count;
  checkoutToggle.hidden = state.checkoutVisible || !count;
  checkoutForm.hidden = !state.checkoutVisible || !count;
}

function showCheckout() {
  if (!cartEntries().length) {
    return;
  }

  state.checkoutVisible = true;
  renderCart();
  if (state.account) {
    ["name", "email", "phone", "address", "postalCode", "city", "country"].forEach((key) => {
      if (checkoutForm.elements[key] && !checkoutForm.elements[key].value) {
        checkoutForm.elements[key].value = state.account[key] || "";
      }
    });
  }
  checkoutForm.querySelector("input")?.focus();
}

function openCart() {
  cartPanel.classList.add("is-open");
  cartPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("cart-open");
}

function closeCart() {
  cartPanel.classList.remove("is-open");
  cartPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("cart-open");
}

function absoluteAssetUrl(path) {
  if (!path) {
    return "";
  }

  try {
    return new URL(path, window.location.origin).href;
  } catch {
    return path;
  }
}

function openMenu() {
  menuOverlay.classList.add("is-open");
  menuOverlay.setAttribute("aria-hidden", "false");
  openMenuButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("menu-open");
}

function closeMenu() {
  menuOverlay.classList.remove("is-open");
  menuOverlay.setAttribute("aria-hidden", "true");
  openMenuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("menu-open");
}

async function sendEmail(payload) {
  const response = await fetch("/.netlify/functions/send-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webshopNaam: state.settings.shopName,
      ...payload,
    }),
  });
  const data = await response.json().catch(() => ({ message: "Verzenden is mislukt." }));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Verzenden is mislukt.");
  }
  return data;
}

async function persistVisit() {
  if (!visitRecorded) {
    return;
  }

  try {
    await fetch("/.netlify/functions/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: new Date().toISOString().slice(0, 10) }),
    });
  } catch {
    // Lokale bezoekmeting blijft werken als online tellen tijdelijk niet lukt.
  }
}

async function persistOrder(order) {
  try {
    await fetch("/.netlify/functions/public-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    });
  } catch {
    // De e-mail blijft leidend; online dashboardopslag is een extra synchronisatie.
  }
}

async function loadAccountState() {
  try {
    const response = await fetch("/.netlify/functions/account?action=me", {
      credentials: "same-origin",
    });
    const data = await response.json();
    if (response.ok && data.ok) {
      state.account = data.account;
    }
  } catch {
    state.account = null;
  }
  if (accountButton) {
    accountButton.href = state.account ? "/account" : "/login";
  }
}

async function fetchGiftCardBalance(code) {
  const response = await fetch("/.netlify/functions/gift-card-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  const data = await response.json().catch(() => ({ ok: false, message: "Cadeaubon kon niet worden gecontroleerd." }));
  if (!response.ok || !data.ok) {
    throw new Error(data.message || "Cadeaubon kon niet worden gecontroleerd.");
  }
  return data;
}

function orderSummary(order) {
  const itemLines = order.items
    .map((item) => {
      const lines = [
        `${item.quantity}x ${item.name}`,
        `Prijs per stuk: ${formatMoney(item.price)}`,
        `Totaal bedrag: ${formatMoney(item.price * item.quantity)}`,
      ];
      if (item.image) {
        lines.push(`Afbeelding: ${absoluteAssetUrl(item.image)}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  const costLines = [
    "",
    "Overzicht",
    `Subtotaal: ${formatMoney(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0))}`,
    order.discountCode
      ? `Kortingscode ${order.discountCode}: -${formatMoney(order.discountAmount || 0)}`
      : "Kortingscode: -",
    order.giftCardCode
      ? `Cadeaubon ${order.giftCardCode}: -${formatMoney(order.giftCardAmount || 0)}`
      : "Cadeaubon: -",
    order.giftCardCode
      ? `Resterend cadeaubonsaldo na deze aanvraag: ${formatMoney(order.giftCardRemainingBalance || 0)}`
      : "",
    order.freeShipping ? "Verzending: gratis via kortingscode" : "Verzending: wordt afgestemd",
    `Totaal te bevestigen/betalen: ${formatMoney(order.total)}`,
  ].filter(Boolean);

  return [itemLines, costLines.join("\n")].filter(Boolean).join("\n\n");
}

function buildMailBody(order) {
  const productLines = order.items.flatMap((item, index) => {
    const itemTotal = item.price * item.quantity;
    const lines = [
      `${index + 1}. ${item.name}`,
      `   Aantal: ${item.quantity}`,
      `   Prijs per stuk: ${formatMoney(item.price)}`,
      `   Subtotaal: ${formatMoney(itemTotal)}`,
    ];

    if (item.image) {
      lines.push(`   Afbeelding: ${absoluteAssetUrl(item.image)}`);
    }

    return [...lines, ""];
  });

  return [
    "Hallo,",
    "",
    "Ik wil graag een bestelverzoek plaatsen via Tiny Doll Atelier.",
    "",
    "BESTELVERZOEK",
    `Nummer: ${order.id}`,
    "",
    "PRODUCTEN",
    ...productLines,
    "KOSTEN",
    order.discountCode ? `Kortingscode: ${order.discountCode}` : "Kortingscode: -",
    order.giftCardCode
      ? `Cadeaubon: ${order.giftCardCode} (-${formatMoney(order.giftCardAmount)})`
      : "Cadeaubon: -",
    order.freeShipping
      ? `Verzending: gratis via kortingscode ${order.discountCode || ""}`.trim()
      : "Verzending: wordt afgestemd in de bevestiging",
    `Totaal: ${formatMoney(order.total)}`,
    "",
    "KLANTGEGEVENS",
    `Naam: ${order.customer.name}`,
    `E-mail: ${order.customer.email}`,
    `Telefoon: ${order.customer.phone || "-"}`,
    "",
    "OPMERKING",
    `Opmerking: ${order.notes || "-"}`,
    "",
    "Let op: dit is een bestelverzoek. De bestelling is pas definitief nadat levertijd, eventuele keuzes en betaling zijn afgestemd.",
    "",
    "Groetjes,",
  ].join("\n");
}

filterTabs.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) {
    return;
  }

  state.activeFilter = button.dataset.filter;
  renderFilters();
  renderProducts();
});

productSearch.addEventListener("input", (event) => {
  state.searchQuery = event.target.value;
  renderProducts();
});

document.querySelectorAll("[data-open-cart]").forEach((button) => {
  button.addEventListener("click", () => {
    closeMenu();
    openCart();
  });
});

document.querySelectorAll("[data-close-cart]").forEach((button) => {
  button.addEventListener("click", closeCart);
});

openMenuButton.addEventListener("click", openMenu);
document.querySelectorAll("[data-close-menu], [data-menu-link]").forEach((element) => {
  element.addEventListener("click", closeMenu);
});

document.querySelector("[data-clear-cart]").addEventListener("click", clearCart);
checkoutToggle.addEventListener("click", showCheckout);
giftWrapInput.addEventListener("change", (event) => {
  state.giftWrap = event.target.checked;
  renderCart();
});
giftMessageInput.addEventListener("input", (event) => {
  state.giftMessage = event.target.value;
});
checkoutForm.elements.discountCode.addEventListener("input", renderCart);
checkoutForm.elements.giftCardCode.addEventListener("input", (event) => {
  const code = event.target.value.trim();
  clearTimeout(giftCardLookupTimer);
  state.giftCardLookup = null;

  if (!code) {
    renderCart();
    return;
  }

  if (code.length < 4) {
    setCodeFeedback(giftCardFeedback, "invalid", "Vul de volledige cadeauboncode in.");
    renderCart();
    return;
  }

  setCodeFeedback(giftCardFeedback, "empty", "Cadeaubon wordt gecontroleerd...");
  giftCardLookupTimer = setTimeout(async () => {
    try {
      const result = await fetchGiftCardBalance(code);
      state.giftCardLookup = result;
    } catch {
      state.giftCardLookup = { valid: false, code };
    }
    renderCart();
  }, 350);
});

cartItems.addEventListener("click", (event) => {
  const button = event.target.closest("[data-cart-action]");
  if (!button) {
    return;
  }

  const productId = button.dataset.productId;
  const currentQuantity = state.cart[productId] || 0;

  if (button.dataset.cartAction === "remove-gift-wrap") {
    state.giftWrap = false;
    giftWrapInput.checked = false;
    renderCart();
    return;
  }

  if (button.dataset.cartAction === "increase") {
    setCartQuantity(productId, currentQuantity + 1);
  }

  if (button.dataset.cartAction === "decrease") {
    setCartQuantity(productId, currentQuantity - 1);
  }

  if (button.dataset.cartAction === "remove") {
    removeFromCart(productId);
  }
});

document.querySelectorAll("[data-close-product]").forEach((button) => {
  button.addEventListener("click", closeProductModal);
});

modalAddButton.addEventListener("click", () => {
  if (state.selectedProductId) {
    addToCart(state.selectedProductId);
    closeProductModal();
  }
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const entries = cartEntries();
  if (!entries.length) {
    orderMessage.textContent = "Je winkelmandje is nog leeg.";
    return;
  }

  const formData = new FormData(checkoutForm);
  if (formData.get("website")) {
    return;
  }
  if (formData.get("termsAccepted") !== "on") {
    orderMessage.textContent = "Vink eerst aan dat je akkoord gaat met de algemene voorwaarden.";
    return;
  }
  state.giftWrap = formData.get("giftWrap") === "on";
  state.giftMessage = formData.get("giftMessage").trim();
  const preview = calculateCartPreview(
    entries,
    formData.get("discountCode").trim(),
    formData.get("giftCardCode").trim(),
  );
  renderCartBreakdown(preview, entries);

  if (preview.discountStatus === "invalid" || preview.giftCardStatus === "invalid") {
    orderMessage.textContent = "Controleer de kortingscode of cadeauboncode voordat je de aanvraag verstuurt.";
    return;
  }

  const orderItems = entries.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity,
    image: product.image,
  }));

  if (state.giftWrap) {
    orderItems.push({
      productId: "cadeauverpakking",
      name: "Cadeauverpakking",
      price: GIFT_WRAP_PRICE,
      quantity: 1,
    });
  }

  const order = TinyStore.createOrder({
    customer: {
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      phone: formData.get("phone").trim(),
      address: formData.get("address").trim(),
      postalCode: formData.get("postalCode").trim(),
      city: formData.get("city").trim(),
      country: formData.get("country").trim(),
    },
    discountCode: formData.get("discountCode").trim(),
    giftCardCode: formData.get("giftCardCode").trim(),
    notes: [formData.get("notes").trim(), state.giftWrap ? `Persoonlijk kaartje: ${state.giftMessage || "-"}` : ""]
      .filter(Boolean)
      .join("\n"),
    items: orderItems,
  });

  try {
    orderMessage.textContent = "Je aanvraag wordt verzonden...";
    await sendEmail({
      type: "order",
      website: formData.get("website"),
      orderId: order.id,
      name: order.customer.name,
      email: order.customer.email,
      phone: order.customer.phone,
      address: order.customer.address,
      postalCode: order.customer.postalCode,
      city: order.customer.city,
      country: order.customer.country,
      total: formatMoney(order.total),
      orderSummary: orderSummary(order),
      orderItems: order.items,
      subtotal: formatMoney(order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)),
      discountCode: order.discountCode,
      discountAmount: formatMoney(order.discountAmount || 0),
      giftCardCode: order.giftCardCode,
      giftCardAmount: formatMoney(order.giftCardAmount || 0),
      giftCardRemainingBalance: order.giftCardCode
        ? formatMoney(order.giftCardRemainingBalance || 0)
        : "",
      freeShipping: order.freeShipping ? "Ja" : "Nee",
      notes: order.notes,
    });
    await persistOrder(order);
    orderMessage.innerHTML = state.account
      ? "Bedankt, je aanvraag is verzonden en gekoppeld aan je account."
      : 'Bedankt, je aanvraag is verzonden. Wil je je aanvraag later makkelijk terugvinden? <a href="/register">Account aanmaken</a>';
    state.cart = {};
    state.checkoutVisible = false;
    state.giftWrap = false;
    state.giftMessage = "";
    checkoutForm.reset();
    saveCart();
    renderCart();
  } catch (error) {
    orderMessage.textContent = error.message;
  }
});

giftCardOrderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(giftCardOrderForm);
  if (formData.get("website")) {
    return;
  }

  try {
    const result = TinyStore.createGiftCardOrder({
      amount: Number(formData.get("amount")),
      recipient: formData.get("recipient").trim(),
      recipientEmail: formData.get("recipientEmail").trim(),
      message: formData.get("message").trim(),
      customer: {
        name: formData.get("name").trim(),
        email: formData.get("email").trim(),
        phone: "",
      },
    });
    const { order } = result;
    const amount = Number(formData.get("amount"));
    const recipient = formData.get("recipient").trim();
    const recipientEmail = formData.get("recipientEmail").trim();
    const message = formData.get("message").trim();

    giftCardMessage.textContent = "Je cadeaubonaanvraag wordt verzonden...";
    await sendEmail({
      type: "gift-card",
      website: formData.get("website"),
      orderId: order.id,
      name: order.customer.name,
      email: order.customer.email,
      amount: formatMoney(amount),
      recipient,
      recipientEmail: recipientEmail || order.customer.email,
      message,
    });
    await persistOrder(order);
    giftCardMessage.textContent =
      "Bedankt, je cadeaubonaanvraag is verzonden. Na bevestiging ontvang je de betaalinformatie.";
    giftCardOrderForm.reset();
  } catch (error) {
    giftCardMessage.textContent = error.message;
  }
});

giftCardBalanceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const code = new FormData(giftCardBalanceForm).get("code").trim();
  if (!code) {
    giftCardBalanceMessage.textContent = "Vul eerst je cadeauboncode in.";
    return;
  }

  giftCardBalanceMessage.textContent = "Saldo wordt gecontroleerd...";
  try {
    const result = await fetchGiftCardBalance(code);
    if (!result.valid) {
      giftCardBalanceMessage.textContent = result.message || "Deze cadeaubon is niet geldig.";
      return;
    }

    giftCardBalanceMessage.textContent = `Deze cadeaubon is geldig. Resterend saldo: ${formatMoney(
      result.balance,
    )}. Geldig tot: ${result.expiresAt || "geen einddatum"}.`;
  } catch (error) {
    giftCardBalanceMessage.textContent = error.message;
  }
});

returnForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(returnForm);
  if (formData.get("website")) {
    return;
  }
  const messageElement = document.querySelector("[data-return-message]");
  try {
    messageElement.textContent = "Je retourmelding wordt verzonden...";
    await sendEmail({
      type: "return",
      website: formData.get("website"),
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      orderNumber: formData.get("orderNumber").trim(),
      product: formData.get("product").trim(),
      reason: formData.get("reason").trim(),
      message: formData.get("message").trim(),
    });
    returnForm.reset();
    messageElement.textContent =
      "Bedankt, je retour of annulering is aangemeld. We nemen zo snel mogelijk contact met je op.";
  } catch (error) {
    messageElement.textContent = error.message;
  }
});

contactForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(contactForm);
  if (formData.get("website")) {
    return;
  }
  const messageElement = document.querySelector("[data-contact-message]");
  try {
    messageElement.textContent = "Je bericht wordt verzonden...";
    await sendEmail({
      type: "contact",
      website: formData.get("website"),
      name: formData.get("name").trim(),
      email: formData.get("email").trim(),
      subject: formData.get("subject").trim(),
      message: formData.get("message").trim(),
    });
    contactForm.reset();
    messageElement.textContent = "Bedankt, je bericht is verzonden. We reageren zo snel mogelijk.";
  } catch (error) {
    messageElement.textContent = error.message;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCart();
    closeProductModal();
    closeMenu();
  }
});

function refreshPublicState() {
  state.products = TinyStore.getProducts().filter((product) => product.active);
  state.categories = TinyStore.getCategories();
  state.settings = TinyStore.getSettings();
  state.reviews = TinyStore.getReviews();
}

function renderShop() {
  renderFilters();
  applySettings();
  renderReviews();
  renderProducts();
  renderCart();
}

renderShop();
loadAccountState();

TinyStore.loadCloudData()
  .then((result) => {
    if (!result.changed) {
      persistVisit();
      return;
    }

    refreshPublicState();
    renderShop();
    persistVisit();
  })
  .catch(() => {
    persistVisit();
  });

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
