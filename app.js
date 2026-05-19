/* ========================================================================
   KISMET APP CONTROLLER
   ======================================================================== */

let state = {
  name: null, month: null, day: null, year: null,
  email: null,
  signature: null,
  isMember: false
};

const SCENES = ['landing','form','divining','reading','paywall','dash','shadow','compat','year','signin'];

/* ----- BOOT --------------------------------------------------------- */

async function boot() {
  // Generate the starfield
  generateStars();

  // Populate day/year dropdowns (only the screens that still need them)
  populateDOB('in-day', 'in-year');
  populateDOB('cm-day', 'cm-year');

  const params = new URLSearchParams(location.search);
  const sessionId = params.get('paid') === '1' ? params.get('session_id') : null;
  const canceled = params.get('canceled') === '1';

  // Strip auth-affecting params from the URL immediately so refresh/share doesn't re-trigger
  if (sessionId || canceled) {
    history.replaceState({}, '', location.pathname);
  }
  if (canceled) {
    setTimeout(() => toast("No charge — you closed the window."), 400);
  }

  // If we just returned from Stripe Checkout: verify with the server before granting access
  if (sessionId) {
    try {
      const resp = await fetch('/api/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.member && data.identity && data.identity.name) {
          const id = data.identity;
          state.name = id.name;
          state.month = id.month;
          state.day = id.day;
          state.year = id.year;
          state.email = id.email;
          state.signature = Kismet.getSignature(id.name, id.month, id.day, id.year);
          state.isMember = true;
          persist();
          go('dash');
          setTimeout(() => toast("You're in. Welcome."), 200);
          return;
        }
      }
      // Verification didn't pan out for some reason — show a fallback path so the customer
      // who just paid isn't left confused at the landing page.
      go('signin');
      setTimeout(() => toast("Payment received — sign in with your email to finish."), 600);
      return;
    } catch(e) {
      go('signin');
      setTimeout(() => toast("Payment received — sign in with your email to finish."), 600);
      return;
    }
  }

  // Restore session from localStorage
  try {
    const raw = localStorage.getItem('kismet:state');
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(state, s);
      if (state.signature) {
        if (state.isMember) renderDashboard();
        go(state.isMember ? 'dash' : 'reading');
        if (!state.isMember) renderReading();

        // Re-verify cached membership in the background — don't trust localStorage alone
        if (state.isMember && state.signature && state.signature.seed) {
          revalidateMembership(state.signature.seed).catch(()=>{});
        }
      }
    }
  } catch(e) {}
}

async function revalidateMembership(seed) {
  try {
    const resp = await fetch('/api/check-membership', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seed })
    });
    if (!resp.ok) return;
    const data = await resp.json();
    if (!data.member && state.isMember) {
      // Stripe says they're no longer a member — downgrade gracefully
      state.isMember = false;
      try { localStorage.removeItem(`kismet:member:${seed}`); } catch(e){}
      persist();
      toast("Your subscription is no longer active.");
      setTimeout(() => signOut(), 1800);
    }
  } catch(e) {}
}

function persist() {
  try { localStorage.setItem('kismet:state', JSON.stringify(state)); } catch(e){}
}

