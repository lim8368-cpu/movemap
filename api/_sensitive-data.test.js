const assert = require("node:assert/strict");
const crypto = require("crypto");

process.env.CENTER_CLIENT_DATA_KEYS = `v1:${crypto.randomBytes(32).toString("base64")}`;
process.env.CENTER_CLIENT_LOOKUP_SECRET = "test-center-client-lookup-secret-at-least-32-chars";

const {
  decryptClientField,
  encryptClientField,
  hashClientPhone,
  normalizedPhone,
  validateClientDataConfig,
} = require("./_sensitive-data");

const context = {
  centerId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  field: "full_name",
};
const first = encryptClientField("홍길동", context);
const second = encryptClientField("홍길동", context);

assert.equal(decryptClientField(first, context), "홍길동");
assert.notEqual(first.iv, second.iv);
assert.notEqual(first.ciphertext, second.ciphertext);
assert.throws(
  () => decryptClientField(first, { ...context, centerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }),
  /authentication failed/
);

const tampered = { ...first, ciphertext: `${first.ciphertext.slice(0, -2)}AA` };
assert.throws(() => decryptClientField(tampered, context), /authentication failed/);

assert.equal(normalizedPhone("010-1234-5678"), "01012345678");
assert.equal(hashClientPhone("010-1234-5678", context.centerId), hashClientPhone("01012345678", context.centerId));
assert.notEqual(hashClientPhone("010-1234-5678", context.centerId), hashClientPhone("010-9876-5432", context.centerId));
assert.notEqual(hashClientPhone("010-1234-5678", context.centerId), hashClientPhone("010-1234-5678", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"));
assert.equal(encryptClientField("", context), null);
assert.equal(decryptClientField(null, context), "");
assert.equal(validateClientDataConfig(), true);

const validKeys = process.env.CENTER_CLIENT_DATA_KEYS;
process.env.CENTER_CLIENT_DATA_KEYS = `${validKeys},${validKeys}`;
assert.throws(() => validateClientDataConfig(), /duplicate version/);
process.env.CENTER_CLIENT_DATA_KEYS = validKeys;
process.env.CENTER_CLIENT_DATA_ACTIVE_VERSION = "missing";
assert.throws(() => validateClientDataConfig(), /not in the key ring/);
delete process.env.CENTER_CLIENT_DATA_ACTIVE_VERSION;

console.log("Sensitive center client data tests passed");
