/* Loads Firebase, then the app. Kept separate so the rest of the code stays plain scripts. */
const VERSION = '12.19.0';
const base = 'https://www.gstatic.com/firebasejs/' + VERSION + '/';

function fail(message) {
  const main = document.getElementById('app');
  const box = document.createElement('div');
  box.className = 'narrow';
  const title = document.createElement('h1');
  title.textContent = 'PassbookHub';
  const text = document.createElement('p');
  text.textContent = message;
  box.append(title, text);
  main.replaceChildren(box);
}

try {
  const config = window.BudgetConfig && window.BudgetConfig.firebase;
  if (!config || !config.apiKey) throw new Error('missing config');
  const [appMod, authMod, fsMod] = await Promise.all([
    import(base + 'firebase-app.js'),
    import(base + 'firebase-auth.js'),
    import(base + 'firebase-firestore.js')
  ]);
  const app = appMod.initializeApp(config);
  window.FB = { auth: authMod.getAuth(app), db: fsMod.getFirestore(app), A: authMod, F: fsMod };
  await import('./i18n.js?v=2');
  await import('./core.js?v=11');
  await import('./social.js?v=12');
  await import('./app.js?v=22');
} catch (error) {
  console.error(error);
  fail('PassbookHub could not start. Check your internet connection and reload the page.');
}
