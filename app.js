(() => {
'use strict';

const C = window.CONFIG;
const $ = (id) => document.getElementById(id);

const TH_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const toThai = (s) => String(s).replace(/\d/g, (d) => TH_DIGITS[d]);
const toArabic = (s) => s.replace(/[๐-๙]/g, (d) => TH_DIGITS.indexOf(d));
const digitsOnly = (s) => toArabic(s).replace(/\D/g, '');

// ตัวอย่างที่แสดงเป็นสีเทาในหนังสือ ตอนที่ยังไม่ได้กรอก
const PLACEHOLDER = { first: 'ชื่อ', last: 'นามสกุล', no: '๐๐', id: '๐ ๐๐๐๐ ๐๐๐๐๐ ๐๐ ๐', sid: '๐'.repeat(C.sidLength), day: '๐๐', month: 'เดือน', year: '๐๐๐๐' };

// มี uploadUrl = ชื่อและเลข นศท. มาจากบัญชีรายชื่อของครู นักเรียนกรอกเองไม่ได้
const ROSTER = !!C.uploadUrl;

const el = {
  first: $('first'), last: $('last'), no: $('no'), id: $('id'), sid: $('sid'),
  day: $('day'), month: $('month'), year: $('year'),
  paper: $('paper'), status: $('status'), btnPdf: $('btnPdf'), btnPrint: $('btnPrint'),
};

/* ---------- ตัวเลือกวันเกิด ---------- */
function fillSelect(sel, label, items) {
  sel.append(new Option(label, ''));
  items.forEach(([v, t]) => sel.append(new Option(t, v)));
}
fillSelect(el.day, 'วัน', Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]));
fillSelect(el.month, 'เดือน', MONTHS.map((m, i) => [i + 1, m]));
fillSelect(el.year, 'พ.ศ.', Array.from({ length: C.birthYearMax - C.birthYearMin + 1 }, (_, i) => {
  const y = C.birthYearMax - i; return [y, y];
}));

/* ---------- ค่าคงที่ในหนังสือ (ใช้ทั้งหน้าเว็บและไฟล์ Word) ---------- */
const FIXED = {
  school: `โรงเรียน ${C.school}  จังหวัด ${C.province}`,
  date: `ให้ไว้  ณ  วันที่ ${toThai(C.issue.day)} เดือน ${MONTHS[C.issue.month - 1]} พ.ศ. ${toThai(C.issue.year)}`,
  signer: C.signer,
  signerTitle: C.signerTitle,
  phoneLabel: C.phoneLabel,
  phone: toThai(C.phone),
};
$('schoolLine').textContent = `โรงเรียน${C.school}`;
$('pSchool').textContent = FIXED.school;
$('pTitle').textContent = FIXED.signerTitle;
$('pSigner').textContent = `( ${FIXED.signer} )`;
$('pPhone').textContent = `${FIXED.phoneLabel} : ${FIXED.phone}`;
$('pDate').textContent = FIXED.date;

$('sidLabel').textContent = `เลขประจำตัวนักศึกษาวิชาทหาร (${C.sidLength} หลัก)`;
el.sid.maxLength = C.sidLength;

// โหมดบัญชีรายชื่อ (มี uploadUrl): กดเลือกชื่อแล้วข้อมูลขึ้นเอง ถ้าโหลดรายชื่อไม่ได้ จะเปิดให้กรอกเองแทน (manual)
let manual = false;
const fromRoster = () => ROSTER && !manual;

function applyMode() {
  const locked = fromRoster();
  document.body.classList.toggle('roster', locked);
  document.querySelector('.field.pick').hidden = !ROSTER;
  document.querySelector('.field.pick').classList.toggle('off', manual);
  [el.first, el.last, el.sid, el.id].forEach((i) => { i.readOnly = locked; });
  el.sid.placeholder = locked ? 'ขึ้นเองเมื่อกดเลือกชื่อ' : '0'.repeat(C.sidLength);
  el.id.placeholder = locked ? 'ขึ้นเองเมื่อกดเลือกชื่อ' : '0 0000 00000 00 0';
  $('idHint').textContent = locked
    ? 'ขึ้นเองจากบัญชีรายชื่อ ตรวจให้ตรงกับบัตร ถ้าไม่ตรงให้แจ้งครูผู้กำกับ'
    : 'พิมพ์ติดกันได้เลย ระบบจะเว้นวรรคให้ตามแบบหนังสือ';
  $('privacy').textContent = locked
    ? 'ชื่อ เลขประจำตัวประชาชน และเลข นศท. ดึงมาจากบัญชีรายชื่อของครู เมื่อกดดาวน์โหลดหรือพิมพ์ จะส่งสำเนาหนังสือรับรองไปเก็บใน Google Drive ของครูผู้กำกับ ข้อมูลไม่ถูกบันทึกไว้ในเครื่องนี้เมื่อปิดหน้าเว็บ'
    : 'ข้อมูลถูกประมวลผลในเครื่องของคุณเท่านั้น ไม่ถูกส่งไปที่ใด และไม่ถูกบันทึกไว้เมื่อปิดหน้าเว็บ';
}
applyMode();

/* ---------- อ่านค่าจากฟอร์ม ---------- */
const cleanName = (s) => s.replace(/[^ก-๎ a-zA-Z.\-]/g, '').replace(/\s+/g, ' ').trim();

function read() {
  const id = digitsOnly(el.id.value).slice(0, 13);
  return {
    first: cleanName(el.first.value),
    last: cleanName(el.last.value),
    no: digitsOnly(el.no.value).replace(/^0+(?=\d)/, ''),
    id,
    sid: digitsOnly(el.sid.value),
    day: el.day.value, month: el.month.value, year: el.year.value,
  };
}
const groupId = (d) => [1, 4, 5, 2, 1].reduce((o, n) => {
  const part = d.slice(o.i, o.i + n); if (part) o.out.push(part); o.i += n; return o;
}, { i: 0, out: [] }).out.join(' ');

function idChecksumOk(id) {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(id[i]) * (13 - i);
  return (11 - (sum % 11)) % 10 === Number(id[12]);
}

/* ---------- ตรวจข้อมูล ---------- */
let lookup = { key: '', state: 'idle' };
let people = null;  // [{ k, first, last, name }] จากบัญชีรายชื่อ
let picked = null;  // คนที่นักเรียนกดเลือก