// Track how many consecutive days a member has opened the dashboard. Builds the daily-return habit.
function bumpStreak() {
  if (!state.signature || !state.signature.seed) return { streak: 0 };
  const key = `kismet:streak:${state.signature.seed}`;
  const today = new Date();
  const yyyymmdd = (d) => `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
  const todayStr = yyyymmdd(today);

  let s;
  try { s = JSON.parse(localStorage.getItem(key) || 'null'); } catch(e) { s = null; }
  if (!s) s = { lastDate: null, streak: 0 };

  if (s.lastDate === todayStr) {
    return s; // already counted today
  }

  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (s.lastDate === yyyymmdd(yesterday)) {
    s.streak = (s.streak || 0) + 1;
  } else {
    s.streak = 1;
  }
  s.lastDate = todayStr;
  try { localStorage.setItem(key, JSON.stringify(s)); } catch(e){}
  return s;
}

// HTML-escape user-controlled text before interpolating into innerHTML.
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Disable a button while an async action runs; show a "Working…" label.
async function withButtonLock(btn, fn) {
  if (!btn || btn.dataset.locked === '1') return;
  const original = btn.innerHTML;
  btn.dataset.locked = '1';
  btn.disabled = true;
  btn.style.opacity = '0.65';
  btn.style.cursor = 'wait';
  try {
    return await fn();
  } finally {
    btn.dataset.locked = '';
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.innerHTML = original;
  }
}

function generateStars() {
  const container = document.querySelector('.stars');
  if (!container) return;
  container.innerHTML = '';
  // Adjust count for screen size
  const w = window.innerWidth;
  const h = window.innerHeight;
  const area = w * h;
  const baseCount = Math.round(area / 9000); // ~80 on a typical laptop, ~50 on a phone
  const count = Math.max(40, Math.min(140, baseCount));

  for (let i = 0; i < count; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    // 12% gold, 8% rose, rest white
    const r = Math.random();
    if (r < 0.12) s.classList.add('gold');
    else if (r < 0.20) s.classList.add('rose');
    if (Math.random() < 0.15) s.classList.add('drift');

    // Size: most small, occasional bigger ones
    const size = Math.random() < 0.18
      ? 2.5 + Math.random() * 1.5   // bright larger stars
      : 1 + Math.random() * 1.2;    // most stars small
    s.style.width = size + 'px';
    s.style.height = size + 'px';
    s.style.left = (Math.random() * 100) + 'vw';
    s.style.top = (Math.random() * 100) + 'vh';
    s.style.setProperty('--dur', (2.5 + Math.random() * 5) + 's');
    s.style.setProperty('--delay', (Math.random() * 5) + 's');
    container.appendChild(s);
  }
}

// Regenerate stars on resize (debounced)
let _starResizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(_starResizeTimer);
  _starResizeTimer = setTimeout(generateStars, 300);
});

function populateDOB(dayId, yearId) {
  const dayEl = document.getElementById(dayId);
  const yearEl = document.getElementById(yearId);
  if (dayEl && dayEl.children.length <= 1) {
    for (let d = 1; d <= 31; d++) {
      const o = document.createElement('option'); o.textContent = d; dayEl.appendChild(o);
    }
  }
  if (yearEl && yearEl.children.length <= 1) {
    const now = new Date().getFullYear();
    for (let y = now; y >= 1925; y--) {
      const o = document.createElement('option'); o.textContent = y; yearEl.appendChild(o);
    }
  }
}

/* ----- NAVIGATION --------------------------------------------------- */

function go(scene) {
  // Member guards: paywall and sign-in scenes don't make sense if already signed in.
  if (state.isMember && state.signature) {
    if (scene === 'paywall') { scene = 'dash'; }
    if (scene === 'signin')  { scene = 'dash'; }
  }

  SCENES.forEach(s => {
    const el = document.getElementById('scene-' + s);
    if (el) el.classList.toggle('active', s === scene);
  });
  window.scrollTo({top:0, behavior: 'auto'});

  // Trigger per-scene render
  if (scene === 'dash') renderDashboard();
  if (scene === 'shadow') renderShadow();
  if (scene === 'year') renderYear();
  if (scene === 'reading' && state.signature) renderReading();
  if (scene === 'compat') {
    document.getElementById('compat-out').classList.add('hidden');
  }
  if (scene === 'signin') resetSignInToStep1();
}

/* ----- FORM SUBMISSION ---------------------------------------------- */

function submitForm() {
  const name = document.getElementById('in-name').value.trim();
  const monthName = document.getElementById('in-month').value;
  const day = document.getElementById('in-day').value;
  const year = document.getElementById('in-year').value;

  if (!name || !monthName || !day || !year) {
    flash("Tell us all three. The math needs every part.");
    return;
  }
  if (name.length < 2) {
    flash("Use a name with at least two letters.");
    return;
  }

  // Signed-in members can't overwrite their identity here — that would replace their dashboard.
  // Route them to compatibility (where reading other people belongs).
  if (state.isMember && state.signature) {
    flash("You're already signed in. Read other people from Compatibility →");
    setTimeout(() => go('compat'), 900);
    return;
  }

  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(monthName) + 1;
  const dayNum = parseInt(day, 10);
  const yearNum = parseInt(year, 10);

  // Date validity: rule out things like Feb 30, Apr 31, etc. JavaScript will silently roll
  // these over (Feb 30 → Mar 2), so we construct the date and verify it still has the
  // month/day we expect.
  const probe = new Date(yearNum, month - 1, dayNum);
  if (probe.getFullYear() !== yearNum || probe.getMonth() !== month - 1 || probe.getDate() !== dayNum) {
    flash(`${monthName} ${dayNum} isn't a real date. Try again.`);
    return;
  }

  // 18+ age gate. Matches the declaration in Terms and Privacy.
  // This is a soft self-declared check — a determined minor could lie — but it's the
  // standard pattern (Snapchat, TikTok, etc.) and is what regulators expect.
  const now = new Date();
  let age = now.getFullYear() - yearNum;
  const passedBirthdayThisYear =
    (now.getMonth() + 1) > month ||
    ((now.getMonth() + 1) === month && now.getDate() >= dayNum);
  if (!passedBirthdayThisYear) age -= 1;
  if (age < 18) {
    flash("Kismet is for 18 and up. Come back another time.");
    return;
  }

  state.name = name;
  state.month = month;
  state.day = dayNum;
  state.year = yearNum;
  state.signature = Kismet.getSignature(name, month, dayNum, yearNum);
  persist();

  go('divining');
  runDivining(() => {
    renderReading();
    go('reading');
  });
}

