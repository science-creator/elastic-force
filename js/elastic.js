/* =========================================================
   elastic.js — 탄성력 계산 엔진
   ---------------------------------------------------------
   화면을 전혀 모른다. 숫자만 다룬다.

   ■ 이 엔진이 지키는 두 가지

     ① **탄성력은 준 힘과 크기가 같고 방향이 반대다.**
        학습지 4쪽 : 「탄성력은 탄성체에 준 힘과 (반대) 방향으로 작용한다」
                     「탄성체가 많이 변형될수록 작용하는 탄성력이 (크다)」
        그래서 탄성력을 따로 담아 두지 않고 **준 힘에서 바로 만든다.**

     ② **늘어난 길이는 무게에 비례한다.**
        학습지 5쪽 : 「용수철은 작용한 힘에 비례하여 일정하게 늘어난다」
        이 한 줄에서 용수철저울이 나온다 — 늘어난 길이를 재면 거꾸로 무게를 알 수 있다.

   ■ 선생님 학습지의 숫자를 그대로 쓴다
     · 실험표 : 추의 무게 0~6 N → 늘어난 길이 0 · 0.6 · 1.3 · 1.9 · 2.5 · 3.1 · 3.6 cm
     · 추 7개(7 N) 를 매달면 약 **4.2 cm**
     · 무게 10 N 에 10 cm 늘어나는 용수철에 필통을 매다니 5 cm → 필통은 **5 N**
     ⚠ 실험표는 **실제로 잰 값**이라 딱 떨어지지 않는다(0.6·1.3·1.9…).
       그래서 표는 **종이에 있는 그대로** 담고, 예측·외삽에는 **0.6 cm/N** 을 쓴다.
       둘의 차이는 어느 점에서도 0.1 cm 이내다(검증에서 확인한다).
   ========================================================= */
