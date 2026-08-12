const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const webRoot = path.join(root, "apps", "app", "public", "web");
const brandRoot = path.join(webRoot, "brand");
const target = path.join(root, "dist-brand");

function copyDirectory(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const sourcePath = path.join(from, entry.name);
    const targetPath = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(sourcePath, targetPath);
    else fs.copyFileSync(sourcePath, targetPath);
  }
}

fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });

for (const file of ["styles.css", "mobile-containment.css"]) {
  fs.copyFileSync(path.join(webRoot, file), path.join(target, file));
}
copyDirectory(path.join(webRoot, "assets"), path.join(target, "assets"));
fs.copyFileSync(path.join(brandRoot, "brand.css"), path.join(target, "brand.css"));
fs.copyFileSync(path.join(brandRoot, "brand-preview.css"), path.join(target, "brand-preview.css"));

let html = fs.readFileSync(path.join(brandRoot, "index.html"), "utf8");
html = html
  .replace(
    '<link rel="stylesheet" href="./brand.css?v=20260812-symbol-editorial-2" />',
    '<link rel="stylesheet" href="./brand.css?v=20260812-symbol-editorial-2" />\n  <link rel="stylesheet" href="./brand-preview.css?v=20260812" />'
  )
  .replace('class="brand-story-page"', 'class="brand-story-page brand-preview-site"')
  .replace(/<script defer src="\.\.\/assets\/site-header\.js[^>]*><\/script>\s*/g, "")
  .replace('<a class="brand" href="/" aria-label="DAIL 홈">', '<a class="brand" href="/" aria-label="DAIL 브랜드 이야기 홈">')
  .replace('<a class="brand" href="/">', '<a class="brand" href="/" aria-label="DAIL 브랜드 이야기 홈">');

fs.writeFileSync(path.join(target, "index.html"), html);
console.log(`Brand-only static assets copied to ${target}`);
