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

  // Interactive document showcase: sample-only content, not a live extraction claim.
  const showcaseSamples = {
    invoice: {
      title:"Invoice overview", file:"sample-invoice.pdf", type:"TAX INVOICE", ref:"INV-1048",
      item:"Industrial materials", amount:"$2,000", totalLabel:"Grand total", total:"$2,480.00",
      fields:[["Invoice number","INV-1048"],["Supplier","Northstar Ltd."],["Invoice date","18 Oct 2026"],["Taxable amount","$2,000.00"],["Tax","$480.00"],["Grand total","$2,480.00"]]
    },
    po: {
      title:"Purchase order overview", file:"sample-purchase-order.pdf", type:"PURCHASE ORDER", ref:"PO-2084",
      item:"Production components", amount:"$5,900", totalLabel:"Order total", total:"$6,750.00",
      fields:[["PO number","PO-2084"],["Buyer","Meridian Works"],["Supplier","Northstar Ltd."],["Order date","04 Nov 2026"],["Delivery terms","Net 30 days"],["Order total","$6,750.00"]]
    },
    cheque: {
      title:"Cheque overview", file:"sample-cheque.jpg", type:"BANK CHEQUE", ref:"CHQ-7724",
      item:"Payee: Harbour Supplies", amount:"$1,250", totalLabel:"Cheque amount", total:"$1,250.00",
      fields:[["Cheque number","CHQ-7724"],["Payee","Harbour Supplies"],["Cheque date","06 Nov 2026"],["Amount","$1,250.00"],["Amount in words","One thousand two hundred fifty"],["Cheque amount","$1,250.00"]]
    }
  };
  const showcaseTabs = [...document.querySelectorAll("[data-showcase]")];
  const showcaseFields = document.querySelector("[data-showcase-fields]");
  function renderShowcase(key) {
    const sample = showcaseSamples[key];
    if (!sample || !showcaseFields) return;
    showcaseTabs.forEach(tab => {
      const active = tab.dataset.showcase === key;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-pressed", String(active));
    });
    document.querySelector("[data-showcase-title]").textContent = sample.title;
    document.querySelector("[data-showcase-file]").textContent = sample.file;
    document.querySelector("[data-paper-type]").textContent = sample.type;
    document.querySelector("[data-paper-ref]").textContent = sample.ref;
    document.querySelector("[data-paper-item]").textContent = sample.item;
    document.querySelector("[data-paper-amount]").textContent = sample.amount;
    document.querySelector("[data-paper-total-label]").textContent = sample.totalLabel;
    document.querySelector("[data-paper-total]").textContent = sample.total;
    showcaseFields.innerHTML = sample.fields.map((field,index) => {
      const isTotal = index === sample.fields.length - 1;
      return '<div' + (isTotal ? ' class="output-total"' : '') + '><span>' + field[0] + '</span><b>' + field[1] + '</b></div>';
    }).join("");
    showcaseFields.classList.remove("is-refreshing");
    void showcaseFields.offsetWidth;
    showcaseFields.classList.add("is-refreshing");
  }
  showcaseTabs.forEach(tab => tab.addEventListener("click", () => renderShowcase(tab.dataset.showcase)));
  renderShowcase("invoice");

})();