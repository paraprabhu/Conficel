(() => {
  const plansEl = document.getElementById('pricing-plans');
  if (!plansEl) return;

  const freePlan = {name:'Free trial',label:'FREE',pages:'10 + 10',quotaText:'invoices + cheques per account',price:'₹0',summary:'Try the document workspace before choosing a plan.',features:['10 invoice files','10 cheque files','Preview the workspace']};
  const globalFreePlan = {...freePlan, price:'$0'};

  const indiaPlans = [
    {name:'Entry',label:'MICRO',pages:'50',price:'₹100',summary:'An affordable start for occasional documents.',features:['Invoice and document workspace','50 pages per month','Review and export workflow']},
    {name:'Basic',label:'BASIC',pages:'100',price:'₹199',summary:'For freelancers and very small businesses.',features:['Everything in Entry','100 pages per month','Review and export workflow']},
    {name:'Starter',label:'STARTER',pages:'500',price:'₹499',summary:'For small businesses processing documents regularly.',features:['Everything in Basic','500 pages per month','Shared document allowance']},
    {name:'Growth',label:'GROWTH',pages:'1,000',price:'₹799',summary:'More capacity as your workflow expands.',features:['Everything in Starter','1,000 pages per month','Higher monthly allowance']},
    {name:'Business',label:'BUSINESS',pages:'2,500',price:'₹1,299',summary:'Volume pricing for established workflows.',features:['Everything in Growth','2,500 pages per month','Largest monthly allowance']}
  ];
  const globalPlans = [
    {name:'Micro',label:'MICRO',pages:'100',price:'$4.25',summary:'A simple start for occasional documents.',features:['Invoice and document workspace','100 pages per month','Review and export workflow']},
    {name:'Starter',label:'STARTER',pages:'500',price:'$7.99',summary:'For small teams processing documents regularly.',features:['Everything in Micro','500 pages per month','Shared document allowance']},
    {name:'Growth',label:'GROWTH',pages:'1,000',price:'$11.69',summary:'More capacity as your workflow expands.',features:['Everything in Starter','1,000 pages per month','Higher monthly allowance']},
    {name:'Business',label:'BUSINESS',pages:'2,500',price:'$15.00',summary:'Volume pricing for established workflows.',features:['Everything in Growth','2,500 pages per month','Largest monthly allowance']}
  ];

  function render(isIndia) {
    const plans = [isIndia ? freePlan : globalFreePlan, ...(isIndia ? indiaPlans : globalPlans)];
    plansEl.classList.toggle('india-plans', isIndia);
    plansEl.innerHTML = plans.map((plan, index) => {
      const popular = plan.pages === '500';
      const free = plan.label === 'FREE';
      return '<article class="plan-card' + (popular ? ' plan-card-popular' : '') + '">' +
        '<div class="plan-topline"></div>' + (popular ? '<span class="plan-badge">POPULAR</span>' : '') +
        '<span class="plan-label">' + plan.label + '</span><h3>' + plan.name + '</h3>' +
        '<p class="plan-summary">' + plan.summary + '</p>' +
        '<div class="plan-price"><strong>' + plan.price + '</strong><span>/ month</span></div>' +
        '<div class="plan-quota-box"><div><strong>' + plan.pages + '</strong><span>' + (free ? 'per account' : (plan.quotaText || 'pages / month')) + '</span></div></div>' +
        '<ul class="plan-features">' + plan.features.map(item => '<li>' + item + '</li>').join('') + '</ul>' +
        '<a class="button plan-button' + (popular ? ' plan-button-primary' : '') + '" href="#workspace">' + (free ? 'Try workspace' : 'Explore workspace') + '</a>' +
        '</article>';
    }).join('');
    document.getElementById('region-label').textContent = isIndia ? 'Showing India plans' : 'Showing global plans';
    document.getElementById('region-currency').textContent = isIndia ? 'INR' : 'USD';
    document.getElementById('pricing-footnote').textContent = isIndia
      ? 'India pricing is displayed in INR. Applicable GST is additional. Subscription checkout and paid plan activation are not connected yet.'
      : 'Global pricing is displayed in USD for visitors outside India. Applicable taxes depend on customer location. Subscription checkout and paid plan activation are not connected yet.';
  }

  const menuButton = document.querySelector('.mobile-menu-button');
  const siteHeader = document.querySelector('.site-header');
  if (menuButton && siteHeader) {
    menuButton.addEventListener('click', () => {
      const open = siteHeader.classList.toggle('nav-open');
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.textContent = open ? '×' : '☰';
    });
    siteHeader.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => {
      siteHeader.classList.remove('nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
      menuButton.textContent = '☰';
    }));
  }

  render(false);
  fetch('/api/region', {headers:{'accept':'application/json'}, cache:'no-store'})
    .then(response => response.ok ? response.json() : Promise.reject(new Error('Region lookup unavailable')))
    .then(data => render(data && data.country === 'IN'))
    .catch(() => render(false));
})();