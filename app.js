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
    // Auto-fill from URL param ?code=XXXXX&pass=YYYYY
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    const urlPass = params.get('pass');
    if (urlCode) {
      codeInput.value = urlCode;
      if (urlPass) document.getElementById('joinPassword').value = urlPass;
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

  window.__room = { code, role, name, linksRef };

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

    // Show password in sidebar + generate QR code
    const passwordCard = document.getElementById('passwordCard');
    if (passwordCard) passwordCard.style.display = 'block';

    roomRef.once('value', (snap) => {
      const data = snap.val();
      if (passwordCard) {
        document.getElementById('displayPassword').textContent = data.password || '';
      }

      const qrUrl = `${window.location.origin}${window.location.pathname.replace('room.html', '')}index.html?code=${encodeURIComponent(code)}&pass=${encodeURIComponent(data.password || '')}`;
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
    });

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
      const type = link.type || 'message';

      if (role === 'student' && type === 'message' && link.forceOpen && link.url && !openedForceLinks.has(key)) {
        openedForceLinks.add(key);
        saveOpenedForceLink(key);
        tryAutoOpenForceLink(link.url, key);
      }

      const card = document.createElement('div');
      card.className = 'link-card' + (type !== 'message' ? ' link-card-' + type : '');
      card.dataset.key = key;

      const deleteBtn = role === 'teacher' ? `<button class="link-delete" onclick="deleteLink('${key}')" title="Видалити">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>` : '';

      if (type === 'video') {
        card.innerHTML = renderVideoCard(key, link) + deleteBtn;
      } else if (type === 'poll') {
        card.innerHTML = renderPollCard(key, link, role, name) + deleteBtn;
      } else if (type === 'quiz') {
        card.innerHTML = renderQuizCard(key, link, role, name) + deleteBtn;
      } else if (type === 'question') {
        card.innerHTML = renderQuestionCard(key, link, role, name) + deleteBtn;
      } else {
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
          ${deleteBtn}
        `;
      }
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

// ===== ROOM MODALS =====
function closeRoomModals() {
  document.querySelectorAll('#videoModal, #pollModal, #quizModal, #questionModal')
    .forEach(m => m.classList.remove('active'));
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeRoomModals();
});

// ===== VIDEO =====
function parseVideoUrl(raw) {
  let url = raw.trim();
  if (!url) return null;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let m;
  // YouTube
  if ((m = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/))) {
    return { provider: 'youtube', id: m[1], url };
  }
  // Vimeo
  if ((m = url.match(/vimeo\.com\/(\d+)/))) {
    return { provider: 'vimeo', id: m[1], url };
  }
  return null;
}

function getVideoEmbed(v) {
  if (v.provider === 'youtube') return `https://www.youtube.com/embed/${v.id}`;
  if (v.provider === 'vimeo') return `https://player.vimeo.com/video/${v.id}`;
  return '';
}

function getVideoThumb(v) {
  if (v.provider === 'youtube') return `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
  return '';
}

function openVideoModal() {
  closeRoomModals();
  document.getElementById('videoModal').classList.add('active');
  document.getElementById('videoUrl').value = '';
  document.getElementById('videoTitle').value = '';
  document.getElementById('videoPreview').style.display = 'none';
  document.getElementById('videoUrl').focus();
}

document.addEventListener('input', (e) => {
  if (e.target.id !== 'videoUrl') return;
  const v = parseVideoUrl(e.target.value);
  const prev = document.getElementById('videoPreview');
  if (!v) { prev.style.display = 'none'; return; }
  const thumb = getVideoThumb(v);
  prev.style.display = 'block';
  prev.innerHTML = thumb
    ? `<img src="${thumb}" alt="preview">`
    : `<div class="video-thumb-fallback">${v.provider === 'vimeo' ? 'Vimeo' : 'Відео'}</div>`;
});

function sendVideo() {
  const urlVal = document.getElementById('videoUrl').value;
  const title = document.getElementById('videoTitle').value.trim();
  const v = parseVideoUrl(urlVal);
  if (!v) { showToast('Вставте посилання на YouTube або Vimeo'); return; }

  const { code, name, linksRef } = window.__room;
  linksRef.push({
    type: 'video',
    text: title || v.url,
    url: v.url,
    videoProvider: v.provider,
    videoId: v.id,
    author: name,
    timestamp: Date.now()
  });
  closeRoomModals();
  showToast('Відео надіслано');
}

function renderVideoCard(key, link) {
  const v = { provider: link.videoProvider, id: link.videoId };
  const thumb = getVideoThumb(v);
  const embed = getVideoEmbed(v);

  const preview = thumb
    ? `<div class="video-thumb" onclick="playVideo('${key}')">
         <img src="${thumb}" alt="">
         <div class="video-play"><div class="video-play-circle">
           <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="8 5 20 12 8 19 8 5"/></svg>
         </div></div>
       </div>`
    : `<div class="video-thumb" onclick="playVideo('${key}')">
         <div class="video-thumb-fallback-lg">${v.provider === 'vimeo' ? 'Vimeo' : 'YouTube'}</div>
         <div class="video-play"><div class="video-play-circle">
           <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><polygon points="8 5 20 12 8 19 8 5"/></svg>
         </div></div>
       </div>`;

  return `
    <div class="link-icon" style="background:#FDECEA;color:#EA4335;">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
    </div>
    <div class="link-content">
      <div class="link-text">${escapeHtml(link.text || '')}</div>
      <div class="video-mount" id="video_${key}" data-embed="${escapeAttr(embed)}">${preview}</div>
      <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)}</div>
    </div>`;
}

function playVideo(key) {
  const mount = document.getElementById('video_' + key);
  if (!mount) return;
  const embed = mount.dataset.embed;
  if (!embed) return;
  mount.innerHTML = `<div class="video-embed"><iframe src="${embed}?autoplay=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
}

