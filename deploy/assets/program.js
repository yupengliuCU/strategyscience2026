/* Strategy Science 2026 – program page logic */

const ROOMS = [
  { code: 'A', id: 'ECCS 201', label: 'ECCS 201', cap: '', note: 'Engineering Center · main hall' },
  { code: 'B', id: 'KOBL 352', label: 'KOBL 352', cap: '',  note: 'Koelbel Building' },
  { code: 'C', id: 'KOBL 323', label: 'KOBL 323', cap: '',  note: 'Koelbel Building' },
  { code: 'D', id: 'KOBL 317', label: 'KOBL 317', cap: '',  note: 'Koelbel Building' },
];

// Finalists for the Conference Best Paper Award (winner announced Sat 1:20 PM).
// Empty this array after the ceremony to clear all finalist markers.
const FINALISTS = ['P012', 'P022', 'P069', 'P090', 'P153'];
// Winners take priority over finalists in the visual treatment (🏆 instead of ★).
const WINNERS = ['P022'];

const SESSION_META = [
  { n: 1, day: 'Friday',   time: '9:30 – 11:00 AM' },
  { n: 2, day: 'Friday',   time: '2:00 – 3:30 PM' },
  { n: 3, day: 'Friday',   time: '4:00 – 5:30 PM' },
  { n: 4, day: 'Saturday', time: '9:00 – 10:30 AM' },
  { n: 5, day: 'Saturday', time: '11:00 – 12:30 PM' },
];

let DATA = null;
let viewMode = 'matrix';
let activeFilters = new Set();
let searchQuery = '';

async function load() {
  const r = await fetch('data/program.json');
  DATA = await r.json();
  renderMatrix();
  renderFilters();
  renderList();
  bindControls();
}

function escHTML(s) { return String(s||'').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function plural(n, s) { return n===1 ? `${n} ${s}` : `${n} ${s}s`; }

/* –– MATRIX –– */
function renderMatrix() {
  const m = document.getElementById('matrix');
  if (!m) return;
  let html = '';
  // Header row
  html += `<div class="m-cell m-head" style="background: var(--paper-2);">
    <div class="room" style="color: var(--ink-3);">Session</div>
    <div class="building" style="font-size:14px;">Time · Day</div>
  </div>`;
  ROOMS.forEach(r => {
    html += `<div class="m-cell m-head">
      <div class="room">Room ${r.code}</div>
      <div class="building">${r.label}</div>
    </div>`;
  });

  // 5 session rows
  for (let p = 1; p <= 5; p++) {
    const meta = SESSION_META[p-1];
    html += `<div class="m-cell m-rowhead" id="s${p}">
      <div class="day">Day ${meta.day === 'Saturday' ? '2' : '1'} · ${meta.day}</div>
      <div class="sn">Session ${p}</div>
      <div class="ti">${meta.time}</div>
    </div>`;
    for (let t = 1; t <= 4; t++) {
      const sess = DATA.sessions.find(s => s.period === p && s.track === t);
      if (sess) {
        html += `<a class="m-cell session-card" href="session.html?id=${sess.id}">
          <div class="id">S${p}${'ABCD'[t-1]} · ${ROOMS[t-1].label}</div>
          <div class="ti">${escHTML(sess.theme)}</div>
          <div class="desc">${escHTML(sess.description.slice(0, 130))}${sess.description.length>130?'…':''}</div>
          <div class="ct"><span>${sess.paperCount} papers</span><span>→</span></div>
        </a>`;
      } else {
        html += `<div class="m-cell" style="opacity:.4;"></div>`;
      }
    }
  }
  m.innerHTML = html;
}

/* –– FILTERS / TAGS –– */
const TAG_GROUPS = {
  'AI': ['AI', 'artificial intelligence', 'generative AI', 'LLM', 'algorithm'],
  'Innovation': ['innovation', 'patent', 'R&D', 'experiment'],
  'Entrepreneurship': ['entrepreneur', 'venture', 'startup', 'founder'],
  'Platforms': ['platform', 'ecosystem', 'multihoming'],
  'Org & HR': ['hiring', 'compensation', 'human capital', 'organizational', 'workplace', 'mobility'],
  'Strategy theory': ['RBV', 'resource', 'strategic decision', 'foresight', 'cognition', 'behavioral'],
  'Governance': ['governance', 'ownership', 'board', 'regulation', 'political'],
  'Geography': ['geography', 'cluster', 'agglomeration', 'multinational', 'global'],
  'Nonmarket': ['social impact', 'public good', 'social venture', 'nonmarket'],
};
function sessionTags(s) {
  const text = (s.theme + ' ' + s.description).toLowerCase();
  const tags = [];
  for (const [tag, keys] of Object.entries(TAG_GROUPS)) {
    if (keys.some(k => text.includes(k.toLowerCase()))) tags.push(tag);
  }
  return tags;
}
function renderFilters() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
  // Count sessions per tag
  const counts = {};
  DATA.sessions.forEach(s => {
    sessionTags(s).forEach(t => counts[t] = (counts[t]||0)+1);
  });
  bar.innerHTML = '<span class="chip" data-filter="ALL" aria-pressed="true">All themes <span class="n">'+DATA.sessions.length+'</span></span>' +
    Object.keys(TAG_GROUPS).filter(t => counts[t]).map(t =>
      `<span class="chip" data-filter="${t}" aria-pressed="false">${t} <span class="n">${counts[t]||0}</span></span>`
    ).join('');
  bar.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => {
    const f = c.dataset.filter;
    if (f === 'ALL') {
      activeFilters.clear();
      bar.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', x.dataset.filter==='ALL'?'true':'false'));
    } else {
      bar.querySelector('[data-filter="ALL"]').setAttribute('aria-pressed','false');
      if (activeFilters.has(f)) { activeFilters.delete(f); c.setAttribute('aria-pressed','false'); }
      else { activeFilters.add(f); c.setAttribute('aria-pressed','true'); }
      if (activeFilters.size===0) bar.querySelector('[data-filter="ALL"]').setAttribute('aria-pressed','true');
    }
    renderList();
  }));
}

