(() => {
  // ------------------------------------------------------------------
  // DOM
  // ------------------------------------------------------------------
  const viewCanvas = document.getElementById('view');
  const miniCanvas = document.getElementById('minimap');
  const ctx = viewCanvas.getContext('2d');
  const mctx = miniCanvas.getContext('2d');

  const statusEl    = document.getElementById('status');
  const lapEl       = document.getElementById('lap');
  const speedEl     = document.getElementById('speed');
  const timeEl      = document.getElementById('time');
  const countdownEl = document.getElementById('countdown');
  const countdownWrap = document.getElementById('countdown-wrap');
  const countdownSub = document.getElementById('countdown-sub');
  const accelBtn    = document.getElementById('accel');
  const resultEl    = document.getElementById('result');
  const resultTitle = document.getElementById('result-title');
  const resultDesc  = document.getElementById('result-desc');
  const resultScene = document.getElementById('result-scene');
  const resultEmoji = document.getElementById('result-emoji');
  const restartBtn  = document.getElementById('restart');

  // ------------------------------------------------------------------
  // Canvas sizing (Retina crisp)
  // ------------------------------------------------------------------
  let W = 0, H = 0, DPR = 1;
  function resize() {
    DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    W = viewCanvas.clientWidth || window.innerWidth;
    H = viewCanvas.clientHeight || window.innerHeight;
    viewCanvas.width = W * DPR;
    viewCanvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    const mw = miniCanvas.clientWidth;
    const mh = miniCanvas.clientHeight;
    miniCanvas.width = mw * DPR;
    miniCanvas.height = mh * DPR;
    mctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);

  // ------------------------------------------------------------------
  // Track — closed loop of centerline points
  // ------------------------------------------------------------------
  const TRACK_LEN = 360;      // segments in one lap
  const LAPS = 3;
  const trackPoints = [];     // {x,y} minimap coords for each segment index
  const trackCurves = [];     // signed curvature at each segment (used by pseudo-3D)

  function buildTrack() {
    trackPoints.length = 0;
    trackCurves.length = 0;
    // "living-room" shape: rounded rectangle with two bumps
    for (let i = 0; i < TRACK_LEN; i++) {
      const t = (i / TRACK_LEN) * Math.PI * 2;
      const rx = 220 + Math.sin(t * 2) * 20;
      const ry = 130 + Math.cos(t * 3) * 12;
      trackPoints.push({ x: Math.cos(t) * rx, y: Math.sin(t) * ry });
    }
    // curvature = signed cross of consecutive tangent vectors
    for (let i = 0; i < TRACK_LEN; i++) {
      const p0 = trackPoints[(i - 1 + TRACK_LEN) % TRACK_LEN];
      const p1 = trackPoints[i];
      const p2 = trackPoints[(i + 1) % TRACK_LEN];
      const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y;
      const dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
      trackCurves.push(dx1 * dy2 - dy1 * dx2);
    }
  }

  // ------------------------------------------------------------------
  // Game state
  // ------------------------------------------------------------------
  const CAT_LIST = [
    { name: '나비',   color: '#e4a672', emoji: '🐱' },
    { name: '고등어', color: '#7ec4cf', emoji: '😸' },
    { name: '치즈',   color: '#f2c94c', emoji: '😺' },
    { name: '까망이', color: '#5a4a4a', emoji: '😼' },
    { name: '삼색이', color: '#d9a5b3', emoji: '😻' },
  ];

  let state;
  function initState() {
    state = {
      phase: 'countdown',      // 'countdown' | 'racing' | 'finished'
      countdown: 5,
      timeElapsed: 0,
      accelerating: false,
      winner: null,
      player: null,
      racers: [],
    };
    // Player
    state.player = {
      name: '집사',
      color: '#5b8def',
      emoji: '🧑',
      isPlayer: true,
      pos: 0,
      speed: 0,
      lane: 0,
      lap: 1,
      finished: false,
      finishTime: 0,
    };
    state.racers.push(state.player);
    // Cats
    CAT_LIST.forEach((cat, i) => {
      state.racers.push({
        ...cat,
        isPlayer: false,
        pos: 0,
        speed: 0,
        lane: (i - 2) * 0.18,                 // fixed lane offset in [-0.36, +0.36]
        lap: 1,
        finished: false,
        finishTime: 0,
        aiMax:   0.85 + Math.random() * 0.20, // per-cat top speed (0.85–1.05)
        aiAggr:  0.6 + Math.random() * 0.6,   // how quickly they reach top
        aiWave:  Math.random() * Math.PI * 2, // phase for speed variation
      });
    });
  }

  // ------------------------------------------------------------------
  // Constants for physics
  // ------------------------------------------------------------------
  const MAX_SPEED   = 42;   // segments / second (units for progress)
  const ACCEL       = 24;   // segments / second^2
  const DRAG        = 0.55; // exponential decay coefficient
  const KMH_SCALE   = 5.2;  // displayed km/h = speed * this

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------
  function update(dt) {
    if (state.phase === 'countdown') {
      state.countdown -= dt;
      const shown = Math.max(0, Math.ceil(state.countdown));
      if (shown > 0) {
        countdownEl.textContent = shown;
        countdownSub.textContent = shown === 1 ? '곧 출발!' : '준비하세요!';
      } else {
        countdownEl.textContent = 'GO!';
        countdownSub.textContent = '달려!';
      }
      if (state.countdown <= -0.6) {
        state.phase = 'racing';
        countdownWrap.classList.add('hidden');
      }
      return;
    }

    if (state.phase !== 'racing') return;
    state.timeElapsed += dt;

    // --- Player ---
    const p = state.player;
    if (!p.finished) {
      const a = state.accelerating ? ACCEL : 0;
      p.speed += a * dt;
      p.speed -= p.speed * DRAG * dt;
      if (p.speed > MAX_SPEED) p.speed = MAX_SPEED;
      if (p.speed < 0) p.speed = 0;
      p.pos += p.speed * dt;
    } else {
      p.speed *= Math.pow(0.02, dt); // coast to a stop
    }

    // --- AI cats ---
    for (const r of state.racers) {
      if (r.isPlayer || r.finished) continue;
      // Slight sinusoidal + random variation so it's never robotic
      r.aiWave += dt * 1.5;
      const target = MAX_SPEED * (r.aiMax + Math.sin(r.aiWave) * 0.05);
      r.speed += (target - r.speed) * r.aiAggr * dt;
      if (r.speed < 0) r.speed = 0;
      r.pos += r.speed * dt;
    }

    // --- Laps & finish ---
    const finishPos = TRACK_LEN * LAPS;
    for (const r of state.racers) {
      const lap = Math.min(LAPS, Math.floor(r.pos / TRACK_LEN) + 1);
      if (lap > r.lap) r.lap = lap;
      if (!r.finished && r.pos >= finishPos) {
        r.finished = true;
        r.finishTime = state.timeElapsed;
        r.pos = finishPos;
        if (!state.winner) state.winner = r;
      }
    }

    // End when the winner has crossed
    if (state.winner) {
      // Give a short beat so player sees themselves crossing if they win
      if (state.timeElapsed - state.winner.finishTime > 0.4) {
        state.phase = 'finished';
        showResult();
      }
    }
  }

  // ------------------------------------------------------------------
  // Rendering — pseudo-3D first-person view
  // ------------------------------------------------------------------
  function render() {
    // ---- Sky / room background ----
    // Wall gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    wallGrad.addColorStop(0, '#f7d6b2');
    wallGrad.addColorStop(1, '#e8b787');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, W, H * 0.5);

    // Picture frame + window on the wall (parallax with curvature)
    drawRoomDecor();

    // Floor gradient (carpet zone)
    const floorGrad = ctx.createLinearGradient(0, H * 0.5, 0, H);
    floorGrad.addColorStop(0, '#c9a878');
    floorGrad.addColorStop(1, '#8a6033');
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, H * 0.5, W, H * 0.5);

    // ---- Pseudo-3D road ----
    const player = state.player;
    const playerPosMod = ((player.pos % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
    const baseIdx = Math.floor(playerPosMod);
    const frac    = playerPosMod - baseIdx;

    // Aggregate upcoming curvature — closer segments weighted more
    const LOOK = 28;
    let curveSum = 0;
    for (let i = 1; i <= LOOK; i++) {
      const idx = (baseIdx + i) % TRACK_LEN;
      const w = (LOOK - i + 1) / LOOK;
      curveSum += trackCurves[idx] * w;
    }
    const curvature = curveSum * 0.0018; // tune

    const horizonY  = H * 0.48;
    const roadWTop  = Math.max(24, W * 0.06);
    const roadWBot  = W * 0.98;

    // Draw road with alternating stripes (movement)
    const stripes = 60;
    for (let s = 0; s < stripes; s++) {
      const f0 = s / stripes;
      const f1 = (s + 1) / stripes;
      // Perspective: z (0=far, 1=near). Use non-linear to spread near stripes.
      const z0 = Math.pow(f0, 2.2);
      const z1 = Math.pow(f1, 2.2);
      const y0 = horizonY + (H - horizonY) * z0;
      const y1 = horizonY + (H - horizonY) * z1;
      const w0 = roadWTop + (roadWBot - roadWTop) * z0;
      const w1 = roadWTop + (roadWBot - roadWTop) * z1;
      const off0 = curvature * Math.pow(1 - z0, 1.6) * 320;
      const off1 = curvature * Math.pow(1 - z1, 1.6) * 320;
      const cx0 = W / 2 - off0;
      const cx1 = W / 2 - off1;

      // Alternating stripe based on player progress
      const stripePhase = Math.floor((player.pos * 4 + (1 - z0) * 30)) % 2;

      ctx.beginPath();
      ctx.moveTo(cx0 - w0 / 2, y0);
      ctx.lineTo(cx0 + w0 / 2, y0);
      ctx.lineTo(cx1 + w1 / 2, y1);
      ctx.lineTo(cx1 - w1 / 2, y1);
      ctx.closePath();
      ctx.fillStyle = stripePhase ? '#f2d3a5' : '#e5c091';
      ctx.fill();

      // Red edge strips
      const edgeW = Math.max(2, 6 * z0);
      ctx.fillStyle = '#ff6b6b';
      ctx.beginPath();
      ctx.moveTo(cx0 - w0 / 2, y0);
      ctx.lineTo(cx0 - w0 / 2 + edgeW, y0);
      ctx.lineTo(cx1 - w1 / 2 + edgeW, y1);
      ctx.lineTo(cx1 - w1 / 2, y1);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx0 + w0 / 2 - edgeW, y0);
      ctx.lineTo(cx0 + w0 / 2, y0);
      ctx.lineTo(cx1 + w1 / 2, y1);
      ctx.lineTo(cx1 + w1 / 2 - edgeW, y1);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Draw cats visible ahead ----
    const drawList = [];
    for (const r of state.racers) {
      if (r.isPlayer) continue;
      const dist = r.pos - player.pos; // positive = ahead
      if (dist > 0.2 && dist < 65) drawList.push({ dist, r });
    }
    drawList.sort((a, b) => b.dist - a.dist); // far first

    for (const { dist, r } of drawList) {
      const f = 1 - dist / 65;              // 0 far, 1 near
      const z = Math.pow(f, 2.2);
      const y = horizonY + (H - horizonY) * z;
      const size = 18 + 130 * z;
      const off = curvature * Math.pow(1 - z, 1.6) * 320;
      const roadW = roadWTop + (roadWBot - roadWTop) * z;
      const cx = W / 2 - off + r.lane * roadW * 0.45;

      drawCat(cx, y, size, r.emoji, r.name, r.color);
    }

    // ---- Churu goal (visible on final lap when close to start line) ----
    drawChuruIfNear(playerPosMod, curvature, horizonY);

    // ---- First-person hands on wheel ----
    drawHandsAndWheel();

    // ---- Minimap ----
    drawMinimap();

    // ---- HUD text ----
    updateHUD();
  }

  function drawRoomDecor() {
    // Draw a sofa/window silhouette receding into distance; skewed by curvature
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    // window
    ctx.fillRect(W * 0.1, H * 0.15, W * 0.18, H * 0.18);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(W * 0.1, H * 0.15, W * 0.18, H * 0.18);
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 4;
    ctx.strokeRect(W * 0.1, H * 0.15, W * 0.18, H * 0.18);
    ctx.beginPath();
    ctx.moveTo(W * 0.19, H * 0.15); ctx.lineTo(W * 0.19, H * 0.33);
    ctx.moveTo(W * 0.10, H * 0.24); ctx.lineTo(W * 0.28, H * 0.24);
    ctx.stroke();

    // shelf
    ctx.fillStyle = '#8a6033';
    ctx.fillRect(W * 0.68, H * 0.35, W * 0.28, 8);
    // books
    const bookColors = ['#ff6b6b', '#ffd43b', '#51cf66', '#5b8def', '#e64980'];
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = bookColors[i];
      ctx.fillRect(W * 0.70 + i * W * 0.04, H * 0.30, W * 0.028, H * 0.05);
    }
    ctx.restore();
  }

  function drawCat(x, y, size, emoji, name, color) {
    // shadow
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.ellipse(x, y + size * 0.05, size * 0.45, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Kart body (rounded)
    ctx.fillStyle = color;
    const bodyW = size * 0.9;
    const bodyH = size * 0.45;
    const bx = x - bodyW / 2;
    const by = y - bodyH * 0.3;
    roundRect(bx, by, bodyW, bodyH, size * 0.15);
    ctx.fill();
    // wheels
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(bx + bodyW * 0.15, by + bodyH, size * 0.13, 0, Math.PI * 2);
    ctx.arc(bx + bodyW * 0.85, by + bodyH, size * 0.13, 0, Math.PI * 2);
    ctx.fill();

    // Cat sits on top
    ctx.font = `${size * 0.7}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(emoji, x, y - size * 0.15);

    // Name tag
    ctx.font = `bold ${Math.max(10, size * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(name, x, y + size * 0.55);
    ctx.fillStyle = '#fff';
    ctx.fillText(name, x, y + size * 0.55);
  }

  function drawChuruIfNear(playerPosMod, curvature, horizonY) {
    // Churu/finish line is at track index 0 — always AHEAD by (TRACK_LEN - playerPosMod).
    // Only draw once we're close enough to see it approaching.
    const distToLine = TRACK_LEN - playerPosMod;
    if (distToLine > 60 || distToLine < 0.5) return;
    if (state.player.finished) return;
    const onFinalLap = state.player.lap >= LAPS;

    const f = 1 - distToLine / 60;
    const z = Math.pow(f, 2.2);
    const y = horizonY + (H - horizonY) * z;
    const size = 30 + 220 * z;
    const off = curvature * Math.pow(1 - z, 1.6) * 320;
    const cx = W / 2 - off;

    // Draw finish banner
    ctx.save();
    ctx.globalAlpha = 0.4 + 0.6 * z;
    // Checkerboard banner
    const bw = size * 1.8, bh = size * 0.35;
    const bx = cx - bw / 2, by = y - size * 0.9;
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = ((i) % 2 === 0) ? '#fff' : '#000';
      ctx.fillRect(bx + (bw / 10) * i, by, bw / 10, bh / 2);
      ctx.fillStyle = ((i) % 2 === 0) ? '#000' : '#fff';
      ctx.fillRect(bx + (bw / 10) * i, by + bh / 2, bw / 10, bh / 2);
    }
    // Poles
    ctx.fillStyle = '#a06840';
    ctx.fillRect(bx - 4, by, 4, size * 0.9);
    ctx.fillRect(bx + bw, by, 4, size * 0.9);

    // Churu emoji as the goal
    ctx.font = `${size * 0.9}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🍥', cx, y - size * 0.05);
    if (onFinalLap && z > 0.15) {
      ctx.font = `bold ${Math.max(14, size * 0.22)}px sans-serif`;
      ctx.fillStyle = '#c92a2a';
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      const label = '츄르!';
      ctx.strokeText(label, cx, y + size * 0.55);
      ctx.fillText(label, cx, y + size * 0.55);
    }
    ctx.restore();
  }

  function drawHandsAndWheel() {
    // Steering wheel at bottom
    const wheelR = Math.min(W, H) * 0.28;
    const wx = W / 2;
    const wy = H + wheelR * 0.55;
    // wheel
    ctx.save();
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR * 0.72, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Hands (human, since player is 집사)
    const handSize = wheelR * 0.55;
    drawHand(wx - wheelR * 0.9, wy - wheelR * 0.25, handSize, 'L');
    drawHand(wx + wheelR * 0.9, wy - wheelR * 0.25, handSize, 'R');
  }

  function drawHand(x, y, size, side) {
    ctx.save();
    // sleeve
    ctx.fillStyle = '#5b8def';
    roundRect(x - size * 0.5, y + size * 0.1, size, size * 0.9, size * 0.15);
    ctx.fill();
    // palm
    ctx.fillStyle = '#f4d3b5';
    roundRect(x - size * 0.45, y - size * 0.35, size * 0.9, size * 0.7, size * 0.25);
    ctx.fill();
    // thumb
    ctx.beginPath();
    if (side === 'L') {
      ctx.ellipse(x + size * 0.35, y - size * 0.1, size * 0.12, size * 0.22, -0.4, 0, Math.PI * 2);
    } else {
      ctx.ellipse(x - size * 0.35, y - size * 0.1, size * 0.12, size * 0.22, 0.4, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ------------------------------------------------------------------
  // Minimap
  // ------------------------------------------------------------------
  function drawMinimap() {
    const w = miniCanvas.clientWidth;
    const h = miniCanvas.clientHeight;
    mctx.clearRect(0, 0, w, h);

    // bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of trackPoints) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const pad = 10;
    const scale = Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY));
    const ox = pad - minX * scale + ((w - pad * 2) - (maxX - minX) * scale) / 2;
    const oy = pad - minY * scale + ((h - pad * 2) - (maxY - minY) * scale) / 2;

    // Track band (thick outer + thin inner for road look)
    mctx.strokeStyle = 'rgba(255,255,255,0.15)';
    mctx.lineWidth = 10;
    mctx.beginPath();
    for (let i = 0; i <= trackPoints.length; i++) {
      const p = trackPoints[i % trackPoints.length];
      const x = p.x * scale + ox, y = p.y * scale + oy;
      if (i === 0) mctx.moveTo(x, y); else mctx.lineTo(x, y);
    }
    mctx.stroke();

    mctx.strokeStyle = '#ffd8a8';
    mctx.lineWidth = 3;
    mctx.stroke();

    // Churu at index 0
    const churu = trackPoints[0];
    mctx.fillStyle = '#ff9a9e';
    mctx.beginPath();
    mctx.arc(churu.x * scale + ox, churu.y * scale + oy, 4, 0, Math.PI * 2);
    mctx.fill();

    // Racers
    for (const r of state.racers) {
      const posMod = ((r.pos % TRACK_LEN) + TRACK_LEN) % TRACK_LEN;
      const idx = Math.floor(posMod) % TRACK_LEN;
      const p = trackPoints[idx];
      const x = p.x * scale + ox, y = p.y * scale + oy;
      mctx.fillStyle = r.color;
      mctx.beginPath();
      mctx.arc(x, y, r.isPlayer ? 5 : 3.5, 0, Math.PI * 2);
      mctx.fill();
      if (r.isPlayer) {
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 1.5;
        mctx.stroke();
      }
    }
  }

  // ------------------------------------------------------------------
  // HUD
  // ------------------------------------------------------------------
  function updateHUD() {
    const p = state.player;
    lapEl.textContent = `${Math.min(p.lap, LAPS)} / ${LAPS}`;
    speedEl.textContent = Math.round(p.speed * KMH_SCALE);
    timeEl.textContent = state.timeElapsed.toFixed(1);

    // Status pill
    if (state.phase === 'countdown') {
      setStatus('카운트다운', 'status-count');
    } else if (state.phase === 'racing') {
      if (p.lap >= LAPS) setStatus('마지막 바퀴! 츄르까지 전력질주', 'status-final');
      else if (p.lap === 2) setStatus('2바퀴째 — 힘내세요!', 'status-race');
      else setStatus('경주중 — 계속 눌러 가속!', 'status-race');
    } else if (state.phase === 'finished') {
      // set by showResult()
    }
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  // ------------------------------------------------------------------
  // Result screen
  // ------------------------------------------------------------------
  function showResult() {
    const w = state.winner;
    const playerWon = w && w.isPlayer;

    // Rank the player
    // If player finished, use finishTime; otherwise use remaining distance to a virtual finish
    const finishPos = TRACK_LEN * LAPS;
    const ranked = state.racers.slice().sort((a, b) => {
      const aDone = a.finished ? a.finishTime : 9999;
      const bDone = b.finished ? b.finishTime : 9999;
      if (aDone !== bDone) return aDone - bDone;
      return b.pos - a.pos;
    });
    const rank = ranked.indexOf(state.player) + 1;

    resultEl.classList.remove('hidden');
    if (playerWon) {
      resultEmoji.textContent = '🏆';
      resultTitle.textContent = '집사 승리!';
      resultDesc.textContent = `${w.finishTime.toFixed(1)}초에 결승선을 통과했어요. 츄르는 당신의 것!`;
      resultScene.innerHTML = '<span>🧑</span><span>🍥</span><span>😋</span>';
      setStatus('승리! 츄르 획득 🏆', 'status-win');
    } else {
      resultEmoji.textContent = '🐾';
      resultTitle.textContent = `${w.name}에게 츄르를 빼앗겼어요!`;
      resultDesc.textContent = `${w.name}(가) ${w.finishTime.toFixed(1)}초에 1등, 집사는 ${rank}등. 다시 도전!`;
      resultScene.innerHTML = `<span>${w.emoji}</span><span>🍥</span><span>😋</span>`;
      setStatus(`${rank}등 — 츄르는 다음 기회에`, 'status-lose');
    }
  }

  // ------------------------------------------------------------------
  // Input
  // ------------------------------------------------------------------
  function bindInput() {
    const press = (e) => {
      if (e) e.preventDefault();
      state.accelerating = true;
      accelBtn.classList.add('pressed');
    };
    const release = (e) => {
      if (e) e.preventDefault();
      state.accelerating = false;
      accelBtn.classList.remove('pressed');
    };
    // Touch
    accelBtn.addEventListener('touchstart', press,   { passive: false });
    accelBtn.addEventListener('touchend',   release, { passive: false });
    accelBtn.addEventListener('touchcancel',release, { passive: false });
    // Mouse
    accelBtn.addEventListener('mousedown', press);
    accelBtn.addEventListener('mouseup',   release);
    accelBtn.addEventListener('mouseleave',release);

    // Keyboard: space or arrow-up
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp') { press(e); }
      if (e.code === 'Enter' && state.phase === 'finished') restart();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { release(e); }
    });

    restartBtn.addEventListener('click', restart);
  }

  function restart() {
    resultEl.classList.add('hidden');
    countdownWrap.classList.remove('hidden');
    initState();
    setStatus('카운트다운', 'status-count');
  }

  // ------------------------------------------------------------------
  // Main loop
  // ------------------------------------------------------------------
  let last = 0;
  function loop(t) {
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  function boot() {
    resize();
    buildTrack();
    initState();
    countdownWrap.classList.remove('hidden');
    setStatus('카운트다운', 'status-count');
    bindInput();
    requestAnimationFrame(loop);
  }

  // Wait one tick so layout is settled (important for canvas sizing)
  window.addEventListener('load', boot);
})();
