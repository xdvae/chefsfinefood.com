/* The Chef Fine Food Caterers — site scripts (no dependencies) */
(function () {
  'use strict';

  /* ===== SETTINGS — edit these ===== */
  var WHATSAPP = '919055135000';            // number with country code, no +
  var EMAIL = 'finefoodthechef@gmail.com';
  // Enquiries are saved in the Supabase database and shown at chefsfinefood.com/admin/
  // (public anon key — safe to publish; the database only allows the locked submit function)
  var SUPABASE_URL = '__SUPABASE_URL__';
  var SUPABASE_KEY = '__SUPABASE_ANON_KEY__';
  var CAN_SAVE = SUPABASE_URL.indexOf('__') !== 0;
  var sbHeaders = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY };
  /* ================================= */

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  // When the site is opened straight from a folder (file://), folder links like
  // "contact/" or "contact/?service=catering" must point at contact/index.html.
  // On the live site (http/https) links are left as clean URLs.
  if (location.protocol === 'file:') {
    $$('a[href]').forEach(function (a) {
      var h = a.getAttribute('href');
      if (/^(https?:|mailto:|tel:|#|javascript:|data:)/.test(h)) return;
      var m = h.match(/^([^?#]*)([?#].*)?$/), path = m[1], rest = m[2] || '';
      if (path === '' || path === '.' ) path = './';
      if (/\/$/.test(path)) a.setAttribute('href', path + 'index.html' + rest);
    });
  }

  // Broken image → show the dark-gold placeholder behind it instead
  $$('img').forEach(function (img) {
    var hide = function () { img.style.opacity = 0; };
    if (img.complete && !img.naturalWidth) hide();
    img.addEventListener('error', hide);
  });

  // Background video: fade in only when a real file plays (skipped for reduced motion)
  $$('video[data-bg]').forEach(function (v) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { v.remove(); return; }
    v.addEventListener('playing', function () { v.classList.add('ready'); });
    v.addEventListener('error', function () { v.remove(); }, true);
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  });

  // Header: solid on scroll
  var hdr = $('.site-header');
  var onScroll = function () {
    if (hdr) hdr.classList.toggle('solid', window.scrollY > 40);
    var tt = $('.to-top'); if (tt) tt.classList.toggle('show', window.scrollY > 700);
  };
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile menu
  var burger = $('.burger'), menu = $('#menu');
  function setMenu(open) {
    if (!burger) return;
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.classList.toggle('open', open);
    hdr.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    document.body.classList.toggle('menu-open', open);
  }
  if (burger) {
    burger.addEventListener('click', function () { setMenu(burger.getAttribute('aria-expanded') !== 'true'); });
    $$('a', menu).forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', function () { if (window.innerWidth > 1080) setMenu(false); });
  }

  // Back to top
  var tt = $('.to-top');
  if (tt) tt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  // Reveal on scroll
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    $$('.rv').forEach(function (el) { io.observe(el); });

    // Counters
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target, end = +el.dataset.n, suf = el.dataset.s || '+', t0;
        var step = function (t) {
          t0 = t0 || t;
          var p = Math.min((t - t0) / 1600, 1);
          el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3))).toLocaleString('en-IN') + (p === 1 ? suf : '');
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step); co.unobserve(el);
      });
    }, { threshold: 0.6 });
    $$('[data-n]').forEach(function (el) { el.textContent = '0'; co.observe(el); });
  } else {
    $$('.rv').forEach(function (el) { el.classList.add('in'); });
  }

  // Testimonials
  $$('.testi').forEach(function (box) {
    var slides = $$('.t-slide', box), i = 0, timer;
    if (slides.length < 2) return;
    var go = function (d) { slides[i].classList.remove('on'); i = (i + d + slides.length) % slides.length; slides[i].classList.add('on'); };
    var restart = function () { clearInterval(timer); timer = setInterval(function () { go(1); }, 7000); };
    var n = $('[data-t="next"]', box), p = $('[data-t="prev"]', box);
    if (n) n.addEventListener('click', function () { go(1); restart(); });
    if (p) p.addEventListener('click', function () { go(-1); restart(); });
    restart();
  });

  // Tabs (menu page)
  $$('[role="tablist"]').forEach(function (list) {
    var tabs = $$('[role="tab"]', list);
    var select = function (tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    };
    tabs.forEach(function (t, idx) {
      t.addEventListener('click', function () { select(t); });
      t.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (k) { var nt = tabs[(idx + k + tabs.length) % tabs.length]; select(nt); nt.focus(); }
      });
    });
    if (location.hash) { var tgt = tabs.filter(function (t) { return '#' + t.dataset.hash === location.hash; })[0]; if (tgt) select(tgt); }
  });

  // Gallery filters
  var filters = $('.filters');
  if (filters) {
    var items = $$('.g-item');
    var apply = function (cat) {
      $$('button', filters).forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.f === cat); });
      items.forEach(function (it) { it.classList.toggle('hide', cat !== 'all' && it.dataset.cat.split(' ').indexOf(cat) < 0); });
    };
    $$('button', filters).forEach(function (b) { b.addEventListener('click', function () { apply(b.dataset.f); }); });
    var q = new URLSearchParams(location.search).get('category');
    if (q && $('[data-f="' + q + '"]', filters)) apply(q);
  }

  // Lightbox
  var lb = $('.lightbox');
  if (lb) {
    var lbImg = $('img', lb), lbCap = $('figcaption', lb), cur = 0, list = [], lastFocus;
    var visible = function () { return $$('.g-item').filter(function (x) { return !x.classList.contains('hide'); }); };
    var show = function (k) {
      cur = (k + list.length) % list.length;
      var it = list[cur], im = $('img', it);
      lbImg.src = it.dataset.full || im.src; lbImg.alt = im.alt; lbCap.textContent = im.alt;
    };
    var open = function (it) { lastFocus = it; list = visible(); show(list.indexOf(it)); lb.classList.add('open'); document.body.style.overflow = 'hidden'; $('.lb-close', lb).focus(); };
    var close = function () { lb.classList.remove('open'); document.body.style.overflow = ''; if (lastFocus) lastFocus.focus(); };
    $$('.g-item').forEach(function (it) { it.addEventListener('click', function () { open(it); }); });
    $('.lb-close', lb).addEventListener('click', close);
    $('.lb-prev', lb).addEventListener('click', function () { show(cur - 1); });
    $('.lb-next', lb).addEventListener('click', function () { show(cur + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') show(cur + 1);
      if (e.key === 'ArrowLeft') show(cur - 1);
    });
  }

  // Video modal
  var vm = $('.vmodal');
  if (vm) {
    var vid = $('video', vm);
    var closeV = function () { vm.classList.remove('open'); vid.pause(); document.body.style.overflow = ''; };
    $$('[data-video]').forEach(function (b) {
      b.addEventListener('click', function () {
        vm.classList.remove('missing');
        vid.src = b.dataset.video;
        if (b.dataset.poster) vid.poster = b.dataset.poster;
        vm.classList.add('open'); document.body.style.overflow = 'hidden';
        var p = vid.play(); if (p && p.catch) p.catch(function () {});
        $('.lb-close', vm).focus();
      });
    });
    vid.addEventListener('error', function () { vm.classList.add('missing'); });
    $('.lb-close', vm).addEventListener('click', closeV);
    vm.addEventListener('click', function (e) { if (e.target === vm) closeV(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && vm.classList.contains('open')) closeV(); });
  }

  // Reels: silent previews play while on screen; tap opens a full-screen viewer with sound
  var reels = $$('video[data-reel]');
  if (reels.length) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var tryPlay = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); };
    var viewerOpen = false;
    var visible = [];
    if ('IntersectionObserver' in window && !reduce) {
      var ro = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target, on = e.isIntersecting && e.intersectionRatio >= 0.35;
          if (on) { if (visible.indexOf(v) < 0) visible.push(v); if (!viewerOpen) { v.preload = 'auto'; tryPlay(v); } }
          else { visible = visible.filter(function (x) { return x !== v; }); v.pause(); }
        });
      }, { threshold: [0, 0.35] });
      reels.forEach(function (v) { ro.observe(v); });
    }

    // keep floating WhatsApp / back-to-top buttons off the reels on phones
    var rsec = $$('.reels');
    if ('IntersectionObserver' in window && rsec.length) {
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) { document.body.classList.toggle('reels-in-view', e.isIntersecting); });
      }, { rootMargin: '-15% 0px -15% 0px' });
      rsec.forEach(function (x) { so.observe(x); });
    }

    var vw = $('.reel-viewer');
    if (vw) {
      var vid = $('video', vw), cur = 0, lastFocus = null, sx = 0, sy = 0;
      var muteBtn = $('.rv-mute', vw), bar = $('.rv-bar i', vw);
      var list = reels.map(function (v) { return { src: v.dataset.src, poster: v.getAttribute('poster'), cap: v.dataset.cap }; });
      $('.rv-count', vw).innerHTML = '<b>1</b> / ' + list.length;
      var setMuted = function (m) { vid.muted = m; muteBtn.setAttribute('aria-pressed', String(!m)); muteBtn.setAttribute('aria-label', m ? 'Turn sound on' : 'Turn sound off'); };
      var load = function (k) {
        cur = (k + list.length) % list.length;
        var it = list[cur];
        vid.poster = it.poster; vid.src = it.src; vid.currentTime = 0;
        $('.rv-cap', vw).textContent = it.cap;
        $('.rv-count b', vw).textContent = cur + 1;
        bar.style.width = '0';
        vw.classList.remove('is-paused');
        var p = vid.play();
        if (p && p.catch) p.catch(function () { setMuted(true); var q = vid.play(); if (q && q.catch) q.catch(function () { vw.classList.add('is-paused'); }); });
      };
      var open = function (k, opener) {
        lastFocus = opener; viewerOpen = true;
        reels.forEach(function (v) { v.pause(); });
        vw.hidden = false; document.body.classList.add('viewer-open');
        setMuted(false); load(k);
        $('.rv-close', vw).focus();
      };
      var close = function () {
        vid.pause(); vid.removeAttribute('src'); vid.load();
        vw.hidden = true; viewerOpen = false; document.body.classList.remove('viewer-open');
        visible.forEach(tryPlay);
        if (lastFocus) lastFocus.focus();
      };
      $$('.reel-open').forEach(function (b) { b.addEventListener('click', function () { open(+b.dataset.index, b); }); });
      $('.rv-close', vw).addEventListener('click', close);
      $('.rv-next', vw).addEventListener('click', function () { load(cur + 1); });
      $('.rv-prev', vw).addEventListener('click', function () { load(cur - 1); });
      muteBtn.addEventListener('click', function () { setMuted(!vid.muted); if (vid.paused) tryPlay(vid); });
      $('.rv-tap', vw).addEventListener('click', function () {
        if (vid.paused) { tryPlay(vid); vw.classList.remove('is-paused'); } else { vid.pause(); vw.classList.add('is-paused'); }
      });
      vid.addEventListener('timeupdate', function () { if (vid.duration) bar.style.width = (vid.currentTime / vid.duration * 100) + '%'; });
      vid.addEventListener('ended', function () { load(cur + 1); });
      vw.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      vw.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) load(cur + (dx < 0 ? 1 : -1));
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close();
        else if (dy < -60 && Math.abs(dy) > Math.abs(dx)) load(cur + 1);
      }, { passive: true });
      document.addEventListener('keydown', function (e) {
        if (vw.hidden) return;
        if (e.key === 'Escape') close();
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') load(cur + 1);
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') load(cur - 1);
      });
    }
  }

  // Enquiry form → saved to the backend; WhatsApp is optional (and the fallback)
  var forms = $$('form.enq-form');
  if (forms.length && CAN_SAVE) {
    // wake the server early (free hosting sleeps when idle) so submitting is quick
    // light keep-alive so the free database never pauses while people visit the site
    try { fetch(SUPABASE_URL + '/rest/v1/rpc/ping', { method: 'POST', headers: sbHeaders, body: '{}' }).catch(function () {}); } catch (e) {}
  }
  forms.forEach(function (form) {
    var params = new URLSearchParams(location.search);
    var ev = params.get('event'), sv = params.get('service');
    if (ev && form.event) { $$('option', form.event).forEach(function (o) { if (o.value.toLowerCase().indexOf(ev.toLowerCase()) === 0) form.event.value = o.value; }); }
    if (sv) $$('input[name="services"]', form).forEach(function (c) { if (c.value.toLowerCase().indexOf(sv.toLowerCase()) === 0) c.checked = true; });
    if (form.date) form.date.min = new Date().toISOString().slice(0, 10);
    var brand = /shree-shyam/.test(location.pathname) ? 'Shree Shyam' : "The Chef's";

    var g = function (n) { return form[n] ? form[n].value.trim() : ''; };
    var check = function () {
      var ok = true;
      [['name', function (v) { return v.trim().length > 1; }],
       ['phone', function (v) { return v.replace(/\D/g, '').length >= 10; }]].forEach(function (r) {
        var el = form[r[0]]; if (!el) return;
        var good = r[1](el.value); el.closest('.f').classList.toggle('invalid', !good);
        el.setAttribute('aria-invalid', !good);
        if (!good && ok) el.focus();
        ok = ok && good;
      });
      return ok;
    };
    var services = function () { return $$('input[name="services"]:checked', form).map(function (c) { return c.value; }); };
    var payload = function (channel) {
      return { name: g('name'), phone: g('phone'), email: g('email'), event: g('event'), date: g('date'), guests: g('guests'),
        venue: g('venue'), services: services(), message: g('message'), website: g('website'), page: location.pathname, brand: brand, channel: channel };
    };
    var waText = function () {
      var sv = services().join(', ');
      return ['Hello ' + (brand === 'Shree Shyam' ? 'Shree Shyam Caterers' : "The Chef's Fine Food Caterers") + ', I would like to enquire about an event.', '',
        'Name: ' + g('name'), 'Phone: ' + g('phone'), g('email') && 'Email: ' + g('email'), 'Event: ' + g('event'),
        g('date') && 'Date: ' + g('date'), g('guests') && 'Guests: ' + g('guests'), g('venue') && 'Venue/Area: ' + g('venue'),
        sv && 'Services: ' + sv, g('message') && 'Details: ' + g('message')].filter(Boolean).join('\n');
    };
    var waUrl = function () { return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(waText()); };
    var save = function (channel) {
      if (!CAN_SAVE) return Promise.reject(new Error('no api'));
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 45000);
      return fetch(SUPABASE_URL + '/rest/v1/rpc/submit_enquiry', {
        method: 'POST', headers: sbHeaders, body: JSON.stringify({ p: payload(channel) }),
        keepalive: channel === 'whatsapp', signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) { clearTimeout(timer); return r.json().then(function (j) { if (!r.ok || !j.ok) throw new Error(j.error || 'failed'); return j; }); });
    };
    var ok = $('.form-ok', form), submitBtn = $('button[type="submit"]', form);
    var showResult = function (kind) {
      var first = g('name').split(' ')[0];
      $('[data-ok-title]', ok).textContent = kind === 'fail' ? 'Almost there' : 'Thank you' + (first ? ', ' + first : '') + '!';
      $('[data-ok-text]', ok).textContent = kind === 'fail'
        ? 'We could not send your enquiry online just now. Please tap below to send it on WhatsApp — it only takes a second.'
        : kind === 'whatsapp' ? (CAN_SAVE ? 'Your enquiry is saved and WhatsApp has opened with your details. Our team will get back to you within 24 hours.'
                                          : 'WhatsApp has opened with your enquiry ready — just tap Send. Our team will get back to you within 24 hours.')
        : 'Your enquiry has been received. Our team will call you within 24 hours.';
      var wa = $('[data-ok-wa]', ok); wa.href = waUrl();
      $('span', wa).textContent = kind === 'fail' ? 'Send on WhatsApp' : kind === 'whatsapp' ? 'WhatsApp didn\u2019t open? Tap here' : 'Chat on WhatsApp now';
      wa.hidden = kind === 'whatsapp' && CAN_SAVE;
      form.classList.add('sent');
      ok.setAttribute('tabindex', '-1'); ok.focus({ preventScroll: true });
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.website && form.website.value) return;
      if (!check()) return;
      if (!CAN_SAVE) { window.open(waUrl(), '_blank', 'noopener'); showResult('whatsapp'); return; }  // no database yet: WhatsApp directly
      submitBtn.disabled = true; var lbl = $('[data-label]', submitBtn), was = lbl.textContent; lbl.textContent = 'Sending…';
      save('form').then(function () { showResult('ok'); }, function () { showResult('fail'); })
        .then(function () { submitBtn.disabled = false; lbl.textContent = was; });
    });
    var waBtn = $('[data-wa]', form);
    if (waBtn) waBtn.addEventListener('click', function () {
      if (!check()) return;
      window.open(waUrl(), '_blank', 'noopener');
      save('whatsapp').catch(function () {});
      showResult('whatsapp');
    });
    var again = $('[data-again]', form);
    if (again) again.addEventListener('click', function () { form.reset(); form.classList.remove('sent'); });
  });

  // Full menu: veg / non-veg filter + search
  $$('[data-menu]').forEach(function (box) {
    var diet = 'all', q = '';
    var items = $$('.mlist li', box), count = $('.mcount', box), none = $('.mnone', box), input = $('.msearch', box);
    var norm = function (t) { return t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
    items.forEach(function (li) { li._t = norm(li.textContent); });
    var apply = function () {
      var shown = 0;
      items.forEach(function (li) {
        var k = li.getAttribute('data-k');
        var ok = (diet === 'all' || k === diet || k === 'both') && (!q || li._t.indexOf(q) > -1);
        li.classList.toggle('hide', !ok); if (ok) shown++;
      });
      $$('.msec', box).forEach(function (s) { s.classList.toggle('hide', !$('li:not(.hide)', s)); });
      $$('.mgroup', box).forEach(function (g) { g.classList.toggle('hide', !$('.msec:not(.hide)', g)); });
      none.hidden = shown > 0;
      count.textContent = (diet === 'all' && !q) ? '' : shown + ' dish' + (shown === 1 ? '' : 'es') + ' shown';
    };
    $$('[data-diet]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        diet = b.getAttribute('data-diet');
        $$('[data-diet]', box).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        apply();
      });
    });
    var t; input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { q = norm(input.value.trim()); apply(); }, 120); });
  });

  // Footer year
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
