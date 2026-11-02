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

$('privacy').textContent = ROSTER
  ? 'ระบบใช้เลขประจำตัวประชาชนตรวจกับบัญชีรายชื่อของครู และเมื่อกดดาวน์โหลดหรือพิมพ์ จะส่งสำเนาหนังสือรับรอง (มีเลขประจำตัวประชาชนและวันเกิด) ไปเก็บใน Google Drive ของครูผู้กำกับ ข้อมูลไม่ถูกบันทึกไว้ในเครื่องนี้เมื่อปิดหน้าเว็บ'
  : 'ข้อมูลถูกประมวลผลในเครื่องของคุณเท่านั้น ไม่ถูกส่งไปที่ใด และไม่ถูกบันทึกไว้เมื่อปิดหน้าเว็บ';

$('sidLabel').textContent = `เลขประจำตัวนักศึกษาวิชาทหาร (${C.sidLength} หลัก)`;
el.sid.placeholder = '0'.repeat(C.sidLength);
el.sid.maxLength = C.sidLength;
if (ROSTER) {
  [el.first, el.last, el.sid].forEach((i) => { i.readOnly = true; i.placeholder = 'ระบบเติมให้จากเลขบัตร'; });
  $('idHint').textContent = 'กรอกช่องนี้ก่อน ระบบจะเติมชื่อ นามสกุล และเลข นศท. ให้จากบัญชีรายชื่อ';
}

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
let lookup = { id: '', state: 'idle' };

function validate(v) {
  const err = {}, warn = {};
  if (v.id.length !== 13) err.id = `เลขประจำตัวประชาชนต้องมี 13 หลัก (ตอนนี้ ${v.id.length} หลัก)`;
  else if (ROSTER) {
    if (lookup.state === 'checking') err.id = 'กำลังตรวจบัญชีรายชื่อ…';
    else if (lookup.state === 'missing') err.id = 'ไม่พบเลขนี้ในบัญชีรายชื่อ กรุณาเช็กกับบัตรอีกครั้ง หรือแจ้งครูผู้กำกับ';
    else if (lookup.state !== 'found') err.id = 'ตรวจบัญชีรายชื่อไม่สำเร็จ กรุณาลบเลขตัวสุดท้ายแล้วพิมพ์ใหม่ หรือแจ้งครูผู้กำกับ';
  } else {
    if (!idChecksumOk(v.id)) warn.id = 'เลขนี้ไม่ผ่านการตรวจสอบหลักสุดท้าย กรุณาเช็กกับบัตรอีกครั้ง';
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
  if (ROSTER && d !== lookup.id) lookupRoster(d);
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
  $('form').reset(); touched.clear(); lookup = { id: '', state: 'idle' }; setStatus(''); render(); showErrors(false);
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

function fillFromRoster(s) {
  el.first.value = s.first; el.last.value = s.last; el.sid.value = s.sid;
}

async function lookupRoster(id) {
  fillFromRoster({ first: '', last: '', sid: '' });
  if (id.length !== 13) { lookup = { id, state: 'idle' }; return; }
  lookup = { id, state: 'checking' };
  touched.add('id');
  showErrors(false);
  let state = 'error', student = null;
  try {
    const r = await callScript({ action: 'lookup', id });
    state = r.found ? 'found' : 'missing';
    student = r;
  } catch (e) {
    console.error(e);
  }
  if (lookup.id !== id) return; // นักเรียนแก้เลขไปแล้วระหว่างรอคำตอบ
  lookup = { id, state };
  if (state === 'found') fillFromRoster(student);
  render();
  showErrors(false);
}

let lastSent = '';

// 'off' = ยังไม่ได้ตั้ง uploadUrl, 'sent' = ส่งสำเร็จ (รวมถึงข้อมูลชุดเดิมที่เพิ่งส่งไปแล้ว)
async function sendCopies(v, pdf) {
  if (!C.uploadUrl) return 'off';
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
    if (C.uploadUrl) setStatus('ดาวน์โหลดแล้ว กำลังส่งสำเนาให้ครู… อย่าเพิ่งปิดหน้านี้');
    try {
      const r = await sendCopies(v, pdf);
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
  if (C.uploadUrl) {
    setBusy(true);
    setStatus('กำลังส่งสำเนาให้ครู…');
    try {
      await sendCopies(v, await buildPdf(v));
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
})();
