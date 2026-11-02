// รับข้อมูลจากหน้าเว็บ: ส่งรายชื่อ นศท. ให้เลือก, ยืนยันเลขบัตร, และเก็บไฟล์ PDF กับ Word ลง Drive แยกตามลำดับเลขที่
// วางไฟล์นี้ใน Apps Script ของบัญชีครู แล้วทำให้ใช้งานได้เป็นเว็บแอป (ดูขั้นตอนใน README)
//
// ปกติไม่ต้องแก้อะไรในไฟล์นี้: สคริปต์หาโฟลเดอร์และชีตของครูเองจากชื่อ
//   - โฟลเดอร์ใน Drive ของคุณที่ชื่อมีคำว่า "นำปลด"
//   - Google ชีตใน Drive ของคุณที่ชื่อมีคำว่า "รายชื่อ" และ "นศท"
// ถ้าพบหลายรายการ ให้ใส่รหัสตรงนี้แทน (รหัสคือข้อความใน URL หลัง /folders/ หรือระหว่าง /d/ กับ /edit)
const FOLDER_ID = '';
const ROSTER_SHEET_ID = '';

const FOLDER_NAME_HINT = 'นำปลด';
const MAX_BYTES = 5 * 1024 * 1024; // จำกัดไฟล์ละ 5 MB
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CACHE_SECONDS = 20;

function doGet() {
  try {
    return reply_({ ok: true, service: 'nsd-certificate', students: loadRoster_().length });
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // รายชื่อให้นักเรียนกดเลือก + ใครส่งแล้ว: ส่งเฉพาะชื่อ ไม่ส่งเลขบัตรหรือเลข นศท.
    if (d.action === 'list') return reply_(listPayload_());

    const roster = loadRoster_();
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
      const folder = subfolder_(rootFolder_(), label);
      save_(folder, pdf, 'application/pdf', label, 'pdf');
      save_(folder, docx, MIME_DOCX, label, 'docx');
    } finally {
      lock.releaseLock();
    }
    CacheService.getScriptCache().remove('list');
    return reply_({ ok: true, folder: no });
  } catch (err) {
    return reply_({ ok: false, error: String(err && err.message || err) });
  }
}

/* ---------- หาโฟลเดอร์และชีต ---------- */

function resolve_(configured, cacheKey, search, what) {
  if (configured) return configured;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(cacheKey);
  if (hit) return hit;
  const found = [];
  const it = search();
  while (it.hasNext()) found.push(it.next());
  if (found.length !== 1) {
    throw new Error('หา ' + what + ' ใน Drive ของบัญชีนี้ได้ ' + found.length + ' รายการ (ต้องมี 1 รายการ) ถ้ามีแล้ว ให้ใส่รหัสในบรรทัดบนสุดของ Code.gs');
  }
  cache.put(cacheKey, found[0].getId(), 21600);
  return found[0].getId();
}

function rootFolder_() {
  const id = resolve_(FOLDER_ID, 'folderId', function () {
    return DriveApp.searchFolders("title contains '" + FOLDER_NAME_HINT + "' and 'me' in owners and trashed = false");
  }, 'โฟลเดอร์ที่ชื่อมีคำว่า "' + FOLDER_NAME_HINT + '"');
  return DriveApp.getFolderById(id);
}

function rosterSheetId_() {
  return resolve_(ROSTER_SHEET_ID, 'sheetId', function () {
    return DriveApp.searchFiles("title contains 'รายชื่อ' and title contains 'นศท' and mimeType = 'application/vnd.google-apps.spreadsheet' and 'me' in owners and trashed = false");
  }, 'Google ชีตที่ชื่อมีคำว่า "รายชื่อ" และ "นศท"');
}

/* ---------- บัญชีรายชื่อ ---------- */

// คืนอาร์เรย์ [{ key, id, sid, first, last }] เรียงตามชีต; key = "แท็บ-แถว" ใช้อ้างอิงคนในหน้าเว็บโดยไม่เปิดเผยเลขบัตร
function loadRoster_() {
  const roster = [];
  const sheetId = rosterSheetId_();
  let book;
  try {
    book = SpreadsheetApp.openById(sheetId);
  } catch (err) {
    throw new Error('เปิดชีตรายชื่อไม่ได้ ตรวจว่าเป็น Google ชีต (ไม่ใช่ไฟล์ .xlsx) และบัญชีนี้มีสิทธิ์เข้าถึง: ' + err.message);
  }
  book.getSheets().forEach(function (sheet, t) {
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

// ใครส่งแล้ว: ดูจากชื่อโฟลเดอร์ "022 ชื่อ นามสกุล" ในโฟลเดอร์ปลายทาง
function listPayload_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('list');
  if (hit) return JSON.parse(hit);

  const sent = {};
  const it = rootFolder_().getFolders();
  while (it.hasNext()) {
    const m = /^(\d{3}) (.+)$/.exec(it.next().getName());
    if (m) sent[m[2].replace(/\s+/g, ' ').trim()] = m[1];
  }
  const list = loadRoster_().map(function (s) {
    const no = sent[(s.first + ' ' + s.last).replace(/\s+/g, ' ').trim()];
    return { k: s.key, first: s.first, last: s.last, done: !!no, no: no || '' };
  });
  const payload = { ok: true, list: list };
  cache.put('list', JSON.stringify(payload), CACHE_SECONDS);
  return payload;
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
