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
    await run(function () { return F().setDoc(profileDoc(user.id), data); });
    profileCache[user.id] = Object.assign({ id: user.id }, data);
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
        if (seen[d.id] || d.id === me()) return;
        seen[d.id] = true;
        profileCache[d.id] = Object.assign({ id: d.id }, d.data());
        people.push(profileCache[d.id]);
      });
    });
    return people.slice(0, 20);
  }

  /* ---------- Circle ---------- */

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
    for (let i = 0; i < refs.length; i += 400) {
      const batch = F().writeBatch(db());
      refs.slice(i, i + 400).forEach(function (ref) { batch.delete(ref); });
      await run(function () { return batch.commit(); });
    }
    stopWatching();
  }

  return {
    VISIBILITY: VISIBILITY, POST_MAX: POST_MAX,
    syncProfile: syncProfile, ensureProfile: ensureProfile, getProfile: getProfile, findByUsername: findByUsername, search: search,
    relation: relation, sendRequest: sendRequest, cancelRequest: cancelRequest, acceptRequest: acceptRequest,
    declineRequest: declineRequest, removeFromCircle: removeFromCircle, circleMembers: circleMembers,
    validatePost: validatePost, createPost: createPost, setPostVisibility: setPostVisibility, deletePost: deletePost, listPosts: listPosts,
    watchNotifications: watchNotifications, stopWatching: stopWatching, onNotifications: onNotifications,
    notifications: notifications, unreadCount: unreadCount, markAllRead: markAllRead, dismissNotification: dismissNotification,
    deleteEverything: deleteEverything
  };
})();
