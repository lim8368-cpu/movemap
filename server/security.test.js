const assert = require("assert");
const crypto = require("crypto");
const security = require("./security");

const key = crypto.randomBytes(32).toString("base64");
const encrypted = security.encryptField("환자 메모 테스트", key);

assert.strictEqual(encrypted.alg, "AES-256-GCM");
assert.notStrictEqual(encrypted.ciphertext, "환자 메모 테스트");
assert.strictEqual(security.decryptField(encrypted, key), "환자 메모 테스트");

assert.strictEqual(
  security.hasPermission({ role: "admin" }, "patient:delete"),
  true
);
assert.strictEqual(
  security.hasPermission({ role: "read_only" }, "patient:delete"),
  false
);

const patient = { id: "patient-1", organizationId: "org-1" };

assert.strictEqual(
  security.canAccessPatient(
    { id: "therapist-1", role: "therapist", organizationId: "org-1" },
    patient,
    { therapistUserId: "therapist-1" }
  ),
  true
);

assert.strictEqual(
  security.canAccessPatient(
    { id: "therapist-2", role: "therapist", organizationId: "org-1" },
    patient,
    { therapistUserId: "therapist-1" }
  ),
  false
);

assert.strictEqual(
  security.canAccessPatient(
    { id: "admin-1", role: "admin", organizationId: "org-2" },
    patient,
    {}
  ),
  false
);

console.log("Security tests passed");