/* –– LIST + PAPER SEARCH –– */
function matchSession(s) {
  const tags = sessionTags(s);
  const tagOk = activeFilters.size === 0 || [...activeFilters].some(f => tags.includes(f));
  if (!tagOk) return false;
  if (!searchQuery) return true;
  const q = searchQuery.toLowerCase();
  if ((s.theme+' '+s.description+' '+s.id).toLowerCase().includes(q)) return true;
  // Search papers
  const papers = DATA.papers[s.id] || [];
  return papers.some(p =>
    (p.title+' '+p.authors+' '+p.institution+' '+p.keywords).toLowerCase().includes(q)
  );
}

function renderList() {
  const list = document.getElementById('sessionList');
  const papers = document.getElementById('paperResults');
  const empty = document.getElementById('empty');
  if (!list) return;

  const matched = DATA.sessions.filter(matchSession);

  // Sort by period, track
  matched.sort((a,b)=> a.period - b.period || a.track - b.track);

  list.innerHTML = matched.map(s => {
    const meta = SESSION_META[s.period-1];
    const room = ROOMS[s.track-1];
    return `<a class="session-row" href="session.html?id=${s.id}">
      <div class="id">S${s.period}${'ABCD'[s.track-1]}<span class="day">${meta.day.slice(0,3)}</span></div>
      <div class="ti">${escHTML(s.theme)}<span class="desc">${escHTML(s.description)}</span></div>
      <div class="rm"><span class="b">${room.label}</span>${meta.time}</div>
      <div class="ct">${plural(s.paperCount, 'paper')} →</div>
    </a>`;
  }).join('');

  // Paper-level results when there is a search query
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    const hits = [];
    Object.entries(DATA.papers).forEach(([sid, ps]) => {
      const sess = DATA.sessions.find(x => x.id === sid);
      if (!sess) return;
      ps.forEach(p => {
        const blob = (p.title+' '+p.authors+' '+p.institution+' '+p.keywords).toLowerCase();
        if (blob.includes(q)) hits.push({sess, p});
      });
    });
    if (hits.length) {
      papers.innerHTML = `<h3 style="font-family: var(--serif); font-weight: 600; margin: 30px 0 12px; font-size: 22px;">Paper matches <span style="font-family: var(--mono); font-size: 12px; color: var(--ink-3); letter-spacing: .1em;">${hits.length}</span></h3>` +
        hits.slice(0, 50).map(({sess, p}) => {
          const meta = SESSION_META[sess.period-1];
          const isWinner = WINNERS.includes(p.id);
          const isFinalist = FINALISTS.includes(p.id);
          let star = '';
          let note = '';
          if (isWinner) {
            star = '<span style="margin-right:6px;">🏆</span>';
            note = '<div style="font-size:12px;color:var(--gold-deep);font-weight:600;margin-top:6px;letter-spacing:0.02em;">Award Winner · Strategy Science Conference Best Paper Award</div>';
          } else if (isFinalist) {
            star = '<span style="color:#B22222;font-weight:600;margin-right:6px;">★</span>';
            note = '<div style="font-size:11.5px;color:#B22222;font-style:italic;margin-top:6px;letter-spacing:0.01em;">Finalist of Strategy Science Conference Best Paper Award</div>';
          }
          return `<a class="paper-row" href="session.html?id=${sess.id}#${p.id}">
            <div>
              <div class="ti">${star}${escHTML(p.title)}</div>
              <div class="au">${escHTML(p.authors)} · <span style="color:var(--ink-3);">${escHTML(p.institution)}</span></div>
              <div class="ms" style="margin-top:6px;">${escHTML(sess.theme)}</div>
              ${note}
            </div>
            <div class="sloc"><span class="b">${ROOMS[sess.track-1].label}</span>S${sess.period}${'ABCD'[sess.track-1]} · ${meta.day.slice(0,3)} ${meta.time}</div>
          </a>`;
        }).join('') +
        (hits.length > 50 ? `<div style="padding: 18px 0; font-family: var(--mono); font-size: 12px; color: var(--ink-3); letter-spacing: .1em;">…and ${hits.length-50} more. Refine your search.</div>` : '');
      papers.classList.add('active');
    } else {
      papers.classList.remove('active');
      papers.innerHTML = '';
    }
  } else {
    papers.classList.remove('active');
    papers.innerHTML = '';
  }

  empty.style.display = (matched.length === 0 && !papers.innerHTML) ? 'block' : 'none';
}

/* –– Controls –– */
function bindControls() {
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.seg button').forEach(x => x.setAttribute('aria-pressed','false'));
    b.setAttribute('aria-pressed','true');
    viewMode = b.dataset.view;
    document.getElementById('matrixWrap').classList.toggle('hidden', viewMode !== 'matrix');
    document.getElementById('listView').classList.toggle('active', viewMode === 'list');
  }));
  const input = document.getElementById('searchInput');
  let to;
  input.addEventListener('input', () => {
    clearTimeout(to);
    to = setTimeout(()=>{
      searchQuery = input.value.trim();
      // If user starts searching, switch to list view
      if (searchQuery && viewMode === 'matrix') {
        document.querySelector('[data-view="list"]').click();
      }
      renderList();
    }, 120);
  });
}

document.addEventListener('DOMContentLoaded', load);
