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
    pending: '<circle cx="10" cy="10" r="7.5"/><path d="M10 6v4l2.5 2"/>'
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
    });
    if (errors._form) {
      const summary = form.querySelector('.form-error');
      summary.textContent = errors._form;
      summary.hidden = false;
    }
    if (first) first.focus();
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
    return ['profile', 'circle', 'messages', 'notifications', 'settings'].indexOf(wanted) !== -1 ? wanted : 'dashboard';
  }

  /* Views that show the sidebar. Only the signed-in owner of the account ever sees it. */
  const SHELL_VIEWS = ['dashboard', 'profile', 'person', 'circle', 'messages', 'chat', 'notifications', 'settings'];

  const VIEWS = {
    signin: { title: 'Sign in', render: viewAuth },
    signup: { title: 'Sign up', render: viewAuth },
    forgot: { title: 'Reset password', render: viewForgot },
    verify: { title: 'Verify your email', render: viewVerify },
    setup: { title: 'Set up your profile', render: viewSetup },
    dashboard: { title: 'Dashboard', render: viewDashboard },
    profile: { title: 'Profile', render: viewTimeline },
    person: { title: 'Profile', render: viewPerson },
    circle: { title: 'Circle', render: viewCircle },
    messages: { title: 'Messages', render: viewMessages },
    chat: { title: 'Messages', render: viewChat },
    notifications: { title: 'Notifications', render: viewNotifications },
    settings: { title: 'Settings', render: viewSettings },
    offline: { title: 'Could not load', render: viewOffline },
    orphan: { title: 'Finish signing up', render: viewOrphan },
    complete: { title: 'Finish signing up', render: viewComplete }
  };

  function render() {
    const view = resolveView();
    if (!BT.currentUser() && socialFor) { socialFor = null; SOC.stopWatching(); SOC.stopWatchingChats(); }
    if (state.cleanup) { state.cleanup(); state.cleanup = null; }
    if (view === 'person' || view === 'chat') {
      /* keep #u/username and #chat/username as they are */
    } else if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    const changed = view !== state.view;
    state.view = view;
    state.refreshDashboard = null;
    document.title = VIEWS[view].title + ' · PassbookHub';
    document.body.classList.toggle('auth-body', view === 'signin' || view === 'signup');
    const content = VIEWS[view].render(view);
    if (SHELL_VIEWS.indexOf(view) !== -1) {
      startSocial();
      root.replaceChildren(shell(view, content));
    } else {
      root.replaceChildren(content);
    }
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
          h('span', null, 'Half for needs, some for wants, the rest for later.'))));
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
          ? 'Your money, split by the 50/30/20 rule.'
          : 'Follow these simple steps to set up your account.')),
      h('ol', { class: 'auth-steps' + (signin ? ' split' : '') },
        cards.map(function (card, i) {
          return h('li', { class: i === 0 ? 'active' : null },
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
      class: 'stack',
      novalidate: true,
      onsubmit: function (event) {
        event.preventDefault();
        const email = form.elements.email.value.trim().toLowerCase();
        const password = form.elements.password.value;
        const errors = {};
        if (!BT.validEmail(email)) errors.email = 'Enter your email address.';
        if (!password) errors.password = 'Enter your password.';
        if (Object.keys(errors).length) return showErrors(form, errors);
        busy(form, 'Signing in…', async function () {
          const ok = await BT.signIn(email, password);
          if (!ok) {
            form.elements.password.value = '';
            showErrors(form, { _form: 'Incorrect email or password.' });
            form.elements.password.focus();
          }
          /* On success the session listener loads the account and redraws. */
        });
      }
    },
      field({ name: 'email', label: 'Email', type: 'email', attrs: { autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false', placeholder: 'you@example.com' } }),
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
  }

  function shell(view, content) {
    const user = BT.currentUser();
    const current = view === 'chat' ? 'messages' : view;
    function item(name, href, label) {
      const link = h('a', { class: 'nav-item', href: href, 'aria-current': current === name ? 'page' : null }, navIcon(name), h('span', null, label));
      if (name === 'notifications' || name === 'messages') {
        const badge = h('span', { class: 'nav-badge', hidden: true, 'data-kind': name });
        badges.push(badge);
        link.appendChild(badge);
      }
      return h('li', null, link);
    }
    const side = h('aside', { class: 'sidebar' },
      h('a', { class: 'brand sidebar-brand', href: '#dashboard' }, 'PassbookHub'),
      h('a', { class: 'sidebar-me', href: '#profile' },
        avatar(user, user.avatar, 2.25),
        h('span', null, h('strong', null, user.name), h('span', { class: 'small muted' }, '@' + user.username))),
      h('nav', { 'aria-label': 'Main' },
        h('ul', { class: 'nav-list' },
          item('dashboard', '#dashboard', 'Dashboard'),
          item('profile', '#profile', 'Profile'),
          item('circle', '#circle', 'Circle'),
          item('messages', '#messages', 'Messages'),
          item('notifications', '#notifications', 'Notifications'),
          item('settings', '#settings', 'Settings'),
          h('li', null, h('button', {
            type: 'button',
            class: 'nav-item',
            onclick: function () {
              toastBox.hidden = true;
              state.notice = 'You have signed out.';
              socialFor = null;
              SOC.stopWatching();
              SOC.stopWatchingChats();
              location.hash = '#signin';
              BT.signOut();
            }
          }, navIcon('signout'), h('span', null, 'Sign out'))))));
    drawBadges();
    return h('div', { class: 'app-shell' }, side, h('div', { class: 'app-main' }, content));
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
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
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

  function viewTimeline() {
    const user = BT.currentUser();
    const person = Object.assign({ id: user.id }, { name: user.name, username: user.username, avatar: user.avatar, bio: user.bio });
    const posts = postList(person, 'self');
    return h('div', { class: 'wide' },
      profileHeader(person, h('a', { class: 'btn', href: '#settings' }, 'Edit profile'), circleCount(user.id)),
      composer(user, function () { posts.reload(); }),
      h('h2', { class: 'posts-title' }, 'Posts'),
      posts);
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

  function viewPerson() {
    const username = location.hash.slice(3);
    const box = h('div', { class: 'wide' }, h('p', { class: 'muted' }, 'Loading profile…'));
    async function load() {
      try {
        const person = await SOC.findByUsername(username);
        if (!box.isConnected && box.parentNode) return;
        if (!person) {
          box.replaceChildren(h('div', { class: 'empty-state' },
            h('h1', null, 'Profile not found'),
            h('p', { class: 'muted' }, 'No one on PassbookHub has the username @' + username + '.'),
            h('a', { class: 'btn', href: '#circle' }, 'Search for people')));
          return;
        }
        if (person.id === BT.currentUser().id) { location.hash = '#profile'; return; }
        const rel = await SOC.relation(person.id);
        document.title = person.name + ' · PassbookHub';
        box.replaceChildren(
          profileHeader(person, rel === 'circle'
            ? h('div', { class: 'row' }, messageButton(person, true), relationActions(person, rel, load))
            : relationActions(person, rel, load), null),
          rel === 'circle' ? null : h('p', { class: 'small muted vis-note' },
            rel === 'none' || rel === 'sent' ? 'You can see ' + person.name.split(' ')[0] + '’s public posts. Join their circle to see posts shared with their circle.' : ''),
          h('h2', { class: 'posts-title' }, 'Posts'),
          postList(person, rel));
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

  function viewMessages() {
    const list = h('div', null, h('p', { class: 'muted small' }, 'Loading messages…'));

    function draw(chats) {
      if (!list.isConnected && list.parentNode) return;
      if (!SOC.chatsReady()) return;
      if (!chats.length) {
        list.replaceChildren(h('div', { class: 'empty' },
          h('p', null, 'No messages yet.'),
          h('p', { class: 'small', style: 'margin-top:0.5rem' }, 'Open your ', h('a', { href: '#circle' }, 'circle'), ' and tap Message to start a conversation.')));
        return;
      }
      const ul = h('ul', { class: 'people chats' });
      chats.forEach(function (chat) {
        const li = h('li', { class: 'person' }, h('p', { class: 'muted small', style: 'padding:0.5rem' }, 'Loading…'));
        ul.appendChild(li);
        SOC.getProfile(SOC.otherIn(chat)).then(function (person) {
          if (!person) { li.remove(); return; }
          const unread = SOC.isUnread(chat);
          li.className = 'person' + (unread ? ' unread' : '');
          li.replaceChildren(h('a', { class: 'person-link', href: '#chat/' + person.username },
            avatar(person, person.avatar, 2.75),
            h('span', { class: 'person-names chat-names' },
              h('span', { class: 'chat-top' }, h('strong', null, person.name), h('span', { class: 'small muted num' }, timeAgo(chat.lastAt))),
              h('span', { class: 'small chat-preview' + (unread ? '' : ' muted') }, (chat.lastFrom === BT.currentUser().id ? 'You: ' : '') + chat.lastText)),
            unread ? h('span', { class: 'unread-dot' }, h('span', { class: 'vh' }, 'Unread')) : null));
        }).catch(function () { li.remove(); });
      });
      list.replaceChildren(ul);
    }

    state.drawChats = draw;
    draw(SOC.chats());
    return h('div', { class: 'wide' },
      h('div', { class: 'list-head', style: 'margin-bottom:1.25rem' },
        h('h1', null, 'Messages'),
        h('a', { class: 'btn', href: '#circle' }, 'New message')),
      list);
  }

  function clockTime(ms) {
    return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function dayLabel(ms) {
    const d = new Date(ms);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
  }

  function viewChat() {
    const username = location.hash.slice(6);
    const box = h('div', { class: 'wide chat-page' }, h('p', { class: 'muted' }, 'Loading conversation…'));
    let stop = null;
    let closed = false;
    state.cleanup = function () { closed = true; if (stop) stop(); stop = null; state.onChatsChange = null; };

    async function load() {
      try {
        const person = await SOC.findByUsername(username);
        if (closed) return;
        if (!person) {
          box.replaceChildren(h('div', { class: 'empty-state' },
            h('h1', null, 'Person not found'),
            h('p', { class: 'muted' }, 'No one on PassbookHub has the username @' + username + '.'),
            h('a', { class: 'btn', href: '#messages' }, 'Back to messages')));
          return;
        }
        if (person.id === BT.currentUser().id) { location.hash = '#messages'; return; }
        const rel = await SOC.relation(person.id);
        if (closed) return;
        document.title = person.name + ' · Messages · PassbookHub';
        draw(person, rel === 'circle');
      } catch (error) {
        if (!closed) box.replaceChildren(h('p', { class: 'empty' }, error.message || 'We could not load this conversation.'));
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

      const parentCleanup = state.cleanup;
      state.cleanup = function () {
        parentCleanup();
        Object.keys(urls).forEach(function (k) { URL.revokeObjectURL(urls[k]); });
        document.querySelectorAll('.chat-overlay').forEach(function (d) { d.remove(); });
      };

      function seen() {
        if (document.visibilityState === 'visible') SOC.markSeen(person.id).catch(function () {});
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
      state.onChatsChange = function () { seen(); updateReceipt(); };
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
        setTimeout(function () { if (text.isConnected) text.focus({ preventScroll: true }); }, 0);
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
            h('a', { class: 'icon-btn', href: '#messages', 'aria-label': 'Back to messages', title: 'Back to messages' }, icon('prev')),
            h('a', { class: 'person-link', href: '#u/' + person.username },
              avatar(person, person.avatar, 2.5),
              h('span', { class: 'person-names' }, h('h1', { class: 'chat-name' }, person.name), h('span', { class: 'small muted' }, '@' + person.username))),
            h('div', { class: 'chat-head-tools' }, searchToggle, mediaToggle)),
          searchBar,
          thread,
          composerBox));
    }

    load();
    return box;
  }

  /* ---------- Notifications ---------- */

  function viewNotifications() {
    const list = h('div');

    function draw(notes) {
      if (!list.isConnected && list.parentNode) return;
      if (!notes.length) {
        list.replaceChildren(h('p', { class: 'empty' }, 'No notifications yet. When someone adds you to their circle, you will see it here.'));
        return;
      }
      const ul = h('ul', { class: 'notes' });
      notes.forEach(function (note) {
        const li = h('li', { class: 'note' + (note.read ? '' : ' unread') }, h('p', { class: 'muted small' }, 'Loading…'));
        ul.appendChild(li);
        SOC.getProfile(note.from).then(function (person) {
          if (!person) { li.remove(); return; }
          const link = h('a', { href: '#u/' + person.username }, h('strong', null, person.name));
          const text = note.type === 'request'
            ? h('p', null, link, ' wants to add you to their circle.')
            : h('p', null, link, ' accepted your circle request.');
          let actions = null;
          if (note.type === 'request') {
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
    setTimeout(function () { SOC.markAllRead().catch(function () {}); }, 1500);
    return h('div', { class: 'wide' },
      h('h1', { style: 'margin-bottom:1.25rem' }, 'Notifications'),
      list,
      (function () { state.drawNotes = draw; return null; })());
  }

  /* ---------- Dashboard ---------- */

  function viewDashboard() {
    const user = BT.currentUser();
    const money = function (cents) { return BT.formatMoney(cents, user.currency); };
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
        field({ name: 'amount', label: 'Amount (' + user.currency + ')', type: 'number', attrs: { inputmode: 'decimal', step: '0.01', min: '0' } }),
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
          await BT.updateTx(state.editingId, entry);
          toast('Entry updated.');
        } else {
          await BT.addTx(entry);
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
        removed = await BT.deleteTx(tx.id);
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
          BT.restoreTx(removed).then(function () {
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
      const prompt = data.income === 0
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
              h('span', { class: 'small muted' }, 'Amounts are in ' + user.currency + '. ', h('a', { href: '#settings' }, 'Change currency'))))
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
      const all = BT.monthTx(state.month);
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
          h('div', { class: 'tx-tools' },
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Edit ' + label, title: 'Edit', onclick: function () { startEditing(tx); } }, icon('edit')),
            h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Delete ' + label, title: 'Delete', onclick: function () { removeEntry(tx); } }, icon('remove'))));
      })));
    }

    function drawAll() {
      monthHeading.textContent = BT.monthLabel(state.month);
      thisMonth.hidden = state.month === BT.monthOf(BT.today());
      drawSummary(BT.monthTx(state.month));
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
      const blob = new Blob(['﻿' + BT.toCsv(BT.listTx())], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: 'passbookhub-' + BT.today() + '.csv' });
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }

    state.refreshDashboard = drawAll;
    form.elements.date.value = defaultDate();
    drawHint();
    drawAll();

    return h('div', { class: 'wide' },
      h('section', { class: 'identity' },
        avatar(user, user.avatar, 3.25),
        h('div', null,
          h('h1', null, user.name),
          user.bio ? h('p', { class: 'small muted' }, user.bio) : null)),
      h('section', { 'aria-label': 'Monthly summary' },
        h('div', { class: 'month-nav' },
          monthHeading,
          thisMonth,
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Previous month', title: 'Previous month', onclick: function () { setMonth(BT.addMonths(state.month, -1)); } }, icon('prev')),
          h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Next month', title: 'Next month', onclick: function () { setMonth(BT.addMonths(state.month, 1)); } }, icon('next'))),
        summary),
      h('section', { class: 'section' }, formTitle, h('div', { style: 'margin-top:0.75rem' }, form)),
      h('section', { class: 'section' },
        h('div', { class: 'list-head' },
          h('h2', null, 'Entries'),
          h('div', { class: 'row' },
            h('button', { type: 'button', class: 'link', onclick: exportCsv }, 'Export CSV'),
            filter)),
        listBox),
      h('p', { class: 'footnote' }, 'Your data is saved to your account, so you can sign in from any device.'));
  }

  /* ---------- Start ---------- */

  SOC.onChats(function (list) {
    drawBadges();
    if (state.view === 'messages' && state.drawChats) state.drawChats(list);
    if (state.view === 'chat' && state.onChatsChange) state.onChatsChange();
  });
  SOC.onNotifications(function (notes) {
    drawBadges();
    if (state.view === 'notifications' && state.drawNotes) {
      state.drawNotes(notes);
      SOC.markAllRead().catch(function () {});
    }
  });
  root.replaceChildren(h('div', { class: 'narrow' }, h('p', { class: 'muted', role: 'status' }, 'Loading…')));
  window.addEventListener('hashchange', function () { if (state.view !== null) render(); });
  BT.onSessionChange(render);
})();
