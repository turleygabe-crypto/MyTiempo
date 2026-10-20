const KEY = 'mytiempo.v1';
const zones = Intl.supportedValuesOf('timeZone');
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

let state = JSON.parse(localStorage.getItem(KEY) || 'null') || {
  home: localTz,
  clocks: [{ id: crypto.randomUUID(), tz: localTz, label: 'Home', style: 'both', face: 'numbers', hour: '12', seconds: true }],
};
const save = () => localStorage.setItem(KEY, JSON.stringify(state));

const $ = (id) => document.getElementById(id);
const dash = $('dashboard'), dlg = $('dlg');
let editingId = null, dragId = null;

function parts(tz, date) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const o = {};
  for (const p of f.formatToParts(date)) o[p.type] = +p.value;
  return o;
}
const asUtc = (p) => Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

function describe(tz, now) {
  const p = parts(tz, now), h = parts(state.home, now);
  const diffMin = Math.round((asUtc(p) - asUtc(h)) / 60000);
  const dayDiff = Math.round((Date.UTC(p.year, p.month - 1, p.day) - Date.UTC(h.year, h.month - 1, h.day)) / 864e5);
  return { p, diffMin, dayDiff };
}

function offsetText(min, dayDiff) {
  const day = dayDiff === 0 ? 'same day' : dayDiff > 0 ? 'tomorrow' : 'yesterday';
  if (min === 0) return `Same time as you (${day})`;
  const a = Math.abs(min), h = Math.floor(a / 60), m = a % 60;
  const t = `${h}h${m ? ` ${m}m` : ''}`;
  return `${t} ${min > 0 ? 'ahead' : 'behind'} (${day})`;
}

function digitalText(c, p) {
  const pad = (n) => String(n).padStart(2, '0');
  let h = p.hour, suffix = '';
  if (c.hour === '12') { suffix = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; } else h = pad(h);
  return `${h}:${pad(p.minute)}${c.seconds ? ':' + pad(p.second) : ''}${suffix}`;
}

function analogSvg(c) {
  let s = '<svg viewBox="0 0 100 100"><circle class="face" cx="50" cy="50" r="48"/>';
  if (c.face !== 'minimal') {
    for (let i = 0; i < 60; i++) {
      if (c.face === 'numbers' && i % 5) continue;
      const big = i % 5 === 0, a = i * 6 * Math.PI / 180, r1 = big ? 40 : 44;
      s += `<line class="tick" x1="${50 + 46 * Math.sin(a)}" y1="${50 - 46 * Math.cos(a)}" x2="${50 + r1 * Math.sin(a)}" y2="${50 - r1 * Math.cos(a)}"/>`;
    }
  }
  if (c.face === 'numbers') {
    for (let i = 1; i <= 12; i++) {
      const a = i * 30 * Math.PI / 180;
      s += `<text x="${50 + 33 * Math.sin(a)}" y="${50 - 33 * Math.cos(a)}">${i}</text>`;
    }
  }
  s += '<line class="h" x1="50" y1="50" x2="50" y2="28"/><line class="m" x1="50" y1="50" x2="50" y2="17"/>';
  if (c.seconds) s += '<line class="s" x1="50" y1="56" x2="50" y2="12"/>';
  return s + '<circle cx="50" cy="50" r="2.5" fill="#fff"/></svg>';
}

function render() {
  dash.innerHTML = '';
  for (const c of state.clocks) {
    const el = document.createElement('div');
    el.className = 'card' + (c.tz === state.home ? ' home' : '');
    el.draggable = true;
    el.dataset.id = c.id;
    el.innerHTML = `
      <div class="actions"><button data-act="edit" title="Edit">✎</button><button data-act="del" title="Remove">✕</button></div>
      <h3></h3><div class="tz"></div>
      ${c.style !== 'digital' ? analogSvg(c) : ''}
      ${c.style !== 'analog' ? '<div class="digital"></div>' : ''}
      <div class="date"></div><div class="offset"></div><div class="people"></div>`;
    for (const [i, name] of (c.people || []).entries()) {
      const chip = document.createElement('span');
      chip.textContent = name + ' ';
      const x = document.createElement('button');
      x.textContent = '×';
      x.title = 'Remove ' + name;
      x.dataset.act = 'rmperson';
      x.dataset.i = i;
      chip.append(x);
      el.querySelector('.people').append(chip);
    }
    const add = document.createElement('input');
    add.className = 'addperson';
    add.placeholder = '+ add person';
    add.draggable = false;
    el.querySelector('.people').append(add);
    el.querySelector('h3').textContent = c.label || c.tz;
    el.querySelector('.tz').textContent = c.tz;
    dash.append(el);
  }
  tick();
}

