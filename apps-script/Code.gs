// รับไฟล์ PDF และ Word จากหน้าเว็บ แล้วเก็บลงโฟลเดอร์ Drive แยกตามลำดับเลขที่
// วางไฟล์นี้ใน Apps Script ของบัญชีครู แล้วใส่รหัสโฟลเดอร์ด้านล่าง (ดูขั้นตอนใน README)
const FOLDER_ID = 'ใส่รหัสโฟลเดอร์ที่นี่';

const MAX_BYTES = 5 * 1024 * 1024; // จำกัดไฟล์ละ 5 MB
const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function doGet() {
  return reply_({ ok: true, service: 'nsd-certificate' });
}

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const no = parseNo_(d.no);
    const label = no + ' ' + parseName_(d.first) + ' ' + parseName_(d.last);
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

function parseNo_(v) {
  const s = String(v == null ? '' : v);
  if (!/^\d{1,3}$/.test(s) || Number(s) < 1) throw new Error('invalid number');
  return ('00' + Number(s)).slice(-3); // 022 เพื่อให้ Drive เรียงตามเลขที่
}

function parseName_(v) {
  const s = String(v == null ? '' : v).trim();
  if (!s || s.length > 40 || !/^[ก-๎ a-zA-Z.\-]+$/.test(s)) throw new Error('invalid name');
  return s;
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