/* ----- DIVINING ANIMATION ------------------------------------------- */

function runDivining(onDone) {
  const steps = [
    "Mapping name to numeric form",
    "Locating natal coordinates",
    "Cross-referencing element & polarity",
    "Aligning glyph",
    "Drawing the card"
  ];
  const h = document.getElementById('div-h');
  const s = document.getElementById('div-step');
  h.textContent = "Reading your Signature…";
  let i = 0;
  s.textContent = steps[0];
  const interval = setInterval(() => {
    i++;
    if (i >= steps.length) {
      clearInterval(interval);
      setTimeout(onDone, 500);
    } else {
      s.textContent = steps[i];
    }
  }, 600);
}

/* ----- RENDER: SIGNATURE READING ----------------------------------- */

function renderReading() {
  const sig = state.signature;
  if (!sig) return;

  document.getElementById('card-name').textContent = sig.name;
  document.getElementById('card-arch').textContent = sig.archetype;
  document.getElementById('card-tag').textContent = sig.tag;
  document.getElementById('card-glyph').textContent = `${sig.glyph} NR.${sig.sigNum}`;
  document.getElementById('card-num').textContent = `№ ${sig.soulNumber}`;
  document.getElementById('card-elem').textContent = `${sig.element} · ${sig.polarity}`;
  document.getElementById('card-pol').textContent = sig.glyph;

  document.getElementById('card-body').innerHTML = Kismet.generateSignatureReading(sig);

  document.getElementById('card-date').textContent =
    new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });

  // Locked preview — pulls from shadow reading
  const shadow = Kismet.generateShadowReading(sig);
  document.getElementById('lock-title').textContent = shadow.headline;
  document.getElementById('lock-blur').innerHTML = shadow.body;
}

/* ----- RENDER: DASHBOARD ------------------------------------------- */

function renderDashboard() {
  const sig = state.signature;
  if (!sig) { go('form'); return; }

  document.getElementById('dash-name').textContent = sig.name;

  const today = new Date();
  document.getElementById('dash-date').textContent =
    today.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  // Daily card brand elements
  const cornerEl = document.getElementById('dash-sig-corner');
  if (cornerEl) cornerEl.textContent = `${sig.glyph} NR.${sig.sigNum}`;
  const archEl = document.getElementById('dash-archetype');
  if (archEl) archEl.textContent = sig.archetype;

  const streak = bumpStreak();
  const streakLabel = streak.streak > 1 ? ` · Day ${streak.streak}` : '';
  document.getElementById('dash-sig').textContent = `№ ${sig.soulNumber} · ${sig.element}${streakLabel}`;

  const daily = Kismet.generateDailyReading(sig, today);
  document.getElementById('dash-headline').textContent = daily.headline;
  document.getElementById('dash-body').innerHTML = `<p>${daily.body}</p>`;
}

/* ----- RENDER: SHADOW READING -------------------------------------- */

