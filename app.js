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
const PLACEHOLDER = { first: 'ชื่อ', last: 'นามสกุล', no: '๐๐', id: '๐ ๐๐๐๐ ๐๐๐๐๐ ๐๐ ๐', sid: '๐๐๐๐๐๐๐๐๐', day: '๐๐', month: 'เดือน', year: '๐๐๐๐' };

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

/* ---------- ค่าคงที่ในหนังสือ ---------- */
$('schoolLine').textContent = `โรงเรียน${C.school}`;
$('pSchool').textContent = `โรงเรียน ${C.school}  จังหวัด ${C.province}`;
$('pTitle').textContent = C.signerTitle;
$('pSigner').textContent = `( ${C.signer} )`;
$('pPhone').textContent = `${C.phoneLabel} : ${toThai(C.phone)}`;
$('pDate').textContent =
  `ให้ไว้  ณ  วันที่ ${toThai(C.issue.day)} เดือน ${MONTHS[C.issue.month - 1]} พ.ศ. ${toThai(C.issue.year)}`;

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
function validate(v) {
  const err = {}, warn = {};
  if (!v.first) err.first = 'กรุณากรอกชื่อ';
  if (!v.last) err.last = 'กรุณากรอกนามสกุล';
  if (!v.no) err.no = 'กรุณากรอกลำดับในบัญชีรายชื่อ';
  else if (+v.no < 1) err.no = 'ลำดับต้องเริ่มจาก 1';

  if (v.id.length !== 13) err.id = `เลขประจำตัวประชาชนต้องมี 13 หลัก (ตอนนี้ ${v.id.length} หลัก)`;
  else if (!idChecksumOk(v.id)) warn.id = 'เลขนี้ไม่ผ่านการตรวจสอบหลักสุดท้าย กรุณาเช็กกับบัตรอีกครั้ง';

  if (v.sid.length !== 9) err.sid = `เลขประจำตัว นศท. ต้องมี 9 หลัก (ตอนนี้ ${v.sid.length} หลัก)`;

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

/* ---------- วาดหนังสือ ---------- */
function field(text, key, ph) {
  const s = document.createElement('span');
  s.textContent = text || ph;
  s.className = text ? 'u hl' : 'u hl ph';
  s.dataset.k = key;
  return s;
}

// ข้อความตายตัว: ช่องว่างคงไว้ตามต้นฉบับทุกตัว, "|" = จุดที่ตัดบรรทัดได้
// (ตัดคำตามที่ Word ตัดในไฟล์ตัวอย่าง เช่น ไม่แยก "บัญชีรายชื่อ" "วิชาทหาร" ออกจากกัน)
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
  const v = read();
  const t = toThai;
  $('pBody').replaceChildren(
    words('      หนังสือ|รับรอง|ฉบับนี้|ให้ไว้|เพื่อ|แสดงว่า นักศึกษา|วิชาทหาร '),
    field(v.first, 'name', PLACEHOLDER.first),
    '  ',
    field(v.last, 'name', PLACEHOLDER.last),
    words(' ลำดับ|ใน|บัญชีรายชื่อ  '),
    field(v.no && t(v.no), 'no', PLACEHOLDER.no),
    words('  หมายเลข|ประจำตัว|ประชาชน '),
    field(v.id && t(groupId(v.id)), 'id', PLACEHOLDER.id),
    words(' หมายเลข|ประจำตัว|นักศึกษา|วิชาทหาร '),
    field(v.sid && t(v.sid), 'sid', PLACEHOLDER.sid),
    words(' เกิดวันที่ '),
    field(v.day && t(v.day), 'day', PLACEHOLDER.day),
    words(' เดือน '),
    field(v.month && MONTHS[v.month - 1], 'month', PLACEHOLDER.month),
    words(' พ.ศ.'),
    field(v.year && t(v.year), 'year', PLACEHOLDER.year),
    words(`  เป็น|นักศึกษา|วิชาทหาร ชั้นปีที่ ${t(C.trainingYear)}      ของสถานศึกษาวิชาทหาร  โรงเรียน|${C.school} ` +
          `ปัจจุบัน|กำลัง|ศึกษา|อยู่ใน|ระดับ|ชั้น|มัธยมศึกษา|ปีที่  ${t(C.gradeLevel)}   ` +
          `ประจำ ปีการศึกษา ${t(C.academicYear)} จริง`),
  );
}