function tick() {
  const now = new Date();
  for (const el of dash.children) {
    const c = state.clocks.find((x) => x.id === el.dataset.id);
    const { p, diffMin, dayDiff } = describe(c.tz, now);
    const set = (sel, fn) => { const n = el.querySelector(sel); if (n) fn(n); };
    set('.digital', (n) => (n.textContent = digitalText(c, p)));
    set('.date', (n) => (n.textContent = new Intl.DateTimeFormat('en-US', { timeZone: c.tz, weekday: 'short', month: 'short', day: 'numeric' }).format(now)));
    set('.offset', (n) => (n.textContent = c.tz === state.home && diffMin === 0 ? 'Your timezone' : offsetText(diffMin, dayDiff)));
    set('.h', (n) => n.setAttribute('transform', `rotate(${(p.hour % 12) * 30 + p.minute / 2} 50 50)`));
    set('.m', (n) => n.setAttribute('transform', `rotate(${p.minute * 6 + p.second / 10} 50 50)`));
    set('.s', (n) => n.setAttribute('transform', `rotate(${p.second * 6} 50 50)`));
  }
}

function openDialog(c) {
  editingId = c ? c.id : null;
  $('dlg-title').textContent = c ? 'Edit clock' : 'Add clock';
  $('f-tz').value = c ? c.tz : '';
  $('f-label').value = c ? c.label : '';
  $('f-people').value = c && c.people ? c.people.join(', ') : '';
  $('f-style').value = c ? c.style : 'both';
  $('f-face').value = c ? c.face : 'numbers';
  $('f-hour').value = c ? c.hour : '12';
  $('f-seconds').checked = c ? c.seconds : true;
  dlg.showModal();
}

const geo = new Map();
let geoTimer;

async function searchCities(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=8&language=en&name=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const { results = [] } = await res.json();
  return results.filter((r) => r.timezone).map((r) => ({
    text: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
    city: r.name,
    tz: r.timezone,
  }));
}

$('f-tz').addEventListener('input', () => {
  clearTimeout(geoTimer);
  const q = $('f-tz').value.trim();
  if (q.length < 3 || zones.includes(q) || geo.has(q)) return;
  geoTimer = setTimeout(async () => {
    try {
      for (const r of await searchCities(q)) {
        if (geo.has(r.text)) continue;
        geo.set(r.text, r);
        const o = new Option(r.text);
        o.label = r.tz;
        $('tzlist').prepend(o);
      }
    } catch { /* offline: IANA names still work */ }
  }, 300);
});

async function resolveTz(input) {
  if (zones.includes(input)) return { tz: input };
  if (geo.has(input)) return geo.get(input);
  const key = input.toLowerCase().replace(/\s+/g, '_');
  const local = zones.find((z) => z.toLowerCase().endsWith('/' + key));
  if (local) return { tz: local, city: input };
  const [first] = await searchCities(input).catch(() => []);
  return first || null;
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const found = await resolveTz($('f-tz').value.trim());
  if (!found) { $('f-tz').setCustomValidity('City or timezone not found'); $('f-tz').reportValidity(); return; }
  const tz = found.tz;
  const label = $('f-label').value.trim() || (editingId ? '' : found.city || '');
  const people = $('f-people').value.split(',').map((s) => s.trim()).filter(Boolean);
  const data = { tz, label, people, style: $('f-style').value, face: $('f-face').value, hour: $('f-hour').value, seconds: $('f-seconds').checked };
  if (editingId) Object.assign(state.clocks.find((x) => x.id === editingId), data);
  else state.clocks.push({ id: crypto.randomUUID(), ...data });
  save(); render(); dlg.close();
});
$('f-tz').addEventListener('input', () => $('f-tz').setCustomValidity(''));
$('cancel').onclick = () => dlg.close();
$('add').onclick = () => openDialog();

