const firebaseConfig = {
  apiKey: "AIzaSyBavbOOvSuDtFbpjbDhnyBEslCklX04RnM",
  authDomain: "room-fe1f3.firebaseapp.com",
  databaseURL: "https://room-fe1f3-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "room-fe1f3",
  storageBucket: "room-fe1f3.firebasestorage.app",
  messagingSenderId: "101113253128",
  appId: "1:101113253128:web:65298cd75a2a2739e430bd"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== LOCAL STORAGE HELPERS =====
function getSavedRooms() {
  try {
    return JSON.parse(localStorage.getItem('sharesite_rooms') || '[]');
  } catch {
    return [];
  }
}

function saveRoom(code, password, name, role, userName) {
  const rooms = getSavedRooms();
  // Remove duplicate if exists
  const filtered = rooms.filter(r => !(r.code === code && r.role === role));
  filtered.unshift({ code, password, name, role, userName, savedAt: Date.now() });
  // Keep max 10 saved rooms
  if (filtered.length > 10) filtered.length = 10;
  localStorage.setItem('sharesite_rooms', JSON.stringify(filtered));
}

function removeSavedRoom(code, role) {
  const rooms = getSavedRooms().filter(r => !(r.code === code && r.role === role));
  localStorage.setItem('sharesite_rooms', JSON.stringify(rooms));
}

// ===== INDEX PAGE LOGIC =====
function showCreateModal() {
  document.getElementById('createModal').classList.add('active');
  renderSavedTeacherRooms();
  document.getElementById('roomCode').focus();
}

function showJoinModal() {
  document.getElementById('joinModal').classList.add('active');
  renderSavedStudentRooms();

  const rooms = getSavedRooms().filter(r => r.role === 'student');
  if (rooms.length > 0) {
    document.getElementById('joinCode').value = rooms[0].code;
    document.getElementById('joinPassword').value = rooms[0].password;
  }
  document.getElementById('joinCode').focus();
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// Render saved rooms for teacher
function renderSavedTeacherRooms() {
  const rooms = getSavedRooms().filter(r => r.role === 'teacher');
  const section = document.getElementById('savedTeacherRoomsSection');
  const list = document.getElementById('savedTeacherRoomsList');
  if (!section || !list) return;

  if (rooms.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';

  rooms.forEach(room => {
    const item = document.createElement('div');
    item.className = 'saved-room-item';
    item.innerHTML = `
      <div class="saved-room-info" onclick="fillCreateForm('${escapeAttr(room.code)}', '${escapeAttr(room.password)}')">
        <div class="saved-room-name">${escapeHtml(room.name)}</div>
        <div class="saved-room-code">Код: ${escapeHtml(room.code)}</div>
      </div>
      <button class="saved-room-delete" onclick="event.stopPropagation(); removeSavedRoom('${escapeAttr(room.code)}', 'teacher'); renderSavedTeacherRooms();" title="Видалити">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    list.appendChild(item);
  });
}

// Render saved rooms for student
function renderSavedStudentRooms() {
  const rooms = getSavedRooms().filter(r => r.role === 'student');
  const section = document.getElementById('savedRoomsSection');
  const list = document.getElementById('savedRoomsList');
  if (!section || !list) return;

  if (rooms.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = '';

  rooms.forEach(room => {
    const item = document.createElement('div');
    item.className = 'saved-room-item';
    item.innerHTML = `
      <div class="saved-room-info" onclick="quickJoin('${escapeAttr(room.code)}', '${escapeAttr(room.password)}')">
        <div class="saved-room-name">${escapeHtml(room.name)}</div>
        <div class="saved-room-code">Код: ${escapeHtml(room.code)}</div>
      </div>
      <button class="saved-room-delete" onclick="event.stopPropagation(); removeSavedRoom('${escapeAttr(room.code)}', 'student'); renderSavedStudentRooms();" title="Видалити">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;
    list.appendChild(item);
  });
}

function fillCreateForm(code, password) {
  document.getElementById('roomCode').value = code;
  document.getElementById('roomPassword').value = password;
}

function quickJoin(code, password) {
  document.getElementById('joinCode').value = code;
  document.getElementById('joinPassword').value = password;
  joinRoom();
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModals();
  if (e.key === 'Enter') {
    const createModal = document.getElementById('createModal');
    const joinModal = document.getElementById('joinModal');
    if (createModal && createModal.classList.contains('active')) createRoom();
    if (joinModal && joinModal.classList.contains('active')) joinRoom();
  }
});

// Auto-fill from QR
document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('joinCode');
  if (codeInput) {
    // Auto-fill from URL param ?code=XXXXX
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode) {
      codeInput.value = urlCode;
      showJoinModal();
    }
  }

  // Auto-cleanup: delete rooms older than 2 hours
  cleanOldRooms();
});

