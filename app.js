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

// ===== INDEX PAGE LOGIC =====
function showCreateModal() {
  document.getElementById('createModal').classList.add('active');
  document.getElementById('roomName').focus();
}

function showJoinModal() {
  document.getElementById('joinModal').classList.add('active');
  document.getElementById('joinCode').focus();
}

function closeModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

// Enter key support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModals();
  if (e.key === 'Enter') {
    if (document.getElementById('createModal').classList.contains('active')) createRoom();
    if (document.getElementById('joinModal').classList.contains('active')) joinRoom();
  }
});

// Only digits in code input + auto-fill from QR
document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('joinCode');
  if (codeInput) {
    codeInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });
    // Auto-fill from URL param ?code=XXXXX
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    if (urlCode && /^\d{5}$/.test(urlCode)) {
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

// Generate 5-digit code
function generateCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

function createRoom() {
  const name = document.getElementById('roomName').value.trim();
  const teacher = document.getElementById('teacherName').value.trim();
  if (!name || !teacher) {
    showToast('Заповніть всі поля');
    return;
  }

  const code = generateCode();
  const roomRef = db.ref('rooms/' + code);

  roomRef.once('value').then((snap) => {
    if (snap.exists()) {
      showToast('Код вже існує, спробуйте ще раз');
      createRoom();
      return;
    }

    return roomRef.set({
      name: name,
      teacher: teacher,
      createdAt: Date.now()
    });
  }).then(() => {
    if (!name || !teacher) return;
    sessionStorage.setItem('roomCode', code);
    sessionStorage.setItem('role', 'teacher');
    sessionStorage.setItem('name', teacher);
    window.location.href = 'room.html';
  }).catch((err) => {
    console.error('Помилка створення кімнати:', err);
    showToast('Помилка: ' + err.message);
  });
}

function joinRoom() {
  const code = document.getElementById('joinCode').value.trim();
  const name = document.getElementById('studentName').value.trim();
  if (!code || code.length !== 5) {
    showToast('Введіть 5-значний код');
    return;
  }
  if (!name) {
    showToast('Введіть ваше ім\'я');
    return;
  }

  const roomRef = db.ref('rooms/' + code);
  roomRef.once('value', (snap) => {
    if (!snap.exists()) {
      showToast('Кімнату не знайдено');
      return;
    }
    sessionStorage.setItem('roomCode', code);
    sessionStorage.setItem('role', 'student');
    sessionStorage.setItem('name', name);
    window.location.href = 'room.html';
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
      ? `Учитель: ${name} | ${data.teacher}`
      : `Учень: ${name}`;
  });

  // Show teacher controls
  if (role === 'teacher') {
    document.getElementById('inputPanel').style.display = 'block';
    document.getElementById('codeCard').style.display = 'block';
    document.getElementById('qrCard').style.display = 'block';
    document.getElementById('copyCodeBtn').style.display = 'inline-flex';
    document.getElementById('displayCode').textContent = code;

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
        ${escapeHtml(m.name)}${m.role === 'teacher' ? ' (учитель)' : ''}
      `;
      list.appendChild(li);
    });
  });

  // Listen to links
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
          <div class="link-text">${escapeHtml(link.text)}</div>
          ${link.url ? `<a class="link-url" href="${escapeHtml(link.url)}" target="_blank" rel="noopener">${escapeHtml(link.url)}</a>` : ''}
          <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)}</div>
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

  // Detect URL
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = text.match(urlRegex);
  const url = urls ? urls[0] : '';
  const displayText = url ? text.replace(url, '').trim() || url : text;

  linksRef.push({
    text: displayText,
    url: url,
    author: name,
    timestamp: Date.now()
  });

  input.value = '';
  input.focus();
}

function deleteLink(key) {
  const code = sessionStorage.getItem('roomCode');
  db.ref('rooms/' + code + '/links/' + key).remove();
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
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
