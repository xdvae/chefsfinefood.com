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

  // Reels: play muted while on screen, pause when scrolled away, sound toggle
  var reels = $$('video[data-reel]');
  if (reels.length) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var fig = function (v) { return v.closest('.reel'); };
    var playV = function (v) { var p = v.play(); if (p && p.catch) p.catch(function () { fig(v).classList.add('paused'); }); fig(v).classList.remove('paused'); };
    var pauseV = function (v) { v.pause(); fig(v).classList.add('paused'); };
    reels.forEach(function (v) {
      v.dataset.user = '';
      fig(v).classList.add('paused');
      v.addEventListener('click', function () {
        if (v.paused) { v.dataset.user = ''; v.preload = 'auto'; playV(v); } else { v.dataset.user = 'paused'; pauseV(v); }
      });
      var btn = fig(v).querySelector('.reel-sound');
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var turnOn = v.muted;
        reels.forEach(function (o) { o.muted = true; var b = fig(o).querySelector('.reel-sound'); b.setAttribute('aria-pressed', 'false'); b.setAttribute('aria-label', 'Turn sound on'); });
        if (turnOn) {
          v.muted = false; btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', 'Turn sound off');
          v.dataset.user = ''; v.preload = 'auto'; playV(v);
        }
      });
    });
    if ('IntersectionObserver' in window && !reduce) {
      var ro = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting && e.intersectionRatio >= 0.5) { if (v.dataset.user !== 'paused') { v.preload = 'auto'; playV(v); } }
          else if (!v.paused) { pauseV(v); if (!v.muted) fig(v).querySelector('.reel-sound').click(); }
        });
      }, { threshold: [0, 0.5] });
      reels.forEach(function (v) { ro.observe(v); });
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