function cleanOldRooms() {
  const TWO_HOURS = 2 * 60 * 60 * 1000;
  const cutoff = Date.now() - TWO_HOURS;
  db.ref('rooms').orderByChild('createdAt').endAt(cutoff).once('value', (snap) => {
    const updates = {};
    snap.forEach((child) => {
      updates[child.key] = null;
    });
    if (Object.keys(updates).length > 0) {
      db.ref('rooms').update(updates);
      console.log('Очищено старих кімнат:', Object.keys(updates).length);
    }
  });
}

// Sanitize room code for Firebase key (remove forbidden chars)
function sanitizeCode(code) {
  return code.replace(/[.#$\/\[\]]/g, '_');
}

function createRoom() {
  const rawCode = document.getElementById('roomCode').value.trim();
  const password = document.getElementById('roomPassword').value.trim();
  const name = 'Кімната';
  const teacher = 'Вчитель';

  if (!rawCode) {
    showToast('Введіть код кімнати');
    return;
  }
  if (!password) {
    showToast('Введіть пароль');
    return;
  }

  const code = sanitizeCode(rawCode);
  const roomRef = db.ref('rooms/' + code);

  roomRef.once('value').then((snap) => {
    if (snap.exists()) {
      showToast('Кімната з таким кодом вже існує');
      return Promise.reject('exists');
    }

    return roomRef.set({
      name: name,
      teacher: teacher,
      password: password,
      createdAt: Date.now()
    });
  }).then(() => {
    // Save to localStorage for quick re-entry
    saveRoom(code, password, name, 'teacher', teacher);

    sessionStorage.setItem('roomCode', code);
    sessionStorage.setItem('role', 'teacher');
    sessionStorage.setItem('name', teacher);
    window.location.href = 'room.html';
  }).catch((err) => {
    if (err === 'exists') return;
    console.error('Помилка створення кімнати:', err);
    showToast('Помилка: ' + err.message);
  });
}

function joinRoom() {
  const rawCode = document.getElementById('joinCode').value.trim();
  const password = document.getElementById('joinPassword').value.trim();

  if (!rawCode) {
    showToast('Введіть код кімнати');
    return;
  }
  if (!password) {
    showToast('Введіть пароль');
    return;
  }

  const code = sanitizeCode(rawCode);
  const roomRef = db.ref('rooms/' + code);

  roomRef.once('value', (snap) => {
    if (!snap.exists()) {
      showToast('Кімнату не знайдено');
      return;
    }

    const roomData = snap.val();
    if (roomData.password !== password) {
      showToast('Невірний пароль');
      return;
    }

    db.ref('rooms/' + code + '/members').once('value', (membersSnap) => {
      const members = membersSnap.val() || {};
      const existingNames = new Set(Object.values(members).map(m => m.name));
      let n = 1;
      while (existingNames.has('Учень ' + n)) n++;
      const name = 'Учень ' + n;

      saveRoom(code, password, roomData.name, 'student', name);

      sessionStorage.setItem('roomCode', code);
      sessionStorage.setItem('role', 'student');
      sessionStorage.setItem('name', name);
      window.location.href = 'room.html';
    });
  });
}

// ===== ROOM PAGE LOGIC =====
document.addEventListener('DOMContentLoaded', () => {
  if (!document.getElementById('roomPage')) return;

  const code = sessionStorage.getItem('roomCode');
  const role = sessionStorage.getItem('role');
  const name = sessionStorage.getItem('name');

  if (!code || !role || !name) {
    window.location.href = 'index.html';
    return;
  }

  const roomRef = db.ref('rooms/' + code);

  // Check if room exists
  roomRef.once('value', (snap) => {
    if (!snap.exists()) {
      document.getElementById('roomPage').style.display = 'none';
      document.getElementById('notFound').style.display = 'block';
      return;
    }

    document.getElementById('roomPage').style.display = 'flex';
    initRoom(code, role, name);
  });
});

function initRoom(code, role, name) {
  const roomRef = db.ref('rooms/' + code);
  const membersRef = db.ref('rooms/' + code + '/members');
  const linksRef = db.ref('rooms/' + code + '/links');
  // Display info
  roomRef.once('value', (snap) => {
    const data = snap.val();
    document.getElementById('displayRoomName').textContent = data.name;
    document.getElementById('displayRole').textContent = role === 'teacher'
      ? 'Вчитель'
      : `Учень: ${name}`;
  });

  // Show teacher controls
  if (role === 'teacher') {
    document.getElementById('inputPanel').style.display = 'block';
    document.getElementById('codeCard').style.display = 'block';
    document.getElementById('qrCard').style.display = 'block';
    document.getElementById('copyCodeBtn').style.display = 'inline-flex';
    document.getElementById('displayCode').textContent = code;

    // Show password in sidebar
    const passwordCard = document.getElementById('passwordCard');
    if (passwordCard) {
      passwordCard.style.display = 'block';
      roomRef.once('value', (snap) => {
        const data = snap.val();
        document.getElementById('displayPassword').textContent = data.password || '';
      });
    }

    // Generate QR code
    const qrUrl = `${window.location.origin}${window.location.pathname.replace('room.html', '')}index.html?code=${code}`;
    const qrContainer = document.getElementById('qrCard').querySelector('.qr-wrapper');
    qrContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
      new QRCode(qrContainer, {
        text: qrUrl,
        width: 180,
        height: 180,
        colorDark: '#202124',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    }

    // Teacher leaves → delete entire room
    roomRef.onDisconnect().remove();
  }

  // Add member
  const memberKey = name.replace(/[.#$[\]]/g, '_');
  const memberRef = membersRef.child(memberKey);
  memberRef.set({
    name: name,
    role: role,
    joinedAt: Date.now()
  });

  // Remove on disconnect
  memberRef.onDisconnect().remove();

  // Listen to members
  membersRef.on('value', (snap) => {
    const members = snap.val() || {};
    const list = document.getElementById('studentsList');
    const count = document.getElementById('studentCount');
    const entries = Object.values(members);

    count.textContent = entries.length;
    list.innerHTML = '';

    // Sort: teacher first, then by join time
    entries.sort((a, b) => {
      if (a.role === 'teacher') return -1;
      if (b.role === 'teacher') return 1;
      return a.joinedAt - b.joinedAt;
    });

    entries.forEach((m) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="student-dot ${m.role === 'teacher' ? 'teacher' : ''}"></span>
        ${escapeHtml(m.name)}
      `;
      list.appendChild(li);
    });
  });

  // Listen to links
  const openedForceLinks = getOpenedForceLinks();
  if (role === 'student') preparePopupOnGesture();

  linksRef.orderByChild('timestamp').on('value', (snap) => {
    const links = snap.val() || {};
    const list = document.getElementById('linksList');
    const noLinks = document.getElementById('noLinks');
    const entries = Object.entries(links).sort((a, b) => b[1].timestamp - a[1].timestamp);

    if (entries.length === 0) {
      noLinks.style.display = 'block';
      list.innerHTML = '';
      return;
    }

    noLinks.style.display = 'none';
    list.innerHTML = '';

    entries.forEach(([key, link]) => {
      if (role === 'student' && link.forceOpen && link.url && !openedForceLinks.has(key)) {
        openedForceLinks.add(key);
        saveOpenedForceLink(key);
        tryAutoOpenForceLink(link.url, key);
      }

      const card = document.createElement('div');
      card.className = 'link-card';
      card.innerHTML = `
        <div class="link-icon">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <div class="link-content">
          ${link.url
            ? `<div class="link-text">${link.text && link.text !== link.url ? escapeHtml(link.text) + '<br>' : ''}<a class="link-url" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a></div>`
            : `<div class="link-text">${linkifyText(link.text)}</div>`}
          <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)}${link.forceOpen ? ' · Відкрито в учнів' : ''}</div>
        </div>
        ${role === 'teacher' ? `<button class="link-delete" onclick="deleteLink('${key}')" title="Видалити">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>` : ''}
      `;
      list.appendChild(card);
    });
  });

  // Enter to send
  const linkInput = document.getElementById('linkInput');
  if (linkInput) {
    linkInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendLink();
      }
    });
  }
}

function sendLink() {
  const input = document.getElementById('linkInput');
  const text = input.value.trim();
  if (!text) return;

  const code = sessionStorage.getItem('roomCode');
  const name = sessionStorage.getItem('name');
  const linksRef = db.ref('rooms/' + code + '/links');
  const forceOpenCheck = document.getElementById('forceOpenCheck');
  const forceOpen = forceOpenCheck ? forceOpenCheck.checked : false;

  // Detect URL
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi;
  const urls = text.match(urlRegex);
  let url = urls ? urls[0] : '';
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  const displayText = url ? text.replace(urls[0], '').trim() || url : text;

  linksRef.push({
    text: displayText,
    url: url,
    author: name,
    timestamp: Date.now(),
    forceOpen: forceOpen && !!url
  });

  input.value = '';
  if (forceOpenCheck) forceOpenCheck.checked = false;
  input.focus();
}

function deleteLink(key) {
  const code = sessionStorage.getItem('roomCode');
  db.ref('rooms/' + code + '/links/' + key).remove();
}

// ===== FORCE OPEN (student) =====
let preparedPopup = null;
let popupGestureBound = false;

function getOpenedForceLinks() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem('openedForceLinks') || '[]'));
  } catch {
    return new Set();
  }
}

function saveOpenedForceLink(key) {
  const list = [...getOpenedForceLinks(), key];
  sessionStorage.setItem('openedForceLinks', JSON.stringify(list));
}

function preparePopupOnGesture() {
  if (popupGestureBound) return;
  popupGestureBound = true;

  const prepare = () => {
    if (preparedPopup && !preparedPopup.closed) return;
    preparedPopup = window.open('about:blank', '_blank');
    document.removeEventListener('click', prepare);
    document.removeEventListener('keydown', prepare);
    popupGestureBound = false;
  };

  document.addEventListener('click', prepare);
  document.addEventListener('keydown', prepare);
}

function tryAutoOpenForceLink(url, key) {
  let opened = false;

  if (preparedPopup && !preparedPopup.closed) {
    try {
      preparedPopup.location.href = url;
      preparedPopup.focus();
      opened = true;
    } catch {
      preparedPopup = null;
    }
  }

  if (!opened) {
    const w = window.open(url, '_blank');
    if (w) {
      opened = true;
      try { w.focus(); } catch {}
    }
  }

  if (opened) {
    if (preparedPopup && preparedPopup.closed) preparedPopup = null;
    preparePopupOnGesture();
    return;
  }

  showForceOpenOverlay(url, key);
}

function showForceOpenOverlay(url, key) {
  const overlay = document.getElementById('forceOpenOverlay');
  const btn = document.getElementById('forceOpenBtn');
  const urlEl = document.getElementById('forceOpenUrl');
  if (!overlay || !btn) return;

  urlEl.textContent = url;
  btn.href = url;
  overlay.style.display = 'flex';

  btn.onclick = (e) => {
    saveOpenedForceLink(key);
    dismissForceOpenOverlay();
  };
}

function dismissForceOpenOverlay() {
  const overlay = document.getElementById('forceOpenOverlay');
  if (overlay) overlay.style.display = 'none';
  preparePopupOnGesture();
}

function copyCode() {
  const code = sessionStorage.getItem('roomCode');
  navigator.clipboard.writeText(code).then(() => {
    showToast('Код скопійовано!');
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Код скопійовано!');
  });
}

function leaveRoom() {
  const code = sessionStorage.getItem('roomCode');
  const role = sessionStorage.getItem('role');
  const name = sessionStorage.getItem('name');
  if (code && name) {
    if (role === 'teacher') {
      db.ref('rooms/' + code).remove();
    } else {
      const memberKey = name.replace(/[.#$[\]]/g, '_');
      db.ref('rooms/' + code + '/members/' + memberKey).remove();
    }
  }
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ===== HELPERS =====
function linkifyText(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(
    /((?:https?:\/\/|www\.)[^\s]+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)/gi,
    (match) => {
      const href = /^https?:\/\//i.test(match) ? match : 'https://' + match;
      return `<a class="link-url" href="${href}" target="_blank" rel="noopener">${match}</a>`;
    }
  );
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text) {
  return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}
