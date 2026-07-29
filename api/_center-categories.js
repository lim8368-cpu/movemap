const CENTER_CATEGORIES = [
  "허리·골반",
  "목·어깨",
  "무릎·발목",
  "수술 후 회복",
  "스포츠 복귀",
  "자세·균형",
  "시니어 보행",
  "산전·산후 회복",
  "통증 관리",
  "일상 기능 회복",
];

const CENTER_CATEGORY_ALIASES = new Map([
  ["재활운동", "일상 기능 회복"],
  ["통증관리", "통증 관리"],
  ["자세교정", "자세·균형"],
  ["체형관리", "자세·균형"],
  ["스포츠재활", "스포츠 복귀"],
  ["시니어운동", "시니어 보행"],
  ["산전산후", "산전·산후 회복"],
  ["다이어트", "일상 기능 회복"],
  ["허리/골반", "허리·골반"],
  ["목/어깨", "목·어깨"],
  ["무릎/발목", "무릎·발목"],
  ["수술 후", "수술 후 회복"],
]);

const CENTER_CATEGORY_SET = new Set(CENTER_CATEGORIES);

function canonicalCenterCategory(value) {
  const category = String(value || "").trim();
  if (CENTER_CATEGORY_SET.has(category)) return category;
  return CENTER_CATEGORY_ALIASES.get(category) || "";
}

function normalizeCenterCategories(value, limit = CENTER_CATEGORIES.length) {
  const values = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(values.map(canonicalCenterCategory).filter(Boolean))].slice(0, limit);
}

module.exports = {
  CENTER_CATEGORIES,
  canonicalCenterCategory,
  normalizeCenterCategories,
};
