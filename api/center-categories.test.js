const assert = require("assert");
const fs = require("fs");
const path = require("path");
const {
  CENTER_CATEGORIES,
  normalizeCenterCategories,
} = require("./_center-categories");
const { centerFromRow } = require("./_shared");

const root = path.resolve(__dirname, "..");

function valuesFrom(file, pattern) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

const registerCategories = valuesFrom(
  "apps/register/index.html",
  /name="specialties" value="([^"]+)"/g
);
const ownerCategories = valuesFrom(
  "apps/owner/index.html",
  /name="categories" value="([^"]+)"/g
);
const homepageCategories = [...new Set(valuesFrom(
  "apps/app/public/web/index.html",
  /class="rehab-pill"[^>]+data-category="([^"]+)"/g
))];

assert.deepEqual(registerCategories, CENTER_CATEGORIES);
assert.deepEqual(ownerCategories, CENTER_CATEGORIES);
assert.deepEqual(homepageCategories, CENTER_CATEGORIES);
assert.deepEqual(
  normalizeCenterCategories(["재활운동", "통증관리", "스포츠재활", "재활운동"]),
  ["일상 기능 회복", "통증 관리", "스포츠 복귀"]
);
assert.deepEqual(
  centerFromRow({ lead: "자세교정, 스포츠재활", tags: [] }).categories,
  ["자세·균형", "스포츠 복귀"]
);

console.log("Center category consistency tests passed");
