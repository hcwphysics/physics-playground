'use strict';

(() => {
  const gravity = 9.81;
  const teal = '#17685e';
  const clay = '#a04431';
  const ink = '#1c3336';
  const muted = '#526a65';
  const gridRule = '#dfe9e3';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Positions are in canvas pixels. The velocity components and g are in SI units.
  function projectile(x, y, vx, vy, pixelsPerMetre) {
    return (time) => ({
      x: x + pixelsPerMetre * vx * time,
      y: y + pixelsPerMetre * (0.5 * gravity * time ** 2 - vy * time),
    });
  }

  function line(ctx, x1, y1, x2, y2, colour, width = 2, dash = []) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function dot(ctx, x, y, radius, colour, rim = '') {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    if (rim) {
      ctx.strokeStyle = rim;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  function arrow(ctx, x1, y1, x2, y2, colour, width) {
    line(ctx, x1, y1, x2, y2, colour, width);
    const turn = Math.atan2(y2 - y1, x2 - x1);
    const size = width * 2.3 + 3;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    for (const offset of [-0.53, 0.53]) {
      ctx.lineTo(x2 - size * Math.cos(turn + offset), y2 - size * Math.sin(turn + offset));
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  function label(ctx, text, x, y, colour = ink, align = 'left') {
    ctx.font = '700 21px "Microsoft JhengHei", "PingFang HK", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    ctx.fillStyle = colour;
    ctx.fillText(text, x, y);
  }

  function grid(ctx, x, y, width, height, spacing = 27) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 12);
    ctx.fillStyle = '#f5faf6';
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    for (let column = x + spacing; column < x + width; column += spacing) {
      ctx.moveTo(column, y);
      ctx.lineTo(column, y + height);
    }
    for (let row = y + spacing; row < y + height; row += spacing) {
      ctx.moveTo(x, row);
      ctx.lineTo(x + width, row);
    }
    ctx.lineWidth = 1;
    ctx.strokeStyle = gridRule;
    ctx.stroke();
    ctx.restore();
  }

  function trace(ctx, pointAt, time, colour, width = 3, dash = []) {
    ctx.beginPath();
    for (let i = 0; i <= 48; i += 1) {
      const { x, y } = pointAt(time * i / 48);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const typeFloor = 243;
  const typeScale = 61;
  const launchTypes = [
    { x: 216, y: 238, vx: 0, vy: 7 },
    { x: 492, y: 70, vx: 4.8, vy: 0 },
    { x: 925, y: 238, vx: 3.55, vy: 7 },
  ].map(({ x, y, vx, vy }) => ({
    pointAt: projectile(x, y, vx, vy, typeScale),
    end: (vy + Math.sqrt(vy ** 2 + 2 * gravity * (typeFloor - y) / typeScale)) / gravity,
    vx,
    vy,
  }));

  function drawPaths(ctx, time) {
    launchTypes.forEach(({ pointAt, end, vx, vy }, index) => {
      const left = index * 432 + 6;
      grid(ctx, left, 4, 420, 268);
      line(ctx, left + 14, typeFloor, left + 406, typeFloor, '#849b8e');
      const flightTime = Math.min(time, end);
      trace(ctx, pointAt, flightTime, teal, 4);
      const start = pointAt(0);
      const position = pointAt(flightTime);
      if (time === 0) {
        arrow(ctx, start.x, start.y, start.x + vx * 12, start.y - vy * 12, teal, 4);
      } else {
        dot(ctx, start.x, start.y, 5, '#8cb6a8');
      }
      dot(ctx, position.x, position.y, 11, teal, '#fffefa');
    });
  }

  const forceVelocityY = 5.3;
  const forceDuration = 2 * forceVelocityY / gravity;
  const forceInterval = forceDuration / 6;
  const forcePoint = projectile(117, 270, 5.3, forceVelocityY, 118);

  function drawForce(ctx, time) {
    grid(ctx, 0, 0, 900, 389);
    trace(ctx, forcePoint, forceDuration, '#879a8d', 2.3, [7, 7]);
    trace(ctx, forcePoint, time, '#497d70');
    for (let snapshot = 0; snapshot < time - 0.028; snapshot += forceInterval) {
      const { x, y } = forcePoint(snapshot);
      arrow(ctx, x, y + 11, x, y + 70, '#b98171', 3.5);
      dot(ctx, x, y, 6, '#91b5a9');
    }
    const { x, y } = forcePoint(time);
    arrow(ctx, x, y + 11, x, y + 70, clay, 5);
    dot(ctx, x, y, 12, teal, '#fffefa');
    ctx.fillStyle = clay;
    ctx.font = 'italic 700 28px Cambria, Georgia, serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('mg', x + 16, y + 53);
  }

  const pairInterval = 0.1;
  const pairEnd = { near: 0.4, far: 0.6 };
  const pairStartHeight = 64;
  const pairPoint = projectile(98, pairStartHeight, 8, 0, 124);

  function drawPair(ctx, time, distance) {
    grid(ctx, 0, 0, 900, 352, 24);
    const meetingTime = pairEnd[distance];
    const targetX = pairPoint(meetingTime).x;
    const { x, y } = pairPoint(time);
    line(ctx, 36, 316, 864, 316, '#849b8e');
    line(ctx, 62, pairStartHeight, targetX, pairStartHeight, '#839b90', 2, [7, 5]);
    label(ctx, '起點高度', 98, 35, muted);
    trace(ctx, pairPoint, time, '#639487', 2.6);
    line(ctx, targetX, pairStartHeight, targetX, y, '#b67462', 2.6);

    for (let snapshot = 0; snapshot < time - 0.022; snapshot += pairInterval) {
      const point = pairPoint(snapshot);
      line(ctx, point.x, point.y, targetX, point.y, '#adc3b9', 1.6, [5, 5]);
      dot(ctx, point.x, point.y, 5, '#699c8e');
      dot(ctx, targetX, point.y, 5, '#ba8475');
    }
    line(ctx, x, y, targetX, y, '#587a6f', 2.9, [7, 5]);
    dot(ctx, targetX, y, 13, '#fff5e9', clay);
    dot(ctx, x, y, x === targetX ? 8 : 12, teal, '#fffefa');

    if (y - pairStartHeight > 23) {
      const bracketX = 821;
      line(ctx, targetX + 18, pairStartHeight, bracketX, pairStartHeight, '#928a75', 1.6, [5, 5]);
      line(ctx, targetX + 18, y, bracketX, y, '#928a75', 1.6, [5, 5]);
      line(ctx, bracketX, pairStartHeight, bracketX, y, clay);
      for (const height of [pairStartHeight, y]) {
        line(ctx, bracketX - 7, height, bracketX + 7, height, clay, 2);
      }
      label(ctx, '下落量', bracketX - 13, (y + pairStartHeight) / 2, clay, 'right');
    }
    if (time === meetingTime) label(ctx, '空中相遇', x - 17, y + 27, ink, 'right');
  }

  const spacingInterval = 0.2;
  const spacingDuration = 6 * spacingInterval;
  const spacingX = (time) => 114 + 580 * time / spacingDuration;

  function drawSpacing(ctx, time) {
    grid(ctx, 0, 0, 810, 147, 29);
    const y = 87;
    label(ctx, '每隔 0.20 s 留下一點', 27, 23, muted);
    arrow(ctx, 74, y, 750, y, '#819f93', 2.2);
    const frames = Math.floor((time + 1e-7) / spacingInterval);
    for (let i = 0; i <= frames; i += 1) {
      const x = spacingX(i * spacingInterval);
      label(ctx, String(i + 1), x, y - 28, teal, 'center');
      dot(ctx, x, y, 7, '#6ba196', '#fffefa');
      if (i > 0) {
        const previous = spacingX((i - 1) * spacingInterval);
        line(ctx, previous + 5, y + 28, x - 5, y + 28, teal);
        line(ctx, previous + 5, y + 23, previous + 5, y + 28, teal);
        line(ctx, x - 5, y + 23, x - 5, y + 28, teal);
      }
    }
    dot(ctx, spacingX(time), y, 11, teal, '#fffefa');
  }

  const combinationDuration = 1.2;
  const combinationInterval = 0.2;
  const combinationPoint = projectile(151, 265, 4.9, 5.6, 113);

  function drawComponents(ctx, time) {
    grid(ctx, 0, 0, 900, 366, 26);
    const verticalAxis = 80;
    const horizontalAxis = 322;
    arrow(ctx, 42, horizontalAxis, 869, horizontalAxis, teal, 2.7);
    arrow(ctx, verticalAxis, 343, verticalAxis, 53, clay, 2.7);
    label(ctx, '垂直位置', 39, 28, clay);
    label(ctx, '水平位置', 858, 346, teal, 'right');
    trace(ctx, combinationPoint, combinationDuration, '#8a9f94', 2.2, [7, 7]);
    trace(ctx, combinationPoint, time, '#40685e', 3);

    for (let snapshot = 0; snapshot < time - 0.025; snapshot += combinationInterval) {
      const { x, y } = combinationPoint(snapshot);
      dot(ctx, x, y, 5, '#8dad9f');
      dot(ctx, x, horizontalAxis, 4.5, '#6ea193');
      dot(ctx, verticalAxis, y, 4.5, '#b98171');
    }
    const { x, y } = combinationPoint(time);
    line(ctx, verticalAxis, y, x, y, clay, 2.5, [7, 5]);
    line(ctx, x, horizontalAxis, x, y, teal, 2.5, [7, 5]);
    dot(ctx, x, horizontalAxis, 8, teal, '#fffefa');
    dot(ctx, verticalAxis, y, 8, clay, '#fffefa');
    dot(ctx, x, y, 11, ink, '#fffefa');
  }

  const seedPoint = projectile(542, 120, 4.61, 0, 137);

  function drawSeed(ctx, time) {
    if (time === 0) return;
    const { x, y } = seedPoint(time);
    trace(ctx, seedPoint, time, teal, 4, [8, 6]);
    dot(ctx, x, y, 10, '#a55a25', '#fffefa');
  }

  const motions = {
    paths: { width: 1296, height: 278, end: Math.max(...launchTypes.map(type => type.end)), interval: 0.2, rate: 0.43, draw: drawPaths },
    force: { width: 900, height: 389, end: forceDuration, interval: forceInterval, rate: 0.32, draw: drawForce },
    pair: { width: 900, height: 352, end: pairEnd.near, interval: pairInterval, rate: 0.14, draw: drawPair },
    spacing: { width: 810, height: 147, end: spacingDuration, interval: spacingInterval, rate: 0.3, draw: drawSpacing },
    components: { width: 900, height: 366, end: combinationDuration, interval: combinationInterval, rate: 0.27, draw: drawComponents },
    seed: { width: 1084, height: 572, end: 0.58, rate: 0.21, draw: drawSeed },
  };

  function attachMotion(root) {
    const key = root.dataset.motion;
    const model = motions[key];
    const canvas = root.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const toggle = root.querySelector('[data-action="toggle"]');
    const step = root.querySelector('[data-action="step"]');
    const timeDisplay = root.querySelector('[data-time]');
    const presets = root.querySelectorAll('[data-distance]');
    const playLabel = toggle.textContent;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(model.width * ratio);
    canvas.height = Math.round(model.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    let time = 0;
    let end = model.end;
    let distance = 'near';
    let frame = 0;
    let last;
    let autoplayTimer;
    let playbackHandled = false;

    function refreshButtons() {
      if (frame) toggle.textContent = '暫停';
      else if (reducedMotion.matches) toggle.textContent = '顯示完整軌跡';
      else if (time === end) toggle.textContent = '重播';
      else toggle.textContent = time > 0 ? '繼續' : playLabel;
      if (step) step.disabled = time === end;
    }

    function draw() {
      ctx.clearRect(0, 0, model.width, model.height);
      model.draw(ctx, time, distance);
      if (timeDisplay) {
        const value = 't = ' + time.toFixed(2) + ' s';
        if (timeDisplay.value !== value) timeDisplay.value = value;
      }
    }

    function pause() {
      clearTimeout(autoplayTimer);
      autoplayTimer = undefined;
      cancelAnimationFrame(frame);
      frame = 0;
      last = undefined;
      refreshButtons();
    }

    function seek(next) {
      playbackHandled = true;
      time = Math.min(next, end);
      pause();
      draw();
    }

    function tick(now) {
      if (last !== undefined) time = Math.min(end, time + (now - last) * model.rate / 1000);
      last = now;
      draw();
      if (time < end) frame = requestAnimationFrame(tick);
      else pause();
    }

    function play() {
      playbackHandled = true;
      if (time === end) time = 0;
      frame = requestAnimationFrame(tick);
      refreshButtons();
    }

    function scheduleAutoplay() {
      if (playbackHandled || autoplayTimer !== undefined || reducedMotion.matches) return;
      autoplayTimer = setTimeout(() => {
        autoplayTimer = undefined;
        if (!playbackHandled && !reducedMotion.matches && canAutoplay() && Reveal.getCurrentSlide()?.contains(root)) play();
      }, 480);
    }

    toggle.addEventListener('click', () => {
      if (frame) pause();
      else if (reducedMotion.matches) seek(end);
      else play();
    });
    step?.addEventListener('click', () => {
      const interval = model.interval;
      const nextFrame = Math.floor((time + 1e-7) / interval) + 1;
      seek(nextFrame * interval);
    });
    const reset = () => seek(0);
    root.querySelector('[data-action="reset"]').addEventListener('click', reset);
    for (const preset of presets) {
      preset.addEventListener('click', () => {
        distance = preset.dataset.distance;
        end = pairEnd[distance];
        for (const button of presets) {
          button.setAttribute('aria-pressed', String(button === preset));
        }
        reset();
      });
    }
    draw();
    refreshButtons();
    return {
      root, pause, scheduleAutoplay,
      hideReveal() {
        reset();
        playbackHandled = false;
      },
    };
  }

  const models = Array.from(document.querySelectorAll('[data-motion]'), attachMotion);
  const forestEmbed = document.querySelector('.forest-embed');
  const modelOn = (slide) => models.find(model => slide?.contains(model.root));

  function canAutoplay() {
    return !document.hidden && !Reveal.isOverview() && !Reveal.isPaused() &&
      !Reveal.isSpeakerNotes() && !Reveal.isPrintView();
  }

  function showMotion(slide) {
    const model = modelOn(slide);
    if (!model?.root.hasAttribute('data-motion-auto') || !canAutoplay()) return;
    const reveal = model.root.querySelector('[data-motion-reveal]');
    if (!reveal || reveal.classList.contains('visible')) model.scheduleAutoplay();
  }

  function pausePresentation() {
    models.forEach(model => model.pause());
    if (Reveal.getCurrentSlide()?.contains(forestEmbed)) {
      forestEmbed.contentWindow?.postMessage('slide:stop', '*');
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== forestEmbed.contentWindow || event.data?.type !== 'forest-slide-navigation' ||
        !Reveal.getCurrentSlide()?.contains(forestEmbed)) return;
    if (event.data.direction === 'ArrowRight') Reveal.next();
    if (event.data.direction === 'ArrowLeft') Reveal.prev();
  });

  Reveal.initialize({
    width: 1440,
    height: 810,
    minScale: 0.2,
    maxScale: 2.5,
    margin: 0,
    center: false,
    controls: true,
    controlsBackArrows: 'visible',
    progress: true,
    slideNumber: 'c/t',
    hash: true,
    transition: 'none',
    backgroundTransition: 'none',
    keyboardCondition: (event) => !(event.code === 'Space' && event.target?.closest?.('button, a')),
    plugins: [RevealNotes],
  });
  Reveal.on('ready', ({ currentSlide }) => showMotion(currentSlide));
  Reveal.on('slidechanged', ({ previousSlide, currentSlide }) => {
    modelOn(previousSlide)?.pause();
    showMotion(currentSlide);
  });
  Reveal.on('fragmentshown', ({ fragment }) => {
    if (fragment.hasAttribute('data-motion-reveal')) showMotion(Reveal.getCurrentSlide());
  });
  Reveal.on('fragmenthidden', ({ fragment }) => {
    if (fragment.hasAttribute('data-motion-reveal')) modelOn(Reveal.getCurrentSlide())?.hideReveal();
  });
  Reveal.on('overviewshown', pausePresentation);
  Reveal.on('overviewhidden', ({ currentSlide }) => showMotion(currentSlide));
  Reveal.on('paused', pausePresentation);
  Reveal.on('resumed', () => showMotion(Reveal.getCurrentSlide()));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pausePresentation();
    else showMotion(Reveal.getCurrentSlide());
  });
  reducedMotion.addEventListener('change', () => models.forEach(model => model.pause()));
})();
