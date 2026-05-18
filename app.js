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

function boot() {
  // Generate the starfield
  generateStars();

  // Populate day/year dropdowns (only the screens that still need them)
  populateDOB('in-day', 'in-year');
  populateDOB('cm-day', 'cm-year');

  // Handle return from Stripe Checkout
  const params = new URLSearchParams(location.search);
  const paidSeed = params.get('paid') === '1' ? params.get('seed') : null;
  if (paidSeed) {
    try { localStorage.setItem(`kismet:member:${paidSeed}`, '1'); } catch(e){}
    history.replaceState({}, '', location.pathname);
  }
  if (params.get('canceled') === '1') {
    history.replaceState({}, '', location.pathname);
    setTimeout(() => toast("No charge — you closed the window."), 400);
  }

  // Restore session if we have one
  try {
    const raw = localStorage.getItem('kismet:state');
    if (raw) {
      const s = JSON.parse(raw);
      Object.assign(state, s);
      if (state.signature) {
        // If we just returned from Stripe with a paid seed matching this signature, flip member on
        if (paidSeed && String(state.signature.seed) === String(paidSeed)) {
          state.isMember = true;
          persist();
        }
        // If they're a member, drop them in the dashboard. Otherwise re-show reading.
        if (state.isMember) renderDashboard();
        go(state.isMember ? 'dash' : 'reading');
        if (!state.isMember) renderReading();
      }
    }
  } catch(e) {}
}

function persist() {
  try { localStorage.setItem('kismet:state', JSON.stringify(state)); } catch(e){}
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

  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"].indexOf(monthName) + 1;

  state.name = name;
  state.month = month;
  state.day = parseInt(day, 10);
  state.year = parseInt(year, 10);
  state.signature = Kismet.getSignature(name, month, parseInt(day,10), parseInt(year,10));
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
  document.getElementById('dash-sig').textContent = `${sig.glyph} № ${sig.soulNumber}`;

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
  document.getElementById('shadow-week').textContent =
    now.toLocaleDateString('en-US',{month:'long', day:'numeric'});
  document.getElementById('shadow-pat').textContent = sh.pattern;
  document.getElementById('shadow-headline').textContent = sh.headline;
  document.getElementById('shadow-body').innerHTML = `<p>${sh.body}</p>`;
}

/* ----- RENDER: YEAR AHEAD ------------------------------------------ */

