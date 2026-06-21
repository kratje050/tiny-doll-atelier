const TinyStore = (() => {
  const keys = {
    products: "tiny-doll-products",
    categories: "tiny-doll-categories",
    discounts: "tiny-doll-discounts",
    giftCards: "tiny-doll-gift-cards",
    orders: "tiny-doll-orders",
    customers: "tiny-doll-customers",
    visits: "tiny-doll-visits",
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

  const defaultGiftCards = [
    {
      id: "cadeau25",
      code: "CADEAU25",
      initialValue: 25,
      balance: 25,
      recipient: "Voorbeeld klant",
      email: "cadeau@example.nl",
      expiresAt: "2027-06-20",
      active: true,
      createdAt: "2026-06-20T10:00:00",
    },
  ];

  const defaultCustomers = [
    {
      id: "klant-anne",
      name: "Anne de Vries",
      email: "anne@example.nl",
      phone: "06 12345678",
      orderCount: 2,
      totalSpent: 86,
      lastOrderAt: "2026-06-18",
    },
    {
      id: "klant-mila",
      name: "Mila Janssen",
      email: "mila@example.nl",
      phone: "06 87654321",
      orderCount: 1,
      totalSpent: 31,
      lastOrderAt: "2026-06-10",
    },
  ];

  const defaultOrders = [
    {
      id: "TD-20260618-142",
      createdAt: "2026-06-18T14:20:00",
      status: "Nieuw",
      customer: { name: "Anne de Vries", email: "anne@example.nl", phone: "06 12345678" },
      items: [
        { productId: "linnen-set", name: "Linnen broekset", price: 24.5, quantity: 2 },
        { productId: "strik-haarband", name: "Strik haarband", price: 8.5, quantity: 1 },
      ],
      discountCode: "ATELIER5",
      discountAmount: 5,
      giftCardCode: "",
      giftCardAmount: 0,
      total: 52.5,
      notes: "Graag passend voor pop van 36 cm.",
    },
    {
      id: "TD-20260610-084",
      createdAt: "2026-06-10T10:05:00",
      status: "Verzonden",
      customer: { name: "Mila Janssen", email: "mila@example.nl", phone: "06 87654321" },
      items: [
        { productId: "linnen-top-broek", name: "Top met broek", price: 22.5, quantity: 1 },
        { productId: "strik-haarband", name: "Strik haarband", price: 8.5, quantity: 1 },
      ],
      discountCode: "",
      discountAmount: 0,
      giftCardCode: "",
      giftCardAmount: 0,
      total: 31,
      notes: "",
    },
    {
      id: "TD-20260531-211",
      createdAt: "2026-05-31T16:45:00",
      status: "Betaald",
      customer: { name: "Anne de Vries", email: "anne@example.nl", phone: "06 12345678" },
      items: [{ productId: "romper-ruches", name: "Romper met ruches", price: 19.5, quantity: 2 }],
      discountCode: "",
      discountAmount: 0,
      giftCardCode: "",
      giftCardAmount: 0,
      total: 39,
      notes: "Naturel kleur graag.",
    },
  ];

  const defaultVisits = [
    { date: "2026-06-14", count: 12 },
    { date: "2026-06-15", count: 18 },
    { date: "2026-06-16", count: 21 },
    { date: "2026-06-17", count: 17 },
    { date: "2026-06-18", count: 27 },
    { date: "2026-06-19", count: 25 },
    { date: "2026-06-20", count: 32 },
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
    return read(keys.giftCards, defaultGiftCards);
  }

  function saveGiftCards(giftCards) {
    return write(keys.giftCards, giftCards);
  }

  function getOrders() {
    return read(keys.orders, defaultOrders);
  }

  function saveOrders(orders) {
    return write(keys.orders, orders);
  }

  function getCustomers() {
    return read(keys.customers, defaultCustomers);
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

  function recordVisit() {
    const today = new Date().toISOString().slice(0, 10);
    const sessionKey = `tiny-doll-visit-${today}`;
    if (sessionStorage.getItem(sessionKey)) {
      return;
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
  }

  function upsertCustomer(customer, total, date) {
    const customers = getCustomers();
    const normalizedEmail = customer.email.toLowerCase();
    const existing = customers.find((item) => item.email.toLowerCase() === normalizedEmail);

    if (existing) {
      existing.name = customer.name;
      existing.phone = customer.phone;
      existing.orderCount += 1;
      existing.totalSpent = Number((existing.totalSpent + total).toFixed(2));
      existing.lastOrderAt = date.slice(0, 10);
    } else {
      customers.unshift({
        id: `klant-${slugify(customer.name)}-${Date.now()}`,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
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
    const giftCardAmount = giftCard ? Math.min(afterDiscount, giftCard.balance) : 0;
    const order = {
      id: `TD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.floor(
        Math.random() * 900 + 100,
      )}`,
      createdAt: new Date().toISOString(),
      status: "Nieuw",
      customer,
      items,
      discountCode: discount ? discount.code : "",
      discountAmount: Number(safeDiscount.toFixed(2)),
      freeShipping: freeShippingByCode,
      freeShippingFrom: discount ? freeShippingFrom : 0,
      giftCardCode: giftCard ? giftCard.code : "",
      giftCardAmount: Number(giftCardAmount.toFixed(2)),
      total: Number((afterDiscount - giftCardAmount).toFixed(2)),
      notes,
    };

    saveOrders([order, ...getOrders()]);

    if (discount) {
      discount.uses += 1;
      saveDiscounts(discounts);
    }

    if (giftCard) {
      giftCard.balance = Number((giftCard.balance - giftCardAmount).toFixed(2));
      saveGiftCards(giftCards);
    }

    reduceStock(items);
    upsertCustomer(customer, order.total, order.createdAt);
    return order;
  }

  function createGiftCardOrder({ customer, amount, recipient = "", recipientEmail = "", message = "" }) {
    const code = generateGiftCardCode();
    const giftCard = {
      id: slugify(code),
      code,
      initialValue: Number(amount),
      balance: Number(amount),
      recipient,
      email: recipientEmail || customer.email,
      expiresAt: nextYearDate(),
      active: true,
      createdAt: new Date().toISOString(),
    };
    saveGiftCards([giftCard, ...getGiftCards()]);

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
        `Cadeauboncode: ${code}`,
        `Cadeaubon voor: ${recipient || "-"}`,
        `E-mail ontvanger: ${recipientEmail || customer.email}`,
        `Bericht: ${message || "-"}`,
      ].join("\n"),
    });
    return { order, giftCard };
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
    recordVisit,
    createOrder,
    createGiftCardOrder,
    getDashboard,
    slugify,
  };
})();
