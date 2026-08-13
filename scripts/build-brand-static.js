const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const webRoot = path.join(root, "apps", "app", "public", "web");
const brandRoot = path.join(webRoot, "brand");
const target = path.join(root, "dist-brand");
const analyticsWebsiteId = "e6f5d5ec-49df-4bde-ae0c-93f8560148e7";
const analyticsOrigin =
  process.env.BRAND_ANALYTICS_ORIGIN || "https://stats-dail.157-90-26-205.sslip.io";

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
  .replace('<a class="brand" href="/">', '<a class="brand" href="/" aria-label="DAIL 브랜드 이야기 홈">')
  .replace(
    /\s*<button class="menu-toggle"[\s\S]*?<\/button>\s*<nav id="brandMainNav"[\s\S]*?<\/nav>\s*<div class="header-actions">[\s\S]*?<\/div>/,
    '\n    <p class="header-release-status">브랜드 선공개</p>'
  )
  .replace(/\s*<a class="brand-collaboration-link"[\s\S]*?<\/a>/, "")
  .replace(
    /\s*<div>\s*<a class="button primary" href="\/#search">내 주변 센터 찾기<\/a>\s*<a class="button outline" href="\/register\/">센터 등록 신청<\/a>\s*<\/div>/,
    '\n      <p class="brand-preview-notice">전체 서비스는 준비 중입니다</p>'
  )
  .replace(/\s*<div><b>서비스<\/b>[\s\S]*?센터 파트너 신청<\/a><\/div>/, "")
  .replace(/\s*<div><b>안내<\/b>[\s\S]*?개인정보처리방침<\/a><\/div>/, "");

const analyticsScript = [
  "  <!-- DAIL 브랜드 선공개 방문 통계: Main/Dev와 분리된 자체 호스팅 분석 -->",
  `  <script defer src="${analyticsOrigin}/script.js"`,
  `    data-website-id="${analyticsWebsiteId}"`,
  `    data-host-url="${analyticsOrigin}"`,
  '    data-domains="brand.dail.life"',
  '    data-do-not-track="true"',
  '    data-exclude-search="true"></script>',
].join("\n");

html = html.replace("</head>", `${analyticsScript}\n</head>`);

fs.writeFileSync(path.join(target, "index.html"), html);
console.log(`Brand-only static assets copied to ${target}`);
