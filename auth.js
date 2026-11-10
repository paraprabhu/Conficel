(() => {
  const openBtn = document.getElementById('auth-open-button');
  const modal = document.getElementById('auth-modal');
  if (!openBtn || !modal) return;
  const form = document.getElementById('auth-form');
  const nameWrap = document.getElementById('auth-name-wrap');
  const nameInput = document.getElementById('auth-name');
  const emailInput = document.getElementById('auth-email');
  const passwordInput = document.getElementById('auth-password');
  const submitBtn = document.getElementById('auth-submit');
  const forgotBtn = document.getElementById('auth-forgot');
  const message = document.getElementById('auth-message');
  const userPanel = document.getElementById('auth-user');
  const verifyPanel = document.getElementById('auth-verify');
  const verifyEmailLabel = document.getElementById('auth-verify-email');
  const verifyMessage = document.getElementById('auth-verify-message');
  const resendVerifyBtn = document.getElementById('auth-resend-verify');
  const otpInput = document.getElementById('auth-otp');
  const verifyOtpBtn = document.getElementById('auth-verify-otp');
  const backToLoginBtn = document.getElementById('auth-back-to-login');
  const userEmail = document.getElementById('auth-user-email');
  const verificationStatus = document.getElementById('auth-verification-status');
  const resendBtn = document.getElementById('auth-resend');
  const signoutBtn = document.getElementById('auth-signout');
  let mode = window.location.hash.includes('type=recovery') ? 'recovery' : 'signup';
  let supabaseClient = null;
  let pendingVerificationEmail = '';
  function say(text, kind='') { message.textContent = text; message.className = 'auth-message' + (kind ? ' ' + kind : ''); }
  function setMode(next) {
    mode = next;
    if (verifyPanel) verifyPanel.hidden = true;
    document.querySelectorAll('[data-auth-mode]').forEach(b => b.classList.toggle('active', b.dataset.authMode === mode));
    nameWrap.hidden = mode !== 'signup';
    nameInput.required = mode === 'signup';
    passwordInput.autocomplete = (mode === 'signup' || mode === 'recovery') ? 'new-password' : 'current-password';
    passwordInput.placeholder = mode === 'recovery' ? 'Enter your new password' : 'At least 8 characters';
    submitBtn.textContent = mode === 'signup' ? 'Create account' : (mode === 'recovery' ? 'Update password' : 'Sign in');
    forgotBtn.hidden = mode !== 'signin';
    say('');
  }
  function showModal() { modal.hidden = false; document.body.style.overflow = 'hidden'; emailInput.focus(); }
  function hideModal() { modal.hidden = true; document.body.style.overflow = ''; }
  function showVerification(email, messageText='') {
    pendingVerificationEmail = (email || '').trim().toLowerCase();
    verifyEmailLabel.textContent = pendingVerificationEmail;
    verifyMessage.textContent = messageText || 'Enter the 6-digit code sent by email to verify your address.';
    verifyMessage.className = 'auth-message success';
    form.hidden = true; userPanel.hidden = true; verifyPanel.hidden = false;
    forgotBtn.hidden = true;
  }
  function updateSession(session) {
    if (!session) {
      openBtn.textContent = 'Sign in / Create account';
      userPanel.hidden = true;
      if (!verifyPanel || verifyPanel.hidden) form.hidden = false;
      forgotBtn.hidden = mode !== 'signin';
      return;
    }
    openBtn.textContent = session.user.user_metadata?.full_name || session.user.user_metadata?.name || 'My account';
    userPanel.hidden = false; form.hidden = true; verifyPanel.hidden = true; forgotBtn.hidden = true;
    userEmail.textContent = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email || 'Signed in';
    const verified = !!session.user.email_confirmed_at;
    verificationStatus.textContent = verified ? 'Email verified.' : 'Email verification pending. Check your inbox.';
    resendBtn.hidden = verified;
  }
  openBtn.addEventListener('click', async () => {
    showModal();
    if (!supabaseClient) { say('Authentication is not configured yet. Check the Supabase project settings and reload.', 'error'); return; }
    const {data} = await supabaseClient.auth.getSession();
    updateSession(data.session);
  });
  modal.querySelectorAll('[data-auth-close]').forEach(el => el.addEventListener('click', hideModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) hideModal(); });
  document.querySelectorAll('[data-auth-mode]').forEach(b => b.addEventListener('click', () => { form.hidden = false; userPanel.hidden = true; setMode(b.dataset.authMode); }));
  if (!window.supabase || !window.CONFICEL_SUPABASE_URL || !window.CONFICEL_SUPABASE_PUBLISHABLE_KEY) {
    openBtn.addEventListener('click', () => say('Supabase client library or public configuration did not load. Refresh the page and try again.', 'error'));
    return;
  }
  supabaseClient = window.supabase.createClient(window.CONFICEL_SUPABASE_URL, window.CONFICEL_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  window.conficelSupabase = supabaseClient;
  supabaseClient.auth.getSession().then(({data}) => updateSession(data.session));
  supabaseClient.auth.onAuthStateChange((_event, session) => updateSession(session));
  form.addEventListener('submit', async e => {
    e.preventDefault();
    submitBtn.disabled = true; say(mode === 'signup' ? 'Creating your account…' : 'Signing you in…');
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    try {
      if (mode === 'recovery') {
        const {error} = await supabaseClient.auth.updateUser({password});
        if (error) throw error;
        history.replaceState(null, '', window.location.pathname);
        setMode('signin');
        say('Password updated. You can now sign in with your new password.', 'success');
      } else if (mode === 'signup') {
        const {data, error} = await supabaseClient.auth.signUp({
          email, password,
          options: { data: { full_name: nameInput.value.trim() } }
        });
        if (error) throw error;
        if (data.session && data.user?.email_confirmed_at) {
          say('Account created successfully.', 'success');
          updateSession(data.session);
        } else {
          if (data.session) await supabaseClient.auth.signOut();
          showVerification(email, 'Enter the 6-digit code sent by email to verify your address.');
        }
      } else {
        const {data, error} = await supabaseClient.auth.signInWithPassword({email, password});
        if (error) throw error;
        if (!data.user.email_confirmed_at) {
          await supabaseClient.auth.signOut();
          showVerification(email, 'Enter the 6-digit code sent by email to verify your address.');
        } else {
          say('Signed in successfully.', 'success');
          updateSession(data.session);
        }
      }
    } catch (err) {
      if (mode === 'signin' && (err.code === 'email_not_confirmed' || /email not confirmed/i.test(err.message || ''))) {
        showVerification(email, 'Open the confirmation link in the email from Supabase to verify your address.');
      } else {
        say(err.message || 'Authentication failed. Please try again.', 'error');
      }
    }
    finally { submitBtn.disabled = false; }
  });
  forgotBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    if (!email) { say('Enter your email address first, then select Forgot password.', 'error'); emailInput.focus(); return; }
    forgotBtn.disabled = true;
    try {
      const {error} = await supabaseClient.auth.resetPasswordForEmail(email, {redirectTo: window.location.origin + window.location.pathname});
      if (error) throw error;
      say('If an account exists for that address, a password-reset email will be sent.', 'success');
    } catch (err) { say(err.message || 'Could not request a password reset.', 'error'); }
    finally { forgotBtn.disabled = false; }
  });
  verifyOtpBtn?.addEventListener('click', async () => {
    const token = (otpInput?.value || '').replace(/\\D/g, '').slice(0, 6);
    if (!pendingVerificationEmail || token.length !== 6) {
      verifyMessage.textContent = 'Enter the 6-digit code from your email.';
      verifyMessage.className = 'auth-message error';
      return;
    }
    verifyOtpBtn.disabled = true;
    verifyMessage.textContent = 'Verifying code…';
    try {
      const {data, error} = await supabaseClient.auth.verifyOtp({
        email: pendingVerificationEmail, token, type: 'signup'
      });
      if (error) throw error;
      verifyPanel.hidden = true;
      form.hidden = true;
      say('Email verified. Your account is ready.', 'success');
      updateSession(data.session);
    } catch (err) {
      verifyMessage.textContent = err.message || 'The code could not be verified. Request a new code and try again.';
      verifyMessage.className = 'auth-message error';
    } finally { verifyOtpBtn.disabled = false; }
  });
  backToLoginBtn?.addEventListener('click', () => {
    verifyPanel.hidden = true; form.hidden = false; userPanel.hidden = true; setMode('signin');
    if (pendingVerificationEmail) emailInput.value = pendingVerificationEmail;
  });
  resendBtn.addEventListener('click', async () => {
    const email = userEmail.textContent.trim();
    if (!email || email === 'Signed in') return;
    const {error} = await supabaseClient.auth.resend({type:'signup', email});
    say(error ? error.message : 'A new 6-digit verification code has been sent. Check your inbox.', error ? 'error' : 'success');
  });
  signoutBtn.addEventListener('click', async () => {
    const {error} = await supabaseClient.auth.signOut();
    if (error) say(error.message, 'error'); else { updateSession(null); form.hidden = false; setMode('signin'); say('You are signed out.', 'success'); }
  });
  if (mode === 'recovery') { showModal(); setMode('recovery'); say('Enter a new password to finish resetting your account.', 'success'); }
})();
