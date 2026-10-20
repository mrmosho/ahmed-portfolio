document.documentElement.classList.add("js");
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

// Entrance timing: hero pieces paste on one by one, shines sweep out of sync
(() => {
  document.querySelectorAll(".wall__board > *").forEach((el, i) => el.style.setProperty("--i", i));
  document.querySelectorAll(".shine").forEach((el) => {
    el.style.setProperty("--shine-delay", `${(Math.random() * 6).toFixed(2)}s`);
    el.style.setProperty("--shine-every", `${(6 + Math.random() * 4).toFixed(2)}s`);
  });
})();

// Scroll reveal: things land on the wall as they come into view
(() => {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;
  if (calm || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-in"));
    return;
  }
  // Stagger siblings that arrive together
  items.forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
    el.style.setProperty("--rd", `${sibs.indexOf(el) * 90}ms`);
  });
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
  items.forEach((el) => io.observe(el));
})();

// Sparkle filter: twinkling four-point stars over the whole page, plus a trail behind the mouse
(() => {
  if (calm) return;
  const canvas = document.createElement("canvas");
  canvas.className = "sparkles";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const colors = ["#ffffff", "#fff3c4", "#f2b230", "#a8dcc9", "#ffd1d1"];
  let w, h, dpr, stars = [], trail = [], last = 0, running = true;

  const star = () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: 3 + Math.random() * 7,
    phase: Math.random() * Math.PI * 2,
    speed: 0.6 + Math.random() * 1.2,
    color: colors[(Math.random() * colors.length) | 0],
  });

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(46, Math.round((w * h) / 30000));
    stars = Array.from({ length: count }, star);
  };

  const draw = (x, y, r, color, alpha, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(255, 210, 110, .9)";
    ctx.shadowBlur = r * 2;
    ctx.beginPath();
    // four-point star: long thin rays with a pinched middle
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const len = i % 2 === 0 ? r : r * 0.22;
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  const tick = (t) => {
    if (!running) return;
    const s = t / 1000;
    ctx.clearRect(0, 0, w, h);
    stars.forEach((p, i) => {
      const wave = Math.sin(s * p.speed + p.phase);
      const a = wave > 0 ? Math.pow(wave, 4) : 0;
      // When a star has faded out, move it somewhere new
      if (a === 0 && Math.random() < 0.01) stars[i] = { ...star(), phase: p.phase };
      if (a > 0.01) draw(p.x, p.y, p.r * (0.5 + a * 0.5), p.color, a * 0.95, s * 0.6 + p.phase);
    });
    trail = trail.filter((p) => t - p.born < 750);
    trail.forEach((p) => {
      const k = (t - p.born) / 750;
      draw(p.x + p.vx * k * 30, p.y + p.vy * k * 30 + k * 14, p.r * (1 - k * 0.6), p.color, 1 - k, k * 3);
    });
    requestAnimationFrame(tick);
  };

  addEventListener("resize", resize);
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || e.timeStamp - last < 35) return;
    last = e.timeStamp;
    trail.push({
      x: e.clientX, y: e.clientY, born: performance.now(),
      vx: Math.random() - 0.5, vy: Math.random() - 0.5,
      r: 4 + Math.random() * 5, color: colors[(Math.random() * colors.length) | 0],
    });
  });
  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) requestAnimationFrame(tick);
  });
  resize();
  requestAnimationFrame(tick);
})();

// Draggable pieces: the hero wall on the home page, plus the pinned stickers on every page.
// Pinned stickers remember where you left them, so they stay put when you change pages.
(() => {
  const pieces = [...document.querySelectorAll(".drag")];
  if (!pieces.length) return;
  const KEY = "pins";
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch {} };

  const place = (el, x, y) => {
    el.style.setProperty("--dx", `${x}px`);
    el.style.setProperty("--dy", `${y}px`);
  };
  let top = 10;

  pieces.forEach((el) => {
    if (el.id && saved[el.id]) place(el, saved[el.id].x, saved[el.id].y);
    let startX, startY, baseX = 0, baseY = 0;

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      el.setPointerCapture(e.pointerId);
      el.classList.add("is-dragging");
      if (!el.classList.contains("pin")) el.style.zIndex = ++top;
      startX = e.clientX;
      startY = e.clientY;
      baseX = parseFloat(el.style.getPropertyValue("--dx")) || 0;
      baseY = parseFloat(el.style.getPropertyValue("--dy")) || 0;
    });

    el.addEventListener("pointermove", (e) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      place(el, baseX + e.clientX - startX, baseY + e.clientY - startY);
    });

    const drop = (e) => {
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      el.classList.remove("is-dragging");
      if (el.id) {
        saved[el.id] = {
          x: parseFloat(el.style.getPropertyValue("--dx")) || 0,
          y: parseFloat(el.style.getPropertyValue("--dy")) || 0,
        };
        save();
      }
    };
    el.addEventListener("pointerup", drop);
    el.addEventListener("pointercancel", drop);
  });

  const tidy = document.getElementById("tidy");
  if (tidy) {
    tidy.addEventListener("click", () => {
      pieces.forEach((el) => {
        el.style.removeProperty("--dx");
        el.style.removeProperty("--dy");
        if (!el.classList.contains("pin")) el.style.zIndex = "";
      });
      saved = {};
      save();
    });
  }
})();

// Work page: open the project's actual PDF
(() => {
  const dlg = document.getElementById("viewer");
  if (!dlg) return;
  const frame = document.getElementById("viewer-pdf");
  const title = document.getElementById("viewer-title");
  const open = document.getElementById("viewer-open");
  const download = document.getElementById("viewer-download");
  // Most phone browsers can't show a PDF inside a page, so send them straight to the file.
  const smallTouch = matchMedia("(pointer: coarse) and (max-width: 860px)");

  document.querySelectorAll("[data-pdf]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const src = btn.dataset.pdf;
      if (smallTouch.matches) {
        window.open(src, "_blank", "noopener");
        return;
      }
      title.textContent = btn.dataset.title;
      open.href = src;
      download.href = src;
      frame.src = `${src}#view=FitH`;
      dlg.showModal();
    });
  });

  const close = () => dlg.close();
  document.getElementById("viewer-close").addEventListener("click", close);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  // Unload the PDF so a big file stops using memory once it's closed
  dlg.addEventListener("close", () => { frame.src = "about:blank"; });
})();