dash.addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  const id = e.target.closest('.card').dataset.id;
  if (act === 'rmperson') {
    const c = state.clocks.find((x) => x.id === id);
    c.people.splice(+e.target.dataset.i, 1);
    save(); render();
  } else if (act === 'edit') openDialog(state.clocks.find((x) => x.id === id));
  else { state.clocks = state.clocks.filter((x) => x.id !== id); save(); render(); }
});

dash.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || !e.target.classList.contains('addperson')) return;
  const names = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!names.length) return;
  const c = state.clocks.find((x) => x.id === e.target.closest('.card').dataset.id);
  c.people = [...(c.people || []), ...names];
  save(); render();
});

dash.addEventListener('dragstart', (e) => { dragId = e.target.dataset.id; e.target.classList.add('dragging'); });
dash.addEventListener('dragend', (e) => { e.target.classList.remove('dragging'); dash.querySelectorAll('.over').forEach((n) => n.classList.remove('over')); });
dash.addEventListener('dragover', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  e.preventDefault();
  dash.querySelectorAll('.over').forEach((n) => n.classList.remove('over'));
  card.classList.add('over');
});
dash.addEventListener('drop', (e) => {
  const card = e.target.closest('.card');
  if (!card || card.dataset.id === dragId) return;
  e.preventDefault();
  const from = state.clocks.findIndex((x) => x.id === dragId);
  const [moved] = state.clocks.splice(from, 1);
  state.clocks.splice(state.clocks.findIndex((x) => x.id === card.dataset.id), 0, moved);
  save(); render();
});

for (const z of zones) {
  $('tzlist').append(new Option(z));
  $('home').append(new Option(z.replace(/_/g, ' '), z));
}
$('home').value = state.home;
$('home').onchange = () => { state.home = $('home').value; save(); render(); };

render();
setInterval(tick, 1000);

// Overlay mode: floating, draggable, resizable panel with adjustable opacity
const wrap = $('ovwrap'), opSlider = $('ov-op');
state.overlay = Object.assign({ on: false, x: 40, y: 40, w: 420, h: 360, opacity: 0.9 }, state.overlay);
const ov = state.overlay;

function applyOverlay() {
  document.body.classList.toggle('overlay', ov.on);
  if (!ov.on) { wrap.style.cssText = ''; return; }
  ov.x = Math.min(Math.max(0, ov.x), Math.max(0, innerWidth - 80));
  ov.y = Math.min(Math.max(0, ov.y), Math.max(0, innerHeight - 40));
  Object.assign(wrap.style, { left: ov.x + 'px', top: ov.y + 'px', width: ov.w + 'px', height: ov.h + 'px', opacity: ov.opacity });
  opSlider.value = ov.opacity;
}
$('ov-on').onclick = () => { ov.on = true; save(); applyOverlay(); };
$('ov-off').onclick = () => { ov.on = false; save(); applyOverlay(); };
opSlider.oninput = () => { ov.opacity = +opSlider.value; wrap.style.opacity = ov.opacity; save(); };

$('ovgrip').addEventListener('pointerdown', (e) => {
  const sx = e.clientX - ov.x, sy = e.clientY - ov.y, grip = e.currentTarget;
  grip.setPointerCapture(e.pointerId);
  const move = (m) => { ov.x = m.clientX - sx; ov.y = m.clientY - sy; applyOverlay(); };
  const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); save(); };
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
});

new ResizeObserver(() => {
  if (!ov.on) return;
  const w = Math.round(wrap.offsetWidth), h = Math.round(wrap.offsetHeight);
  if (w !== ov.w || h !== ov.h) { ov.w = w; ov.h = h; save(); }
}).observe(wrap);
applyOverlay();
