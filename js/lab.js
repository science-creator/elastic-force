/* =========================================================
   lab.js — 원래 모양으로 되돌아가려는 힘 실험실
   ---------------------------------------------------------
   계산은 elastic.js 가 하고, 이 파일은 그것을 '보이게' 만든다.

   화면의 핵심 장치 세 가지
     ① 손으로 누르거나 당길 때, **준 힘 화살표와 탄성력 화살표가
        같은 길이로 반대 방향**을 향한다. 세게 할수록 둘이 함께 자란다.
     ② 추를 하나씩 매달면 용수철이 **무게에 비례해서** 늘어난다.
        늘어난 길이를 그대로 픽셀에 비례시켰으므로, 그림이 곧 표다.
     ③ 거꾸로 — 늘어난 길이를 재면 **무게를 알아낼 수 있다**(용수철저울).

   ⚠ **그려진 길이가 곧 값이다.** 두 화살표는 같은 눈금을 쓰고,
     용수철이 늘어난 픽셀은 cm 에 정비례한다.
   ⚠ 애니메이션이 없으므로 requestAnimationFrame 을 돌리지 않는다.
   ========================================================= */
(function () {
  "use strict";

  var E = window.Elastic;

  var S = {
    scene: "hand",
    hand: 0,           // N — 손으로 주는 힘
    way: "press",      // press | pull
    pieces: 0,         // 매단 추 개수
    spring: "paper",
    stretch: 0,        // cm — 용수철저울 장면에서 읽은 길이
    mission: null, predictPick: null, missionState: "ready"
  };

  var canvas, ctx, cssW = 900, cssH = 556;
  var records = [];
  var seen = { ways: {}, hands: {}, pieces: {}, springs: {}, stretchSet: {} };

  var COL = { ink: "#e2e8f0", faint: "#64748b", line: "#94a3b8",
              hand: "#fbbf24", elastic: "#34d399" };

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return E.clamp(v, a, b); }
  function fmt(v, n) { var d = (n == null ? 1 : n); return (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d); }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  /* ---------------------------------------------------------
     1. 미션
        ⚠ `setup` 이 정답 자리이면 안 된다 — 시작하자마자 깨지면 미션이 아니다.
     --------------------------------------------------------- */
  var MISSIONS = [
    {
      id: 1, star: "🤏", title: "누르면 손이 밀린다",
      story: "용수철을 <b>양쪽 끝에서 눌러</b> 보자. 용수철에서 <b>손으로 전달되는 힘</b>은 " +
             "어느 쪽을 향할까?",
      scene: "hand", setup: { hand: 0, way: "press" }, allow: ["hand", "way"],
      predict: { q: "누를 때 손에 작용하는 탄성력의 방향은?",
                 opts: ["누르는 방향과 같은 쪽", "<b>누르는 방향과 반대쪽(손을 밀어낸다)</b>",
                        "위쪽"], ans: 1 },
      goals: [{ key: "pressed", text: "용수철을 <b>눌러</b> 두 화살표 확인하기" }],
      why: "<b>누르는 방향과 반대쪽</b>입니다. 손을 <b>밀어내는</b> 쪽이에요.<br>" +
           "탄성력은 <b>원래 모양으로 돌아가려는 힘</b>이라서, 줄어든 용수철은 다시 " +
           "<b>늘어나려고</b> 손을 밀어냅니다.<br>" +
           "<em>두 화살표를 보세요 — 길이가 같고 방향이 반대입니다.</em>"
    },
    {
      id: 2, star: "💪", title: "세게 할수록",
      story: "이번엔 힘을 <b>더 세게</b> 줘 보자. 손에 작용하는 탄성력의 <b>크기</b>는 어떻게 될까? " +
             "서로 다른 <b>두 세기</b>로 해 보자.",
      scene: "hand", setup: { hand: 0, way: "press" }, allow: ["hand", "way"],
      predict: { q: "세게 누를수록 손에 작용하는 힘은?",
                 opts: ["<b>커진다</b>", "작아진다", "변하지 않는다"], ans: 0 },
      goals: [{ key: "twoHands", text: "서로 <b>다른 두 세기</b>로 힘을 줘 보기" }],
      why: "<b>커집니다.</b> 학습지의 문장 그대로예요 — " +
           "<b>탄성체가 많이 변형될수록 작용하는 탄성력이 크다.</b><br>" +
           "그리고 언제나 <b>준 힘과 크기가 같습니다.</b> " +
           "1 N 으로 누르면 탄성력도 1 N, 3 N 으로 누르면 탄성력도 3 N 이에요."
    },
    {
      id: 3, star: "↔️", title: "당길 때는 어떨까",
      story: "이번엔 용수철을 양쪽에서 <b>잡아당겨</b> 보자. 탄성력의 방향은 어떻게 될까?",
      scene: "hand", setup: { hand: 2, way: "press" }, allow: ["hand", "way"],
      predict: { q: "당길 때 손에 작용하는 탄성력의 방향은?",
                 opts: ["당기는 방향과 같은 쪽", "<b>당기는 방향과 반대쪽(손을 끌어당긴다)</b>",
                        "아래쪽"], ans: 1 },
      goals: [{ key: "pulled", text: "<b>↔️ 양쪽에서 당긴다</b> 로 바꿔 확인하기" }],
      why: "<b>당기는 방향과 반대쪽</b>입니다. 손을 <b>끌어당기는</b> 쪽이에요.<br>" +
           "늘어난 용수철은 다시 <b>줄어들려고</b> 하니까요.<br>" +
           "누를 때든 당길 때든 <b>탄성력은 준 힘과 반대 방향</b>입니다 — 방향만 뒤집힐 뿐이에요."
    },
    {
      id: 4, star: "🪝", title: "추를 2배로 하면",
      story: "용수철에 추를 매달아 보자. 추를 <b>2개</b>에서 <b>4개</b>로 늘리면 " +
             "늘어난 길이는 어떻게 될까?",
      scene: "hang", setup: { pieces: 0, spring: "paper" }, allow: ["pieces", "spring"],
      predict: { q: "추를 2배로 하면 늘어난 길이는?",
                 opts: ["<b>약 2배가 된다</b>", "그대로다", "약 절반이 된다"], ans: 0 },
      goals: [{ key: "piece4", text: "추를 <b>4개</b>까지 매달아 보기" }],
      why: "<b>약 2배가 됩니다.</b> 학습지의 표 그대로예요 — " +
           "추 2개 <b>1.3 cm</b> → 추 4개 <b>2.5 cm</b>.<br>" +
           "<b>용수철은 작용한 힘에 비례하여 일정하게 늘어납니다.</b>"
    },
    {
      id: 5, star: "🔮", title: "추 7개면 얼마나",
      story: "표에는 추 <b>6개</b>까지만 있다. 추 <b>7개</b>를 매달면 몇 cm 늘어날까? " +
             "먼저 예측하고 확인해 보자.",
      scene: "hang", setup: { pieces: 0, spring: "paper" }, allow: ["pieces", "spring"],
      predict: { q: "추 7개(7 N)를 매달면 늘어난 길이는?",
                 opts: ["약 3.6 cm", "<b>약 4.2 cm</b>", "약 7 cm"], ans: 1 },
      goals: [{ key: "piece7", text: "추를 <b>7개</b>로 맞춰 확인하기" }],
      why: "약 <b>4.2 cm</b> 입니다.<br>" +
           "이 용수철은 1 N 마다 약 <b>0.6 cm</b> 씩 늘어나므로 0.6 × 7 = 4.2 cm 예요.<br>" +
           "<em>표에 없는 값도 <b>비례 관계</b>를 알면 예측할 수 있습니다 — " +
           "그래프의 직선을 늘려 읽는 것과 같아요.</em>"
    },
    {
      id: 6, star: "⚖️", title: "필통의 무게를 알아내라",
      story: "무게 <b>10 N</b> 인 물체를 매달면 <b>10 cm</b> 늘어나는 용수철이 있다. " +
             "이 용수철에 필통을 매달았더니 <b>5 cm</b> 늘어났다. 필통의 무게는?",
      scene: "gauge", setup: { spring: "paper", stretch: 0 }, allow: ["spring", "stretch"],
      predict: { q: "필통의 무게는?",
                 opts: ["2.5 N", "<b>5 N</b>", "10 N"], ans: 1 },
      goals: [
        { key: "springSoft", text: "<b>〰️ 무른 용수철</b>(10 N 에 10 cm)로 바꾸기" },
        { key: "stretch5",   text: "늘어난 길이를 <b>5 cm</b> 로 맞추기" }
      ],
      why: "<b>5 N</b> 입니다.<br>" +
           "10 N 에 10 cm 늘어나므로 이 용수철은 <b>1 N 마다 1 cm</b> 씩 늘어나요. " +
           "5 cm 늘어났으니 무게는 <b>5 N</b> 입니다.<br>" +
           "이렇게 <b>늘어난 길이를 재어 무게를 알아내는 도구</b>가 <b>용수철저울</b>입니다."
    }
  ];

  /* ---------------------------------------------------------
     2. 화면 만들기
     --------------------------------------------------------- */
  function layout() {
    if (!canvas) return;
    var r = canvas.getBoundingClientRect();
    cssW = Math.max(320, Math.round(r.width || 900));
    cssH = Math.max(200, Math.round(r.height || cssW / 1.62));
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function sceneKind() {
    if (S.scene === "mission") return S.mission ? S.mission.scene : "hand";
    return S.scene;
  }

  function draw() {
    if (!ctx) return;
    var g = ctx;
    var grad = g.createLinearGradient(0, 0, 0, cssH);
    grad.addColorStop(0, "#0b1220"); grad.addColorStop(1, "#1e293b");
    g.fillStyle = grad; g.fillRect(0, 0, cssW, cssH);
    var k = sceneKind();
    if (k === "hand") drawHand(g);
    else if (k === "hang") drawHang(g);
    else drawGauge(g);
  }

  /* 가로 용수철 하나 — 왼쪽 x1 에서 오른쪽 x2 까지 */
  function coilH(g, x1, x2, y, turns) {
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 2.5;
    g.beginPath();
    var n = 160;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var x = x1 + (x2 - x1) * t;
      var yy = y + Math.sin(t * turns * Math.PI * 2) * 14;
      if (i === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }

  function arrowH(g, x, y, len, dir, col, label) {
    if (len < 1) return;
    g.strokeStyle = col; g.lineWidth = 5; g.lineCap = "round";
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + dir * len, y); g.stroke();
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x + dir * (len + 10), y);
    g.lineTo(x + dir * len, y - 7);
    g.lineTo(x + dir * len, y + 7);
    g.closePath(); g.fill();
    g.lineCap = "butt";
    if (label) {
      g.fillStyle = col; g.font = "bold 13px sans-serif"; g.textAlign = "center";
      g.fillText(label, x + dir * len / 2, y - 14);
    }
  }

  /* ---- 장면 ① 누르고 당기기 ----
     학습지 4쪽의 ①②. 준 힘과 탄성력이 **같은 눈금**으로 그려진다. */
  function drawHand(g) {
    var applied = S.hand;
    var press = (S.way === "press");
    var el = E.elasticForce(applied, press ? 1 : -1);   // 누를 때 손은 안쪽(+), 당길 때 바깥쪽(−)

    var cy = cssH * 0.42;
    var natural = Math.min(cssW * 0.30, 230);
    /* 변형량을 그림에 반영 — 누르면 짧아지고 당기면 길어진다.
       변형 픽셀은 준 힘에 정비례한다(눈금 고정). */
    var maxN = 6;
    var maxDeform = natural * 0.42;
    var deform = (applied / maxN) * maxDeform;
    var len = natural + (press ? -deform : +deform);
    var x1 = cssW * 0.5 - len / 2, x2 = cssW * 0.5 + len / 2;

    /* 벽 대신 양쪽에 손 */
    coilH(g, x1, x2, cy, 9);
    g.font = "34px sans-serif"; g.textAlign = "center";
    g.fillText("🤚", x1 - 22, cy + 12);
    g.fillText("🤚", x2 + 22, cy + 12);

    /* 원래 길이 표시 */
    var nx1 = cssW * 0.5 - natural / 2, nx2 = cssW * 0.5 + natural / 2;
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    [nx1, nx2].forEach(function (x) {
      g.beginPath(); g.moveTo(x, cy - 46); g.lineTo(x, cy + 46); g.stroke();
    });
    g.setLineDash([]);
    g.fillStyle = COL.faint; g.font = "12px sans-serif"; g.textAlign = "center";
    g.fillText("원래 길이", cssW * 0.5, cy - 54);

    /* 두 화살표 — **같은 눈금** */
    var room = Math.min(cssW * 0.18, 140);
    var pxPerN = room / maxN;
    var ay = cy + 74;
    /* 손이 주는 힘 : 누를 때는 안쪽, 당길 때는 바깥쪽 */
    var handDir = press ? +1 : -1;
    arrowH(g, x1 - 8, ay, applied * pxPerN, handDir, COL.hand, null);
    arrowH(g, x2 + 8, ay, applied * pxPerN, -handDir, COL.hand, null);
    g.fillStyle = COL.hand; g.font = "bold 13px sans-serif"; g.textAlign = "center";
    if (applied > 0.05) g.fillText("손이 주는 힘 " + fmt(applied) + " N", cssW * 0.5, ay + 26);

    /* 탄성력 : 언제나 반대 */
    var ey = cy - 74;
    arrowH(g, x1 - 8, ey, el.size * pxPerN, -handDir, COL.elastic, null);
    arrowH(g, x2 + 8, ey, el.size * pxPerN, handDir, COL.elastic, null);
    g.fillStyle = COL.elastic; g.font = "bold 13px sans-serif"; g.textAlign = "center";
    if (el.size > 0.05) g.fillText("탄성력 " + fmt(el.size) + " N", cssW * 0.5, ey - 18);

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText(press ? "🤏 양쪽에서 누르고 있다" : "↔️ 양쪽에서 당기고 있다", 16, 26);
    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif";
    g.fillText(applied > 0.05
      ? "탄성력은 준 힘과 크기가 같고 방향이 반대다"
      : "슬라이더를 밀어 힘을 줘 보세요", 16, 50);

    if (applied > 0.05) {
      g.fillStyle = "#fde047"; g.font = "bold 15px sans-serif"; g.textAlign = "center";
      g.fillText("두 화살표의 길이가 같다 → 탄성력 = 준 힘", cssW * 0.5, cssH - 16);
    }
  }

  /* ---- 장면 ② 추를 매달면 (학습지 5쪽) ----
     늘어난 픽셀이 cm 에 정비례한다. 눈금은 고정. */
  function drawHang(g) {
    var st = E.state(S.pieces, S.spring);
    var topY = cssH * 0.12;
    var sx = cssW * 0.28;

    /* 천장 */
    g.strokeStyle = COL.line; g.lineWidth = 4;
    g.beginPath(); g.moveTo(sx - 56, topY); g.lineTo(sx + 56, topY); g.stroke();

    /* 눈금 — **가장 많이 늘어나는 경우**로 고정한다(무른 용수철 · 추 8개 = 8 cm).
       ⚠ 0.46 으로 잡았더니 추 8개를 매달았을 때 추 더미가 무대 아래로 나갔다.
          추가 쌓일 자리와 이름표 자리를 남겨 0.34 로 줄였다(검증에서 걸렸다). */
    var FULL_CM = 8;
    var pxPerCm = (cssH * 0.34) / FULL_CM;
    var over = st.stretchCm > FULL_CM;
    var coil = Math.min(st.stretchCm, FULL_CM) * pxPerCm;
    var natural = cssH * 0.16;
    var len = natural + coil;

    /* 세로 용수철 */
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 2.5;
    g.beginPath();
    var n = 140;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var yy = topY + len * t;
      var xx = sx + Math.sin(t * 8 * Math.PI * 2) * 13;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();

    /* 추 — 개수만큼 쌓는다 */
    var wTop = topY + len;
    for (var k = 0; k < S.pieces; k++) {
      g.fillStyle = "#64748b";
      roundRect(g, sx - 17, wTop + k * 13, 34, 12, 3); g.fill();
      g.strokeStyle = "rgba(226,232,240,.5)"; g.lineWidth = 1;
      roundRect(g, sx - 17, wTop + k * 13, 34, 12, 3); g.stroke();
    }
    if (S.pieces > 0) {
      g.fillStyle = COL.ink; g.font = "bold 13px sans-serif"; g.textAlign = "center";
      g.fillText(S.pieces + "개 · " + fmt(st.weightN, 0) + " N", sx, wTop + S.pieces * 13 + 20);
      /* 추에 작용하는 두 힘 (학습지 5쪽 첫 물음) — **추 더미 옆에** 그린다.
         아래에 그리면 추가 많을 때 무대 밖으로 나간다(검증에서 걸렸다).
         두 힘은 평형이므로 길이를 같게 그린다. */
      var midY = wTop + S.pieces * 13 / 2;
      var half = 17;
      g.lineCap = "round";
      /* 중력 ↓ */
      g.strokeStyle = COL.hand; g.lineWidth = 3;
      g.beginPath(); g.moveTo(sx + 46, midY - half); g.lineTo(sx + 46, midY + half); g.stroke();
      g.fillStyle = COL.hand;
      g.beginPath();
      g.moveTo(sx + 46, midY + half + 8);
      g.lineTo(sx + 41, midY + half); g.lineTo(sx + 51, midY + half);
      g.closePath(); g.fill();
      /* 탄성력 ↑ — 같은 길이, 반대 방향 */
      g.strokeStyle = COL.elastic;
      g.beginPath(); g.moveTo(sx + 84, midY + half); g.lineTo(sx + 84, midY - half); g.stroke();
      g.fillStyle = COL.elastic;
      g.beginPath();
      g.moveTo(sx + 84, midY - half - 8);
      g.lineTo(sx + 79, midY - half); g.lineTo(sx + 89, midY - half);
      g.closePath(); g.fill();
      g.lineCap = "butt";
      g.font = "11px sans-serif"; g.textAlign = "center";
      g.fillStyle = COL.hand; g.fillText("중력", sx + 46, midY + half + 22);
      g.fillStyle = COL.elastic; g.fillText("탄성력", sx + 84, midY - half - 14);
    }

    /* 늘어난 길이 자 */
    var zeroY = topY + natural;
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    g.beginPath(); g.moveTo(sx - 60, zeroY); g.lineTo(sx + 40, zeroY); g.stroke();
    g.setLineDash([]);
    g.fillStyle = COL.faint; g.font = "12px sans-serif"; g.textAlign = "right";
    g.fillText("원래 길이", sx - 66, zeroY + 4);
    if (coil > 1) {
      g.strokeStyle = COL.elastic; g.lineWidth = 2;
      g.beginPath(); g.moveTo(sx - 44, zeroY); g.lineTo(sx - 44, zeroY + coil); g.stroke();
      [zeroY, zeroY + coil].forEach(function (yy) {
        g.beginPath(); g.moveTo(sx - 50, yy); g.lineTo(sx - 38, yy); g.stroke();
      });
      g.fillStyle = COL.elastic; g.font = "bold 14px sans-serif"; g.textAlign = "right";
      g.fillText(fmt(st.stretchCm) + " cm" + (over ? " ⚠ 눈금 밖" : ""), sx - 56, zeroY + coil / 2 + 5);
    }

    /* 오른쪽 : 학습지의 표 */
    var tx = cssW * 0.52, ty = cssH * 0.14, tw = cssW * 0.42;
    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif"; g.textAlign = "left";
    g.fillText("학습지의 실험표", tx, ty - 8);
    var rowH = Math.min(26, (cssH * 0.60) / (E.PAPER_TABLE.length + 1));
    E.PAPER_TABLE.forEach(function (p, i) {
      var y = ty + i * rowH;
      var on = (S.spring === "paper" && p.n === S.pieces);
      g.fillStyle = on ? "rgba(253,224,71,.22)" : "rgba(148,163,184,.10)";
      roundRect(g, tx, y, tw, rowH - 3, 4); g.fill();
      g.fillStyle = on ? "#fde047" : COL.ink;
      g.font = (on ? "bold " : "") + "13px sans-serif"; g.textAlign = "left";
      g.fillText(p.n + " N", tx + 10, y + rowH * 0.62);
      g.textAlign = "right";
      g.fillText(p.cm.toFixed(1) + " cm", tx + tw - 10, y + rowH * 0.62);
    });

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("🪝 " + st.springName + " · 추 한 개 = 1 N", 16, 26);
    if (S.pieces > 6 && S.spring === "paper") {
      g.fillStyle = "#fde047"; g.font = "bold 13px sans-serif";
      g.fillText("표에 없는 값 — 비례 관계로 예측한 값입니다", 16, 48);
    }
  }

  /* ---- 장면 ③ 용수철저울 ----
     늘어난 길이를 재어 거꾸로 무게를 알아낸다. */
  function drawGauge(g) {
    var sp = E.spring(S.spring);
    var w = E.weightFromStretch(S.stretch, S.spring);

    var topY = cssH * 0.12, sx = cssW * 0.32;
    var FULL_CM = 10;
    var pxPerCm = (cssH * 0.52) / FULL_CM;
    var coil = Math.min(S.stretch, FULL_CM) * pxPerCm;
    var natural = cssH * 0.12;

    g.strokeStyle = COL.line; g.lineWidth = 4;
    g.beginPath(); g.moveTo(sx - 56, topY); g.lineTo(sx + 56, topY); g.stroke();

    /* 눈금자 — 1 cm 마다 */
    g.strokeStyle = "rgba(148,163,184,.55)"; g.lineWidth = 1;
    g.font = "11px sans-serif"; g.textAlign = "right";
    for (var c = 0; c <= FULL_CM; c++) {
      var y = topY + natural + c * pxPerCm;
      g.beginPath(); g.moveTo(sx + 30, y); g.lineTo(sx + 42, y); g.stroke();
      if (c % 2 === 0) {
        g.fillStyle = COL.faint;
        g.fillText(c + " cm", sx + 74, y + 4);
      }
    }

    /* 용수철 */
    var len = natural + coil;
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 2.5;
    g.beginPath();
    var n = 140;
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var yy = topY + len * t;
      var xx = sx + Math.sin(t * 8 * Math.PI * 2) * 13;
      if (i === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
    }
    g.stroke();

    /* 매단 물건 */
    g.font = "30px sans-serif"; g.textAlign = "center";
    g.fillText("🧰", sx, topY + len + 30);

    /* 바늘 */
    g.strokeStyle = "#f87171"; g.lineWidth = 2.5;
    var py = topY + natural + coil;
    g.beginPath(); g.moveTo(sx + 26, py); g.lineTo(sx + 46, py); g.stroke();

    /* 값 상자 */
    var bx = cssW * 0.60, by = cssH * 0.24, bw = cssW * 0.34;
    g.fillStyle = "rgba(15,23,42,.75)";
    g.strokeStyle = "rgba(148,163,184,.45)"; g.lineWidth = 1.5;
    roundRect(g, bx, by, bw, 138, 10); g.fill(); g.stroke();
    g.textAlign = "left";
    g.fillStyle = COL.ink; g.font = "bold 15px sans-serif";
    g.fillText(sp.emoji + " " + sp.name, bx + 14, by + 26);
    g.fillStyle = COL.faint; g.font = "13px sans-serif";
    g.fillText("1 N 마다 " + sp.cmPerN + " cm 늘어난다", bx + 14, by + 48);
    g.fillStyle = COL.elastic; g.font = "bold 16px sans-serif";
    g.fillText("늘어난 길이 " + fmt(S.stretch) + " cm", bx + 14, by + 78);
    g.fillStyle = "#fde047"; g.font = "bold 19px sans-serif";
    g.fillText("→ 무게 " + fmt(w) + " N", bx + 14, by + 108);

    g.fillStyle = COL.faint; g.font = "14px sans-serif"; g.textAlign = "left";
    g.fillText("⚖️ 늘어난 길이를 재면 무게를 알 수 있다", 16, 26);
    g.fillStyle = COL.ink; g.font = "bold 14px sans-serif";
    g.fillText("무게 = 늘어난 길이 ÷ (1 N 당 늘어나는 길이)", 16, 50);
  }

  /* ---------------------------------------------------------
     3. 계기판
     --------------------------------------------------------- */
  function setBar(id, val, full) {
    $(id).querySelector(".bar-fill").style.width = clamp(val / full * 100, 0, 100) + "%";
  }
  function barText(id, t) { $(id).querySelector(".bar-val").textContent = t; }
  function ro(i, name, val, unit) {
    $("roName" + i).textContent = name; $("roVal" + i).textContent = val;
    $("roUnit" + i).textContent = unit || "";
  }

  function updatePanel() {
    var k = sceneKind();
    $("rowB").classList.remove("hidden");

    if (k === "hang") {
      var st = E.state(S.pieces, S.spring);
      var fullCm = 8;
      $("gaugeTitle").textContent = "🪝 추를 매달면";
      $("gaugeSub").innerHTML = "늘어난 길이는 무게에 <b>비례</b>";
      $("barName1").textContent = "무게";
      $("barName2").textContent = "늘어난 길이";
      setBar("barA", st.weightN, 8); barText("barA", fmt(st.weightN, 0) + " N");
      setBar("barB", st.stretchCm, fullCm); barText("barB", fmt(st.stretchCm) + " cm");
      ro(1, "추", S.pieces, " 개");
      ro(2, "무게", fmt(st.weightN, 0), " N");
      ro(3, "늘어난 길이", fmt(st.stretchCm), " cm");
      ro(4, st.measured ? "표에 있는 값" : "예측한 값", st.measured ? "실측" : "비례로", "");
      $("fLaw").innerHTML = '늘어난 길이 = <span class="k">' + st.cmPerN +
                            '</span> cm × <span class="t">무게(N)</span>';
      $("fWhy").innerHTML = st.pieces > 0
        ? '<em>1 N 마다 약 <b>' + st.cmPerN + ' cm</b> — 무게에 <b>비례</b>해서 늘어난다</em>'
        : '<em>추를 하나씩 매달아 보세요</em>';

    } else if (k === "gauge") {
      var w = E.weightFromStretch(S.stretch, S.spring);
      var sp = E.spring(S.spring);
      $("gaugeTitle").textContent = "⚖️ 용수철저울";
      $("gaugeSub").innerHTML = "늘어난 길이로 <b>무게</b>를 안다";
      $("barName1").textContent = "늘어난 길이";
      $("barName2").textContent = "알아낸 무게";
      setBar("barA", S.stretch, 10); barText("barA", fmt(S.stretch) + " cm");
      setBar("barB", w, 20); barText("barB", fmt(w) + " N");
      ro(1, "늘어난 길이", fmt(S.stretch), " cm");
      ro(2, "1 N 당", sp.cmPerN, " cm");
      ro(3, "알아낸 무게", fmt(w), " N");
      ro(4, "용수철", sp.name, "");
      $("fLaw").innerHTML = '무게 = <span class="k">늘어난 길이</span> ÷ <span class="t">' +
                            sp.cmPerN + '</span> = ' + fmt(S.stretch) + ' ÷ ' + sp.cmPerN +
                            ' = <span class="k">' + fmt(w) + ' N</span>';
      $("fWhy").innerHTML = '<em>용수철저울은 <b>무게 또는 힘</b>을 재는 도구다</em>';

    } else {
      var el = E.elasticForce(S.hand, S.way === "press" ? 1 : -1);
      $("gaugeTitle").textContent = "🤏 두 힘";
      $("gaugeSub").innerHTML = "탄성력은 준 힘과 <b>크기가 같다</b>";
      $("barName1").textContent = "준 힘";
      $("barName2").textContent = "탄성력";
      setBar("barA", S.hand, 6); barText("barA", fmt(S.hand) + " N");
      setBar("barB", el.size, 6); barText("barB", fmt(el.size) + " N");
      ro(1, "준 힘", fmt(S.hand), " N");
      ro(2, "탄성력", fmt(el.size), " N");
      ro(3, "변형", S.way === "press" ? "줄었다" : "늘었다", "");
      ro(4, "방향", "준 힘과 반대", "");
      $("fLaw").innerHTML = '탄성력 = <span class="k">준 힘</span> · 방향은 <span class="t">반대</span>';
      $("fWhy").innerHTML = S.hand > 0.05
        ? '<em>많이 변형될수록 탄성력이 <b>크다</b> — 두 막대의 길이가 언제나 같다</em>'
        : '<em>슬라이더를 밀어 힘을 줘 보세요</em>';
    }

    $("graphTitle").textContent = "📈 무게와 늘어난 길이";
    $("graphSub").innerHTML = "원점을 지나는 직선 — 비례";
    $("tip").textContent = tipText();
    syncMissionGoals();
  }

  function tipText() {
    var k = sceneKind();
    if (k === "hang") return "추를 하나씩 늘리며 표와 견주어 보세요";
    if (k === "gauge") return "늘어난 길이를 바꿔 무게를 읽어 보세요";
    return "누르거나 당겨 보세요 — 두 화살표를 보세요";
  }

  /* ---------------------------------------------------------
     4. 그래프 — 학습지 4쪽의 '표를 그래프로'
        실험표의 점과 이상적인 직선을 함께 그린다.
     --------------------------------------------------------- */
  function drawGraph() {
    var c = $("graph");
    if (!c) return;
    var r = c.getBoundingClientRect();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = Math.max(200, Math.round(r.width)), h = Math.max(100, Math.round(r.height));
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    var g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
    var pad = 34;
    g.strokeStyle = "#cbd5e1"; g.lineWidth = 1;
    g.beginPath(); g.moveTo(pad, h - pad); g.lineTo(w - 8, h - pad);
    g.moveTo(pad, 8); g.lineTo(pad, h - pad); g.stroke();

    var maxN = 8, maxCm = 8;
    function X(n) { return pad + (w - pad - 10) * clamp(n / maxN, 0, 1); }
    function Y(cm) { return (h - pad) - (h - pad - 10) * clamp(cm / maxCm, 0, 1); }

    /* 지금 고른 용수철의 직선 — 원점을 지난다 */
    var sp = E.spring(S.spring);
    g.strokeStyle = "#0ea5e9"; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(X(0), Y(0)); g.lineTo(X(maxN), Y(E.stretchCm(maxN, S.spring))); g.stroke();

    /* 학습지 실험표의 점 */
    if (S.spring === "paper") {
      E.PAPER_TABLE.forEach(function (p) {
        g.fillStyle = (sceneKind() === "hang" && p.n === S.pieces) ? "#dc2626" : "#7dd3fc";
        g.beginPath();
        g.arc(X(p.n), Y(p.cm), (sceneKind() === "hang" && p.n === S.pieces) ? 6 : 4, 0, Math.PI * 2);
        g.fill();
      });
    }
    /* 표 밖의 값(예측)은 빈 동그라미로 */
    if (sceneKind() === "hang" && S.spring === "paper" && S.pieces > 6) {
      var st = E.state(S.pieces, S.spring);
      g.strokeStyle = "#dc2626"; g.lineWidth = 2;
      g.beginPath(); g.arc(X(S.pieces), Y(st.stretchCm), 6, 0, Math.PI * 2); g.stroke();
    }

    g.fillStyle = "#64748b"; g.font = "12px sans-serif"; g.textAlign = "center";
    g.fillText("추의 무게 (N) →", w / 2, h - 8);
    g.save(); g.translate(12, h / 2); g.rotate(-Math.PI / 2);
    g.fillText("← 늘어난 길이 (cm)", 0, 0); g.restore();
  }

  /* ---------------------------------------------------------
     5. 조작 패널
     --------------------------------------------------------- */
  function syncControls() {
    var k = sceneKind();
    var allow = (S.scene === "mission" && S.mission) ? S.mission.allow : null;
    document.querySelectorAll("[data-for]").forEach(function (el) {
      var scenes = el.getAttribute("data-for").split(/\s+/);
      var need = el.getAttribute("data-need");
      var okScene = scenes.indexOf(S.scene) >= 0 || scenes.indexOf(k) >= 0;
      var okNeed = true;
      if (S.scene === "mission" && need) okNeed = allow && allow.indexOf(need) >= 0;
      el.classList.toggle("hidden", !(okScene && okNeed));
    });
    $("missionCard").classList.toggle("hidden", S.scene !== "mission");
    $("valHand").textContent = fmt(S.hand) + " N";
    $("valPieces").textContent = S.pieces + " 개";
    $("valStretch").textContent = fmt(S.stretch) + " cm";
  }

  function setChips(id, val) {
    var w = $(id); if (!w) return;
    w.querySelectorAll(".chip").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-val") === String(val));
    });
  }

  /* ---------------------------------------------------------
     6. 미션
     --------------------------------------------------------- */
  function loadProgress() {
    try { return JSON.parse(sessionStorage.getItem("el_missions") || "[]"); } catch (e) { return []; }
  }
  function saveProgress(l) { try { sessionStorage.setItem("el_missions", JSON.stringify(l)); } catch (e) {} }

  function renderMissionList() {
    var done = loadProgress(), host = $("missionList");
    host.innerHTML = "";
    MISSIONS.forEach(function (M) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mcard" + (S.mission && S.mission.id === M.id ? " on" : "") +
                    (done.indexOf(M.id) >= 0 ? " done" : "");
      b.innerHTML = '<span class="mno">미션 ' + M.id + (done.indexOf(M.id) >= 0 ? " ✅" : "") + '</span>' +
                    '<span class="mtitle"><span class="mstar">' + M.star + '</span> ' + M.title + '</span>';
      b.addEventListener("click", function () { pickMission(M); });
      host.appendChild(b);
    });
    $("missionScore").textContent = done.length + " / " + MISSIONS.length;
  }

  function pickMission(M) {
    S.scene = "mission";
    $("scenes").querySelectorAll(".scene-btn").forEach(function (x) {
      x.classList.toggle("on", x.getAttribute("data-scene") === "mission");
    });
    S.mission = M; S.predictPick = null;
    S.missionState = M.predict ? "predict" : "ready";
    Object.keys(M.setup || {}).forEach(function (kk) { S[kk] = M.setup[kk]; });
    seen = { ways: {}, hands: {}, pieces: {}, springs: {}, stretchSet: {} };
    $("rngHand").value = S.hand; $("rngPieces").value = S.pieces; $("rngStretch").value = S.stretch;
    setChips("chipWay", S.way); setChips("chipSpring", S.spring);
    syncControls(); renderMissionList(); renderMissionBody(); refresh();
  }

  function renderMissionBody() {
    var M = S.mission, body = $("missionBody");
    if (!M) { body.classList.add("hidden"); return; }
    body.classList.remove("hidden");
    $("mTitle").textContent = M.star + " 미션 " + M.id + " · " + M.title;
    $("mStory").innerHTML = M.story;

    var pd = $("mPredict");
    if (M.predict && S.missionState === "predict") {
      pd.classList.remove("hidden");
      $("mQ").innerHTML = M.predict.q;
      var opts = $("mOpts"); opts.innerHTML = "";
      M.predict.opts.forEach(function (t, i) {
        var b = document.createElement("button");
        b.type = "button"; b.className = "opt"; b.innerHTML = t;
        b.addEventListener("click", function () {
          S.predictPick = i; S.missionState = "ready"; renderMissionBody();
        });
        opts.appendChild(b);
      });
    } else pd.classList.add("hidden");

    var gl = $("mGoals");
    if (M.goals && S.missionState !== "predict") {
      gl.classList.remove("hidden");
      gl.innerHTML = '<div class="q">목표</div>' + M.goals.map(function (gg) {
        var ok = checkGoal(gg.key);
        return '<div class="goal' + (ok ? " ok" : "") + '">' + (ok ? "✅ " : "⬜ ") + gg.text + '</div>';
      }).join("");
    } else gl.classList.add("hidden");

    var vd = $("mVerdict");
    if (S.missionState === "won") {
      vd.className = "verdict ok";
      vd.innerHTML = "<b>🎉 성공!</b>" + M.why +
        (M.predict && S.predictPick != null
          ? "<br><br>" + (S.predictPick === M.predict.ans
              ? "예측도 <b>맞았습니다.</b> 잘했어요!"
              : "예측은 달랐지만 <b>직접 확인해서 알아냈습니다.</b> 그것이 더 중요해요.")
          : "");
      vd.classList.remove("hidden");
    } else if (S.missionState === "predict") vd.classList.add("hidden");
    else {
      vd.className = "verdict no";
      vd.innerHTML = "<b>직접 확인하세요</b>목표를 모두 채우면 이유가 열립니다.";
      vd.classList.remove("hidden");
    }
  }

  function checkGoal(key) {
    switch (key) {
      case "pressed": return !!seen.ways.press;
      case "pulled": return !!seen.ways.pull;
      case "twoHands": return Object.keys(seen.hands).length >= 2;
      case "piece4": return !!seen.pieces[4];
      case "piece7": return !!seen.pieces[7];
      case "springSoft": return !!seen.springs.soft;
      case "stretch5": return !!seen.stretchSet["5.0"];
      default: return false;
    }
  }

  function noteSeen() {
    var k = sceneKind();
    if (k === "hand") {
      /* 힘을 실제로 준 상태만 센다 — 0 N 은 '해 본 것'이 아니다 */
      if (S.hand > 0.05) { seen.ways[S.way] = true; seen.hands[fmt(S.hand)] = true; }
    }
    if (k === "hang") seen.pieces[S.pieces] = true;
    if (k === "gauge") {
      seen.springs[S.spring] = true;
      if (S.stretch > 0) seen.stretchSet[fmt(S.stretch)] = true;
    }
  }

  function syncMissionGoals() {
    if (S.scene !== "mission" || !S.mission || S.missionState === "predict") return;
    var M = S.mission;
    if (!M.goals) return;
    var all = M.goals.every(function (gg) { return checkGoal(gg.key); });
    if (all && S.missionState !== "won") {
      S.missionState = "won";
      var done = loadProgress();
      if (done.indexOf(M.id) < 0) { done.push(M.id); saveProgress(done); }
      renderMissionList(); renderMissionBody();
    } else if (S.missionState !== "won") {
      var gl = $("mGoals");
      if (!gl.classList.contains("hidden")) {
        var rows = gl.querySelectorAll(".goal");
        M.goals.forEach(function (gg, i) {
          if (!rows[i]) return;
          var ok = checkGoal(gg.key);
          rows[i].className = "goal" + (ok ? " ok" : "");
          rows[i].innerHTML = (ok ? "✅ " : "⬜ ") + gg.text;
        });
      }
    }
  }

  /* ---------------------------------------------------------
     7. 실험 기록
     --------------------------------------------------------- */
  function addRecord() {
    var st = E.state(S.pieces, S.spring);
    records.push({
      spring: E.spring(S.spring).emoji + " " + st.springName,
      pieces: S.pieces + "개",
      w: fmt(st.weightN, 0) + " N",
      cm: fmt(st.stretchCm) + " cm"
    });
    renderRecords();
    window.PdfKit.toast("기록했습니다. (" + records.length + "번째)", "ok");
  }

  function renderRecords() {
    var body = $("recBody");
    body.innerHTML = "";
    records.forEach(function (r, i) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td>" + (i + 1) + "</td><td>" + r.spring + "</td><td>" + r.pieces +
                     "</td><td>" + r.w + "</td><td><b>" + r.cm + "</b></td>";
      body.appendChild(tr);
    });
    $("recEmpty").classList.toggle("hidden", records.length > 0);
  }

  function refresh() { noteSeen(); draw(); updatePanel(); drawGraph(); }

  /* ---------------------------------------------------------
     8. 연결
     --------------------------------------------------------- */
  function bindChips(id, fn) {
    var w = $(id); if (!w) return;
    w.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".chip") : null;
      if (!b) return;
      w.querySelectorAll(".chip").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      fn(b.getAttribute("data-val"));
    });
  }

  function bind() {
    $("scenes").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".scene-btn") : null;
      if (!b) return;
      $("scenes").querySelectorAll(".scene-btn").forEach(function (x) { x.classList.remove("on"); });
      b.classList.add("on");
      S.scene = b.getAttribute("data-scene");
      if (S.scene === "mission" && !S.mission) pickMission(MISSIONS[0]);
      else { syncControls(); refresh(); }
      renderMissionList();
    });

    $("btnReset").addEventListener("click", function () {
      S.hand = 0; S.way = "press"; S.pieces = 0; S.spring = "paper"; S.stretch = 0;
      $("rngHand").value = 0; $("rngPieces").value = 0; $("rngStretch").value = 0;
      setChips("chipWay", "press"); setChips("chipSpring", "paper");
      syncControls(); refresh();
    });
    $("btnRecord").addEventListener("click", addRecord);
    $("btnClearRec").addEventListener("click", function () {
      if (!records.length) return;
      if (!confirm("기록을 모두 지울까요?")) return;
      records.length = 0; renderRecords();
    });

    $("rngHand").addEventListener("input", function () { S.hand = parseFloat(this.value); syncControls(); refresh(); });
    $("rngPieces").addEventListener("input", function () { S.pieces = parseInt(this.value, 10); syncControls(); refresh(); });
    $("rngStretch").addEventListener("input", function () { S.stretch = parseFloat(this.value); syncControls(); refresh(); });
    bindChips("chipWay", function (v) { S.way = v; refresh(); });
    bindChips("chipSpring", function (v) { S.spring = v; refresh(); });

    if (window.ResizeObserver) {
      new ResizeObserver(function () { layout(); draw(); drawGraph(); }).observe(canvas);
    } else {
      window.addEventListener("resize", function () { layout(); draw(); drawGraph(); });
    }
  }

  function boot() {
    canvas = $("stage");
    layout(); bind(); syncControls();
    renderMissionList(); renderRecords(); refresh();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.ElLab = {
    S: S, MISSIONS: MISSIONS,
    _test: {
      set: function (k, v) { S[k] = v; syncControls(); refresh(); },
      scene: function (n) { S.scene = n; syncControls(); refresh(); },
      pick: function (id) { pickMission(MISSIONS[id - 1]); },
      answer: function (i) { S.predictPick = i; S.missionState = "ready"; renderMissionBody(); refresh(); },
      goals: function () {
        if (!S.mission || !S.mission.goals) return null;
        return S.mission.goals.map(function (gg) { return [gg.key, checkGoal(gg.key)]; });
      },
      state: function () { return S.missionState; },
      records: function () { return records; },
      draw: function () { draw(); return true; }
    }
  };
})();