// ===== POLL =====
function openPollModal() {
  closeRoomModals();
  document.getElementById('pollModal').classList.add('active');
  document.getElementById('pollQuestion').value = '';
  document.getElementById('pollOptions').innerHTML = `
    <div class="poll-option-row"><input type="text" placeholder="Варіант 1" maxlength="80" class="poll-opt"></div>
    <div class="poll-option-row"><input type="text" placeholder="Варіант 2" maxlength="80" class="poll-opt"></div>
  `;
  document.getElementById('pollQuestion').focus();
}

function addPollOption() {
  const wrap = document.getElementById('pollOptions');
  if (wrap.children.length >= 8) { showToast('Максимум 8 варіантів'); return; }
  const n = wrap.children.length + 1;
  const row = document.createElement('div');
  row.className = 'poll-option-row';
  row.innerHTML = `<input type="text" placeholder="Варіант ${n}" maxlength="80" class="poll-opt">
    <button class="poll-opt-remove" onclick="this.parentElement.remove()" title="Прибрати">&times;</button>`;
  wrap.appendChild(row);
}

function fillYesNo() {
  document.getElementById('pollOptions').innerHTML = `
    <div class="poll-option-row"><input type="text" value="Так" maxlength="80" class="poll-opt"></div>
    <div class="poll-option-row"><input type="text" value="Ні" maxlength="80" class="poll-opt"></div>
  `;
}

function sendPoll() {
  const question = document.getElementById('pollQuestion').value.trim();
  const opts = [...document.querySelectorAll('#pollOptions .poll-opt')]
    .map(i => i.value.trim()).filter(Boolean);

  if (!question) { showToast('Введіть питання'); return; }
  if (opts.length < 2) { showToast('Потрібно щонайменше 2 варіанти'); return; }

  const { name, linksRef } = window.__room;
  linksRef.push({
    type: 'poll',
    text: question,
    question: question,
    options: opts,
    votes: {},
    author: name,
    timestamp: Date.now()
  });
  closeRoomModals();
  showToast('Опитування створено');
}

