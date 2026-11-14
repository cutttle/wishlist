(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const GRADIENTS = [
    'linear-gradient(135deg,#ffd1dc,#ff9a9e)',
    'linear-gradient(135deg,#c2e9fb,#a1c4fd)',
    'linear-gradient(135deg,#fddb92,#f6a96b)',
    'linear-gradient(135deg,#d4fc79,#96e6a1)',
    'linear-gradient(135deg,#e0c3fc,#8ec5fc)',
    'linear-gradient(135deg,#ffecd2,#fcb69f)',
    'linear-gradient(135deg,#fbc2eb,#a6c1ee)',
    'linear-gradient(135deg,#a8edea,#fed6e3)',
  ];
  const GIFTS = (window.GIFTS || []).map((g, i) => ({
    ...g,
    id: String(g.id || 'gift' + (i + 1)),
    gradient: g.gradient || GRADIENTS[i % GRADIENTS.length],
    emoji: g.emoji || '🎁',
  }));
  const CHOICES = {
    super: { title: 'Очень хочу!', icon: '★', mark: '⭐' },
    yes: { title: 'Хочу', icon: '♥', mark: '❤️' },
    no: { title: 'Не надо', icon: '✕', mark: '✖️' },
  };
  const ORDER = ['super', 'yes', 'no'];

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  // ---------- Состояние (сохраняется, чтобы не потерять прогресс) ----------
  const STORAGE_KEY = 'wishlist-v1:' + GIFTS.map((g) => g.id).join('|');
  const defaults = { screen: 'welcome', history: [], choices: {}, comment: '', sent: false };
  let state = defaults;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && typeof saved === 'object') state = { ...defaults, ...saved };
  } catch (_) { /* приватный режим и т.п. — работаем без сохранения */ }
  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  };
  const remaining = () => GIFTS.filter((g) => !(g.id in state.choices));

  // ---------- Экраны ----------
  function show(name) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
    state.screen = name;
    save();
    if (name === 'swipe') layout(false);
    if (name === 'results') renderResults();
  }

  // ---------- Приветствие ----------
  $('#welcome-title').textContent = CFG.friendName
    ? `С днём рождения, ${CFG.friendName}!`
    : 'С днём рождения!';
  $('#welcome-text').textContent =
    (CFG.greeting || '') + (GIFTS.length ? ` Вариантов: ${GIFTS.length}.` : '');
  $('#welcome-from').textContent = CFG.fromName ? `С любовью, ${CFG.fromName} 💛` : '';
  $('#btn-start').addEventListener('click', () => show(remaining().length ? 'swipe' : 'results'));

  // ---------- Карточки ----------
  const deck = $('#deck');
  const cards = new Map();

  function createCard(g) {
    const card = el('article', 'card');
    card.dataset.id = g.id;

    const media = el('div', 'card-media');
    media.style.background = g.gradient;
    media.append(el('span', 'card-emoji', g.emoji));
    if (g.image) {
      const img = new Image();
      img.className = 'card-img';
      img.alt = g.title;
      img.draggable = false;
      img.decoding = 'async';
      img.onload = () => media.classList.add('has-img');
      img.onerror = () => img.remove();
      img.src = g.image;
      media.append(img);
    }

    if (g.badge) media.append(el('span', 'card-badge', g.badge));
    if (g.credit && g.image) media.append(el('span', 'card-credit', g.credit));

    const body = el('div', 'card-body');
    body.append(el('h2', 'card-title', g.title));
    if (g.price) body.append(el('div', 'card-price', g.price));
    if (g.description) body.append(el('p', 'card-desc', g.description));
    if (g.link) {
      const a = el('a', 'card-link', 'Посмотреть в магазине ↗');
      a.href = g.link;
      a.target = '_blank';
      a.rel = 'noopener';
      body.append(a);
    }

    card.append(
      media,
      body,
      el('div', 'stamp stamp-yes', 'Хочу'),
      el('div', 'stamp stamp-no', 'Не надо'),
      el('div', 'stamp stamp-super', 'Очень хочу!'),
    );
    return card;
  }

  // Карточки добавляются в обратном порядке, чтобы первая оказалась сверху
  [...GIFTS].reverse().forEach((g) => {
    const c = createCard(g);
    cards.set(g.id, c);
    deck.append(c);
    if (g.id in state.choices) c.style.display = 'none';
  });

  function setStamps(card, intent) {
    for (const k of ORDER) {
      const s = card.querySelector('.stamp-' + k);
      s.style.opacity = intent && intent.choice === k ? Math.min(1, Math.max(0, intent.power)) : 0;
    }
  }

  let toResultsTimer = null;
  function layout(animate = true) {
    const rem = remaining();
    rem.forEach((g, i) => {
      const c = cards.get(g.id);
      const depth = Math.min(i, 2);
      c.style.display = '';
      c.style.zIndex = String(100 - i);
      c.style.transition = animate ? 'transform .3s ease, opacity .3s ease' : 'none';
      c.style.transform = `translateY(${depth * 14}px) scale(${1 - depth * 0.05})`;
      c.style.opacity = i < 3 ? '1' : '0';
      c.classList.toggle('top', i === 0);
      c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      setStamps(c, null);
    });

    const done = GIFTS.length - rem.length;
    $('#counter').textContent = `${Math.min(done + 1, GIFTS.length)} / ${GIFTS.length}`;
    $('#progress-bar').style.width = (GIFTS.length ? (done / GIFTS.length) * 100 : 100) + '%';
    $('#btn-undo').disabled = state.history.length === 0;

    clearTimeout(toResultsTimer);
    if (rem.length === 0 && state.screen === 'swipe') {
      toResultsTimer = setTimeout(() => show('results'), 450);
    }
  }

  // ---------- Решение по карточке ----------
  let busy = false;
  function decide(choice, from = { dx: 0, dy: 0 }) {
    const rem = remaining();
    if (!rem.length || busy) return;
    const g = rem[0];
    const c = cards.get(g.id);
    busy = true;

    const W = window.innerWidth;
    const H = window.innerHeight;
    let tx, ty, rot;
    if (choice === 'super') { tx = from.dx; ty = -H * 1.1; rot = from.dx / 20; }
    else { tx = (choice === 'yes' ? 1 : -1) * W * 1.4; ty = from.dy + 60; rot = choice === 'yes' ? 28 : -28; }

    setStamps(c, { choice, power: 1 });
    c.style.transition = 'transform .42s ease-in, opacity .42s ease-in';
    c.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg)`;
    c.style.opacity = '0';
    c.classList.remove('top');

    state.choices[g.id] = choice;
    state.history.push(g.id);
    save();
    if (navigator.vibrate) navigator.vibrate(choice === 'super' ? [10, 40, 10] : 12);

    layout(true);
    setTimeout(() => { c.style.display = 'none'; busy = false; }, 420);
  }

  function undo() {
    if (busy || !state.history.length) return;
    const id = state.history.pop();
    const choice = state.choices[id];
    delete state.choices[id];
    save();

    const c = cards.get(id);
    const W = window.innerWidth;
    c.style.transition = 'none';
    c.style.display = '';
    c.style.opacity = '0';
    c.style.transform = choice === 'super'
      ? `translateY(${-window.innerHeight}px)`
      : `translate(${(choice === 'yes' ? 1 : -1) * W * 1.2}px, 40px) rotate(${choice === 'yes' ? 25 : -25}deg)`;
    void c.offsetWidth; // применяем стартовую позицию до анимации
    requestAnimationFrame(() => layout(true));
  }

  // ---------- Свайп пальцем / мышью ----------
  let drag = null;

  function intentOf(dx, dy) {
    if (-dy > Math.abs(dx) && -dy > 20) return { choice: 'super', power: -dy / 120 };
    if (dx > 0) return { choice: 'yes', power: dx / 110 };
    return { choice: 'no', power: -dx / 110 };
  }

  deck.addEventListener('pointerdown', (e) => {
    if (busy || drag) return;
    const c = e.target.closest('.card.top');
    if (!c || e.target.closest('a')) return;
    drag = { c, pid: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, t0: performance.now() };
    c.style.transition = 'none';
    try { c.setPointerCapture(e.pointerId); } catch (_) {}
  });

  deck.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pid) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    drag.c.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 18}deg)`;
    setStamps(drag.c, intentOf(drag.dx, drag.dy));
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pid) return;
    const { c, dx, dy, t0 } = drag;
    drag = null;
    const dt = Math.max(1, performance.now() - t0);
    const vx = dx / dt;
    const vy = dy / dt;
    const up = -dy > Math.abs(dx);

    let choice = null;
    if (up && (-dy > 110 || (vy < -0.6 && -dy > 40))) choice = 'super';
    else if (!up && (dx > 110 || (vx > 0.6 && dx > 40))) choice = 'yes';
    else if (!up && (dx < -110 || (vx < -0.6 && dx < -40))) choice = 'no';

    if (choice && e.type !== 'pointercancel') {
      decide(choice, { dx, dy });
    } else {
      c.style.transition = 'transform .35s cubic-bezier(.2,.9,.3,1.25)';
      c.style.transform = 'translateY(0) scale(1)';
      setStamps(c, null);
    }
  }
  deck.addEventListener('pointerup', endDrag);
  deck.addEventListener('pointercancel', endDrag);

  document.querySelectorAll('.ctrl').forEach((b) =>
    b.addEventListener('click', () => decide(b.dataset.choice)),
  );
  $('#btn-undo').addEventListener('click', undo);

  document.addEventListener('keydown', (e) => {
    if (state.screen !== 'swipe') return;
    if (e.key === 'ArrowRight') decide('yes');
    else if (e.key === 'ArrowLeft') decide('no');
    else if (e.key === 'ArrowUp') decide('super');
    else if (e.key === 'Backspace' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) undo();
  });

  // ---------- Итоги ----------
  function thumb(g) {
    const t = el('div', 'item-thumb');
    t.style.background = g.gradient;
    t.textContent = g.emoji;
    if (g.image) {
      const img = new Image();
      img.onload = () => {
        t.textContent = '';
        t.style.background = `center / cover no-repeat url("${g.image.replace(/"/g, '%22')}")`;
      };
      img.src = g.image;
    }
    return t;
  }

  function renderResults() {
    const list = $('#results-list');
    list.textContent = '';
    for (const key of ORDER) {
      const items = GIFTS.filter((g) => state.choices[g.id] === key);
      list.append(el('h2', 'group-title', `${CHOICES[key].mark} ${CHOICES[key].title} · ${items.length}`));
      if (!items.length) list.append(el('p', 'group-empty', 'Пусто'));
      for (const g of items) {
        const row = el('div', 'item');
        const title = el('div', 'item-title', g.title);
        if (g.price) title.append(el('span', 'item-price', g.price));
        const seg = el('div', 'seg');
        for (const k of ORDER) {
          const b = el('button', k === key ? 'on' : '', CHOICES[k].icon);
          b.dataset.choice = k;
          b.setAttribute('aria-label', `${g.title}: ${CHOICES[k].title}`);
          b.addEventListener('click', () => {
            if (state.choices[g.id] === k) return;
            state.choices[g.id] = k;
            save();
            renderResults();
          });
          seg.append(b);
        }
        row.append(thumb(g), title, seg);
        list.append(row);
      }
    }
    const hints = GIFTS.filter((g) => g.commentHint && ['super', 'yes'].includes(state.choices[g.id]));
    const hintList = $('#comment-hints-list');
    hintList.textContent = '';
    hints.forEach((g) => hintList.append(el('li', '', g.commentHint)));
    $('#comment-hints').hidden = hints.length === 0;

    $('#btn-send').textContent = state.sent ? 'Отправить ещё раз (с изменениями) 💌' : 'Отправить 💌';
  }

  const comment = $('#comment');
  comment.value = state.comment || '';
  comment.addEventListener('input', () => { state.comment = comment.value; save(); });

  $('#btn-restart').addEventListener('click', () => {
    if (!confirm('Начать заново? Текущий выбор сбросится (комментарий останется).')) return;
    state.choices = {};
    state.history = [];
    save();
    cards.forEach((c) => { c.style.transition = 'none'; c.style.display = ''; c.style.opacity = '1'; });
    show('swipe');
  });

  // ---------- Текст письма ----------
  function buildMessage() {
    const lines = [];
    lines.push('🎂 Вишлист на день рождения' + (CFG.friendName ? ` — ${CFG.friendName}` : ''));
    lines.push('');
    for (const key of ORDER) {
      const items = GIFTS.filter((g) => state.choices[g.id] === key);
      lines.push(`${CHOICES[key].mark} ${CHOICES[key].title.toUpperCase()} (${items.length}):`);
      if (!items.length) lines.push('  —');
      for (const g of items) {
        lines.push(`  • ${g.title}${g.price ? ' (' + g.price + ')' : ''}`);
        if (g.link && key !== 'no') lines.push(`    ${g.link}`);
      }
      lines.push('');
    }
    lines.push('💬 Комментарий:');
    lines.push(state.comment && state.comment.trim() ? state.comment.trim() : '  — без комментария —');
    lines.push('');
    lines.push('Отправлено: ' + new Date().toLocaleString('ru-RU'));
    return lines.join('\n');
  }

  // ---------- Отправка ----------
  const btnSend = $('#btn-send');
  const errBox = $('#send-error');

  function showError(text) {
    $('#send-error-text').textContent = text;
    const mailto = $('#btn-mailto');
    if (CFG.fallbackEmail) {
      mailto.hidden = false;
      mailto.href = `mailto:${CFG.fallbackEmail}?subject=${encodeURIComponent(CFG.emailSubject || 'Вишлист')}&body=${encodeURIComponent(buildMessage())}`;
    }
    $('#btn-share').hidden = !navigator.share;
    errBox.hidden = false;
    errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  btnSend.addEventListener('click', async () => {
    errBox.hidden = true;
    if (!CFG.web3formsKey) {
      showError('Автоматическая отправка пока не настроена. Можно переслать результат вручную:');
      return;
    }
    btnSend.disabled = true;
    btnSend.textContent = 'Отправляем…';
    try {
      // FormData = «простой» запрос без CORS-preflight (его блокирует защита Web3Forms)
      const form = new FormData();
      form.append('access_key', CFG.web3formsKey);
      form.append('subject', CFG.emailSubject || 'Вишлист');
      form.append('from_name', 'Вишлист' + (CFG.friendName ? ' · ' + CFG.friendName : ''));
      form.append('message', buildMessage());
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.message || 'HTTP ' + res.status);
      state.sent = true;
      save();
      show('done');
      confetti();
    } catch (err) {
      console.error(err);
      showError(
        navigator.onLine === false
          ? 'Похоже, нет интернета. Подключись и попробуй ещё раз — или перешли результат вручную:'
          : 'Не получилось отправить. Попробуй ещё раз чуть позже — или перешли результат вручную:',
      );
    } finally {
      btnSend.disabled = false;
      renderResults();
    }
  });

  $('#btn-share').addEventListener('click', async () => {
    try {
      await navigator.share({ title: CFG.emailSubject || 'Вишлист', text: buildMessage() });
    } catch (_) { /* пользователь закрыл окно */ }
  });

  $('#btn-copy').addEventListener('click', async () => {
    const text = buildMessage();
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      const ta = el('textarea');
      ta.value = text;
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Скопировано! Вставь текст в сообщение 💌');
  });

  $('#btn-review').addEventListener('click', () => show('results'));

  // ---------- Мелочи ----------
  let toastTimer;
  function toast(text) {
    const t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#ff5c84', '#ff8a5c', '#ffd166', '#3b8bff', '#7bd389', '#c77dff'];
    for (let i = 0; i < 90; i++) {
      const p = el('div', 'confetti');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2.2 + Math.random() * 2 + 's';
      p.style.animationDelay = Math.random() * 0.6 + 's';
      p.style.setProperty('--drift', (Math.random() - 0.5) * 200 + 'px');
      p.style.setProperty('--spin', (Math.random() * 900 - 450) + 'deg');
      document.body.append(p);
      setTimeout(() => p.remove(), 5000);
    }
  }

  // ---------- Старт ----------
  const startScreen = state.sent && state.screen !== 'results'
    ? 'done'
    : state.screen === 'swipe' && !remaining().length ? 'results' : state.screen;
  show(['welcome', 'swipe', 'results', 'done'].includes(startScreen) ? startScreen : 'welcome');

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
