/* 星尘公会 · 访客端脚本 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtTime(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-CN', { hour12: false });
  }

  /* ---------- 提示条 ---------- */
  var toastTimer = null;
  function toast(msg, type) {
    var t = $('#toast');
    if (!t) return;
    var icon = type === 'error' ? '✖' : type === 'ok' ? '✔' : '◆';
    t.className = 'show ' + (type || 'info');
    t.innerHTML = '<span class="toast-icon">' + icon + '</span>' + esc(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3800);
  }

  /* ---------- 渲染静态像素画 ---------- */
  $$('[data-sprite]').forEach(function (el) {
    var svg = spriteSVG(el.getAttribute('data-sprite'), Number(el.getAttribute('data-scale') || 4));
    if (svg) el.innerHTML = svg;
  });
  var logo = $('.brand-logo');
  if (logo) logo.innerHTML = spriteSVG('shield', 2);

  /* ---------- 星空背景 ---------- */
  (function stars() {
    var canvas = $('#stars');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var stars = [], W = 0, H = 0;
    var COLORS = ['#ffffff', '#ffcb47', '#b983ff', '#57b8ff', '#5cdb95'];
    function resize() {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      var n = Math.min(150, Math.max(60, Math.floor(W / 9)));
      stars = [];
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          s: Math.random() < 0.75 ? 2 : 3,
          v: 0.08 + Math.random() * 0.35,
          c: COLORS[(Math.random() * COLORS.length) | 0],
          p: Math.random() * Math.PI * 2,
          tw: 0.5 + Math.random() * 1.5
        });
      }
    }
    var t = 0;
    function frame() {
      t += 0.016;
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        st.y += st.v;
        if (st.y > H + 4) { st.y = -4; st.x = Math.random() * W; }
        ctx.globalAlpha = 0.3 + 0.7 * Math.abs(Math.sin(t * st.tw + st.p));
        ctx.fillStyle = st.c;
        ctx.fillRect(st.x | 0, st.y | 0, st.s, st.s);
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    window.addEventListener('resize', resize);
    resize();
    frame();
  })();

  /* ---------- 导航高亮 ---------- */
  (function nav() {
    var links = $$('.nav a[href^="#"]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          links.forEach(function (a) { a.classList.remove('active'); });
          map[en.target.id].classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    Object.keys(map).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  })();

  /* ---------- 成员数（含已通过申请） ---------- */
  fetch('/api/stats').then(function (r) { return r.json(); }).then(function (j) {
    var n = 47 + (j.approved || 0);
    var e1 = $('#memberCount'), e2 = $('#memberCount2');
    if (e1) e1.textContent = n;
    if (e2) e2.textContent = n;
  }).catch(function () { /* 静态兜底 */ });

  /* ---------- 申请表单 ---------- */
  var NAME_RE = /^[一-龥A-Za-z0-9·_\-]{2,16}$/;
  var classGrid = $('#classGrid');
  var slotGrid = $('#slotGrid');

  CLASSES.forEach(function (c) {
    var label = document.createElement('label');
    label.className = 'class-card';
    label.innerHTML =
      '<input type="radio" name="classId" value="' + c.id + '">' +
      '<span class="class-icon">' + spriteSVG(c.sprite, 4) + '</span>' +
      '<span class="class-name">' + c.name + '</span>';
    classGrid.appendChild(label);
  });
  classGrid.addEventListener('change', function () {
    $$('.class-card', classGrid).forEach(function (el) { el.classList.remove('selected'); });
    var checked = $('input:checked', classGrid);
    if (checked) checked.closest('.class-card').classList.add('selected');
    setErr('errClass', '');
  });

  TIME_SLOTS.forEach(function (s) {
    var label = document.createElement('label');
    label.className = 'chip';
    label.innerHTML = '<input type="checkbox" name="timeSlots" value="' + s.id + '"><span>' + s.label + '</span>';
    slotGrid.appendChild(label);
  });
  slotGrid.addEventListener('change', function () { setErr('errSlots', ''); });

  var introEl = $('#fIntro');
  var counter = $('#introCount');
  introEl.addEventListener('input', function () {
    var n = introEl.value.trim().length;
    counter.textContent = n + ' / 500';
    counter.classList.toggle('over', n > 0 && n < 20);
    setErr('errIntro', '');
  });
  $('#fName').addEventListener('input', function () { setErr('errName', ''); });

  function setErr(id, msg) {
    var el = document.getElementById(id);
    if (el) el.textContent = msg || '';
  }

  function validate(d) {
    if (!NAME_RE.test(d.characterName)) { setErr('errName', '角色名需为 2-16 个字符（中文 / 字母 / 数字 / · _ -）'); return '角色名格式不正确'; }
    if (!d.classId) { setErr('errClass', '请选择你的常玩职业'); return '请选择常玩职业'; }
    if (!d.timeSlots.length) { setErr('errSlots', '请至少选择一个在线时段'); return '请选择在线时段'; }
    if (d.intro.length < 20) { setErr('errIntro', '自我介绍至少 20 字，当前 ' + d.intro.length + ' 字'); return '自我介绍太短了'; }
    if (d.intro.length > 500) { setErr('errIntro', '自我介绍最多 500 字'); return '自我介绍太长了'; }
    return null;
  }

  var form = $('#applyForm');
  var submitBtn = $('#submitBtn');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var d = {
      characterName: $('#fName').value.trim(),
      classId: (form.querySelector('input[name="classId"]:checked') || {}).value || '',
      timeSlots: $$('input[name="timeSlots"]:checked', slotGrid).map(function (el) { return el.value; }),
      intro: introEl.value.trim()
    };
    var err = validate(d);
    if (err) { toast(err, 'error'); return; }
    submitBtn.disabled = true;
    submitBtn.textContent = '◌ 提交中…';
    fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(d)
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, body: j }; });
    }).then(function (res) {
      if (res.ok) {
        $('#successId').textContent = res.body.id;
        $('#formPanel').hidden = true;
        var sp = $('#successPanel');
        sp.hidden = false;
        sp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast('申请已提交，祝好运！', 'ok');
      } else {
        toast(res.body.error || '提交失败，请稍后重试', 'error');
        if (res.body.error && res.body.error.indexOf('角色名') === 0) setErr('errName', res.body.error);
      }
    }).catch(function () {
      toast('网络异常，请检查连接后重试', 'error');
    }).then(function () {
      submitBtn.disabled = false;
      submitBtn.textContent = '▶ 提交申请';
    });
  });

  $('#againBtn').addEventListener('click', function () {
    form.reset();
    $$('.class-card', classGrid).forEach(function (el) { el.classList.remove('selected'); });
    counter.textContent = '0 / 500';
    counter.classList.remove('over');
    $('#successPanel').hidden = true;
    $('#formPanel').hidden = false;
    $('#formPanel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('#goStatus').addEventListener('click', function () {
    $('#qName').value = $('#fName').value.trim();
  });

  /* ---------- 进度查询 ---------- */
  var STATUS_MAP = {
    pending:  { cls: 'pending',  label: '待审核', desc: '你的申请正在排队审核中，通常 1～3 天出结果，请耐心等待。' },
    approved: { cls: 'approved', label: '已通过', desc: '恭喜！申请已通过，官员会尽快在游戏内联系你，欢迎加入星尘公会！' },
    rejected: { cls: 'rejected', label: '未通过', desc: '很遗憾这次未能通过。可以补充信息后，换个时间再次提交申请。' }
  };
  $('#statusForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('#qName').value.trim();
    var box = $('#statusResult');
    if (!name) { toast('请输入角色名', 'error'); return; }
    box.innerHTML = '<p class="loading">◌ 查询中…</p>';
    fetch('/api/applications/status?name=' + encodeURIComponent(name))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.error) { box.innerHTML = ''; toast(j.error, 'error'); return; }
        if (!j.found) {
          box.innerHTML = '<div class="status-card"><h3>没有找到「' + esc(name) + '」的申请记录</h3>' +
            '<p>确认角色名是否输入正确；还没有申请的话，快去上方提交吧！</p></div>';
          return;
        }
        var st = STATUS_MAP[j.status] || STATUS_MAP.pending;
        var html = '<div class="status-card st-' + st.cls + '">' +
          '<h3>' + esc(j.characterName) + ' <span class="badge badge-' + st.cls + '">' + st.label + '</span></h3>' +
          '<p>申请编号：' + esc(j.id) + ' ｜ 提交时间：' + esc(fmtTime(j.createdAt)) + '</p>' +
          '<p>' + st.desc + '</p>';
        if (j.note) html += '<p class="note">◆ 官员留言：' + esc(j.note) + '</p>';
        html += '</div>';
        box.innerHTML = html;
      })
      .catch(function () { box.innerHTML = ''; toast('网络异常，请稍后重试', 'error'); });
  });
})();