function renderYear() {
  const sig = state.signature;
  if (!sig) return;
  const months = Kismet.generateYearAhead(sig);
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
    cell.innerHTML = `<div class="m">${m.label}</div>`;
    grid.appendChild(cell);
  });
  // Readouts
  const out = document.getElementById('year-readouts');
  out.innerHTML = months.map(m => `
    <div class="today" style="margin-bottom: 12px;">
      <div class="label">
        <span>${m.full} ${m.year}</span>
        <span>${'·'.repeat(m.intensity)}${' '.repeat(5-m.intensity)}</span>
      </div>
      <div class="headline" style="font-size:20px;">${capitalize(m.theme)}</div>
      <div class="body" style="font-size:15px;">${m.note}</div>
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
  const sig2 = Kismet.getSignature(name, month, parseInt(day,10), parseInt(year,10));

  // Easter egg: same signature seed = trying to read yourself
  if (sig2.seed === sig1.seed) {
    const out = document.getElementById('compat-out');
    out.classList.remove('hidden');
    out.innerHTML = `
      <div class="compat-card">
        <div style="font-family: var(--mono); font-size: 11px; letter-spacing: .2em; color: var(--ink-dim); text-transform: uppercase; margin-bottom: 8px;">${sig1.name} × ${sig1.name}</div>
        <div class="pct" style="font-size: 56px;">∞<span class="pc" style="font-size: 22px; margin-left: 6px;">/ ∞</span></div>
        <div class="verdict" style="font-style: italic;">A mirror, not a match.</div>
        <div class="reading">You can't measure compatibility with the one keeping score. The cosmos doesn't divide you from yourself — but the fact that you tried is interesting. What were you hoping to find? Run someone you can't predict next.</div>
        <div style="display:flex; justify-content:center; margin-top: 22px; padding-top: 22px; border-top: 1px solid rgba(237,228,211,.1);">
          <div style="text-align:center;">
            <div style="font-family: var(--display); font-style: italic; font-size: 22px; color: var(--gold-2);">${sig1.archetype}</div>
            <div style="font-family: var(--mono); font-size: 10px; letter-spacing: .15em; color: var(--ink-dim); text-transform: uppercase; margin-top: 4px;">facing themselves</div>
          </div>
        </div>
      </div>
    `;
    out.scrollIntoView({behavior:'smooth', block:'center'});
    return;
  }

  const c = Kismet.getCompatibility(sig1, sig2);

  const out = document.getElementById('compat-out');
  out.classList.remove('hidden');
  out.innerHTML = `
    <div class="compat-card">
      <div style="font-family: var(--mono); font-size: 11px; letter-spacing: .2em; color: var(--ink-dim); text-transform: uppercase; margin-bottom: 8px;">${sig1.name} × ${sig2.name}</div>
      <div class="pct">${c.score}<span class="pc">%</span></div>
      <div class="verdict">${c.verdict}</div>
      <div class="reading">${c.reading}</div>
      <div style="display:flex; gap: 16px; justify-content: space-around; margin-top: 22px; padding-top: 22px; border-top: 1px solid rgba(237,228,211,.1);">
        <div>
          <div style="font-family: var(--display); font-style: italic; font-size: 20px; color: var(--gold-2);">${sig1.archetype}</div>
          <div style="font-family: var(--mono); font-size: 10px; letter-spacing: .15em; color: var(--ink-dim); text-transform: uppercase; margin-top: 4px;">${sig1.name}</div>
        </div>
        <div style="font-family: var(--mono); color: var(--gold); align-self: center;">×</div>
        <div>
          <div style="font-family: var(--display); font-style: italic; font-size: 20px; color: var(--gold-2);">${sig2.archetype}</div>
          <div style="font-family: var(--mono); font-size: 10px; letter-spacing: .15em; color: var(--ink-dim); text-transform: uppercase; margin-top: 4px;">${sig2.name}</div>
        </div>
      </div>
    </div>
  `;
  out.scrollIntoView({behavior:'smooth', block:'center'});
}

/* ----- SHARE + SCREENSHOT ------------------------------------------ */

async function renderCardToBlob() {
  if (typeof html2canvas === 'undefined') return null;
  const card = document.getElementById('reading-card');
  if (!card) return null;
  const canvas = await html2canvas(card, {
    backgroundColor: null,
    scale: Math.min(3, (window.devicePixelRatio || 1) * 2),
    useCORS: true,
    logging: false
  });
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

function _fileName() {
  const n = (state.name || 'kismet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `kismet-${n || 'signature'}.png`;
}

async function saveCard() {
  const sig = state.signature;
  if (!sig) return;
  burst(event && event.target);
  toast("Painting the card…");
  try {
    const blob = await renderCardToBlob();
    if (!blob) { toast("Try a screenshot — saver didn't load"); return; }

    const fileName = _fileName();
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'My Kismet Signature' });
        return;
      } catch(e) { /* user canceled — fall through to download */ }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Saved to your downloads");
  } catch (err) {
    toast("Couldn't save — try a screenshot");
  }
}

async function shareCard() {
  const sig = state.signature;
  if (!sig) return;
  burst(event && event.target);
  const url = 'https://kismet.cards';
  const text = `I'm ${sig.archetype} on Kismet — "${sig.tag}". Find yours:`;

  // Try sharing the image directly first (best for TikTok/Insta uploads)
  try {
    const blob = await renderCardToBlob();
    if (blob && navigator.canShare) {
      const file = new File([blob], _fileName(), { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Kismet Signature', text: `${text} ${url}` });
          return;
        } catch(e) { /* canceled or unsupported — fall through */ }
      }
    }
  } catch(e){}

  // Text/URL share fallback
  if (navigator.share) {
    try { await navigator.share({ title: 'My Kismet Signature', text, url }); return; }
    catch(e){}
  }

  try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied — paste anywhere"); }
  catch(e) { toast("Long-press the card to save"); }
}

/* ----- PAYMENT (Stripe Checkout) ----------------------------------- */

async function completePayment() {
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
  burst(event && event.target);
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
    if (!resp.ok) throw new Error('checkout failed');
    const data = await resp.json();
    if (data && data.url) {
      window.location = data.url;
    } else {
      throw new Error('no url returned');
    }
  } catch (err) {
    toast("Couldn't reach checkout — try again");
  }
}

/* ----- SIGN IN ----------------------------------------------------- */

async function signIn() {
  const emailInput = document.getElementById('si-email');
  const email = (emailInput && emailInput.value || '').trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    flash("Enter the email you used to join.");
    if (emailInput) emailInput.focus();
    return;
  }

  toast("Reading the records…");
  try {
    const resp = await fetch('/api/sign-in-by-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!resp.ok) throw new Error('lookup failed');
    const data = await resp.json();

    if (!data.member || !data.identity || !data.identity.name) {
      flash("No account found with that email.");
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

    try {
      if (state.signature) {
        localStorage.setItem(`kismet:member:${state.signature.seed}`, '1');
      }
    } catch(e){}

    persist();
    go('dash');
  } catch (err) {
    flash("Couldn't reach the records — try again in a moment.");
  }
}

function signOut() {
  state = { name:null, month:null, day:null, year:null, email:null, signature:null, isMember:false };
  try { localStorage.removeItem('kismet:state'); } catch(e){}
  go('landing');
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
