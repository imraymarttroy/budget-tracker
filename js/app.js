/* All screens and navigation. Personal data only ever reaches the page as text nodes. */
(function () {
  'use strict';

  const root = document.getElementById('app');
  const toastBox = document.getElementById('toast');
  const state = {
    view: null,
    month: BT.monthOf(BT.today()),
    filter: 'all',
    txType: 'needs',
    editingId: null,
    notice: null,
    resetEmail: null,
    refreshDashboard: null
  };
  let toastTimer = null;

  /* ---------- DOM helpers ---------- */

  function h(tag, attrs) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key.indexOf('on') === 0) node.addEventListener(key.slice(2), value);
      else if (key === 'class') node.className = value;
      else if (key === 'value' || key === 'checked') node[key] = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    for (let i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child === null || child === undefined || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(node, c); });
    else node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  const ICONS = {
    prev: '<path d="M12.5 4 6.5 10l6 6"/>',
    next: '<path d="m7.5 4 6 6-6 6"/>',
    edit: '<path d="M13.5 3.5 16.5 6.5 7 16H4v-3z"/>',
    remove: '<path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10"/>',
    check: '<circle cx="10" cy="10" r="7.5"/><path d="m6.5 10 2.5 2.5 4.5-5"/>',
    warning: '<path d="M10 3 18 17H2z"/><path d="M10 8.5v3.5M10 14.5v.01"/>',
    over: '<circle cx="10" cy="10" r="7.5"/><path d="m7 7 6 6M13 7l-6 6"/>',
    close: '<path d="m5 5 10 10M15 5 5 15"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
    eyeClosed: '<path d="M2.5 8c1.9 2.6 4.4 3.9 7.5 3.9s5.6-1.3 7.5-3.9"/><path d="m4.9 10.6-1.5 2M10 11.9v2.5M15.1 10.6l1.5 2"/>',
    search: '<circle cx="8.5" cy="8.5" r="5"/><path d="m12.5 12.5 4 4"/>',
    up: '<path d="m5 12.5 5-5 5 5"/>',
    down: '<path d="m5 7.5 5 5 5-5"/>',
    smile: '<circle cx="10" cy="10" r="7.5"/><path d="M7 11.5a3.5 3.5 0 0 0 6 0M7.5 8h.01M12.5 8h.01"/>',
    clip: '<path d="m15.5 9.5-5.8 5.8a3.5 3.5 0 0 1-5-5l6.4-6.4a2.3 2.3 0 0 1 3.3 3.3l-6.3 6.3a1.2 1.2 0 0 1-1.7-1.7l5.6-5.6"/>',
    image: '<rect x="3" y="4" width="14" height="12" rx="2"/><circle cx="7.5" cy="8.5" r="1.3"/><path d="m3.5 14.5 4-4 3 3 2-2 4 4"/>',
    video: '<rect x="2.5" y="5" width="11" height="10" rx="2"/><path d="m13.5 9 4-2.5v7l-4-2.5"/>',
    file: '<path d="M11.5 2.5H6a1.5 1.5 0 0 0-1.5 1.5v12A1.5 1.5 0 0 0 6 17.5h8a1.5 1.5 0 0 0 1.5-1.5V6.5z"/><path d="M11.5 2.5v4h4"/>',
    gallery: '<rect x="2.5" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="2.5" width="6.5" height="6.5" rx="1.2"/><rect x="2.5" y="11" width="6.5" height="6.5" rx="1.2"/><rect x="11" y="11" width="6.5" height="6.5" rx="1.2"/>',
    play: '<path d="M7 5v10l8-5z" fill="currentColor"/>',
    download: '<path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 16.5h12"/>',
    addPerson: '<circle cx="8" cy="7" r="3"/><path d="M2.5 16.5c.6-2.8 2.8-4.5 5.5-4.5s4.9 1.7 5.5 4.5M15.5 5.5v5M13 8h5"/>',
    profile: '<circle cx="10" cy="7" r="3.25"/><path d="M3.5 17c.8-3 3.4-4.75 6.5-4.75s5.7 1.75 6.5 4.75"/>',
    pending: '<circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l2.5 2"/>',
    minimize: '<path d="M5 10h10"/>',
    pin: '<path d="M12.5 2.5 17.5 7.5 15 8.5 11.5 12 11 16 4 9l4-.5L11.5 5z"/><path d="m7.5 12.5-4 4"/>'
  };

  /* Icon markup comes only from the constant table above. */
  function icon(name) {
    const holder = document.createElement('span');
    holder.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
    return holder.firstChild;
  }

  function toast(message, action) {
    clearTimeout(toastTimer);
    toastBox.replaceChildren(h('span', null, message));
    if (action) {
      toastBox.appendChild(h('button', {
        type: 'button',
        onclick: function () { toastBox.hidden = true; action.run(); }
      }, action.label));
    }
    toastBox.hidden = false;
    toastTimer = setTimeout(function () { toastBox.hidden = true; }, 8000);
  }

  function field(options) {
    const id = 'f-' + options.name;
    const hintId = options.hint ? id + '-hint' : null;
    const errorId = id + '-error';
    const control = options.control || h(options.multiline ? 'textarea' : 'input', Object.assign({
      id: id,
      name: options.name,
      type: options.multiline ? null : (options.type || 'text'),
      'aria-describedby': hintId
    }, options.attrs));

    let inner = control;
    if (options.type === 'password') {
      const toggle = h('button', {
        type: 'button',
        'aria-pressed': 'false',
        'aria-label': 'Show password',
        onclick: function () {
          const showing = control.type === 'text';
          control.type = showing ? 'password' : 'text';
          toggle.replaceChildren(icon(showing ? 'eyeClosed' : 'eye'));
          toggle.setAttribute('aria-pressed', String(!showing));
          toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
          toggle.title = showing ? 'Show password' : 'Hide password';
        }
      }, icon('eyeClosed'));
      toggle.title = 'Show password';
      inner = h('div', { class: 'with-toggle' }, control, toggle);
    }

    control.addEventListener('input', function () { clearFieldError(control); });
    return h('div', { class: 'field ' + (options.wrapClass || '') },
      h('label', { for: id }, options.label),
      inner,
      options.after || null,
      options.hint ? h('p', { class: 'hint', id: hintId }, options.hint) : null,
      h('p', { class: 'error', id: errorId, hidden: true }));
  }

  function errorNodeFor(control) { return document.getElementById(control.id + '-error'); }

  function clearFieldError(control) {
    const node = errorNodeFor(control);
    if (node) node.hidden = true;
    control.removeAttribute('aria-invalid');
    const described = (control.getAttribute('aria-describedby') || '').replace(control.id + '-error', '').trim();
    if (described) control.setAttribute('aria-describedby', described);
    else control.removeAttribute('aria-describedby');
  }

  function clearErrors(form) {
    Array.from(form.elements).forEach(function (el) { if (el.id) clearFieldError(el); });
    const summary = form.querySelector('.form-error');
    if (summary) summary.hidden = true;
  }

  function showErrors(form, errors) {
    clearErrors(form);
    let first = null;
    Object.keys(errors).forEach(function (name) {
      if (name === '_form') return;
      const control = form.elements[name];
      const node = errorNodeFor(control);
      node.textContent = errors[name];
      node.hidden = false;
      control.setAttribute('aria-invalid', 'true');
      control.setAttribute('aria-describedby', ((control.getAttribute('aria-describedby') || '') + ' ' + node.id).trim());
      if (!first) first = control;
      if (form.classList.contains('shake-errors')) shake(control.closest('.with-toggle') || control);
    });
    if (errors._form) {
      const summary = form.querySelector('.form-error');
      summary.textContent = errors._form;
      summary.hidden = false;
    }
    if (first) first.focus();
  }

  /** Wiggles a field side to side so a wrong entry is easy to spot. */
  function shake(node) {
    node.classList.remove('shake');
    void node.offsetWidth; /* restart the animation if it is already running */
    node.classList.add('shake');
    node.addEventListener('animationend', function () { node.classList.remove('shake'); }, { once: true });
  }

  function formError() {
    return h('p', { class: 'form-error', role: 'alert', hidden: true });
  }

  /** Runs a form action with its submit button busy. Double submits are ignored. */
  async function busy(form, label, action) {
    const button = form.querySelector('[type="submit"]');
    if (button.disabled) return;
    const original = button.textContent;
    clearErrors(form);
    button.disabled = true;
    button.textContent = label;
    try {
      await action();
    } catch (error) {
      if (!(error instanceof BT.UserError)) console.error(error);
      if (error instanceof BT.FieldError && form.isConnected &&
          Object.keys(error.fields).every(function (name) { return form.elements[name]; })) {
        showErrors(form, error.fields);
      } else if (form.isConnected) {
        showErrors(form, { _form: error instanceof BT.UserError ? error.message : 'Something went wrong. Please try again.' });
      } else {
        toast(error instanceof BT.UserError ? error.message : 'Something went wrong. Please try again.');
      }
    } finally {
      if (button.isConnected) {
        button.disabled = false;
        button.textContent = original;
      }
    }
  }

  function avatar(user, picture, size) {
    const style = '--size:' + size + 'rem';
    if (picture && picture.indexOf('data:image/jpeg;base64,') === 0) {
      return h('img', { class: 'avatar', src: picture, alt: '', style: style });
    }
    const letters = user.name.trim().split(/\s+/).slice(0, 2).map(function (word) {
      return Array.from(word)[0];
    }).join('').toUpperCase();
    return h('span', { class: 'avatar', style: style + ';font-size:' + (size * 0.38) + 'rem', 'aria-hidden': 'true' }, letters);
  }

  /* ---------- Routing ---------- */

  function resolveView() {
    const wanted = location.hash.slice(1);
    const session = BT.sessionState();
    if (session === 'error') return 'offline';
    if (session === 'orphan') return 'orphan';
    if (session === 'complete') return 'complete';
    const user = BT.currentUser();
    if (!user) return ['signin', 'signup', 'forgot'].indexOf(wanted) !== -1 ? wanted : 'signin';
    if (!user.verified) return 'verify';
    if (!user.profileDone) return 'setup';
    if (/^u\/[A-Za-z0-9_]{3,20}$/.test(wanted)) return 'person';
    if (/^chat\/[A-Za-z0-9_]{3,20}$/.test(wanted)) return 'chat';
    if (/^d\/[A-Za-z0-9_]{3,20}$/.test(wanted)) return 'shared';
    if (wanted === 'messages') return 'chat';
    if (wanted === 'notifications') return 'alerts';
    return ['feed', 'profile', 'circle', 'alerts', 'settings'].indexOf(wanted) !== -1 ? wanted : 'dashboard';
  }

  /* Views that show the sidebar. Only the signed-in owner of the account ever sees it. */
  const SHELL_VIEWS = ['dashboard', 'shared', 'feed', 'profile', 'person', 'circle', 'alerts', 'settings'];

  const VIEWS = {
    signin: { title: 'Sign in', render: viewAuth },
    signup: { title: 'Sign up', render: viewAuth },
    forgot: { title: 'Reset password', render: viewForgot },
    verify: { title: 'Verify your email', render: viewVerify },
    setup: { title: 'Set up your profile', render: viewSetup },
    dashboard: { title: 'Dashboard', render: viewDashboard },
    feed: { title: 'Feed', render: viewFeed },
    profile: { title: 'Profile', render: viewTimeline },
    person: { title: 'Profile', render: viewPerson },
    shared: { title: 'Dashboard', render: viewShared },
    circle: { title: 'Circle', render: viewCircle },
    alerts: { title: 'Alerts', render: viewNotifications },
    settings: { title: 'Settings', render: viewSettings },
    offline: { title: 'Could not load', render: viewOffline },
    orphan: { title: 'Finish signing up', render: viewOrphan },
    complete: { title: 'Finish signing up', render: viewComplete }
  };

  function render() {
    let view = resolveView();
    if (view === 'chat') {
      /* Messages live only in the floating chat now: #messages opens the picker, #chat/username opens that person. */
      const username = location.hash.indexOf('#chat/') === 0 ? location.hash.slice(6) : null;
      const back = SHELL_VIEWS.indexOf(state.view) !== -1 && state.view !== 'person' && state.view !== 'shared' ? state.view : 'dashboard';
      history.replaceState(null, '', '#' + back);
      view = back;
      setTimeout(function () { if (username) dock.open(username); else dock.openPicker(); }, 0);
    }
    if (!BT.currentUser() && socialFor) { socialFor = null; SOC.stopWatching(); SOC.stopWatchingChats(); SOC.stopWatchingTrust(); }
    if (state.cleanup) { state.cleanup(); state.cleanup = null; }
    state.onTrustChange = null;
    if (view === 'person' || view === 'shared') {
      /* keep #u/username and #d/username as they are */
    } else if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    const changed = view !== state.view;
    state.view = view;
    state.refreshDashboard = null;
    document.title = (view === 'signin' || view === 'signup') ? 'PassbookHub' : VIEWS[view].title + ' · PassbookHub';
    document.body.classList.toggle('auth-body', view === 'signin' || view === 'signup');
    const content = VIEWS[view].render(view);
    if (SHELL_VIEWS.indexOf(view) !== -1) {
      startSocial();
      root.replaceChildren(shell(view, content));
    } else {
      root.replaceChildren(content);
    }
    dock.sync(SHELL_VIEWS.indexOf(view) !== -1);
    if (changed) {
      window.scrollTo(0, 0);
      const heading = root.querySelector('h1');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
      }
    }
  }

  /* ---------- Sign in and sign up ---------- */

  function viewAuth(view) {
    const notice = state.notice;
    state.notice = null;
    const redirectError = BT.takeRedirectError();
    const signin = view === 'signin';
    return h('div', { class: 'auth-page' },
      authHero(signin),
      h('div', { class: 'auth-panel' },
        h('div', { class: 'auth-main' },
          h('span', { class: 'auth-wordmark auth-wordmark-mobile' }, logoMark('auth-wordmark-mark'), 'PassbookHub'),
          h('h1', { class: 'auth-title' }, signin ? 'Welcome back' : 'Join PassbookHub'),
          notice ? h('p', { class: 'notice', role: 'status' }, notice) : null,
          signin ? signInForm() : signUpForm(),
          h('p', { class: 'auth-switch' }, signin
            ? ['Don\u2019t have an account? ', h('a', { href: '#signup' }, 'Sign up')]
            : ['Already have an account? ', h('a', { href: '#signin' }, 'Log in')]),
          h('p', { class: 'or-divider' }, h('span', null, 'Or')),
          socialButtons(view, redirectError)),
        h('footer', { class: 'auth-footer' },
          h('span', null, '\u00a9 ' + new Date().getFullYear() + ' PassbookHub'),
          h('span', null, 'Half for needs, some for wants, the rest for later.'),
          languageButton())));
  }

  /* ---------- Language picker (sign in / sign up footer) ---------- */

  function languageButton() {
    return h('button', { type: 'button', class: 'lang-btn', 'aria-haspopup': 'dialog', onclick: function (event) { openLanguagePicker(event.currentTarget); } },
      'Language', icon('up'));
  }

  function openLanguagePicker(opener) {
    const current = I18N.name;
    const options = I18N.languages.map(function (name) {
      const selected = name === current;
      return h('button', {
        type: 'button', class: 'lang-option' + (selected ? ' selected' : ''), 'aria-pressed': String(selected), 'data-no-translate': '',
        onclick: function () {
          if (name === current) return close();
          I18N.set(name);
          location.reload();
        }
      }, name, selected ? h('span', { class: 'lang-check', 'aria-hidden': 'true' }, '\u2713') : null);
    });
    const closeBtn = h('button', { type: 'button', class: 'lang-close', 'aria-label': 'Close', onclick: function () { close(); } }, icon('close'));
    const card = h('div', { class: 'lang-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'lang-title' },
      h('div', { class: 'lang-head' }, h('h2', { id: 'lang-title' }, 'Select your language'), closeBtn),
      h('div', { class: 'lang-options' }, options));
    const overlay = h('div', { class: 'lang-overlay' }, card);
    function onKey(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const items = card.querySelectorAll('button');
        const first = items[0], last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    function close() {
      document.removeEventListener('keydown', onKey, true);
      document.body.classList.remove('lang-open');
      overlay.remove();
      if (opener && opener.isConnected) opener.focus();
    }
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('lang-open');
    document.body.appendChild(overlay);
    (card.querySelector('.lang-option.selected') || closeBtn).focus();
  }


  /** The brand-red panel beside the form: headline plus three cards (signup steps, or the 50/30/20 split). */
  function authHero(signin) {
    const cards = signin
      ? [['50%', 'Needs: rent, bills and groceries'], ['30%', 'Wants: the fun stuff, guilt-free'], ['20%', 'Savings: future you says thanks']]
      : [['1', 'Create your account'], ['2', 'Verify your email'], ['3', 'Set up your profile']];
    return h('aside', { class: 'auth-hero', 'aria-hidden': 'true' },
      h('div', { class: 'auth-glow' }, h('span'), h('span')),
      h('span', { class: 'auth-wordmark' }, logoMark('auth-wordmark-mark'), 'PassbookHub'),
      h('div', { class: 'auth-hero-copy' },
        h('span', { class: 'auth-pill' }, signin ? 'Good to see you again \u{1F44B}' : 'Budget the simple way \u2728'),
        h('p', { class: 'auth-hero-title' }, signin ? 'Pick up where you left off' : 'Start your budget'),
        h('p', { class: 'auth-hero-sub' }, signin
          ? 'Your daily feed for financial freedom.'
          : 'Follow these simple steps to set up your account.')),
      h('ol', { class: 'auth-steps' + (signin ? ' split' : '') },
        cards.map(function (card, i) {
          return h('li', null,
            h('span', { class: 'auth-step-num' }, card[0]),
            h('span', { class: 'auth-step-text' }, card[1]));
        })));
  }

  /* The PassbookHub mark (the same three lines as the favicon). Markup is a constant. */
  function logoMark(className) {
    const holder = document.createElement('span');
    holder.className = className;
    holder.innerHTML = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true">' +
      '<rect class="m-box" x="1" y="1" width="30" height="30" rx="7"/>' +
      '<rect class="m-inner" x="2.6" y="2.6" width="26.8" height="26.8" rx="5.6"/>' +
      '<path class="m-line" d="M7 22h18M7 16h11M7 10h7" stroke-linecap="round"/>' +
      '<path class="m-cut" d="M7 22h18M7 16h11M7 10h7" stroke-linecap="round"/></svg>';
    return holder;
  }

  const SOCIAL_ICONS = {
    google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.8 3.6-4.9 6.7-4.9z"/></svg>'
  };

  /** "Continue with Google". Icon markup comes only from the table above. */
  function socialButtons(view, initialError) {
    const status = h('p', { class: 'form-error', role: 'alert', hidden: !initialError }, initialError || '');
    const buttons = ['google'].map(function (which) {
      const logo = h('span', { class: 'social-logo' });
      logo.innerHTML = SOCIAL_ICONS[which];
      const label = 'Continue with ' + BT.socialLabel(which);
      return h('button', {
        type: 'button',
        class: 'btn full social-btn',
        onclick: async function (event) {
          const button = event.currentTarget;
          const all = box.querySelectorAll('button');
          all.forEach(function (b) { b.disabled = true; });
          status.hidden = true;
          button.querySelector('.social-label').textContent = 'Opening ' + BT.socialLabel(which) + '…';
          try {
            await BT.socialSignIn(which);
            /* On success the session listener loads the account and redraws. */
          } catch (error) {
            status.textContent = error instanceof BT.UserError ? error.message : 'Something went wrong. Please try again.';
            status.hidden = false;
          } finally {
            if (button.isConnected) {
              all.forEach(function (b) { b.disabled = false; });
              button.querySelector('.social-label').textContent = label;
            }
          }
        }
      }, logo, h('span', { class: 'social-label' }, label), h('span', { class: 'social-chevron', 'aria-hidden': 'true' }, '\u203a'));
    });
    const box = h('div', { class: 'stack' }, buttons, status);
    return box;
  }

  function signInForm() {
    const form = h('form', {
      class: 'stack shake-errors',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const login = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const errors = {};
        if (!login) errors.email = 'Enter your email or username.';
        if (!password) errors.password = 'Enter your password.';
        if (Object.keys(errors).length) return showErrors(form, errors);
        busy(form, 'Signing in…', async function () {
          try {
            await BT.signIn(login, password);
          } catch (error) {
            if (error instanceof BT.FieldError && error.fields.password) form.elements.password.value = '';
            throw error;
          }
          /* On success the session listener loads the account and redraws. */
        });
      }
    },
      field({ name: 'email', label: 'Email or username', attrs: { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', placeholder: 'you@example.com or juandc' } }),
      field({ name: 'password', label: 'Password', type: 'password', attrs: { autocomplete: 'current-password', placeholder: 'Your password' } }),
      h('p', { class: 'small auth-forgot' }, h('a', { href: '#forgot' }, 'Forgot password?')),
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Continue'));
    return form;
  }

  function signUpForm() {
    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const input = {
          name: form.elements.name.value.trim().replace(/\s+/g, ' '),
          birthday: form.elements.birthday.value,
          username: form.elements.username.value.trim(),
          password: form.elements.password.value,
          email: form.elements.email.value.trim().toLowerCase()
        };
        const errors = BT.validateSignUp(input, BT.today());
        if (Object.keys(errors).length) return showErrors(form, errors);
        busy(form, 'Creating account…', async function () {
          await BT.createUser(input);
          render();
        });
      }
    },
      field({ name: 'email', label: 'Email', type: 'email', hint: 'We use this to verify your account.', attrs: { autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'you@example.com' } }),
      h('div', { class: 'field-row' },
        field({ name: 'name', label: 'Full name', attrs: { autocomplete: 'name', maxlength: 60, placeholder: 'Juan Dela Cruz' } }),
        field({ name: 'username', label: 'Username', attrs: { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20, placeholder: 'juandc' } })),
      field({ name: 'birthday', label: 'Birthday', type: 'date', hint: 'You must be ' + BT.MIN_AGE + ' or older.', attrs: { autocomplete: 'bday', max: BT.today() } }),
      field({ name: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters.', attrs: { autocomplete: 'new-password', maxlength: 128, placeholder: 'Create a password' } }),
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Continue'));
    return form;
  }

  /* ---------- Emails ---------- */

  /** A button that sends an email, then waits out a cooldown counted from the last email sent. */
  function cooldownButton(label, send) {
    const button = h('button', { type: 'button', class: 'link flush' }, label);
    let timer = null;

    function tick() {
      if (!button.isConnected && timer) { clearInterval(timer); timer = null; return; }
      const wait = BT.lastEmailSent() + BT.RESEND_COOLDOWN_MS - Date.now();
      if (wait > 0) {
        button.disabled = true;
        button.textContent = label + ' in ' + Math.ceil(wait / 1000) + 's';
        if (!timer) timer = setInterval(tick, 1000);
      } else {
        button.disabled = false;
        button.textContent = label;
        if (timer) { clearInterval(timer); timer = null; }
      }
    }

    button.addEventListener('click', async function () {
      button.disabled = true;
      try {
        await send();
      } catch (error) {
        toast(error instanceof BT.UserError ? error.message : 'We could not send the email. Please try again.');
      }
      tick();
    });
    tick();
    return button;
  }

  function viewVerify() {
    const user = BT.currentUser();
    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        busy(form, 'Checking…', async function () {
          const verified = await BT.refreshVerified();
          if (!verified) {
            showErrors(form, { _form: 'Your email is not verified yet. Open the link in the email we sent, then try again.' });
            return;
          }
          toast('Email verified.');
          render();
        });
      }
    },
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'I have verified my email'));

    const resend = cooldownButton('Send the link again', async function () {
      await BT.sendVerification();
      toast('Verification email sent.');
    });

    /* Coming back to this tab after clicking the link checks again on its own. */
    function onFocus() {
      if (!form.isConnected) { window.removeEventListener('focus', onFocus); return; }
      BT.refreshVerified().then(function (verified) { if (verified && form.isConnected) render(); }).catch(function () {});
    }
    window.addEventListener('focus', onFocus);

    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' },
        h('h1', null, 'Verify your email'),
        h('p', { class: 'muted' }, 'We sent a link to ' + user.email + '. Open it to verify your account, then come back here. Check your spam folder if you do not see it.')),
      form,
      h('div', { class: 'stack small', style: 'margin-top:1.25rem' },
        h('p', null, resend),
        h('p', null, h('button', {
          type: 'button',
          class: 'link flush',
          onclick: function () { BT.signOut(); }
        }, 'Use a different account'))));
  }

  /* ---------- Forgot password ---------- */

  function viewForgot() {
    const content = h('div');
    const header = h('p', { class: 'muted' });

    function showRequest() {
      header.textContent = 'Passwords are stored encrypted, so we cannot show you your old one. We can email you a link to set a new one.';
      const form = h('form', {
        class: 'stack',
        novalidate: true,
        onsubmit: function (event) {
          event.preventDefault();
          const email = form.elements.email.value.trim().toLowerCase();
          if (!BT.validEmail(email)) return showErrors(form, { email: 'Enter a valid email address.' });
          busy(form, 'Sending…', async function () {
            await BT.sendPasswordReset(email);
            state.resetEmail = email;
            showSent();
          });
        }
      },
        field({ name: 'email', label: 'Email', type: 'email', attrs: { autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false' } }),
        formError(),
        h('button', { class: 'btn primary full', type: 'submit' }, 'Send reset link'));
      content.replaceChildren(form);
    }

    function showSent() {
      const email = state.resetEmail;
      header.textContent = 'If ' + email + ' has an account, a reset link is on its way. Open it to choose a new password, then sign in. Check your spam folder if you do not see it.';
      const again = cooldownButton('Send the link again', async function () {
        await BT.sendPasswordReset(email);
        toast('Reset email sent.');
      });
      content.replaceChildren(h('div', { class: 'stack small' },
        h('p', null, again),
        h('p', null, h('button', { type: 'button', class: 'link flush', onclick: function () { state.resetEmail = null; showRequest(); } }, 'Use a different email'))));
    }

    if (state.resetEmail) showSent();
    else showRequest();

    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' }, h('h1', null, 'Reset your password'), header),
      content,
      h('p', { class: 'small', style: 'margin-top:1rem' },
        h('a', { href: '#signin', onclick: function () { state.resetEmail = null; } }, 'Back to sign in')));
  }

  /* ---------- Problems loading an account ---------- */

  function viewOffline() {
    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' },
        h('h1', null, 'We could not load your account'),
        h('p', { class: 'muted' }, 'Check your internet connection, then try again.')),
      h('div', { class: 'row' },
        h('button', {
          type: 'button',
          class: 'btn primary',
          onclick: async function (event) {
            event.currentTarget.disabled = true;
            await BT.reloadSession();
            render();
          }
        }, 'Try again'),
        h('button', { type: 'button', class: 'link', onclick: function () { BT.signOut(); } }, 'Sign out')));
  }

  function viewOrphan() {
    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' },
        h('h1', null, 'Your sign-up did not finish'),
        h('p', { class: 'muted' }, 'Your account was created but your profile was not saved. Start over to sign up again with the same email.')),
      h('button', {
        type: 'button',
        class: 'btn primary',
        onclick: async function (event) {
          event.currentTarget.disabled = true;
          await BT.discardOrphan();
          location.hash = '#signup';
        }
      }, 'Start over'));
  }

  /** First Google or Facebook sign-in: ask for what PassbookHub needs that those accounts do not give us. */
  function viewComplete() {
    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const input = {
          name: form.elements.name.value.trim().replace(/\s+/g, ' '),
          birthday: form.elements.birthday.value,
          username: form.elements.username.value.trim()
        };
        const errors = BT.validateSocialProfile(input, BT.today());
        if (Object.keys(errors).length) return showErrors(form, errors);
        busy(form, 'Creating account…', async function () {
          await BT.completeSocialProfile(input);
          render();
        });
      }
    },
      field({ name: 'name', label: 'Name', hint: 'This becomes your profile name.', attrs: { autocomplete: 'name', maxlength: 60, value: BT.socialName().slice(0, 60) } }),
      field({ name: 'birthday', label: 'Birthday', type: 'date', hint: 'You must be ' + BT.MIN_AGE + ' or older.', attrs: { autocomplete: 'bday', max: BT.today() } }),
      field({ name: 'username', label: 'Username', attrs: { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20 } }),
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Create account'));

    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' },
        h('h1', null, 'Almost done'),
        h('p', { class: 'muted' }, 'Pick a username and add your birthday to finish creating your PassbookHub account.')),
      form,
      h('p', { class: 'small', style: 'margin-top:1rem' }, h('button', {
        type: 'button',
        class: 'link flush',
        onclick: async function (event) {
          event.currentTarget.disabled = true;
          await BT.discardOrphan();
          location.hash = '#signin';
        }
      }, 'Cancel and go back')));
  }

  /* ---------- Profile picture and bio ---------- */

  /** Center-crops to a small square so a large photo cannot fill the browser's storage. */
  async function toAvatarData(file) {
    if (file.type.indexOf('image/') !== 0) throw new BT.UserError('Choose an image file.');
    if (file.size > 20 * 1024 * 1024) throw new BT.UserError('Choose an image under 20 MB.');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const side = Math.min(image.naturalWidth, image.naturalHeight);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 256, 256);
      context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (error) {
      throw new BT.UserError('We could not read that image. Try a JPG or PNG.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** The picture and bio controls shared by first-time setup and the profile page. */
  function profileFields(user, nameForAvatar) {
    const BIO_MAX = 160;
    const data = { picture: user.avatar };
    const preview = h('div');
    const error = h('p', { class: 'error small', role: 'alert', hidden: true, style: 'color:var(--critical-ink);margin-top:0.5rem' });
    const removeButton = h('button', {
      type: 'button',
      class: 'link',
      onclick: function () { data.picture = null; drawPicture(); }
    }, 'Remove');
    const fileInput = h('input', {
      type: 'file',
      accept: 'image/*',
      class: 'vh',
      onchange: async function () {
        const file = fileInput.files[0];
        fileInput.value = '';
        if (!file) return;
        error.hidden = true;
        try {
          data.picture = await toAvatarData(file);
          drawPicture();
        } catch (e) {
          error.textContent = e instanceof BT.UserError ? e.message : 'We could not read that image. Try a JPG or PNG.';
          error.hidden = false;
        }
      }
    });

    function drawPicture() {
      preview.replaceChildren(avatar({ name: nameForAvatar() }, data.picture, 5.5));
      removeButton.hidden = !data.picture;
    }
    drawPicture();

    const counter = h('span', { class: 'num' });
    const bioField = field({
      name: 'bio',
      label: 'Bio',
      multiline: true,
      attrs: { maxlength: BIO_MAX, rows: 3, placeholder: 'A line or two about you and your money goals.' },
      hint: counter
    });
    const bio = bioField.querySelector('textarea');
    bio.value = user.bio || '';
    function count() { counter.textContent = bio.value.length + ' of ' + BIO_MAX + ' characters'; }
    bio.addEventListener('input', count);
    count();

    return {
      data: data,
      redraw: drawPicture,
      picker: h('div', null,
        h('span', { class: 'field-label' }, 'Profile picture'),
        h('div', { class: 'avatar-picker' },
          preview,
          h('div', { class: 'row' },
            h('label', { class: 'btn' }, 'Choose photo', fileInput),
            removeButton)),
        error),
      bioField: bioField,
      bio: bio
    };
  }

  function viewSetup() {
    const user = BT.currentUser();
    const fields = profileFields(user, function () { return user.name; });
    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        busy(form, 'Saving…', async function () {
          await BT.updateUser(user.id, { avatar: fields.data.picture, bio: fields.bio.value.trim(), profileDone: true });
          await SOC.syncProfile(BT.currentUser()).catch(function (e) { console.error(e); });
          render();
        });
      }
    },
      fields.picker,
      fields.bioField,
      formError(),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'submit' }, 'Continue'),
        h('button', {
          type: 'button',
          class: 'link',
          onclick: async function () {
            try {
              await BT.updateUser(user.id, { profileDone: true });
              render();
            } catch (error) {
              showErrors(form, { _form: error.message });
            }
          }
        }, 'Skip for now')));

    return h('div', { class: 'narrow' },
      h('span', { class: 'brand step-brand' }, 'PassbookHub'),
      h('header', { class: 'intro' },
        h('h1', null, 'Welcome, ' + user.name),
        h('p', { class: 'muted' }, 'Add a picture and a short bio. You can change these at any time.')),
      form);
  }

  function flagImage(code) {
    return h('img', { class: 'flag', src: BT.flagUrl(code), alt: '', width: 24, height: 18, loading: 'lazy' });
  }

  /** A currency dropdown that shows each country's flag. Works with mouse, touch and keyboard. */
  function currencyPicker(id, initial) {
    let value = initial;
    let active = Math.max(0, BT.CURRENCIES.indexOf(initial));
    const listId = id + '-list';
    const face = h('span', { class: 'currency-face' });
    const button = h('button', {
      type: 'button',
      id: id,
      class: 'currency-button',
      'aria-haspopup': 'listbox',
      'aria-expanded': 'false',
      'aria-controls': listId
    }, face, h('span', { class: 'chevron', 'aria-hidden': 'true' }, '▾'));

    const options = BT.CURRENCIES.map(function (code, index) {
      return h('li', {
        role: 'option',
        id: listId + '-' + code,
        class: 'currency-option',
        'data-code': code,
        onmousedown: function (event) { event.preventDefault(); },
        onclick: function () { choose(index); close(true); },
        onmousemove: function () { highlight(index); }
      }, flagImage(code), h('span', null, BT.currencyLabel(code)));
    });
    const list = h('ul', { id: listId, role: 'listbox', class: 'currency-list', tabindex: '-1', 'aria-label': 'Currency', hidden: true }, options);

    function drawFace() {
      face.replaceChildren(flagImage(value), h('span', null, BT.currencyLabel(value)));
      options.forEach(function (option) { option.setAttribute('aria-selected', String(option.dataset.code === value)); });
    }

    function highlight(index) {
      active = Math.max(0, Math.min(options.length - 1, index));
      options.forEach(function (option, i) { option.classList.toggle('active', i === active); });
      list.setAttribute('aria-activedescendant', options[active].id);
      options[active].scrollIntoView({ block: 'nearest' });
    }

    function choose(index) {
      value = BT.CURRENCIES[index];
      drawFace();
    }

    function open() {
      list.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      highlight(BT.CURRENCIES.indexOf(value));
      list.focus();
      document.addEventListener('mousedown', outside);
    }

    function close(returnFocus) {
      list.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      document.removeEventListener('mousedown', outside);
      if (returnFocus) button.focus();
    }

    function outside(event) {
      if (!list.contains(event.target) && !button.contains(event.target)) close(false);
    }

    let typed = '', typedTimer = null;
    list.addEventListener('keydown', function (event) {
      const keys = { ArrowDown: active + 1, ArrowUp: active - 1, Home: 0, End: options.length - 1, PageDown: active + 6, PageUp: active - 6 };
      if (event.key in keys) { event.preventDefault(); highlight(keys[event.key]); return; }
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(active); close(true); return; }
      if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
      if (event.key === 'Tab') { close(false); return; }
      if (event.key.length === 1 && /\S/.test(event.key)) {
        typed += event.key.toLowerCase();
        clearTimeout(typedTimer);
        typedTimer = setTimeout(function () { typed = ''; }, 700);
        const match = BT.CURRENCIES.findIndex(function (code) {
          return code.toLowerCase().indexOf(typed) === 0 || BT.currencyLabel(code).toLowerCase().split(' · ')[1].indexOf(typed) === 0;
        });
        if (match !== -1) highlight(match);
      }
    });
    list.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement !== button && !list.contains(document.activeElement)) close(false); }, 0); });

    button.addEventListener('click', function () { if (list.hidden) open(); else close(true); });
    button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); open(); }
    });

    drawFace();
    return { button: button, list: list, get value() { return value; } };
  }

  function viewSettings() {
    const user = BT.currentUser();
    const nameControl = h('input', { id: 'f-name', name: 'name', value: user.name, autocomplete: 'name', maxlength: 60 });
    const fields = profileFields(user, function () { return nameControl.value.trim() || user.name; });
    nameControl.addEventListener('input', fields.redraw);

    const currency = currencyPicker('f-currency', user.currency);

    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const name = nameControl.value.trim().replace(/\s+/g, ' ');
        if (!name) return showErrors(form, { name: 'Enter your name.' });
        busy(form, 'Saving…', async function () {
          await BT.updateUser(user.id, { name: name, avatar: fields.data.picture, bio: fields.bio.value.trim(), currency: currency.value });
          SOC.syncProfile(BT.currentUser()).catch(function (e) { console.error(e); });
          toast('Profile saved.');
          location.hash = '#profile';
        });
      }
    },
      fields.picker,
      field({ name: 'name', label: 'Name', control: nameControl }),
      fields.bioField,
      field({ name: 'currency', label: 'Currency', control: currency.button, wrapClass: 'currency-field', after: currency.list, hint: 'Changes the symbol only. Amounts are not converted.' }),
      formError(),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', type: 'submit' }, 'Save changes'),
        h('a', { class: 'link', href: '#profile' }, 'Cancel')));

    const dangerBox = h('div');
    function showDelete() {
      dangerBox.replaceChildren(h('button', { type: 'button', class: 'btn', onclick: showConfirm }, 'Delete account'));
    }
    function showConfirm() {
      const cancel = h('button', { type: 'button', class: 'btn', onclick: function () { showDelete(); dangerBox.querySelector('button').focus(); } }, 'Keep account');
      const social = user.provider !== 'password';
      const confirmForm = h('form', {
        class: 'stack',
        novalidate: true,
        onsubmit: function (event) {
          event.preventDefault();
          const password = social ? null : confirmForm.elements.password.value;
          if (!social && !password) return showErrors(confirmForm, { password: 'Enter your password.' });
          busy(confirmForm, 'Deleting…', async function () {
            await BT.deleteAccount(password);
            state.notice = 'Your account has been deleted.';
            location.hash = '#signin';
          });
        }
      },
        h('p', { class: 'small' }, social
          ? 'This permanently deletes your profile and every transaction. ' + BT.socialLabel(user.provider) + ' will ask you to confirm it is you.'
          : 'This permanently deletes your profile and every transaction. Enter your password to confirm.'),
        social ? null : field({ name: 'password', label: 'Password', type: 'password', attrs: { autocomplete: 'current-password' } }),
        formError(),
        h('div', { class: 'row' },
          h('button', { type: 'submit', class: 'btn danger' }, 'Yes, delete everything'),
          cancel));
      dangerBox.replaceChildren(confirmForm);
      (social ? confirmForm.querySelector('[type="submit"]') : confirmForm.elements.password).focus();
    }
    showDelete();

    return h('div', { class: 'wide' },
      h('div', { style: 'max-width:26rem' },
        h('h1', { style: 'margin-bottom:1.5rem' }, 'Settings'),
        form,
        h('section', { class: 'section' },
          h('h2', null, 'Account'),
          h('dl', { class: 'account-details', style: 'margin-top:0.75rem' },
            h('dt', null, 'Username'), h('dd', null, '@' + user.username),
            h('dt', null, 'Email'), h('dd', null, user.email),
            user.provider !== 'password' ? [h('dt', null, 'Sign-in'), h('dd', null, BT.socialLabel(user.provider))] : null,
            h('dt', null, 'Birthday'), h('dd', null, BT.longDate(user.birthday)))),
        h('section', { class: 'section' }, h('h2', { style: 'margin-bottom:0.75rem' }, 'Delete account'), dangerBox)));
  }

  /* ---------- Sidebar ---------- */

  const NAV_ICONS = {
    dashboard: '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>',
    profile: '<circle cx="10" cy="7" r="3.5"/><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"/>',
    circle: '<circle cx="7" cy="7.5" r="2.75"/><circle cx="13.5" cy="8" r="2.25"/><path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M12 12.2c2.3-.4 4.5.9 5.2 3.8"/>',
    messages: '<path d="M3.5 5.5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-3.5 3v-3a2 2 0 0 1-2-2z"/>',
    feed: '<rect x="3" y="3" width="14" height="14" rx="2.5"/><path d="M6.5 7h7M6.5 10h7M6.5 13h4"/>',
    notifications: '<path d="M5 13.5V9a5 5 0 0 1 10 0v4.5l1.5 1.5h-13z"/><path d="M8.5 17.5a1.6 1.6 0 0 0 3 0"/>',
    settings: '<circle cx="10" cy="10" r="2.5"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4"/>',
    signout: '<path d="M8 4H4.5v12H8M12 6.5 15.5 10 12 13.5M15.5 10H7.5"/>'
  };

  function navIcon(name) {
    const holder = document.createElement('span');
    holder.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + NAV_ICONS[name] + '</svg>';
    return holder.firstChild;
  }

  const badges = [];

  function drawBadges() {
    badges.forEach(function (badge) {
      if (!badge.isConnected) return;
      const count = badge.dataset.kind === 'messages' ? SOC.unreadChatCount() : SOC.unreadCount();
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.hidden = count === 0;
      badge.setAttribute('aria-label', count + ' new');
    });
  }

  let socialFor = null;
  function startSocial() {
    const user = BT.currentUser();
    if (!user || socialFor === user.id) return;
    socialFor = user.id;
    SOC.ensureProfile(user).catch(function (e) { console.error(e); });
    SOC.watchNotifications();
    SOC.watchChats();
    SOC.watchTrust();
  }

  /** "Ana's dashboard" links for the dashboards shared with you. */
  function sharedNav(view) {
    const holder = h('li', { class: 'shared-nav' });
    function draw() {
      const shares = SOC.trustedMe().filter(function (t) { return t.status === 'accepted'; });
      holder.hidden = !shares.length;
      const ul = h('ul', { class: 'nav-list' });
      holder.replaceChildren(ul);
      shares.forEach(function (t) {
        SOC.getProfile(t.owner).then(function (p) {
          if (!p) return;
          const here = view === 'shared' && location.hash.slice(3).toLowerCase() === p.username.toLowerCase();
          ul.appendChild(h('li', null, h('a', { class: 'nav-item', href: '#d/' + p.username, 'aria-current': here ? 'page' : null, title: p.name + '\u2019s dashboard (shared with you)' },
            avatar(p, p.avatar, 1.25), h('span', { class: 'nav-shared-name' }, p.name.split(' ')[0] + '\u2019s dashboard'))));
        }).catch(function () {});
      });
    }
    draw();
    trustWatchers.push(function () { if (!holder.isConnected) return false; draw(); });
    return holder;
  }

  function shell(view, content) {
    const user = BT.currentUser();
    const current = view;
    function item(name, href, label, extra) {
      return h('li', null, h('a', { class: 'nav-item', href: href, 'aria-current': current === name ? 'page' : null }, navIcon(name), h('span', null, label), extra || null));
    }
    function topLink(name, href, label) {
      const badge = name === 'notifications' ? h('span', { class: 'nav-badge', hidden: true, 'data-kind': 'notifications' }) : null;
      if (badge) badges.push(badge);
      const page = name === 'notifications' ? 'alerts' : name;
      return h('a', { class: 'top-btn', href: href, title: label, 'aria-label': label, 'aria-current': current === page ? 'page' : null }, navIcon(name), h('span', { class: 'top-label' }, label), badge);
    }
    const top = h('div', { class: 'top-actions' },
      topLink('notifications', '#alerts', 'Alerts'),
      topLink('settings', '#settings', 'Settings'));
    const side = h('aside', { class: 'sidebar' },
      h('a', { class: 'brand sidebar-brand', href: '#dashboard' }, 'PassbookHub'),
      h('a', { class: 'sidebar-me', href: '#profile' },
        avatar(user, user.avatar, 2.25),
        h('span', null, h('strong', null, user.name), h('span', { class: 'small muted' }, '@' + user.username))),
      h('nav', { 'aria-label': 'Main' },
        h('ul', { class: 'nav-list' },
          item('dashboard', '#dashboard', 'Dashboard',
            h('span', { class: 'nav-pin', title: 'Private: only you can see your dashboard' }, icon('pin'), h('span', { class: 'vh' }, '(private)'))),
          sharedNav(view),
          item('feed', '#feed', 'Feed'),
          item('profile', '#profile', 'Profile'),
          item('circle', '#circle', 'Circle'),
          h('li', null, h('button', {
            type: 'button',
            class: 'nav-item',
            onclick: function () {
              toastBox.hidden = true;
              state.notice = 'You have signed out.';
              socialFor = null;
              SOC.stopWatching();
              SOC.stopWatchingChats();
              SOC.stopWatchingTrust();
              location.hash = '#signin';
              BT.signOut();
            }
          }, navIcon('signout'), h('span', null, 'Sign out'))))));
    drawBadges();
    return h('div', { class: 'app-shell' }, side, h('div', { class: 'app-main' }, top, content));
  }

  /* ---------- Profiles and posts ---------- */

  function timeAgo(ms) {
    const seconds = Math.round((Date.now() - ms) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return minutes + 'm';
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours + 'h';
    const days = Math.round(hours / 24);
    if (days < 7) return days + 'd';
    return new Date(ms).toLocaleDateString(I18N.locale, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  }

  const VIS_ICONS = {
    public: '<circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3c2 2.2 2.8 4.5 2.8 7S12 14.8 10 17c-2-2.2-2.8-4.5-2.8-7S8 5.2 10 3z"/>',
    circle: NAV_ICONS.circle,
    private: '<rect x="4.5" y="9" width="11" height="8" rx="1.5"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/>'
  };

  function visIcon(visibility) {
    const holder = document.createElement('span');
    holder.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + VIS_ICONS[visibility] + '</svg>';
    return holder.firstChild;
  }

  function visibilitySelect(id, value, label) {
    const select = h('select', { id: id, class: 'vis-select', 'aria-label': label || 'Who can see this' },
      Object.keys(SOC.VISIBILITY).map(function (key) { return h('option', { value: key }, SOC.VISIBILITY[key].label); }));
    select.value = value;
    return select;
  }

  function profileHeader(person, actions, stats) {
    return h('section', { class: 'profile-head' },
      h('div', { class: 'profile-cover', 'aria-hidden': 'true' }),
      h('div', { class: 'profile-id' },
        avatar(person, person.avatar, 6.5),
        h('div', { class: 'profile-names' },
          h('h1', null, person.name),
          h('p', { class: 'muted' }, '@' + person.username),
          stats || null),
        actions ? h('div', { class: 'profile-actions' }, actions) : null),
      person.bio ? h('p', { class: 'profile-bio' }, person.bio) : null);
  }

  function postCard(person, post, isOwner, onChange) {
    const meta = h('div', { class: 'post-meta small muted' },
      h('span', null, timeAgo(post.createdAt)), h('span', { 'aria-hidden': 'true' }, '·'));
    const visLabel = h('span', { class: 'post-vis', title: SOC.VISIBILITY[post.visibility].hint }, visIcon(post.visibility), SOC.VISIBILITY[post.visibility].label);
    meta.appendChild(visLabel);

    let tools = null;
    if (isOwner) {
      const select = visibilitySelect('vis-' + post.id, post.visibility, 'Change who can see this post');
      select.addEventListener('change', async function () {
        const previous = post.visibility;
        select.disabled = true;
        try {
          await SOC.setPostVisibility(post.id, select.value);
          post.visibility = select.value;
          visLabel.replaceChildren(visIcon(post.visibility), SOC.VISIBILITY[post.visibility].label);
          toast('Now visible to: ' + SOC.VISIBILITY[post.visibility].label + '.');
        } catch (error) {
          select.value = previous;
          toast(error.message);
        }
        select.disabled = false;
      });
      tools = h('div', { class: 'post-tools' },
        select,
        h('button', {
          type: 'button',
          class: 'icon-btn',
          'aria-label': 'Delete post',
          title: 'Delete post',
          onclick: async function (event) {
            const button = event.currentTarget;
            if (!confirmTwice(button)) return;
            try {
              await SOC.deletePost(post.id);
              onChange();
              toast('Post deleted.');
            } catch (error) {
              toast(error.message);
            }
          }
        }, icon('remove')));
    }

    return h('article', { class: 'post' },
      h('header', { class: 'post-head' },
        avatar(person, person.avatar, 2.5),
        h('div', null, h('strong', null, person.name), meta),
        tools),
      h('p', { class: 'post-text' }, post.text));
  }

  /** In-page Yes/No question. Resolves true for yes, false for no, Escape or a click outside. */
  function ask(options) {
    return new Promise(function (resolve) {
      const previous = document.activeElement;
      const yes = h('button', { type: 'button', class: 'btn danger', onclick: function () { done(true); } }, options.yes || 'Yes');
      const no = h('button', { type: 'button', class: 'btn', onclick: function () { done(false); } }, options.no || 'No');
      const card = h('div', { class: 'ask-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'ask-title', 'aria-describedby': 'ask-body' },
        h('h2', { id: 'ask-title' }, options.title),
        options.body ? h('p', { id: 'ask-body', class: 'muted' }, options.body) : null,
        h('div', { class: 'ask-actions' }, no, yes));
      const overlay = h('div', { class: 'chat-overlay ask' }, card);
      function onKey(event) {
        if (event.key === 'Escape') done(false);
        if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === no ? yes : no).focus(); }
      }
      function done(answer) {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (previous && previous.isConnected) previous.focus();
        resolve(answer);
      }
      overlay.addEventListener('click', function (event) { if (event.target === overlay) done(false); });
      document.addEventListener('keydown', onKey, true);
      document.body.appendChild(overlay);
      no.focus();
    });
  }

  function fileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function readBase64(blob) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result).split(',')[1] || ''); };
      reader.onerror = function () { reject(new BT.UserError('We could not read that file.')); };
      reader.readAsDataURL(blob);
    });
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new BT.UserError('We could not open that image.')); };
      img.src = url;
    });
  }

  /** Draws a picture (image or video frame) scaled to fit max px, as a JPEG blob or data URL. */
  function shrink(source, width, height, max, quality, asDataUrl) {
    const scale = Math.min(1, max / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    if (asDataUrl) return Promise.resolve(canvas.toDataURL('image/jpeg', quality));
    return new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', quality); });
  }

  async function thumbFrom(source, width, height) {
    let thumb = await shrink(source, width, height, 360, 0.6, true);
    if (thumb.length > 60000) thumb = await shrink(source, width, height, 240, 0.5, true);
    return thumb.length <= 60000 ? thumb : null;
  }

  function videoFrame(url) {
    return new Promise(function (resolve) {
      const video = document.createElement('video');
      const give = function (value) { clearTimeout(timer); video.removeAttribute('src'); video.load(); resolve(value); };
      const timer = setTimeout(function () { give(null); }, 5000);
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadeddata = function () { video.currentTime = Math.min(0.5, (video.duration || 1) / 2); };
      video.onseeked = function () {
        thumbFrom(video, video.videoWidth, video.videoHeight).then(give, function () { give(null); });
      };
      video.onerror = function () { give(null); };
      video.src = url;
    });
  }

  /** Turns a picked File into what SOC.sendMessage stores. Photos are resized; the rest must fit in 5 MB. */
  async function prepareAttachment(file) {
    const type = file.type || '';
    const isImage = /^image\//.test(type);
    const isVideo = /^video\//.test(type);
    const url = URL.createObjectURL(file);
    try {
      if (isImage && type !== 'image/gif' && type !== 'image/svg+xml') {
        const img = await loadImage(url);
        let blob = null;
        for (const [max, quality] of [[2048, 0.85], [1600, 0.8], [1280, 0.75], [1024, 0.7]]) {
          blob = await shrink(img, img.naturalWidth, img.naturalHeight, max, quality, false);
          if (blob && blob.size <= 1.2 * 1024 * 1024) break;
        }
        if (!blob) throw new BT.UserError('We could not prepare that photo.');
        const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
        return { kind: 'photo', name: name, type: 'image/jpeg', size: blob.size, thumb: await thumbFrom(img, img.naturalWidth, img.naturalHeight), data: await readBase64(blob) };
      }
      if (file.size > SOC.FILE_MAX) {
        throw new BT.UserError((isVideo ? 'Videos' : isImage ? 'GIFs' : 'Files') + ' can be up to 5 MB. This one is ' + fileSize(file.size) + '.');
      }
      let thumb = null;
      if (isImage) {
        try { const img = await loadImage(url); thumb = await thumbFrom(img, img.naturalWidth || 360, img.naturalHeight || 360); } catch (e) { thumb = null; }
      } else if (isVideo) {
        thumb = await videoFrame(url);
      }
      return { kind: isImage ? 'photo' : isVideo ? 'video' : 'file', name: file.name || 'file', type: type || 'application/octet-stream', size: file.size, thumb: thumb, data: await readBase64(file) };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** First click arms the button, second click within 4 seconds confirms. Avoids blocking dialogs. */
  function confirmTwice(button) {
    if (button.dataset.armed === '1') return true;
    button.dataset.armed = '1';
    button.classList.add('armed');
    button.setAttribute('aria-label', 'Click again to delete');
    button.title = 'Click again to delete';
    setTimeout(function () {
      button.dataset.armed = '';
      button.classList.remove('armed');
      button.setAttribute('aria-label', 'Delete post');
      button.title = 'Delete post';
    }, 4000);
    return false;
  }

  function postList(person, rel) {
    const box = h('div', { class: 'posts' }, h('p', { class: 'muted small' }, 'Loading posts…'));
    async function load() {
      try {
        const posts = await SOC.listPosts(person.id, rel);
        if (!box.isConnected && box.parentNode) return;
        if (!posts.length) {
          box.replaceChildren(h('p', { class: 'empty' }, rel === 'self' ? 'You have not posted yet.' : 'No posts to show.'));
          return;
        }
        box.replaceChildren.apply(box, posts.map(function (post) { return postCard(person, post, rel === 'self', load); }));
      } catch (error) {
        box.replaceChildren(h('p', { class: 'empty' }, error.message || 'We could not load posts.'));
      }
    }
    box.reload = load;
    load();
    return box;
  }

  function composer(user, onPosted) {
    const counter = h('span', { class: 'small muted num' });
    const text = h('textarea', { id: 'f-post', name: 'post', rows: 3, maxlength: SOC.POST_MAX, placeholder: 'What is on your mind, ' + user.name.split(' ')[0] + '?' });
    const select = visibilitySelect('f-visibility', state.postVisibility || 'circle');
    select.addEventListener('change', function () { state.postVisibility = select.value; });
    function count() { counter.textContent = text.value.length + ' / ' + SOC.POST_MAX; }
    text.addEventListener('input', count);
    count();
    const form = h('form', {
      class: 'composer',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const problem = SOC.validatePost(text.value, select.value);
        if (problem) return showErrors(form, { _form: problem });
        busy(form, 'Posting…', async function () {
          await SOC.createPost(text.value, select.value);
          text.value = '';
          count();
          toast('Posted.');
          onPosted();
        });
      }
    },
      h('div', { class: 'composer-top' }, avatar(user, user.avatar, 2.5), h('label', { class: 'vh', for: 'f-post' }, 'Write a post'), text),
      formError(),
      h('div', { class: 'composer-bar' },
        h('label', { class: 'vis-picker' }, h('span', { class: 'small muted' }, 'Who can see this'), select),
        counter,
        h('button', { class: 'btn primary', type: 'submit' }, 'Post')));
    return form;
  }

  function circleCount(uid) {
    const node = h('p', { class: 'small muted profile-stats' });
    SOC.circleMembers(uid).then(function (people) {
      node.textContent = people.length === 1 ? '1 in circle' : people.length + ' in circle';
    }).catch(function () {});
    return node;
  }

  function relationActions(person, rel, redraw) {
    async function act(button, work, message) {
      button.disabled = true;
      try {
        await work();
        if (message) toast(message);
        redraw();
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    }
    if (rel === 'circle') {
      const remove = h('button', { type: 'button', class: 'btn' }, 'In your circle ✓');
      remove.addEventListener('click', function () {
        if (remove.dataset.armed === '1') return act(remove, function () { return SOC.removeFromCircle(person.id); }, person.name + ' was removed from your circle.');
        remove.dataset.armed = '1';
        remove.textContent = 'Remove from circle?';
        setTimeout(function () { if (remove.isConnected) { remove.dataset.armed = ''; remove.textContent = 'In your circle ✓'; } }, 4000);
      });
      return remove;
    }
    if (rel === 'sent') {
      const cancel = h('button', { type: 'button', class: 'btn' }, 'Request sent · Cancel');
      cancel.addEventListener('click', function () { act(cancel, function () { return SOC.cancelRequest(person.id); }, 'Request cancelled.'); });
      return cancel;
    }
    if (rel === 'received') {
      const accept = h('button', { type: 'button', class: 'btn primary' }, 'Accept');
      const decline = h('button', { type: 'button', class: 'btn' }, 'Decline');
      accept.addEventListener('click', function () { act(accept, function () { return SOC.acceptRequest(person.id); }, person.name + ' is now in your circle.'); });
      decline.addEventListener('click', function () { act(decline, function () { return SOC.declineRequest(person.id); }, 'Request declined.'); });
      return h('div', { class: 'row' }, h('span', { class: 'small muted' }, 'Wants to add you'), accept, decline);
    }
    const add = h('button', { type: 'button', class: 'btn primary' }, '+ Add to circle');
    add.addEventListener('click', function () { act(add, function () { return SOC.sendRequest(person.id); }, 'Circle request sent to ' + person.name + '.'); });
    return add;
  }

  /* ---------- Feed ---------- */

  function viewFeed() {
    const user = BT.currentUser();
    const list = h('div', { class: 'posts' }, h('p', { class: 'muted small' }, 'Loading your feed…'));
    async function load() {
      try {
        const items = await SOC.feedPosts(60);
        if (!list.isConnected && list.parentNode) return;
        if (!items.length) {
          list.replaceChildren(h('p', { class: 'empty' }, 'Nothing here yet. Share something, or add people to your ', h('a', { href: '#circle' }, 'circle'), ' to see their posts.'));
          return;
        }
        list.replaceChildren.apply(list, items.map(function (item) {
          const person = item.mine ? Object.assign({}, item.person, { id: user.id, name: user.name, username: user.username, avatar: user.avatar }) : item.person;
          return postCard(person, item.post, item.mine, load);
        }));
      } catch (error) {
        list.replaceChildren(h('p', { class: 'empty' }, error.message || 'We could not load your feed.'));
      }
    }
    load();
    return h('div', { class: 'wide' },
      h('h1', { style: 'margin-bottom:1.25rem' }, 'Feed'),
      composer(user, load),
      h('h2', { class: 'posts-title' }, 'From you and your circle'),
      list);
  }

  /* ---------- Profile (dashboard style) ---------- */

  const PROFILE_ICONS = {
    school: '<path d="M2 8 10 4l8 4-8 4z"/><path d="M5.5 9.8V14c1.2 1.3 2.7 2 4.5 2s3.3-.7 4.5-2V9.8M18 8v4.5"/>',
    work: '<rect x="2.5" y="6" width="15" height="10.5" rx="2"/><path d="M7 6V4.5A1.5 1.5 0 0 1 8.5 3h3A1.5 1.5 0 0 1 13 4.5V6M2.5 10.5h15"/>',
    circle: '<circle cx="7" cy="7.5" r="2.75"/><circle cx="13.5" cy="8" r="2.25"/><path d="M2.5 16c.6-2.6 2.4-4 4.5-4s3.9 1.4 4.5 4M12 12.2c2.3-.4 4.5.9 5.2 3.8"/>',
    camera: '<path d="M3 7a2 2 0 0 1 2-2h1.5l1.2-1.8h4.6L13.5 5H15a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="10" cy="10.5" r="3"/>',
    plus: '<path d="M10 4v12M4 10h12"/>'
  };
  function pIcon(name) {
    const holder = document.createElement('span');
    holder.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + PROFILE_ICONS[name] + '</svg>';
    return holder.firstChild;
  }

  function monthYear(ym) {
    if (!ym) return '';
    const parts = ym.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleDateString(I18N.locale, { month: 'short', year: 'numeric' });
  }
  function workSpan(w) {
    if (!w.start && !w.end) return '';
    return (w.start ? monthYear(w.start) : '?') + ' – ' + (w.end ? monthYear(w.end) : 'Present');
  }
  /** Current job first (no end date), then by most recent start. */
  function sortedWork(list) {
    return (list || []).slice().sort(function (a, b) {
      if (!a.end !== !b.end) return a.end ? 1 : -1;
      return (b.start || '').localeCompare(a.start || '');
    });
  }

  /**
   * The profile page for anyone. opts: { mine, rel, actions, onEdit }.
   */
  function profilePage(person, opts) {
    const first = person.name.split(' ')[0];
    const hero = h('section', { class: 'pf-card pf-hero' },
      h('div', { class: 'pf-hero-glow', 'aria-hidden': 'true' }, h('span'), h('span')),
      h('div', { class: 'pf-hero-copy' },
        h('span', { class: 'pf-kicker' }, opts.mine ? 'Your profile' : opts.rel === 'circle' ? 'In your circle' : 'PassbookHub member'),
        h('h1', { class: 'pf-name' }, person.name),
        h('p', { class: 'pf-handle' }, '@' + person.username),
        person.bio ? h('p', { class: 'pf-bio' }, person.bio) : (opts.mine ? h('p', { class: 'pf-bio muted-on-brand' }, 'Add a short bio so your circle knows you.') : null),
        opts.actions ? h('div', { class: 'pf-actions' }, opts.actions) : null),
      h('div', { class: 'pf-hero-photo' }, avatar(person, person.avatar, 9)));
    SOC.loadCover(person.id).then(function (cover) {
      if (cover) { hero.style.setProperty('--cover', 'url("' + cover + '")'); hero.classList.add('has-cover'); }
    }).catch(function () {});

    const work = sortedWork(person.work);
    const current = work.find(function (w) { return !w.end; });
    const edu = person.education || [];
    const circleStat = h('span', { class: 'pf-stat-value num' }, '–');
    const circleList = h('div', { class: 'pf-circle-list' }, h('p', { class: 'small muted' }, 'Loading…'));
    if (opts.mine) {
      SOC.circleMembers(person.id).then(function (people) {
        circleStat.textContent = String(people.length);
        if (!people.length) {
          circleList.replaceChildren(h('p', { class: 'small muted' }, 'No one yet. ', h('a', { href: '#circle' }, 'Find people'), '.'));
          return;
        }
        circleList.replaceChildren(h('ul', { class: 'pf-circle-people' }, people.slice(0, 8).map(function (p) {
          return h('li', null, h('a', { href: '#u/' + p.username, title: p.name }, avatar(p, p.avatar, 2.5), h('span', { class: 'small' }, p.name.split(' ')[0])));
        })), people.length > 8 ? h('a', { class: 'small', href: '#circle' }, 'See all ' + people.length) : '');
      }).catch(function () { circleList.replaceChildren(h('p', { class: 'small muted' }, 'We could not load your circle.')); });
    }

    function stat(iconName, label, value, sub) {
      return h('div', { class: 'pf-stat' },
        h('span', { class: 'pf-stat-label' }, pIcon(iconName), label),
        typeof value === 'string' ? h('span', { class: 'pf-stat-value' + (/^[0-9\u2013]+$/.test(value) ? '' : ' long'), title: value }, value) : value,
        sub ? h('span', { class: 'pf-stat-sub small' }, sub) : null);
    }
    const stats = h('section', { class: 'pf-card pf-stats', 'aria-label': 'At a glance' },
      opts.mine ? stat('circle', 'Circle', circleStat, 'people') : stat('circle', 'Circle', opts.rel === 'circle' ? 'Connected' : opts.rel === 'sent' ? 'Requested' : 'Not yet', opts.rel === 'circle' ? 'in your circle' : null),
      stat('school', 'Studied at', edu[0] ? (edu[0].school || edu[0].course) : '–', edu[0] && edu[0].year ? edu[0].year : null),
      stat('work', 'Works at', current ? (current.company || current.title) : '–', current && current.company ? current.title : null));

    function emptyNote(text) {
      return h('p', { class: 'pf-empty small' }, text,
        opts.mine ? [' ', h('button', { type: 'button', class: 'link', onclick: opts.onEdit }, 'Add it')] : null);
    }

    const eduCard = h('section', { class: 'pf-card pf-list-card' },
      h('div', { class: 'pf-card-head' }, h('h2', null, 'Education'), pIcon('school')),
      edu.length ? h('ul', { class: 'pf-items' }, edu.map(function (e) {
        return h('li', { class: 'pf-item' },
          h('span', { class: 'pf-item-icon' }, pIcon('school')),
          h('span', { class: 'pf-item-text' },
            h('strong', null, e.school || e.course),
            e.school && e.course ? h('span', null, e.course) : null,
            e.year ? h('span', { class: 'small muted' }, e.year) : null));
      })) : emptyNote(opts.mine ? 'Where did you go to college?' : first + ' hasn’t added their education.'));

    const workCard = h('section', { class: 'pf-card pf-list-card' },
      h('div', { class: 'pf-card-head' }, h('h2', null, 'Work experience'), pIcon('work')),
      work.length ? h('ol', { class: 'pf-timeline' }, work.map(function (w) {
        return h('li', { class: 'pf-tl-item' + (w.end ? '' : ' now') },
          h('span', { class: 'pf-tl-dot', 'aria-hidden': 'true' }),
          h('span', { class: 'pf-item-text' },
            h('strong', null, w.title || w.company),
            w.title && w.company ? h('span', null, w.company) : null,
            workSpan(w) ? h('span', { class: 'small muted' }, workSpan(w)) : null),
          w.end ? null : h('span', { class: 'pf-now' }, 'Now'));
      })) : emptyNote(opts.mine ? 'Add your current work or past experience.' : first + ' hasn’t added work experience.'));

    const side = [];
    if (opts.mine) {
      side.push(h('section', { class: 'pf-card pf-list-card' },
        h('div', { class: 'pf-card-head' }, h('h2', null, 'Your circle'), h('a', { class: 'small', href: '#circle' }, 'Manage')),
        circleList));
    }
    side.push(workCard);

    return h('div', { class: 'pf-page' },
      h('div', { class: 'pf-main' }, hero, stats, eduCard),
      h('div', { class: 'pf-side' }, side));
  }

  /** Crops to a wide 3:1 banner and keeps it under the size limit. */
  async function toCoverData(file) {
    if (!/^image\//.test(file.type)) throw new BT.UserError('Choose an image file.');
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      const w = img.naturalWidth, hgt = img.naturalHeight;
      const ratio = 3;
      let sw = w, sh = Math.round(w / ratio);
      if (sh > hgt) { sh = hgt; sw = Math.round(hgt * ratio); }
      const sx = Math.round((w - sw) / 2), sy = Math.round((hgt - sh) / 2);
      for (const [max, q] of [[1500, 0.82], [1200, 0.78], [1000, 0.72], [800, 0.68]]) {
        const scale = Math.min(1, max / sw);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
        canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', q);
        if (data.length < SOC.COVER_MAX - 1000) return data;
      }
      throw new BT.UserError('That image is too large. Try a smaller one.');
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /** Edit cover photo, picture, bio, education and work in one dialog. */
  async function editProfile(onSaved) {
    const user = BT.currentUser();
    const profile = (await SOC.loadProfile(user.id).catch(function () { return null; })) || {};
    let cover = await SOC.loadCover(user.id).catch(function () { return null; });
    const previous = document.activeElement;
    const fields = profileFields(user, function () { return user.name; });

    const coverBox = h('div', { class: 'pf-cover-edit' });
    const coverError = h('p', { class: 'error small', hidden: true });
    const coverInput = h('input', { type: 'file', accept: 'image/*', class: 'vh', onchange: async function () {
      const file = coverInput.files[0]; coverInput.value = '';
      if (!file) return;
      coverError.hidden = true;
      try { cover = await toCoverData(file); drawCover(); }
      catch (e) { coverError.textContent = e.message; coverError.hidden = false; }
    } });
    function drawCover() {
      coverBox.style.backgroundImage = cover ? 'url("' + cover + '")' : '';
      coverBox.classList.toggle('empty', !cover);
      coverBox.replaceChildren(
        h('label', { class: 'btn small pf-cover-btn' }, pIcon('camera'), h('span', null, cover ? 'Change cover' : 'Add cover photo'), coverInput),
        cover ? h('button', { type: 'button', class: 'btn small pf-cover-btn', onclick: function () { cover = null; drawCover(); } }, 'Remove') : null);
    }
    drawCover();

    /* Repeatable rows for education and work. */
    function rows(kind, items, max, make) {
      const list = h('div', { class: 'pf-rows' });
      const addBtn = h('button', { type: 'button', class: 'btn small', onclick: function () { list.appendChild(make({})); sync(); const f = list.lastChild.querySelector('input'); if (f) f.focus(); } }, pIcon('plus'), h('span', null, kind === 'edu' ? 'Add school' : 'Add work'));
      function sync() { addBtn.hidden = list.children.length >= max; }
      items.forEach(function (it) { list.appendChild(make(it)); });
      sync();
      list.sync = sync;
      return { list: list, add: addBtn };
    }
    let uid = 0;
    function input(label, value, attrs) {
      const id = 'pf-in-' + (++uid);
      const control = h('input', Object.assign({ id: id, value: value || '', autocomplete: 'off' }, attrs || {}));
      control.value = value || '';
      return h('div', { class: 'acct-field' + (attrs && attrs.grow ? ' grow' : '') }, h('label', { for: id }, label), control);
    }
    function removeBtn(row, what) {
      return h('button', { type: 'button', class: 'icon-btn pf-row-x', 'aria-label': 'Remove ' + what, title: 'Remove', onclick: function () { const list = row.parentNode; row.remove(); if (list && list.sync) list.sync(); } }, icon('close'));
    }
    let eduRows, workRows;
    function eduRow(e) {
      const row = h('div', { class: 'pf-row', 'data-kind': 'edu' });
      row.append(
        h('div', { class: 'acct-row' }, input('School', e.school, { maxlength: 80, grow: true, placeholder: 'e.g. University of the Philippines', 'data-k': 'school' })),
        h('div', { class: 'acct-row' }, input('Course', e.course, { maxlength: 80, grow: true, placeholder: 'e.g. BS Accountancy', 'data-k': 'course' }), input('Year', e.year, { maxlength: 20, placeholder: '2018 – 2022', 'data-k': 'year' })),
        removeBtn(row, 'school'));
      return row;
    }
    function workRow(w) {
      const row = h('div', { class: 'pf-row', 'data-kind': 'work' });
      const endField = input('End', w.end, { type: 'month', 'data-k': 'end' });
      const nowBox = h('input', { type: 'checkbox', 'data-k': 'now' });
      nowBox.checked = !!(w.title || w.company) && !w.end;
      function syncNow() { endField.hidden = nowBox.checked; }
      nowBox.addEventListener('change', syncNow);
      row.append(
        h('div', { class: 'acct-row' }, input('Job title', w.title, { maxlength: 60, grow: true, placeholder: 'e.g. Junior Accountant', 'data-k': 'title' }), input('Company', w.company, { maxlength: 80, grow: true, placeholder: 'e.g. SM Investments', 'data-k': 'company' })),
        h('div', { class: 'acct-row pf-dates' }, input('Start', w.start, { type: 'month', 'data-k': 'start' }), endField,
          h('label', { class: 'pf-now-check small' }, nowBox, 'I work here now')),
        removeBtn(row, 'work'));
      syncNow();
      return row;
    }
    eduRows = { list: null }; workRows = { list: null };
    const e1 = rows('edu', profile.education && profile.education.length ? profile.education : [{}], SOC.EDU_MAX, eduRow);
    eduRows = e1;
    const w1 = rows('work', profile.work && profile.work.length ? sortedWork(profile.work) : [{}], SOC.WORK_MAX, workRow);
    workRows = w1;

    function read(kind) {
      return Array.prototype.map.call((kind === 'edu' ? eduRows : workRows).list.children, function (row) {
        const out = {};
        row.querySelectorAll('[data-k]').forEach(function (c) { out[c.dataset.k] = c.type === 'checkbox' ? c.checked : c.value; });
        if (kind === 'work' && out.now) out.end = '';
        return out;
      });
    }

    const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const save = h('button', { type: 'submit', class: 'btn primary' }, 'Save profile');
    const form = h('form', {
      class: 'acct-form pf-edit', novalidate: true,
      onsubmit: async function (event) {
        event.preventDefault();
        errorBox.hidden = true;
        save.disabled = true;
        try {
          await BT.updateUser(user.id, { avatar: fields.data.picture, bio: fields.bio.value.trim() });
          await SOC.syncProfile(BT.currentUser());
          await SOC.saveProfileExtras({ cover: cover, education: read('edu'), work: read('work') });
          toast('Profile saved.');
          close();
          onSaved();
        } catch (error) {
          save.disabled = false;
          errorBox.textContent = error instanceof BT.UserError ? error.message : 'We could not save your profile.';
          errorBox.hidden = false;
        }
      }
    },
    h('div', { class: 'acct-head' }, h('h2', { id: 'pf-edit-title' }, 'Edit profile'),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: function () { close(); } }, icon('close'))),
    h('div', { class: 'acct-field' }, h('span', { class: 'acct-label' }, 'Cover photo'), coverBox, coverError),
    fields.picker,
    fields.bioField,
    h('fieldset', { class: 'pf-fieldset' }, h('legend', null, 'Education'), e1.list, e1.add),
    h('fieldset', { class: 'pf-fieldset' }, h('legend', null, 'Work experience'), w1.list, w1.add),
    errorBox,
    h('div', { class: 'ask-actions' }, h('a', { class: 'link small', href: '#settings', onclick: function () { close(); } }, 'Change name or currency'), h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn', onclick: function () { close(); } }, 'Cancel'), save));

    const overlay = h('div', { class: 'chat-overlay ask acct-overlay' },
      h('div', { class: 'ask-card acct-card pf-edit-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'pf-edit-title' }, form));
    function onKey(event) { if (event.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      if (previous && previous.isConnected) previous.focus();
    }
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    form.querySelector('.pf-cover-btn').focus();
  }

  function viewTimeline() {
    const user = BT.currentUser();
    const box = h('div', { class: 'wide pf-wide' }, h('p', { class: 'muted' }, 'Loading profile…'));
    function draw() {
      const me = BT.currentUser();
      SOC.loadProfile(me.id).catch(function () { return null; }).then(function (p) {
        if (!box.isConnected && box.parentNode) return;
        const person = Object.assign({}, p || {}, { id: me.id, name: me.name, username: me.username, avatar: me.avatar, bio: me.bio });
        box.replaceChildren(profilePage(person, {
          mine: true,
          onEdit: function () { editProfile(draw); },
          actions: [
            h('button', { type: 'button', class: 'btn pf-btn', onclick: function () { editProfile(draw); } }, icon('edit'), h('span', null, 'Edit profile')),
            h('a', { class: 'btn pf-btn ghost', href: '#feed' }, navIcon('feed'), h('span', null, 'Go to Feed'))
          ]
        }));
      });
    }
    draw();
    return box;
  }

  function viewPerson() {
    const username = location.hash.slice(3);
    const box = h('div', { class: 'wide pf-wide' }, h('p', { class: 'muted' }, 'Loading profile…'));
    async function load() {
      try {
        const found = await SOC.findByUsername(username);
        if (!box.isConnected && box.parentNode) return;
        if (!found) {
          box.replaceChildren(h('div', { class: 'empty-state' },
            h('h1', null, 'Profile not found'),
            h('p', { class: 'muted' }, 'No one on PassbookHub has the username @' + username + '.'),
            h('a', { class: 'btn', href: '#circle' }, 'Search for people')));
          return;
        }
        if (found.id === BT.currentUser().id) { location.hash = '#profile'; return; }
        const person = (await SOC.loadProfile(found.id).catch(function () { return null; })) || found;
        const rel = await SOC.relation(person.id);
        document.title = person.name + ' · PassbookHub';
        box.replaceChildren(profilePage(person, {
          mine: false, rel: rel,
          actions: rel === 'circle'
            ? h('div', { class: 'row' }, messageButton(person, true), relationActions(person, rel, load))
            : relationActions(person, rel, load)
        }));
      } catch (error) {
        box.replaceChildren(h('p', { class: 'empty' }, error.message || 'We could not load this profile.'));
      }
    }
    load();
    return box;
  }

  /* ---------- Circle ---------- */

  function personRow(person, extra) {
    return h('li', { class: 'person' },
      h('a', { class: 'person-link', href: '#u/' + person.username },
        avatar(person, person.avatar, 2.75),
        h('span', { class: 'person-names' }, h('strong', null, person.name), h('span', { class: 'small muted' }, '@' + person.username))),
      extra || null);
  }

  /** Opens the conversation with someone in your circle. */
  function messageButton(person, primary) {
    return h('a', { class: 'btn msg-btn' + (primary ? ' primary' : ''), href: '#chat/' + person.username, 'aria-label': 'Message ' + person.name },
      navIcon('messages'), h('span', null, 'Message'));
  }

  function viewCircle() {
    const input = h('input', { id: 'f-search', type: 'search', placeholder: 'Search by name or @username', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
    const results = h('div', { 'aria-live': 'polite' });
    const members = h('div', null, h('p', { class: 'muted small' }, 'Loading your circle…'));
    let timer = null, latest = 0;
    const circleReady = SOC.circleMembers().then(function (people) {
      const ids = {};
      people.forEach(function (p) { ids[p.id] = true; });
      return { people: people, ids: ids };
    });

    function searchExtra(person, circle) {
      if (circle.ids[person.id]) return messageButton(person);
      return circleIcons(person);
    }

    /* Two icons for someone outside your circle: add to circle, and view profile. */
    function circleIcons(person) {
      const first = person.name.split(' ')[0];
      const add = h('button', { type: 'button', class: 'icon-btn person-icon' });
      const view = h('a', { class: 'icon-btn person-icon', href: '#u/' + person.username, 'aria-label': 'View ' + person.name + '’s profile', title: 'View profile' }, icon('profile'));
      const box = h('div', { class: 'person-actions' }, add, view);
      let rel = 'none';
      function draw() {
        if (rel === 'circle') { box.replaceChildren(messageButton(person)); return; }
        const look = {
          none: ['addPerson', 'Add ' + person.name + ' to your circle', 'Add to circle'],
          sent: ['pending', 'Circle request sent to ' + person.name + '. Tap to cancel.', 'Request sent · Tap to cancel'],
          received: ['check', 'Accept ' + person.name + '’s circle request', first + ' wants to add you · Tap to accept']
        }[rel];
        add.replaceChildren(icon(look[0]));
        add.setAttribute('aria-label', look[1]);
        add.title = look[2];
        add.className = 'icon-btn person-icon' + (rel === 'sent' ? '' : ' add');
        add.disabled = false;
      }
      add.addEventListener('click', async function () {
        add.disabled = true;
        try {
          if (rel === 'none') { await SOC.sendRequest(person.id); rel = 'sent'; toast('Circle request sent to ' + person.name + '.'); }
          else if (rel === 'sent') { await SOC.cancelRequest(person.id); rel = 'none'; toast('Request cancelled.'); }
          else if (rel === 'received') { await SOC.acceptRequest(person.id); rel = 'circle'; toast(person.name + ' is now in your circle.'); }
        } catch (error) {
          toast(error.message);
        }
        draw();
      });
      draw();
      add.disabled = true;
      SOC.relation(person.id).then(function (r) { rel = r; draw(); }).catch(function () { draw(); });
      return box;
    }

    async function runSearch() {
      const term = input.value.trim();
      const ticket = ++latest;
      if (term.replace(/^@/, '').length < 1) { results.replaceChildren(); return; }
      results.replaceChildren(h('p', { class: 'muted small' }, 'Searching…'));
      try {
        const found = await Promise.all([SOC.search(term), circleReady.catch(function () { return { ids: {} }; })]);
        const people = found[0], circle = found[1];
        if (ticket !== latest) return;
        results.replaceChildren(people.length
          ? h('ul', { class: 'people' }, people.map(function (p) { return personRow(p, searchExtra(p, circle)); }))
          : h('p', { class: 'empty' }, 'No one found for “' + term + '”.'));
      } catch (error) {
        if (ticket === latest) results.replaceChildren(h('p', { class: 'empty' }, error.message));
      }
    }
    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(runSearch, 300); });

    circleReady.then(function (circle) {
      const people = circle.people;
      members.replaceChildren(people.length
        ? h('ul', { class: 'people' }, people.map(function (p) { return personRow(p, messageButton(p)); }))
        : h('p', { class: 'empty' }, 'Your circle is empty. Search for people above to add them.'));
    }).catch(function (error) { members.replaceChildren(h('p', { class: 'empty' }, error.message)); });

    setTimeout(function () { if (input.isConnected) input.focus(); }, 0);
    return h('div', { class: 'wide' },
      h('h1', null, 'Circle'),
      h('p', { class: 'muted', style: 'margin:0.25rem 0 1.25rem' }, 'Your circle is your PassbookHub friends. Posts you share with “Circle” are visible only to them, and you can message anyone in your circle.'),
      h('div', { class: 'search-box' }, h('label', { class: 'vh', for: 'f-search' }, 'Search people'), navIcon('circle'), input),
      results,
      h('h2', { class: 'posts-title' }, 'Your circle'),
      members);
  }

  /* ---------- Messages ---------- */

  function clockTime(ms) {
    return new Date(ms).toLocaleTimeString(I18N.locale, { hour: 'numeric', minute: '2-digit' });
  }

  function dayLabel(ms) {
    const d = new Date(ms);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(I18N.locale, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  }

  /**
   * One conversation, built to live in the floating chat window (bottom right).
   * hooks: { isOpen(), minimize(), close(), onPerson(person) }
   * Returns { el, refresh(), focus(), destroy() }.
   */
  function chatPanel(username, hooks) {
    const box = h('div', { class: 'chat-pop-body' }, h('p', { class: 'muted small chat-pop-note' }, 'Loading conversation…'));
    let stop = null;
    let closed = false;
    const cleanups = [];
    const api = {
      el: box,
      refresh: function () {},
      focus: function () {},
      destroy: function () {
        closed = true;
        if (stop) stop();
        stop = null;
        cleanups.forEach(function (fn) { fn(); });
      }
    };

    function windowTools() {
      return [
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Minimize chat', title: 'Minimize', onclick: function () { hooks.minimize(); } }, icon('minimize')),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close chat', title: 'Close', onclick: function () { hooks.close(); } }, icon('close'))
      ];
    }

    function problem(text) {
      box.replaceChildren(h('header', { class: 'chat-head' }, h('span', { class: 'person-link' }), h('div', { class: 'chat-head-tools' }, windowTools())),
        h('p', { class: 'muted small chat-pop-note' }, text));
    }

    async function load() {
      try {
        const person = await SOC.findByUsername(username);
        if (closed) return;
        if (!person) { problem('No one on PassbookHub has the username @' + username + '.'); return; }
        if (person.id === BT.currentUser().id) { hooks.close(); return; }
        hooks.onPerson(person);
        const rel = await SOC.relation(person.id);
        if (closed) return;
        draw(person, rel === 'circle');
      } catch (error) {
        if (!closed) problem(error.message || 'We could not load this conversation.');
      }
    }

    function draw(person, canSend) {
      const me = BT.currentUser();
      const first = person.name.split(' ')[0];
      const REACTIONS = ['❤️', '😆', '😮', '😢', '😠', '👍'];
      const thread = h('div', { class: 'chat-thread', role: 'log', 'aria-label': 'Conversation with ' + person.name },
        h('p', { class: 'muted small chat-hint' }, 'Loading messages…'));
      let firstDraw = true;
      let editing = null;
      let picking = null;
      let lastMessages = [];
      const search = { open: false, query: '', hits: [], index: -1 };
      const urls = {};

      cleanups.push(function () {
        Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); });
        document.querySelectorAll('.chat-overlay.viewer').forEach(function (d) { d.remove(); });
      });

      /* Only counts as seen while the chat window is open (not minimized) and the tab is visible. */
      function seen() {
        if (document.visibilityState === 'visible' && hooks.isOpen()) SOC.markSeen(person.id).catch(function () {});
      }

      /* "Sending…" / "Sent" / "Delivered" / "Seen 10:02 AM" under your newest message. */
      let receipt = null;
      let receiptMsg = null;
      function updateReceipt() {
        if (!receipt || !receiptMsg) return;
        const status = SOC.messageStatus(receiptMsg, person.id);
        const chat = SOC.chatWith(person.id);
        const theirSeen = chat && chat.seen ? chat.seen[person.id] || 0 : 0;
        const isSeen = status === 'seen';
        const label = isSeen ? 'Seen ' + clockTime(theirSeen)
          : status === 'delivered' ? 'Delivered' : status === 'sending' ? 'Sending…' : 'Sent';
        receipt.replaceChildren.apply(receipt, isSeen ? [avatar(person, person.avatar, 0.875), label] : [label]);
        receipt.className = 'bubble-receipt small muted' + (isSeen ? ' seen' : '');
        receipt.dataset.status = status;
        receipt.title = isSeen ? 'Seen by ' + first + ' · ' + dayLabel(theirSeen) + ', ' + clockTime(theirSeen)
          : status === 'delivered' ? 'Delivered to ' + first + ' · not seen yet'
          : status === 'sending' ? 'Sending…' : 'Not seen yet';
      }
      api.refresh = function () { seen(); updateReceipt(); };
      /* Mark the chat seen when you come back to this tab. */
      function onVisible() {
        if (closed) { document.removeEventListener('visibilitychange', onVisible); return; }
        seen();
      }
      document.addEventListener('visibilitychange', onVisible);

      function redraw() { drawMessages(lastMessages); }

      /* ---------- Attachments ---------- */

      async function mediaUrl(att) {
        if (urls[att.fileId]) return urls[att.fileId];
        const blob = await SOC.loadAttachment(person.id, att);
        urls[att.fileId] = URL.createObjectURL(blob);
        return urls[att.fileId];
      }

      async function download(att) {
        try {
          const url = await mediaUrl(att);
          const a = h('a', { href: url, download: att.name });
          document.body.appendChild(a);
          a.click();
          a.remove();
        } catch (error) {
          toast(error.message || 'We could not download that file.');
        }
      }

      function openViewer(m) {
        const att = m.att;
        const stage = h('div', { class: 'viewer-stage' }, h('p', { class: 'muted' }, 'Loading…'));
        const overlay = h('div', { class: 'chat-overlay viewer', role: 'dialog', 'aria-modal': 'true', 'aria-label': att.name },
          h('div', { class: 'viewer-bar' },
            h('span', { class: 'viewer-name' }, h('strong', null, att.name), h('span', { class: 'small muted' }, (m.from === me.id ? 'You' : first) + ' · ' + dayLabel(m.createdAt) + ', ' + clockTime(m.createdAt))),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Download', title: 'Download', onclick: function () { download(att); } }, icon('download')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: close }, icon('close'))),
          stage);
        function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
        function onKey(event) { if (event.key === 'Escape') close(); }
        overlay.addEventListener('click', function (event) { if (event.target === overlay || event.target === stage) close(); });
        document.addEventListener('keydown', onKey);
        document.body.appendChild(overlay);
        overlay.querySelector('.icon-btn:last-child').focus();
        mediaUrl(att).then(function (url) {
          if (!overlay.isConnected) return;
          stage.replaceChildren(att.kind === 'video'
            ? h('video', { src: url, controls: true, autoplay: true, playsinline: true })
            : h('img', { src: url, alt: att.name }));
        }).catch(function (error) {
          stage.replaceChildren(h('p', { class: 'muted' }, error.message || 'We could not open this attachment.'));
        });
      }

      function attachmentNode(m) {
        const att = m.att;
        if (att.kind === 'photo' || att.kind === 'video') {
          return h('button', {
            type: 'button', class: 'att-media' + (att.kind === 'video' ? ' is-video' : ''),
            'aria-label': (att.kind === 'video' ? 'Play video ' : 'Open photo ') + att.name,
            onclick: function (event) { event.stopPropagation(); openViewer(m); }
          },
          att.thumb ? h('img', { src: att.thumb, alt: '', loading: 'lazy' }) : h('span', { class: 'att-placeholder' }, icon(att.kind === 'video' ? 'video' : 'image')),
          att.kind === 'video' ? h('span', { class: 'att-play' }, icon('play')) : null);
        }
        return h('button', {
          type: 'button', class: 'att-file', title: 'Download ' + att.name,
          onclick: function (event) { event.stopPropagation(); download(att); }
        }, h('span', { class: 'att-file-icon' }, icon('file')),
        h('span', { class: 'att-file-text' }, h('strong', null, highlight(att.name)), h('span', { class: 'small' }, fileSize(att.size))));
      }

      /* ---------- Search ---------- */

      function matches(m) {
        if (!search.query) return false;
        const q = search.query.toLowerCase();
        return (m.text || '').toLowerCase().indexOf(q) !== -1 || (!!m.att && m.att.name.toLowerCase().indexOf(q) !== -1);
      }

      function highlight(text) {
        if (!search.query || !text) return text;
        const q = search.query.toLowerCase();
        const lower = text.toLowerCase();
        const parts = [];
        let at = 0;
        let found = lower.indexOf(q);
        while (found !== -1) {
          parts.push(text.slice(at, found), h('mark', null, text.slice(found, found + q.length)));
          at = found + q.length;
          found = lower.indexOf(q, at);
        }
        parts.push(text.slice(at));
        return parts;
      }

      /* ---------- Bubbles ---------- */

      function reactionsNode(m) {
        const all = m.reactions || {};
        const people = Object.keys(all);
        if (!people.length) return null;
        const emojis = [];
        people.forEach(function (uid) { if (emojis.indexOf(all[uid]) === -1) emojis.push(all[uid]); });
        const names = people.map(function (uid) { return (uid === me.id ? 'You' : first) + ' ' + all[uid]; }).join(', ');
        const mineToo = !!all[me.id];
        return h('button', {
          type: 'button', class: 'reactions' + (mineToo ? ' mine' : ''), title: names + (mineToo ? ' · Click to remove yours' : ''),
          'aria-label': 'Reactions: ' + names + (mineToo ? '. Click to remove your reaction.' : ''),
          onclick: function (event) {
            event.stopPropagation();
            if (mineToo) SOC.react(person.id, m.id, null).catch(function (error) { toast(error.message); });
          }
        }, emojis.join(''), people.length > 1 ? h('span', { class: 'num' }, String(people.length)) : null);
      }

      function picker(m) {
        const current = (m.reactions || {})[me.id];
        return h('div', { class: 'react-picker', role: 'group', 'aria-label': 'React to message' },
          REACTIONS.map(function (emoji) {
            return h('button', {
              type: 'button', class: emoji === current ? 'picked' : null, 'aria-label': 'React ' + emoji, 'aria-pressed': emoji === current ? 'true' : 'false',
              onclick: function (event) {
                event.stopPropagation();
                picking = null;
                redraw();
                SOC.react(person.id, m.id, emoji === current ? null : emoji).catch(function (error) { toast(error.message); });
              }
            }, emoji);
          }));
      }

      function bubbleLine(m, mine) {
        const content = h('div', { class: 'bubble-stack' },
          m.att ? attachmentNode(m) : null,
          m.text ? h('p', { class: 'bubble', title: clockTime(m.createdAt) + (m.editedAt ? ' · Edited ' + clockTime(m.editedAt) : '') }, highlight(m.text)) : null,
          reactionsNode(m));
        const line = h('div', { class: 'bubble-line' + (picking === m.id ? ' open' : '') });
        const reactBtn = h('button', {
          type: 'button', class: 'icon-btn bubble-tool', 'aria-label': 'React', title: 'React', 'aria-expanded': picking === m.id ? 'true' : 'false',
          onclick: function (event) { event.stopPropagation(); picking = picking === m.id ? null : m.id; redraw(); }
        }, icon('smile'));
        const tools = [reactBtn];
        if (mine) {
          tools.unshift(
            h('button', {
              type: 'button', class: 'icon-btn bubble-tool', 'aria-label': 'Unsend message', title: 'Unsend',
              onclick: async function (event) {
                event.stopPropagation();
                const ok = await ask({
                  title: 'Unsend message?',
                  body: 'This removes the message for you and ' + first + '. You can’t undo this.',
                  yes: 'Yes, unsend', no: 'No'
                });
                if (!ok) return;
                try {
                  await SOC.unsendMessage(person.id, m);
                  toast('Message unsent.');
                } catch (error) {
                  toast(error.message || 'We could not unsend that message.');
                }
              }
            }, icon('remove')),
            h('button', {
              type: 'button', class: 'icon-btn bubble-tool', 'aria-label': 'Edit message', title: 'Edit',
              onclick: function (event) { event.stopPropagation(); editing = { id: m.id, draft: m.text || '' }; picking = null; redraw(); }
            }, icon('edit')));
        }
        content.addEventListener('click', function () {
          thread.querySelectorAll('.bubble-line.open').forEach(function (l) { if (l !== line) l.classList.remove('open'); });
          line.classList.toggle('open');
        });
        if (mine) line.append.apply(line, tools.concat([content]));
        else line.append.apply(line, [content].concat(tools));
        if (picking === m.id) line.appendChild(picker(m));
        return line;
      }

      function editor(m) {
        const input = h('textarea', { class: 'bubble-input', rows: 1, maxlength: SOC.MESSAGE_MAX, 'aria-label': 'Edit message', placeholder: m.att ? 'Add a caption…' : '' });
        input.value = editing.draft;
        const grow = function () { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight + 2, 160) + 'px'; };
        const save = h('button', { type: 'submit', class: 'btn primary small' }, 'Save');
        const cancel = function () { editing = null; redraw(); };
        input.addEventListener('input', function () { editing.draft = input.value; grow(); });
        input.addEventListener('keydown', function (event) {
          if (event.key === 'Escape') { event.preventDefault(); cancel(); }
          if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
        });
        const form = h('form', {
          class: 'bubble-edit', novalidate: true,
          onsubmit: async function (event) {
            event.preventDefault();
            const body = input.value;
            if (body.trim() === (m.text || '')) { cancel(); return; }
            const problem = SOC.validateMessage(body);
            if (problem) { toast(problem); return; }
            save.disabled = true;
            try {
              await SOC.editMessage(person.id, m, body);
              editing = null;
              redraw();
            } catch (error) {
              save.disabled = false;
              toast(error.message || 'We could not edit that message.');
            }
          }
        }, input, h('div', { class: 'bubble-edit-actions' },
          h('button', { type: 'button', class: 'btn small', onclick: cancel }, 'Cancel'), save));
        setTimeout(function () {
          if (!input.isConnected) return;
          grow();
          input.focus({ preventScroll: true });
          input.setSelectionRange(input.value.length, input.value.length);
        }, 0);
        return form;
      }

      function drawMessages(messages) {
        if (closed) return;
        lastMessages = messages;
        if (editing && !messages.some(function (m) { return m.id === editing.id; })) editing = null;
        const nearBottom = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 120;
        const keepScroll = thread.scrollTop;
        receipt = null;
        if (!messages.length) {
          thread.replaceChildren(h('div', { class: 'chat-hint' },
            avatar(person, person.avatar, 4),
            h('p', null, h('strong', null, person.name)),
            h('p', { class: 'small muted' }, canSend
              ? 'Say hi to ' + first + '. Only the two of you can see this conversation.'
              : 'No messages yet.')));
        } else {
          const nodes = [];
          let lastDay = null;
          let newestMine = null;
          messages.forEach(function (m) { if (m.from === me.id) newestMine = m; });
          messages.forEach(function (m, i) {
            const day = new Date(m.createdAt).toDateString();
            if (day !== lastDay) {
              nodes.push(h('p', { class: 'chat-day small muted' }, dayLabel(m.createdAt)));
              lastDay = day;
            }
            const mine = m.from === me.id;
            const next = messages[i + 1];
            const lastOfRun = !next || next.from !== m.from || next.createdAt - m.createdAt > 5 * 60 * 1000 ||
              new Date(next.createdAt).toDateString() !== day;
            const stamp = clockTime(m.createdAt) + (m.editedAt ? ' · Edited' : '');
            const hit = matches(m);
            nodes.push(h('div', {
              class: 'bubble-row' + (mine ? ' mine' : '') + (m.pending ? ' pending' : '') + (hit ? ' hit' : '') + (hit && search.hits[search.index] === m.id ? ' current' : ''),
              'data-id': m.id
            },
            mine && editing && editing.id === m.id ? editor(m) : bubbleLine(m, mine),
            lastOfRun || m.editedAt ? h('span', { class: 'bubble-time small muted' }, lastOfRun ? stamp : 'Edited') : null,
            m === newestMine ? (receipt = h('span', { class: 'bubble-receipt small muted', 'aria-live': 'polite' })) : null));
          });
          receiptMsg = newestMine;
          thread.replaceChildren.apply(thread, nodes);
          updateReceipt();
        }
        if (search.open && search.query) refreshHits(false);
        if (firstDraw || (nearBottom && !search.query)) thread.scrollTop = thread.scrollHeight;
        else thread.scrollTop = keepScroll;
        firstDraw = false;
        if (mediaPanel.isConnected) fillMedia();
        seen();
      }

      document.addEventListener('click', function closePicker(event) {
        if (closed) { document.removeEventListener('click', closePicker); return; }
        if (picking && !event.target.closest('.react-picker')) { picking = null; redraw(); }
      });

      /* ---------- Search bar ---------- */

      const searchInput = h('input', { type: 'search', class: 'chat-search-input', placeholder: 'Search this chat', 'aria-label': 'Search this chat', autocomplete: 'off' });
      const searchCount = h('span', { class: 'small muted num chat-search-count', 'aria-live': 'polite' });
      const olderBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Older result', title: 'Older', onclick: function () { step(-1); } }, icon('up'));
      const newerBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Newer result', title: 'Newer', onclick: function () { step(1); } }, icon('down'));
      const searchBar = h('div', { class: 'chat-search', hidden: true },
        icon('search'), searchInput, searchCount, olderBtn, newerBtn,
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close search', title: 'Close search', onclick: function () { toggleSearch(false); } }, icon('close')));

      function refreshHits(jump) {
        const before = search.hits[search.index];
        search.hits = lastMessages.filter(matches).map(function (m) { return m.id; });
        if (jump || search.hits.indexOf(before) === -1) search.index = search.hits.length - 1;
        else search.index = search.hits.indexOf(before);
        searchCount.textContent = !search.query ? '' : search.hits.length ? (search.index + 1) + ' of ' + search.hits.length : 'No results';
        olderBtn.disabled = search.index <= 0;
        newerBtn.disabled = search.index < 0 || search.index >= search.hits.length - 1;
      }
      function focusHit() {
        thread.querySelectorAll('.bubble-row.current').forEach(function (r) { r.classList.remove('current'); });
        const id = search.hits[search.index];
        const row = id && thread.querySelector('[data-id="' + id + '"]');
        if (row) { row.classList.add('current'); row.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      }
      function step(dir) {
        if (!search.hits.length) return;
        search.index = Math.max(0, Math.min(search.hits.length - 1, search.index + dir));
        searchCount.textContent = (search.index + 1) + ' of ' + search.hits.length;
        olderBtn.disabled = search.index <= 0;
        newerBtn.disabled = search.index >= search.hits.length - 1;
        focusHit();
      }
      let searchTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          search.query = searchInput.value.trim();
          refreshHits(true);
          redraw();
          focusHit();
        }, 150);
      });
      searchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') { event.preventDefault(); step(event.shiftKey ? 1 : -1); }
        if (event.key === 'Escape') { event.preventDefault(); toggleSearch(false); }
      });
      function toggleSearch(open) {
        search.open = open;
        searchBar.hidden = !open;
        searchToggle.setAttribute('aria-pressed', open ? 'true' : 'false');
        if (open) { searchInput.focus(); return; }
        searchInput.value = '';
        search.query = '';
        search.hits = [];
        search.index = -1;
        searchCount.textContent = '';
        redraw();
      }
      const searchToggle = h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Search this chat', title: 'Search this chat', 'aria-pressed': 'false',
        onclick: function () { toggleSearch(!search.open); }
      }, icon('search'));

      /* ---------- Photos, videos and files panel ---------- */

      let mediaTab = 'photo';
      const mediaBody = h('div', { class: 'media-body' });
      const mediaTabs = h('div', { class: 'media-tabs', role: 'tablist', 'aria-label': 'Shared in this chat' });
      const mediaPanel = h('aside', { class: 'media-panel', 'aria-label': 'Photos, videos and files' },
        h('div', { class: 'media-head' },
          h('h2', null, 'Shared in this chat'),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: function () { toggleMedia(false); } }, icon('close'))),
        mediaTabs, mediaBody);

      function fillMedia() {
        const TABS = [['photo', 'Photos'], ['video', 'Videos'], ['file', 'Files']];
        const all = lastMessages.filter(function (m) { return m.att; }).reverse();
        mediaTabs.replaceChildren.apply(mediaTabs, TABS.map(function (t) {
          const count = all.filter(function (m) { return m.att.kind === t[0]; }).length;
          return h('button', {
            type: 'button', role: 'tab', class: 'media-tab' + (mediaTab === t[0] ? ' active' : ''), 'aria-selected': mediaTab === t[0] ? 'true' : 'false',
            onclick: function () { mediaTab = t[0]; fillMedia(); }
          }, t[1], h('span', { class: 'num small muted' }, String(count)));
        }));
        const items = all.filter(function (m) { return m.att.kind === mediaTab; });
        if (!items.length) {
          mediaBody.replaceChildren(h('p', { class: 'muted small media-empty' },
            mediaTab === 'photo' ? 'No photos yet.' : mediaTab === 'video' ? 'No videos yet.' : 'No files yet.'));
          return;
        }
        if (mediaTab === 'file') {
          mediaBody.replaceChildren(h('ul', { class: 'media-files' }, items.map(function (m) {
            return h('li', null, h('button', { type: 'button', class: 'att-file', onclick: function () { download(m.att); } },
              h('span', { class: 'att-file-icon' }, icon('file')),
              h('span', { class: 'att-file-text' }, h('strong', null, m.att.name),
                h('span', { class: 'small muted' }, fileSize(m.att.size) + ' · ' + (m.from === me.id ? 'You' : first) + ' · ' + dayLabel(m.createdAt))),
              h('span', { class: 'att-file-get' }, icon('download'))));
          })));
          return;
        }
        mediaBody.replaceChildren(h('div', { class: 'media-grid' }, items.map(function (m) {
          return h('button', {
            type: 'button', class: 'media-cell' + (m.att.kind === 'video' ? ' is-video' : ''),
            'aria-label': (m.att.kind === 'video' ? 'Play ' : 'Open ') + m.att.name + ', ' + dayLabel(m.createdAt),
            onclick: function () { openViewer(m); }
          },
          m.att.thumb ? h('img', { src: m.att.thumb, alt: '', loading: 'lazy' }) : h('span', { class: 'att-placeholder' }, icon(m.att.kind === 'video' ? 'video' : 'image')),
          m.att.kind === 'video' ? h('span', { class: 'att-play' }, icon('play')) : null);
        })));
      }
      function toggleMedia(open) {
        mediaToggle.setAttribute('aria-pressed', open ? 'true' : 'false');
        if (open) { box.classList.add('with-media'); box.appendChild(mediaPanel); fillMedia(); mediaPanel.querySelector('.media-tab.active').focus(); }
        else { box.classList.remove('with-media'); mediaPanel.remove(); }
      }
      const mediaToggle = h('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'Photos, videos and files', title: 'Photos, videos and files', 'aria-pressed': 'false',
        onclick: function () { toggleMedia(!mediaPanel.isConnected); }
      }, icon('gallery'));

      /* ---------- Composer ---------- */

      let composerBox;
      if (canSend) {
        let pending = null;
        const text = h('textarea', { id: 'f-message', name: 'message', rows: 1, maxlength: SOC.MESSAGE_MAX, placeholder: 'Message ' + first + '…', autocomplete: 'off' });
        const send = h('button', { class: 'btn primary', type: 'submit' }, 'Send');
        const grow = function () { text.style.height = 'auto'; text.style.height = Math.min(text.scrollHeight + 2, 160) + 'px'; };
        text.addEventListener('input', grow);
        const tray = h('div', { class: 'attach-tray', hidden: true });
        const mediaInput = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true });
        const fileInput = h('input', { type: 'file', hidden: true });
        const attachMenu = h('div', { class: 'attach-menu', hidden: true, role: 'menu' },
          h('button', { type: 'button', role: 'menuitem', onclick: function () { attachMenu.hidden = true; mediaInput.click(); } }, icon('image'), 'Photo or video'),
          h('button', { type: 'button', role: 'menuitem', onclick: function () { attachMenu.hidden = true; fileInput.click(); } }, icon('file'), 'File'));
        const attachBtn = h('button', {
          type: 'button', class: 'icon-btn attach-btn', 'aria-label': 'Add photo, video or file', title: 'Add photo, video or file', 'aria-haspopup': 'menu',
          onclick: function (event) { event.stopPropagation(); attachMenu.hidden = !attachMenu.hidden; }
        }, icon('clip'));
        document.addEventListener('click', function closeMenu(event) {
          if (closed) { document.removeEventListener('click', closeMenu); return; }
          if (!attachMenu.hidden && !event.target.closest('.attach-menu')) attachMenu.hidden = true;
        });

        function showTray() {
          if (!pending) { tray.hidden = true; tray.replaceChildren(); return; }
          tray.hidden = false;
          tray.replaceChildren(h('div', { class: 'attach-chip' },
            pending.thumb ? h('img', { src: pending.thumb, alt: '' }) : h('span', { class: 'att-file-icon' }, icon(pending.kind === 'video' ? 'video' : pending.kind === 'photo' ? 'image' : 'file')),
            h('span', { class: 'att-file-text' }, h('strong', null, pending.name), h('span', { class: 'small muted' }, fileSize(pending.size))),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove attachment', title: 'Remove', onclick: function () { pending = null; showTray(); text.focus(); } }, icon('close'))));
        }
        async function pick(file) {
          if (!file) return;
          tray.hidden = false;
          tray.replaceChildren(h('p', { class: 'small muted' }, 'Preparing ' + file.name + '…'));
          try {
            pending = await prepareAttachment(file);
          } catch (error) {
            pending = null;
            toast(error.message || 'We could not add that file.');
          }
          showTray();
          text.focus();
        }
        mediaInput.addEventListener('change', function () { pick(mediaInput.files[0]); mediaInput.value = ''; });
        fileInput.addEventListener('change', function () { pick(fileInput.files[0]); fileInput.value = ''; });

        const form = h('form', {
          class: 'chat-composer',
          novalidate: true,
          onsubmit: async function (event) {
            event.preventDefault();
            const body = text.value;
            if (!pending) {
              const problem = SOC.validateMessage(body);
              if (problem) { if (body.trim()) toast(problem); return; }
            }
            if (send.disabled) return;
            send.disabled = true;
            attachBtn.disabled = true;
            const sending = pending;
            text.value = '';
            grow();
            if (sending) { tray.replaceChildren(h('p', { class: 'small muted' }, 'Sending ' + sending.name + '…')); }
            try {
              await SOC.sendMessage(person.id, body, sending);
              if (pending === sending) pending = null;
            } catch (error) {
              if (!text.value) { text.value = body; grow(); }
              toast(error.message || 'We could not send your message.');
            } finally {
              showTray();
              send.disabled = false;
              attachBtn.disabled = false;
              if (text.isConnected) text.focus();
            }
          }
        }, h('label', { class: 'vh', for: 'f-message' }, 'Message'), attachBtn, attachMenu, mediaInput, fileInput, text, send);
        /* Enter sends, Shift+Enter adds a new line. */
        text.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
        });
        /* Paste a screenshot straight into the chat. */
        text.addEventListener('paste', function (event) {
          const file = event.clipboardData && Array.prototype.find.call(event.clipboardData.files || [], function (f) { return /^image\//.test(f.type); });
          if (file) { event.preventDefault(); pick(file); }
        });
        api.focus = function () { if (text.isConnected) text.focus({ preventScroll: true }); };
        setTimeout(function () { if (hooks.isOpen()) api.focus(); }, 0);
        composerBox = h('div', { class: 'chat-compose-wrap' }, tray, form);
      } else {
        composerBox = h('p', { class: 'chat-locked small muted' },
          'You can only message people in your circle. ',
          h('a', { href: '#u/' + person.username }, 'Add ' + first + ' to your circle'), ' to send a message.');
      }

      stop = SOC.watchMessages(person.id, drawMessages, function (error) {
        if (!closed) thread.replaceChildren(h('p', { class: 'empty' }, error.message));
      });

      box.replaceChildren(
        h('div', { class: 'chat-main' },
          h('header', { class: 'chat-head' },
            h('a', { class: 'person-link', href: '#u/' + person.username, title: 'View profile' },
              avatar(person, person.avatar, 2),
              h('span', { class: 'person-names' }, h('strong', { class: 'chat-name' }, person.name), h('span', { class: 'small muted' }, '@' + person.username))),
            h('div', { class: 'chat-head-tools' }, searchToggle, mediaToggle, windowTools())),
          searchBar,
          thread,
          composerBox));
    }

    load();
    return api;
  }

  /* ---------- Floating chat (Facebook-style, bottom right, on every page) ---------- */

  const dock = (function () {
    const MAX_BUBBLES = 5;
    const pop = h('section', { class: 'chat-pop', 'aria-label': 'Chat', hidden: true });
    const bubbles = h('div', { class: 'chat-bubbles' });
    const launcherBadge = h('span', { class: 'nav-badge chat-launcher-badge', hidden: true, 'data-kind': 'messages' });
    badges.push(launcherBadge);
    const launcher = h('button', {
      type: 'button', class: 'chat-launcher', 'aria-label': 'Messages: start or open a chat', title: 'Messages', 'aria-expanded': 'false',
      onclick: function () { if (picking) closePicker(); else openPicker(); }
    }, navIcon('messages'), launcherBadge);
    const el = h('div', { class: 'chat-dock', hidden: true }, pop, h('div', { class: 'chat-side' }, bubbles, launcher));
    document.body.appendChild(el);
    let picking = false;     /* the "who do you want to chat with?" search is open */
    let circleCache = null;

    let items = [];          /* [{ username, person }] — newest first */
    let active = null;       /* username shown in the open window, or null when everything is minimized */
    let panel = null;
    let owner = null;        /* user id the dock belongs to */
    let shown = false;
    let knownAt = null;      /* chat id -> lastAt we have already reacted to */

    function key() { return 'pbh.chatDock.' + owner; }
    function save() {
      try { localStorage.setItem(key(), JSON.stringify({ active: active, items: items.map(function (i) { return i.username; }) })); } catch (e) { /* storage off */ }
    }
    function restore() {
      try {
        const saved = JSON.parse(localStorage.getItem(key()) || 'null');
        if (saved && Array.isArray(saved.items)) {
          items = saved.items.filter(function (u) { return /^[A-Za-z0-9_]{3,20}$/.test(u); }).slice(0, MAX_BUBBLES).map(function (u) { return { username: u, person: null }; });
          active = items.some(function (i) { return i.username === saved.active; }) ? saved.active : null;
        }
      } catch (e) { items = []; active = null; }
    }
    function find(username) {
      const lower = username.toLowerCase();
      return items.find(function (i) { return i.username.toLowerCase() === lower; }) || null;
    }

    function isUnread(item) {
      return !!item.person && SOC.isUnread(SOC.chatWith(item.person.id));
    }

    function drawBubbles() {
      bubbles.replaceChildren.apply(bubbles, items.filter(function (i) { return i.username !== active; }).map(function (item) {
        const unread = isUnread(item);
        const name = item.person ? item.person.name : '@' + item.username;
        return h('div', { class: 'chat-bubble-wrap' },
          h('button', {
            type: 'button', class: 'chat-bubble' + (unread ? ' unread' : ''),
            'aria-label': 'Open chat with ' + name + (unread ? ' (new message)' : ''), title: name,
            onclick: function () { open(item.username); }
          }, item.person ? avatar(item.person, item.person.avatar, 3.25) : h('span', { class: 'avatar', style: '--size:3.25rem' }, '…'),
          unread ? h('span', { class: 'chat-bubble-dot', 'aria-hidden': 'true' }) : null),
          h('button', {
            type: 'button', class: 'chat-bubble-x', 'aria-label': 'Close chat with ' + name, title: 'Close',
            onclick: function () { close(item.username); }
          }, icon('close')));
      }));
      el.classList.toggle('has-bubbles', items.length > (active ? 1 : 0));
    }

    function ensurePerson(item) {
      if (item.person) return;
      SOC.findByUsername(item.username).then(function (person) {
        if (!person) { close(item.username); return; }
        item.person = person;
        item.username = person.username;
        drawBubbles();
      }).catch(function () {});
    }

    /* ---------- "Who do you want to chat with?" ---------- */

    function picker() {
      const input = h('input', { type: 'search', class: 'picker-search', placeholder: 'Search your circle', 'aria-label': 'Search your circle', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
      const list = h('div', { class: 'picker-list', 'aria-live': 'polite' }, h('p', { class: 'muted small chat-pop-note' }, 'Loading your circle…'));
      let people = circleCache;

      function drawList() {
        if (!people) return;
        const q = input.value.trim().toLowerCase().replace(/^@/, '');
        if (!people.length) {
          list.replaceChildren(h('div', { class: 'chat-pop-note small muted' },
            h('p', null, 'Your circle is empty.'),
            h('p', null, 'Add people from ', h('a', { href: '#circle', onclick: function () { closePicker(); } }, 'Circle'), ' to message them.')));
          return;
        }
        const ranked = people.map(function (p) { return { p: p, chat: SOC.chatWith(p.id) }; })
          .filter(function (r) { return !q || r.p.name.toLowerCase().indexOf(q) !== -1 || r.p.username.toLowerCase().indexOf(q) !== -1; })
          .sort(function (a, b) { return ((b.chat && b.chat.lastAt) || 0) - ((a.chat && a.chat.lastAt) || 0) || a.p.name.localeCompare(b.p.name); });
        if (!ranked.length) { list.replaceChildren(h('p', { class: 'muted small chat-pop-note' }, 'No one in your circle matches \u201c' + input.value.trim() + '\u201d.')); return; }
        const me = BT.currentUser();
        list.replaceChildren(h('ul', { class: 'picker-people' }, ranked.map(function (r) {
          const unread = SOC.isUnread(r.chat);
          return h('li', null, h('button', {
            type: 'button', class: 'picker-person' + (unread ? ' unread' : ''),
            onclick: function () { picking = false; launcher.setAttribute('aria-expanded', 'false'); open(r.p.username); }
          },
          avatar(r.p, r.p.avatar, 2.25),
          h('span', { class: 'picker-names' },
            h('strong', null, r.p.name),
            h('span', { class: 'small' + (unread ? '' : ' muted') }, r.chat && r.chat.lastText
              ? [(r.chat.lastFrom === me.id ? 'You: ' : ''), r.chat.lastText]
              : '@' + r.p.username)),
          unread ? h('span', { class: 'unread-dot' }, h('span', { class: 'vh' }, 'Unread')) : null));
        })));
      }

      input.addEventListener('input', drawList);
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); closePicker(); launcher.focus(); }
        if (event.key === 'Enter') { event.preventDefault(); const first = list.querySelector('.picker-person'); if (first) first.click(); }
      });
      SOC.circleMembers().then(function (found) { circleCache = people = found; if (list.isConnected || picking) drawList(); })
        .catch(function (error) { if (!people) list.replaceChildren(h('p', { class: 'muted small chat-pop-note' }, error.message || 'We could not load your circle.')); });
      drawList();
      setTimeout(function () { if (input.isConnected) input.focus({ preventScroll: true }); }, 0);

      const node = h('div', { class: 'chat-pop-body picker' },
        h('header', { class: 'chat-head' },
          h('strong', { class: 'picker-title' }, 'New message'),
          h('div', { class: 'chat-head-tools' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: function () { closePicker(); } }, icon('close')))),
        h('div', { class: 'picker-search-wrap' }, icon('search'), input),
        list);
      node.refresh = drawList;
      return node;
    }

    function openPicker() {
      if (!shown) return;
      picking = true;
      active = null;
      save();
      draw();
    }
    function closePicker() {
      picking = false;
      draw();
    }

    function mountPanel() {
      if (panel) { panel.destroy(); panel = null; }
      launcher.setAttribute('aria-expanded', picking ? 'true' : 'false');
      el.classList.toggle('picking', picking);
      if (picking && shown) {
        const node = picker();
        panel = { el: node, refresh: node.refresh, focus: function () {}, destroy: function () {} };
        pop.replaceChildren(node);
        pop.hidden = false;
        return;
      }
      if (!active || !shown) { pop.hidden = true; pop.replaceChildren(); return; }
      const item = find(active);
      panel = chatPanel(item.username, {
        isOpen: function () { return shown && active === item.username && !pop.hidden; },
        minimize: function () { minimize(); },
        close: function () { close(item.username); },
        onPerson: function (person) { item.person = person; drawBubbles(); }
      });
      pop.replaceChildren(panel.el);
      pop.hidden = false;
    }

    function draw() {
      el.hidden = !shown;
      drawBubbles();
      mountPanel();
    }

    /** Opens (or brings back) the chat window for a username. */
    function open(username) {
      let item = find(username);
      if (!item) {
        item = { username: username, person: null };
        items.unshift(item);
        if (items.length > MAX_BUBBLES) items = items.slice(0, MAX_BUBBLES);
      }
      if (active === item.username && panel && !picking) { panel.focus(); return; }
      picking = false;
      active = item.username;
      save();
      draw();
    }

    /** Shrinks the window into a circle at the bottom right. */
    function minimize() {
      active = null;
      picking = false;
      save();
      draw();
    }

    function close(username) {
      items = items.filter(function (i) { return i.username.toLowerCase() !== username.toLowerCase(); });
      if (active && active.toLowerCase() === username.toLowerCase()) active = null;
      save();
      draw();
    }

    /** Called on every page render: the dock shows only on signed-in pages. */
    function sync(visible) {
      const user = BT.currentUser();
      const id = visible && user ? user.id : null;
      if (id !== owner) {
        if (panel) { panel.destroy(); panel = null; }
        owner = id;
        items = []; active = null; knownAt = null; picking = false; circleCache = null;
        if (owner) restore();
        if (owner && SOC.chatsReady()) {
          knownAt = {};
          SOC.chats().forEach(function (c) { knownAt[c.id] = c.lastAt; });
        }
        items.forEach(ensurePerson);
        shown = !!owner;
        draw();
        return;
      }
      if (shown !== !!id) { shown = !!id; draw(); }
    }

    /** Chats changed: refresh the red glow, receipts, and pop up a circle for new incoming messages. */
    function onChats(list) {
      if (!owner) return;
      const me = BT.currentUser();
      if (knownAt === null) {
        if (!SOC.chatsReady()) return;
        knownAt = {};
        list.forEach(function (c) { knownAt[c.id] = c.lastAt; });
      } else {
        list.forEach(function (chat) {
          const before = knownAt[chat.id] || 0;
          knownAt[chat.id] = chat.lastAt;
          if (chat.lastAt <= before || !me || chat.lastFrom === me.id || !SOC.isUnread(chat)) return;
          SOC.getProfile(SOC.otherIn(chat)).then(function (person) {
            if (!person || owner !== me.id) return;
            let item = find(person.username);
            if (!item) {
              item = { username: person.username, person: person };
              items.unshift(item);
              if (items.length > MAX_BUBBLES) items = items.slice(0, MAX_BUBBLES);
              save();
            }
            item.person = item.person || person;
            drawBubbles();
            /* Give the circle a little bounce so it gets noticed. */
            const btn = Array.prototype.find.call(bubbles.querySelectorAll('.chat-bubble'), function (b) { return b.title === person.name; });
            if (btn) { btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop'); }
          }).catch(function () {});
        });
      }
      drawBubbles();
      if (panel) panel.refresh();
    }

    return { open: open, openPicker: openPicker, minimize: minimize, close: close, sync: sync, onChats: onChats };
  })();

  /* Any "Message" link opens the floating chat instead of leaving the page. */
  document.addEventListener('click', function (event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest && event.target.closest('a[href^="#chat/"]');
    if (!link) return;
    const username = link.getAttribute('href').slice(6);
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username) || !BT.currentUser()) return;
    event.preventDefault();
    dock.open(username);
  });

  /* ---------- Notifications ---------- */

  function viewNotifications() {
    const list = h('div');

    function draw(notes) {
      if (!list.isConnected && list.parentNode) return;
      if (!notes.length) {
        list.replaceChildren(h('p', { class: 'empty' }, 'No alerts yet. When someone adds you to their circle, you will see it here.'));
        return;
      }
      const ul = h('ul', { class: 'notes' });
      notes.forEach(function (note) {
        const li = h('li', { class: 'note' + (note.read ? '' : ' unread') }, h('p', { class: 'muted small' }, 'Loading…'));
        ul.appendChild(li);
        SOC.getProfile(note.from).then(function (person) {
          if (!person) { li.remove(); return; }
          const link = h('a', { href: '#u/' + person.username }, h('strong', null, person.name));
          const share = note.type === 'trust' ? SOC.trustFrom(person.id) : null;
          const text = note.type === 'request'
            ? h('p', null, link, ' wants to add you to their circle.')
            : note.type === 'trust'
            ? h('p', null, link, ' invited you as their trusted person. You\u2019ll be able to ',
                h('strong', null, share && share.role === 'edit' ? 'view and edit' : 'view'), ' their dashboard. Nobody else in their circle can see it.')
            : note.type === 'trusted'
            ? h('p', null, link, ' accepted. They can now see your dashboard.')
            : h('p', null, link, ' accepted your circle request.');
          let actions = null;
          if (note.type === 'trust' && (!share || share.status !== 'pending')) {
            /* The invite was cancelled, replaced or already handled. */
            if (!share) SOC.dismissNotification(note.id).catch(function () {});
            li.remove();
            return;
          }
          if (note.type === 'trust') {
            const accept = h('button', { type: 'button', class: 'btn primary' }, 'Accept');
            const decline = h('button', { type: 'button', class: 'btn' }, 'Decline');
            accept.addEventListener('click', async function () {
              accept.disabled = decline.disabled = true;
              try { await SOC.acceptTrust(person.id); toast('You can now see ' + person.name.split(' ')[0] + '\u2019s dashboard.'); location.hash = '#d/' + person.username; }
              catch (error) { accept.disabled = decline.disabled = false; toast(error.message); }
            });
            decline.addEventListener('click', async function () {
              accept.disabled = decline.disabled = true;
              try { await SOC.leaveTrust(person.id); toast('Invite declined.'); }
              catch (error) { accept.disabled = decline.disabled = false; toast(error.message); }
            });
            actions = h('div', { class: 'row' }, accept, decline);
          } else if (note.type === 'request') {
            const accept = h('button', { type: 'button', class: 'btn primary' }, 'Accept');
            const decline = h('button', { type: 'button', class: 'btn' }, 'Decline');
            accept.addEventListener('click', async function () {
              accept.disabled = decline.disabled = true;
              try { await SOC.acceptRequest(person.id); toast(person.name + ' is now in your circle.'); }
              catch (error) { accept.disabled = decline.disabled = false; toast(error.message); }
            });
            decline.addEventListener('click', async function () {
              accept.disabled = decline.disabled = true;
              try { await SOC.declineRequest(person.id); toast('Request declined.'); }
              catch (error) { accept.disabled = decline.disabled = false; toast(error.message); }
            });
            actions = h('div', { class: 'row' }, accept, decline);
          } else {
            actions = h('button', {
              type: 'button', class: 'icon-btn', 'aria-label': 'Dismiss', title: 'Dismiss',
              onclick: function () { SOC.dismissNotification(note.id).catch(function (e) { toast(e.message); }); }
            }, icon('over'));
          }
          li.replaceChildren(
            h('a', { href: '#u/' + person.username, tabindex: '-1', 'aria-hidden': 'true' }, avatar(person, person.avatar, 2.75)),
            h('div', { class: 'note-body' }, text, h('p', { class: 'small muted' }, timeAgo(note.createdAt))),
            actions);
        }).catch(function () { li.remove(); });
      });
      list.replaceChildren(ul);
    }

    draw(SOC.notifications());
    trustWatchers.push(function () { if (!list.isConnected) return false; draw(SOC.notifications()); });
    setTimeout(function () { SOC.markAllRead().catch(function () {}); }, 1500);
    return h('div', { class: 'wide' },
      h('h1', { style: 'margin-bottom:1.25rem' }, 'Alerts'),
      list,
      (function () { state.drawNotes = draw; return null; })());
  }

  /* ---------- Dashboard ---------- */

  /** Your own budget, read and written through BT. */
  function myBook() {
    const user = BT.currentUser();
    return {
      mine: true, canEdit: true, owner: user, currency: user.currency,
      list: BT.listTx, month: BT.monthTx,
      add: BT.addTx, update: BT.updateTx, remove: BT.deleteTx, restore: BT.restoreTx
    };
  }

  function viewDashboard(_, given) {
    const book = given && given.list ? given : myBook();
    const user = book.owner;
    const money = function (cents) { return BT.formatMoney(cents, book.currency); };
    const monthHeading = h('h2', { 'aria-live': 'polite' });
    const thisMonth = h('button', { type: 'button', class: 'link', onclick: function () { setMonth(BT.monthOf(BT.today())); } }, 'This month');
    const summary = h('div');
    const listBox = h('div');
    const filter = h('select', {
      id: 'f-filter',
      'aria-label': 'Show category',
      onchange: function () { state.filter = filter.value; drawList(); }
    },
      h('option', { value: 'all' }, 'All categories'),
      Object.keys(BT.TYPE_LABELS).map(function (type) { return h('option', { value: type }, BT.TYPE_LABELS[type]); }));
    filter.value = state.filter;
    state.editingId = null;

    /* ---- Entry form ---- */

    const hint = h('p', { class: 'hint small muted', id: 'tx-hint', style: 'margin-top:0.5rem' });
    const submitButton = h('button', { class: 'btn primary', type: 'submit' }, 'Add entry');
    const cancelButton = h('button', { type: 'button', class: 'btn', hidden: true, onclick: stopEditing }, 'Cancel');
    const formTitle = h('h2', null, 'Add an entry');

    const segments = h('fieldset', { class: 'segments' },
      h('legend', null, 'Category'),
      ['income', 'needs', 'wants', 'savings'].map(function (type) {
        return h('label', null,
          h('input', {
            type: 'radio',
            name: 'type',
            value: type,
            checked: state.txType === type,
            onchange: function () { state.txType = type; drawHint(); }
          }),
          BT.TYPE_LABELS[type]);
      }));

    const form = h('form', {
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        saveEntry();
      }
    },
      h('div', null, segments, hint),
      h('div', { class: 'tx-fields' },
        field({ name: 'desc', label: 'Description', wrapClass: 'span-all', attrs: { maxlength: 80, autocomplete: 'off' } }),
        field({ name: 'amount', label: 'Amount (' + book.currency + ')', type: 'number', attrs: { inputmode: 'decimal', step: '0.01', min: '0' } }),
        field({ name: 'date', label: 'Date', type: 'date' })),
      formError(),
      h('div', { class: 'tx-actions' }, submitButton, cancelButton));

    function drawHint() {
      const bucket = BT.BUCKETS.find(function (b) { return b.id === state.txType; });
      hint.textContent = bucket ? bucket.hint : 'Take-home pay after tax, from any source.';
    }

    function defaultDate() {
      const now = BT.today();
      return BT.monthOf(now) === state.month ? now : state.month + '-01';
    }

    async function saveEntry() {
      const desc = form.elements.desc.value.trim();
      const raw = form.elements.amount.value;
      const date = form.elements.date.value;
      const cents = Math.round(parseFloat(raw) * 100);
      const errors = {};
      if (!desc) errors.desc = 'Enter a description.';
      if (!raw || !isFinite(cents) || cents <= 0) errors.amount = 'Enter an amount above zero.';
      else if (cents > 100000000000000) errors.amount = 'That amount is too large.';
      if (!BT.parseDate(date)) errors.date = 'Enter a valid date.';
      if (Object.keys(errors).length) return showErrors(form, errors);

      const entry = { type: state.txType, desc: desc, cents: cents, date: date };
      if (submitButton.disabled) return;
      submitButton.disabled = true;
      try {
        if (state.editingId) {
          await book.update(state.editingId, entry);
          toast('Entry updated.');
        } else {
          await book.add(entry);
          const label = BT.TYPE_LABELS[entry.type];
          toast(label + ' entry added' + (BT.monthOf(date) !== state.month ? ' to ' + BT.monthLabel(BT.monthOf(date)) : '') + '.');
        }
      } catch (error) {
        return showErrors(form, { _form: error instanceof BT.UserError ? error.message : 'We could not save this entry.' });
      } finally {
        submitButton.disabled = false;
      }
      resetForm(BT.monthOf(date));
      form.elements.desc.focus();
    }

    function resetForm(month) {
      state.editingId = null;
      formTitle.textContent = 'Add an entry';
      submitButton.textContent = 'Add entry';
      cancelButton.hidden = true;
      form.elements.desc.value = '';
      form.elements.amount.value = '';
      clearErrors(form);
      if (month && month !== state.month) {
        state.month = month;
      }
      form.elements.date.value = defaultDate();
      drawAll();
    }

    function stopEditing() {
      resetForm();
      form.elements.desc.focus();
    }

    function startEditing(tx) {
      state.editingId = tx.id;
      state.txType = tx.type;
      formTitle.textContent = 'Edit entry';
      submitButton.textContent = 'Save changes';
      cancelButton.hidden = false;
      form.elements.type.value = tx.type;
      form.elements.desc.value = tx.desc;
      form.elements.amount.value = (tx.cents / 100).toFixed(2);
      form.elements.date.value = tx.date;
      clearErrors(form);
      drawHint();
      drawList();
      formTitle.scrollIntoView({ block: 'center' });
      form.elements.desc.focus();
    }

    async function removeEntry(tx) {
      let removed;
      try {
        removed = await book.remove(tx.id);
      } catch (error) {
        toast(error instanceof BT.UserError ? error.message : 'We could not delete this entry.');
        return;
      }
      if (!removed) return;
      if (state.editingId === tx.id) resetForm();
      else drawAll();
      toast('Entry deleted.', {
        label: 'Undo',
        run: function () {
          book.restore(removed).then(function () {
            if (state.refreshDashboard) state.refreshDashboard();
          }).catch(function (error) {
            toast(error instanceof BT.UserError ? error.message : 'We could not restore this entry.');
          });
        }
      });
    }

    /* ---- Summary ---- */

    function statusText(bucket, status) {
      if (bucket.target === 0 && bucket.spent === 0) return 'No target yet';
      switch (status.kind) {
        case 'over': return money(status.amount) + ' over';
        case 'near': return 'Almost at limit, ' + money(status.amount) + ' left';
        case 'left': return money(status.amount) + ' left';
        case 'met': return status.amount > 0 ? 'Goal met, ' + money(status.amount) + ' above' : 'Goal met';
        default: return money(status.amount) + ' to go';
      }
    }

    function drawBucket(bucket, income) {
      const status = BT.bucketStatus(bucket);
      const fill = Math.min(100, Math.round((isFinite(status.ratio) ? status.ratio : 1) * 100));
      const text = statusText(bucket, status);
      const iconName = { good: 'check', warning: 'warning', critical: 'over' }[status.state];
      const share = income > 0 ? Math.round((bucket.spent / income) * 100) + '% of income' : '';
      return h('div', { class: 'bucket', 'data-bucket': bucket.id },
        h('div', { class: 'bucket-head' },
          h('span', { class: 'name' }, bucket.label, h('span', null, bucket.share + '%')),
          h('span', { class: 'num' }, bucket.target > 0 ? money(bucket.spent) + ' of ' + money(bucket.target) : money(bucket.spent))),
        h('div', {
          class: 'meter',
          role: 'meter',
          'data-state': status.state,
          'aria-label': bucket.label + ' used',
          'aria-valuemin': 0,
          'aria-valuemax': 100,
          'aria-valuenow': fill,
          'aria-valuetext': text
        }, h('i', { style: 'width:' + fill + '%' })),
        h('div', { class: 'bucket-foot' },
          h('span', { class: 'status', 'data-state': status.state }, iconName ? icon(iconName) : null, text),
          h('span', { class: 'num' }, share)));
    }

    function drawSummary(transactions) {
      const data = BT.summarize(transactions);
      const overIncome = data.left < 0;
      const prompt = data.income === 0 && !book.canEdit
        ? h('div', { class: 'prompt' }, h('p', null, 'No income added for ' + BT.monthLabel(state.month) + ' yet.'))
        : data.income === 0
        ? h('div', { class: 'prompt' },
            h('p', null, 'Add your take-home income for ' + BT.monthLabel(state.month) + ' to see your 50/30/20 targets.'),
            h('div', { class: 'row' },
              h('button', {
                type: 'button',
                class: 'btn',
                onclick: function () {
                  state.txType = 'income';
                  form.elements.type.value = 'income';
                  drawHint();
                  form.elements.desc.focus();
                }
              }, 'Add income'),
              h('span', { class: 'small muted' }, 'Amounts are in ' + book.currency + '. ', book.mine ? h('a', { href: '#settings' }, 'Change currency') : null)))
        : null;

      summary.replaceChildren(
        h('dl', { class: 'stats' },
          h('div', null, h('dt', null, 'Income'), h('dd', null, money(data.income))),
          h('div', null, h('dt', null, 'Spent and saved'), h('dd', null, money(data.allocated))),
          h('div', null, h('dt', null, overIncome ? 'Over income by' : 'Left to assign'), h('dd', null, money(Math.abs(data.left))))),
        prompt || '',
        h('div', null, data.buckets.map(function (bucket) { return drawBucket(bucket, data.income); })));
    }

    /* ---- List ---- */

    function drawList() {
      const all = book.month(state.month);
      const rows = state.filter === 'all' ? all : all.filter(function (t) { return t.type === state.filter; });
      if (!rows.length) {
        listBox.replaceChildren(h('p', { class: 'empty' }, all.length ? 'No entries in this category.' : 'No entries for ' + BT.monthLabel(state.month) + ' yet.'));
        return;
      }
      listBox.replaceChildren(h('ul', { class: 'tx-list' }, rows.map(function (tx) {
        const label = tx.desc + ', ' + money(tx.cents);
        return h('li', { class: 'tx' + (tx.id === state.editingId ? ' editing' : '') },
          h('span', { class: 'tx-date' }, BT.shortDate(tx.date)),
          h('div', { class: 'tx-main' },
            h('div', { class: 'tx-desc' }, tx.desc),
            h('div', { class: 'tx-cat' }, BT.TYPE_LABELS[tx.type])),
          h('span', { class: 'tx-amount' }, (tx.type === 'income' ? '+' : '') + money(tx.cents)),
          !book.canEdit ? null : h('div', { class: 'tx-tools' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit ' + label, title: 'Edit', onclick: function () { startEditing(tx); } }, icon('edit')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete ' + label, title: 'Delete', onclick: function () { removeEntry(tx); } }, icon('remove'))));
      })));
    }

    function drawAll() {
      monthHeading.textContent = BT.monthLabel(state.month);
      thisMonth.hidden = state.month === BT.monthOf(BT.today());
      drawSummary(book.month(state.month));
      drawList();
    }

    function setMonth(month) {
      state.month = month;
      if (state.editingId) resetForm();
      else {
        form.elements.date.value = defaultDate();
        drawAll();
      }
    }

    function exportCsv() {
      const blob = new Blob(['﻿' + BT.toCsv(book.list())], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: 'passbookhub-' + (book.mine ? '' : user.username + '-') + BT.today() + '.csv' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    state.refreshDashboard = drawAll;
    form.elements.date.value = defaultDate();
    drawHint();
    drawAll();

    /* ---- Tabs: Savings tracker, Wallet, Savings, Credit, Loan, 50/30/20 ---- */
    const tracker = savingsTracker(book);
    const budgetPanel = h('div', { class: 'budget-panel' });
    const tabButtons = DASH_TABS.map(function (t) {
      return h('button', {
        type: 'button', role: 'tab', class: 'dash-tab', id: 'tab-' + t[0], 'aria-controls': t[0] === 'budget' ? 'panel-budget' : 'panel-tracker',
        onclick: function () { pickTab(t[0]); },
        onkeydown: function (event) {
          const i = DASH_TABS.findIndex(function (x) { return x[0] === t[0]; });
          let j = null;
          if (event.key === 'ArrowRight') j = (i + 1) % DASH_TABS.length;
          if (event.key === 'ArrowLeft') j = (i - 1 + DASH_TABS.length) % DASH_TABS.length;
          if (j !== null) { event.preventDefault(); pickTab(DASH_TABS[j][0]); tabButtons[j].focus(); }
        }
      }, t[1]);
    });
    const trackerPanel = h('div', { id: 'panel-tracker', role: 'tabpanel' }, tracker.el);
    function pickTab(name) {
      state.dashTab = name;
      tabButtons.forEach(function (b, i) {
        const on = DASH_TABS[i][0] === name;
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      trackerPanel.hidden = name === 'budget';
      budgetPanel.hidden = name !== 'budget';
      trackerPanel.setAttribute('aria-labelledby', 'tab-' + name);
      if (name !== 'budget') tracker.setTab(name);
    }
    tracker.onTab = function (name) { if (state.dashTab !== name) pickTab(name); };

    budgetPanel.id = 'panel-budget';
    budgetPanel.setAttribute('role', 'tabpanel');
    budgetPanel.setAttribute('aria-labelledby', 'tab-budget');
    budgetPanel.append(
      h('section', { 'aria-label': 'Monthly summary' },
        h('div', { class: 'month-nav' },
          monthHeading,
          thisMonth,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous month', title: 'Previous month', onclick: function () { setMonth(BT.addMonths(state.month, -1)); } }, icon('prev')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next month', title: 'Next month', onclick: function () { setMonth(BT.addMonths(state.month, 1)); } }, icon('next'))),
        summary),
      book.canEdit ? h('section', { class: 'section' }, formTitle, h('div', { style: 'margin-top:0.75rem' }, form)) : null,
      h('section', { class: 'section' },
        h('div', { class: 'list-head' },
          h('h2', null, 'Entries'),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'link', onclick: exportCsv }, 'Export CSV'),
            filter)),
        listBox));
    pickTab(DASH_TABS.some(function (t) { return t[0] === state.dashTab; }) ? state.dashTab : 'tracker');

    return h('div', { class: 'wide' },
      h('section', { class: 'identity' },
        avatar(user, user.avatar, 3.25),
        h('div', null,
          h('h1', null, user.name),
          user.bio ? h('p', { class: 'small muted' }, user.bio) : null),
        book.mine ? privatePin() : sharedBadge(book)),
      book.mine ? trustCard() : null,
      h('div', { class: 'dash-tabs', role: 'tablist', 'aria-label': 'Dashboard sections' }, tabButtons),
      trackerPanel,
      budgetPanel,
      h('p', { class: 'footnote' }, book.mine
        ? 'Your data is saved to your account, so you can sign in from any device.'
        : 'This is ' + user.name.split(' ')[0] + '\u2019s budget. Only ' + user.name.split(' ')[0] + ' and you can see it.'));
  }



  /* ---------- Savings tracker (bank accounts, wallets, credit cards, loans) ---------- */

  const DASH_TABS = [['tracker', 'Savings tracker'], ['wallet', 'Wallet'], ['savings', 'Savings'], ['credit', 'Credit'], ['loan', 'Loan'], ['budget', '50/30/20']];

  function amountsHidden() { try { return localStorage.getItem('pbh.hideAmounts') === '1'; } catch (e) { return false; } }
  function setAmountsHidden(on) { try { localStorage.setItem('pbh.hideAmounts', on ? '1' : '0'); } catch (e) { /* storage off */ } }

  const CHIP_SVG = '<svg viewBox="0 0 40 30" aria-hidden="true"><rect x="0.5" y="0.5" width="39" height="29" rx="5" fill="#e9cf8a" stroke="rgba(0,0,0,0.25)"/><path d="M0 10h13M0 20h13M27 10h13M27 20h13M13 0v30M27 0v30M13 15h14" stroke="rgba(0,0,0,0.3)" fill="none"/></svg>';
  const WAVES_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 7.5a6 6 0 0 1 0 9M12 5a9.5 9.5 0 0 1 0 14M15.5 2.5a13 13 0 0 1 0 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function svgNode(markup) { const d = document.createElement('span'); d.innerHTML = markup; return d.firstChild; }

  /**
   * The tracker for one dashboard. book: { mine, canEdit, owner, currency }.
   * Returns { el, setTab(tab) } — el holds the summary, the cards and the add tile.
   */
  function savingsTracker(book) {
    const money = function (cents) { return BT.formatMoney(cents, book.currency); };
    const el = h('section', { class: 'tracker', 'aria-live': 'polite' }, h('p', { class: 'muted small' }, 'Loading accounts…'));
    let accounts = null;
    let tab = 'tracker';
    let hidden = amountsHidden();

    const stop = SOC.watchAccounts(book.mine ? null : book.owner.id, function (list) {
      if (wasShown && !el.isConnected) { stop(); return; }
      accounts = list;
      draw();
    }, function (error) { el.replaceChildren(h('p', { class: 'empty' }, error.message)); });
    let wasShown = false;
    const prevCleanup = state.cleanup;
    state.cleanup = function () { stop(); if (prevCleanup) prevCleanup(); };

    function show(cents) { return hidden ? '••••••' : money(cents); }
    function sum(type) { return (accounts || []).filter(function (a) { return a.type === type; }).reduce(function (t, a) { return t + a.cents; }, 0); }

    function card(a) {
      const bank = BANKS.find(a.bank);
      const ink = BANKS.inkOn(bank.color);
      const owed = a.type === 'credit' || a.type === 'loan';
      const label = bank.name + ' ' + a.name + ', ' + SOC.ACCOUNT_TYPES[a.type] + ', ' + (owed ? 'owed ' : '') + (hidden ? 'amount hidden' : money(a.cents));
      return h(book.canEdit ? 'button' : 'div', {
        type: book.canEdit ? 'button' : null,
        class: 'bank-card' + (owed ? ' owed' : ''),
        style: '--card-bg:' + bank.color + ';--card-ink:' + ink + ';--card-accent:' + bank.accent,
        'aria-label': book.canEdit ? 'Edit ' + label : label,
        title: book.canEdit ? 'Edit account' : null,
        onclick: book.canEdit ? function () { openAccountForm(a); } : null
      },
      h('span', { class: 'bank-card-top' },
        h('span', { class: 'bank-card-bank' }, bank.name),
        h('span', { class: 'bank-card-type' }, SOC.ACCOUNT_TYPES[a.type])),
      h('span', { class: 'bank-card-mid' }, svgNode(CHIP_SVG), svgNode(WAVES_SVG)),
      h('span', { class: 'bank-card-bottom' },
        h('span', { class: 'bank-card-name' }, a.name),
        a.last4 ? h('span', { class: 'bank-card-last4 num' }, '•••• ' + a.last4) : null),
      h('span', { class: 'bank-card-amount num' }, (owed && a.cents > 0 && !hidden ? '− ' : '') + show(a.cents)));
    }

    function draw() {
      if (accounts === null) return;
      wasShown = wasShown || el.isConnected;
      const shown = tab === 'tracker' ? accounts : accounts.filter(function (a) { return a.type === tab; });
      const saved = sum('wallet') + sum('savings');
      const owed = sum('credit') + sum('loan');
      const eye = h('button', {
        type: 'button', class: 'icon-btn tracker-eye', 'aria-pressed': hidden ? 'true' : 'false',
        'aria-label': hidden ? 'Show amounts' : 'Hide amounts', title: hidden ? 'Show amounts' : 'Hide amounts',
        onclick: function () { hidden = !hidden; setAmountsHidden(hidden); draw(); }
      }, icon(hidden ? 'eyeClosed' : 'eye'));

      let head;
      if (tab === 'tracker') {
        head = h('div', { class: 'tracker-total' },
          h('div', null,
            h('p', { class: 'tracker-label' }, 'Total savings'),
            h('p', { class: 'tracker-big num' }, show(saved)),
            h('p', { class: 'small muted tracker-sub' },
              'Savings ', h('span', { class: 'num' }, show(sum('savings'))), ' · Wallet ', h('span', { class: 'num' }, show(sum('wallet'))),
              owed ? [' · Owed ', h('span', { class: 'num' }, show(owed)), ' · Net worth ', h('span', { class: 'num' }, (saved - owed < 0 && !hidden ? '−' : '') + show(Math.abs(saved - owed)))] : null)),
          eye);
      } else {
        const owedTab = tab === 'credit' || tab === 'loan';
        head = h('div', { class: 'tracker-total' },
          h('div', null,
            h('p', { class: 'tracker-label' }, owedTab ? 'Total ' + SOC.ACCOUNT_TYPES[tab].toLowerCase() + ' owed' : 'Total in ' + SOC.ACCOUNT_TYPES[tab].toLowerCase()),
            h('p', { class: 'tracker-big num' }, (owedTab && sum(tab) > 0 && !hidden ? '− ' : '') + show(sum(tab)))),
          eye);
      }

      const tiles = shown.map(card);
      if (book.canEdit) {
        tiles.push(h('button', { type: 'button', class: 'bank-card add', onclick: function () { openAccountForm(null, tab === 'tracker' ? null : tab); } },
          h('span', { class: 'add-plus', 'aria-hidden': 'true' }, '+'), h('span', null, 'Add account')));
      }
      el.replaceChildren(head,
        tiles.length ? h('div', { class: 'bank-grid' }, tiles)
          : h('p', { class: 'empty' }, tab === 'tracker' ? 'No accounts yet.' : 'No ' + SOC.ACCOUNT_TYPES[tab].toLowerCase() + ' accounts yet.'));
    }

    /* ---- Add or edit an account ---- */

    function openAccountForm(existing, presetType) {
      const banks = BANKS.forCurrency(book.currency);
      if (existing && !banks.some(function (b) { return b.id === existing.bank; })) banks.unshift(BANKS.find(existing.bank));
      let bankId = existing ? existing.bank : null;
      const previous = document.activeElement;

      const preview = h('div', { class: 'acct-preview' });
      const bankGrid = h('div', { class: 'bank-pick', role: 'radiogroup', 'aria-label': 'Bank' }, banks.map(function (b) {
        const ink = BANKS.inkOn(b.color);
        return h('button', {
          type: 'button', role: 'radio', class: 'bank-chip', 'data-bank': b.id, 'aria-checked': b.id === bankId ? 'true' : 'false',
          style: '--chip-bg:' + b.color + ';--chip-ink:' + ink + ';--chip-accent:' + b.accent,
          onclick: function () { bankId = b.id; syncPick(); refresh(); }
        }, b.name);
      }));
      function syncPick() {
        bankGrid.querySelectorAll('.bank-chip').forEach(function (c) { c.setAttribute('aria-checked', c.dataset.bank === bankId ? 'true' : 'false'); });
        const err = form.querySelector('.bank-error'); if (err) err.hidden = true;
      }

      const typeSelect = h('select', { id: 'f-acct-type', name: 'acct-type' },
        Object.keys(SOC.ACCOUNT_TYPES).map(function (k) { return h('option', { value: k }, SOC.ACCOUNT_TYPES[k]); }));
      typeSelect.value = existing ? existing.type : (presetType || 'savings');
      const nameIn = h('input', { id: 'f-acct-name', name: 'acct-name', maxlength: 40, autocomplete: 'off', placeholder: 'e.g. Emergency Fund' });
      const amountIn = h('input', { id: 'f-acct-amount', name: 'acct-amount', type: 'number', inputmode: 'decimal', step: '0.01', min: '0' });
      const last4In = h('input', { id: 'f-acct-last4', name: 'acct-last4', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', placeholder: 'Optional' });
      if (existing) { nameIn.value = existing.name; amountIn.value = (existing.cents / 100).toFixed(2); last4In.value = existing.last4 || ''; }
      const amountLabel = h('label', { for: 'f-acct-amount' });
      function refresh() {
        const owedType = typeSelect.value === 'credit' || typeSelect.value === 'loan';
        amountLabel.textContent = (owedType ? 'Amount owed' : 'Balance') + ' (' + book.currency + ')';
        const cents = Math.round(parseFloat(amountIn.value || '0') * 100) || 0;
        const temp = { bank: bankId || 'other', name: nameIn.value.trim() || 'Account name', type: typeSelect.value, cents: Math.max(0, cents), last4: /^[0-9]{4}$/.test(last4In.value) ? last4In.value : '' };
        const wasHidden = hidden; hidden = false;
        preview.replaceChildren(card(temp));
        hidden = wasHidden;
        preview.firstChild.tabIndex = -1;
        preview.firstChild.onclick = null;
        preview.firstChild.setAttribute('aria-hidden', 'true');
      }
      [typeSelect, nameIn, amountIn, last4In].forEach(function (c) { c.addEventListener('input', refresh); c.addEventListener('change', refresh); });

      const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
      const save = h('button', { type: 'submit', class: 'btn primary' }, existing ? 'Save' : 'Add account');
      const del = existing ? h('button', {
        type: 'button', class: 'btn danger',
        onclick: async function () {
          const ok = await ask({ title: 'Delete ' + existing.name + '?', body: 'This removes the account from your Savings tracker. You can’t undo this.', yes: 'Delete', no: 'Keep' });
          if (!ok) return;
          try { await SOC.deleteAccount(book.mine ? null : book.owner.id, existing.id); toast('Account deleted.'); close(); }
          catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
        }
      }, 'Delete') : null;

      function fieldErr(name) { return h('p', { class: 'error small', id: 'e-' + name, hidden: true }); }
      const form = h('form', {
        class: 'acct-form', novalidate: true,
        onsubmit: async function (event) {
          event.preventDefault();
          const raw = amountIn.value.trim();
          const cents = raw === '' ? 0 : Math.round(parseFloat(raw) * 100);
          const data = { bank: bankId, name: nameIn.value, type: typeSelect.value, cents: isFinite(cents) ? cents : -1, last4: last4In.value.trim() };
          const problems = SOC.validateAccount(data);
          form.querySelectorAll('.error').forEach(function (e) { e.hidden = true; });
          errorBox.hidden = true;
          if (problems) {
            Object.keys(problems).forEach(function (k) {
              const box = form.querySelector('#e-' + k);
              if (box) { box.textContent = problems[k]; box.hidden = false; }
            });
            const first = problems.bank ? bankGrid.querySelector('.bank-chip') : problems.name ? nameIn : problems.cents ? amountIn : last4In;
            first.focus();
            return;
          }
          save.disabled = true;
          try {
            if (existing) await SOC.updateAccount(book.mine ? null : book.owner.id, existing.id, data);
            else await SOC.addAccount(book.mine ? null : book.owner.id, data);
            toast(existing ? 'Account updated.' : BANKS.find(data.bank).name + ' account added.');
            if (!existing && tab !== 'tracker' && tab !== data.type) setTab(data.type);
            close();
          } catch (error) {
            save.disabled = false;
            errorBox.textContent = error.message; errorBox.hidden = false;
          }
        }
      },
      h('div', { class: 'acct-head' },
        h('h2', { id: 'acct-title' }, existing ? 'Edit account' : 'Add account'),
        h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', title: 'Close', onclick: function () { close(); } }, icon('close'))),
      preview,
      h('div', { class: 'acct-field' },
        h('span', { class: 'acct-label' }, book.currency === 'PHP' ? 'Bank or e-wallet' : 'Bank (' + book.currency + ')'),
        bankGrid, h('p', { class: 'error small bank-error', id: 'e-bank', hidden: true })),
      h('div', { class: 'acct-row' },
        h('div', { class: 'acct-field' }, h('label', { for: 'f-acct-type' }, 'Type'), typeSelect),
        h('div', { class: 'acct-field grow' }, h('label', { for: 'f-acct-name' }, 'Account name'), nameIn, fieldErr('name'))),
      h('div', { class: 'acct-row' },
        h('div', { class: 'acct-field grow' }, amountLabel, amountIn, fieldErr('cents')),
        h('div', { class: 'acct-field' }, h('label', { for: 'f-acct-last4' }, 'Last 4 digits'), last4In, fieldErr('last4'))),
      errorBox,
      h('div', { class: 'ask-actions' }, del, h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn', onclick: function () { close(); } }, 'Cancel'), save));

      const overlay = h('div', { class: 'chat-overlay ask acct-overlay' },
        h('div', { class: 'ask-card acct-card', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'acct-title' }, form));
      function onKey(event) { if (event.key === 'Escape') close(); }
      function close() {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        if (previous && previous.isConnected) previous.focus();
      }
      overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      refresh();
      (bankId ? nameIn : bankGrid.querySelector('.bank-chip')).focus();
    }

    function setTab(next) { tab = next; draw(); if (api.onTab) api.onTab(next); }
    const api = { el: el, setTab: setTab, onTab: null };
    return api;
  }

  /* ---------- Trusted person ---------- */

  /** "Private" or "Shared with Ana only", next to your name on the dashboard. */
  function privatePin() {
    const pin = h('span', { class: 'private-pin' });
    function draw() {
      const t = SOC.myTrust();
      const shared = t && t.status === 'accepted';
      if (shared) {
        SOC.getProfile(t.member).then(function (p) {
          if (!p || !pin.isConnected && pin.parentNode) return;
          pin.replaceChildren(icon('pin'), h('span', null, 'Shared with ' + p.name.split(' ')[0] + ' only'));
          pin.title = 'Only you and ' + p.name + ' can see this dashboard. The rest of your circle can’t.';
        }).catch(function () {});
      } else {
        pin.replaceChildren(icon('pin'), h('span', null, 'Private · only you can see this'));
        pin.title = 'Your dashboard is private. People in your circle can’t see your budget or entries.';
      }
    }
    draw();
    trustWatchers.push(function () { if (!pin.isConnected) return false; draw(); });
    return pin;
  }

  function sharedBadge(book) {
    const first = book.owner.name.split(' ')[0];
    return h('div', { class: 'shared-tools' },
      h('span', { class: 'private-pin shared' }, icon(book.canEdit ? 'edit' : 'eye'),
        h('span', null, book.canEdit ? 'Shared with you \u00b7 you can edit' : 'Shared with you \u00b7 view only')),
      h('button', {
        type: 'button', class: 'link small',
        onclick: async function () {
          const ok = await ask({ title: 'Stop seeing ' + first + '\u2019s dashboard?', body: first + ' would need to invite you again.', yes: 'Leave', no: 'Stay' });
          if (!ok) return;
          try { await SOC.leaveTrust(book.owner.id); toast('You left ' + first + '\u2019s dashboard.'); location.hash = '#dashboard'; }
          catch (error) { toast(error.message); }
        }
      }, 'Leave'));
  }


  const trustWatchers = [];
  /* Each watcher returns false once its screen is gone, and is then dropped. */
  function drawTrustWatchers() {
    for (let i = trustWatchers.length - 1; i >= 0; i--) {
      let keep = true;
      try { keep = trustWatchers[i]() !== false; } catch (e) { console.error(e); }
      if (!keep) trustWatchers.splice(i, 1);
    }
  }

  function roleSelect(value, onChange) {
    const select = h('select', { class: 'vis-select', 'aria-label': 'What they can do' },
      Object.keys(SOC.TRUST_ROLES).map(function (key) { return h('option', { value: key }, SOC.TRUST_ROLES[key]); }));
    select.value = value;
    if (onChange) select.addEventListener('change', function () { onChange(select.value); });
    return select;
  }

  /** The dashboard card where you invite your one trusted person. */
  function trustCard() {
    const card = h('section', { class: 'trust-card', 'aria-label': 'Trusted person' });
    let choosing = false;

    function draw() {
      if (!card.isConnected && card.parentNode) return;
      const t = SOC.myTrust();
      if (!SOC.trustLoaded()) { card.replaceChildren(h('p', { class: 'small muted' }, 'Loading…')); return; }
      if (choosing) { drawChooser(); return; }
      if (!t) {
        card.replaceChildren(
          h('div', { class: 'trust-text' },
            h('h2', null, 'Trusted person'),
            h('p', { class: 'small muted' }, 'Share this dashboard with one person from your circle. They can view it, or help you edit it. Nobody else can see it.')),
          h('button', { type: 'button', class: 'btn', onclick: function () { choosing = true; draw(); } }, icon('addPerson'), h('span', null, 'Invite')));
        return;
      }
      card.replaceChildren(h('p', { class: 'small muted' }, 'Loading…'));
      SOC.getProfile(t.member).then(function (person) {
        if (SOC.myTrust() !== t) return;
        const name = person ? person.name : 'Someone';
        const pending = t.status !== 'accepted';
        const remove = h('button', {
          type: 'button', class: 'btn small',
          onclick: async function () {
            const ok = await ask({
              title: pending ? 'Cancel invite?' : 'Remove ' + name.split(' ')[0] + '?',
              body: pending ? name + ' won’t be able to accept it.' : name + ' will no longer be able to see your dashboard.',
              yes: pending ? 'Cancel invite' : 'Remove', no: 'Keep'
            });
            if (!ok) return;
            remove.disabled = true;
            try { await SOC.removeTrusted(); toast(pending ? 'Invite cancelled.' : name + ' can no longer see your dashboard.'); }
            catch (error) { remove.disabled = false; toast(error.message); }
          }
        }, pending ? 'Cancel invite' : 'Remove');
        card.replaceChildren(
          h('div', { class: 'trust-who' },
            person ? avatar(person, person.avatar, 2.5) : null,
            h('div', { class: 'trust-text' },
              h('h2', null, 'Trusted person'),
              h('p', { class: 'small' }, h('strong', null, name),
                pending ? h('span', { class: 'muted' }, ' · invite sent, waiting for them to accept') : h('span', { class: 'muted' }, ' can see this dashboard')))),
          h('div', { class: 'trust-actions' },
            roleSelect(t.role, async function (role) {
              try { await SOC.setTrustRole(role); toast(name.split(' ')[0] + ' ' + (role === 'edit' ? 'can now edit.' : 'can now only view.')); }
              catch (error) { toast(error.message); draw(); }
            }),
            remove));
      }).catch(function () {});
    }

    function drawChooser() {
      let picked = null;
      const role = roleSelect('view');
      const send = h('button', { type: 'button', class: 'btn primary', disabled: true }, 'Send invite');
      const input = h('input', { type: 'search', placeholder: 'Search your circle', 'aria-label': 'Search your circle', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false' });
      const list = h('ul', { class: 'trust-pick', role: 'listbox', 'aria-label': 'People in your circle' }, h('li', { class: 'small muted' }, 'Loading your circle…'));
      let people = null;
      function drawList() {
        if (!people) return;
        if (!people.length) {
          list.replaceChildren(h('li', { class: 'small muted' }, 'Your circle is empty. Add people from ', h('a', { href: '#circle' }, 'Circle'), ' first.'));
          return;
        }
        const q = input.value.trim().toLowerCase().replace(/^@/, '');
        const shown = people.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) !== -1 || p.username.toLowerCase().indexOf(q) !== -1; });
        if (!shown.length) { list.replaceChildren(h('li', { class: 'small muted' }, 'No one in your circle matches that.')); return; }
        list.replaceChildren.apply(list, shown.map(function (p) {
          const isPicked = picked && picked.id === p.id;
          return h('li', null, h('button', {
            type: 'button', role: 'option', class: 'picker-person' + (isPicked ? ' picked' : ''), 'aria-selected': isPicked ? 'true' : 'false',
            onclick: function () { picked = p; send.disabled = false; drawList(); }
          }, avatar(p, p.avatar, 2), h('span', { class: 'picker-names' }, h('strong', null, p.name), h('span', { class: 'small muted' }, '@' + p.username)),
          isPicked ? icon('check') : null));
        }));
      }
      input.addEventListener('input', drawList);
      SOC.circleMembers().then(function (found) { people = found; drawList(); })
        .catch(function (error) { list.replaceChildren(h('li', { class: 'small muted' }, error.message)); });
      send.addEventListener('click', async function () {
        if (!picked) return;
        send.disabled = true;
        try {
          await SOC.inviteTrusted(picked.id, role.value, BT.currentUser().currency);
          choosing = false;
          toast('Invite sent to ' + picked.name + '.');
          draw();
        } catch (error) { send.disabled = false; toast(error.message); }
      });
      card.replaceChildren(
        h('div', { class: 'trust-text' },
          h('h2', null, 'Invite your trusted person'),
          h('p', { class: 'small muted' }, 'Pick one person. They’ll get an alert and need to accept first.')),
        h('div', { class: 'trust-chooser' },
          input, list,
          h('div', { class: 'trust-actions' },
            h('label', { class: 'small muted' }, 'They can: '), role,
            h('span', { class: 'grow' }),
            h('button', { type: 'button', class: 'btn', onclick: function () { choosing = false; draw(); } }, 'Cancel'),
            send)));
      setTimeout(function () { if (input.isConnected) input.focus(); }, 0);
    }

    draw();
    trustWatchers.push(function () { if (!card.isConnected) return false; if (!choosing) draw(); });
    return card;
  }

  /* ---------- Someone else's dashboard (you are their trusted person) ---------- */

  function viewShared() {
    const username = location.hash.slice(3);
    const box = h('div', null, h('div', { class: 'wide' }, h('p', { class: 'muted' }, 'Loading dashboard…')));
    let stop = null, closed = false;
    state.cleanup = function () { closed = true; if (stop) stop(); stop = null; };

    function denied(text) {
      box.replaceChildren(h('div', { class: 'wide' }, h('div', { class: 'empty-state' },
        h('h1', null, 'You can’t see this dashboard'),
        h('p', { class: 'muted' }, text),
        h('a', { class: 'btn', href: '#dashboard' }, 'Back to your dashboard'))));
    }

    SOC.findByUsername(username).then(function (person) {
      if (closed) return;
      if (!person) { denied('No one on PassbookHub has the username @' + username + '.'); return; }
      if (person.id === BT.currentUser().id) { location.hash = '#dashboard'; return; }
      document.title = person.name.split(' ')[0] + '’s dashboard · PassbookHub';
      let txs = [];
      let ready = false;
      let shownFor = null;
      function share() { const t = SOC.trustFrom(person.id); return t && t.status === 'accepted' ? t : null; }
      const book = {
        mine: false, owner: person,
        get canEdit() { const t = share(); return !!t && t.role === 'edit'; },
        get currency() { const t = share(); return (t && t.currency) || 'PHP'; },
        list: function () { return txs.slice(); },
        month: function (m) {
          return txs.filter(function (t) { return BT.monthOf(t.date) === m; }).sort(function (a, b) {
            return a.date === b.date ? b.createdAt - a.createdAt : (a.date < b.date ? 1 : -1);
          });
        },
        add: function (tx) { return SOC.addSharedTx(person.id, tx); },
        update: function (id, changes) { return SOC.updateSharedTx(person.id, id, changes); },
        remove: async function (id) { const t = txs.find(function (x) { return x.id === id; }); if (!t) return null; await SOC.deleteSharedTx(person.id, id); return t; },
        restore: function (tx) { return SOC.restoreSharedTx(person.id, tx); }
      };
      function render() {
        if (closed) return;
        const t = share();
        if (!SOC.trustLoaded()) return;
        if (!t) { if (stop) { stop(); stop = null; } denied(person.name + ' hasn’t shared their dashboard with you, or stopped sharing it.'); shownFor = null; return; }
        if (!stop) {
          stop = SOC.watchSharedTx(person.id, function (list) {
            txs = list; ready = true;
            if (state.refreshDashboard && shownFor) state.refreshDashboard(); else render();
          }, function (error) { if (!closed) denied(error.message); });
        }
        if (!ready) return;
        const key = t.role + '|' + t.currency;
        if (shownFor === key) { if (state.refreshDashboard) state.refreshDashboard(); return; }
        shownFor = key;
        box.replaceChildren(viewDashboard(null, book));
      }
      state.onTrustChange = render;
      render();
    }).catch(function (error) { if (!closed) denied(error.message); });
    return box;
  }

  /* ---------- Start ---------- */

  SOC.onChats(function (list) {
    drawBadges();
    dock.onChats(list);
  });
  SOC.onTrust(function () {
    drawTrustWatchers();
    if (state.onTrustChange) state.onTrustChange();
    const t = SOC.myTrust();
    const user = BT.currentUser();
    if (t && user) SOC.syncTrustCurrency(user.currency);
  });
  BT.onTxChange(function () {
    if (state.view === 'dashboard' && state.refreshDashboard) state.refreshDashboard();
  });
  SOC.onNotifications(function (notes) {
    drawBadges();
    if (state.view === 'alerts' && state.drawNotes) {
      state.drawNotes(notes);
      SOC.markAllRead().catch(function () {});
    }
  });
  root.replaceChildren(h('div', { class: 'narrow' }, h('p', { class: 'muted', role: 'status' }, 'Loading…')));
  window.addEventListener('hashchange', function () { if (state.view !== null) render(); });
  BT.onSessionChange(render);
})();
