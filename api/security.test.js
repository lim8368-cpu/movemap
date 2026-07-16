const assert = require("assert");
const crypto = require("crypto");

const salt = crypto.randomBytes(16);
const password = "correct horse battery staple";
const hash = crypto.scryptSync(password, salt, 64);
process.env.ADMIN_PASSWORD_SCRYPT = `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
process.env.ADMIN_SESSION_SECRET = crypto.randomBytes(32).toString("base64url");

const shared = require("./_shared");
const ownerAuth = require("./_owner-auth");

assert.strictEqual(shared.verifyAdminPassword(password), true);
assert.strictEqual(shared.verifyAdminPassword("wrong password"), false);

const now = Date.now();
const token = shared.signAdminSession(now);
assert.strictEqual(shared.verifyAdminSession(token, now + 1000), true);
assert.strictEqual(shared.verifyAdminSession(token, now + shared.ADMIN_SESSION_TTL_SECONDS * 1000 + 1), false);
assert.strictEqual(shared.verifyAdminSession(`${token}tampered`, now), false);

const ownerPassword = "center owner secure password";
const ownerHash = ownerAuth.hashOwnerPassword(ownerPassword);
assert.strictEqual(ownerAuth.verifyOwnerPassword(ownerPassword, ownerHash), true);
assert.strictEqual(ownerAuth.verifyOwnerPassword("wrong password", ownerHash), false);
assert.throws(() => ownerAuth.hashOwnerPassword("short"));

const ownerToken = ownerAuth.signOwnerSession({ id: "account-1", center_id: "center-1", email: "owner@example.com" }, now);
const ownerSession = ownerAuth.verifyOwnerSession(ownerToken, now + 1000);
assert.strictEqual(ownerSession.role, "center_owner");
assert.strictEqual(ownerSession.centerId, "center-1");
assert.strictEqual(ownerAuth.verifyOwnerSession(`${ownerToken}tampered`, now), null);

console.log("API security tests passed");
