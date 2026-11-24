'use strict';

(() => {
  const teal = '#17685e';
  const clay = '#9f452f';
  const ink = '#1c3336';
  const mid = '#637f77';
  const faint = '#a3b7ad';

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

  function arrow(ctx, x1, y1, x2, y2, colour, width = 4, tip = 13) {
    line(ctx, x1, y1, x2, y2, colour, width);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    for (const offset of [-0.53, 0.53]) {
      ctx.lineTo(x2 - tip * Math.cos(angle + offset), y2 - tip * Math.sin(angle + offset));
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
  }

  function dot(ctx, x, y, radius = 6, colour = ink) {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
  }

  function label(ctx, value, x, y, colour = ink, size = 25, align = 'left') {
    ctx.font = '700 ' + size + 'px "Microsoft JhengHei", Cambria, system-ui';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colour;
    ctx.fillText(value, x, y);
  }

  function curve(ctx, x1, x2, getY, colour, width = 4) {
    ctx.beginPath();
    ctx.moveTo(x1, getY(x1));
    for (let i = 1; i <= 100; i += 1) {
      const x = x1 + (x2 - x1) * i / 100;
      ctx.lineTo(x, getY(x));
    }
    ctx.strokeStyle = colour;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  function theta(ctx, x, y, dx, dy, radius, text, size) {
    const off = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.arc(x, y, radius, Math.min(off, 0), Math.max(off, 0));
    ctx.strokeStyle = mid;
    ctx.lineWidth = 1.8;
    ctx.stroke();
    label(ctx, text, x + radius + 10, y + Math.sign(dy) * radius * 0.34, ink, size);
  }

  function oblique(ctx) {
    const x = 147, y = 286, dx = 305, dy = -174;
    arrow(ctx, 82, y, 569, y, faint, 2, 10);
    arrow(ctx, x, 332, x, 55, faint, 2, 10);
    label(ctx, '+x', 584, y, mid, 21);
    label(ctx, '+y', x + 11, 43, mid, 21);
    line(ctx, x + dx, y, x + dx, y + dy, faint, 2, [6, 5]);
    line(ctx, x, y + dy, x + dx, y + dy, faint, 2, [6, 5]);
    arrow(ctx, x, y, x, y + dy, clay, 5, 16);
    arrow(ctx, x, y, x + dx, y, teal, 5, 16);
    arrow(ctx, x, y, x + dx, y + dy, ink, 5, 16);
    theta(ctx, x, y, dx, dy, 89, 'θ', 24);
    dot(ctx, x, y);
    label(ctx, 'u', x + dx + 15, y + dy - 10, ink, 30);
    label(ctx, 'uₓ', x + dx / 2, y + 30, teal, 27, 'center');
    label(ctx, 'uᵧ', x - 27, y + dy / 2, clay, 27, 'right');
  }

  function sameHeight(ctx) {
    const peak = 325;
    const pathY = x => 77 + 0.00288 * (x - peak) ** 2;
    const a = 167, b = 483, height = pathY(a);
    line(ctx, 74, height, 581, height, faint, 2, [7, 6]);
    curve(ctx, 53, 598, pathY, mid);
    for (const [x, y, endY] of [[a, height, height - 71], [peak, pathY(peak), pathY(peak)], [b, height, height + 71]]) {
      arrow(ctx, x, y, x + 78, endY, teal, 5, 15);
      dot(ctx, x, y, 7);
    }
    label(ctx, 'A', a - 27, height + 26, ink, 28);
    label(ctx, 'B', b - 24, height - 31, ink, 28);
    label(ctx, '最高點', peak, 41, ink, 28, 'center');
    label(ctx, '同一高度', 85, height - 25, mid, 21);
  }

  function freeBody(ctx) {
    dot(ctx, 144, 65, 13);
    arrow(ctx, 144, 65, 144, 152, clay, 5, 15);
    label(ctx, 'mg', 160, 117, clay, 25);
  }

  function velocity(ctx, event) {
    const dx = 142, dy = event === 'apex' ? 0 : event === 'launch' ? -82 : 82;
    const x = 66, y = event === 'launch' ? 137 : 83;
    const isLaunch = event === 'launch';
    const xLabel = isLaunch ? 'uₓ' : 'vₓ';
    if (dy) {
      line(ctx, x + dx, y, x + dx, y + dy, faint, 1.8, [5, 5]);
      line(ctx, x, y + dy, x + dx, y + dy, faint, 1.8, [5, 5]);
      arrow(ctx, x, y, x, y + dy, clay, 4);
      arrow(ctx, x, y, x + dx, y + dy, ink, 4);
      theta(ctx, x, y, dx, dy, 44, '30°', 17);
      label(ctx, isLaunch ? 'uᵧ' : 'vᵧ', x - 13, y + dy / 2, clay, 24, 'right');
      label(ctx, isLaunch ? 'u' : 'v', x + dx + 14, y + dy, ink, 27);
    } else {
      label(ctx, 'vᵧ = 0', 136, 141, clay, 26, 'center');
    }
    arrow(ctx, x, y, x + dx, y, teal, event === 'range' ? 6 : 4);
    label(ctx, xLabel, x + dx / 2, y + (dy < 0 ? 24 : -23), teal, 27, 'center');
    dot(ctx, x, y, 7);
  }

  function angleRange(ctx) {
    const x0 = 94, bottom = 293, width = 485, top = 78;
    arrow(ctx, x0, bottom, 610, bottom, mid, 2.5);
    arrow(ctx, x0, bottom, x0, 57, mid, 2.5);
    label(ctx, '相對射程', 87, 33, mid, 22, 'center');
    label(ctx, '投射角 θ', 587, 352, mid, 22, 'right');
    const xAt = degrees => x0 + width * degrees / 90;
    const yAt = x => bottom - (bottom - top) * Math.sin(Math.PI * (x - x0) / width);
    line(ctx, x0, top, xAt(45), top, faint, 1.8, [5, 5]);
    label(ctx, '1', x0 - 16, top, mid, 19, 'right');
    curve(ctx, x0, xAt(90), yAt, teal, 5);
    for (const degrees of [0, 30, 45, 60, 90]) {
      const x = xAt(degrees), y = yAt(x);
      if (degrees > 0 && degrees < 90) line(ctx, x, y, x, bottom, faint, 1.8, [5, 5]);
      dot(ctx, x, y, degrees === 45 ? 8 : 5, degrees === 45 ? clay : teal);
      label(ctx, degrees + '°', x, bottom + 23, degrees === 45 ? clay : ink, 23, 'center');
    }
  }

  function energyGraph(ctx) {
    const x0 = 86, x1 = 538, y0 = 297, y1 = 64, center = (x0 + x1) / 2;
    arrow(ctx, x0, y0, 609, y0, mid, 2.3);
    arrow(ctx, x0, y0, x0, 40, mid, 2.3);
    label(ctx, '能量', 87, 22, mid, 21, 'center');
    label(ctx, '時間', 610, y0 + 22, mid, 21, 'right');
    line(ctx, center, y1, center, y0, faint, 2, [6, 6]);
    line(ctx, x0, y1, x1, y1, ink, 3);
    const pe = x => {
      const t = (x - x0) / (x1 - x0);
      return 0.59 * 4 * t * (1 - t);
    };
    curve(ctx, x0, x1, x => y0 - (y0 - y1) * pe(x), clay);
    curve(ctx, x0, x1, x => y1 + (y0 - y1) * pe(x), teal);
    label(ctx, 'ME', x1 + 10, y1 - 13, ink, 22);
    label(ctx, 'KE', x1 + 10, y1 + 21, teal, 22);
    label(ctx, 'PE', x1 + 10, y0 - 15, clay, 22);
    label(ctx, '最高點', center, y0 + 25, mid, 22, 'center');
  }

  const diagrams = {
    oblique,
    'equal-height': sameHeight,
    force: freeBody,
    'launch-velocity': ctx => velocity(ctx, 'launch'),
    'apex-velocity': ctx => velocity(ctx, 'apex'),
    'landing-velocity': ctx => velocity(ctx, 'landing'),
    'range-velocity': ctx => velocity(ctx, 'range'),
    'angle-range': angleRange,
    'energy-graph': energyGraph,
  };
  for (const canvas of document.querySelectorAll('canvas[data-diagram]')) {
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.width * ratio);
    canvas.height = Math.round(canvas.height * ratio);
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    diagrams[canvas.dataset.diagram](context);
  }

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clipOn = slide => slide?.querySelector('video[data-demo]');
  const labOn = slide => slide?.querySelector('.lab-embed');
  const played = new WeakSet();
  let timer;

  function play(clip) {
    clip.muted = true;
    clip.play().catch(() => {
      // The native controls remain available if the browser requires a click.
    });
  }

  for (const clip of document.querySelectorAll('video[data-demo]')) {
    const figure = clip.closest('figure');
    clip.addEventListener('play', () => played.add(clip));
    figure.querySelector('[data-replay]').addEventListener('click', () => {
      clearTimeout(timer);
      clip.currentTime = 0;
      play(clip);
    });

    const advance = figure.querySelector('[data-advance]');
    if (!advance) continue;
    const freezes = Array.from(figure.querySelectorAll('[data-freeze]'));
    let frame;

    const selectFreeze = (selected) => {
      for (const button of freezes) button.setAttribute('aria-pressed', String(button === selected));
    };
    const updateAdvance = () => {
      advance.textContent = !clip.paused ? '暫停' : clip.ended ? '從頭播放' : clip.currentTime > 0 ? '繼續播放' : '播放';
    };
    const stopAt = (button) => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
      played.add(clip);
      clip.pause();
      clip.currentTime = Number(button.dataset.freeze);
      selectFreeze(button);
      updateAdvance();
    };
    const watchSegment = () => {
      cancelAnimationFrame(frame);
      if (clip.paused || clip.seeking) return;
      const next = freezes.find(button => Number(button.dataset.freeze) > clip.currentTime + 0.04);
      if (!next) return;
      const stopTime = Number(next.dataset.freeze);
      function checkTime() {
        if (clip.paused || clip.seeking) return;
        if (clip.currentTime >= stopTime) stopAt(next);
        else frame = requestAnimationFrame(checkTime);
      }
      frame = requestAnimationFrame(checkTime);
    };
    advance.addEventListener('click', () => {
      clearTimeout(timer);
      if (clip.paused) {
        if (clip.ended) clip.currentTime = 0;
        play(clip);
      } else {
        clip.pause();
      }
    });
    clip.addEventListener('play', () => {
      selectFreeze(null);
      updateAdvance();
      watchSegment();
    });
    clip.addEventListener('pause', () => {
      if (clip.paused) cancelAnimationFrame(frame);
      updateAdvance();
    });
    clip.addEventListener('ended', updateAdvance);
    clip.addEventListener('seeked', () => {
      selectFreeze(clip.paused ? freezes.find(button => Math.abs(clip.currentTime - Number(button.dataset.freeze)) < 0.04) : null);
      updateAdvance();
      watchSegment();
    });
    for (const button of freezes) {
      button.addEventListener('click', () => stopAt(button));
    }
  }

  function canAutoplay() {
    return !document.hidden && !reducedMotion.matches && !Reveal.isOverview() &&
      !Reveal.isPaused() && !Reveal.isSpeakerNotes() && !Reveal.isPrintView();
  }

  function cue(slide) {
    clearTimeout(timer);
    const clip = clipOn(slide);
    if (!clip || played.has(clip) || !canAutoplay()) return;
    timer = setTimeout(() => {
      if (slide === Reveal.getCurrentSlide() && !played.has(clip) && canAutoplay()) play(clip);
    }, 400);
  }

  function pauseSlide(slide) {
    clearTimeout(timer);
    clipOn(slide)?.pause();
    labOn(slide)?.contentWindow?.postMessage('slide:stop', '*');
  }

  window.addEventListener('message', event => {
    const lab = labOn(Reveal.getCurrentSlide());
    if (!lab || event.source !== lab.contentWindow || event.data?.type !== 'lab-slide-navigation') return;
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
    keyboardCondition: event => !event.target?.closest?.('video') &&
      !(event.code === 'Space' && event.target?.closest?.('button, a')),
    plugins: [RevealNotes],
  });
  Reveal.on('ready', ({ currentSlide }) => cue(currentSlide));
  Reveal.on('slidechanged', ({ previousSlide, currentSlide }) => {
    pauseSlide(previousSlide);
    const lab = labOn(previousSlide);
    if (lab && document.activeElement === lab) lab.blur();
    cue(currentSlide);
  });
  const pauseCurrent = () => pauseSlide(Reveal.getCurrentSlide());
  const cueCurrent = () => cue(Reveal.getCurrentSlide());
  Reveal.on('overviewshown', pauseCurrent);
  Reveal.on('overviewhidden', cueCurrent);
  Reveal.on('paused', pauseCurrent);
  Reveal.on('resumed', cueCurrent);
  document.addEventListener('visibilitychange', () => document.hidden ? pauseCurrent() : cueCurrent());
  reducedMotion.addEventListener('change', () => reducedMotion.matches ? pauseCurrent() : cueCurrent());
})();
