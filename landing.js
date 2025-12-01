/*
  Send Me — client-side enhancement
  - Persists cart to localStorage under key: sendme_cart_v1
  - Hooks into your existing page's rows (has .item, .add, .increase, .decrease, #summary, #checkoutBtn)
  - Builds a cart drawer (DOM injected) and offers:
      • Remove item
      • Totals + taxes (simple example)
      • Generate PDF invoice (uses jsPDF)
      • Print-friendly view
      • Send by email via EmailJS (optional — configure below)
  - NOTE: This script does NOT modify your markup; it listens and injects UI only.
*/

(function () {
  // ----- CONFIG -----
  const STORAGE_KEY = 'sendme_cart_v1';
  const TAX_RATE = 0.075; // 7.5% example tax
  // Price + image map (edit these values to your real product data)
  const ITEM_DATA = {
    "1": { title: "Rice", price: 1500, img: "https://picsum.photos/seed/chicken/200/200" },
    "2": { title: "Drink", price: 700, img: "https://picsum.photos/seed/veggie/200/200" },
    "3": { title: "Grocery Bag — Essentials", price: 5000, img: "https://picsum.photos/seed/groceries/200/200" }
  };

  // EmailJS config placeholders - replace to enable client-side email send
  const EMAILJS_ENABLED = true;  // set true once you fill the IDs below
  const EMAILJS_USER_ID = 'VH5jDJ1Cl4hytzQmx';
  const EMAILJS_SERVICE_ID = 'service_hcvwzy8';
  const EMAILJS_TEMPLATE_ID = 'template_jhpm8kj';
  // Template should accept an `invoice_html` or `message` param depending on your EmailJS template.

  // ----- UTILS -----
  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error('Failed to read cart', e);
      return {};
    }
  }
  function saveCart(cart) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  }
  function formatCurrency(n) {
    return '₦' + (n.toFixed(2)); // currency symbol — replace as needed
  }
  function calcTotals(cart) {
    let subtotal = 0;
    for (const id in cart) {
      const price = (ITEM_DATA[id]?.price) || 0;
      subtotal += price * cart[id].qty;
    }
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  // ----- UI: create drawer & floating button -----
  const backdrop = document.createElement('div');
  backdrop.className = 'sendme-drawer-backdrop';
  document.body.appendChild(backdrop);

  const drawer = document.createElement('section');
  drawer.className = 'sendme-drawer';
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="drawer-header">
      <div class="drawer-title">Your Cart</div>
      <div>
        <button class="btn-ghost drawer-clear">Clear</button>
        <button class="drawer-close" aria-label="Close">✕</button>
      </div>
    </div>
    <div class="cart-items" id="sendme-cart-items"></div>
    <div class="drawer-summary">
      <div>
        <div style="font-size:13px;color:#555">Subtotal</div>
        <div style="font-size:15px" id="sendme-subtotal">₦0.00</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;color:#555">Total</div>
        <div style="font-size:18px;font-weight:800" id="sendme-total">₦0.00</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
      <input id="sendme-email" placeholder="Email for invoice (optional)" style="flex:1;padding:8px;border-radius:8px;border:1px solid #ddd" />
      <div class="drawer-actions">
        <button class="btn-ghost" id="sendme-print">Print</button>
        <button class="btn-primary" id="sendme-download">Download PDF</button>
        <button class="btn-primary" id="sendme-send-email">Send Email</button>
      </div>
    </div>
  `;
  document.body.appendChild(drawer);

  const cartButton = document.createElement('button');
  cartButton.id = 'sendme-cart-button';
  cartButton.title = 'Open cart';
  cartButton.textContent = 'Cart (0)';
  document.body.appendChild(cartButton);

  // ----- state -----
  let cart = loadCart(); // shape: { id: { qty: number, special: string } }

  // sync UI summary element if it exists in the page (#summary)
  function updatePageSummary() {
    const total = Object.values(cart).reduce((s, i) => s + (i.qty || 0), 0);
    const summaryEl = document.getElementById('summary');
    if (summaryEl) summaryEl.textContent = total + (total === 1 ? ' item in cart' : ' items in cart');
    cartButton.textContent = 'Cart (' + total + ')';
  }

  // render the drawer items
  function renderDrawer() {
    const list = document.getElementById('sendme-cart-items');
    list.innerHTML = '';
    const ids = Object.keys(cart);
    if (!ids.length) {
      list.innerHTML = '<div class="cart-empty">Your cart is empty — add some items.</div>';
      document.getElementById('sendme-subtotal').textContent = formatCurrency(0);
      document.getElementById('sendme-total').textContent = formatCurrency(0);
      return;
    }
    ids.forEach(id => {
      const entry = cart[id];
      const meta = ITEM_DATA[id] || { title: 'Item ' + id, price: 0, img: '' };
      const itemEl = document.createElement('div');
      itemEl.className = 'drawer-item';
      itemEl.dataset.id = id;
      itemEl.innerHTML = `
        <img src="${meta.img}" alt="${meta.title}" loading="lazy" />
        <div class="meta">
          <p class="title">${meta.title} <small style="color:#666;font-weight:500">× ${entry.qty}</small></p>
          <p class="note">${entry.special ? entry.special : ''}</p>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px;">
          <div class="price">${formatCurrency(meta.price * entry.qty)}</div>
          <div>
            <button class="btn-ghost remove-pill" data-action="remove">Remove</button>
          </div>
        </div>
      `;
      list.appendChild(itemEl);
    });

    const totals = calcTotals(cart);
    document.getElementById('sendme-subtotal').textContent = formatCurrency(totals.subtotal);
    document.getElementById('sendme-total').textContent = formatCurrency(totals.total);
  }

  // open/close drawer
  function openDrawer() {
    drawer.classList.add('open');
    backdrop.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    renderDrawer();
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  backdrop.addEventListener('click', closeDrawer);
  cartButton.addEventListener('click', openDrawer);
  drawer.querySelector('.drawer-close').addEventListener('click', closeDrawer);

  // clear cart
  // Robust clear handler (delegated, prevents form submit & propagation)
drawer.addEventListener('click', function (e) {
  const btn = e.target.closest('.drawer-clear');
  if (!btn) return;

  // If button is inside a <form>, prevent it from submitting
  if (e.target && e.target.tagName === 'BUTTON') {
    e.preventDefault();
  }

  // stop other handlers from reacting
  e.stopPropagation();

  // confirm and clear cart
  if (!confirm('Clear all items from cart?')) return;
  cart = {};
  saveCart(cart);
  updatePageSummary();
  renderDrawer();

  // optional: close drawer after clearing
  // closeDrawer();
});


  // handle remove item from drawer (event delegation)
  document.getElementById('sendme-cart-items').addEventListener('click', function(e){
    const rm = e.target.closest('[data-action="remove"]');
    if (!rm) return;
    const id = rm.closest('.drawer-item').dataset.id;
    delete cart[id];
    saveCart(cart);
    updatePageSummary();
    renderDrawer();
  });

  // ----- Hook into your existing controls (they exist in your markup) -----
  // The page already has ".items" container and the .add/.increase/.decrease buttons.
  // We'll listen for clicks and update our persistent cart accordingly.
 const pageItems = document.getElementById('itemsList');
if (pageItems) {
  pageItems.addEventListener('click', function(e){
    const t = e.target;
    const itemEl = t.closest('.item');
    if (!itemEl) return;
    const id = itemEl.dataset.id;
    const valueEl = itemEl.querySelector('.value');
    const specialEl = itemEl.querySelector('.special');

    // Ensure valueEl exists and parse current qty
    let qty = parseInt(valueEl?.textContent || '0', 10);

    // INCREASE
    if (t.classList.contains('increase')) {
      qty = Math.min(99, qty + 1);
      if (valueEl) valueEl.textContent = qty;
      // keep cart in sync if item already in cart
      if (cart[id]) {
        cart[id].qty = qty;
        saveCart(cart);
        updatePageSummary();
      }
      return;
    }

    // DECREASE
    if (t.classList.contains('decrease')) {
      qty = Math.max(0, qty - 1);
      if (valueEl) valueEl.textContent = qty;
      if (cart[id]) {
        cart[id].qty = qty;
        saveCart(cart);
        updatePageSummary();
      }
      return;
    }

    // ADD button
    if (t.classList.contains('add')) {
      if (!qty || qty <= 0) { alert('Choose at least 1 before adding.'); return; }
      cart[id] = { qty: qty, special: specialEl?.value?.trim() || '' };
      saveCart(cart);
      updatePageSummary();
      // small feedback
      t.textContent = 'Added ✓';
      setTimeout(()=> t.textContent = 'Add', 900);
      return;
    }
  });
}


  // also hook the Checkout button on the page if present to open the drawer
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', function () {
      openDrawer();
    });
  }

  // ----- PDF / Print / Email functions -----
  // Load jsPDF library dynamically when user requests download/print to keep initial payload small.
  function getInvoiceHtml(cartObj) {
    const lines = [];
    for (const id in cartObj) {
      const entry = cartObj[id];
      const meta = ITEM_DATA[id] || { title: 'Item ' + id, price: 0 };
      lines.push({
        title: meta.title,
        qty: entry.qty,
        price: meta.price,
        subtotal: meta.price * entry.qty,
        note: entry.special || ''
      });
    }
    const totals = calcTotals(cartObj);
    const now = new Date().toLocaleString();
    // simple HTML (print-friendly)
    let rowsHtml = lines.map(l => `
      <tr>
        <td style="padding:6px 8px">${l.title}${l.note ? '<div style="font-size:12px;color:#666">Note: '+escapeHtml(l.note)+'</div>' : ''}</td>
        <td style="padding:6px 8px;text-align:center">${l.qty}</td>
        <td style="padding:6px 8px;text-align:right">${formatCurrency(l.price)}</td>
        <td style="padding:6px 8px;text-align:right">${formatCurrency(l.subtotal)}</td>
      </tr>`).join('');

    return `
      <html><head><meta charset="utf-8"><title>Invoice</title>
      <style>
        body{font-family:Arial, Helvetica, sans-serif;padding:20px;color:#111}
        table{width:100%;border-collapse:collapse;margin-top:14px}
        th{font-weight:700;text-align:left;padding:8px;border-bottom:1px solid #ddd}
        td{border-bottom:1px solid #f2f2f2}
      </style></head>
      <body>
        <h2>Send Me — Invoice</h2>
        <div>Generated: ${now}</div>
        <table role="table" aria-label="Invoice table">
          <thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr><td colspan="2"></td><td style="padding:8px;text-align:right">Subtotal</td><td style="padding:8px;text-align:right">${formatCurrency(totals.subtotal)}</td></tr>
            <tr><td colspan="2"></td><td style="padding:8px;text-align:right">Tax</td><td style="padding:8px;text-align:right">${formatCurrency(totals.tax)}</td></tr>
            <tr><td colspan="2"></td><td style="padding:8px;text-align:right;font-weight:800">Total</td><td style="padding:8px;text-align:right;font-weight:800">${formatCurrency(totals.total)}</td></tr>
          </tfoot>
        </table>
      </body></html>
    `;
  }

  function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/[&<>"']/g, function (m) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m]; });
  }

  // Print: open a new window and print (user uses browser print)
  document.getElementById('sendme-print').addEventListener('click', function () {
    const html = getInvoiceHtml(cart);
    const w = window.open('', '_blank', 'noopener,noreferrer');
    w.document.write(html);
    w.document.close();
    w.focus();
    // wait a tick then call print (some browsers block immediate print)
    setTimeout(() => w.print(), 350);
  });

  // Download PDF via jsPDF (dynamically import)
  document.getElementById('sendme-download').addEventListener('click', async function () {
    // try to load jsPDF from CDN
    if (!window.jspdf) {
      try {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      } catch (err) {
        alert('Failed to load PDF library. Please try again.');
        return;
      }
    }
    const { jsPDF } = window.jspdf || window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const html = getInvoiceHtml(cart);

    // Use html method (some browsers require more libs; fallback to print)
    try {
      await doc.html(html, {
        callback: function (pdf) {
          pdf.save('sendme-invoice.pdf');
        },
        margin: [20, 20, 20, 20],
        x: 20,
        y: 20,
        html2canvas: { scale: 0.9 }
      });
    } catch (err) {
      // fallback: open print dialog
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 300);
    }
  });

  async function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => res();
      s.onerror = (e) => rej(e);
      document.head.appendChild(s);
    });
  }

  // Send email (via EmailJS client) — requires you to configure EmailJS and set EMAILJS_ENABLED = true
  document.getElementById('sendme-send-email').addEventListener('click', async function () {
    const toEmail = document.getElementById('sendme-email').value.trim();
    if (!toEmail) {
      if (!confirm('No email entered. Continue and open your default mail app with a prefilled message?')) return;
      // open mailto fallback
      const html = getInvoiceHtml(cart);
      const plain = stripTags(html);
      const mailto = 'mailto:?subject=' + encodeURIComponent('Send Me — Invoice') + '&body=' + encodeURIComponent(plain);
      window.location.href = mailto;
      return;
    }
    // If EmailJS is enabled, send programmatically
    if (EMAILJS_ENABLED) {
      try {
        if (!window.emailjs) {
          await loadScript('https://cdn.emailjs.com/sdk/3.2.0/email.min.js');
          emailjs.init(EMAILJS_USER_ID);
        }
        const invoiceHtml = getInvoiceHtml(cart);
        const params = {
          to_email: toEmail,
          invoice_html: invoiceHtml,
          subject: 'Send Me — Invoice'
        };
        const res = await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params);
        alert('Invoice sent to ' + toEmail);
      } catch (err) {
        console.error(err);
        alert('Failed to send email via EmailJS. Check console for details.');
      }
    } else {
      // fallback: open mail with plain text invoice
      const html = getInvoiceHtml(cart);
      const plain = stripTags(html);
      const mailto = 'mailto:' + encodeURIComponent(toEmail)
        + '?subject=' + encodeURIComponent('Send Me — Invoice')
        + '&body=' + encodeURIComponent(plain);
      window.location.href = mailto;
    }
  });

  function stripTags(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s{2,}/g, ' ').trim();
  }

  // helper: when cart changes update drawer & page summary
  function syncState() {
    saveCart(cart);
    updatePageSummary();
    renderDrawer();
  }

  // if localStorage had cart prepopulated, ensure button summary matches
  updatePageSummary();

  // render drawer on open to reflect latest persistent cart
  // listen for changes from drawer (removal handled above), and also handle external removals via other UI
  // also handle clicks inside drawer for remove (already wired)

  // Load saved cart into page if desired: if page has quantity elements we can reflect quantities
  function syncToPageQtys() {
    try {
      for (const id in cart) {
        const itemEl = document.querySelector('.item[data-id="' + id + '"]');
        if (itemEl) {
          const valEl = itemEl.querySelector('.value');
          if (valEl) valEl.textContent = cart[id].qty;
          const specialEl = itemEl.querySelector('.special');
          if (specialEl) specialEl.value = cart[id].special || '';
        }
      }
    } catch (e) { /* ignore */ }
  }

  // initialize: reflect saved cart to page qtys
  syncToPageQtys();

  // expose a global helper (optional) for debugging
  window.sendMeCart = {
    get: () => JSON.parse(JSON.stringify(cart)),
    clear: () => { cart={}; syncState(); }
  };

  // render initial drawer state
  renderDrawer();

})();