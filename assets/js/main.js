/* Storio Media — interactie & performance. Vanilla JS, geen dependencies. */
(function () {
  'use strict';
  var doc = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var conn = navigator.connection || {};
  var lowData = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  var canAutoplay = !reduceMotion && !lowData;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── Navigatie ─────────────────────────────────────────────────────────── */
  var nav = document.querySelector('.nav');
  function onScroll() { nav && nav.classList.toggle('is-solid', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var toggle = document.querySelector('.nav-toggle');
  function setMenu(open) {
    document.body.classList.toggle('menu-open', open);
    toggle && toggle.setAttribute('aria-expanded', String(open));
    var mm = document.getElementById('mobile-menu');
    if (mm) mm.inert = !open;
  }
  if (toggle) {
    setMenu(false);
    toggle.addEventListener('click', function () { setMenu(!document.body.classList.contains('menu-open')); });
    document.querySelectorAll('#mobile-menu a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
  }

  /* ── Reveal on scroll ──────────────────────────────────────────────────── */
  var revealEls = document.querySelectorAll('[data-reveal], .chips');
  if ('IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' });
    revealEls.forEach(function (el) { rio.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ── Lazy video: pas laden in beeld, pauzeren buiten beeld ─────────────── */
  function loadVideo(v) {
    if (v.dataset.loaded) return;
    v.querySelectorAll('source[data-src]').forEach(function (s) { s.src = s.dataset.src; });
    v.dataset.loaded = '1';
    v.load();
    v.addEventListener('playing', function () { v.classList.add('is-playing'); }, { once: true });
  }
  function tryPlay(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  var autoVideos = document.querySelectorAll('video[data-autoplay]');
  if (canAutoplay && 'IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting && !(modal && modal.open)) { loadVideo(v); tryPlay(v); }
        else if (v.dataset.loaded) { v.pause(); }
      });
    }, { rootMargin: '200px 0px', threshold: 0.01 });
    autoVideos.forEach(function (v) { vio.observe(v); });
  }

  // Hover-preview op case-cards (alleen desktop met muis)
  if (finePointer && !lowData) {
    document.querySelectorAll('[data-preview]').forEach(function (card) {
      var v = card.querySelector('video');
      if (!v) return;
      card.addEventListener('mouseenter', function () { loadVideo(v); v.currentTime = 0; tryPlay(v); });
      card.addEventListener('mouseleave', function () { v.pause(); });
    });
  }

  /* ── YouTube-showreel als stille achtergrond ───────────────────────────── */
  var ytFrames = [];
  function ytCommand(f, cmd) {
    try { f.contentWindow.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*'); } catch (err) {}
  }
  function startYouTubeBackgrounds() {
    document.querySelectorAll('[data-yt]').forEach(function (box) {
      var id = box.getAttribute('data-yt');
      var f = document.createElement('iframe');
      f.className = 'yt-bg';
      f.title = 'Showreel (achtergrond)';
      f.setAttribute('aria-hidden', 'true');
      f.tabIndex = -1;
      f.allow = 'autoplay; encrypted-media';
      f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=1&loop=1&playlist=' + id +
        '&controls=0&modestbranding=1&playsinline=1&rel=0&iv_load_policy=3&disablekb=1&enablejsapi=1';
      // pas tonen als de video echt loopt (voorkomt YouTube-laadscherm)
      f.addEventListener('load', function () { setTimeout(function () { f.classList.add('is-playing'); }, 1400); });
      box.insertBefore(f, box.querySelector('.play'));
      ytFrames.push(f);
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (en) {
          if (modal && modal.open) return;
          ytCommand(f, en[0].isIntersecting ? 'playVideo' : 'pauseVideo');
        }).observe(box);
      }
    });
  }
  if (canAutoplay && document.querySelector('[data-yt]')) {
    var kick = function () { (window.requestIdleCallback || setTimeout)(startYouTubeBackgrounds, { timeout: 1500 }); };
    if (document.readyState === 'complete') kick(); else window.addEventListener('load', kick, { once: true });
  }

  /* ── Modal: showreel, casevideo, lightbox ──────────────────────────────── */
  var modal = document.getElementById('modal');
  var stage = modal && modal.querySelector('.modal-stage');
  var lastFocus = null;

  function embedUrl(url) {
    var yt = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
    if (yt) return 'https://www.youtube-nocookie.com/embed/' + yt[1] + '?autoplay=1&rel=0&modestbranding=1';
    var vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (vm) return 'https://player.vimeo.com/video/' + vm[1] + '?autoplay=1&title=0&byline=0&portrait=0&dnt=1';
    return url;
  }

  function openModal(opts) {
    if (!modal) return;
    lastFocus = document.activeElement;
    stage.className = 'modal-stage';
    stage.innerHTML = '';
    if (opts.image) {
      stage.classList.add('modal-stage--img');
      var img = new Image();
      img.src = opts.image; img.alt = opts.alt || '';
      stage.appendChild(img);
    } else if (opts.embed) {
      var f = document.createElement('iframe');
      f.src = embedUrl(opts.embed);
      f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      f.allowFullscreen = true;
      f.title = opts.title || 'Video';
      stage.appendChild(f);
    } else if (opts.mp4) {
      var v = document.createElement('video');
      v.src = opts.mp4; v.controls = true; v.autoplay = true; v.playsInline = true;
      if (opts.poster) v.poster = opts.poster;
      stage.appendChild(v);
    } else {
      // Nog geen video beschikbaar: toon poster met nette melding
      if (opts.poster) { var p = new Image(); p.src = opts.poster; p.alt = ''; p.style.objectFit = 'cover'; stage.appendChild(p); }
      var e = document.createElement('div');
      e.className = 'modal-empty';
      e.innerHTML = '<div><p>Deze video staat binnenkort online.</p><small>Benieuwd? Vraag een persoonlijke preview aan via het contactformulier.</small></div>';
      stage.appendChild(e);
    }
    modal.querySelector('[data-fullscreen]').hidden = !(opts.mp4 || opts.embed);
    modal.showModal();
    document.body.style.overflow = 'hidden';
    // pauzeer achtergrondvideo's tijdens het kijken
    autoVideos.forEach(function (v) { v.pause(); });
    ytFrames.forEach(function (f) { ytCommand(f, 'pauseVideo'); });
  }

  function closeModal() {
    if (!modal || !modal.open) return;
    modal.close();
  }

  if (modal) {
    modal.addEventListener('close', function () {
      stage.innerHTML = '';
      document.body.style.overflow = '';
      if (lastFocus) lastFocus.focus();
      if (canAutoplay) autoVideos.forEach(function (v) { if (v.dataset.loaded && isVisible(v)) tryPlay(v); });
      ytFrames.forEach(function (f) { if (isVisible(f)) ytCommand(f, 'playVideo'); });
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    modal.querySelector('[data-close]').addEventListener('click', closeModal);
    modal.querySelector('[data-fullscreen]').addEventListener('click', function () {
      var el = stage.querySelector('video, iframe') || stage;
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitEnterFullscreen) el.webkitEnterFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    });
  }
  function isVisible(el) { var r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight; }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-play], [data-lightbox]');
    if (!t) return;
    e.preventDefault();
    if (t.hasAttribute('data-lightbox')) {
      openModal({ image: t.getAttribute('data-lightbox'), alt: t.getAttribute('data-alt') });
    } else {
      openModal({ mp4: t.dataset.mp4, embed: t.dataset.embed, poster: t.dataset.poster, title: t.dataset.title });
    }
  });

  /* ── Producties: YouTube ter plekke in de kaart afspelen ──────────────── */
  function stopInline(except) {
    document.querySelectorAll('.media.is-inline').forEach(function (m) {
      if (m === except) return;
      var f = m.querySelector('iframe'); if (f) f.remove();
      m.classList.remove('is-inline');
    });
  }
  document.addEventListener('click', function (e) {
    var m = e.target.closest('[data-inline-yt]');
    if (!m || m.classList.contains('is-inline')) return;
    e.preventDefault();
    var id = m.getAttribute('data-inline-yt'); if (!id) return;
    stopInline(m);
    autoVideos.forEach(function (v) { v.pause(); });
    ytFrames.forEach(function (f) { ytCommand(f, 'pauseVideo'); });
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    f.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    f.allowFullscreen = true;
    f.title = m.getAttribute('aria-label') || 'Video';
    m.appendChild(f);
    m.classList.add('is-inline');
  });

  /* ── FAQ-accordeon ─────────────────────────────────────────────────────── */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var open = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open'); el.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!open) { item.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });

  /* ── Cases-filter ──────────────────────────────────────────────────────── */
  var filters = document.querySelector('.filters');
  if (filters) {
    filters.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      filters.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      var f = b.dataset.filter;
      document.querySelectorAll('[data-type]').forEach(function (c) { c.hidden = f !== 'all' && c.dataset.type !== f; });
    });
  }

  /* ── Contactformulier (EmailJS pas laden bij interactie) ───────────────── */
  var form = document.getElementById('contactForm');
  if (form) {
    var cfg = JSON.parse(form.dataset.emailjs || '{}');
    var ejsLoading = null;
    function loadEmailJS() {
      if (window.emailjs) return Promise.resolve(window.emailjs);
      if (ejsLoading) return ejsLoading;
      ejsLoading = new Promise(function (res, rej) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        s.onload = function () { window.emailjs.init({ publicKey: cfg.public_key }); res(window.emailjs); };
        s.onerror = rej;
        document.head.appendChild(s);
      });
      return ejsLoading;
    }
    form.addEventListener('focusin', loadEmailJS, { once: true });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      var label = btn.innerHTML;
      var val = function (n) { return (form.elements[n] && form.elements[n].value.trim()) || 'Niet ingevuld'; };
      var data = {
        naam: val('naam'), email: val('email'), telefoon: val('telefoon'), bedrijf: val('bedrijf'),
        dienst: 'Storio Media · ' + val('soort'),
        bericht: val('bericht') + '\n\nIndicatie budget: ' + val('budget') + '\n(Verstuurd via storiomedia.nl)'
      };
      btn.disabled = true; btn.textContent = 'Versturen…';
      loadEmailJS().then(function (ejs) {
        return ejs.send(cfg.service_id, cfg.template_notify, data).then(function () {
          if (cfg.template_confirm) return ejs.send(cfg.service_id, cfg.template_confirm, data).catch(function () {});
        });
      }).then(function () {
        form.innerHTML = '<div class="form-success" role="status"><div class="check">✓</div><h3>Dank je, ' +
          escapeHtml(data.naam) + '.</h3><p>We hebben je idee ontvangen en nemen snel contact met je op via <strong>' +
          escapeHtml(data.email) + '</strong>.</p></div>';
      }).catch(function (err) {
        console.error('Versturen mislukt', err);
        btn.disabled = false; btn.innerHTML = label;
        alert('Versturen is helaas mislukt. Mail ons gerust direct via ' + (form.dataset.mail || 'e-mail') + '.');
      });
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();

/* Werkwijze-tijdlijn: lijn loopt mee met scrollen */
(function () {
  var tl = document.querySelector('.timeline');
  if (!tl) return;
  var steps = tl.querySelectorAll('.tl-step'), ticking = false;
  function update() {
    ticking = false;
    var r = tl.getBoundingClientRect(), vh = window.innerHeight;
    var p = Math.min(1, Math.max(0, (vh * 0.75 - r.top) / (r.height * 0.9)));
    tl.style.setProperty('--p', p.toFixed(3));
    steps.forEach(function (s, i) { s.classList.toggle('is-on', p >= (steps.length > 1 ? i / (steps.length - 1) : 0) - 0.02); });
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
