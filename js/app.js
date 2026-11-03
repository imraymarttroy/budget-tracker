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
    over: '<circle cx="10" cy="10" r="7.5"/><path d="m7 7 6 6M13 7l-6 6"/>'
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
          toggle.textContent = showing ? 'Show' : 'Hide';
          toggle.setAttribute('aria-pressed', String(!showing));
        }
      }, 'Show');
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
    const user = BT.currentUser();
    if (!user) return ['signin', 'signup', 'forgot'].indexOf(wanted) !== -1 ? wanted : 'signin';
    if (!user.verified) return 'verify';
    if (!user.profileDone) return 'setup';
    return wanted === 'profile' ? 'profile' : 'dashboard';
  }

  const VIEWS = {
    signin: { title: 'Sign in', render: viewAuth },
    signup: { title: 'Sign up', render: viewAuth },
    forgot: { title: 'Reset password', render: viewForgot },
    verify: { title: 'Verify your email', render: viewVerify },
    setup: { title: 'Set up your profile', render: viewSetup },
    dashboard: { title: 'Dashboard', render: viewDashboard },
    profile: { title: 'Profile', render: viewProfile },
    offline: { title: 'Could not load', render: viewOffline },
    orphan: { title: 'Finish signing up', render: viewOrphan }
  };

  function render() {
    const view = resolveView();
    if (location.hash !== '#' + view) history.replaceState(null, '', '#' + view);
    const changed = view !== state.view;
    state.view = view;
    state.refreshDashboard = null;
    document.title = VIEWS[view].title + ' · PassbookHub';
    root.replaceChildren(VIEWS[view].render(view));
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
    return h('div', { class: 'narrow' },
      h('header', { class: 'intro' },
        h('h1', { class: 'brand' }, 'PassbookHub'),
        h('p', { class: 'muted' }, 'Half for needs, some for wants, the rest for later.')),
      h('nav', { class: 'tabs', 'aria-label': 'Account' },
        h('a', { href: '#signin', 'aria-current': view === 'signin' ? 'page' : null }, 'Sign in'),
        h('a', { href: '#signup', 'aria-current': view === 'signup' ? 'page' : null }, 'Sign up')),
      notice ? h('p', { class: 'notice', role: 'status', style: 'margin-bottom:1rem' }, notice) : null,
      view === 'signin' ? signInForm() : signUpForm());
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
      field({ name: 'email', label: 'Email', type: 'email', attrs: { autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false' } }),
      field({ name: 'password', label: 'Password', type: 'password', attrs: { autocomplete: 'current-password' } }),
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Sign in'),
      h('p', { class: 'small' }, h('a', { href: '#forgot' }, 'Forgot password?')));
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
      field({ name: 'name', label: 'Name', hint: 'This becomes your profile name.', attrs: { autocomplete: 'name', maxlength: 60 } }),
      field({ name: 'birthday', label: 'Birthday', type: 'date', hint: 'You must be ' + BT.MIN_AGE + ' or older.', attrs: { autocomplete: 'bday', max: BT.today() } }),
      field({ name: 'username', label: 'Username', attrs: { autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false', maxlength: 20 } }),
      field({ name: 'password', label: 'Password', type: 'password', hint: 'At least 8 characters.', attrs: { autocomplete: 'new-password', maxlength: 128 } }),
      field({ name: 'email', label: 'Email', type: 'email', hint: 'We use this to verify your account.', attrs: { autocomplete: 'email', autocapitalize: 'none', spellcheck: 'false' } }),
      formError(),
      h('button', { class: 'btn primary full', type: 'submit' }, 'Create account'));
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

  function viewProfile() {
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
          toast('Profile saved.');
          location.hash = '#dashboard';
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
        h('a', { class: 'link', href: '#dashboard' }, 'Cancel')));

    const dangerBox = h('div');
    function showDelete() {
      dangerBox.replaceChildren(h('button', { type: 'button', class: 'btn', onclick: showConfirm }, 'Delete account'));
    }
    function showConfirm() {
      const cancel = h('button', { type: 'button', class: 'btn', onclick: function () { showDelete(); dangerBox.querySelector('button').focus(); } }, 'Keep account');
      const confirmForm = h('form', {
        class: 'stack',
        novalidate: true,
        onsubmit: function (event) {
          event.preventDefault();
          const password = confirmForm.elements.password.value;
          if (!password) return showErrors(confirmForm, { password: 'Enter your password.' });
          busy(confirmForm, 'Deleting…', async function () {
            await BT.deleteAccount(password);
            state.notice = 'Your account has been deleted.';
            location.hash = '#signin';
          });
        }
      },
        h('p', { class: 'small' }, 'This permanently deletes your profile and every transaction. Enter your password to confirm.'),
        field({ name: 'password', label: 'Password', type: 'password', attrs: { autocomplete: 'current-password' } }),
        formError(),
        h('div', { class: 'row' },
          h('button', { type: 'submit', class: 'btn danger' }, 'Yes, delete everything'),
          cancel));
      dangerBox.replaceChildren(confirmForm);
      confirmForm.elements.password.focus();
    }
    showDelete();

    return h('div', { class: 'wide' },
      topbar(),
      h('div', { style: 'max-width:26rem' },
        h('h1', { style: 'margin-bottom:1.5rem' }, 'Profile'),
        form,
        h('section', { class: 'section' },
          h('h2', null, 'Account'),
          h('dl', { class: 'account-details', style: 'margin-top:0.75rem' },
            h('dt', null, 'Username'), h('dd', null, '@' + user.username),
            h('dt', null, 'Email'), h('dd', null, user.email),
            h('dt', null, 'Birthday'), h('dd', null, BT.longDate(user.birthday)))),
        h('section', { class: 'section' }, h('h2', { style: 'margin-bottom:0.75rem' }, 'Delete account'), dangerBox)));
  }

  function topbar() {
    return h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#dashboard' }, 'PassbookHub'),
      h('nav', { 'aria-label': 'Main' },
        h('a', { class: 'link', href: '#dashboard', 'aria-current': state.view === 'dashboard' ? 'page' : null }, 'Dashboard'),
        h('a', { class: 'link', href: '#profile', 'aria-current': state.view === 'profile' ? 'page' : null }, 'Profile'),
        h('button', {
          type: 'button',
          class: 'link',
          onclick: function () {
            toastBox.hidden = true;
            state.notice = 'You have signed out.';
            location.hash = '#signin';
            BT.signOut();
          }
        }, 'Sign out')));
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
              h('span', { class: 'small muted' }, 'Amounts are in ' + user.currency + '. ', h('a', { href: '#profile' }, 'Change currency'))))
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
      topbar(),
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

  root.replaceChildren(h('div', { class: 'narrow' }, h('p', { class: 'muted', role: 'status' }, 'Loading…')));
  window.addEventListener('hashchange', function () { if (state.view !== null) render(); });
  BT.onSessionChange(render);
})();