function validate(v) {
  const err = {}, warn = {};
  if (fromRoster()) {
    if (!picked) err.pick = people ? 'กรุณากดค้นหาชื่อ แล้วกดเลือกชื่อของคุณ' : 'ยังโหลดรายชื่อไม่สำเร็จ กรุณากดลองใหม่ หรือแจ้งครูผู้กำกับ';
    else if (lookup.state === 'checking') err.pick = 'กำลังดึงข้อมูลของคุณ รอสักครู่ (ประมาณ 2-5 วินาที)…';
    else if (lookup.state !== 'found') err.pick = 'ดึงข้อมูลจากบัญชีรายชื่อไม่สำเร็จ กรุณากดเลือกชื่ออีกครั้ง หรือแจ้งครูผู้กำกับ';
  } else {
    if (v.id.length !== 13) err.id = `เลขประจำตัวประชาชนต้องมี 13 หลัก (ตอนนี้ ${v.id.length} หลัก)`;
    else if (!idChecksumOk(v.id)) warn.id = 'เลขนี้ไม่ผ่านการตรวจสอบหลักสุดท้าย กรุณาเช็กกับบัตรอีกครั้ง';
    if (!v.first) err.first = 'กรุณากรอกชื่อ';
    if (!v.last) err.last = 'กรุณากรอกนามสกุล';
    if (v.sid.length !== C.sidLength) err.sid = `เลขประจำตัว นศท. ต้องมี ${C.sidLength} หลัก (ตอนนี้ ${v.sid.length} หลัก)`;
  }

  if (!v.no) err.no = 'กรุณากรอกลำดับในบัญชีรายชื่อ';
  else if (+v.no < 1) err.no = 'ลำดับต้องเริ่มจาก 1';

  if (!v.day || !v.month || !v.year) err.birth = 'กรุณาเลือกวัน เดือน และปีเกิดให้ครบ';
  else {
    const dim = new Date(+v.year - 543, +v.month, 0).getDate();
    if (+v.day > dim) err.birth = `เดือน${MONTHS[v.month - 1]} ปี ${v.year} ไม่มีวันที่ ${v.day}`;
  }
  return { err, warn };
}

const touched = new Set();
function showErrors(showAll) {
  const { err, warn } = validate(read());
  document.querySelectorAll('.field[data-f]').forEach((f) => {
    const k = f.dataset.f;
    const on = showAll || touched.has(k);
    const m = on ? (err[k] || warn[k] || '') : '';
    const loading = k === 'pick' && !!picked && lookup.state === 'checking'; // กำลังรอสคริปต์ ไม่ใช่ข้อผิดพลาด
    f.classList.toggle('loading', loading);
    f.classList.toggle('err', on && !!err[k] && !loading);
    f.classList.toggle('warn', on && !err[k] && !!warn[k]);
    f.querySelector('.msg').textContent = m;
  });
  return err;
}

/* ---------- เนื้อความหนังสือ ---------- */
// ข้อความตายตัว: ช่องว่างคงไว้ตามต้นฉบับทุกตัว, "|" = จุดที่ตัดบรรทัดได้
// ช่องที่นักเรียนกรอก = [คีย์, ค่า, ตัวอย่างสีเทา]
// คืน 5 บรรทัด ตามแบบฟอร์มต้นฉบับ: ทุกคนขึ้นบรรทัดที่คำเดียวกัน (ลำดับใน / นักศึกษา / ชั้นปีที่ ๓ / ปีที่ ๖ / จริง)
// flowing = ชื่อยาวจนบรรทัดใดบรรทัดหนึ่งล้น ให้ไหลต่อกันแทน (จึงต้องมีช่องว่างท้ายบรรทัดครบตามต้นฉบับ)
function bodySegments(v, flowing) {
  const t = toThai;
  return [[
    '      หนังสือ|รับรอง|ฉบับ|นี้|ให้|ไว้|เพื่อ|แสดง|ว่า นัก|ศึกษา|วิชา|ทหาร ',
    ['first', v.first, PLACEHOLDER.first],
    '  ',
    ['last', v.last, PLACEHOLDER.last],
    ' ลำดับ|ใน',
  ], [
    'บัญชี|รายชื่อ  ',
    ['no', v.no && t(v.no), PLACEHOLDER.no],
    '  หมายเลข|ประจำ|ตัว|ประชาชน ',
    ['id', v.id && t(groupId(v.id)), PLACEHOLDER.id],
    ' หมายเลข|ประจำ|ตัว|นัก|ศึกษา',
  ], [
    'วิชา|ทหาร ',
    ['sid', v.sid && t(v.sid), PLACEHOLDER.sid],
    ' เกิด|วัน|ที่ ',
    ['day', v.day && t(v.day), PLACEHOLDER.day],
    ' เดือน ',
    ['month', v.month && MONTHS[v.month - 1], PLACEHOLDER.month],
    ' พ.ศ.',
    ['year', v.year && t(v.year), PLACEHOLDER.year],
    `  เป็น|นัก|ศึกษา|วิชา|ทหาร ชั้น|ปี|ที่ ${t(C.trainingYear)}${flowing ? '      ' : ''}`,
  ], [
    `ของ|สถาน|ศึกษา|วิชา|ทหาร  โรงเรียน|${C.school} ` +
    `ปัจจุบัน|กำลัง|ศึกษา|อยู่|ใน|ระดับ|ชั้น|มัธยม|ศึกษา|ปี|ที่  ${t(C.gradeLevel)}${flowing ? '   ' : ''}`,
  ], [
    `ประจำ ปี|การ|ศึกษา ${t(C.academicYear)} จริง`,
  ]];
}

function field(text, key, ph) {
  const s = document.createElement('span');
  s.textContent = text || ph;
  s.className = text ? 'u hl' : 'u hl ph';
  s.dataset.k = key;
  return s;
}

function words(str) {
  const f = document.createDocumentFragment();
  str.split(/( +)/).forEach((tok) => {
    if (!tok) return;
    if (tok[0] === ' ') {
      const sp = document.createElement('span');
      sp.className = 'sp';
      sp.textContent = tok;
      f.append(sp);
      return;
    }
    tok.split('|').forEach((w, i) => {
      if (i) f.append(document.createElement('wbr'));
      const s = document.createElement('span');
      s.className = 'u';
      s.textContent = w;
      f.append(s);
    });
  });
  return f;
}

function buildBody(flowing) {
  const body = $('pBody');
  body.classList.toggle('flowing', flowing);
  const lines = bodySegments(read(), flowing).map((segs, i, all) => {
    const line = document.createElement('span');
    line.className = i === all.length - 1 ? 'ln last' : 'ln';
    line.append(...segs.map((seg, j) => {
      if (typeof seg !== 'string') return field(seg[1], seg[0], seg[2]);
      // ช่องว่าง 6 ตัวต้นย่อหน้าอยู่ใน text-indent แล้ว (ไม่ให้ถูกยืดตอนจัดชิดขอบ) ส่วนไฟล์ Word ยังใช้ช่องว่างจริง
      return words(i === 0 && j === 0 ? seg.trimStart() : seg);
    }));
    if (i < all.length - 1) line.append(document.createElement('wbr')); // ตอนไหลต่อกัน ตัดบรรทัดตรงรอยต่อได้
    return line;
  });
  body.replaceChildren(...lines);
}

function render() {
  const body = $('pBody');
  buildBody(false);
  // ปกติ 5 บรรทัดตามฟอร์ม ถ้าชื่อยาวจนบรรทัดใดล้น (ต้องขึ้นบรรทัดเพิ่ม) ให้ไหลต่อกันแทนการบังคับ
  const lh = parseFloat(getComputedStyle(body).lineHeight);
  if ([...body.querySelectorAll('.ln')].some((l) => l.offsetHeight > lh * 1.5)) buildBody(true);
  distribute();
}