/* ---------- ช่องกรอก ---------- */
el.id.addEventListener('input', () => {
  const g = groupId(digitsOnly(el.id.value).slice(0, 13));
  if (el.id.value !== g) el.id.value = g;
});
[el.no, el.sid].forEach((i) => i.addEventListener('input', () => {
  const d = digitsOnly(i.value).slice(0, i === el.no ? 3 : 9);
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
  $('form').reset(); touched.clear(); setStatus(''); render(); showErrors(false);
});

function setStatus(msg, bad) { el.status.textContent = msg; el.status.classList.toggle('bad', !!bad); }

function checkBeforeExport() {
  const err = showErrors(true);
  const first = Object.keys(err)[0];
  if (!first) return true;
  setStatus('ยังกรอกข้อมูลไม่ครบ กรุณาแก้ช่องที่ขึ้นสีแดง', true);
  const target = document.querySelector(`.field[data-f="${first}"] input, .field[data-f="${first}"] select`);
  target?.focus();
  return false;
}

/* ---------- พิมพ์ ---------- */
el.btnPrint.addEventListener('click', () => {
  if (!checkBeforeExport()) return;
  setStatus('');
  window.print();
});

/* ---------- ดาวน์โหลด PDF ---------- */
let fontCssPromise;
function fontEmbedCss() {
  fontCssPromise ||= Promise.all([
    ['fonts/THSarabunPSK.ttf', 400], ['fonts/THSarabunPSK-Bold.ttf', 700],
  ].map(async ([url, weight]) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let bin = ''; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return `@font-face{font-family:"TH SarabunPSK";font-weight:${weight};src:url(data:font/ttf;base64,${btoa(bin)}) format("truetype");}`;
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
  return new Blob(parts, { type: 'application/pdf' });
}

const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

async function download() {
  if (!checkBeforeExport()) return;
  const v = read();
  el.btnPdf.disabled = true;
  setStatus('กำลังสร้างไฟล์ PDF…');
  try {
    await document.fonts.ready;
    const opts = { pixelRatio: 3, backgroundColor: '#fff', fontEmbedCSS: await fontEmbedCss(), cacheBust: false };
    el.paper.classList.remove('show-hl');
    if (isSafari) await htmlToImage.toCanvas(el.paper, opts); // Safari มักวาดรอบแรกว่าง
    const canvas = await htmlToImage.toCanvas(el.paper, opts);
    const jpg = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.95));
    const name = `หนังสือรับรอง นศท. ${v.first} ${v.last}`;
    const pdf = makePdf(new Uint8Array(await jpg.arrayBuffer()), canvas.width, canvas.height, name);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(pdf);
    a.download = `${name}.pdf`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    setStatus('ดาวน์โหลดแล้ว ตรวจชื่อและตัวเลขในไฟล์อีกครั้งก่อนพิมพ์');
  } catch (e) {
    console.error(e);
    setStatus('สร้าง PDF ไม่สำเร็จ ลองกดปุ่ม “พิมพ์” แล้วเลือก “บันทึกเป็น PDF” แทน', true);
  } finally {
    el.paper.classList.add('show-hl');
    el.btnPdf.disabled = false;
  }
}
el.btnPdf.addEventListener('click', download);

/* ---------- ย่อตัวอย่างให้พอดีจอ ---------- */
const stage = $('stage'), box = $('stageBox');
function fit() {
  const s = Math.min(1, stage.clientWidth / 793.7);
  box.style.setProperty('--s', s.toFixed(4));
}
new ResizeObserver(fit).observe(stage);
fit();

render();
showErrors(false);
})();
