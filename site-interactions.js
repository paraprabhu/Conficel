(() => {
  const samples = {
    invoice: {
      title: "TAX INVOICE", sheet: "Invoice data", totalLabel: "Grand total", total: "$2,480.00",
      rows: [["Invoice no.","INV-1048"],["Supplier","Northstar Ltd."],["Invoice date","18 Oct 2026"],["Taxable total","$2,000.00"],["Tax","$480.00"],["Grand total","$2,480.00"]]
    },
    po: {
      title: "PURCHASE ORDER", sheet: "Purchase order data", totalLabel: "Order total", total: "$6,750.00",
      rows: [["PO number","PO-2084"],["Buyer","Meridian Works"],["Order date","04 Nov 2026"],["Items","12 line items"],["Delivery","Net 30 days"],["Order total","$6,750.00"]]
    },
    cheque: {
      title: "BANK CHEQUE", sheet: "Cheque data", totalLabel: "Cheque amount", total: "$1,250.00",
      rows: [["Cheque no.","CHQ-7724"],["Payee","Harbour Supplies"],["Cheque date","06 Nov 2026"],["Amount","$1,250.00"],["Amount in words","One thousand two hundred fifty"],["Cheque amount","$1,250.00"]]
    }
  };
  const tabs = [...document.querySelectorAll("[data-demo]")];
  const title = document.querySelector("[data-demo-title]");
  const sheetTitle = document.querySelector("[data-demo-sheet-title]");
  const totalLabel = document.querySelector("[data-demo-total-label]");
  const total = document.querySelector("[data-demo-total]");
  const grid = document.querySelector("[data-demo-grid]");
  function showSample(key) {
    const sample = samples[key];
    if (!sample || !grid) return;
    tabs.forEach(tab => {
      const active = tab.dataset.demo === key;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    title.textContent = sample.title;
    sheetTitle.textContent = sample.sheet;
    totalLabel.textContent = sample.totalLabel;
    total.textContent = sample.total;
    grid.classList.add("is-updating");
    grid.innerHTML = sample.rows.map((row, index) => {
      const isTotal = index === sample.rows.length - 1;
      return '<span' + (isTotal ? ' class="sheet-total-label"' : '') + '>' + row[0] + '</span>' +
        (isTotal ? '<b class="sheet-total-value">' + row[1] + '</b>' : '<span>' + row[1] + '</span>');
    }).join("");
    requestAnimationFrame(() => grid.classList.remove("is-updating"));
  }
  tabs.forEach(tab => tab.addEventListener("click", () => showSample(tab.dataset.demo)));

  const header = document.querySelector(".site-header");
  const updateHeader = () => header && header.classList.toggle("header-scrolled", window.scrollY > 12);
  updateHeader();
  window.addEventListener("scroll", updateHeader, {passive:true});

  const revealTargets = document.querySelectorAll(".intro-strip,.section-heading,.product-card,.workflow-step,.workspace-intro,.workspace,.plan-card,.security-inner,.cta-inner");
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    revealTargets.forEach(el => el.classList.add("js-reveal"));
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, {threshold:0.12,rootMargin:"0px 0px -35px 0px"});
    revealTargets.forEach(el => observer.observe(el));
  }
})();