function renderShadow() {
  const sig = state.signature;
  if (!sig) return;
  const sh = Kismet.generateShadowReading(sig);
  const now = new Date();
  const weekStr = now.toLocaleDateString('en-US',{month:'long', day:'numeric'});
  document.getElementById('shadow-week').textContent = weekStr;

  const cornerEl = document.getElementById('shadow-corner-l');
  if (cornerEl) cornerEl.textContent = `${sig.glyph} NR.${sig.sigNum}`;
  const dateEl = document.getElementById('shadow-date');
  if (dateEl) dateEl.textContent = `Week of ${weekStr}`;
  document.getElementById('shadow-pat').textContent = sh.pattern;
  document.getElementById('shadow-headline').textContent = sh.headline;
  document.getElementById('shadow-body').innerHTML = `<p>${sh.body}</p>`;
  const footEl = document.getElementById('shadow-foot');
  if (footEl) footEl.textContent = `${sig.archetype} · № ${sig.soulNumber}`;
}

/* ----- RENDER: YEAR AHEAD ------------------------------------------ */

function renderYear() {
  const sig = state.signature;
  if (!sig) return;
  const months = Kismet.generateYearAhead(sig);

  // Card brand elements
  const cornerEl = document.getElementById('year-corner-l');
  if (cornerEl) cornerEl.textContent = `${sig.glyph} NR.${sig.sigNum}`;
  const dateEl = document.getElementById('year-date');
  if (dateEl) {
    const startY = months[0].year;
    const endY = months[11].year;
    dateEl.textContent = startY === endY ? `12 months · ${startY}` : `12 months · ${startY}–${endY}`;
  }
  const archEl = document.getElementById('year-archetype');
  if (archEl) archEl.textContent = sig.archetype;
  const footEl = document.getElementById('year-foot');
  if (footEl) footEl.textContent = `№ ${sig.soulNumber} · ${sig.element}`;

  const grid = document.getElementById('year-grid');
  grid.innerHTML = '';
  months.forEach(m => {
    const cell = document.createElement('div');
    cell.className = 'year-cell';
    // Color from intensity
    const opacity = .25 + (m.intensity * 0.13);
    let color;
    if (m.bucket === 'high') color = `rgba(240,198,116,${opacity + 0.2})`;
    else if (m.bucket === 'low') color = `rgba(74,30,92,${opacity})`;
    else color = `rgba(196,107,138,${opacity})`;
    cell.style.background = color;
    if (m.bucket === 'high') cell.style.boxShadow = '0 0 20px rgba(240,198,116,.4)';
    cell.innerHTML = `<div class="m">${esc(m.label)}</div>`;
    grid.appendChild(cell);
  });

  // Card summary: highlight the peak month
  const peak = months.find(m => m.bucket === 'high') || months[0];
  const summary = document.getElementById('year-summary');
  if (summary) {
    summary.innerHTML = `<em>${esc(peak.full)}</em> is the loud one — ${esc(peak.theme)}.`;
  }

  // Detailed readouts (outside the share card)
  const out = document.getElementById('year-readouts');
  out.innerHTML = months.map(m => `
    <div class="month-readout">
      <div class="label">
        <span>${esc(m.full)} ${esc(m.year)}</span>
        <span>${'·'.repeat(m.intensity)}${' '.repeat(5-m.intensity)}</span>
      </div>
      <div class="headline">${esc(capitalize(m.theme))}</div>
      <div class="body">${esc(m.note)}</div>
    </div>
  `).join('');
}