/* ---------- กระจายตัวอักษรให้เต็มบรรทัด ---------- */
// text-justify: inter-character ของเบราว์เซอร์ยังเว้นช่องว่างกว้างตรงเว้นวรรค จึงวัดแต่ละบรรทัดเอง
// แล้วเพิ่ม letter-spacing ให้ทุกตัวอักษรเท่า ๆ กัน จนพอดีขอบขวา (ผลเหมือนกันทุกเบราว์เซอร์)
const NEEDS_DISTRIBUTE = true;
const graphemes = window.Intl && Intl.Segmenter ? new Intl.Segmenter('th', { granularity: 'grapheme' }) : null;
// Chrome เพิ่ม letter-spacing ต่อ 1 กลุ่มอักษร แต่สระอำ (ำ) นับเป็น 2 ตำแหน่ง
const countGraphemes = (s) => (graphemes ? [...graphemes.segment(s)].length : s.length) + (s.match(/ำ/g) || []).length;

function distribute() {
  const body = $('pBody');
  const all = [...body.querySelectorAll('.u, .sp')];
  all.forEach((e) => { e.style.letterSpacing = ''; });
  if (!NEEDS_DISTRIBUTE) return;

  // วัดตอนยังไม่จัดชิดขอบ ไม่เช่นนั้นเบราว์เซอร์ขยายช่องว่างจนเต็มบรรทัดไปก่อนแล้ว จะวัดช่องว่างที่เหลือไม่ได้
  body.classList.add('measuring');
  try { spreadLines(body, all); } finally { body.classList.remove('measuring'); }
}

function spreadLines(body, all) {
  const scale = body.getBoundingClientRect().width / body.offsetWidth || 1; // พรีวิวถูกย่อด้วย transform
  const flowing = body.classList.contains('flowing');
  const linesOf = (block) => {
    const lines = [];
    let cur = null;
    block.querySelectorAll('.u, .sp').forEach((e) => {
      const r = e.getClientRects()[0];
      if (!r) return;
      if (!cur || Math.abs(r.top - cur.top) > 3 * scale) { cur = { top: r.top, els: [] }; lines.push(cur); }
      cur.els.push({ e, r });
    });
    return lines;
  };
  const before = all.length ? linesOf(body).length : 0;

  [...(flowing ? [body] : body.querySelectorAll('.ln'))].forEach((block) => {
    const right = block.getBoundingClientRect().right;
    const lines = linesOf(block);
    lines.forEach((ln, i) => {
      if (i === lines.length - 1 && (flowing || block.classList.contains('last'))) return; // บรรทัดสุดท้ายของย่อหน้าไม่ต้องเต็ม
      while (ln.els.length && ln.els[ln.els.length - 1].e.classList.contains('sp')) ln.els.pop(); // ช่องว่างท้ายบรรทัดไม่นับ
      if (ln.els.length < 2) return;
      const slack = (right - ln.els[ln.els.length - 1].r.right) / scale - 0.6;
      const n = ln.els.reduce((sum, { e }) => sum + countGraphemes(e.textContent), 0);
      if (slack <= 0 || n < 2) return;
      const ls = Math.min(slack / (n - 1), 3); // ส่วนที่เกินจากนี้ ให้ text-align: justify เติมที่ช่องว่างต่อ
      ln.els.forEach(({ e }) => { e.style.letterSpacing = `${ls.toFixed(3)}px`; });
    });
  });
  // กันพลาด: ถ้าการเพิ่มระยะทำให้ตัดบรรทัดเปลี่ยน ให้ยกเลิก กลับไปใช้การจัดชิดขอบแบบเดิม
  if (all.length && linesOf(body).length !== before) all.forEach((e) => { e.style.letterSpacing = ''; });
}

/* ---------- ช่องกรอก ---------- */
el.id.addEventListener('input', () => {
  const d = digitsOnly(el.id.value).slice(0, 13);
  const g = groupId(d);
  if (el.id.value !== g) el.id.value = g;
});
[el.no, el.sid].forEach((i) => i.addEventListener('input', () => {
  const d = digitsOnly(i.value).slice(0, i === el.no ? 3 : C.sidLength);
  if (i.value !== d) i.value = d;
}));
['first', 'last'].forEach((k) => el[k].addEventListener('input', () => {
  const c = el[k].value.replace(/[^ก-๎ a-zA-Z.\-]/g, '').replace(/ {2,}/g, ' ');
  if (el[k].value !== c) el[k].value = c;
}));

const keyOf = (node) => ({ day: 'birth', month: 'birth', year: 'birth' }[node.id] || node.id);
Object.values(el).forEach((n) => {
  if (!(n instanceof HTMLInputElement || n instanceof HTMLSelectElement)) return;
  n.addEventListener('input', () => { render(); showErrors(false); });
  n.addEventListener('change', () => { touched.add(keyOf(n)); render(); showErrors(false); });
  n.addEventListener('blur', () => { touched.add(keyOf(n)); showErrors(false); });
});

$('btnReset').addEventListener('click', () => {
  $('form').reset(); touched.clear(); picked = null; lookup = { key: '', state: 'idle' };
  pickFilter.value = ''; showChosen();
  if (ROSTER) { renderList(); loadPeople(true); }
  setStatus(''); render(); showErrors(false);
});

function setStatus(msg, bad) { el.status.textContent = msg; el.status.classList.toggle('bad', !!bad); }
function setBusy(on) { el.btnPdf.disabled = on; el.btnPrint.disabled = on; }

function checkBeforeExport() {
  const err = showErrors(true);
  const first = Object.keys(err)[0];
  if (!first) return true;
  setStatus('ยังกรอกข้อมูลไม่ครบ กรุณาแก้ช่องที่ขึ้นสีแดง', true);
  const target = document.querySelector(`.field[data-f="${first}"] input, .field[data-f="${first}"] select`);
  target?.focus();
  return false;
}

/* ---------- สร้าง PDF ---------- */
function toBase64(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

let fontCssPromise;
function fontEmbedCss() {
  fontCssPromise ||= Promise.all([
    ['fonts/THSarabunPSK.ttf', 400], ['fonts/THSarabunPSK-Bold.ttf', 700],
  ].map(async ([url, weight]) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    return `@font-face{font-family:"TH SarabunPSK";font-weight:${weight};src:url(data:font/ttf;base64,${toBase64(buf)}) format("truetype");}`;
  })).then((r) => r.join('\n'));
  return fontCssPromise;
}