(function (global) {
  "use strict";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v, n) { var p = Math.pow(10, n || 0); return Math.round(v * p) / p; }

  /* ---------------------------------------------------------
     1. 용수철 — 무르기(1 N 당 몇 cm 늘어나는가)만 다르다
     --------------------------------------------------------- */
  var SPRINGS = [
    { key: "paper", name: "학습지 용수철", emoji: "🌀", cmPerN: 0.6,
      note: "실험표의 용수철 — 1 N 당 0.6 cm" },
    { key: "soft",  name: "무른 용수철",   emoji: "〰️", cmPerN: 1.0,
      note: "10 N 에 10 cm — 필통 문제의 용수철" },
    { key: "stiff", name: "뻣뻣한 용수철", emoji: "➰", cmPerN: 0.3,
      note: "같은 무게에도 적게 늘어난다" }
  ];

  function spring(key) {
    for (var i = 0; i < SPRINGS.length; i++) if (SPRINGS[i].key === key) return SPRINGS[i];
    return SPRINGS[0];
  }

  /* ---------------------------------------------------------
     2. 학습지 5쪽의 실험표 — **종이에 있는 그대로**
        ⚠ '더 반듯한 값'으로 고치지 말 것. 학생이 종이와 화면을 나란히 놓고 본다.
     --------------------------------------------------------- */
  var PAPER_TABLE = [
    { n: 0, cm: 0 },   { n: 1, cm: 0.6 }, { n: 2, cm: 1.3 }, { n: 3, cm: 1.9 },
    { n: 4, cm: 2.5 }, { n: 5, cm: 3.1 }, { n: 6, cm: 3.6 }
  ];

  function paperStretch(n) {
    for (var i = 0; i < PAPER_TABLE.length; i++) if (PAPER_TABLE[i].n === n) return PAPER_TABLE[i].cm;
    return null;                                   // 표에 없는 값은 예측으로 구한다
  }

  /* ---------------------------------------------------------
     3. 늘어난 길이 ↔ 무게 — 서로 거꾸로인 한 쌍
        용수철저울이 하는 일이 바로 아래쪽 함수다.
     --------------------------------------------------------- */
  function stretchCm(weightN, springKey) {
    return Math.max(weightN, 0) * spring(springKey).cmPerN;
  }
  function weightFromStretch(cm, springKey) {
    return Math.max(cm, 0) / spring(springKey).cmPerN;
  }

  /* 추 한 개 = 1 N (학습지의 표가 그렇게 되어 있다) */
  var WEIGHT_PER_PIECE_N = 1;
  function weightOf(pieces) { return pieces * WEIGHT_PER_PIECE_N; }

  /* ---------------------------------------------------------
     4. 탄성력 — 준 힘과 크기는 같고 방향은 반대
        `sign` 은 준 힘의 방향(+1 / −1). 탄성력은 언제나 그 반대다.
     --------------------------------------------------------- */
  function elasticForce(appliedN, sign) {
    var s = (sign == null ? 1 : (sign >= 0 ? 1 : -1));
    return { size: Math.abs(appliedN), sign: -s,
             sameSize: true, opposite: true };
  }

  /* 변형량으로부터 구해도 같은 값이 나와야 한다 —
     '많이 변형될수록 탄성력이 크다'가 이 함수에 들어 있다. */
  function elasticFromDeform(cm, springKey) {
    return weightFromStretch(cm, springKey);
  }

  /* 누르든 당기든 **크기는 같고 방향만 반대** 인가 — 검증용 */
  function alwaysOpposite(appliedN) {
    return [1, -1].every(function (s) {
      var e = elasticForce(appliedN, s);
      return e.sign === -s && Math.abs(e.size - Math.abs(appliedN)) < 1e-12;
    });
  }

  /* ---------------------------------------------------------
     5. 비례 관계 — 학습지 4쪽 「두 요인은 서로 비례한다」
        원점을 지나는 직선인지 확인하는 helper.
     --------------------------------------------------------- */
  function isProportional(points, tolCm) {
    /* ⚠ 부동소수점 때문에 `<= t` 로 딱 자르면 안 된다.
       1.3 − 1.2 가 0.1 이 아니라 0.10000000000000009 로 나와서
       "허용 오차 0.1 안"인 점이 밖으로 판정됐다(검증에서 걸렸다).
       아주 작은 여유(EPS)를 더해 견준다. */
    var EPS = 1e-9;
    var t = (tolCm == null ? 0.1 : tolCm);
    var slope = null;
    return points.every(function (p) {
      if (p.n === 0) return Math.abs(p.cm) < EPS;       // 원점을 지나야 한다
      var s = p.cm / p.n;
      if (slope === null) { slope = s; return true; }
      return Math.abs(p.cm - slope * p.n) <= t + EPS;
    });
  }

  /* 실험표가 '0.6 cm/N 인 이상적인 용수철'과 얼마나 다른가 */
  function paperVsIdeal() {
    return PAPER_TABLE.map(function (p) {
      var ideal = stretchCm(p.n, "paper");
      return { n: p.n, 잰값: p.cm, 이상값: round(ideal, 2), 차이: round(Math.abs(p.cm - ideal), 2) };
    });
  }

  /* ---------------------------------------------------------
     6. 한 상태 묶음 — 화면과 학습지가 같이 쓴다
     --------------------------------------------------------- */
  function state(pieces, springKey) {
    var w = weightOf(pieces);
    var measured = (springKey === "paper") ? paperStretch(pieces) : null;
    var ideal = stretchCm(w, springKey);
    return {
      pieces: pieces, weightN: w,
      stretchCm: (measured == null ? ideal : measured),
      idealCm: ideal,
      measured: measured != null,                 // 표에 있는 값인가, 예측한 값인가
      springName: spring(springKey).name,
      cmPerN: spring(springKey).cmPerN
    };
  }

  global.Elastic = {
    SPRINGS: SPRINGS, PAPER_TABLE: PAPER_TABLE, WEIGHT_PER_PIECE_N: WEIGHT_PER_PIECE_N,
    clamp: clamp, round: round,
    spring: spring, paperStretch: paperStretch,
    stretchCm: stretchCm, weightFromStretch: weightFromStretch, weightOf: weightOf,
    elasticForce: elasticForce, elasticFromDeform: elasticFromDeform,
    alwaysOpposite: alwaysOpposite,
    isProportional: isProportional, paperVsIdeal: paperVsIdeal,
    state: state
  };
})(window);
