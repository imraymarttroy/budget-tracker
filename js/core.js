/* Accounts and data (Firebase), dates and budget maths. No DOM code lives here. */
window.BT = (function () {
  'use strict';

  const MIN_AGE = 13;
  const RESEND_COOLDOWN_MS = 60 * 1000;

  const BUCKETS = [
    { id: 'needs', label: 'Needs', share: 50, hint: 'Rent, groceries, utilities, transport, minimum debt payments.' },
    { id: 'wants', label: 'Wants', share: 30, hint: 'Dining out, hobbies, shopping, subscriptions, travel.' },
    { id: 'savings', label: 'Savings', share: 20, hint: 'Emergency fund, investments, extra debt payments.' }
  ];
  const TYPE_LABELS = { income: 'Income', needs: 'Needs', wants: 'Wants', savings: 'Savings' };
  const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'SGD', 'JPY', 'KRW', 'CNY', 'HKD', 'INR', 'IDR', 'MYR', 'THB', 'VND', 'AED', 'SAR', 'ZAR', 'BRL', 'MXN', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'];
  const REGION_CURRENCY = {
    US: 'USD', GB: 'GBP', PH: 'PHP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', JP: 'JPY', KR: 'KRW', CN: 'CNY',
    HK: 'HKD', IN: 'INR', ID: 'IDR', MY: 'MYR', TH: 'THB', VN: 'VND', AE: 'AED', SA: 'SAR', ZA: 'ZAR', BR: 'BRL',
    MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
    NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR'
  };

  /** An error whose message is safe and useful to show to the person. */
  class UserError extends Error {}

  /** A UserError tied to specific form fields, e.g. { email: 'That email is taken.' }. */
  class FieldError extends UserError {
    constructor(fields) {
      super(fields[Object.keys(fields)[0]]);
      this.fields = fields;
    }
  }

  /* ---------- Firebase plumbing ---------- */

  const A = function () { return window.FB.A; };
  const F = function () { return window.FB.F; };
  const RESEND_KEY = 'pbh.lastEmail';

  function userDoc(uid) { return F().doc(window.FB.db, 'users', uid); }
  function txCol(uid) { return F().collection(window.FB.db, 'users', uid, 'tx'); }
  function nameDoc(username) { return F().doc(window.FB.db, 'usernames', username.toLowerCase()); }

  /** Where Firebase's verification and reset emails send people back to. */
  function actionSettings() {
    return { url: location.origin + location.pathname };
  }

  function friendly(error) {
    if (error instanceof UserError) return error;
    const code = (error && error.code) || '';
    const messages = {
      'auth/network-request-failed': 'We could not reach the server. Check your connection and try again.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/weak-password': 'Use a stronger password with at least 8 characters.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/requires-recent-login': 'For your security, enter your password again.',
      'unavailable': 'We could not reach the server. Check your connection and try again.',
      'permission-denied': 'You do not have permission to do that.'
    };
    console.error(error);
    return new UserError(messages[code] || 'Something went wrong. Please try again.');
  }

  /* ---------- Session cache ---------- */

  const cache = { authUser: null, profile: null, txs: [], loadError: false };
  let signUpInProgress = false;
  let redirectError = null;

  /** A sign-in problem from coming back after a Google or Facebook redirect. Read once. */
  function takeRedirectError() { const message = redirectError; redirectError = null; return message; }

  async function loadSession(authUser) {
    cache.authUser = authUser;
    cache.profile = null;
    cache.txs = [];
    cache.loadError = false;
    if (!authUser) return;
    try {
      const snap = await F().getDoc(userDoc(authUser.uid));
      if (!snap.exists()) return;
      cache.profile = Object.assign({}, snap.data(), { id: authUser.uid });
      const list = await F().getDocs(txCol(authUser.uid));
      cache.txs = list.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); });
    } catch (error) {
      console.error(error);
      cache.loadError = true;
    }
  }

  /** Calls back whenever someone signs in or out, after their data has loaded. */
  function onSessionChange(callback) {
    A().getRedirectResult(window.FB.auth).catch(function (error) {
      const friendlyError = socialError(error);
      if (friendlyError) { redirectError = friendlyError.message; callback(); }
    });
    A().onAuthStateChanged(window.FB.auth, async function (authUser) {
      if (signUpInProgress) return;
      await loadSession(authUser);
      callback();
    });
  }

  function sessionState() {
    if (!cache.authUser) return 'signed-out';
    if (cache.loadError) return 'error';
    if (!cache.profile) return socialProvider(cache.authUser) ? 'complete' : 'orphan';
    return 'ready';
  }

  function currentUser() {
    if (!cache.authUser || !cache.profile) return null;
    return Object.assign({}, cache.profile, {
      email: accountEmail(cache.authUser),
      verified: cache.authUser.emailVerified,
      provider: socialProvider(cache.authUser) && !hasPassword(cache.authUser) ? socialProvider(cache.authUser) : 'password'
    });
  }

  async function reloadSession() {
    await loadSession(window.FB.auth.currentUser);
  }

  /* ---------- Dates (always local time, never UTC) ---------- */

  function pad(n) { return String(n).padStart(2, '0'); }

  function today() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  /** Returns {y, m, d} for a real calendar date in YYYY-MM-DD form, otherwise null. */
  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    const y = +match[1], m = +match[2], d = +match[3];
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  /** Whole years between a birthday and a date. A Feb 29 birthday counts from Mar 1 in other years. */
  function ageOn(birthday, onDate) {
    const b = parseDate(birthday), t = parseDate(onDate);
    if (!b || !t) return null;
    let age = t.y - b.y;
    if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
    return age;
  }

  function monthOf(date) { return date.slice(0, 7); }

  function addMonths(month, delta) {
    const y = +month.slice(0, 4), m = +month.slice(5, 7);
    const d = new Date(y, m - 1 + delta, 1);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }

  function toLocalDate(value) {
    const p = parseDate(value);
    return new Date(p.y, p.m - 1, p.d);
  }

  function monthLabel(month) {
    return toLocalDate(month + '-01').toLocaleDateString(I18N.locale, { month: 'long', year: 'numeric' });
  }

  function shortDate(value) {
    return toLocalDate(value).toLocaleDateString(I18N.locale, { month: 'short', day: 'numeric' });
  }

  function longDate(value) {
    return toLocalDate(value).toLocaleDateString(I18N.locale, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /* ---------- Accounts ---------- */

  /** The country (or EU) whose flag stands for each currency. */
  const CURRENCY_FLAG = {
    PHP: 'ph', USD: 'us', EUR: 'eu', GBP: 'gb', CAD: 'ca', AUD: 'au', NZD: 'nz', SGD: 'sg', JPY: 'jp', KRW: 'kr',
    CNY: 'cn', HKD: 'hk', INR: 'in', IDR: 'id', MYR: 'my', THB: 'th', VND: 'vn', AED: 'ae', SAR: 'sa', ZAR: 'za',
    BRL: 'br', MXN: 'mx', CHF: 'ch', SEK: 'se', NOK: 'no', DKK: 'dk', PLN: 'pl'
  };

  function flagUrl(code) {
    return 'https://flagcdn.com/' + (CURRENCY_FLAG[code] || 'un') + '.svg';
  }

  /** "PHP · Philippine peso (₱)", in the browser's language where it can. */
  function currencyLabel(code) {
    let name = code, symbol = '';
    try { name = new Intl.DisplayNames(undefined, { type: 'currency' }).of(code) || code; } catch (e) { /* keep the code */ }
    try {
      const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' })
        .formatToParts(0).find(function (p) { return p.type === 'currency'; });
      if (part && part.value !== code) symbol = ' (' + part.value + ')';
    } catch (e) { /* no symbol */ }
    return code + ' · ' + name + symbol;
  }

  function guessCurrency() {
    try {
      if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Manila') return 'PHP';
    } catch (e) { /* fall through to the language guess */ }
    try {
      const region = new Intl.Locale(navigator.language).region;
      return REGION_CURRENCY[region] || 'USD';
    } catch (e) {
      return 'USD';
    }
  }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }

  /** Returns a map of field name to error message. Empty means valid. Username and email
      availability are checked by the server when the account is created. */
  function validateSignUp(input, onDate) {
    const errors = {};
    if (!input.name) errors.name = 'Enter your name.';
    else if (input.name.length > 60) errors.name = 'Use 60 characters or fewer.';

    if (!input.birthday) errors.birthday = 'Enter your birthday.';
    else {
      const age = ageOn(input.birthday, onDate);
      if (age === null || input.birthday > onDate) errors.birthday = 'Enter a valid birthday.';
      else if (age < MIN_AGE) errors.birthday = 'You must be ' + MIN_AGE + ' or older to use PassbookHub.';
      else if (age > 130) errors.birthday = 'Enter a valid birthday.';
    }

    if (!/^[A-Za-z0-9_]{3,20}$/.test(input.username)) {
      errors.username = 'Use 3 to 20 letters, numbers or underscores.';
    }

    const passwordError = validatePassword(input.password);
    if (passwordError) errors.password = passwordError;

    if (!validEmail(input.email)) errors.email = 'Enter a valid email address.';
    return errors;
  }

  function validatePassword(password) {
    if (!password || password.length < 8) return 'Use at least 8 characters.';
    if (password.length > 128) return 'Use 128 characters or fewer.';
    return null;
  }

  /** Creates the sign-in account, claims the username, saves the profile and sends a verification email. */
  async function createUser(input) {
    signUpInProgress = true;
    try {
      const taken = await F().getDoc(nameDoc(input.username)).catch(function (e) { throw friendly(e); });
      if (taken.exists()) throw new FieldError({ username: 'That username is taken.' });

      let credential;
      try {
        credential = await A().createUserWithEmailAndPassword(window.FB.auth, input.email, input.password);
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') throw new FieldError({ email: 'That email already has an account. Sign in instead.' });
        if (error.code === 'auth/invalid-email') throw new FieldError({ email: 'Enter a valid email address.' });
        throw friendly(error);
      }

      const uid = credential.user.uid;
      const profile = {
        name: input.name,
        birthday: input.birthday,
        username: input.username,
        profileDone: false,
        avatar: null,
        bio: '',
        currency: guessCurrency(),
        createdAt: Date.now()
      };
      try {
        const batch = F().writeBatch(window.FB.db);
        batch.set(nameDoc(input.username), { uid: uid });
        batch.set(userDoc(uid), profile);
        await batch.commit();
      } catch (error) {
        /* Someone claimed the username a moment earlier, or the network dropped. Undo the sign-in account. */
        await credential.user.delete().catch(function () {});
        if (error.code === 'permission-denied') throw new FieldError({ username: 'That username is taken.' });
        throw friendly(error);
      }

      await A().updateProfile(credential.user, { displayName: input.name }).catch(function () {});
      await sendVerification(credential.user).catch(function (e) { console.error(e); });
      await loadSession(credential.user);
    } finally {
      signUpInProgress = false;
    }
  }

  /* ---------- Google and Facebook ---------- */

  const SOCIAL = {
    google: { label: 'Google', make: function () { return new (A().GoogleAuthProvider)(); } },
    facebook: {
      label: 'Facebook',
      make: function () { const p = new (A().FacebookAuthProvider)(); p.addScope('email'); return p; }
    }
  };
  const PROVIDER_IDS = { 'google.com': 'google', 'facebook.com': 'facebook' };

  /** 'google', 'facebook' or null for the first social account linked to this sign-in. */
  function socialProvider(authUser) {
    const match = ((authUser && authUser.providerData) || []).find(function (p) { return PROVIDER_IDS[p.providerId]; });
    return match ? PROVIDER_IDS[match.providerId] : null;
  }

  function hasPassword(authUser) {
    return ((authUser && authUser.providerData) || []).some(function (p) { return p.providerId === 'password'; });
  }

  function accountEmail(authUser) {
    if (!authUser) return null;
    if (authUser.email) return authUser.email;
    const withEmail = (authUser.providerData || []).find(function (p) { return p.email; });
    return withEmail ? withEmail.email : null;
  }

  /** Turns a Google or Facebook sign-in error into a UserError, or null when the person just closed the window. */
  function socialError(error) {
    const code = (error && error.code) || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' || code === 'auth/user-cancelled') return null;
    const messages = {
      'auth/account-exists-with-different-credential': 'That email already has a PassbookHub account. Sign in the way you did before (email and password or Google).',
      'auth/operation-not-allowed': 'This sign-in option is not available yet. Use your email and password for now.',
      'auth/unauthorized-domain': 'This sign-in option is not available on this website yet. Use your email and password for now.',
      'auth/user-disabled': 'This account has been turned off.'
    };
    if (messages[code]) { console.error(error); return new UserError(messages[code]); }
    return friendly(error);
  }

  /** Opens Google or Facebook. The session listener redraws once the person is signed in. */
  async function socialSignIn(which) {
    const provider = SOCIAL[which].make();
    try {
      await A().signInWithPopup(window.FB.auth, provider);
    } catch (error) {
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/operation-not-supported-in-this-environment') {
        await A().signInWithRedirect(window.FB.auth, provider);
        return;
      }
      const friendlyError = socialError(error);
      if (friendlyError) throw friendlyError;
    }
  }

  /** Validates the extra details a Google or Facebook sign-up still needs. */
  function validateSocialProfile(input, onDate) {
    const errors = validateSignUp(Object.assign({}, input, { password: 'placeholder', email: 'x@x.xx' }), onDate);
    delete errors.password;
    delete errors.email;
    return errors;
  }

  /** Saves the profile for someone who signed in with Google or Facebook for the first time. */
  async function completeSocialProfile(input) {
    const authUser = window.FB.auth.currentUser;
    if (!authUser) throw new UserError('You are signed out. Sign in again.');
    if (!accountEmail(authUser)) {
      throw new UserError('Your ' + SOCIAL[socialProvider(authUser)].label + ' account has no email address. Sign up with your email instead.');
    }
    const taken = await F().getDoc(nameDoc(input.username)).catch(function (e) { throw friendly(e); });
    if (taken.exists()) throw new FieldError({ username: 'That username is taken.' });

    const profile = {
      name: input.name,
      birthday: input.birthday,
      username: input.username,
      profileDone: false,
      avatar: null,
      bio: '',
      currency: guessCurrency(),
      createdAt: Date.now()
    };
    try {
      const batch = F().writeBatch(window.FB.db);
      batch.set(nameDoc(input.username), { uid: authUser.uid });
      batch.set(userDoc(authUser.uid), profile);
      await batch.commit();
    } catch (error) {
      if (error.code === 'permission-denied') throw new FieldError({ username: 'That username is taken.' });
      throw friendly(error);
    }
    if (!authUser.displayName) await A().updateProfile(authUser, { displayName: input.name }).catch(function () {});
    /* Google emails come verified. Facebook ones usually do not, so they get the usual link. */
    if (!authUser.emailVerified) await sendVerification(authUser).catch(function (e) { console.error(e); });
    await loadSession(authUser);
  }

  /** Name to prefill when finishing a Google or Facebook sign-up. */
  function socialName() {
    const user = window.FB.auth.currentUser;
    return (user && user.displayName) || '';
  }

  function socialLabel(which) { return SOCIAL[which] ? SOCIAL[which].label : ''; }

  async function updateUser(id, changes) {
    try {
      await F().updateDoc(userDoc(id), changes);
    } catch (error) {
      throw friendly(error);
    }
    Object.assign(cache.profile, changes);
    return currentUser();
  }

  /** Removes a half-created account whose profile never saved, so the email can be used again. */
  async function discardOrphan() {
    const user = window.FB.auth.currentUser;
    if (user) await user.delete().catch(function () { return A().signOut(window.FB.auth); });
  }

  /** Deletes every transaction, the profile, the username and the sign-in account. Needs the password again,
      or a fresh Google or Facebook sign-in for accounts without a password. */
  async function deleteAccount(password) {
    const user = window.FB.auth.currentUser;
    try {
      if (hasPassword(user)) {
        await A().reauthenticateWithCredential(user, A().EmailAuthProvider.credential(user.email, password));
      } else {
        await A().reauthenticateWithPopup(user, SOCIAL[socialProvider(user)].make());
      }
    } catch (error) {
      if (!hasPassword(user)) {
        const friendlyError = socialError(error);
        throw friendlyError || new UserError('Account not deleted. Confirm with ' + SOCIAL[socialProvider(user)].label + ' to delete it.');
      }
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].indexOf(error.code) !== -1) {
        throw new FieldError({ password: 'That password is not correct.' });
      }
      throw friendly(error);
    }
    try {
      const uid = user.uid;
      if (window.SOC) await window.SOC.deleteEverything();
      const ids = cache.txs.map(function (t) { return t.id; });
      for (let i = 0; i < ids.length; i += 400) {
        const batch = F().writeBatch(window.FB.db);
        ids.slice(i, i + 400).forEach(function (id) { batch.delete(F().doc(txCol(uid), id)); });
        await batch.commit();
      }
      const batch = F().writeBatch(window.FB.db);
      if (cache.profile && cache.profile.username) batch.delete(nameDoc(cache.profile.username));
      batch.delete(userDoc(uid));
      await batch.commit();
      await user.delete();
    } catch (error) {
      throw friendly(error);
    }
  }

  /** Returns true when signed in. Wrong email or password returns false. */
  async function signIn(email, password) {
    try {
      await A().signInWithEmailAndPassword(window.FB.auth, email, password);
      return true;
    } catch (error) {
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/invalid-login-credentials'].indexOf(error.code) !== -1) return false;
      throw friendly(error);
    }
  }

  function signOut() { return A().signOut(window.FB.auth); }

  /* ---------- Verification and password reset emails ---------- */

  function lastEmailSent() {
    try { return +sessionStorage.getItem(RESEND_KEY) || 0; } catch (e) { return 0; }
  }

  function markEmailSent() {
    try { sessionStorage.setItem(RESEND_KEY, String(Date.now())); } catch (e) { /* cooldown just won't survive a reload */ }
  }

  async function sendVerification(authUser) {
    try {
      await A().sendEmailVerification(authUser || window.FB.auth.currentUser, actionSettings());
      markEmailSent();
    } catch (error) {
      throw friendly(error);
    }
  }

  /** Checks with the server whether the person has clicked the link in their email yet. */
  async function refreshVerified() {
    const user = window.FB.auth.currentUser;
    if (!user) return false;
    try { await user.reload(); } catch (error) { throw friendly(error); }
    cache.authUser = window.FB.auth.currentUser;
    if (user.emailVerified) await user.getIdToken(true).catch(function () {});
    return cache.authUser.emailVerified;
  }

  /** Sends a reset link. Says nothing about whether the email has an account. */
  async function sendPasswordReset(email) {
    try {
      await A().sendPasswordResetEmail(window.FB.auth, email, actionSettings());
      markEmailSent();
    } catch (error) {
      if (error.code === 'auth/user-not-found') return;
      if (error.code === 'auth/invalid-email') throw new FieldError({ email: 'Enter a valid email address.' });
      throw friendly(error);
    }
  }

  /* ---------- Transactions ---------- */

  function uid() { return cache.authUser.uid; }

  function stripId(tx) {
    const copy = Object.assign({}, tx);
    delete copy.id;
    return copy;
  }

  function listTx() { return cache.txs.slice(); }

  async function addTx(tx) {
    const ref = F().doc(txCol(uid()));
    const record = Object.assign({ createdAt: Date.now() }, tx, { id: ref.id });
    try { await F().setDoc(ref, stripId(record)); } catch (error) { throw friendly(error); }
    cache.txs.push(record);
    return record;
  }

  async function updateTx(id, changes) {
    const record = cache.txs.find(function (t) { return t.id === id; });
    if (!record) return null;
    try { await F().updateDoc(F().doc(txCol(uid()), id), changes); } catch (error) { throw friendly(error); }
    Object.assign(record, changes);
    return record;
  }

  async function deleteTx(id) {
    const index = cache.txs.findIndex(function (t) { return t.id === id; });
    if (index === -1) return null;
    try { await F().deleteDoc(F().doc(txCol(uid()), id)); } catch (error) { throw friendly(error); }
    return cache.txs.splice(index, 1)[0];
  }

  async function restoreTx(tx) {
    try { await F().setDoc(F().doc(txCol(uid()), tx.id), stripId(tx)); } catch (error) { throw friendly(error); }
    cache.txs.push(tx);
  }

  /** Newest first, using entry order to break ties within a day. */
  function monthTx(month) {
    return cache.txs.filter(function (t) { return monthOf(t.date) === month; }).sort(function (a, b) {
      return a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1);
    });
  }

  /** Works in integer cents. Savings takes the remainder so the three targets always sum to income. */
  function summarize(transactions) {
    const totals = { income: 0, needs: 0, wants: 0, savings: 0 };
    transactions.forEach(function (t) { totals[t.type] += t.cents; });
    const needsTarget = Math.round(totals.income * 0.5);
    const wantsTarget = Math.round(totals.income * 0.3);
    const targets = { needs: needsTarget, wants: wantsTarget, savings: totals.income - needsTarget - wantsTarget };
    const allocated = totals.needs + totals.wants + totals.savings;
    return {
      income: totals.income,
      allocated: allocated,
      left: totals.income - allocated,
      buckets: BUCKETS.map(function (bucket) {
        return Object.assign({}, bucket, { spent: totals[bucket.id], target: targets[bucket.id] });
      })
    };
  }

  /**
   * Describes a bucket's state. Needs and wants are limits, so staying under is
   * good. Savings is a goal, so reaching it is good and going over is never a problem.
   */
  function bucketStatus(bucket) {
    const spent = bucket.spent, target = bucket.target;
    const ratio = target > 0 ? spent / target : (spent > 0 ? Infinity : 0);
    if (bucket.id === 'savings') {
      if (target > 0 && spent >= target) return { state: 'good', ratio: ratio, kind: 'met', amount: spent - target };
      return { state: 'normal', ratio: ratio, kind: 'togo', amount: target - spent };
    }
    if (spent > target) return { state: 'critical', ratio: ratio, kind: 'over', amount: spent - target };
    if (target > 0 && ratio >= 0.9) return { state: 'warning', ratio: ratio, kind: 'near', amount: target - spent };
    return { state: 'normal', ratio: ratio, kind: 'left', amount: target - spent };
  }

  function formatMoney(cents, currency) {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency }).format(cents / 100);
  }

  /** Whole-account CSV. Cells that a spreadsheet would run as a formula are neutralised. */
  function toCsv(transactions) {
    function cell(value) {
      let text = String(value);
      if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }
    const rows = transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
    return ['Date,Category,Description,Amount'].concat(rows.map(function (t) {
      return [cell(t.date), cell(TYPE_LABELS[t.type]), cell(t.desc), (t.cents / 100).toFixed(2)].join(',');
    })).join('\r\n');
  }

  return {
    BUCKETS: BUCKETS, TYPE_LABELS: TYPE_LABELS, CURRENCIES: CURRENCIES, currencyLabel: currencyLabel, flagUrl: flagUrl,
    RESEND_COOLDOWN_MS: RESEND_COOLDOWN_MS, MIN_AGE: MIN_AGE,
    UserError: UserError, FieldError: FieldError,
    today: today, parseDate: parseDate, ageOn: ageOn, monthOf: monthOf, addMonths: addMonths,
    monthLabel: monthLabel, shortDate: shortDate, longDate: longDate, validEmail: validEmail,
    onSessionChange: onSessionChange, sessionState: sessionState, currentUser: currentUser, reloadSession: reloadSession,
    validateSignUp: validateSignUp, validatePassword: validatePassword,
    createUser: createUser, updateUser: updateUser, deleteAccount: deleteAccount, discardOrphan: discardOrphan,
    signIn: signIn, signOut: signOut,
    socialSignIn: socialSignIn, socialLabel: socialLabel, socialName: socialName, takeRedirectError: takeRedirectError,
    validateSocialProfile: validateSocialProfile, completeSocialProfile: completeSocialProfile,
    sendVerification: sendVerification, refreshVerified: refreshVerified, sendPasswordReset: sendPasswordReset, lastEmailSent: lastEmailSent,
    listTx: listTx, addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, restoreTx: restoreTx, monthTx: monthTx,
    summarize: summarize, bucketStatus: bucketStatus, formatMoney: formatMoney, toCsv: toCsv
  };
})();
