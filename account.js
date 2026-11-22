(() => {
  const openButton = document.getElementById('open-account-billing');
  const modal = document.getElementById('account-billing-modal');
  if (!openButton || !modal || !window.supabase) return;
  const message = document.getElementById('account-billing-message');
  const content = document.getElementById('account-billing-content');
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const date = value => value ? new Date(value).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}) : '—';
  const money = value => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(Number(value||0)/100);
  let client = null;
  function showMessage(text, error=false) {
    message.hidden = false; message.textContent = text;
    message.className = 'account-billing-message' + (error ? ' error' : '');
  }
  function showTab(name) {
    document.querySelectorAll('[data-billing-tab]').forEach(button => button.classList.toggle('active',button.dataset.billingTab===name));
    ['payments','usage','subscription'].forEach(tab => {
      const panel=document.getElementById('billing-'+tab+'-panel');
      if(panel) panel.hidden=tab!==name;
    });
  }
  function render(data) {
    const p=data.profile||{}, totals=data.totals||{};
    const paidBalance=Number(p.paid_tokens_balance ?? p.tokens_balance ?? 0);
    const freeBalance=Number(p.free_trial_tokens_balance ?? 0);
    const totalBalance=Number(p.total_available_tokens ?? (paidBalance+freeBalance));
    const purchased=Number(totals.purchased||0), used=Number(totals.used||0);
    document.getElementById('billing-plan').textContent=(p.paid_plan_active ? p.plan : 'Free trial').toUpperCase();
    document.getElementById('billing-balance').textContent=totalBalance.toLocaleString('en-IN');
    document.getElementById('billing-paid-balance').textContent=paidBalance.toLocaleString('en-IN');
    document.getElementById('billing-free-balance').textContent=freeBalance.toLocaleString('en-IN');
    document.getElementById('billing-expiry').textContent=p.paid_plan_active && p.subscription_expires_at ? 'Expires '+date(p.subscription_expires_at) : 'No active paid plan';
    const total=purchased||paidBalance+used, percent=total?Math.min(100,Math.round(used/total*100)):0;
    document.getElementById('billing-usage-label').textContent=used+' paid tokens used · '+paidBalance+' paid remaining';
    document.getElementById('billing-usage-bar').style.width=percent+'%';
    const payments=data.payments||[];
    document.getElementById('billing-payments-panel').innerHTML=payments.length ? '<div class="account-billing-table-wrap"><table><thead><tr><th>Date</th><th>Plan</th><th>Amount</th><th>Status</th><th>Payment reference</th></tr></thead><tbody>'+payments.map(x=>'<tr><td>'+esc(date(x.paid_at||x.created_at))+'</td><td>'+esc(x.plan)+'</td><td>'+esc(money(x.amount_paise))+'</td><td><span class="billing-status '+esc(x.status)+'">'+esc(x.status)+'</span></td><td>'+esc(x.razorpay_payment_id||x.razorpay_order_id||'—')+'</td></tr>').join('')+'</tbody></table></div>' : '<p class="account-billing-empty">No payment records found yet.</p>';
    const ledger=data.ledger||[];
    document.getElementById('billing-usage-panel').innerHTML='<div class="account-billing-usage-summary"><div><span>Paid tokens purchased (recent)</span><strong>'+purchased.toLocaleString('en-IN')+'</strong></div><div><span>Paid tokens used (recent)</span><strong>'+used.toLocaleString('en-IN')+'</strong></div><div><span>Free trial tokens used</span><strong>'+Number(totals.free_trial_used||0).toLocaleString('en-IN')+'</strong></div></div>' + (ledger.length ? '<div class="account-billing-table-wrap"><table><thead><tr><th>Date</th><th>Activity</th><th>Change</th><th>Balance after</th></tr></thead><tbody>'+ledger.map(x=>'<tr><td>'+esc(date(x.created_at))+'</td><td>'+esc(x.description||x.entry_type)+'</td><td class="'+(x.tokens_delta>0?'positive':'negative')+'">'+(x.tokens_delta>0?'+':'')+esc(x.tokens_delta)+'</td><td>'+((x.description||'').includes('historical backfill')?'—':esc(x.balance_after))+'</td></tr>').join('')+'</tbody></table></div>' : '<p class="account-billing-empty">No paid token activity recorded yet. Free trial usage is summarized above.</p>');
    document.getElementById('billing-subscription-panel').innerHTML='<div class="account-billing-subscription-grid"><div><span>Plan</span><strong>'+esc((p.plan||'free').toUpperCase())+'</strong></div><div><span>Started</span><strong>'+esc(date(p.subscription_started_at))+'</strong></div><div><span>Expires</span><strong>'+esc(date(p.subscription_expires_at))+'</strong></div><div><span>Renewal</span><strong>Manual · No auto-renewal</strong></div></div><p class="account-billing-empty">Renew or upgrade from the Pricing section when you are ready.</p>';
    message.hidden=true; content.hidden=false; showTab('payments');
  }
  async function load() {
    showMessage('Loading your account…');
    try {
      if(!client) client=window.supabase.createClient(window.CONFICEL_SUPABASE_URL,window.CONFICEL_SUPABASE_PUBLISHABLE_KEY);
      const {data:{session},error}=await client.auth.getSession();
      if(error) throw error;
      if(!session?.access_token) throw new Error('Please sign in to view billing and usage.');
      const response=await fetch('/api/account/summary',{headers:{authorization:'Bearer '+session.access_token},cache:'no-store'});
      const result=await response.json().catch(()=>null);
      if(!response.ok) throw new Error(result?.error||'Could not load account details.');
      render(result);
    } catch(error) { showMessage(error.message||'Could not load account details.',true); }
  }
  openButton.addEventListener('click',()=>{modal.hidden=false;document.body.style.overflow='hidden';load();});
  modal.querySelectorAll('[data-account-close]').forEach(el=>el.addEventListener('click',()=>{modal.hidden=true;document.body.style.overflow='';}));
  modal.querySelectorAll('[data-billing-tab]').forEach(el=>el.addEventListener('click',()=>showTab(el.dataset.billingTab)));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden){modal.hidden=true;document.body.style.overflow='';}});
})();