// PDF A4 ที่แต่ละหน้ามีรูปหนังสือเต็มหน้า (ไม่ต้องพึ่งไลบรารี) images = [{ jpeg, w, h }]
function makePdfPages(images, title) {
  const W = 595.28, H = 841.89, enc = new TextEncoder();
  const parts = [], offsets = [];
  let len = 0;
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; add(`${n} 0 obj\n${body}\nendobj\n`); };
  const hex = [...title].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  const info = 3 + images.length * 3; // วัตถุที่ 1-2 = catalog/pages, แต่ละหน้าใช้ 3 วัตถุ (page, image, content)

  add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] /Count ${images.length} >>`);
  images.forEach(({ jpeg, w, h }, i) => {
    const page = 3 + i * 3, img = page + 1, cont = page + 2;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${cont} 0 R >>`);
    offsets[img] = len;
    add(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    add(jpeg); add('\nendstream\nendobj\n');
    obj(cont, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  });
  obj(info, `<< /Title <FEFF${hex}> /Producer (nsd-certificate) >>`);

  const xref = len, count = info + 1;
  add(`xref\n0 ${count}\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
}
const makePdf = (jpeg, w, h, title) => makePdfPages([{ jpeg, w, h }], title);

// ดึงรูป JPEG ออกจาก PDF ที่เว็บนี้สร้าง (โครงสร้างตายตัว) เพื่อเอาไปรวมเป็นไฟล์เดียว
function extractJpeg(bytes) {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 4096));
  const m = /\/Width (\d+) \/Height (\d+)[^>]*\/Filter \/DCTDecode \/Length (\d+) >>\s*stream\r?\n/.exec(head);
  if (!m) throw new Error('unsupported pdf');
  const start = m.index + m[0].length;
  return { w: +m[1], h: +m[2], jpeg: bytes.subarray(start, start + Number(m[3])) };
}

const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

async function buildPdf(v) {
  await document.fonts.ready;
  const opts = { pixelRatio: 3, backgroundColor: '#fff', fontEmbedCSS: await fontEmbedCss(), cacheBust: false };
  el.paper.classList.remove('show-hl');
  try {
    if (isSafari) await htmlToImage.toCanvas(el.paper, opts); // Safari มักวาดรอบแรกว่าง
    const canvas = await htmlToImage.toCanvas(el.paper, opts);
    const jpg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95));
    return makePdf(new Uint8Array(await jpg.arrayBuffer()), canvas.width, canvas.height, `หนังสือรับรอง นศท. ${v.first} ${v.last}`);
  } finally {
    el.paper.classList.add('show-hl');
  }
}

function saveToDevice(pdf, v) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' }));
  a.download = `หนังสือรับรอง นศท. ${v.first} ${v.last}.pdf`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

/* ---------- สร้าง Word จากแบบ assets/template.docx ---------- */
const escapeXml = (s) => String(s).replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function makeDocx(v) {
  const res = await fetch('assets/template.docx');
  if (!res.ok) throw new Error(`template ${res.status}`);
  const zip = await JSZip.loadAsync(await res.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  const flowing = $('pBody').classList.contains('flowing');
  const values = { ...FIXED };
  bodySegments(v, flowing).forEach((segs, i) => {
    values[`l${i + 1}`] = segs.map((seg) => (typeof seg === 'string' ? seg.replaceAll('|', '') : seg[1])).join('');
  });
  // แบบ Word ขึ้นบรรทัดใหม่ 4 จุดตามฟอร์ม ถ้าชื่อยาวจนต้องไหลต่อกัน ให้ลบจุดขึ้นบรรทัดออก
  const filled = (flowing ? xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:br\/><\/w:r>/g, '') : xml)
    .replace(/\{\{(\w+)\}\}/g, (_, k) => escapeXml(values[k]));
  zip.file('word/document.xml', filled);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/* ---------- คุยกับ Apps Script: ตรวจรายชื่อ และส่งสำเนาเข้า Google Drive ---------- */
async function callScript(payload) {
  // text/plain เพื่อไม่ให้เบราว์เซอร์ส่ง preflight ซึ่ง Apps Script ไม่รองรับ
  const res = await fetch(C.uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(90000),
  });
  const reply = await res.json();
  if (!reply.ok) throw new Error(reply.error || 'script failed');
  return reply;
}

/* ---------- เลือกชื่อจากบัญชีรายชื่อ ---------- */
const pickFilter = $('pickFilter'), pickList = $('pickList'), pickHint = $('pickHint');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

// silent = โหลดซ้ำเพื่ออัปเดตสถานะ "ส่งแล้ว" โดยไม่แตะข้อความของช่องเลือกชื่อ
async function loadPeople(silent) {
  if (!silent) pickHint.textContent = 'กำลังโหลดรายชื่อ…';
  try {
    const r = await callScript({ action: 'list' });
    people = r.list
      .map((p) => ({ k: p.k, first: p.first, last: p.last, name: squash(`${p.first} ${p.last}`), done: !!p.done, no: p.no || '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'th'));
    if (manual) { // โหลดได้แล้ว กลับมาใช้โหมดกดเลือกชื่อ และล้างสิ่งที่พิมพ์เองไว้
      manual = false; picked = null; lookup = { key: '', state: 'idle' };
      [el.first, el.last, el.sid, el.id].forEach((i) => { i.value = ''; });
      applyMode();
    }
    if (picked) picked = people.find((p) => p.k === picked.k) || picked;
    pickHint.textContent = `มี ${people.length} รายชื่อ พิมพ์ค้นหาหรือกดเลือกชื่อของคุณ (✓ = ส่งหนังสือแล้ว)`;
    renderList();
    showChosen();
    renderStatus();
  } catch (e) {
    console.error(e);
    if (silent && people) return; // รีเฟรชเงียบไม่สำเร็จ ใช้ข้อมูลเดิมต่อ
    people = null;
    picked = null;
    pickList.replaceChildren();
    $('pickChosen').textContent = '';
    manual = true; // รายชื่อใช้ไม่ได้ชั่วคราว: เปิดให้กรอกเองเพื่อให้ยังออกหนังสือได้ (ไม่ส่งสำเนาเข้า Drive)
    applyMode();
    pickHint.textContent = 'โหลดรายชื่อไม่สำเร็จ กรอกข้อมูลเองด้านล่างได้ หรือ ';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'ลองโหลดรายชื่ออีกครั้ง';
    retry.addEventListener('click', () => loadPeople());
    pickHint.append(retry);
    renderStatus();
  }
  render();
  showErrors(false);
}

function renderList() {
  if (!people) return;
  const q = squash(pickFilter.value);
  const items = people.filter((p) => !q || p.name.includes(q));
  pickList.replaceChildren(...items.map((p) => {
    const o = new Option(p.done ? `${p.name}   ✓ ส่งแล้ว` : p.name, p.k);
    o.selected = !!picked && picked.k === p.k;
    return o;
  }));
  if (!items.length) pickList.append(Object.assign(new Option('ไม่พบชื่อที่ค้นหา', ''), { disabled: true }));
}

function showChosen() {
  const c = $('pickChosen');
  c.classList.toggle('sent', !!picked?.done);
  // เลือกชื่อแล้ว: ซ่อนช่องค้นหาและรายชื่อคนอื่น เหลือแค่ชื่อที่เลือกกับปุ่มเปลี่ยนชื่อ
  c.closest('.field').classList.toggle('has-pick', !!picked && !manual);
  if (!picked) { c.replaceChildren(); return; }
  const text = document.createElement('span');
  text.textContent = picked.done
    ? `คุณเลือก: ${picked.name} · ชื่อนี้เคยส่งหนังสือแล้ว (ลำดับ ${picked.no}) ส่งซ้ำได้ ระบบจะเก็บไฟล์ใหม่เพิ่ม`
    : `คุณเลือก: ${picked.name}${lookup.state === 'found' && lookup.key === picked.k ? '  ✓ ดึงข้อมูลแล้ว' : ''}`;
  const change = document.createElement('button');
  change.type = 'button'; change.id = 'btnChangeName'; change.textContent = 'เปลี่ยนชื่อ';
  change.addEventListener('click', changeName);
  c.replaceChildren(text, change);
}

// เลือกชื่อผิด: ล้างข้อมูลที่ดึงมา แล้วกลับไปเลือกใหม่
function changeName() {
  picked = null;
  lookup = { key: '', state: 'idle' };
  [el.first, el.last, el.sid, el.id].forEach((i) => { i.value = ''; });
  touched.delete('pick'); touched.delete('id'); touched.delete('sid');
  pickFilter.value = '';
  applyMode();
  showChosen();
  renderList();
  render();
  showErrors(false);
  pickFilter.focus();
}

pickFilter.addEventListener('input', renderList);
pickList.addEventListener('change', () => {
  const p = people?.find((x) => x.k === pickList.value);
  if (!p) return;
  picked = p;
  touched.add('pick');
  el.first.value = p.first; el.last.value = p.last; el.sid.value = ''; el.id.value = '';
  showChosen();
  fetchPick(p.k);
  render();
  showErrors(false);
});

// ปุ่ม "ค้นหาชื่อ": กรองรายชื่อตามที่พิมพ์ แล้วพาไปที่รายการให้กดเลือก
$('btnFind').addEventListener('click', () => {
  renderList();
  pickList.focus();
  pickList.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
});
pickFilter.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('btnFind').click(); } });

// ดึงเลขบัตรประชาชนและเลข นศท. ของคนที่เลือกจากบัญชีรายชื่อมาเติมในฟอร์ม
async function fetchPick(key) {
  lookup = { key, state: 'checking' };
  el.id.placeholder = el.sid.placeholder = 'กำลังดึงข้อมูล…';
  let state = 'error', r = null;
  try {
    r = await callScript({ action: 'pick', key });
    state = r.found ? 'found' : 'error';
  } catch (e) {
    console.error(e);
  }
  if (lookup.key !== key) return; // นักเรียนกดเลือกคนอื่นไปแล้วระหว่างรอคำตอบ
  lookup = { key, state };
  applyMode(); // คืน placeholder ปกติ
  if (state === 'found') {
    el.id.value = groupId(digitsOnly(r.id).slice(0, 13));
    el.sid.value = digitsOnly(r.sid);
    touched.add('id'); touched.add('sid');
  }
  showChosen();
  render();
  showErrors(false);
}

/* ---------- หน้าสรุป: ใครกรอกแล้ว ใครยังไม่กรอก ---------- */
let statusFilter = 'todo';
const statusSearch = $('statusSearch');

// แถบครูในหน้าสรุป: ยังไม่เข้าระบบ = ปุ่มพาไปใส่รหัส, เข้าแล้ว = มีปุ่มลบข้างชื่อคนที่กรอกแล้ว
function renderStatusAdmin() {
  const box = $('statusAdmin');
  const btn = document.createElement('button');
  btn.type = 'button';
  if (admin.pin) {
    btn.textContent = 'ออกจากโหมดครู';
    btn.addEventListener('click', adminLogout);
    box.replaceChildren('โหมดครู: กดปุ่ม "ลบ ให้กรอกใหม่" ข้างชื่อคนที่กรอกผิด ', btn);
  } else {
    btn.textContent = 'ครู: เข้าสู่ระบบเพื่อแก้ไข';
    btn.addEventListener('click', () => showView('admin'));
    box.replaceChildren(btn);
  }
}

async function deleteSubmission(p) {
  if (!confirm(`ลบข้อมูลที่ "${p.name}" ส่งไว้ (ลำดับ ${p.no}) ใช่หรือไม่?\nไฟล์ PDF และ Word ของคนนี้จะถูกย้ายไปถังขยะใน Drive (กู้คืนได้ 30 วัน) และนักเรียนกรอกใหม่ได้`)) return;
  const hint = $('statusHint');
  hint.textContent = `กำลังลบข้อมูลของ ${p.name}…`;
  try {
    const r = await adminCall('adminDelete', { key: p.k });
    await loadPeople(true);
    hint.textContent = r.trashed ? `ลบข้อมูลของ ${p.name} แล้ว (${r.trashed} โฟลเดอร์ ย้ายไปถังขยะใน Drive) ให้นักเรียนกรอกใหม่ได้` : `ไม่พบโฟลเดอร์ของ ${p.name} ใน Drive (อาจถูกลบไปแล้ว)`;
  } catch (e) {
    if (/รหัสครู|ล็อก/.test(String(e.message))) adminLogout();
    hint.textContent = `ลบไม่สำเร็จ: ${String(e.message || e)}`;
  }
}

function renderStatus() {
  renderStatusAdmin();
  const list = $('statusList');
  if (!people) {
    $('statusHint').textContent = 'ยังโหลดรายชื่อไม่ได้ กดรีเฟรชเพื่อลองใหม่';
    list.replaceChildren();
    return;
  }
  const done = people.filter((p) => p.done).length, total = people.length;
  const pct = total ? Math.round((done * 100) / total) : 0;
  $('doneCount').textContent = done; $('allCount').textContent = total;
  $('pct').textContent = `(${pct}%)`;
  $('meter').firstElementChild.style.width = `${pct}%`;
  $('meter').setAttribute('aria-valuenow', pct);
  $('cntTodo').textContent = `(${total - done})`; $('cntDone').textContent = `(${done})`;
  $('tabCount').textContent = `${done}/${total}`;

  const q = squash(statusSearch.value);
  const rows = people.filter((p) => (statusFilter === 'all' || p.done === (statusFilter === 'done')) && (!q || p.name.includes(q)));
  $('statusHint').textContent = rows.length ? '' : (q ? 'ไม่พบชื่อที่ค้นหา' : statusFilter === 'todo' ? 'ทุกคนกรอกครบแล้ว' : 'ยังไม่มีใครกรอก');
  list.replaceChildren(...rows.map((p, i) => {
    const li = document.createElement('li');
    li.className = p.done ? 'ok' : 'todo';
    const idx = document.createElement('span'), nm = document.createElement('span'), tag = document.createElement('span');
    idx.className = 'idx'; idx.textContent = i + 1;
    nm.className = 'nm'; nm.textContent = p.name;
    tag.className = 'tag'; tag.textContent = p.done ? `✓ กรอกแล้ว · ลำดับ ${p.no}` : 'ยังไม่กรอก';
    li.append(idx, nm, tag);
    if (p.done && admin.pin) {
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.textContent = 'ลบ ให้กรอกใหม่';
      del.addEventListener('click', () => deleteSubmission(p));
      li.append(del);
    }
    return li;
  }));
}

function showView(name) {
  $('viewForm').hidden = name !== 'form';
  $('viewStatus').hidden = name !== 'status';
  $('viewAdmin').hidden = name !== 'admin';
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
  if (name === 'status') loadPeople(true);
}
document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => {
  statusFilter = b.dataset.filter;
  document.querySelectorAll('.seg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  renderStatus();
}));
statusSearch.addEventListener('input', renderStatus);
$('btnRefresh').addEventListener('click', () => loadPeople(true));
setInterval(() => { if (ROSTER && !$('viewStatus').hidden && !document.hidden) loadPeople(true); }, 60000);
if (ROSTER) $('tabs').hidden = false;

/* ---------- สำหรับครู: นำเข้ารายชื่อ (ต้องใส่รหัสครู) ---------- */
const admin = { pin: '', items: [] };

const adminCall = (action, extra) => callScript({ action, pin: admin.pin, ...extra });

function adminLogout() {
  admin.pin = '';
  docs = [];
  $('docsBody').replaceChildren();
  $('docsSummary').textContent = '';
  $('docsStatus').textContent = '';
  $('adminBody').hidden = true;
  $('adminLogin').hidden = false;
  $('adminPin').value = '';
  $('adminLoginMsg').textContent = '';
  renderStatus();
}
const maskId = (id) => `${id[0]} xxxx xxxxx xx ${id[12]}`;
const HEADER_RE = { id: /ประชาชน/, sid: /นศท/, name: /ชื่อ/ };

function headerCols(row) {
  const find = (re) => row.findIndex((c) => re.test(String(c ?? '')));
  const cols = { id: find(HEADER_RE.id), sid: find(HEADER_RE.sid), name: find(HEADER_RE.name) };
  return cols.id >= 0 && cols.sid >= 0 && cols.name >= 0 ? cols : null;
}

const colIndex = (ref) => [...ref.replace(/\d/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
const numText = (s) => (/e/i.test(s) ? Number(s).toLocaleString('fullwide', { useGrouping: false }) : s);

// อ่านไฟล์ .xlsx ด้วย JSZip (ไม่ต้องพึ่งไลบรารีอื่น) คืนอาร์เรย์ของแท็บ แต่ละแท็บเป็นอาร์เรย์ของแถว
async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const parse = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const ss = zip.file('xl/sharedStrings.xml');
  const shared = ss
    ? [...parse(await ss.async('string')).getElementsByTagName('si')].map((si) => [...si.getElementsByTagName('t')].map((t) => t.textContent).join(''))
    : [];
  const names = Object.keys(zip.files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const sheets = [];
  for (const name of names) {
    const rows = [];
    for (const row of parse(await zip.file(name).async('string')).getElementsByTagName('row')) {
      const cells = [];
      for (const c of row.getElementsByTagName('c')) {
        const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0];
        let val = '';
        if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('');
        else if (v) val = t === 's' ? (shared[Number(v.textContent)] ?? '') : t === 'str' ? v.textContent : numText(v.textContent);
        cells[colIndex(c.getAttribute('r'))] = val;
      }
      rows.push(Array.from(cells, (x) => x ?? ''));
    }
    sheets.push(rows);
  }
  return sheets;
}

// CSV หรือข้อความที่คัดลอกมาจาก Excel (คั่นด้วยแท็บ)
function parseDelimited(text) {
  const d = text.includes('\t') ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false; } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === d) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return [rows.filter((r) => r.some((c) => c.trim()))];
}

const NAME_OK = /^[ก-๛ a-zA-Z.\-]{3,80}$/;
function nameOk(raw) {
  const name = squash(String(raw ?? '').replace(/ /g, ' '));
  const parts = name.replace(/^(นศท\.?|นาย|นางสาว|นาง)\s*/, '').split(' ').filter(Boolean);
  return NAME_OK.test(name) && parts.length >= 2 ? name : '';
}

// ตรวจรายชื่อก่อนนำเข้า: แถวที่มีปัญหาต้องแก้ที่ไฟล์ต้นทางก่อน (เลขบัตรไม่ผ่านหลักตรวจเป็นเพียงคำเตือน)
function analyzeRoster(sheets) {
  for (const rows of sheets) {
    const h = rows.slice(0, 20).findIndex((r) => headerCols(r));
    if (h < 0) continue;
    const cols = headerCols(rows[h]);
    const items = [], bad = { id: [], sid: [], name: [], dup: [] }, checksum = [], seen = new Map();
    rows.slice(h + 1).forEach((r, i) => {
      const line = h + 2 + i;
      const id = digitsOnly(String(r[cols.id] ?? '')), sid = digitsOnly(String(r[cols.sid] ?? ''));
      if (!id && !sid) return; // แถวสรุป/แถวว่าง ไม่ใช่รายชื่อ
      const name = nameOk(r[cols.name]);
      let ok = true;
      if (id.length !== 13) { bad.id.push(line); ok = false; }
      if (!sid || sid.length > 12) { bad.sid.push(line); ok = false; }
      if (!name) { bad.name.push(line); ok = false; }
      if (id.length === 13) {
        if (seen.has(id)) { bad.dup.push(line); ok = false; } else seen.set(id, line);
        if (!idChecksumOk(id)) checksum.push(line);
      }
      if (ok) items.push({ sid, id, name });
    });
    return { found: true, items, bad, checksum, blocked: Object.values(bad).some((a) => a.length) };
  }
  return { found: false, items: [], bad: { id: [], sid: [], name: [], dup: [] }, checksum: [], blocked: true };
}

const lines = (a) => `แถวที่ ${a.slice(0, 8).join(', ')}${a.length > 8 ? ` และอีก ${a.length - 8} แถว` : ''}`;

function renderImportPreview(res) {
  const box = $('impPreview');
  box.replaceChildren();
  const add = (cls, text) => { const p = document.createElement('p'); p.className = cls; p.textContent = text; box.append(p); };
  admin.items = [];
  if (!res) { syncImportButton(); return; }
  if (!res.found) {
    add('bad', 'ไม่พบแถวหัวตาราง ต้องมีคำว่า "นศท", "ประชาชน" และ "ชื่อ" ในแถวเดียวกัน');
  } else {
    add(res.items.length ? 'ok' : 'bad', `อ่านรายชื่อได้ ${res.items.length} คน`);
    if (res.bad.id.length) add('bad', `เลขประจำตัวประชาชนไม่ครบ 13 หลัก: ${lines(res.bad.id)}`);
    if (res.bad.sid.length) add('bad', `เลข นศท. ว่างหรือผิดรูปแบบ: ${lines(res.bad.sid)}`);
    if (res.bad.name.length) add('bad', `ชื่อ-สกุลว่างหรือผิดรูปแบบ (ต้องมีชื่อและนามสกุล): ${lines(res.bad.name)}`);
    if (res.bad.dup.length) add('bad', `เลขประจำตัวประชาชนซ้ำ: ${lines(res.bad.dup)}`);
    if (res.checksum.length) add('warn', `เลขบัตรไม่ผ่านการตรวจหลักสุดท้าย (นำเข้าได้ แต่ควรเช็กกับต้นฉบับ): ${lines(res.checksum)}`);
    if (res.blocked) add('bad', 'ยังนำเข้าไม่ได้ กรุณาแก้ไฟล์ต้นทางแล้วเลือกไฟล์ใหม่');
    if (res.items.length) {
      const t = document.createElement('table');
      t.innerHTML = '<thead><tr><th>เลข นศท.</th><th>เลขบัตร (ปิดบังบางส่วน)</th><th>ชื่อ-สกุล</th></tr></thead>';
      const tb = document.createElement('tbody');
      res.items.slice(0, 5).forEach((it) => {
        const tr = document.createElement('tr');
        [it.sid, maskId(it.id), it.name].forEach((v) => { const td = document.createElement('td'); td.textContent = v; tr.append(td); });
        tb.append(tr);
      });
      t.append(tb); box.append(t);
      if (res.items.length > 5) add('hint', `แสดง 5 คนแรกจากทั้งหมด ${res.items.length} คน`);
    }
  }
  if (res.found && !res.blocked && res.items.length) admin.items = res.items;
  syncImportButton();
}

// ปุ่มนำเข้ากดได้เมื่อรายชื่อผ่านการตรวจและมีชื่อชุด ถ้ายังไม่มีชื่อชุดให้บอกว่าติดตรงไหน
function syncImportButton() {
  const hasLabel = !!$('impLabel').value.trim();
  $('btnImport').disabled = !admin.items.length || !hasLabel;
  $('impNeedLabel').hidden = hasLabel || !admin.items.length;
}

async function decodeText(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-874').decode(buf); }
}

async function analyzeInput() {
  $('impStatus').textContent = '';
  try {
    const file = $('impFile').files[0], pasted = $('impText').value.trim();
    let sheets = null;
    if (file) sheets = /\.xlsx$/i.test(file.name) ? await readXlsx(await file.arrayBuffer()) : parseDelimited(await decodeText(file));
    else if (pasted) sheets = parseDelimited(pasted);
    const res = sheets ? analyzeRoster(sheets) : null;
    // ยังไม่ได้ตั้งชื่อชุด: เสนอชื่อจากชื่อไฟล์ให้ (แก้ได้) ปุ่มนำเข้าจะได้ไม่ค้างเพราะลืมกรอก
    if (res && res.items.length && !res.blocked && !$('impLabel').value.trim()) {
      const stem = file ? file.name.replace(/\.[^.]+$/, '') : '';
      $('impLabel').value = squash(stem.replace(/[_\[\]*?:\/\\]+/g, ' ')).slice(0, 30) || 'รายชื่อ นศท.';
    }
    renderImportPreview(res);
  } catch (e) {
    console.error(e);
    renderImportPreview(null);
    $('impStatus').textContent = 'อ่านไฟล์ไม่สำเร็จ ลองบันทึกเป็น .xlsx ใหม่ หรือคัดลอกข้อมูลมาวางแทน';
    $('impStatus').classList.add('bad');
  }
}

function renderAdminInfo(info) {
  $('admTotal').textContent = info.total;
  $('admSent').textContent = info.sent == null ? '' : `ส่งหนังสือแล้ว ${info.sent} คน`;
  $('admTabs').replaceChildren(...info.tabs.map((t) => {
    const li = document.createElement('li');
    li.textContent = `${t.name} · ${t.count} คน`;
    return li;
  }));
  if (!info.tabs.length) {
    const li = document.createElement('li'); li.textContent = 'ยังไม่มีรายชื่อ นำเข้าได้ด้านล่าง'; $('admTabs').append(li);
  }
  const link = $('admSheetLink');
  link.hidden = !/^https:\/\/docs\.google\.com\//.test(info.sheetUrl || '');
  if (!link.hidden) link.href = info.sheetUrl;
}

/* ---------- สำหรับครู: เอกสารที่นักเรียนส่งมา ดาวน์โหลดทีละคนหรือรวมเป็นไฟล์เดียว ---------- */
let docs = [];
const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

function saveFile(bytes, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type }));
  a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function loadDocs() {
  const st = $('docsStatus');
  st.classList.remove('bad');
  st.textContent = 'กำลังโหลดรายการเอกสาร (อาจใช้เวลาครึ่งนาทีถ้ามีเอกสารเยอะ)…';
  $('btnDocsMerge').disabled = true;
  try {
    docs = (await adminCall('adminDocs')).docs.sort((a, b) => (a.no < b.no ? -1 : a.no > b.no ? 1 : 0)); // เรียงตามเลขที่เสมอ
    st.textContent = '';
  } catch (e) {
    st.classList.add('bad');
    st.textContent = `โหลดรายการไม่สำเร็จ: ${String(e.message || e)}`;
    return;
  }
  renderDocs();
}

function renderDocs() {
  const count = {};
  docs.forEach((d) => { count[d.no] = (count[d.no] || 0) + 1; });
  const dup = Object.keys(count).filter((k) => count[k] > 1);
  $('docsSummary').textContent = docs.length
    ? `ส่งแล้ว ${docs.length} ฉบับ${dup.length ? ` · เลขที่ซ้ำกัน ${dup.map((k) => +k).join(', ')} (สองคนกรอกเลขที่เดียวกัน ตรวจสอบก่อนพิมพ์)` : ''}`
    : 'ยังไม่มีเอกสารที่ส่งเข้ามา';
  $('btnDocsMerge').disabled = !docs.some((d) => d.pdf);
  $('docsBody').replaceChildren(...docs.map((d) => {
    const tr = document.createElement('tr');
    if (count[d.no] > 1) tr.className = 'dup';
    const no = document.createElement('td'), nm = document.createElement('td'), act = document.createElement('td');
    no.textContent = +d.no; nm.textContent = d.name;
    [['pdf', 'PDF'], ['docx', 'Word']].forEach(([kind, label]) => {
      if (!d[kind]) return;
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      b.addEventListener('click', () => downloadOne(d, kind, b));
      act.append(b);
    });
    tr.append(no, nm, act);
    return tr;
  }));
}

// ขอไฟล์จากสคริปต์ทีละไม่เกิน 6 ไฟล์ (ไฟล์ละ ~0.5 MB เมื่อเป็น base64) คืน Map(id -> { name, bytes })
async function fetchDriveFiles(ids, onProgress) {
  const out = new Map();
  for (let i = 0; i < ids.length; i += 6) {
    const r = await adminCall('adminFiles', { ids: ids.slice(i, i + 6) });
    r.files.forEach((f) => out.set(f.id, { name: f.name, bytes: b64ToBytes(f.b64) }));
    onProgress?.(Math.min(i + 6, ids.length), ids.length);
  }
  return out;
}

async function downloadOne(d, kind, btn) {
  const st = $('docsStatus');
  st.classList.remove('bad');
  btn.disabled = true;
  st.textContent = `กำลังโหลดไฟล์ของ ${d.name}…`;
  try {
    const f = (await fetchDriveFiles([d[kind]])).get(d[kind]);
    saveFile(f.bytes, f.name, kind === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    st.textContent = `ดาวน์โหลด ${f.name} แล้ว`;
  } catch (e) {
    st.classList.add('bad');
    st.textContent = `โหลดไฟล์ไม่สำเร็จ: ${String(e.message || e)}`;
  } finally {
    btn.disabled = false;
  }
}

// รวม PDF ของทุกคน (หรือช่วงเลขที่) เป็นไฟล์เดียวเรียงตามเลขที่ เพื่อสั่งพิมพ์ครั้งเดียว
async function mergeDocs() {
  const st = $('docsStatus'), btn = $('btnDocsMerge');
  const from = Number($('docFrom').value) || 0, to = Number($('docTo').value) || 999;
  const picked = docs.filter((d) => d.pdf && +d.no >= from && +d.no <= to);
  st.classList.remove('bad');
  if (!picked.length) { st.classList.add('bad'); st.textContent = 'ไม่มีเอกสารในช่วงเลขที่นี้'; return; }
  btn.disabled = true;
  try {
    const files = await fetchDriveFiles(picked.map((d) => d.pdf), (n, total) => { st.textContent = `กำลังรวมไฟล์… ${n}/${total}`; });
    const images = picked.map((d) => extractJpeg(files.get(d.pdf).bytes));
    const label = from || to !== 999 ? ` เลขที่ ${+picked[0].no}-${+picked[picked.length - 1].no}` : '';
    const name = `หนังสือรับรอง นศท. รวม${label}`;
    saveFile(makePdfPages(images, name), `${name}.pdf`, 'application/pdf');
    st.textContent = `รวมแล้ว ${picked.length} ฉบับ เรียงตามเลขที่ ${+picked[0].no} ถึง ${+picked[picked.length - 1].no} สั่งพิมพ์จากไฟล์ที่ดาวน์โหลดได้เลย`;
  } catch (e) {
    console.error(e);
    st.classList.add('bad');
    st.textContent = `รวมไฟล์ไม่สำเร็จ: ${String(e.message || e)}`;
  } finally {
    btn.disabled = false;
  }
}

$('btnDocsMerge').addEventListener('click', mergeDocs);
$('btnDocsReload').addEventListener('click', loadDocs);
['docFrom', 'docTo'].forEach((id) => $(id).addEventListener('input', () => { $(id).value = digitsOnly($(id).value).slice(0, 3); }));

$('adminLogin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('adminLoginMsg');
  msg.textContent = '';
  admin.pin = $('adminPin').value;
  $('btnAdminLogin').disabled = true;
  try {
    renderAdminInfo(await adminCall('adminInfo'));
    $('adminBody').hidden = false;
    $('adminLogin').hidden = true;
    renderStatus(); // หน้าสรุปจะมีปุ่มลบให้ครู
    loadDocs();
  } catch (err) {
    admin.pin = '';
    msg.textContent = /Failed to fetch|NetworkError|timeout|Abort/i.test(String(err)) ? 'เชื่อมต่อสคริปต์ไม่ได้ ลองใหม่อีกครั้ง' : String(err.message || err);
  } finally {
    $('btnAdminLogin').disabled = false;
  }
});

$('impFile').addEventListener('change', () => { if ($('impFile').files[0]) $('impText').value = ''; analyzeInput(); });
$('impText').addEventListener('input', () => { if ($('impText').value) $('impFile').value = ''; analyzeInput(); });
$('impLabel').addEventListener('input', syncImportButton);

$('btnImport').addEventListener('click', async () => {
  const label = $('impLabel').value.trim(), n = admin.items.length;
  if (!n || !label) return;
  if (!confirm(`นำเข้า ${n} รายชื่อ เข้าชุด "${label}"\nถ้ามีชุดชื่อนี้อยู่แล้ว จะถูกแทนที่ทั้งชุด ยืนยันหรือไม่?`)) return;
  const st = $('impStatus');
  st.classList.remove('bad');
  st.textContent = 'กำลังนำเข้า…';
  $('btnImport').disabled = true;
  try {
    const info = await adminCall('adminImport', { label, items: admin.items });
    renderAdminInfo(info);
    st.textContent = `นำเข้า ${info.imported} รายชื่อเข้าชุด "${info.tab}" เรียบร้อย ตอนนี้นักเรียนค้นหาชื่อได้แล้ว`;
    $('impFile').value = ''; $('impText').value = '';
    renderImportPreview(null);
    loadPeople(true);
  } catch (err) {
    st.classList.add('bad');
    st.textContent = `นำเข้าไม่สำเร็จ: ${String(err.message || err)}`;
    $('btnImport').disabled = !admin.items.length;
  }
});

let lastSent = '';

// 'off' = ยังไม่ได้ตั้ง uploadUrl, 'sent' = ส่งสำเร็จ (รวมถึงข้อมูลชุดเดิมที่เพิ่งส่งไปแล้ว)
async function sendCopies(v, pdf) {
  if (!fromRoster()) return 'off';
  const sig = JSON.stringify(v);
  if (sig === lastSent) return 'sent';
  const docx = await makeDocx(v);
  await callScript({ no: v.no, id: v.id, pdf: toBase64(pdf), docx: toBase64(docx) });
  lastSent = sig;
  return 'sent';
}

const SEND_FAILED = 'ส่งสำเนาให้ครูไม่สำเร็จ กรุณากดอีกครั้ง หรือแจ้งครูผู้กำกับ';

/* ---------- ปุ่มดาวน์โหลด ---------- */
el.btnPdf.addEventListener('click', async () => {
  if (!checkBeforeExport()) return;
  const v = read();
  setBusy(true);
  setStatus('กำลังสร้างไฟล์ PDF…');
  try {
    let pdf;
    try {
      pdf = await buildPdf(v);
      saveToDevice(pdf, v);
    } catch (e) {
      console.error(e);
      setStatus('สร้าง PDF ไม่สำเร็จ ลองกดปุ่ม “พิมพ์” แล้วเลือก “บันทึกเป็น PDF” แทน', true);
      return;
    }
    if (fromRoster()) setStatus('ดาวน์โหลดแล้ว กำลังส่งสำเนาให้ครู… อย่าเพิ่งปิดหน้านี้');
    try {
      const r = await sendCopies(v, pdf);
      if (r === 'sent') loadPeople(true); // ให้หน้าสรุปเห็นว่าส่งแล้ว
      setStatus(r === 'sent'
        ? 'ดาวน์โหลดแล้ว และส่งสำเนาให้ครูเรียบร้อย ตรวจชื่อและตัวเลขในไฟล์อีกครั้งก่อนพิมพ์'
        : 'ดาวน์โหลดแล้ว ตรวจชื่อและตัวเลขในไฟล์อีกครั้งก่อนพิมพ์');
    } catch (e) {
      console.error(e);
      setStatus(`ดาวน์โหลดแล้ว แต่${SEND_FAILED}`, true);
    }
  } finally {
    setBusy(false);
  }
});

/* ---------- ปุ่มพิมพ์ ---------- */
el.btnPrint.addEventListener('click', async () => {
  if (!checkBeforeExport()) return;
  const v = read();
  setStatus('');
  if (fromRoster()) {
    setBusy(true);
    setStatus('กำลังส่งสำเนาให้ครู…');
    try {
      await sendCopies(v, await buildPdf(v));
      loadPeople(true);
      setStatus('ส่งสำเนาให้ครูเรียบร้อย');
    } catch (e) {
      console.error(e);
      setStatus(SEND_FAILED, true);
    } finally {
      setBusy(false);
    }
  }
  window.print();
});

/* ---------- ย่อตัวอย่างให้พอดีจอ ---------- */
const stage = $('stage'), box = $('stageBox');
function fit() {
  const s = Math.min(1, stage.clientWidth / 793.7);
  box.style.setProperty('--s', s.toFixed(4));
}
new ResizeObserver(fit).observe(stage);
fit();

render();
document.fonts.ready.then(render); // วัดบรรทัดแรกใหม่เมื่อฟอนต์โหลดเสร็จ
showErrors(false);
if (ROSTER) loadPeople();
})();
