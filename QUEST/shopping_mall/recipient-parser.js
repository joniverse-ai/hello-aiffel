const SETS = {
  hayeon:  { name: '하연 · 白然', price: 180000, moq: 5,  mode: 'regular' },
  goyo:    { name: '고요 · 古謠', price: 240000, moq: 5,  mode: 'regular' },
  gaon:    { name: '가온 · 佳穩', price: 210000, moq: 5,  mode: 'regular' },
  sodam:   { name: '소담 · 素淡', price: 220000, moq: 5,  mode: 'regular' },
  onyul:   { name: '온율 · 溫律', price: 260000, moq: 5,  mode: 'regular' },
  jeongyeon:{name: '정연 · 靜然', price: 290000, moq: 5,  mode: 'regular' },
  hanah:   { name: '한아 · 閑雅', price: 150000, moq: 10, mode: 'seasonal' },
  seori:   { name: '서리 · 霜里', price: 180000, moq: 10, mode: 'seasonal' },
  moyeon:  { name: '모연 · 暮然', price: 200000, moq: 10, mode: 'seasonal' },
};

const params = new URLSearchParams(location.search);
const setKey = params.get('set') || 'hayeon';
const currentSet = SETS[setKey] || SETS.hayeon;

let recipients = [];
let flashWarnings = [];

const pasteArea       = document.getElementById('paste-area');
const listEl          = document.getElementById('recipients-list');
const countEl         = document.getElementById('count');
const totalEl         = document.getElementById('total');
const warningsEl      = document.getElementById('parser-warnings');
const moqInfoEl       = document.getElementById('moq-info');
const setNameEl       = document.getElementById('summary-set-name');
const setPriceEl      = document.getElementById('summary-set-price');
const setMoqLabelEl   = document.getElementById('summary-moq-label');
const payBtn          = document.getElementById('pay-btn');

function init() {
  if (setNameEl)  setNameEl.textContent  = currentSet.name;
  if (setPriceEl) setPriceEl.textContent = currentSet.price.toLocaleString('ko-KR') + '원';
  if (setMoqLabelEl) setMoqLabelEl.textContent = currentSet.moq + ' 세트';
  render();
}

pasteArea.addEventListener('paste', () => {
  setTimeout(() => {
    const { parsed, warns } = parseText(pasteArea.value);
    if (parsed.length > 0 || warns.length > 0) {
      recipients = recipients.concat(parsed);
      flashWarnings = warns;
      pasteArea.value = '';
      render();
    }
  }, 0);
});

function parseText(text) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  const parsed = [];
  const warns  = [];
  lines.forEach((line, i) => {
    const rowNum = i + 1;
    let parts;
    if (line.includes('\t')) {
      parts = line.split('\t');
    } else if (line.includes('"')) {
      parts = parseCsvLine(line);
    } else {
      parts = line.split(/,/);
    }
    const name    = (parts[0] || '').trim();
    const address = (parts[1] || '').trim();
    const message = (parts[2] || '').trim();
    if (!name) {
      warns.push({ level: 'error', text: `행 ${rowNum}: 이름이 비어 있어 건너뛰었습니다.` });
      return;
    }
    parsed.push({ name, address, message });
  });
  return { parsed, warns };
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function detectDuplicateIndices() {
  const seen = new Map();
  const dupSet = new Set();
  recipients.forEach((r, i) => {
    if (!r.name) return;
    const key = r.name.replace(/\s+/g, '');
    if (seen.has(key)) {
      dupSet.add(i);
      dupSet.add(seen.get(key));
    } else {
      seen.set(key, i);
    }
  });
  return dupSet;
}

function addRecipient() {
  recipients.push({ name: '', address: '', message: '' });
  render();
}

function removeRecipient(idx) {
  recipients.splice(idx, 1);
  render();
}

function updateField(idx, field, value) {
  recipients[idx][field] = value;
  const card = listEl.children[idx];
  if (!card) return;
  if (field === 'address') card.classList.toggle('is-warn', !value.trim());
  if (field === 'name') {
    const dups = detectDuplicateIndices();
    listEl.querySelectorAll('.recipient-card').forEach((c, i) => c.classList.toggle('is-duplicate', dups.has(i)));
  }
  updateSummary();
}

function updateSummary() {
  countEl.textContent = recipients.length;
  totalEl.textContent = (recipients.length * currentSet.price).toLocaleString('ko-KR');
  if (!moqInfoEl) return;

  const remaining = currentSet.moq - recipients.length;
  if (remaining > 0) {
    moqInfoEl.innerHTML = `최소 <strong>${currentSet.moq}세트</strong>부터 · <strong>${remaining}세트</strong> 부족`;
    moqInfoEl.classList.add('moq-below');
    if (payBtn) payBtn.disabled = true;
  } else {
    moqInfoEl.textContent = `최소 주문 수량 (${currentSet.moq}세트) 충족`;
    moqInfoEl.classList.remove('moq-below');
    if (payBtn) payBtn.disabled = false;
  }
}

function renderWarnings() {
  if (!warningsEl) return;
  const items = [...flashWarnings];
  const dups  = detectDuplicateIndices();
  if (dups.size > 0) {
    const names = [...dups].map(i => recipients[i].name).filter(Boolean);
    const unique = [...new Set(names)];
    items.push({ level: 'warn', text: `동일 이름 감지: ${unique.join(', ')}` });
  }
  if (items.length === 0) {
    warningsEl.innerHTML = '';
    warningsEl.hidden = true;
    return;
  }
  warningsEl.hidden = false;
  warningsEl.innerHTML = items.map(w =>
    `<div class="warning-item warning-${w.level}">${escapeHtml(w.text)}</div>`
  ).join('');
}

function render() {
  const dups = detectDuplicateIndices();
  listEl.innerHTML = recipients.map((r, i) => {
    const classes = ['recipient-card'];
    if (!r.address) classes.push('is-warn');
    if (dups.has(i)) classes.push('is-duplicate');
    return `
      <div class="${classes.join(' ')}">
        <div class="recipient-num">${String(i + 1).padStart(2, '0')}</div>
        <input type="text" placeholder="이름" value="${escapeHtml(r.name)}" oninput="updateField(${i}, 'name', this.value)">
        <input type="text" placeholder="주소" value="${escapeHtml(r.address)}" oninput="updateField(${i}, 'address', this.value)">
        <input type="text" placeholder="메시지 (선택)" value="${escapeHtml(r.message)}" oninput="updateField(${i}, 'message', this.value)">
        <button type="button" class="remove" onclick="removeRecipient(${i})">삭제</button>
      </div>`;
  }).join('');
  renderWarnings();
  updateSummary();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

init();
