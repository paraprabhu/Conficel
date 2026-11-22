(() => {
  const buttons = document.querySelectorAll('[data-paid-plan]');
  if (!buttons.length) return;
  const authButton = document.getElementById('auth-open-button');

  async function startCheckout(plan, button) {
    const client = window.conficelSupabase;
    if (!client) {
      alert('Please refresh the page and sign in before choosing a paid plan.');
      return;
    }
    const {data:{session}, error:sessionError} = await client.auth.getSession();
    if (sessionError || !session || !session.user?.email_confirmed_at) {
      alert('Please sign in with a verified email address before purchasing a plan.');
      authButton?.click();
      return;
    }
    if (!window.Razorpay) {
      alert('Secure checkout could not load. Please refresh and try again.');
      return;
    }

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Preparing secure checkout…';
    try {
      const orderResponse = await fetch('/api/payments/create-order', {
        method:'POST',
        headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},
        body:JSON.stringify({plan})
      });
      const order = await orderResponse.json().catch(()=>null);
      if (!orderResponse.ok || !order?.order_id || !order?.key_id) {
        throw new Error(order?.error || 'Could not start checkout. Please try again.');
      }

      const checkout = new window.Razorpay({
        key:order.key_id,
        amount:order.amount,
        currency:order.currency,
        name:order.name,
        description:order.description,
        order_id:order.order_id,
        prefill:order.customer,
        theme:{color:'#1760ad'},
        handler:async response => {
          try {
            const verifyResponse = await fetch('/api/payments/verify', {
              method:'POST',
              headers:{'content-type':'application/json',authorization:'Bearer '+session.access_token},
              body:JSON.stringify(response)
            });
            const verified = await verifyResponse.json().catch(()=>null);
            if (!verifyResponse.ok || !verified?.success) {
              throw new Error(verified?.error || 'Payment verification is pending. Contact support with your Razorpay payment ID.');
            }
            const planNames={starter:'Starter',standard:'Standard',scale:'Scale',professional:'Professional',business:'Business'};
            alert('Payment successful! Your '+(planNames[verified.plan]||verified.plan)+
              ' plan is active. Available paid tokens: '+verified.tokens_balance+
              '. Access expires on '+new Date(verified.subscription_expires_at).toLocaleDateString()+'.');
            window.location.reload();
          } catch (error) {
            alert(error.message || 'Payment was received but could not be verified. Please contact support.');
          }
        },
        modal:{ondismiss:()=>{button.disabled=false;button.textContent=originalText;}}
      });
      checkout.on('payment.failed', event => {
        alert(event?.error?.description || 'Payment failed. No plan has been activated.');
        button.disabled=false;
        button.textContent=originalText;
      });
      checkout.open();
    } catch (error) {
      alert(error.message || 'Could not start secure checkout.');
      button.disabled=false;
      button.textContent=originalText;
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => startCheckout(button.dataset.paidPlan, button)));
})();