function capitalize(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

/* ----- COMPATIBILITY ----------------------------------------------- */

function runCompat() {
  const sig1 = state.signature;
  if (!sig1) { go('form'); return; }
  const name = document.getElementById('cm-name').value.trim();
  const monthName = document.getElementById('cm-month').value;
  const day = document.getElementById('cm-day').value;
  const year = document.getElementById('cm-year').value;
  if (!name || !monthName || !day || !year) {
    flash("Need their full info to run the math."); return;
  }
  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(monthName)+1;
  const dayNum = parseInt(day,10);
  const yearNum = parseInt(year,10);
  const probe = new Date(yearNum, month-1, dayNum);
  if (probe.getFullYear() !== yearNum || probe.getMonth() !== month-1 || probe.getDate() !== dayNum) {
    flash(`${monthName} ${dayNum} isn't a real date.`);
    return;
  }
  const sig2 = Kismet.getSignature(name, month, dayNum, yearNum);

  const out = document.getElementById('compat-out');
  out.classList.remove('hidden');

  // Easter egg: same signature seed = trying to read yourself
  if (sig2.seed === sig1.seed) {
    out.innerHTML = `
      <div class="compat-card" id="compat-card">
        <div class="t-corner-l">${esc(sig1.glyph)} NR.${esc(sig1.sigNum)}</div>
        <div class="t-corner-r">Compat</div>
        <div class="c-pair">${esc(sig1.name)} × ${esc(sig1.name)}</div>
        <div class="pct" style="font-size: 80px;">∞<span class="pc" style="font-size: 26px; margin-left: 6px;">/ ∞</span></div>
        <div class="verdict">A mirror, not a match.</div>
        <div class="reading">You can't measure compatibility with the one keeping score. The cosmos doesn't divide you from yourself — but the fact that you tried is interesting. What were you hoping to find? Run someone you can't predict next.</div>
        <div class="c-pair-archetypes" style="justify-content:center;">
          <div>
            <div class="arch-name">${esc(sig1.archetype)}</div>
            <div class="arch-sub">facing themselves</div>
          </div>
        </div>
        <div class="c-footer">
          <span>${esc(sig1.element)} · № ${esc(sig1.soulNumber)}</span>
          <span class="t-stamp">kismet.cards</span>
        </div>
      </div>
      <div class="daily-actions">
        <button onclick="shareCompatCard()">⤴ Share</button>
        <button onclick="saveCompatCard()">⤓ Save image</button>
      </div>
    `;
    _lastCompat = { sig1, sig2, score: '∞', verdict: 'A mirror, not a match.' };
    out.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const c = Kismet.getCompatibility(sig1, sig2);

  out.innerHTML = `
    <div class="compat-card" id="compat-card">
      <div class="t-corner-l">${esc(sig1.glyph)} NR.${esc(sig1.sigNum)}</div>
      <div class="t-corner-r">Compat</div>
      <div class="c-pair">${esc(sig1.name)} × ${esc(sig2.name)}</div>
      <div class="pct">${esc(c.score)}<span class="pc">%</span></div>
      <div class="verdict">${esc(c.verdict)}</div>
      <div class="reading">${esc(c.reading)}</div>
      <div class="c-pair-archetypes">
        <div>
          <div class="arch-name">${esc(sig1.archetype)}</div>
          <div class="arch-sub">${esc(sig1.name)}</div>
        </div>
        <div class="x-mark">×</div>
        <div>
          <div class="arch-name">${esc(sig2.archetype)}</div>
          <div class="arch-sub">${esc(sig2.name)}</div>
        </div>
      </div>
      <div class="c-footer">
        <span>${esc(sig1.element)} ↔ ${esc(sig2.element)}</span>
        <span class="t-stamp">kismet.cards</span>
      </div>
    </div>
    <div class="daily-actions">
      <button onclick="shareCompatCard()">⤴ Share</button>
      <button onclick="saveCompatCard()">⤓ Save image</button>
    </div>
  `;
  _lastCompat = { sig1, sig2, score: c.score, verdict: c.verdict };
  out.scrollIntoView({behavior:'smooth', block:'center'});
}

/* ----- SHARE + SCREENSHOT ------------------------------------------ */

async function renderCardToBlob(elId = 'reading-card') {
  if (typeof html2canvas === 'undefined') {
    console.error('html2canvas not loaded');
    return null;
  }
  const card = document.getElementById(elId);
  if (!card) { console.error('card element not found:', elId); return null; }

  // Wait for all fonts to be ready so the captured PNG isn't a fallback-font render.
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch(e){}
  }

  try {
    const canvas = await html2canvas(card, {
      // Solid background so the shared PNG is opaque & rich (transparent PNGs look bad on most apps)
      backgroundColor: '#140918',
      scale: Math.min(3, (window.devicePixelRatio || 1) * 2),
      useCORS: true,
      logging: false,
      imageTimeout: 8000,
      // html2canvas has poor support for ::before with SVG data-URIs + mix-blend-mode.
      // Strip those decorations on the cloned DOM only — the live card keeps them.
      onclone: (doc) => {
        const style = doc.createElement('style');
        style.textContent = `
          .reading-card::before,
          .today::before,
          .compat-card::before { display: none !important; }
        `;
        doc.head.appendChild(style);
      }
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
  } catch (err) {
    console.error('html2canvas render failed', err);
    return null;
  }
}

function _fileName(suffix = 'signature') {
  const n = (state.name || 'kismet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `kismet-${n || 'card'}-${suffix}.png`;
}

function _showImagePreview(blobUrl, fileName) {
  const existing = document.getElementById('kismet-image-preview');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'kismet-image-preview';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(10,6,18,.96);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';

  const hint = document.createElement('div');
  hint.textContent = 'Long-press the image — then "Save to Photos"';
  hint.style.cssText =
    'font-family:JetBrains Mono,Courier New,monospace;font-size:11px;letter-spacing:.25em;' +
    'color:#f0c674;text-transform:uppercase;margin-bottom:18px;text-align:center;';

  const img = document.createElement('img');
  img.src = blobUrl;
  img.alt = 'Your Kismet card';
  img.style.cssText =
    'max-width:100%;max-height:65vh;border-radius:14px;' +
    'box-shadow:0 20px 60px rgba(0,0,0,.6);';

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:10px;margin-top:22px;';

  const dl = document.createElement('a');
  dl.href = blobUrl; dl.download = fileName; dl.textContent = 'Download';
  dl.style.cssText =
    'padding:11px 22px;border:1px solid rgba(237,228,211,.25);border-radius:999px;' +
    'background:transparent;color:#ede4d3;font-family:JetBrains Mono,monospace;font-size:11px;' +
    'letter-spacing:.2em;text-transform:uppercase;text-decoration:none;cursor:pointer;';

  const done = document.createElement('button');
  done.textContent = 'Done';
  done.style.cssText =
    'padding:11px 22px;border:1px solid rgba(237,228,211,.25);border-radius:999px;' +
    'background:transparent;color:#ede4d3;font-family:JetBrains Mono,monospace;font-size:11px;' +
    'letter-spacing:.2em;text-transform:uppercase;cursor:pointer;';
  done.onclick = () => {
    overlay.remove();
    try { URL.revokeObjectURL(blobUrl); } catch(e){}
  };

  actions.appendChild(dl);
  actions.appendChild(done);
  overlay.appendChild(hint);
  overlay.appendChild(img);
  overlay.appendChild(actions);
  document.body.appendChild(overlay);
}

async function _saveCardEl(elId, suffix, title) {
  const sig = state.signature;
  if (!sig) return;
  toast("Painting the card…");

  let blob;
  try {
    blob = await renderCardToBlob(elId);
  } catch (err) {
    console.error('renderCardToBlob threw', err);
    blob = null;
  }
  if (!blob) {
    toast("Image render failed — try a screenshot");
    return;
  }

  const fileName = _fileName(suffix);

  // Build File for the share API. If File constructor isn't available, share API isn't either.
  let file = null;
  try {
    file = new File([blob], fileName, { type: 'image/png' });
  } catch (e) {
    console.warn('File constructor unavailable', e);
  }

  // Try Web Share API with files (Android Chrome, modern iOS where gesture survived).
  if (file && navigator.share) {
    let canShareFiles = false;
    try { canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [file] })); } catch(e) {
      console.warn('canShare threw', e); canShareFiles = false;
    }
    if (canShareFiles) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (e) {
        if (e && e.name === 'AbortError') return;
        console.warn('share() rejected, falling back', e && e.name, e && e.message);
      }
    }
  }

  // Universal fallback: inline preview the user can long-press to save (mobile) or download from.
  let blobUrl = null;
  try {
    blobUrl = URL.createObjectURL(blob);
  } catch (e) {
    console.error('createObjectURL failed', e);
    toast("Couldn't save — try a screenshot");
    return;
  }
  _showImagePreview(blobUrl, fileName);
}

