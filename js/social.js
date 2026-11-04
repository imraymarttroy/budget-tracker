/* Public profiles, posts, circles and notifications (Firebase). No DOM code lives here. */
window.SOC = (function () {
  'use strict';

  const F = function () { return window.FB.F; };
  const db = function () { return window.FB.db; };
  const me = function () { return window.FB.auth.currentUser && window.FB.auth.currentUser.uid; };

  const VISIBILITY = {
    public: { label: 'Public', hint: 'Anyone on PassbookHub' },
    circle: { label: 'Circle', hint: 'Only people in your circle' },
    private: { label: 'Only me', hint: 'Only you' }
  };
  const POST_MAX = 500;

  function friendly(error) {
    if (error instanceof BT.UserError) return error;
    console.error(error);
    const code = (error && error.code) || '';
    if (code === 'unavailable') return new BT.UserError('We could not reach the server. Check your connection and try again.');
    if (code === 'permission-denied') return new BT.UserError('You do not have permission to do that.');
    return new BT.UserError('Something went wrong. Please try again.');
  }

  async function run(work) {
    try { return await work(); } catch (error) { throw friendly(error); }
  }

  const profileDoc = function (uid) { return F().doc(db(), 'profiles', uid); };
  const postsCol = function (uid) { return F().collection(db(), 'profiles', uid, 'posts'); };
  const circleDoc = function (owner, member) { return F().doc(db(), 'profiles', owner, 'circle', member); };
  const requestDoc = function (to, from) { return F().doc(db(), 'profiles', to, 'requests', from); };
  const notesCol = function (uid) { return F().collection(db(), 'profiles', uid, 'notifications'); };

  /* ---------- Public profiles ---------- */

  const profileCache = {};

  function publicFields(user) {
    return {
      name: user.name,
      nameLower: user.name.toLowerCase(),
      username: user.username,
      usernameLower: user.username.toLowerCase(),
      avatar: user.avatar || null,
      bio: user.bio || '',
      updatedAt: Date.now()
    };
  }

  /** Copies the shareable parts of the signed-in person's account to their public profile. */
  async function syncProfile(user) {
    const data = publicFields(user);
    /* merge keeps the cover photo, education and work, which live only on the public profile. */
    await run(function () { return F().setDoc(profileDoc(user.id), data, { merge: true }); });
    profileCache[user.id] = Object.assign({ id: user.id }, profileCache[user.id] || {}, data);
  }

  /* ---------- Profile extras: cover photo, education, work ---------- */

  const COVER_MAX = 450000;
  const EDU_MAX = 3;
  const WORK_MAX = 6;

  function cleanText(value, max) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max); }

  /** Checks and tidies { cover, education: [{school, course, year}], work: [{title, company, start, end}] }. */
  function cleanExtras(extras) {
    const education = (extras.education || []).map(function (e) {
      return { school: cleanText(e.school, 80), course: cleanText(e.course, 80), year: cleanText(e.year, 20) };
    }).filter(function (e) { return e.school || e.course; }).slice(0, EDU_MAX);
    const work = (extras.work || []).map(function (w) {
      return { title: cleanText(w.title, 60), company: cleanText(w.company, 80), start: /^[0-9]{4}-[0-9]{2}$/.test(w.start || '') ? w.start : '', end: /^[0-9]{4}-[0-9]{2}$/.test(w.end || '') ? w.end : '' };
    }).filter(function (w) { return w.title || w.company; }).slice(0, WORK_MAX);
    work.forEach(function (w) { if (w.start && w.end && w.end < w.start) throw new BT.UserError('A job can\u2019t end before it starts (' + (w.title || w.company) + ').'); });
    const cover = extras.cover || null;
    if (cover && (typeof cover !== 'string' || cover.indexOf('data:image/jpeg;base64,') !== 0 || cover.length >= COVER_MAX)) throw new BT.UserError('That cover photo is too large. Try a smaller image.');
    return { cover: cover, education: education, work: work };
  }

  /* The cover photo lives in profiles/{uid}/cover/photo so lists and chats don't download it. */
  const coverDoc = function (uid) { return F().doc(db(), 'profiles', uid, 'cover', 'photo'); };

  async function saveProfileExtras(extras) {
    const data = cleanExtras(extras);
    const batch = F().writeBatch(db());
    batch.update(profileDoc(me()), { education: data.education, work: data.work });
    if (data.cover) batch.set(coverDoc(me()), { data: data.cover, updatedAt: Date.now() });
    else batch.delete(coverDoc(me()));
    await run(function () { return batch.commit(); });
    profileCache[me()] = Object.assign({ id: me() }, profileCache[me()] || {}, { education: data.education, work: data.work });
    return data;
  }

  /* ---------- What your circle may see: total savings and birthday ----------
     profiles/{uid}/circleinfo/main = { showSavings, savingsCents, currency, showBirthday, birthday (MM-DD), updatedAt }.
     Only you and people in your circle can read it, and nothing is stored unless you turn it on. */

  const circleInfoDoc = function (uid) { return F().doc(db(), 'profiles', uid, 'circleinfo', 'main'); };
  let myInfo;   /* undefined = not loaded yet */

  async function loadCircleInfo(uid) {
    try {
      const snap = await F().getDoc(circleInfoDoc(uid || me()));
      const info = snap.exists() ? snap.data() : null;
      if (!uid || uid === me()) myInfo = info;
      return info;
    } catch (error) {
      if (error && error.code === 'permission-denied') return null;
      throw friendly(error);
    }
  }

  /** Turns sharing on or off. birthday is YYYY-MM-DD from the account; only the month and day are kept. */
  async function saveCircleInfo(opts) {
    const data = {
      showSavings: !!opts.showSavings,
      savingsCents: opts.showSavings && Number.isInteger(opts.savingsCents) ? Math.max(0, opts.savingsCents) : null,
      currency: opts.currency || 'PHP',
      showBirthday: !!opts.showBirthday,
      birthday: opts.showBirthday && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(opts.birthday || '') ? opts.birthday.slice(5) : null,
      updatedAt: Date.now()
    };
    await run(function () { return F().setDoc(circleInfoDoc(me()), data); });
    myInfo = data;
    return data;
  }

  /** First visit: the birthday (month and day) is shown to your circle unless you turn it off. */
  async function ensureDefaultCircleInfo(birthday, currency) {
    if (myInfo === undefined) await loadCircleInfo().catch(function () {});
    if (myInfo || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(birthday || '')) return myInfo || null;
    return saveCircleInfo({ showSavings: false, showBirthday: true, birthday: birthday, currency: currency });
  }

  /** Keeps the shared savings total current. Does nothing unless sharing is on. */
  async function publishSavings(cents, currency) {
    if (myInfo === undefined) await loadCircleInfo().catch(function () {});
    if (!myInfo || !myInfo.showSavings) return;
    if (myInfo.savingsCents === cents && myInfo.currency === currency) return;
    const update = { savingsCents: cents, currency: currency, updatedAt: Date.now() };
    await F().updateDoc(circleInfoDoc(me()), update).then(function () { Object.assign(myInfo, update); }).catch(function (e) { console.error(e); });
  }

  /** Wallet + savings, the same "Total savings" the tracker shows. */
  async function savingsTotal(owner) {
    const snap = await run(function () { return F().getDocs(accountsCol(owner || me())); });
    return snap.docs.reduce(function (t, d) { const a = d.data(); return a.type === 'wallet' || a.type === 'savings' ? t + a.cents : t; }, 0);
  }

  /* ---------- Notes: a short line above your picture, for your circle, gone after 24 hours ---------- */

  const NOTE_MAX = 10;
  const NOTE_GIF_MAX = 600000;
  const NOTE_TTL = 24 * 60 * 60 * 1000;
  const noteDoc = function (uid) { return F().doc(db(), 'profiles', uid, 'note', 'current'); };

  /** The note if it is still fresh, else null. Circle members only (and you). */
  async function loadNote(uid) {
    try {
      const snap = await F().getDoc(noteDoc(uid || me()));
      if (!snap.exists()) return null;
      const n = snap.data();
      return n.at && Date.now() - n.at < NOTE_TTL ? n : null;
    } catch (error) {
      if (error && error.code === 'permission-denied') return null;
      throw friendly(error);
    }
  }
  /** text up to 10 characters, gif an optional data:image/gif URL. At least one of them. */
  async function saveNote(text, gif) {
    const clean = String(text || '').trim().replace(/\s+/g, ' ');
    if (!clean && !gif) throw new BT.UserError('Write a short note or add a GIF.');
    if (Array.from(clean).length > NOTE_MAX) throw new BT.UserError('Keep it to ' + NOTE_MAX + ' characters.');
    if (gif && (typeof gif !== 'string' || gif.indexOf('data:image/gif;base64,') !== 0 || gif.length >= NOTE_GIF_MAX)) throw new BT.UserError('That GIF is too large. Try one under 400 KB.');
    const data = { text: clean, at: Date.now() };
    if (gif) data.gif = gif;
    await run(function () { return F().setDoc(noteDoc(me()), data); });
    return data;
  }
  async function deleteNote() {
    await run(function () { return F().deleteDoc(noteDoc(me())); });
  }

  async function loadCover(uid) {
    const snap = await run(function () { return F().getDoc(coverDoc(uid)); });
    return snap.exists() ? snap.data().data : null;
  }

  /** Fresh copy of a profile (skips the cache), for the profile page. */
  async function loadProfile(uid) {
    const snap = await run(function () { return F().getDoc(profileDoc(uid)); });
    if (!snap.exists()) return null;
    profileCache[uid] = Object.assign({ id: uid }, snap.data());
    return profileCache[uid];
  }

  /** Posts from you and your circle, newest first. */
  async function feedPosts(limit) {
    const people = await circleMembers();
    const sources = [{ person: Object.assign({ id: me() }, profileCache[me()] || {}), rel: 'self' }]
      .concat(people.map(function (p) { return { person: p, rel: 'circle' }; }));
    const lists = await Promise.all(sources.map(function (src) {
      return listPosts(src.person.id, src.rel).then(function (posts) {
        return posts.map(function (post) { return { person: src.person, post: post, mine: src.rel === 'self' }; });
      }).catch(function () { return []; });
    }));
    return [].concat.apply([], lists).sort(function (a, b) { return b.post.createdAt - a.post.createdAt; }).slice(0, limit || 60);
  }

  /** Makes sure accounts created before profiles existed get one. */
  async function ensureProfile(user) {
    const snap = await run(function () { return F().getDoc(profileDoc(user.id)); });
    if (!snap.exists()) await syncProfile(user);
    else profileCache[user.id] = Object.assign({ id: user.id }, snap.data());
  }

  async function getProfile(uid) {
    if (profileCache[uid]) return profileCache[uid];
    const snap = await run(function () { return F().getDoc(profileDoc(uid)); });
    if (!snap.exists()) return null;
    profileCache[uid] = Object.assign({ id: uid }, snap.data());
    return profileCache[uid];
  }

  async function findByUsername(username) {
    const q = F().query(F().collection(db(), 'profiles'), F().where('usernameLower', '==', username.toLowerCase()), F().limit(1));
    const result = await run(function () { return F().getDocs(q); });
    if (result.empty) return null;
    const d = result.docs[0];
    profileCache[d.id] = Object.assign({ id: d.id }, d.data());
    return profileCache[d.id];
  }

  /** Matches the start of a name or username. Returns up to 20 people, never yourself. */
  async function search(text) {
    const blocked = await blockedIds().catch(function () { return {}; });
    const term = text.trim().toLowerCase().replace(/^@/, '');
    if (!term) return [];
    const col = F().collection(db(), 'profiles');
    function prefix(field) {
      return F().query(col, F().orderBy(field), F().startAt(term), F().endAt(term + ''), F().limit(20));
    }
    const results = await run(function () { return Promise.all([F().getDocs(prefix('usernameLower')), F().getDocs(prefix('nameLower'))]); });
    const seen = {};
    const people = [];
    results.forEach(function (snap) {
      snap.docs.forEach(function (d) {
        if (seen[d.id] || d.id === me() || blocked[d.id]) return;
        seen[d.id] = true;
        profileCache[d.id] = Object.assign({ id: d.id }, d.data());
        people.push(profileCache[d.id]);
      });
    });
    return people.slice(0, 20);
  }

  /* ---------- Circle ---------- */

  /* ---------- Blocking: profiles/{me}/blocked/{uid}. Only you can read your list. ----------
     A blocked person leaves your circle, no longer shows in your search, and can't send you a circle request. */

  const blockedDoc = function (uid) { return F().doc(db(), 'profiles', me(), 'blocked', uid); };
  let blockedCache = null;

  async function blockedList() {
    const snap = await run(function () { return F().getDocs(F().collection(db(), 'profiles', me(), 'blocked')); });
    const list = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return b.at - a.at; });
    blockedCache = {};
    list.forEach(function (b) { blockedCache[b.id] = true; });
    return list;
  }
  async function blockedIds() {
    if (!blockedCache) await blockedList();
    return blockedCache;
  }

  async function blockPerson(person) {
    const batch = F().writeBatch(db());
    batch.set(blockedDoc(person.id), { at: Date.now(), name: String(person.name || '').slice(0, 60), username: String(person.username || '').slice(0, 20) });
    batch.delete(circleDoc(me(), person.id));
    batch.delete(circleDoc(person.id, me()));
    batch.delete(requestDoc(me(), person.id));
    batch.delete(requestDoc(person.id, me()));
    await run(function () { return batch.commit(); });
    if (blockedCache) blockedCache[person.id] = true;
  }

  async function unblockPerson(uid) {
    await run(function () { return F().deleteDoc(blockedDoc(uid)); });
    if (blockedCache) delete blockedCache[uid];
  }

  /* ---------- Online: presence/{uid} = { at, state }, refreshed every minute while the app is open ----------
     state: "online", "idle" (tab hidden or no activity for 5 minutes) or "dnd" (you picked Do not disturb).
     Anyone whose last beat is older than ONLINE_WINDOW shows as "offline". */

  const ONLINE_WINDOW = 3 * 60 * 1000;
  const IDLE_AFTER = 5 * 60 * 1000;
  const STATUS_KEY = 'pbh.status';
  let presenceTimer = null;
  let lastActive = Date.now();
  let sentState = null;
  let stateField = true;   /* false once the rules refuse the "state" field (older rules) */
  const presenceDoc = function (uid) { return F().doc(db(), 'presence', uid); };

  function myStatusChoice() {
    try { const v = localStorage.getItem(STATUS_KEY); return v === 'dnd' || v === 'idle' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function myState() {
    const choice = myStatusChoice();
    if (choice === 'dnd' || choice === 'idle') return choice;
    if (document.visibilityState !== 'visible' || Date.now() - lastActive > IDLE_AFTER) return 'idle';
    return 'online';
  }
  function beat() {
    if (!me()) return;
    const state = myState();
    sentState = state;
    const write = stateField ? { at: Date.now(), state: state } : { at: Date.now() };
    F().setDoc(presenceDoc(me()), write).catch(function () {
      if (!stateField) return;
      stateField = false;
      F().setDoc(presenceDoc(me()), { at: Date.now() }).catch(function () {});
    });
  }
  function onActivity() {
    const wasIdle = Date.now() - lastActive > IDLE_AFTER;
    lastActive = Date.now();
    if (wasIdle && sentState === 'idle') beat();
  }
  function onVisibility() {
    if (document.visibilityState === 'visible') lastActive = Date.now();
    if (myState() !== sentState) beat();
  }
  const ACTIVITY = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];

  function startPresence() {
    stopPresence();
    if (!me()) return;
    lastActive = Date.now();
    beat();
    presenceTimer = setInterval(beat, 60 * 1000);
    document.addEventListener('visibilitychange', onVisibility);
    ACTIVITY.forEach(function (t) { window.addEventListener(t, onActivity, { passive: true }); });
  }
  function stopPresence() {
    if (presenceTimer) clearInterval(presenceTimer);
    presenceTimer = null;
    sentState = null;
    document.removeEventListener('visibilitychange', onVisibility);
    ACTIVITY.forEach(function (t) { window.removeEventListener(t, onActivity); });
  }
  /** "auto" (Online, goes Idle when away), "idle" or "dnd". Takes effect right away. */
  function setStatusChoice(choice) {
    try { localStorage.setItem(STATUS_KEY, choice === 'dnd' || choice === 'idle' ? choice : 'auto'); } catch (e) { /* storage off */ }
    beat();
  }
  function myStatus() { return me() ? myState() : 'offline'; }

  function statusFrom(data, now) {
    if (!data || now - (data.at || 0) >= ONLINE_WINDOW) return 'offline';
    return ['online', 'idle', 'dnd'].indexOf(data.state) !== -1 ? data.state : 'online';
  }

  /** { uid: "online" | "idle" | "dnd" | "offline" } for the given people. */
  async function presenceOf(uids) {
    const now = Date.now();
    const out = {};
    await Promise.all(uids.map(function (uid) {
      if (uid === me()) { out[uid] = myStatus(); return null; }
      return F().getDoc(presenceDoc(uid)).then(function (snap) {
        out[uid] = statusFrom(snap.exists() ? snap.data() : null, now);
      }).catch(function () { out[uid] = 'offline'; });
    }));
    return out;
  }

  /** People in your circle who are not offline. */
  async function onlineCircle() {
    const people = await circleMembers();
    const status = await presenceOf(people.map(function (p) { return p.id; }));
    return people.filter(function (p) { return status[p.id] !== 'offline'; });
  }

  /** "self", "circle", "sent" (you asked them), "received" (they asked you) or "none". */
  async function relation(uid) {
    if (uid === me()) return 'self';
    const checks = await run(function () {
      return Promise.all([
        F().getDoc(circleDoc(uid, me())),
        F().getDoc(requestDoc(uid, me())),
        F().getDoc(requestDoc(me(), uid))
      ]);
    });
    if (checks[0].exists()) return 'circle';
    if (checks[1].exists()) return 'sent';
    if (checks[2].exists()) return 'received';
    return 'none';
  }

  async function sendRequest(uid) {
    const now = Date.now();
    const batch = F().writeBatch(db());
    batch.set(requestDoc(uid, me()), { createdAt: now });
    batch.set(F().doc(notesCol(uid), 'request_' + me()), { type: 'request', from: me(), createdAt: now, read: false });
    await run(function () { return batch.commit(); });
  }

  async function cancelRequest(uid) {
    const batch = F().writeBatch(db());
    batch.delete(requestDoc(uid, me()));
    batch.delete(F().doc(notesCol(uid), 'request_' + me()));
    await run(function () { return batch.commit(); });
  }

  async function acceptRequest(uid) {
    const now = Date.now();
    const batch = F().writeBatch(db());
    batch.set(circleDoc(me(), uid), { since: now });
    batch.set(circleDoc(uid, me()), { since: now });
    batch.delete(requestDoc(me(), uid));
    batch.delete(F().doc(notesCol(me()), 'request_' + uid));
    batch.set(F().doc(notesCol(uid), 'accepted_' + me()), { type: 'accepted', from: me(), createdAt: now, read: false });
    await run(function () { return batch.commit(); });
  }

  async function declineRequest(uid) {
    const batch = F().writeBatch(db());
    batch.delete(requestDoc(me(), uid));
    batch.delete(F().doc(notesCol(me()), 'request_' + uid));
    await run(function () { return batch.commit(); });
  }

  async function removeFromCircle(uid) {
    const batch = F().writeBatch(db());
    batch.delete(circleDoc(me(), uid));
    batch.delete(circleDoc(uid, me()));
    await run(function () { return batch.commit(); });
  }

  async function circleMembers(uid) {
    const snap = await run(function () { return F().getDocs(F().collection(db(), 'profiles', uid || me(), 'circle')); });
    const people = await Promise.all(snap.docs.map(function (d) { return getProfile(d.id).catch(function () { return null; }); }));
    return people.filter(Boolean).sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  /* ---------- Posts ---------- */

  function validatePost(text, visibility) {
    if (!text.trim()) return 'Write something first.';
    if (text.length > POST_MAX) return 'Use ' + POST_MAX + ' characters or fewer.';
    if (!VISIBILITY[visibility]) return 'Choose who can see this.';
    return null;
  }

  async function createPost(text, visibility) {
    const ref = F().doc(postsCol(me()));
    const post = { text: text.trim(), visibility: visibility, createdAt: Date.now() };
    await run(function () { return F().setDoc(ref, post); });
    return Object.assign({ id: ref.id }, post);
  }

  async function setPostVisibility(postId, visibility) {
    await run(function () { return F().updateDoc(F().doc(postsCol(me()), postId), { visibility: visibility }); });
  }

  async function deletePost(postId) {
    await run(function () { return F().deleteDoc(F().doc(postsCol(me()), postId)); });
  }

  /** Newest first. Only asks for posts the viewer is allowed to see. */
  async function listPosts(uid, rel) {
    let q = postsCol(uid);
    if (rel === 'circle') q = F().query(q, F().where('visibility', 'in', ['public', 'circle']));
    else if (rel !== 'self') q = F().query(q, F().where('visibility', '==', 'public'));
    const snap = await run(function () { return F().getDocs(q); });
    return snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  /* ---------- Notifications ---------- */

  let unsubscribe = null;
  let notes = [];
  const listeners = [];

  function watchNotifications() {
    stopWatching();
    if (!me()) return;
    unsubscribe = F().onSnapshot(notesCol(me()), function (snap) {
      notes = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return b.createdAt - a.createdAt; });
      listeners.forEach(function (fn) { fn(notes); });
    }, function (error) { console.error(error); });
  }

  function stopWatching() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    notes = [];
  }

  function onNotifications(fn) { listeners.push(fn); }
  function notifications() { return notes.slice(); }
  function unreadCount() { return notes.filter(function (n) { return !n.read; }).length; }

  async function markAllRead() {
    const unread = notes.filter(function (n) { return !n.read; });
    if (!unread.length) return;
    const batch = F().writeBatch(db());
    unread.forEach(function (n) { batch.update(F().doc(notesCol(me()), n.id), { read: true }); });
    await run(function () { return batch.commit(); });
  }

  async function dismissNotification(id) {
    await run(function () { return F().deleteDoc(F().doc(notesCol(me()), id)); });
  }

  /* ---------- Messages (circle members only) ---------- */

  const MESSAGE_MAX = 1000;
  const chatDoc = function (id) { return F().doc(db(), 'chats', id); };
  const messagesCol = function (id) { return F().collection(db(), 'chats', id, 'messages'); };

  /** One conversation per pair of people. The id is both uids, sorted, joined with "_". */
  function chatIdWith(uid) {
    const a = me();
    return a < uid ? a + '_' + uid : uid + '_' + a;
  }

  function otherIn(chat) {
    return chat.members[0] === me() ? chat.members[1] : chat.members[0];
  }

  function isUnread(chat) {
    return !!chat && chat.lastFrom !== me() && chat.lastAt > ((chat.seen || {})[me()] || 0);
  }

  function validateMessage(text) {
    if (!text.trim()) return 'Write a message first.';
    if (text.trim().length > MESSAGE_MAX) return 'Use ' + MESSAGE_MAX + ' characters or fewer.';
    return null;
  }

  /* Attachments live in Firestore itself (no Cloud Storage on the free plan):
     the file is split into base64 chunks under chats/{id}/files/{fileId}_{n}. */
  const FILE_MAX = 5 * 1024 * 1024;
  const CHUNK = 900000;
  const filesCol = function (id) { return F().collection(db(), 'chats', id, 'files'); };
  const KIND_LABEL = { photo: 'Sent a photo', video: 'Sent a video', file: 'Sent a file' };

  function previewFor(body, att) {
    if (body) return body.slice(0, 140);
    return att ? (KIND_LABEL[att.kind] + (att.kind === 'file' ? ': ' + att.name : '')).slice(0, 140) : '';
  }

  /** attachment: { kind, name, type, size, thumb, data } where data is a base64 string (no data: prefix). */
  async function sendMessage(uid, text, attachment) {
    const body = (text || '').trim();
    if (!attachment) {
      const problem = validateMessage(body);
      if (problem) throw new BT.UserError(problem);
    } else if (body.length > MESSAGE_MAX) {
      throw new BT.UserError('Use ' + MESSAGE_MAX + ' characters or fewer.');
    }
    const id = chatIdWith(uid);
    const now = Date.now();
    const existing = await run(function () { return F().getDoc(chatDoc(id)); });
    const batch = F().writeBatch(db());
    const message = { from: me(), text: body, createdAt: now };
    if (attachment) {
      if (attachment.size > FILE_MAX) throw new BT.UserError('Files can be up to 5 MB.');
      const fileId = F().doc(filesCol(id)).id;
      const parts = Math.max(1, Math.ceil(attachment.data.length / CHUNK));
      for (let n = 0; n < parts; n++) {
        batch.set(F().doc(filesCol(id), fileId + '_' + n), { from: me(), n: n, data: attachment.data.slice(n * CHUNK, (n + 1) * CHUNK) });
      }
      message.att = { kind: attachment.kind, name: attachment.name.slice(0, 200), type: attachment.type.slice(0, 100), size: attachment.size, fileId: fileId, parts: parts };
      if (attachment.thumb) message.att.thumb = attachment.thumb;
    }
    batch.set(F().doc(messagesCol(id)), message);
    const summary = { lastText: previewFor(body, message.att), lastFrom: me(), lastAt: now };
    if (existing.exists()) {
      const update = Object.assign({}, summary);
      update['seen.' + me()] = now;
      batch.update(chatDoc(id), update);
    } else {
      const seen = {};
      seen[me()] = now;
      batch.set(chatDoc(id), Object.assign({ members: id.split('_'), seen: seen }, summary));
    }
    await run(function () { return batch.commit(); });
  }

  /** Rebuilds an attachment as a Blob. Cached so the gallery and viewer do not re-download. */
  const blobCache = {};
  async function loadAttachment(uid, att) {
    if (blobCache[att.fileId]) return blobCache[att.fileId];
    const id = chatIdWith(uid);
    const chunks = [];
    for (let n = 0; n < att.parts; n++) {
      const snap = await run(function () { return F().getDoc(F().doc(filesCol(id), att.fileId + '_' + n)); });
      if (!snap.exists()) throw new BT.UserError('This attachment is no longer available.');
      chunks.push(snap.data().data);
    }
    const binary = atob(chunks.join(''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.type || 'application/octet-stream' });
    blobCache[att.fileId] = blob;
    return blob;
  }

  /** Sets, changes or (with null) removes your reaction on a message. */
  async function react(uid, messageId, emoji) {
    const update = {};
    update['reactions.' + me()] = emoji === null ? F().deleteField() : emoji;
    await run(function () { return F().updateDoc(F().doc(messagesCol(chatIdWith(uid)), messageId), update); });
  }

  /** Keeps the conversation preview right when you change or remove the newest message. */
  async function refreshPreview(id, createdAt, previewText) {
    const chat = chatList.find(function (c) { return c.id === id; });
    if (!chat || chat.lastFrom !== me() || chat.lastAt !== createdAt) return;
    await run(function () { return F().updateDoc(chatDoc(id), { lastText: previewText.slice(0, 140) }); });
  }

  async function editMessage(uid, message, text) {
    const body = text.trim();
    const problem = validateMessage(body);
    if (problem) throw new BT.UserError(problem);
    const id = chatIdWith(uid);
    await run(function () { return F().updateDoc(F().doc(messagesCol(id), message.id), { text: body, editedAt: Date.now() }); });
    refreshPreview(id, message.createdAt, body).catch(function () {});
  }

  async function unsendMessage(uid, message) {
    const id = chatIdWith(uid);
    const batch = F().writeBatch(db());
    batch.delete(F().doc(messagesCol(id), message.id));
    if (message.att) {
      for (let n = 0; n < message.att.parts; n++) batch.delete(F().doc(filesCol(id), message.att.fileId + '_' + n));
    }
    await run(function () { return batch.commit(); });
    refreshPreview(id, message.createdAt, 'Unsent a message').catch(function () {});
  }

  /** Live list of the newest messages with someone, oldest first. Returns a function that stops listening. */
  function watchMessages(uid, onChange, onError) {
    const q = F().query(messagesCol(chatIdWith(uid)), F().orderBy('createdAt', 'desc'), F().limit(200));
    return F().onSnapshot(q, { includeMetadataChanges: true }, function (snap) {
      onChange(snap.docs.map(function (d) {
        return Object.assign({ id: d.id, pending: d.metadata.hasPendingWrites }, d.data());
      }).reverse());
    }, function (error) { onError(friendly(error)); });
  }

  let chatUnsubscribe = null;
  let chatList = [];
  let chatsLoaded = false;
  const chatListeners = [];

  function watchChats() {
    stopWatchingChats();
    if (!me()) return;
    const q = F().query(F().collection(db(), 'chats'), F().where('members', 'array-contains', me()));
    chatUnsubscribe = F().onSnapshot(q, function (snap) {
      chatList = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return b.lastAt - a.lastAt; });
      chatsLoaded = true;
      markDelivered(chatList);
      chatListeners.forEach(function (fn) { fn(chatList); });
    }, function (error) { console.error(error); });
  }

  function stopWatchingChats() {
    if (chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = null;
    chatList = [];
    chatsLoaded = false;
  }

  /** Tells the sender their latest message reached this device. Uses the message's own time so clocks do not matter. */
  function markDelivered(list) {
    list.forEach(function (chat) {
      if (chat.lastFrom === me()) return;
      const already = Math.max((chat.delivered || {})[me()] || 0, (chat.seen || {})[me()] || 0);
      if (chat.lastAt <= already) return;
      const update = {};
      update['delivered.' + me()] = chat.lastAt;
      F().updateDoc(chatDoc(chat.id), update).catch(function (e) { console.error(e); });
    });
  }

  /** "sending", "sent", "delivered" or "seen" for a message you sent. */
  function messageStatus(message, uid) {
    if (message.pending) return 'sending';
    const chat = chatWith(uid);
    if (!chat) return 'sent';
    const seenAt = (chat.seen || {})[uid] || 0;
    if (seenAt >= message.createdAt) return 'seen';
    if (Math.max(seenAt, (chat.delivered || {})[uid] || 0) >= message.createdAt) return 'delivered';
    return 'sent';
  }

  function onChats(fn) { chatListeners.push(fn); }
  function chats() { return chatList.slice(); }
  function chatsReady() { return chatsLoaded; }
  function chatWith(uid) { return chatList.find(function (c) { return c.id === chatIdWith(uid); }) || null; }
  function unreadChatCount() { return chatList.filter(isUnread).length; }

  /** Marks a conversation as read. Only writes when there is something new. */
  async function markSeen(uid) {
    const chat = chatWith(uid);
    if (!isUnread(chat)) return;
    const update = {};
    /* Seen keeps the real time (shown as "Seen 10:02 AM"), never earlier than the message itself. */
    update['seen.' + me()] = Math.max(Date.now(), chat.lastAt);
    update['delivered.' + me()] = chat.lastAt;
    await run(function () { return F().updateDoc(chatDoc(chat.id), update); });
  }

  /* ---------- Trusted person (one per dashboard) ----------
     trust/{ownerUid} = { member, role: 'view' | 'edit', status: 'pending' | 'accepted', currency, createdAt }.
     The owner picks one person from their circle; that person accepts from Alerts. */

  const TRUST_ROLES = { view: 'View only', edit: 'Can edit' };
  const trustDoc = function (owner) { return F().doc(db(), 'trust', owner); };
  const sharedTxCol = function (owner) { return F().collection(db(), 'users', owner, 'tx'); };

  let trustOut = null;           /* the share I gave (or null) */
  let trustIn = [];              /* shares other people gave me */
  let trustReady = false;
  let trustStops = [];
  const trustListeners = [];

  function emitTrust() { trustListeners.forEach(function (fn) { fn(); }); }

  function watchTrust() {
    stopWatchingTrust();
    if (!me()) return;
    let gotOut = false, gotIn = false;
    trustStops.push(F().onSnapshot(trustDoc(me()), function (snap) {
      trustOut = snap.exists() ? Object.assign({ owner: snap.id }, snap.data()) : null;
      gotOut = true; trustReady = gotOut && gotIn;
      emitTrust();
    }, function (error) { console.error(error); gotOut = true; trustReady = gotIn; emitTrust(); }));
    trustStops.push(F().onSnapshot(F().query(F().collection(db(), 'trust'), F().where('member', '==', me())), function (snap) {
      trustIn = snap.docs.map(function (d) { return Object.assign({ owner: d.id }, d.data()); });
      gotIn = true; trustReady = gotOut && gotIn;
      emitTrust();
    }, function (error) { console.error(error); gotIn = true; trustReady = gotOut; emitTrust(); }));
  }

  function stopWatchingTrust() {
    trustStops.forEach(function (stop) { stop(); });
    trustStops = [];
    trustOut = null; trustIn = []; trustReady = false;
  }

  function onTrust(fn) { trustListeners.push(fn); }
  function myTrust() { return trustOut; }
  function trustedMe() { return trustIn.slice(); }
  function trustLoaded() { return trustReady; }
  function trustFrom(owner) { return trustIn.find(function (t) { return t.owner === owner; }) || null; }

  /** Invites one person from your circle. Replaces whoever was trusted before. */
  async function inviteTrusted(uid, role, currency) {
    if (!TRUST_ROLES[role]) throw new BT.UserError('Choose what they can do.');
    if (uid === me()) throw new BT.UserError('Choose someone from your circle.');
    const now = Date.now();
    const batch = F().writeBatch(db());
    batch.set(trustDoc(me()), { member: uid, role: role, status: 'pending', currency: currency, createdAt: now });
    batch.set(F().doc(notesCol(uid), 'trust_' + me()), { type: 'trust', from: me(), createdAt: now, read: false });
    await run(function () { return batch.commit(); });
  }

  async function setTrustRole(role) {
    if (!TRUST_ROLES[role]) throw new BT.UserError('Choose what they can do.');
    await run(function () { return F().updateDoc(trustDoc(me()), { role: role }); });
  }

  /** Keeps the currency your trusted person sees in step with yours. */
  function syncTrustCurrency(currency) {
    if (!trustOut || trustOut.currency === currency) return;
    F().updateDoc(trustDoc(me()), { currency: currency }).catch(function (error) { console.error(error); });
  }

  async function removeTrusted() {
    await run(function () { return F().deleteDoc(trustDoc(me())); });
  }

  async function acceptTrust(owner) {
    const now = Date.now();
    const batch = F().writeBatch(db());
    batch.update(trustDoc(owner), { status: 'accepted' });
    batch.delete(F().doc(notesCol(me()), 'trust_' + owner));
    batch.set(F().doc(notesCol(owner), 'trusted_' + me()), { type: 'trusted', from: me(), createdAt: now, read: false });
    await run(function () { return batch.commit(); });
  }

  /** Declining an invite and leaving a shared dashboard are the same thing. */
  async function leaveTrust(owner) {
    const batch = F().writeBatch(db());
    batch.delete(trustDoc(owner));
    batch.delete(F().doc(notesCol(me()), 'trust_' + owner));
    await run(function () { return batch.commit(); });
  }

  /* Someone else's entries, for their trusted person. Calls back with every change. */
  function watchSharedTx(owner, onChange, onError) {
    return F().onSnapshot(sharedTxCol(owner), function (snap) {
      onChange(snap.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }));
    }, function (error) { onError(friendly(error)); });
  }
  function cleanTx(tx) { return { type: tx.type, desc: tx.desc, cents: tx.cents, date: tx.date, createdAt: tx.createdAt || Date.now() }; }
  async function addSharedTx(owner, tx) {
    const ref = F().doc(sharedTxCol(owner));
    const record = cleanTx(tx);
    await run(function () { return F().setDoc(ref, record); });
    return Object.assign({ id: ref.id }, record);
  }
  async function updateSharedTx(owner, id, changes) {
    await run(function () { return F().updateDoc(F().doc(sharedTxCol(owner), id), changes); });
  }
  async function deleteSharedTx(owner, id) {
    await run(function () { return F().deleteDoc(F().doc(sharedTxCol(owner), id)); });
  }
  async function restoreSharedTx(owner, tx) {
    await run(function () { return F().setDoc(F().doc(sharedTxCol(owner), tx.id), cleanTx(tx)); });
  }

  /* ---------- Money accounts (Savings tracker) ----------
     users/{owner}/accounts/{id} = { bank, name, type, cents, last4, createdAt, updatedAt }.
     cents is the balance; for credit and loan it is the amount owed. */

  const ACCOUNT_TYPES = { wallet: 'Wallet', savings: 'Savings', credit: 'Credit', loan: 'Loan' };
  const accountsCol = function (owner) { return F().collection(db(), 'users', owner, 'accounts'); };

  function validateAccount(a) {
    const errors = {};
    if (!a.bank) errors.bank = 'Choose a bank.';
    if (!a.name || !a.name.trim()) errors.name = 'Give this account a name.';
    else if (a.name.trim().length > 40) errors.name = 'Use 40 characters or fewer.';
    if (!ACCOUNT_TYPES[a.type]) errors.type = 'Choose a type.';
    if (!(Number.isInteger(a.cents) && a.cents >= 0 && a.cents <= 100000000000000)) errors.cents = 'Enter an amount of zero or more.';
    if (a.last4 && !/^[0-9]{4}$/.test(a.last4)) errors.last4 = 'Enter exactly 4 digits, or leave it blank.';
    return Object.keys(errors).length ? errors : null;
  }

  function accountFields(a) {
    return { bank: a.bank, name: a.name.trim(), type: a.type, cents: a.cents, last4: a.last4 || '', updatedAt: Date.now() };
  }

  function watchAccounts(owner, onChange, onError) {
    return F().onSnapshot(accountsCol(owner || me()), function (snap) {
      onChange(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return a.createdAt - b.createdAt; }));
    }, function (error) { if (onError) onError(friendly(error)); });
  }
  async function addAccount(owner, a) {
    const ref = F().doc(accountsCol(owner || me()));
    await run(function () { return F().setDoc(ref, Object.assign({ createdAt: Date.now() }, accountFields(a))); });
    return ref.id;
  }
  async function updateAccount(owner, id, a) {
    await run(function () { return F().updateDoc(F().doc(accountsCol(owner || me()), id), accountFields(a)); });
  }
  async function deleteAccount(owner, id) {
    await run(function () { return F().deleteDoc(F().doc(accountsCol(owner || me()), id)); });
  }

  /* ---------- Debts (utang) and savings goals ----------
     users/{owner}/debts/{id} = { dir, person, note, cents, paidCents, due, createdAt, updatedAt }
       dir 'owe' = you owe them (utang ko), 'lent' = they owe you (pinautang ko).
     users/{owner}/goals/{id} = { name, kind, targetCents, savedCents, due, createdAt, updatedAt } */

  const DEBT_DIRS = { owe: 'I owe', lent: 'Owed to me' };
  const GOAL_KINDS = {
    emergency: 'Emergency fund', travel: 'Travel', education: 'Education', house: 'House',
    vehicle: 'Vehicle', gadget: 'Gadget', wedding: 'Wedding', business: 'Business',
    retirement: 'Retirement', other: 'Other'
  };
  const MAX_CENTS = 100000000000000;
  const debtsCol = function (owner) { return F().collection(db(), 'users', owner, 'debts'); };
  const goalsCol = function (owner) { return F().collection(db(), 'users', owner, 'goals'); };
  const isDate = function (v) { return v === '' || /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v); };
  const okCents = function (v, min) { return Number.isInteger(v) && v >= min && v <= MAX_CENTS; };

  function validateDebt(d) {
    const errors = {};
    if (!DEBT_DIRS[d.dir]) errors.dir = 'Choose who owes whom.';
    if (!d.person || !d.person.trim()) errors.person = 'Enter a name.';
    else if (d.person.trim().length > 40) errors.person = 'Use 40 characters or fewer.';
    if (d.note && d.note.trim().length > 80) errors.note = 'Use 80 characters or fewer.';
    if (!okCents(d.cents, 1)) errors.cents = 'Enter an amount above zero.';
    if (!okCents(d.paidCents, 0)) errors.paidCents = 'Enter zero or more.';
    else if (!errors.cents && d.paidCents > d.cents) errors.paidCents = 'Paid can’t be more than the total.';
    if (!isDate(d.due || '')) errors.due = 'Enter a valid date.';
    if (d.uid && (typeof d.uid !== 'string' || d.uid.length > 128)) errors.person = 'Choose someone from your circle again.';
    return Object.keys(errors).length ? errors : null;
  }
  function debtFields(d, forUpdate) {
    const out = { dir: d.dir, person: d.person.trim(), note: (d.note || '').trim(), cents: d.cents, paidCents: d.paidCents, due: d.due || '', updatedAt: Date.now() };
    /* uid links the debt to a PassbookHub user from your circle. Plain names have none. */
    if (d.uid) out.uid = d.uid;
    else if (forUpdate) out.uid = F().deleteField();
    return out;
  }
  function validateGoal(g) {
    const errors = {};
    if (!g.name || !g.name.trim()) errors.name = 'Give this goal a name.';
    else if (g.name.trim().length > 40) errors.name = 'Use 40 characters or fewer.';
    if (!GOAL_KINDS[g.kind]) errors.kind = 'Choose a fund type.';
    if (!okCents(g.targetCents, 1)) errors.targetCents = 'Enter a target above zero.';
    if (!okCents(g.savedCents, 0)) errors.savedCents = 'Enter zero or more.';
    if (!isDate(g.due || '')) errors.due = 'Enter a valid date.';
    return Object.keys(errors).length ? errors : null;
  }
  function goalFields(g) {
    return { name: g.name.trim(), kind: g.kind, targetCents: g.targetCents, savedCents: g.savedCents, due: g.due || '', updatedAt: Date.now() };
  }
  function watchList(col, owner, onChange, onError) {
    return F().onSnapshot(col(owner || me()), function (snap) {
      onChange(snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); })
        .sort(function (a, b) { return a.createdAt - b.createdAt; }));
    }, function (error) { if (onError) onError(friendly(error)); });
  }
  function watchDebts(owner, onChange, onError) { return watchList(debtsCol, owner, onChange, onError); }
  function watchGoals(owner, onChange, onError) { return watchList(goalsCol, owner, onChange, onError); }
  /** Saves a debt and returns its id. */
  async function saveDebt(owner, id, d) {
    const col = debtsCol(owner || me());
    if (id) { await run(function () { return F().updateDoc(F().doc(col, id), debtFields(d, true)); }); return id; }
    const ref = F().doc(col);
    await run(function () { return F().setDoc(ref, Object.assign({ createdAt: Date.now() }, debtFields(d))); });
    return ref.id;
  }
  /** Tells a tagged circle member about a debt in your own book. One alert per debt, replaced on each send. */
  async function notifyDebt(uid, debtId, d, currency) {
    await run(function () {
      return F().setDoc(F().doc(notesCol(uid), 'debt_' + me() + '_' + debtId), {
        type: 'debt', from: me(), createdAt: Date.now(), read: false,
        debtId: debtId, dir: d.dir, cents: d.cents, currency: String(currency || '').slice(0, 5)
      });
    });
  }
  async function deleteDebt(owner, id) { await run(function () { return F().deleteDoc(F().doc(debtsCol(owner || me()), id)); }); }
  async function saveGoal(owner, id, g) {
    const col = goalsCol(owner || me());
    if (id) return run(function () { return F().updateDoc(F().doc(col, id), goalFields(g)); });
    return run(function () { return F().setDoc(F().doc(col), Object.assign({ createdAt: Date.now() }, goalFields(g))); });
  }
  async function deleteGoal(owner, id) { await run(function () { return F().deleteDoc(F().doc(goalsCol(owner || me()), id)); }); }

  /* ---------- Account deletion ---------- */

  /** Removes everything social that belongs to the signed-in person. Call before deleting the account. */
  async function deleteEverything() {
    const uid = me();
    const lists = await run(function () {
      return Promise.all(['posts', 'circle', 'requests', 'notifications'].map(function (name) {
        return F().getDocs(F().collection(db(), 'profiles', uid, name));
      }));
    });
    const refs = [];
    lists.forEach(function (snap) { snap.docs.forEach(function (d) { refs.push(d.ref); }); });
    lists[1].docs.forEach(function (d) { refs.push(circleDoc(d.id, uid)); });
    refs.push(profileDoc(uid));
    refs.push(trustDoc(uid));
    refs.push(presenceDoc(uid));
    const myBlocks = await run(function () { return F().getDocs(F().collection(db(), 'profiles', uid, 'blocked')); });
    myBlocks.docs.forEach(function (d) { refs.push(d.ref); });
    refs.push(coverDoc(uid));
    refs.push(circleInfoDoc(uid));
    refs.push(noteDoc(uid));
    const myAccounts = await run(function () { return F().getDocs(accountsCol(uid)); });
    myAccounts.docs.forEach(function (d) { refs.push(d.ref); });
    for (const col of [debtsCol(uid), goalsCol(uid)]) {
      const snap = await run(function () { return F().getDocs(col); }).catch(function () { return { docs: [] }; });
      snap.docs.forEach(function (d) { refs.push(d.ref); });
    }
    const sharedWithMe = await run(function () { return F().getDocs(F().query(F().collection(db(), 'trust'), F().where('member', '==', uid))); });
    sharedWithMe.docs.forEach(function (d) { refs.push(d.ref); });
    /* Your own messages and the conversations you are in. */
    const myChats = await run(function () {
      return F().getDocs(F().query(F().collection(db(), 'chats'), F().where('members', 'array-contains', uid)));
    });
    for (const chat of myChats.docs) {
      const sent = await run(function () { return F().getDocs(F().query(messagesCol(chat.id), F().where('from', '==', uid))); });
      sent.docs.forEach(function (d) { refs.push(d.ref); });
      const files = await run(function () { return F().getDocs(F().query(filesCol(chat.id), F().where('from', '==', uid))); });
      files.docs.forEach(function (d) { refs.push(d.ref); });
      refs.push(chat.ref);
    }
    for (let i = 0; i < refs.length; i += 400) {
      const batch = F().writeBatch(db());
      refs.slice(i, i + 400).forEach(function (ref) { batch.delete(ref); });
      await run(function () { return batch.commit(); });
    }
    stopWatching();
    stopWatchingChats();
    stopWatchingTrust();
    stopPresence();
  }

  return {
    MESSAGE_MAX: MESSAGE_MAX, otherIn: otherIn, isUnread: isUnread, validateMessage: validateMessage,
    FILE_MAX: FILE_MAX, sendMessage: sendMessage, loadAttachment: loadAttachment, react: react, editMessage: editMessage, unsendMessage: unsendMessage, watchMessages: watchMessages, watchChats: watchChats, stopWatchingChats: stopWatchingChats,
    onChats: onChats, messageStatus: messageStatus, chats: chats, chatsReady: chatsReady, chatWith: chatWith, unreadChatCount: unreadChatCount, markSeen: markSeen,
    VISIBILITY: VISIBILITY, POST_MAX: POST_MAX,
    syncProfile: syncProfile, ensureProfile: ensureProfile, getProfile: getProfile, findByUsername: findByUsername, search: search,
    relation: relation, sendRequest: sendRequest, cancelRequest: cancelRequest, acceptRequest: acceptRequest,
    declineRequest: declineRequest, removeFromCircle: removeFromCircle, circleMembers: circleMembers,
    validatePost: validatePost, createPost: createPost, setPostVisibility: setPostVisibility, deletePost: deletePost, listPosts: listPosts,
    watchNotifications: watchNotifications, stopWatching: stopWatching, onNotifications: onNotifications,
    notifications: notifications, unreadCount: unreadCount, markAllRead: markAllRead, dismissNotification: dismissNotification,
    deleteEverything: deleteEverything,
    blockedList: blockedList, blockPerson: blockPerson, unblockPerson: unblockPerson,
    startPresence: startPresence, stopPresence: stopPresence, onlineCircle: onlineCircle,
    presenceOf: presenceOf, setStatusChoice: setStatusChoice, myStatusChoice: myStatusChoice, myStatus: myStatus,
    loadCircleInfo: loadCircleInfo, ensureDefaultCircleInfo: ensureDefaultCircleInfo, saveCircleInfo: saveCircleInfo, publishSavings: publishSavings, savingsTotal: savingsTotal,
    NOTE_MAX: NOTE_MAX, NOTE_GIF_MAX: NOTE_GIF_MAX, loadNote: loadNote, saveNote: saveNote, deleteNote: deleteNote,
    loadCover: loadCover, EDU_MAX: EDU_MAX, WORK_MAX: WORK_MAX, COVER_MAX: COVER_MAX, saveProfileExtras: saveProfileExtras, loadProfile: loadProfile, feedPosts: feedPosts,
    TRUST_ROLES: TRUST_ROLES, watchTrust: watchTrust, stopWatchingTrust: stopWatchingTrust, onTrust: onTrust,
    myTrust: myTrust, trustedMe: trustedMe, trustLoaded: trustLoaded, trustFrom: trustFrom,
    inviteTrusted: inviteTrusted, setTrustRole: setTrustRole, syncTrustCurrency: syncTrustCurrency, removeTrusted: removeTrusted,
    acceptTrust: acceptTrust, leaveTrust: leaveTrust,
    ACCOUNT_TYPES: ACCOUNT_TYPES, validateAccount: validateAccount, watchAccounts: watchAccounts,
    addAccount: addAccount, updateAccount: updateAccount, deleteAccount: deleteAccount,
    DEBT_DIRS: DEBT_DIRS, GOAL_KINDS: GOAL_KINDS, validateDebt: validateDebt, validateGoal: validateGoal,
    watchDebts: watchDebts, saveDebt: saveDebt, notifyDebt: notifyDebt, deleteDebt: deleteDebt, watchGoals: watchGoals, saveGoal: saveGoal, deleteGoal: deleteGoal,
    watchSharedTx: watchSharedTx, addSharedTx: addSharedTx, updateSharedTx: updateSharedTx, deleteSharedTx: deleteSharedTx, restoreSharedTx: restoreSharedTx
  };
})();
