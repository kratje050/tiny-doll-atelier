const logoutButton = document.querySelector("[data-admin-logout]");

const adminState = {
  products: TinyStore.getProducts(),
  categories: TinyStore.getCategories(),
  discounts: TinyStore.getDiscounts(),
  giftCards: TinyStore.getGiftCards(),
  orders: TinyStore.getOrders(),
  customers: TinyStore.getCustomers(),
  editingProductId: "",
  orderFilter: "alles",
  customerSearch: "",
};

const money = TinyStore.formatMoney;
const views = document.querySelectorAll("[data-view]");
const navButtons = document.querySelectorAll("[data-view-button]");
const productForm = document.querySelector("[data-product-form]");
const categoryForm = document.querySelector("[data-category-form]");
const discountForm = document.querySelector("[data-discount-form]");
const giftCardForm = document.querySelector("[data-gift-card-form]");
const productUpload = document.querySelector("[data-product-upload]");
const uploadName = document.querySelector("[data-upload-name]");
const imagePreview = document.querySelector("[data-image-preview]");

logoutButton.addEventListener("click", () => {
  window.location.href = "/admin/logout";
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

function refreshData() {
  adminState.products = TinyStore.getProducts();
  adminState.categories = TinyStore.getCategories();
  adminState.discounts = TinyStore.getDiscounts();
  adminState.giftCards = TinyStore.getGiftCards();
  adminState.orders = TinyStore.getOrders();
  adminState.customers = TinyStore.getCustomers();
}

function setView(viewName) {
  views.forEach((view) => view.classList.toggle("is-active", view.dataset.view === viewName));
  navButtons.forEach((button) =>
    button.classList.toggle("is-active", button.dataset.viewButton === viewName),
  );
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

function renderProducts() {
  renderProductFormOptions();
  document.querySelector("[data-product-count]").textContent =
    `${adminState.products.length} producten`;
  document.querySelector("[data-product-table]").innerHTML = adminState.products
    .map(
      (product) => `
        <tr>
          <td>
            <strong>${product.name}</strong>
            <span class="muted">${product.stock}</span>
          </td>
          <td>${categoryName(product.categoryId)}</td>
          <td>${money(product.price)}</td>
          <td><strong>${stockQuantity(product)}</strong><span class="muted">op voorraad</span></td>
          <td><span class="status-pill">${product.active ? "Zichtbaar" : "Verborgen"}</span></td>
          <td>
            <div class="table-actions">
              <button class="row-button" type="button" data-edit-product="${product.id}">Bewerk</button>
              <button class="row-button" type="button" data-delete-product="${product.id}">Verwijder</button>
            </div>
          </td>
        </tr>
      `,
    )
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
      return `
        <tr>
          <td><strong>${discount.code}</strong></td>
          <td>${value}</td>
          <td>${discount.uses}</td>
          <td><span class="status-pill">${discount.active ? "Actief" : "Uit"}</span></td>
          <td>
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
      const status = !giftCard.active ? "Uit" : isExpired ? "Verlopen" : giftCard.balance <= 0 ? "Gebruikt" : "Actief";
      return `
        <tr>
          <td><strong>${giftCard.code}</strong></td>
          <td>
            <strong>${giftCard.recipient || "-"}</strong>
            <span class="muted">${giftCard.email || ""}</span>
          </td>
          <td>${money(giftCard.initialValue)}</td>
          <td>${money(giftCard.balance)}</td>
          <td>${giftCard.expiresAt || "-"}</td>
          <td><span class="status-pill">${status}</span></td>
          <td>
            <div class="table-actions">
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
    [customer.name, customer.email, customer.phone].some((value) =>
      String(value).toLowerCase().includes(query),
    ),
  );
  document.querySelector("[data-customer-table]").innerHTML = customers
    .map(
      (customer) => `
        <tr>
          <td><strong>${customer.name}</strong></td>
          <td>${customer.email}</td>
          <td>${customer.phone || "-"}</td>
          <td>${customer.orderCount}</td>
          <td>${money(customer.totalSpent)}</td>
          <td>${customer.lastOrderAt}</td>
        </tr>
      `,
    )
    .join("");
}

function renderOrders() {
  const orders =
    adminState.orderFilter === "alles"
      ? adminState.orders
      : adminState.orders.filter((order) => order.status === adminState.orderFilter);
  document.querySelector("[data-order-table]").innerHTML = orders
    .map(
      (order) => `
        <tr>
          <td>
            <strong>${order.id}</strong>
            <span class="muted">${new Date(order.createdAt).toLocaleDateString("nl-NL")}</span>
          </td>
          <td>
            <strong>${order.customer.name}</strong>
            <span class="muted">${order.customer.email}</span>
          </td>
          <td>${order.items.reduce((sum, item) => sum + item.quantity, 0)} items</td>
          <td>${money(order.total)}</td>
          <td>
            <select data-order-status="${order.id}">
              ${["Nieuw", "Betaald", "In productie", "Verzonden", "Afgerond"]
                .map(
                  (status) =>
                    `<option ${status === order.status ? "selected" : ""}>${status}</option>`,
                )
                .join("")}
            </select>
          </td>
          <td>
            <div class="table-actions">
              <button class="row-button" type="button" data-order-detail="${order.id}">Details</button>
            </div>
          </td>
        </tr>
      `,
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

  detail.classList.add("is-open");
  detail.innerHTML = `
    <h2>${order.id}</h2>
    <p class="muted">${order.customer.name} - ${order.customer.email} - ${order.customer.phone || "-"}</p>
    <div class="order-lines">
      ${order.items
        .map(
          (item) =>
            `<div>${item.quantity}x ${item.name} - ${money(item.price * item.quantity)}</div>`,
        )
        .join("")}
    </div>
    <p class="muted">Korting: ${order.discountCode || "-"} (${money(order.discountAmount)})</p>
    <p class="muted">Cadeaubon: ${order.giftCardCode || "-"} (${money(order.giftCardAmount)})</p>
    <strong>Totaal: ${money(order.total)}</strong>
    <p class="muted">Opmerking: ${order.notes || "-"}</p>
  `;
}

function renderAll() {
  refreshData();
  renderDashboard();
  renderProducts();
  renderCategories();
  renderDiscounts();
  renderGiftCards();
  renderCustomers();
  renderOrders();
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.viewButton));
});

