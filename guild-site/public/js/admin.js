/* 星尘公会 · 管理端脚本 */
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

  /* ---------- 品牌像素画 ---------- */
  var logo = $('.brand-logo');
  if (logo) logo.innerHTML = spriteSVG('shield', 2);

  var CLASS_MAP = {};
  CLASSES.forEach(function (c) { CLASS_MAP[c.id] = c; });
  var SLOT_MAP = {};
  TIME_SLOTS.forEach(function (s) { SLOT_MAP[s.id] = s.label; });

  /* ---------- 状态 ---------- */
  var TOKEN_KEY = 'sg_admin_token';
  var token = sessionStorage.getItem(TOKEN_KEY) || '';
  var filter = 'pending';
  var lastData = { items: [], stats: {} };

  function showView(name) {
    $('#loginView').hidden = name !== 'login';
    $('#dashView').hidden = name !== 'dash';
    $('#logoutBtn').hidden = name !== 'dash';
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    if (opts.body) opts.headers['Content-Type'] = 'application/json';
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401) {
          logout(true);
          throw new Error(j.error || '登录已过期，请重新登录');
        }
        if (!r.ok) throw new Error(j.error || ('请求失败（' + r.status + '）'));
        return j;
      });
    });
  }

  /* ---------- 登录 / 退出 ---------- */
  $('#loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('#pw').value;
    var btn = $('#loginBtn');
    $('#loginErr').textContent = '';
    if (!pw) { $('#loginErr').textContent = '请输入管理密码'; return; }
    btn.disabled = true;
    btn.textContent = '◌ 验证中…';
    api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: pw }) })
      .then(function (j) {
        token = j.token;
        sessionStorage.setItem(TOKEN_KEY, token);
        $('#pw').value = '';
        enterDash();
        toast('登录成功，欢迎回来', 'ok');
      })
      .catch(function (err) {
        $('#loginErr').textContent = err.message;
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = '▶ 进入管理端';
      });
  });

  function logout(expired) {
    if (token) {
      fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
      }).catch(function () {});
    }
    token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    showView('login');
    if (expired) toast('登录已过期，请重新登录', 'error');
  }
  $('#logoutBtn').addEventListener('click', function () {
    logout(false);
    toast('已退出登录');
  });

  /* ---------- 数据加载与渲染 ---------- */
  function enterDash() {
    showView('dash');
    load();
  }

  function load() {
    $('#appList').innerHTML = '<p class="loading">◌ 加载中…</p>';
    api('/api/admin/applications?status=' + filter)
      .then(function (j) { lastData = j; render(); })
      .catch(function (err) {
        $('#appList').innerHTML = '';
        if (token) toast(err.message, 'error');
      });
  }

  function render() {
    var s = lastData.stats || {};
    $('#stPending').textContent = s.pending || 0;
    $('#stApproved').textContent = s.approved || 0;
    $('#stRejected').textContent = s.rejected || 0;
    $('#stTotal').textContent = s.total || 0;

    var items = lastData.items || [];
    $('#emptyHint').hidden = items.length > 0;
    $('#appList').innerHTML = items.map(cardHTML).join('');
    bindCards();
  }

  function cardHTML(it) {
    var c = CLASS_MAP[it.classId] || { name: it.classId, sprite: 'sword', color: '#d7d7e8' };
    var slots = (it.timeSlots || []).map(function (id) {
      return '<span class="slot">' + esc(SLOT_MAP[id] || id) + '</span>';
    }).join('');
    var statusLabel = { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[it.status] || it.status;
    var html = '<article class="app-card st-' + esc(it.status) + '" data-id="' + esc(it.id) + '">' +
      '<div class="app-head">' +
        '<span class="app-id">' + esc(it.id) + '</span>' +
        '<span class="app-name">' + esc(it.characterName) +
          '<span class="class-badge" style="color:' + c.color + ';border-color:' + c.color + '">' + esc(c.name) + '</span>' +
        '</span>' +
        '<span class="badge badge-' + esc(it.status) + '">' + statusLabel + '</span>' +
      '</div>' +
      '<div class="app-meta">' +
        '<span class="app-icon" title="' + esc(c.name) + '">' + spriteSVG(c.sprite, 2) + '</span>' +
        '<span>◷ ' + esc(fmtTime(it.createdAt)) + '</span>' +
        (it.queryToken ? '<span class="app-code" title="申请人查询进度所需的查询码">查询码 ' + esc(it.queryToken) + '</span>' : '') +
        slots +
      '</div>' +
      '<p class="app-intro">' + esc(it.intro) + '</p>';
    if (it.status === 'pending') {
      html += '<div class="review-area">' +
        '<textarea class="px-input note-input" maxlength="200" placeholder="审核备注（可选；拒绝时建议填写原因，申请人可见）"></textarea>' +
        '<div class="review-btns">' +
          '<button class="px-btn success btn-approve">✔ 通过</button>' +
          '<button class="px-btn danger btn-reject">✘ 拒绝</button>' +
        '</div>' +
      '</div>';
    } else {
      html += '<div class="reviewed-box">' +
        '<div class="reviewed-note">◷ ' + esc(fmtTime(it.reviewedAt)) + ' 完成审核' +
          (it.note ? '<br>◆ 备注：<b>' + esc(it.note) + '</b>' : '') +
        '</div>' +
        '<div class="review-btns">' +
          (it.status === 'approved'
            ? '<button class="px-btn tiny danger btn-reject">改判为拒绝</button>'
            : '<button class="px-btn tiny success btn-approve">改判为通过</button>') +
        '</div>' +
      '</div>';
    }
    return html + '</article>';
  }

  function bindCards() {
    $$('.app-card').forEach(function (card) {
      var id = card.getAttribute('data-id');
      var noteEl = $('.note-input', card);
      $$('.btn-approve', card).forEach(function (b) {
        b.addEventListener('click', function () { review(id, 'approve', noteEl ? noteEl.value : ''); });
      });
      $$('.btn-reject', card).forEach(function (b) {
        b.addEventListener('click', function () { review(id, 'reject', noteEl ? noteEl.value : ''); });
      });
    });
  }

  function review(id, action, note) {
    var item = (lastData.items || []).filter(function (i) { return i.id === id; })[0];
    var name = item ? item.characterName : id;
    var verb = action === 'approve' ? '通过' : '拒绝';
    if (!window.confirm('确认' + verb + '「' + name + '」的申请吗？')) return;
    api('/api/admin/applications/' + encodeURIComponent(id) + '/review', {
      method: 'POST',
      body: JSON.stringify({ action: action, note: note || '' })
    }).then(function () {
      toast('已' + verb + '「' + name + '」', 'ok');
      load();
    }).catch(function (err) {
      if (token) toast(err.message, 'error');
    });
  }

  /* ---------- 筛选与刷新 ---------- */
  $$('#tabs .tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      $$('#tabs .tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');
      filter = tab.getAttribute('data-f');
      load();
    });
  });
  $('#refreshBtn').addEventListener('click', load);

  /* ---------- 启动：尝试恢复会话 ---------- */
  if (token) {
    api('/api/admin/applications?status=' + filter)
      .then(function (j) {
        lastData = j;
        showView('dash');
        render();
      })
      .catch(function () { /* 401 已在 api 内处理并回到登录页 */ });
  } else {
    showView('login');
  }
})();
