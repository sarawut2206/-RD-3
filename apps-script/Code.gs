// รับข้อมูลจากหน้าเว็บ: ส่งรายชื่อ นศท. ให้เลือก, คืนข้อมูลของคนที่เลือก, และเก็บไฟล์ PDF กับ Word ลง Drive แยกตามลำดับเลขที่
// วางไฟล์นี้ใน Apps Script ของบัญชีครู แล้วทำให้ใช้งานได้เป็นเว็บแอป (ดูขั้นตอนใน README)
//
// ปกติไม่ต้องแก้อะไรในไฟล์นี้: สคริปต์หาโฟลเดอร์และชีตของครูเอง
//   - โฟลเดอร์ใน Drive ของคุณที่ชื่อ "นำปลด 2569" (ต้องมีโฟลเดอร์เดียวที่ชื่อนี้)
//   - Google ชีตใน Drive ของคุณที่หัวตารางเป็นรายชื่อ นศท. (ไม่สนชื่อไฟล์)
// ถ้าหาไม่เจอหรือเจอหลายรายการ ให้ใส่รหัสตรงนี้แทน (รหัสคือข้อความใน URL หลัง /folders/ หรือระหว่าง /d/ กับ /edit)
const FOLDER_ID = '';
const ROSTER_SHEET_ID = '';

// รหัสครู สำหรับหน้า "สำหรับครู" บนเว็บ (นำเข้ารายชื่อ) ตั้งเองตรงนี้ อย่างน้อย 6 ตัวอักษร และห้ามใส่ลงใน GitHub
// ถ้าเว้นว่างไว้ หน้าสำหรับครูจะใช้ไม่ได้
const ADMIN_PIN = '';

const FOLDER_NAME = 'นำปลด 2569';
const ROSTER_SHEET_TITLE = 'รายชื่อ นศท. (ระบบนำเข้า)';
const MAX_ROSTER_ROWS = 800;
const MAX_BYTES = 5 * 1024 * 1024; // จำกัดไฟล์ละ 5 MB
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const CACHE_SECONDS = 20;

// ใช้เช็กว่าลิงก์ /exec รันโค้ดรุ่นไหน: เปิดลิงก์แล้วดูค่า version
const VERSION = 'admin-import-1';

