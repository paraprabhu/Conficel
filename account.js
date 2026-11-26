(() => {
  const openButton = document.getElementById('open-account-billing');
  const modal = document.getElementById('account-billing-modal');
  if (!openButton || !modal || !window.supabase) return;

  const message = document.getElementById('account-billing-message');
  const content = document.getElementById('account-billing-content');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date = value => value ? new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '—';
  const money = (value,currency='INR') => new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'INR',maximumFractionDigits:2}).format(Number(value||0)/100);
  const number = value => Number(value||0).toLocaleString('en-IN');
  let client = null;

  function showMessage(text, error=false) {
    message.hidden = false;
    message.textContent = text;
    message.className = 'account-billing-message' + (error ? ' error' : '');
    content.hidden = true;
  }

  function showTab(name) {
    document.querySelectorAll('[data-billing-tab]').forEach(button => {
      const active = button.dataset.billingTab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    ['payments','usage','subscription'].forEach(tab => {
      const panel = document.getElementById('billing-' + tab + '-panel');
      if (panel) panel.hidden = tab !== name;
    });
  }

  function render(data) {
    const p = data.profile || {};
    const totals = data.totals || {};
    const paidBalance = Math.max(0, Number(p.paid_tokens_balance ?? p.tokens_balance ?? 0));
    const freeBalance = Math.max(0, Number(p.free_trial_tokens_balance ?? 0));
    const totalBalance = Math.max(0, Number(p.total_available_tokens ?? (paidBalance + freeBalance)));
    const paidUsed = Math.max(0, Number(totals.used || 0));
    const freeUsed = Math.max(0, Number(totals.free_trial_used || 0));
    const planLabels = {starter:'Starter',standard:'Standard',scale:'Scale',professional:'Professional',business:'Business'};
    const planName = p.paid_plan_active ? (planLabels[String(p.plan||'').toLowerCase()] || p.plan || 'Paid plan') : 'Free trial';

    document.getElementById('billing-plan').textContent = String(planName).toUpperCase();
    document.getElementById('billing-plan-status').textContent = p.paid_plan_active ? 'ACTIVE' : 'FREE';
    document.getElementById('billing-balance').textContent = number(totalBalance);
    document.getElementById('billing-paid-balance').textContent = number(paidBalance);
    document.getElementById('billing-free-balance').textContent = number(freeBalance);
    document.getElementById('billing-expiry').textContent = p.paid_plan_active && p.subscription_expires_at ? 'Expires ' + date(p.subscription_expires_at) : 'No active paid plan';
    document.getElementById('billing-deduction-rule').textContent = paidBalance > 0 ? 'Paid plan and free trial balances are tracked separately.' : 'Use your free trial balance to continue.';
    document.getElementById('billing-total-note').textContent = number(paidBalance) + ' paid + ' + number(freeBalance) + ' free tokens available';

    const paidShare = totalBalance ? (paidBalance / totalBalance) * 100 : 0;
    const freeShare = totalBalance ? (freeBalance / totalBalance) * 100 : 0;
    document.getElementById('billing-bar-paid').style.width = paidShare + '%';
    document.getElementById('billing-bar-free').style.width = freeShare + '%';
    document.getElementById('billing-bar-title').textContent = 'Available token distribution';
    document.getElementById('billing-usage-label').textContent = number(totalBalance) + ' available';
    document.getElementById('billing-paid-legend').textContent = 'Paid · ' + number(paidBalance);
    document.getElementById('billing-free-legend').textContent = 'Free · ' + number(freeBalance);
    document.getElementById('billing-activity-note').textContent = 'Recorded usage: ' + number(paidUsed) + ' paid tokens · ' + number(freeUsed) + ' free trial tokens';

    const payments = Array.isArray(data.payments) ? data.payments : [];
    document.getElementById('billing-payments-panel').innerHTML = payments.length
      ? '<div class="account-billing-table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Payment reference</th></tr></thead><tbody>' +
        payments.map(x => '<tr><td>' + esc(date(x.paid_at || x.created_at)) + '</td><td>' + esc(x.plan) + '</td><td>' + esc(money(x.amount_minor ?? x.amount_paise,x.currency)) + '</td><td><span class="billing-status ' + esc(x.status) + '">' + esc(x.status) + '</span></td><td>' + esc(x.razorpay_payment_id || x.razorpay_order_id || '—') + '</td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="account-billing-empty">No payment records found yet.</p>';

    const ledger = Array.isArray(data.ledger) ? data.ledger : [];
    document.getElementById('billing-usage-panel').innerHTML =
      '<div class="account-billing-usage-summary"><div><span>Current paid token balance</span><strong>' + number(paidBalance) + '</strong><small>Tokens currently held in your paid account balance</small></div><div><span>Paid tokens consumed</span><strong>' + number(paidUsed) + '</strong><small>Recorded paid-token usage</small></div><div><span>Free trial tokens consumed</span><strong>' + number(freeUsed) + '</strong><small>Usage from the 20-token trial allowance</small></div></div><div class="billing-payment-total"><span>Total successfully paid</span><strong>' + (Object.entries(totals.payment_totals || {}).length ? Object.entries(totals.payment_totals).map(([currency,minor]) => esc(money(minor,currency))).join(' · ') : 'No confirmed payment amount recorded') + '</strong><small>Payment amounts are money, not tokens. Token credits and adjustments are listed separately below.</small></div><p class="billing-ledger-explainer"><strong>Token history:</strong> Each row shows a token change (+ added, − consumed) and the recorded balance after that event. Purchase credits, usage, corrections, restorations and manual adjustments are different ledger events. A balance adjustment is not a new payment.</p>' +
      (ledger.length
        ? '<div class="account-billing-table-wrap"><table><thead><tr><th>Date</th><th>Transaction / reason</th><th>Token change</th><th>Recorded balance after</th></tr></thead><tbody>' +
          ledger.map(x => '<tr><td>' + esc(date(x.created_at)) + '</td><td>' + esc(x.description || x.entry_type) + '</td><td class="' + (Number(x.tokens_delta)>0?'positive':'negative') + '">' + (Number(x.tokens_delta)>0?'+':'') + esc(x.tokens_delta) + '</td><td>' + ((x.description || '').includes('historical backfill') ? '—' : esc(x.balance_after)) + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<p class="account-billing-empty">No paid token activity recorded yet. Free trial usage is summarized above.</p>');

    document.getElementById('billing-subscription-panel').innerHTML =
      '<div class="account-billing-subscription-grid"><div><span>Plan</span><strong>' + esc(planName.toUpperCase()) + '</strong></div><div><span>Started</span><strong>' + esc(date(p.subscription_started_at)) + '</strong></div><div><span>Expires</span><strong>' + esc(date(p.subscription_expires_at)) + '</strong></div><div><span>Renewal</span><strong>Manual · No auto-renewal</strong></div></div><p class="account-billing-empty">Renew or upgrade from the Pricing section when you are ready.</p>';

    message.hidden = true;
    content.hidden = false;
    showTab('payments');
  }

  async function load() {
    showMessage('Loading your account…');
    try {
      if (!client) client = window.supabase.createClient(window.CONFICEL_SUPABASE_URL,window.CONFICEL_SUPABASE_PUBLISHABLE_KEY);
      const {data:{session},error} = await client.auth.getSession();
      if (error) throw error;
      if (!session?.access_token) throw new Error('Please sign in to view billing and usage.');
      const response = await fetch('/api/account/summary',{headers:{authorization:'Bearer '+session.access_token},cache:'no-store'});
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Could not load account details.');
      render(result || {});
    } catch (error) {
      showMessage(error.message || 'Could not load account details.',true);
    }
  }

  openButton.addEventListener('click',() => {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    load();
  });
  modal.querySelectorAll('[data-account-close]').forEach(el => el.addEventListener('click',() => {
    modal.hidden = true;
    document.body.style.overflow = '';
  }));
  modal.querySelectorAll('[data-billing-tab]').forEach(el => el.addEventListener('click',() => showTab(el.dataset.billingTab)));
  document.addEventListener('keydown',e => {
    if (e.key === 'Escape' && !modal.hidden) {
      modal.hidden = true;
      document.body.style.overflow = '';
    }
  });
})();