async function _shareCardEl(elId, suffix, title, text) {
  const sig = state.signature;
  if (!sig) return;
  const url = 'https://kismet.cards';
  try {
    const blob = await renderCardToBlob(elId);
    if (blob && navigator.canShare) {
      const file = new File([blob], _fileName(suffix), { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title, text: `${text} ${url}` }); return; }
        catch(e) { /* canceled or unsupported — fall through */ }
      }
    }
  } catch(e){}
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return; }
    catch(e){}
  }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied — paste anywhere"); }
  catch(e) { toast("Long-press the card to save"); }
}

async function saveCard() {
  burst(event && event.target);
  return _saveCardEl('reading-card', 'signature', 'My Kismet Signature');
}

async function shareCard() {
  const sig = state.signature; if (!sig) return;
  burst(event && event.target);
  return _shareCardEl('reading-card', 'signature', 'My Kismet Signature',
    `I'm ${sig.archetype} on Kismet — "${sig.tag}". Find yours:`);
}

async function saveDailyCard() {
  burst(event && event.target);
  return _saveCardEl('today-card', 'daily', 'My Kismet Daily Reading');
}

async function shareDailyCard() {
  const sig = state.signature; if (!sig) return;
  burst(event && event.target);
  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  return _shareCardEl('today-card', 'daily', 'My Kismet Daily Reading',
    `My Kismet reading for ${today} — find yours:`);
}

