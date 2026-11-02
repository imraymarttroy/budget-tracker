/* Data, dates, password hashing and budget maths. No DOM code lives here. */
window.BT = (function () {
  'use strict';

  const KEYS = { users: 'bt.users', session: 'bt.session', codes: 'bt.codes', tx: 'bt.tx.' };
  const PBKDF2_ITERATIONS = 600000;
  const MIN_AGE = 13;
  const CODE_TTL_MS = 15 * 60 * 1000;
  const CODE_MAX_ATTEMPTS = 5;
  const RESEND_COOLDOWN_MS = 30 * 1000;

  const BUCKETS = [
    { id: 'needs', label: 'Needs', share: 50, hint: 'Rent, groceries, utilities, transport, minimum debt payments.' },
    { id: 'wants', label: 'Wants', share: 30, hint: 'Dining out, hobbies, shopping, subscriptions, travel.' },
    { id: 'savings', label: 'Savings', share: 20, hint: 'Emergency fund, investments, extra debt payments.' }
  ];
  const TYPE_LABELS = { income: 'Income', needs: 'Needs', wants: 'Wants', savings: 'Savings' };
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'PHP', 'CAD', 'AUD', 'NZD', 'SGD', 'JPY', 'KRW', 'CNY', 'HKD', 'INR', 'IDR', 'MYR', 'THB', 'VND', 'AED', 'SAR', 'ZAR', 'BRL', 'MXN', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN'];
  const REGION_CURRENCY = {
    US: 'USD', GB: 'GBP', PH: 'PHP', CA: 'CAD', AU: 'AUD', NZ: 'NZD', SG: 'SGD', JP: 'JPY', KR: 'KRW', CN: 'CNY',
    HK: 'HKD', IN: 'INR', ID: 'IDR', MY: 'MYR', TH: 'THB', VN: 'VND', AE: 'AED', SA: 'SAR', ZA: 'ZAR', BR: 'BRL',
    MX: 'MXN', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR',
    NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR', PT: 'EUR', FI: 'EUR', GR: 'EUR'
  };

  /** An error whose message is safe and useful to show to the person. */
  class UserError extends Error {}

  /* ---------- Storage ---------- */

  function read(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try { return JSON.parse(raw); } catch (e) { return fallback; }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new UserError('Your browser could not save this. Its storage may be full or turned off.');
    }
  }

  function storageAvailable() {
    try {
      localStorage.setItem('bt.check', '1');
      localStorage.removeItem('bt.check');
      return true;
    } catch (e) {
      return false;
    }
  }

  function makeId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(12)), function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
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
    return toLocalDate(month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function shortDate(value) {
    return toLocalDate(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function longDate(value) {
    return toLocalDate(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  /* ---------- Hashing ---------- */

  function toBase64(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
  }

  function fromBase64(text) {
    return Uint8Array.from(atob(text), function (c) { return c.charCodeAt(0); });
  }

  function cryptoAvailable() {
    return !!(window.crypto && crypto.subtle);
  }

  async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: iterations }, key, 256);
  }

  /** One-way, salted PBKDF2-SHA-256. The original password cannot be recovered from the result. */
  async function hashPassword(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const bits = await derive(password, salt, PBKDF2_ITERATIONS);
    return { algorithm: 'PBKDF2-SHA-256', iterations: PBKDF2_ITERATIONS, salt: toBase64(salt), hash: toBase64(bits) };
  }

  async function passwordMatches(password, record) {
    const bits = await derive(password, fromBase64(record.salt), record.iterations);
    return toBase64(bits) === record.hash;
  }

  async function sha256(text) {
    return toBase64(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  }

  /* ---------- Accounts ---------- */

  function allUsers() { return read(KEYS.users, {}); }

  function getUser(id) { return allUsers()[id] || null; }

  function findUser(identifier) {
    const value = (identifier || '').trim().toLowerCase().replace(/^@/, '');
    if (!value) return null;
    const users = allUsers();
    return Object.keys(users).map(function (id) { return users[id]; }).find(function (u) {
      return u.username.toLowerCase() === value || u.email === value;
    }) || null;
  }

  function usernameTaken(username) {
    const value = username.toLowerCase();
    const users = allUsers();
    return Object.keys(users).some(function (id) { return users[id].username.toLowerCase() === value; });
  }

  function emailTaken(email) {
    const users = allUsers();
    return Object.keys(users).some(function (id) { return users[id].email === email; });
  }

  function guessCurrency() {
    try {
      const region = new Intl.Locale(navigator.language).region;
      return REGION_CURRENCY[region] || 'USD';
    } catch (e) {
      return 'USD';
    }
  }

  /** Returns a map of field name to error message. Empty means valid. */
  function validateSignUp(input, onDate) {
    const errors = {};
    if (!input.name) errors.name = 'Enter your name.';
    else if (input.name.length > 60) errors.name = 'Use 60 characters or fewer.';

    if (!input.birthday) errors.birthday = 'Enter your birthday.';
    else {
      const age = ageOn(input.birthday, onDate);
      if (age === null || input.birthday > onDate) errors.birthday = 'Enter a valid birthday.';
      else if (age < MIN_AGE) errors.birthday = 'You must be ' + MIN_AGE + ' or older to use 50/30/20.';
      else if (age > 130) errors.birthday = 'Enter a valid birthday.';
    }

    if (!/^[A-Za-z0-9_]{3,20}$/.test(input.username)) {
      errors.username = 'Use 3 to 20 letters, numbers or underscores.';
    } else if (usernameTaken(input.username)) {
      errors.username = 'That username is taken.';
    }

    const passwordError = validatePassword(input.password);
    if (passwordError) errors.password = passwordError;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
      errors.email = 'Enter a valid email address.';
    } else if (emailTaken(input.email)) {
      errors.email = 'That email already has an account. Sign in instead.';
    }
    return errors;
  }

  function validatePassword(password) {
    if (!password || password.length < 8) return 'Use at least 8 characters.';
    if (password.length > 128) return 'Use 128 characters or fewer.';
    return null;
  }

  async function createUser(input) {
    const user = {
      id: makeId(),
      name: input.name,
      birthday: input.birthday,
      username: input.username,
      email: input.email,
      password: await hashPassword(input.password),
      verified: false,
      profileDone: false,
      avatar: null,
      bio: '',
      currency: guessCurrency(),
      createdAt: Date.now()
    };
    const users = allUsers();
    users[user.id] = user;
    write(KEYS.users, users);
    return user;
  }

  function updateUser(id, changes) {
    const users = allUsers();
    if (!users[id]) throw new UserError('This account no longer exists.');
    Object.assign(users[id], changes);
    write(KEYS.users, users);
    return users[id];
  }

  function deleteUser(id) {
    const users = allUsers();
    delete users[id];
    write(KEYS.users, users);
    const codes = read(KEYS.codes, {});
    delete codes[id + ':verify'];
    delete codes[id + ':reset'];
    write(KEYS.codes, codes);
    localStorage.removeItem(KEYS.tx + id);
    if (sessionUserId() === id) signOut();
  }

  function sessionUserId() { return read(KEYS.session, null); }

  function currentUser() {
    const id = sessionUserId();
    return id ? getUser(id) : null;
  }

  function signIn(id) { write(KEYS.session, id); }

  function signOut() { localStorage.removeItem(KEYS.session); }

  /** Returns the user when the credentials are correct, otherwise null. */
  async function checkCredentials(identifier, password) {
    const user = findUser(identifier);
    if (!user) return null;
    return (await passwordMatches(password, user.password)) ? user : null;
  }

  /* ---------- One-time email codes ---------- */

  function randomCode() {
    const limit = Math.floor(0xffffffff / 1000000) * 1000000;
    const buffer = new Uint32Array(1);
    do { crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return String(buffer[0] % 1000000).padStart(6, '0');
  }

  function codeRecord(userId, purpose) {
    return read(KEYS.codes, {})[userId + ':' + purpose] || null;
  }

  /** Creates a code and delivers it. Returns the plain code only in demo mode. */
  async function sendCode(user, purpose) {
    const code = randomCode();
    const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
    const codes = read(KEYS.codes, {});
    codes[user.id + ':' + purpose] = {
      salt: salt,
      hash: await sha256(salt + code),
      expires: Date.now() + CODE_TTL_MS,
      attempts: 0,
      sentAt: Date.now()
    };
    write(KEYS.codes, codes);

    const send = window.BudgetConfig && window.BudgetConfig.sendEmail;
    if (typeof send !== 'function') return { demo: true, code: code };

    const isReset = purpose === 'reset';
    try {
      await send({
        to: user.email,
        toName: user.name,
        purpose: purpose,
        code: code,
        subject: isReset ? 'Reset your PassbookHub password' : 'Verify your PassbookHub email',
        text: 'Your ' + (isReset ? 'password reset' : 'verification') + ' code is ' + code + '. It expires in 15 minutes.'
      });
    } catch (e) {
      console.error('Email delivery failed', e);
      throw new UserError('We could not send the email. Please try again.');
    }
    return { demo: false };
  }

  /** Returns "ok", "wrong", "expired", "locked" or "none". A code works once. */
  async function checkCode(userId, purpose, code) {
    const codes = read(KEYS.codes, {});
    const key = userId + ':' + purpose;
    const record = codes[key];
    if (!record) return 'none';
    if (Date.now() > record.expires) return 'expired';
    if (record.attempts >= CODE_MAX_ATTEMPTS) return 'locked';
    if ((await sha256(record.salt + code)) === record.hash) {
      delete codes[key];
      write(KEYS.codes, codes);
      return 'ok';
    }
    record.attempts += 1;
    write(KEYS.codes, codes);
    return record.attempts >= CODE_MAX_ATTEMPTS ? 'locked' : 'wrong';
  }

  function codeMessage(result) {
    return {
      wrong: 'That code is not correct.',
      expired: 'That code has expired. Request a new one.',
      locked: 'Too many incorrect tries. Request a new code.',
      none: 'That code is not correct. Request a new one if you need to.'
    }[result];
  }

  /** Sets a new password after a valid reset code. Reset codes also prove email ownership. */
  async function resetPassword(userId, password) {
    return updateUser(userId, { password: await hashPassword(password), verified: true });
  }

  /* ---------- Transactions ---------- */

  function listTx(userId) { return read(KEYS.tx + userId, []); }

  function addTx(userId, tx) {
    const list = listTx(userId);
    const record = Object.assign({ id: makeId(), createdAt: Date.now() }, tx);
    list.push(record);
    write(KEYS.tx + userId, list);
    return record;
  }

  function updateTx(userId, id, changes) {
    const list = listTx(userId);
    const record = list.find(function (t) { return t.id === id; });
    if (!record) return null;
    Object.assign(record, changes);
    write(KEYS.tx + userId, list);
    return record;
  }

  function deleteTx(userId, id) {
    const list = listTx(userId);
    const index = list.findIndex(function (t) { return t.id === id; });
    if (index === -1) return null;
    const removed = list.splice(index, 1)[0];
    write(KEYS.tx + userId, list);
    return removed;
  }

  function restoreTx(userId, tx) {
    const list = listTx(userId);
    list.push(tx);
    write(KEYS.tx + userId, list);
  }

  /** Newest first, using entry order to break ties within a day. */
  function monthTx(userId, month) {
    return listTx(userId).filter(function (t) { return monthOf(t.date) === month; }).sort(function (a, b) {
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
    KEYS: KEYS, BUCKETS: BUCKETS, TYPE_LABELS: TYPE_LABELS, CURRENCIES: CURRENCIES,
    RESEND_COOLDOWN_MS: RESEND_COOLDOWN_MS, MIN_AGE: MIN_AGE,
    UserError: UserError,
    storageAvailable: storageAvailable, cryptoAvailable: cryptoAvailable,
    today: today, parseDate: parseDate, ageOn: ageOn, monthOf: monthOf, addMonths: addMonths,
    monthLabel: monthLabel, shortDate: shortDate, longDate: longDate,
    findUser: findUser, getUser: getUser, validateSignUp: validateSignUp, validatePassword: validatePassword,
    createUser: createUser, updateUser: updateUser, deleteUser: deleteUser,
    currentUser: currentUser, signIn: signIn, signOut: signOut, checkCredentials: checkCredentials,
    codeRecord: codeRecord, sendCode: sendCode, checkCode: checkCode, codeMessage: codeMessage, resetPassword: resetPassword,
    listTx: listTx, addTx: addTx, updateTx: updateTx, deleteTx: deleteTx, restoreTx: restoreTx, monthTx: monthTx,
    summarize: summarize, bucketStatus: bucketStatus, formatMoney: formatMoney, toCsv: toCsv
  };
})();
