// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) from a base32 secret, so CI can sign in an MFA-enrolled
// QA user (E2E_USER_TOTP_SECRET). Same algorithm as Onedirectbuy qa-api/lib/totp.mjs.
const crypto = require("crypto");

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input) {
  const clean = String(input || "").replace(/[\s=-]/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("TOTP secret is not valid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key, counter, digits = 6) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac("sha1", key).update(buf).digest();
  const off = mac[mac.length - 1] & 0x0f;
  const code =
    ((mac[off] & 0x7f) << 24) | (mac[off + 1] << 16) | (mac[off + 2] << 8) | mac[off + 3];
  return String(code % 10 ** digits).padStart(digits, "0");
}

function totpNow(secret, nowMs = Date.now(), step = 30) {
  if (!secret) return "";
  return hotp(base32Decode(secret), Math.floor(nowMs / 1000 / step));
}

module.exports = { base32Decode, hotp, totpNow };