async function saveShadowCard() {
  burst(event && event.target);
  return _saveCardEl('shadow-card', 'shadow', 'My Kismet Shadow Reading');
}

async function shareShadowCard() {
  const sig = state.signature; if (!sig) return;
  burst(event && event.target);
  return _shareCardEl('shadow-card', 'shadow', 'My Kismet Shadow Reading',
    `Kismet read my shadow this week. Brutal. Find yours:`);
}

async function saveYearCard() {
  burst(event && event.target);
  return _saveCardEl('year-card', 'year', 'My Kismet Year Ahead');
}

async function shareYearCard() {
  const sig = state.signature; if (!sig) return;
  burst(event && event.target);
  return _shareCardEl('year-card', 'year', 'My Kismet Year Ahead',
    `My next 12 months, mapped. Find yours:`);
}

async function saveCompatCard() {
  burst(event && event.target);
  return _saveCardEl('compat-card', 'compat', 'My Kismet Compatibility');
}

async function shareCompatCard() {
  if (!_lastCompat) return;
  burst(event && event.target);
  const { sig2, score, verdict } = _lastCompat;
  const safeName = String(sig2.name || 'They').replace(/[<>]/g, '');
  const text = score === '∞'
    ? `Kismet refused to score me against myself. "A mirror, not a match." Find yours:`
    : `${safeName} and I are ${score}% on Kismet. The math saw it before we did. Run yours:`;
  return _shareCardEl('compat-card', 'compat', 'My Kismet Compatibility', text);
}

/* ----- PAYMENT (Stripe Checkout) ----------------------------------- */

async function completePayment() {
  const btn = event && event.target && event.target.closest('button');
  if (!state.signature) { flash("Get your Signature first."); return; }
  const emailInput = document.getElementById('pay-email');
  const email = (emailInput && emailInput.value || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    flash("Add the email you want to use to sign in.");
    if (emailInput) { emailInput.focus(); emailInput.style.borderColor = 'rgba(229,121,153,.8)'; }
    return;
  }
  state.email = email;
  persist();
  burst(btn);

  await withButtonLock(btn, async () => {
    if (btn) btn.textContent = 'Opening checkout…';
    try {
      const resp = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureSeed: state.signature.seed,
          name: state.signature.name,
          month: state.month,
          day: state.day,
          year: state.year,
          email
        })
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.status === 409 && data.alreadyMember) {
        flash("This email already has a membership — sign in.");
        setTimeout(() => go('signin'), 900);
        return;
      }
      if (!resp.ok) throw new Error('checkout failed');
      if (data && data.url) {
        window.location = data.url;
      } else {
        throw new Error('no url returned');
      }
    } catch (err) {
      toast("Couldn't reach checkout — try again");
    }
  });
}

/* ----- SIGN IN ----------------------------------------------------- */

let _signInChallenge = null;
let _lastCompat = null;

function resetSignInToStep1() {
  _signInChallenge = null;
  const s1 = document.getElementById('signin-step1');
  const s2 = document.getElementById('signin-step2');
  if (s1) s1.classList.remove('hidden');
  if (s2) s2.classList.add('hidden');
  const code = document.getElementById('si-code');
  if (code) code.value = '';
  setTimeout(() => {
    const e = document.getElementById('si-email');
    if (e) e.focus();
  }, 50);
}