function votePoll(key, optionIndex) {
  const { code, role, name } = window.__room;
  if (role !== 'student') { showToast('Голосувати можуть лише учні'); return; }
  const voterKey = name.replace(/[.#$[\]]/g, '_');
  db.ref(`rooms/${code}/links/${key}/votes/${voterKey}`).set(optionIndex);
}

function renderPollCard(key, link, role, name) {
  const options = link.options || [];
  const votes = link.votes || {};
  const voterKeys = Object.keys(votes);
  const total = voterKeys.length;
  const myKey = name.replace(/[.#$[\]]/g, '_');
  const myVote = votes[myKey];

  let optionsHtml = '';
  options.forEach((opt, i) => {
    const count = voterKeys.filter(k => votes[k] === i).length;
    const pct = total ? Math.round((count / total) * 100) : 0;
    const voted = myVote !== undefined;
    const isMine = myVote === i;

    if (voted || role === 'teacher') {
      optionsHtml += `
        <div class="poll-result ${isMine ? 'mine' : ''}">
          <div class="poll-result-bar" style="width:${pct}%"></div>
          <div class="poll-result-label">
            <span>${escapeHtml(opt)}</span>
            <span class="poll-result-pct">${count} · ${pct}%</span>
          </div>
        </div>`;
    } else {
      optionsHtml += `<button class="poll-option" onclick="votePoll('${key}', ${i})">${escapeHtml(opt)}</button>`;
    }
  });

  const meta = role === 'teacher'
    ? `${total} голос(ів)`
    : (myVote !== undefined ? 'Ваш голос враховано' : 'Оберіть відповідь');

  return `
    <div class="link-icon poll-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
    </div>
    <div class="link-content">
      <div class="link-text">${escapeHtml(link.question || link.text)}</div>
      <div class="poll-body">${optionsHtml}</div>
      <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)} · ${meta}</div>
    </div>`;
}

// ===== QUIZ =====
let quizEditorSeq = 0;

function openQuizModal() {
  closeRoomModals();
  document.getElementById('quizModal').classList.add('active');
  document.getElementById('quizQuestions').innerHTML = '';
  addQuizQuestion();
}

function addQuizQuestion() {
  const wrap = document.getElementById('quizQuestions');
  const n = wrap.children.length + 1;
  const gid = 'correct_g' + (++quizEditorSeq);
  const div = document.createElement('div');
  div.className = 'quiz-q-editor';
  div.innerHTML = `
    <div class="quiz-q-head">
      <strong>Питання ${n}</strong>
      ${n > 1 ? `<button class="poll-opt-remove" onclick="this.closest('.quiz-q-editor').remove()" title="Видалити">&times;</button>` : ''}
    </div>
    <input type="text" class="quiz-q-text" placeholder="Текст питання" maxlength="300">
    <div class="quiz-opts">
      <div class="quiz-opt-row"><input type="radio" name="${gid}" class="quiz-correct" checked><input type="text" class="quiz-opt" placeholder="Варіант 1" maxlength="120"></div>
      <div class="quiz-opt-row"><input type="radio" name="${gid}" class="quiz-correct"><input type="text" class="quiz-opt" placeholder="Варіант 2" maxlength="120"></div>
      <div class="quiz-opt-row"><input type="radio" name="${gid}" class="quiz-correct"><input type="text" class="quiz-opt" placeholder="Варіант 3 (необов'язково)" maxlength="120"></div>
      <div class="quiz-opt-row"><input type="radio" name="${gid}" class="quiz-correct"><input type="text" class="quiz-opt" placeholder="Варіант 4 (необов'язково)" maxlength="120"></div>
    </div>
    <div class="quiz-q-hint">Позначте правильну відповідь</div>
  `;
  wrap.appendChild(div);
}

function sendQuiz() {
  const editors = document.querySelectorAll('.quiz-q-editor');
  const questions = [];
  let valid = true;

  editors.forEach(ed => {
    const q = ed.querySelector('.quiz-q-text').value.trim();
    const opts = [...ed.querySelectorAll('.quiz-opt')].map(i => i.value.trim());
    const radios = [...ed.querySelectorAll('.quiz-correct')];
    const correctIdx = radios.findIndex(r => r.checked);
    const filled = opts.filter(Boolean);
    const correctVal = opts[correctIdx] || '';

    if (!q || filled.length < 2 || !correctVal) { valid = false; return; }

    // Remap correct index among filled options
    const filledWithIdx = opts.map((o, i) => ({ o, i })).filter(x => x.o);
    const remapped = filledWithIdx.findIndex(x => x.i === correctIdx);
    questions.push({ q, options: filled, correct: remapped });
  });

  if (!valid || questions.length === 0) { showToast('Заповніть усі питання і позначте правильні відповіді'); return; }

  const { name, linksRef } = window.__room;
  linksRef.push({
    type: 'quiz',
    text: `Тест: ${questions.length} питань`,
    quizQuestions: questions,
    responses: {},
    author: name,
    timestamp: Date.now()
  });
  closeRoomModals();
  showToast('Тест створено');
}

function submitQuiz(key) {
  const { role, name } = window.__room;
  if (role !== 'student') return;

  const card = document.querySelector(`.link-card[data-key="${key}"]`);
  if (!card) return;

  const questions = (window.__quizCache && window.__quizCache[key]) || [];
  const draft = (window.__quizDrafts && window.__quizDrafts[key]) || {};
  const answers = [];
  let allAnswered = true;

  questions.forEach((q, qi) => {
    const val = draft[qi];
    if (val === undefined || val === null) allAnswered = false;
    else answers.push(val);
  });

  if (!allAnswered) { showToast('Відповійте на всі питання'); return; }

  const score = questions.reduce((s, q, i) => s + (answers[i] === q.correct ? 1 : 0), 0);
  const studentKey = name.replace(/[.#$[\]]/g, '_');
  const { code } = window.__room;
  db.ref(`rooms/${code}/links/${key}/responses/${studentKey}`).set({
    answers,
    score,
    at: Date.now()
  });
}

document.addEventListener('change', (e) => {
  if (e.target.matches('.quiz-answer input[type="radio"]')) {
    const card = e.target.closest('.link-card');
    if (!card) return;
    const key = card.dataset.key;
    const name = e.target.name; // q_KEY_QI
    const m = name.match(/^q_(.+)_(\d+)$/);
    if (!m) return;
    const qi = parseInt(m[2], 10);
    window.__quizDrafts = window.__quizDrafts || {};
    window.__quizDrafts[key] = window.__quizDrafts[key] || {};
    window.__quizDrafts[key][qi] = parseInt(e.target.value, 10);
  }
});

function renderQuizCard(key, link, role, name) {
  const questions = link.quizQuestions || [];
  const responses = link.responses || {};
  const myKey = name.replace(/[.#$[\]]/g, '_');
  const myResp = responses[myKey];

  window.__quizCache = window.__quizCache || {};
  window.__quizCache[key] = questions;

  let body = '';

  if (role === 'teacher') {
    const respList = Object.entries(responses);
    body = `
      <div class="quiz-teacher-results">
        ${questions.map((q, qi) => {
          const counts = q.options.map((_, oi) => respList.filter(([, r]) => (r.answers || [])[qi] === oi).length);
          const max = Math.max(...counts, 1);
          return `
            <div class="quiz-q-result">
              <div class="quiz-q-result-title">${qi + 1}. ${escapeHtml(q.q)}</div>
              ${q.options.map((opt, oi) => {
                const c = counts[oi];
                const isCorrect = oi === q.correct;
                return `<div class="quiz-bar ${isCorrect ? 'correct' : ''}">
                  <div class="quiz-bar-fill" style="width:${(c / max) * 100}%"></div>
                  <span>${escapeHtml(opt)}${isCorrect ? ' ✓' : ''} — ${c}</span>
                </div>`;
              }).join('')}
            </div>`;
        }).join('')}
        <div class="link-time" style="margin-top:8px;">Відповіли: ${respList.length}</div>
      </div>`;
  } else if (myResp) {
    const score = myResp.score || 0;
    body = `
      <div class="quiz-result-done">
        <div class="quiz-score">${score} / ${questions.length}</div>
        <div class="quiz-score-label">Ваш результат</div>
        ${questions.map((q, qi) => {
          const given = (myResp.answers || [])[qi];
          const ok = given === q.correct;
          return `<div class="quiz-review ${ok ? 'ok' : 'bad'}">
            <div>${ok ? '✓' : '✗'} ${escapeHtml(q.q)}</div>
            <div class="quiz-review-answer">Ваша відповідь: ${escapeHtml(q.options[given] ?? '—')} ${ok ? '' : ' · Правильно: ' + escapeHtml(q.options[q.correct])}</div>
          </div>`;
        }).join('')}
      </div>`;
  } else {
    const draft = (window.__quizDrafts && window.__quizDrafts[key]) || {};
    body = `
      <div class="quiz-taker">
        ${questions.map((q, qi) => `
          <div class="quiz-q">
            <div class="quiz-q-title">${qi + 1}. ${escapeHtml(q.q)}</div>
            ${q.options.map((opt, oi) => `
              <label class="quiz-answer">
                <input type="radio" name="q_${key}_${qi}" value="${oi}" ${draft[qi] === oi ? 'checked' : ''}>
                <span>${escapeHtml(opt)}</span>
              </label>
            `).join('')}
          </div>
        `).join('')}
        <button class="btn btn-primary btn-sm" onclick="submitQuiz('${key}')">Надіслати відповіді</button>
      </div>`;
  }

  return `
    <div class="link-icon quiz-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    </div>
    <div class="link-content">
      <div class="link-text">${escapeHtml(link.text || 'Тест')}</div>
      <div class="quiz-body">${body}</div>
      <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)}</div>
    </div>`;
}

// ===== QUESTION (private answers) =====
function openQuestionModal() {
  closeRoomModals();
  document.getElementById('questionModal').classList.add('active');
  document.getElementById('questionText').value = '';
  document.getElementById('questionText').focus();
}

function sendQuestion() {
  const q = document.getElementById('questionText').value.trim();
  if (!q) { showToast('Введіть питання'); return; }

  const { name, linksRef } = window.__room;
  linksRef.push({
    type: 'question',
    text: q,
    question: q,
    answers: {},
    author: name,
    timestamp: Date.now()
  });
  closeRoomModals();
  showToast('Питання надіслано');
}

function submitAnswer(key) {
  const { role, name, code } = window.__room;
  if (role !== 'student') return;

  const card = document.querySelector(`.link-card[data-key="${key}"]`);
  const input = card && card.querySelector('.answer-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) { showToast('Введіть відповідь'); return; }

  const studentKey = name.replace(/[.#$[\]]/g, '_');
  db.ref(`rooms/${code}/links/${key}/answers/${studentKey}`).set({
    text,
    at: Date.now()
  });
  if (window.__answerDrafts) delete window.__answerDrafts[key];
}

document.addEventListener('input', (e) => {
  if (e.target.matches('.answer-input')) {
    const card = e.target.closest('.link-card');
    if (!card) return;
    window.__answerDrafts = window.__answerDrafts || {};
    window.__answerDrafts[card.dataset.key] = e.target.value;
  }
});

function renderQuestionCard(key, link, role, name) {
  const answers = link.answers || {};
  const myKey = name.replace(/[.#$[\]]/g, '_');
  const myAnswer = answers[myKey];

  let body = '';

  if (role === 'teacher') {
    const entries = Object.entries(answers).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
    body = entries.length
      ? `<div class="answers-list">${entries.map(([k, a]) => `
          <div class="answer-item">
            <div class="answer-author">${escapeHtml(k.replace(/_/g, ' '))}</div>
            <div class="answer-text">${escapeHtml(a.text)}</div>
          </div>`).join('')}</div>
        <div class="link-time">Відповідей: ${entries.length}</div>`
      : `<div class="answers-empty">Ще немає відповідей</div>`;
  } else if (myAnswer) {
    body = `<div class="answer-sent">Вашу відповідь надіслано ✓</div>`;
  } else {
    const draft = (window.__answerDrafts && window.__answerDrafts[key]) || '';
    body = `
      <div class="answer-form">
        <textarea class="answer-input" rows="2" placeholder="Ваша відповідь..." maxlength="1000">${escapeHtml(draft)}</textarea>
        <button class="btn btn-primary btn-sm" onclick="submitAnswer('${key}')">Надіслати</button>
      </div>`;
  }

  return `
    <div class="link-icon question-icon">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <div class="link-content">
      <div class="link-text">${escapeHtml(link.question || link.text)}</div>
      <div class="question-body">${body}</div>
      <div class="link-time">${formatTime(link.timestamp)} · ${escapeHtml(link.author)}${role === 'student' ? ' · Приватно' : ''}</div>
    </div>`;
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
