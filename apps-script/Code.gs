// ตรวจรายชื่อ นศท. จาก Google Sheet ส่วนตัว และเก็บไฟล์ PDF กับ Word ลงโฟลเดอร์ Drive แยกตามลำดับเลขที่
// วางไฟล์นี้ใน Apps Script ของบัญชีครู แล้วใส่รหัสสองบรรทัดด้านล่าง (ดูขั้นตอนใน README)
const FOLDER_ID = 'ใส่รหัสโฟลเดอร์ที่นี่';
const ROSTER_SHEET_ID = 'ใส่รหัส Google Sheet รายชื่อที่นี่';

const MAX_BYTES = 5 * 1024 * 1024; // จำกัดไฟล์ละ 5 MB
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function doGet() {
  return reply_({ ok: true, service: 'nsd-certificate', students: loadRoster_().length });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const roster = loadRoster_();

    // รายชื่อให้นักเรียนกดเลือก: ส่งเฉพาะชื่อกับรหัสแถว ไม่ส่งเลขบัตรหรือเลข นศท.
    if (d.action === 'list') {
      return reply_({ ok: true, list: roster.map(function (s) { return { k: s.key, first: s.first, last: s.last }; }) });
    }

    const id = parseId_(d.id);

    // ยืนยันว่าเลขบัตรที่กรอกตรงกับชื่อที่เลือก แล้วจึงคืนเลข นศท.
    if (d.action === 'verify') {
      const s = roster.filter(function (x) { return x.key === String(d.key); })[0];
      if (!s || s.id !== id) return reply_({ ok: true, found: false });
      return reply_({ ok: true, found: true, sid: s.sid });
    }

    const student = roster.filter(function (x) { return x.id === id; })[0];
    if (!student) throw new Error('not in roster');
    const no = parseNo_(d.no);
    const label = no + ' ' + student.first + ' ' + student.last;
    const pdf = decode_(d.pdf, '%PDF');
    const docx = decode_(d.docx, 'PK');

    // กันนักเรียนเลขที่เดียวกันส่งพร้อมกันแล้วได้โฟลเดอร์ซ้ำ
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      const folder = subfolder_(DriveApp.getFolderById(FOLDER_ID), label);
      save_(folder, pdf, 'application/pdf', label, 'pdf');
      save_(folder, docx, MIME_DOCX, label, 'docx');
    } finally {
      lock.releaseLock();
    }
    return reply_({ ok: true, folder: no });
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message || err) });
  }
}

// อ่านทุกแท็บ หาแถวหัวตารางจากชื่อคอลัมน์ จึงเพิ่มรายชื่อชุดใหม่เป็นแท็บใหม่ได้
// คืนอาร์เรย์ [{ key, id, sid, first, last }] เรียงตามชีต; key = "แท็บ-แถว" ใช้อ้างอิงคนในหน้าเว็บโดยไม่เปิดเผยเลขบัตร
function loadRoster_() {
  const roster = [];
  SpreadsheetApp.openById(ROSTER_SHEET_ID).getSheets().forEach(function (sheet, t) {
    let cols = null;
    sheet.getDataRange().getValues().forEach(function (row, r) {
      if (!cols) { cols = headerColumns_(row); return; }
      const id = digits_(row[cols.id]);
      const sid = digits_(row[cols.sid]);
      const name = splitName_(row[cols.name]);
      if (id.length === 13 && sid && name) roster.push({ key: t + '-' + r, id: id, sid: sid, first: name.first, last: name.last });
    });
  });
  return roster;
}

function headerColumns_(row) {
  const find = function (re) { return row.findIndex(function (c) { return re.test(String(c)); }); };
  const cols = { id: find(/ประชาชน/), sid: find(/นศท/), name: find(/ชื่อ/) };
  return cols.id >= 0 && cols.sid >= 0 && cols.name >= 0 ? cols : null;
}

function digits_(v) {
  return String(v == null ? '' : v)
    .replace(/[๐-๙]/g, function (c) { return String(c.charCodeAt(0) - 0x0E50); })
    .replace(/\D/g, '');
}

// "นศท.ชื่อ นามสกุล" -> { first, last }
function splitName_(v) {
  const parts = String(v == null ? '' : v)
    .replace(/ /g, ' ')
    .replace(/^\s*(นศท\.?|นาย|นางสาว|นาง)\s*/, '')
    .trim().split(/\s+/);
  if (parts.length < 2 || !parts[0]) return null;
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function parseId_(v) {
  const s = digits_(v);
  if (s.length !== 13) throw new Error('invalid id');
  return s;
}

function parseNo_(v) {
  const s = String(v == null ? '' : v);
  if (!/^\d{1,3}$/.test(s) || Number(s) < 1) throw new Error('invalid number');
  return ('00' + Number(s)).slice(-3); // 022 เพื่อให้ Drive เรียงตามเลขที่
}

function decode_(b64, magic) {
  if (typeof b64 !== 'string' || b64.length > MAX_BYTES * 4 / 3 + 4) throw new Error('invalid file');
  const bytes = Utilities.base64Decode(b64);
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic.charCodeAt(i)) throw new Error('invalid file');
  }
  return bytes;
}

function subfolder_(parent, name) {
  const found = parent.getFoldersByName(name);
  return found.hasNext() ? found.next() : parent.createFolder(name);
}

// ไม่ทับไฟล์เดิม: ถ้าชื่อซ้ำจะเติมเวลาที่ส่งต่อท้าย
function save_(folder, bytes, mime, label, ext) {
  let name = label + '.' + ext;
  if (folder.getFilesByName(name).hasNext()) {
    const at = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HHmmss');
    name = label + ' (' + at + ').' + ext;
  }
  folder.createFile(Utilities.newBlob(bytes, mime, name));
}

function reply_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