async function requestSignInCode() {
  const btn = event && event.target && event.target.closest('button');
  const emailInput = document.getElementById('si-email');
  const email = (emailInput && emailInput.value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    flash("Enter a valid email.");
    if (emailInput) emailInput.focus();
    return;
  }

  await withButtonLock(btn, async () => {
    if (btn) btn.textContent = 'Sending…';
    try {
      const resp = await fetch('/api/auth-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (resp.status === 429) {
        flash(data.error || "Too many attempts. Try again shortly.");
        return;
      }
      if (!resp.ok || !data.challengeToken) {
        flash(data.error || "Couldn't send the code — try again.");
        return;
      }
      _signInChallenge = { token: data.challengeToken, email: data.email || email };

      const s1 = document.getElementById('signin-step1');
      const s2 = document.getElementById('signin-step2');
      const echo = document.getElementById('si-email-echo');
      if (echo) echo.textContent = data.email || email;
      if (s1) s1.classList.add('hidden');
      if (s2) s2.classList.remove('hidden');
      setTimeout(() => {
        const c = document.getElementById('si-code');
        if (c) c.focus();
      }, 50);
      toast("Code sent · check your inbox");
    } catch (err) {
      flash("Couldn't send the code — try again.");
    }
  });
}

async function verifySignInCode() {
  const btn = event && event.target && event.target.closest('button');
  if (!_signInChallenge) { resetSignInToStep1(); return; }
  const codeInput = document.getElementById('si-code');
  // Strip anything that isn't a digit so pasted "123-456" / "123 456" / "123,456" just works.
  const code = (codeInput && codeInput.value || '').replace(/\D/g, '');
  if (codeInput && codeInput.value !== code) codeInput.value = code;
  if (!/^\d{6}$/.test(code)) {
    flash("Enter the 6 digits from your email.");
    if (codeInput) codeInput.focus();
    return;
  }

  await withButtonLock(btn, async () => {
    if (btn) btn.textContent = 'Verifying…';
    try {
      const resp = await fetch('/api/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken: _signInChallenge.token, code })
      });
      const data = await resp.json();
      if (!resp.ok) {
        flash(data.error || "Couldn't verify code.");
        return;
      }
      if (!data.member || !data.identity || !data.identity.name) {
        flash("No active membership found for that email.");
        return;
      }

      const id = data.identity;
      state.name = id.name;
      state.month = id.month;
      state.day = id.day;
      state.year = id.year;
      state.email = id.email;
      state.signature = Kismet.getSignature(id.name, id.month, id.day, id.year);
      state.isMember = true;
      _signInChallenge = null;

      try {
        if (state.signature) localStorage.setItem(`kismet:member:${state.signature.seed}`, '1');
      } catch(e){}

      persist();
      go('dash');
    } catch (err) {
      flash("Couldn't verify — try again.");
    }
  });
}

function signOut() {
  state = { name:null, month:null, day:null, year:null, email:null, signature:null, isMember:false };
  try {
    localStorage.removeItem('kismet:state');
    // Sweep all orphan per-seed membership flags so re-using the device with a different signature
    // doesn't get fooled by stale data.
    const toDrop = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('kismet:member:')) toDrop.push(k);
    }
    toDrop.forEach(k => localStorage.removeItem(k));
  } catch(e){}
  go('landing');
}

async function openBillingPortal() {
  const btn = event && event.target && event.target.closest('button');
  if (!state.email) { flash("Sign in first."); return; }
  await withButtonLock(btn, async () => {
    if (btn) btn.textContent = 'Opening…';
    try {
      const resp = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.email })
      });
      const data = await resp.json();
      if (!resp.ok || !data.url) { flash(data.error || "Couldn't open billing."); return; }
      window.location = data.url;
    } catch(err) {
      flash("Couldn't open billing — try again.");
    }
  });
}

/* ----- UI HELPERS -------------------------------------------------- */

function toast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2400);
}

function flash(msg) { toast(msg); }

function burst(origin) {
  if (!origin || !origin.getBoundingClientRect) return;
  const rect = origin.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  for (let i = 0; i < 12; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = cx + 'px';
    s.style.top = cy + 'px';
    const angle = (i / 12) * Math.PI * 2;
    const dist = 50 + Math.random() * 60;
    s.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
    s.style.setProperty('--dy', Math.sin(angle) * dist + 'px');
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
}

document.addEventListener('DOMContentLoaded', boot);
