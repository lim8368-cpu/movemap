const crypto = require("crypto");
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question("새 관리자 비밀번호: ", (password) => {
  if (password.length < 12) {
    console.error("관리자 비밀번호는 12자 이상이어야 합니다.");
    rl.close();
    process.exitCode = 1;
    return;
  }

  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  const sessionSecret = crypto.randomBytes(32).toString("base64url");
  console.log(`ADMIN_PASSWORD_SCRYPT=scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`);
  console.log(`ADMIN_SESSION_SECRET=${sessionSecret}`);
  rl.close();
});
