const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "apps", "app", "public", "web");
const registerSource = path.join(root, "apps", "register");
const target = path.join(root, "dist");
const registerTarget = path.join(target, "register");

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });

  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.rmSync(target, { recursive: true, force: true });
copyDirectory(source, target);
copyDirectory(registerSource, registerTarget);
console.log(`Vercel static web assets copied to ${target}`);
