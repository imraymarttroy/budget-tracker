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
    deleteEverything: deleteEverything
  };
})();