productForm.addEventListener("submit", (event) => {
  event.preventDefault();
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
    active: data.get("active") === "on",
  };
  const products = adminState.products.filter((item) => item.id !== id);
  TinyStore.saveProducts([product, ...products]);
  productForm.reset();
  productForm.elements.active.checked = true;
  productForm.querySelector("[data-cancel-product]").hidden = true;
  setImagePreview("");
  renderAll();
});

document.querySelector("[data-cancel-product]").addEventListener("click", () => {
  productForm.reset();
  productForm.elements.id.value = "";
  productForm.elements.active.checked = true;
  setImagePreview("");
  document.querySelector("[data-cancel-product]").hidden = true;
});

productUpload.addEventListener("change", () => {
  const file = productUpload.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    productForm.elements.image.value = reader.result;
    setImagePreview(reader.result, file.name);
  });
  reader.readAsDataURL(file);
});

productForm.elements.image.addEventListener("input", (event) => {
  setImagePreview(event.target.value.trim());
});

document.addEventListener("click", (event) => {
  const editProduct = event.target.closest("[data-edit-product]");
  const deleteProduct = event.target.closest("[data-delete-product]");
  const deleteCategory = event.target.closest("[data-delete-category]");
  const toggleDiscount = event.target.closest("[data-toggle-discount]");
  const deleteDiscount = event.target.closest("[data-delete-discount]");
  const toggleGiftCard = event.target.closest("[data-toggle-gift-card]");
  const deleteGiftCard = event.target.closest("[data-delete-gift-card]");
  const orderDetail = event.target.closest("[data-order-detail]");

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
    productForm.elements.active.checked = product.active;
    setImagePreview(product.image);
    productForm.querySelector("[data-cancel-product]").hidden = false;
    setView("products");
  }

  if (deleteProduct) {
    TinyStore.saveProducts(
      adminState.products.filter((product) => product.id !== deleteProduct.dataset.deleteProduct),
    );
    renderAll();
  }

  if (deleteCategory) {
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
    TinyStore.saveDiscounts(
      adminState.discounts.filter((discount) => discount.id !== deleteDiscount.dataset.deleteDiscount),
    );
    renderAll();
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
    TinyStore.saveGiftCards(
      adminState.giftCards.filter((giftCard) => giftCard.id !== deleteGiftCard.dataset.deleteGiftCard),
    );
    renderAll();
  }

  if (orderDetail) {
    renderOrderDetail(orderDetail.dataset.orderDetail);
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

giftCardForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(giftCardForm);
  const code = data.get("code").trim().toUpperCase();
  const initialValue = Number(data.get("initialValue"));
  const balance = data.get("balance") === "" ? initialValue : Number(data.get("balance"));
  const giftCard = {
    id: TinyStore.slugify(code),
    code,
    initialValue,
    balance,
    recipient: data.get("recipient").trim(),
    email: data.get("email").trim(),
    expiresAt: data.get("expiresAt"),
    active: data.get("active") === "on",
    createdAt: new Date().toISOString(),
  };
  TinyStore.saveGiftCards([
    giftCard,
    ...adminState.giftCards.filter((item) => item.id !== giftCard.id),
  ]);
  giftCardForm.reset();
  giftCardForm.elements.active.checked = true;
  renderAll();
});

document.querySelector("[data-customer-search]").addEventListener("input", (event) => {
  adminState.customerSearch = event.target.value;
  renderCustomers();
});

document.querySelector("[data-order-status-filter]").addEventListener("change", (event) => {
  adminState.orderFilter = event.target.value;
  renderOrders();
});

document.addEventListener("change", (event) => {
  const statusSelect = event.target.closest("[data-order-status]");
  if (!statusSelect) {
    return;
  }

  TinyStore.saveOrders(
    adminState.orders.map((order) =>
      order.id === statusSelect.dataset.orderStatus
        ? { ...order, status: statusSelect.value }
        : order,
    ),
  );
  renderAll();
});

document.querySelector("[data-reset-demo]").addEventListener("click", () => {
  [
    "tiny-doll-products",
    "tiny-doll-categories",
    "tiny-doll-discounts",
    "tiny-doll-gift-cards",
    "tiny-doll-orders",
    "tiny-doll-customers",
    "tiny-doll-visits",
  ].forEach((key) => localStorage.removeItem(key));
  renderAll();
});

renderAll();
