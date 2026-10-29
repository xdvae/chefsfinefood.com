(function () {
  'use strict';
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var state = { status: '', q: '', rows: [], stats: {} };
  var STATUS_LABEL = { new: 'New', contacted: 'Contacted', booked: 'Booked', closed: 'Closed' };

  /* ---------- Supabase (public anon key — safe to publish; every action goes through locked database functions) ---------- */
  var SUPABASE_URL = 'https://dqtkbmnhrowyblzvuqmd.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxdGtibW5ocm93eWJsenZ1cW1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyOTEyODgsImV4cCI6MjEwODg2NzI4OH0.HcwmWP6t3EDXelBBJTXMQIaEUQo7guH7Zsf7N1C3nKw';
  var TOKEN_KEY = 'cff_admin_token';
  var token = null;
  try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}
  function saveToken(t) { token = t; try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function rpc(fn, args) {
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var msg = (j && (j.message || j.hint)) || 'Something went wrong';
          if (/log in/i.test(msg)) { saveToken(null); showLogin(); throw new Error('auth'); }
          return { ok: false, error: msg };
        }
        return j;
      });
    });
  }
  function api(path, opts) {
    opts = opts || {};
    var body = opts.body ? JSON.parse(opts.body) : {};
    var m;
    if (path === '/api/admin/login') return rpc('admin_login', { p_password: body.password }).then(function (j) { if (j.ok && j.token) saveToken(j.token); return j; });
    if (path === '/api/admin/logout') return rpc('admin_logout', { p_token: token || '' }).then(function (j) { saveToken(null); return j; }, function () { saveToken(null); return {}; });
    if (path === '/api/admin/me') return token ? rpc('admin_list', { p_token: token, p_status: 'closed', p_q: '__none__' }) : Promise.resolve({ ok: false });
    if (path.indexOf('/api/admin/enquiries?') === 0) {
      var qs = new URLSearchParams(path.split('?')[1]);
      return rpc('admin_list', { p_token: token, p_status: qs.get('status') || null, p_q: qs.get('q') || null });
    }
    if ((m = path.match(/^\/api\/admin\/enquiries\/(\d+)$/))) {
      if (opts.method === 'DELETE') return rpc('admin_delete', { p_token: token, p_id: Number(m[1]) });
      return rpc('admin_update', { p_token: token, p_id: Number(m[1]), p_status: body.status === undefined ? null : body.status, p_notes: body.notes === undefined ? null : body.notes });
    }
    return Promise.resolve({ ok: false, error: 'Unknown action' });
  }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- login ---------- */
  function showLogin() { $('#app').hidden = true; $('#login').hidden = false; setTimeout(function () { $('#pw').focus(); }, 50); }
  function showApp() { $('#login').hidden = true; $('#app').hidden = false; load(); }
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = $('.primary', e.target); btn.disabled = true; $('#loginErr').textContent = '';
    api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#pw').value }) })
      .then(function (j) { if (j.ok) { $('#pw').value = ''; showApp(); } else $('#loginErr').textContent = j.error || 'Could not log in'; })
      .catch(function (err) { if (err.message !== 'auth') $('#loginErr').textContent = 'Could not reach the database — check your internet and try again.'; })
      .then(function () { btn.disabled = false; });
  });
  $('#logoutBtn').addEventListener('click', function () { api('/api/admin/logout', { method: 'POST' }).then(showLogin); });

  /* ---------- formatting ---------- */
  var IST = 'Asia/Kolkata';
  function fmtWhen(iso) {
    var d = new Date(iso), diff = (Date.now() - d) / 1000, rel;
    if (diff < 60) rel = 'just now';
    else if (diff < 3600) rel = Math.floor(diff / 60) + ' min ago';
    else if (diff < 86400) rel = Math.floor(diff / 3600) + ' hr ago';
    else if (diff < 172800) rel = 'yesterday';
    else rel = Math.floor(diff / 86400) + ' days ago';
    var abs = d.toLocaleString('en-IN', { timeZone: IST, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
    return 'Received ' + rel + ' · ' + abs;
  }
  function fmtEventDate(s) {
    if (!s) return null;
    var p = s.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    var today = new Date(new Date().toLocaleDateString('en-CA', { timeZone: IST }) + 'T00:00:00Z');
    var days = Math.round((d - today) / 864e5);
    var label = d.toLocaleDateString('en-IN', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    var rel = days === 0 ? 'today' : days === 1 ? 'tomorrow' : days > 1 ? 'in ' + days + ' days' : Math.abs(days) + ' days ago';
    return { label: label, rel: rel };
  }
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 10) d = '91' + d; if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1); return d; }

  /* ---------- render ---------- */
  function detail(dl, label, value, extra, wide) {
    if (!value) return;
    var w = document.createElement('div'); if (wide) w.className = 'wide';
    var dt = document.createElement('dt'); dt.textContent = label;
    var dd = document.createElement('dd'); dd.textContent = value;
    if (extra) { var sm = document.createElement('small'); sm.textContent = extra; dd.appendChild(sm); }
    w.appendChild(dt); w.appendChild(dd); dl.appendChild(w);
  }

  function card(e) {
    var n = $('#cardTpl').content.firstElementChild.cloneNode(true);
    n.dataset.id = e.id;
    n.classList.add('st-' + e.status);
    var nm = $('.c-name', n); nm.textContent = e.name;
    if (e.brand === 'Shree Shyam') { var tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = 'Shree Shyam · Pure Veg'; nm.appendChild(tg); }
    $('.c-when', n).textContent = fmtWhen(e.created_at) + (e.channel === 'whatsapp' ? ' · also sent on WhatsApp' : '');
    $('.c-flag', n).hidden = e.status !== 'new';

    var tel = String(e.phone).replace(/[^\d+]/g, '');
    $('.call', n).href = 'tel:' + tel;
    $('.call', n).lastChild.textContent = window.innerWidth < 760 ? 'Call' : 'Call ' + e.phone;
    var first = e.name.split(' ')[0];
    var msg = 'Namaste ' + first + ', thank you for your enquiry with ' + (e.brand === 'Shree Shyam' ? 'Shree Shyam Caterers' : "The Chef's Fine Food Caterers") +
      (e.event_type ? ' for your ' + e.event_type.toLowerCase() : '') + '. ';
    $('.wa', n).href = 'https://wa.me/' + digits(e.phone) + '?text=' + encodeURIComponent(msg);
    if (e.email) { var m = $('.mail', n); m.hidden = false; m.href = 'mailto:' + e.email + '?subject=' + encodeURIComponent('Your event enquiry'); }

    var dl = $('.c-details', n), ed = fmtEventDate(e.event_date);
    detail(dl, 'Event', e.event_type);
    detail(dl, 'Event date', ed && ed.label, ed && ed.rel);
    detail(dl, 'Guests', e.guests);
    detail(dl, 'Venue / area', e.venue);
    detail(dl, 'Phone', e.phone);
    detail(dl, 'Email', e.email);
    detail(dl, 'Services wanted', e.services, null, true);
    detail(dl, 'Message', e.message, null, true);

    $$('.c-status button', n).forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.s === e.status));
      b.addEventListener('click', function () { setStatus(e, b.dataset.s, n); });
    });

    var ta = $('textarea', n), saved = $('.saved', n), t;
    ta.value = e.notes || '';
    ta.addEventListener('input', function () {
      saved.hidden = true; clearTimeout(t);
      t = setTimeout(function () {
        api('/api/admin/enquiries/' + e.id, { method: 'PATCH', body: JSON.stringify({ notes: ta.value }) })
          .then(function (j) { if (j.ok) { e.notes = ta.value; saved.hidden = false; } else toast('Could not save note'); });
      }, 700);
    });

    var PAGES = { '/': 'Home page', '/contact/': 'Contact page', '/shree-shyam-caterers/': 'Shree Shyam page', '/catering-menu/': 'Menu page', '/weddings-events/': 'Weddings page', '/about/': 'About page', '/gallery/': 'Gallery' };
    var src = e.source_page ? (PAGES[e.source_page] || e.source_page.replace(/^\/|\/$/g, '').replace(/[-/]/g, ' ')) : '';
    $('.c-src', n).textContent = 'Enquiry #' + e.id + (src ? ' · from ' + src : '');
    $('.del', n).addEventListener('click', function () {
      if (!confirm('Delete the enquiry from ' + e.name + '? This cannot be undone.')) return;
      api('/api/admin/enquiries/' + e.id, { method: 'DELETE' }).then(function (j) {
        if (j.ok) { toast('Enquiry deleted'); load(); } else toast('Could not delete');
      });
    });
    return n;
  }

  function setStatus(e, s, n) {
    if (e.status === s) return;
    var prev = e.status;
    api('/api/admin/enquiries/' + e.id, { method: 'PATCH', body: JSON.stringify({ status: s }) }).then(function (j) {
      if (!j.ok) return toast('Could not update');
      e.status = s;
      n.classList.remove('st-' + prev); n.classList.add('st-' + s);
      $$('.c-status button', n).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.s === s)); });
      $('.c-flag', n).hidden = s !== 'new';
      toast(e.name + ' → ' + STATUS_LABEL[s]);
      load(true);
    });
  }

  function render() {
    var list = $('#list'); list.textContent = '';
    state.rows.forEach(function (e) { list.appendChild(card(e)); });
    var st = state.stats || {};
    $('#stNew').textContent = st.new || 0; $('#stToday').textContent = st.today || 0;
    $('#stWeek').textContent = st.week || 0; $('#stUpcoming').textContent = st.upcoming || 0;
    $('#cAll').textContent = st.total || 0; $('#cNew').textContent = st.new || 0; $('#cContacted').textContent = st.contacted || 0;
    $('#cBooked').textContent = st.booked || 0; $('#cClosed').textContent = st.closed || 0;
    document.title = (st.new ? '(' + st.new + ' new) ' : '') + "Enquiries · The Chef's";
    var empty = $('#empty');
    if (state.rows.length) { empty.hidden = true; }
    else {
      empty.hidden = false; empty.textContent = '';
      var b = document.createElement('b');
      b.textContent = state.q ? 'No matches' : (state.status ? 'Nothing here yet' : 'No enquiries yet');
      empty.appendChild(b);
      empty.appendChild(document.createTextNode(state.q ? 'Try a different name or number.' : 'New enquiries from the website will appear here automatically.'));
    }
  }

  var loading = false;
  function load(quiet) {
    if (loading) return; loading = true;
    var rb = $('#refreshBtn'); if (!quiet) rb.classList.add('spin');
    var qs = new URLSearchParams(); if (state.status) qs.set('status', state.status); if (state.q) qs.set('q', state.q);
    // keep unsaved typing safe: skip silent refresh while a note is being edited
    if (quiet && document.activeElement && document.activeElement.tagName === 'TEXTAREA') { loading = false; rb.classList.remove('spin'); return; }
    api('/api/admin/enquiries?' + qs.toString()).then(function (j) {
      if (!j.ok) return toast(j.error || 'Could not load');
      var before = state.stats.total;
      state.rows = j.enquiries; state.stats = j.stats; render();
      if (quiet && before !== undefined && j.stats.total > before) toast('New enquiry received!');
    }).catch(function (err) { if (err.message !== 'auth') toast('Connection problem — retrying…'); })
      .then(function () { loading = false; rb.classList.remove('spin'); });
  }

  /* ---------- controls ---------- */
  function setTab(s) {
    state.status = s;
    $$('.tabs button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.status === s)); });
    load();
  }
  $$('.tabs button').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.status); }); });
  $('[data-go="new"]').addEventListener('click', function () { setTab('new'); });
  var st;
  $('#search').addEventListener('input', function (e) { clearTimeout(st); st = setTimeout(function () { state.q = e.target.value.trim(); load(); }, 300); });
  $('#refreshBtn').addEventListener('click', function () { load(); });
  $('#csvBtn').addEventListener('click', function (ev) {
    ev.preventDefault();
    rpc('admin_list', { p_token: token, p_status: null, p_q: null }).then(function (j) {
      if (!j.ok) return toast(j.error || 'Could not export');
      var cols = ['id', 'created_at', 'status', 'brand', 'name', 'phone', 'email', 'event_type', 'event_date', 'guests', 'venue', 'services', 'message', 'notes', 'source_page', 'channel'];
      var esc = function (v) { var x = v == null ? '' : String(v); if (/^[=+\-@\t\r]/.test(x)) x = "'" + x; return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
      var rows = j.enquiries.map(function (e) {
        var o = Object.assign({}, e); o.created_at = new Date(e.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        return cols.map(function (c) { return esc(o[c]); }).join(',');
      });
      var blob = new Blob(['﻿' + [cols.join(',')].concat(rows).join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'enquiries-' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    });
  });
  setInterval(function () { if (!$('#app').hidden && !document.hidden) load(true); }, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && !$('#app').hidden) load(true); });

  /* ---------- start ---------- */

  api('/api/admin/me').then(function (j) { if (j.ok) showApp(); else showLogin(); }).catch(function (e) { if (e.message !== 'auth') showLogin(); });
})();
