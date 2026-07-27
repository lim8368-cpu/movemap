const assert = require("assert");

const { coordinate, normalizePlace, plainText } = require("./place-search")._test;

assert.strictEqual(plainText("<b>서울역</b> &amp; 1호선"), "서울역 & 1호선");
assert.strictEqual(coordinate("1269873882"), 126.9873882);
assert.deepStrictEqual(normalizePlace({
  title: "<b>서울시청</b>",
  category: "공공,사회기관>지방행정기관",
  address: "서울특별시 중구 태평로1가 31",
  roadAddress: "서울특별시 중구 세종대로 110",
  mapx: "1269783882",
  mapy: "375665103",
  link: "https://map.naver.com/p/entry/place/1234",
}, 0), {
  id: "1269783882-375665103-0",
  name: "서울시청",
  category: "공공,사회기관 · 지방행정기관",
  address: "서울특별시 중구 태평로1가 31",
  roadAddress: "서울특별시 중구 세종대로 110",
  lat: 37.5665103,
  lng: 126.9783882,
  naverPlaceId: "1234",
  naverMapUrl: "https://map.naver.com/p/entry/place/1234",
});
assert.strictEqual(normalizePlace({
  title: "해외 장소",
  mapx: "1000000000",
  mapy: "100000000",
}, 0), null);

console.log("Place search tests passed");
