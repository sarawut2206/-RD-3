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
    else if (lookup.state === 'checking') err.pick = 'กำลังดึงข้อมูลจากบัญชีรายชื่อ…';
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
  document.querySelectorAll('.field').forEach((f) => {
    const k = f.dataset.f;
    const on = showAll || touched.has(k);
    const m = on ? (err[k] || warn[k] || '') : '';
    f.classList.toggle('err', on && !!err[k]);
    f.classList.toggle('warn', on && !err[k] && !!warn[k]);
    f.querySelector('.msg').textContent = m;
  });
  return err;
}

/* ---------- เนื้อความหนังสือ ---------- */
// ข้อความตายตัว: ช่องว่างคงไว้ตามต้นฉบับทุกตัว, "|" = จุดที่ตัดบรรทัดได้
// ช่องที่นักเรียนกรอก = [คีย์, ค่า, ตัวอย่างสีเทา]
// คืน [บรรทัดแรก, ส่วนที่เหลือ]: ไฟล์ต้นฉบับขึ้นบรรทัดใหม่ด้วยมือหลัง "ลำดับใน" ทำให้ท้ายบรรทัดตรงตามฟอร์มทุกคน
function bodySegments(v) {
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
    ' หมายเลข|ประจำ|ตัว|นัก|ศึกษา|วิชา|ทหาร ',
    ['sid', v.sid && t(v.sid), PLACEHOLDER.sid],
    ' เกิด|วัน|ที่ ',
    ['day', v.day && t(v.day), PLACEHOLDER.day],
    ' เดือน ',
    ['month', v.month && MONTHS[v.month - 1], PLACEHOLDER.month],
    ' พ.ศ.',
    ['year', v.year && t(v.year), PLACEHOLDER.year],
    `  เป็น|นัก|ศึกษา|วิชา|ทหาร ชั้น|ปี|ที่ ${t(C.trainingYear)}      ของ|สถาน|ศึกษา|วิชา|ทหาร  โรงเรียน|${C.school} ` +
    `ปัจจุบัน|กำลัง|ศึกษา|อยู่|ใน|ระดับ|ชั้น|มัธยม|ศึกษา|ปี|ที่  ${t(C.gradeLevel)}   ` +
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
    if (tok[0] === ' ') { f.append(tok); return; }
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

function render() {
  const body = $('pBody');
  const [line1, rest] = bodySegments(read()).map((segs, i) => {
    const line = document.createElement('span');
    line.className = i ? 'rest' : 'line1';
    line.append(...segs.map((seg, j) => {
      if (typeof seg !== 'string') return field(seg[1], seg[0], seg[2]);
      // ช่องว่าง 6 ตัวต้นย่อหน้าอยู่ใน text-indent แล้ว (ไม่ให้ถูกยืดตอนจัดชิดขอบ) ส่วนไฟล์ Word ยังใช้ช่องว่างจริง
      return words(i === 0 && j === 0 ? seg.trimStart() : seg);
    }));
    return line;
  });
  line1.append(document.createElement('wbr'));
  body.classList.remove('flowing');
  body.replaceChildren(line1, rest);
  // ชื่อยาวจนล้นบรรทัดแรก: ถ้ายังขึ้นบรรทัดใหม่หลัง "ลำดับใน" Word จะยืด "ใน" เต็มบรรทัด จึงให้ไหลต่อกันแทน
  if (line1.offsetHeight > parseFloat(getComputedStyle(body).lineHeight) * 1.5) body.classList.add('flowing');
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

// PDF หน้าเดียว A4 ที่มีรูปหนังสือเต็มหน้า (ไม่ต้องพึ่งไลบรารี)
function makePdf(jpeg, pxW, pxH, title) {
  const W = 595.28, H = 841.89, enc = new TextEncoder();
  const parts = [], offsets = [];
  let len = 0;
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; add(`${n} 0 obj\n${body}\nendobj\n`); };
  const hex = [...title].map((c) => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;

  add(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  offsets[4] = len;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg); add('\nendstream\nendobj\n');
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  obj(6, `<< /Title <FEFF${hex}> /Producer (nsd-certificate) >>`);

  const xref = len;
  add(`xref\n0 7\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len);
  let o = 0;
  parts.forEach((p) => { out.set(p, o); o += p.length; });
  return out;
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
  const [bodyA, bodyB] = bodySegments(v).map((segs) =>
    segs.map((seg) => (typeof seg === 'string' ? seg.replaceAll('|', '') : seg[1])).join(''));
  const values = { ...FIXED, bodyA, bodyB };
  const flowing = $('pBody').classList.contains('flowing');
  const filled = (flowing ? xml.replace(/<w:r>(?:(?!<\/w:r>)[\s\S])*?<w:br\/><\/w:r>/, '') : xml)
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
  c.textContent = !picked ? '' : picked.done
    ? `คุณเลือก: ${picked.name} · ชื่อนี้เคยส่งหนังสือแล้ว (ลำดับ ${picked.no}) ส่งซ้ำได้ ระบบจะเก็บไฟล์ใหม่เพิ่ม`
    : `คุณเลือก: ${picked.name}`;
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
  let state = 'error', r = null;
  try {
    r = await callScript({ action: 'pick', key });
    state = r.found ? 'found' : 'error';
  } catch (e) {
    console.error(e);
  }
  if (lookup.key !== key) return; // นักเรียนกดเลือกคนอื่นไปแล้วระหว่างรอคำตอบ
  lookup = { key, state };
  if (state === 'found') {
    el.id.value = groupId(digitsOnly(r.id).slice(0, 13));
    el.sid.value = digitsOnly(r.sid);
    touched.add('id'); touched.add('sid');
  }
  render();
  showErrors(false);
}

/* ---------- หน้าสรุป: ใครกรอกแล้ว ใครยังไม่กรอก ---------- */
let statusFilter = 'todo';
const statusSearch = $('statusSearch');

function renderStatus() {
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
    return li;
  }));
}

function showView(name) {
  $('viewForm').hidden = name !== 'form';
  $('viewStatus').hidden = name !== 'status';
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
