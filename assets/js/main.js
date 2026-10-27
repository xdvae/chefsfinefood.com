/* The Chef Fine Food Caterers — site scripts (no dependencies) */
(function () {
  'use strict';

  /* ===== SETTINGS — edit these ===== */
  var WHATSAPP = '919055135000';            // number with country code, no +
  var EMAIL = 'finefoodthechef@gmail.com';
  // Optional: paste a Formspree / FormSubmit / Web3Forms endpoint here to also
  // receive enquiries by email, e.g. 'https://formspree.io/f/xxxxxxx'.
  // Leave empty to send enquiries through WhatsApp only.
  var FORM_ENDPOINT = '';
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

  // Enquiry form
  $$('form.enq-form').forEach(function (form) {
    var params = new URLSearchParams(location.search);
    var ev = params.get('event'), sv = params.get('service');
    if (ev && form.event) { $$('option', form.event).forEach(function (o) { if (o.value.toLowerCase().indexOf(ev.toLowerCase()) === 0) form.event.value = o.value; }); }
    if (sv) $$('input[name="services"]', form).forEach(function (c) { if (c.value.toLowerCase().indexOf(sv.toLowerCase()) === 0) c.checked = true; });
    if (form.date) form.date.min = new Date().toISOString().slice(0, 10);

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
    var message = function () {
      var g = function (n) { return form[n] ? form[n].value.trim() : ''; };
      var svcs = $$('input[name="services"]:checked', form).map(function (c) { return c.value; }).join(', ');
      return ['Hello The Chef Fine Food Caterers, I would like to enquire about an event.', '',
        'Name: ' + g('name'), 'Phone: ' + g('phone'),
        g('email') && 'Email: ' + g('email'),
        'Event: ' + g('event'),
        g('date') && 'Date: ' + g('date'),
        g('guests') && 'Guests: ' + g('guests'),
        g('venue') && 'Venue/Area: ' + g('venue'),
        svcs && 'Services: ' + svcs,
        g('message') && ('Details: ' + g('message'))].filter(Boolean).join('\n');
    };
    var done = function () { form.classList.add('sent'); form.scrollIntoView({ behavior: 'smooth', block: 'center' }); };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (form.website && form.website.value) return; // spam trap
      if (!check()) return;
      var text = message();
      if (FORM_ENDPOINT) {
        var fd = new FormData(form); fd.append('summary', text);
        fetch(FORM_ENDPOINT, { method: 'POST', body: fd, headers: { Accept: 'application/json' } }).catch(function () {});
      }
      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text), '_blank', 'noopener');
      done();
    });
    var mail = $('[data-mail]', form);
    if (mail) mail.addEventListener('click', function () {
      if (!check()) return;
      location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Event enquiry – ' + (form.event ? form.event.value : '')) + '&body=' + encodeURIComponent(message());
      done();
    });
    var again = $('[data-again]', form);
    if (again) again.addEventListener('click', function () { form.reset(); form.classList.remove('sent'); });
  });

  // Footer year
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