function doGet() {
  try {
    return reply_({ ok: true, service: 'nsd-certificate', version: VERSION, students: loadRoster_().length });
  } catch (err) {
    return reply_({ ok: false, service: 'nsd-certificate', version: VERSION, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);

    // หน้าสำหรับครู (ต้องมีรหัสครู) ทำก่อนอ่านรายชื่อ เพราะใช้นำเข้ารายชื่อตอนที่ยังไม่มีรายชื่อได้
    if (d.action === 'adminInfo') { requireAdmin_(d.pin); return reply_(adminInfo_()); }
    if (d.action === 'adminImport') { requireAdmin_(d.pin); return reply_(importRoster_(d)); }

    // รายชื่อให้นักเรียนกดเลือก + ใครส่งแล้ว: ส่งเฉพาะชื่อ ไม่ส่งเลขบัตรหรือเลข นศท.
    if (d.action === 'list') return reply_(listPayload_());

    const roster = loadRoster_();
    // นักเรียนกดเลือกชื่อ: คืนเลขบัตรประชาชนและเลข นศท. ของคนนั้นคนเดียว
    if (d.action === 'pick') {
      const s = roster.filter(function (x) { return x.key === String(d.key); })[0];
      if (!s) return reply_({ ok: true, found: false });
      return reply_({ ok: true, found: true, id: s.id, sid: s.sid });
    }

    const id = parseId_(d.id);

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
  const found = search();
  if (found.length !== 1) {
    throw new Error('หา ' + what + ' ใน Drive ของบัญชีนี้ได้ ' + found.length + ' รายการ (ต้องมี 1 รายการ) ถ้ามีแล้ว ให้ใส่รหัสในบรรทัดบนสุดของ Code.gs');
  }
  cache.put(cacheKey, found[0].getId(), 21600);
  return found[0].getId();
}

function rootFolder_() {
  const id = resolve_(FOLDER_ID, 'folderId', function () {
    const found = [];
    const it = DriveApp.searchFolders("title contains '" + FOLDER_NAME + "' and 'me' in owners and trashed = false");
    while (it.hasNext()) {
      const f = it.next();
      if (f.getName().trim() === FOLDER_NAME) found.push(f);
    }
    return found;
  }, 'โฟลเดอร์ชื่อ "' + FOLDER_NAME + '"');
  return DriveApp.getFolderById(id);
}

// หาชีตรายชื่อจากหัวตาราง (มีคอลัมน์ นศท / ประชาชน / ชื่อ) ไม่พึ่งชื่อไฟล์ ดูเฉพาะ Google ชีตที่แก้ไขใน 45 วันล่าสุด
function rosterSheetId_() {
  const imported = PropertiesService.getScriptProperties().getProperty('rosterSheetId') || '';
  return resolve_(ROSTER_SHEET_ID || imported, 'sheetId', function () {
    const since = Utilities.formatDate(new Date(Date.now() - 45 * 86400000), 'UTC', "yyyy-MM-dd'T'HH:mm:ss");
    const it = DriveApp.searchFiles("mimeType = 'application/vnd.google-apps.spreadsheet' and 'me' in owners and trashed = false and modifiedDate > '" + since + "'");
    const found = [];
    for (let n = 0; it.hasNext() && n < 40; n++) {
      const f = it.next();
      try {
        const sheet = SpreadsheetApp.openById(f.getId()).getSheets()[0];
        const rows = sheet.getRange(1, 1, Math.min(10, sheet.getMaxRows()), Math.min(10, sheet.getMaxColumns())).getValues();
        if (rows.some(function (row) { return headerColumns_(row); })) found.push(f);
      } catch (err) { /* เปิดไม่ได้ ข้าม */ }
    }
    return found;
  }, 'Google ชีตรายชื่อ นศท. (ดูจากหัวตาราง และต้องแก้ไขภายใน 45 วัน ถ้ายังเป็นไฟล์ .xlsx ให้แปลงเป็น Google ชีตก่อน)');
}

/* ---------- หน้าสำหรับครู: นำเข้ารายชื่อ ---------- */

function requireAdmin_(pin) {
  if (!ADMIN_PIN || ADMIN_PIN.length < 6) throw new Error('ยังไม่ได้ตั้งรหัสครู: แก้บรรทัด ADMIN_PIN ใน Code.gs (อย่างน้อย 6 ตัวอักษร) แล้วทำให้ใช้งานได้เป็นเวอร์ชันใหม่');
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pinFails') || 0);
  if (fails >= 5) throw new Error('ใส่รหัสผิดหลายครั้ง ระบบล็อก 10 นาที แล้วลองใหม่');
  if (String(pin == null ? '' : pin) !== ADMIN_PIN) {
    cache.put('pinFails', String(fails + 1), 600);
    throw new Error('รหัสครูไม่ถูกต้อง');
  }
  cache.remove('pinFails');
}

function existingRosterBook_() {
  try {
    return SpreadsheetApp.openById(rosterSheetId_());
  } catch (err) {
    return null; // ยังไม่มีชีตรายชื่อ
  }
}

function sheetRows_(sheet) {
  const out = [];
  let cols = null;
  sheet.getDataRange().getValues().forEach(function (row) {
    if (!cols) { cols = headerColumns_(row); return; }
    if (digits_(row[cols.id]).length === 13 && digits_(row[cols.sid]) && splitName_(row[cols.name])) out.push(row);
  });
  return cols ? out.length : -1; // -1 = แท็บนี้ไม่มีหัวตารางรายชื่อ
}

function adminInfo_() {
  const book = existingRosterBook_();
  const info = { ok: true, tabs: [], total: 0, sheetUrl: '', sent: null };
  if (book) {
    info.sheetUrl = book.getUrl();
    book.getSheets().forEach(function (sheet) {
      const n = sheetRows_(sheet);
      if (n >= 0) { info.tabs.push({ name: sheet.getName(), count: n }); info.total += n; }
    });
  }
  try {
    info.sent = listPayload_().list.filter(function (p) { return p.done; }).length;
  } catch (err) { /* ยังไม่มีรายชื่อหรือโฟลเดอร์ */ }
  return info;
}

// รับรายการ [{ sid, id, name }] จากหน้าเว็บ ตรวจซ้ำฝั่งนี้ทุกแถว แล้วเขียนทับแท็บชื่อ label ในชีตรายชื่อ (สร้างชีตให้ถ้ายังไม่มี)
function importRoster_(d) {
  const label = String(d.label == null ? '' : d.label).trim();
  if (!label || label.length > 30 || /[\[\]*?:\/\\]/.test(label)) throw new Error('ชื่อชุดรายชื่อไม่ถูกต้อง (1-30 ตัวอักษร ห้ามมี [ ] * ? : / \\)');
  const items = d.items;
  if (!Array.isArray(items) || !items.length) throw new Error('ไม่มีรายชื่อให้นำเข้า');
  if (items.length > MAX_ROSTER_ROWS) throw new Error('รายชื่อมากเกินไป (สูงสุด ' + MAX_ROSTER_ROWS + ' คน)');

  const seen = {};
  const rows = items.map(function (it, i) {
    const sid = digits_(it && it.sid), id = digits_(it && it.id), name = String((it && it.name) || '').replace(/\s+/g, ' ').trim();
    if (!/^\d{1,12}$/.test(sid)) throw new Error('แถวที่ ' + (i + 1) + ': เลข นศท. ไม่ถูกต้อง');
    if (!/^\d{13}$/.test(id)) throw new Error('แถวที่ ' + (i + 1) + ': เลขประจำตัวประชาชนต้องมี 13 หลัก');
    if (!/^[฀-๿ a-zA-Z.\-]{3,80}$/.test(name) || !splitName_(name)) throw new Error('แถวที่ ' + (i + 1) + ': ชื่อ-สกุลไม่ถูกต้อง');
    if (seen[id]) throw new Error('แถวที่ ' + (i + 1) + ': เลขประจำตัวประชาชนซ้ำกับแถวที่ ' + seen[id]);
    seen[id] = i + 1;
    return [sid, id, name];
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    let book = existingRosterBook_();
    if (!book) {
      book = SpreadsheetApp.create(ROSTER_SHEET_TITLE);
      PropertiesService.getScriptProperties().setProperty('rosterSheetId', book.getId());
      CacheService.getScriptCache().put('sheetId', book.getId(), 21600);
    }
    let sheet = book.getSheetByName(label);
    if (!sheet) {
      const only = book.getSheets();
      sheet = only.length === 1 && only[0].getLastRow() === 0 ? only[0].setName(label) : book.insertSheet(label);
    }
    sheet.clear();
    const all = [['เลขประจำตัว นศท.', 'เลขประจำตัวประชาชน', 'ชื่อ - สกุล']].concat(rows);
    sheet.getRange(1, 1, all.length, 3).setNumberFormat('@').setValues(all); // เป็นข้อความ เพื่อไม่ให้เลขนำหน้า 0 หาย
    sheet.setFrozenRows(1);
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove('list');
  return Object.assign(adminInfo_(), { imported: rows.length, tab: label });
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
