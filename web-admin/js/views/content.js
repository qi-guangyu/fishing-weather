// 内容审核：评论审核 / 渔获审核 / 举报处理（三个 Tab）
window.Views = window.Views || {};
window.Views.content = (function () {
  var tab = 'comments';
  var states = { comments: { page: 1, status: '' }, catches: { page: 1, status: '' }, reports: { page: 1, status: '' } };
  function esc(s) { return window.AdminUI.escapeHtml(s); }

  function render(container) {
    container.innerHTML =
      '<div class="tabs">' +
        '<button data-tab="comments" class="active">评论审核</button>' +
        '<button data-tab="catches">渔获审核</button>' +
        '<button data-tab="reports">举报处理</button>' +
      '</div>' +
      '<div class="toolbar">' +
        '<select id="c-status"><option value="">全部状态</option><option value="pending">待审核</option><option value="approved">已通过</option><option value="rejected">已驳回</option></select>' +
        '<button class="btn btn-sm" id="c-search">筛选</button>' +
      '</div>' +
      '<div id="c-content"></div>';
    container.querySelectorAll('[data-tab]').forEach(function (b) {
      b.onclick = function () {
        tab = b.getAttribute('data-tab');
        container.querySelectorAll('[data-tab]').forEach(function (x) { x.classList.toggle('active', x === b); });
        states[tab].page = 1; states[tab].status = '';
        document.getElementById('c-status').value = '';
        load();
      };
    });
    document.getElementById('c-search').onclick = function () { states[tab].page = 1; states[tab].status = document.getElementById('c-status').value; load(); };
    load();
  }

  function load() {
    if (tab === 'comments') loadComments();
    else if (tab === 'catches') loadCatches();
    else loadReports();
  }

  // ---------- 评论 ----------
  function loadComments() {
    var st = states.comments;
    var q = { page: st.page, size: 20 }; if (st.status) q.status = st.status;
    window.AdminAPI.get('/admin/comments', q).then(function (d) {
      var list = d.data || [];
      var html = '<div class="toolbar"><button class="btn btn-sm btn-danger" id="c-batch-del">批量删除选中</button></div>' +
        '<div class="table-wrap"><table><thead><tr><th><input type="checkbox" id="c-all"></th><th>内容</th><th>钓点</th><th>用户</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="7" class="empty">暂无评论</td></tr>';
      else html += list.map(function (c) {
        return '<tr><td><input type="checkbox" class="c-row" value="' + c.id + '"></td>' +
          '<td class="wrap">' + esc(c.content) + '</td>' +
          '<td>' + esc(c.spot_name || '-') + '</td>' +
          '<td>' + esc(c.nickname || c.username || '-') + '</td>' +
          '<td>' + window.AdminUI.fmtDate(c.created_at) + '</td>' +
          '<td>' + window.AdminUI.statusBadge(c.status) + '</td>' +
          '<td class="nowrap">' + commentActions(c) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + window.AdminUI.pagination(d.pagination);
      var el = document.getElementById('c-content'); el.innerHTML = html;
      window.AdminUI.bindPager(el, function (pg) { st.page = pg; loadComments(); });
      el.querySelector('#c-batch-del').onclick = batchDeleteComments;
      var all = el.querySelector('#c-all'); if (all) all.onclick = function () { el.querySelectorAll('.c-row').forEach(function (x) { x.checked = all.checked; }); };
      el.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
          if (act === 'approve') reviewComment(id, 'approve');
          else if (act === 'reject') reviewComment(id, 'reject');
          else if (act === 'del') deleteComment(id);
        };
      });
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }
  function commentActions(c) {
    var b = '';
    if (c.status === 'pending') b += '<button class="btn btn-sm btn-primary" data-act="approve" data-id="' + c.id + '">通过</button> <button class="btn btn-sm" data-act="reject" data-id="' + c.id + '">驳回</button> ';
    b += '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + c.id + '">删除</button>';
    return b;
  }
  function reviewComment(id, action) {
    window.AdminAPI.put('/admin/comments/' + id + '/review', { action: action })
      .then(function () { window.AdminUI.toast('已' + (action === 'approve' ? '通过' : '驳回'), 'ok'); loadComments(); })
      .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }
  function deleteComment(id) {
    window.AdminUI.confirm('删除评论', '确定删除该评论？', function () {
      window.AdminAPI.del('/admin/comments/' + id)
        .then(function () { window.AdminUI.toast('已删除', 'ok'); loadComments(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    });
  }
  function batchDeleteComments() {
    var checked = document.querySelectorAll('#c-content .c-row:checked');
    if (!checked.length) { window.AdminUI.toast('请先选择', 'err'); return; }
    var ids = Array.prototype.map.call(checked, function (c) { return c.value; });
    window.AdminUI.confirm('批量删除', '确定删除 ' + ids.length + ' 条评论？', function () {
      window.AdminAPI.post('/admin/comments/batch-delete', { ids: ids })
        .then(function () { window.AdminUI.toast('已删除', 'ok'); loadComments(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    });
  }

  // ---------- 渔获 ----------
  function loadCatches() {
    var st = states.catches;
    var q = { page: st.page, size: 20 }; if (st.status) q.status = st.status;
    window.AdminAPI.get('/admin/catches', q).then(function (d) {
      var list = d.data || [];
      var html = '<div class="table-wrap"><table><thead><tr><th>内容/鱼种</th><th>钓点</th><th>用户</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="6" class="empty">暂无渔获</td></tr>';
      else html += list.map(function (c) {
        return '<tr><td class="wrap">' + esc(c.content || c.fish_species || '(无描述)') + '</td>' +
          '<td>' + esc(c.spot_name || '-') + '</td>' +
          '<td>' + esc(c.nickname || c.username || '-') + '</td>' +
          '<td>' + window.AdminUI.fmtDate(c.created_at) + '</td>' +
          '<td>' + window.AdminUI.statusBadge(c.status) + '</td>' +
          '<td class="nowrap">' + catchActions(c) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + window.AdminUI.pagination(d.pagination);
      var el = document.getElementById('c-content'); el.innerHTML = html;
      window.AdminUI.bindPager(el, function (pg) { st.page = pg; loadCatches(); });
      el.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
          if (act === 'approve') reviewCatch(id, 'approve');
          else if (act === 'reject') reviewCatch(id, 'reject');
          else if (act === 'del') deleteCatch(id);
        };
      });
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }
  function catchActions(c) {
    var b = '';
    if (c.status === 'pending') b += '<button class="btn btn-sm btn-primary" data-act="approve" data-id="' + c.id + '">通过</button> <button class="btn btn-sm" data-act="reject" data-id="' + c.id + '">驳回</button> ';
    b += '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + c.id + '">删除</button>';
    return b;
  }
  function reviewCatch(id, action) {
    window.AdminAPI.put('/admin/catches/' + id + '/review', { action: action })
      .then(function () { window.AdminUI.toast('已' + (action === 'approve' ? '通过' : '驳回'), 'ok'); loadCatches(); })
      .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }
  function deleteCatch(id) {
    window.AdminUI.confirm('删除渔获', '确定删除该渔获记录？', function () {
      window.AdminAPI.del('/admin/catches/' + id)
        .then(function () { window.AdminUI.toast('已删除', 'ok'); loadCatches(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    });
  }

  // ---------- 举报 ----------
  function loadReports() {
    var st = states.reports;
    var q = { page: st.page, size: 20 }; if (st.status) q.status = st.status;
    window.AdminAPI.get('/admin/reports', q).then(function (d) {
      var list = d.data || [];
      var tt = { spot: '钓点', comment: '评论', catch: '渔获' };
      var html = '<div class="table-wrap"><table><thead><tr><th>类型</th><th>对象</th><th>举报理由</th><th>举报人</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="7" class="empty">暂无举报</td></tr>';
      else html += list.map(function (r) {
        return '<tr><td>' + (tt[r.target_type] || r.target_type) + '</td>' +
          '<td class="wrap">' + esc(r.target_id) + '</td>' +
          '<td class="wrap">' + esc(r.reason || '-') + '</td>' +
          '<td>' + esc(r.reporter_name || '-') + '</td>' +
          '<td>' + window.AdminUI.fmtDate(r.created_at) + '</td>' +
          '<td>' + window.AdminUI.statusBadge(r.status) + '</td>' +
          '<td class="nowrap">' + reportActions(r) + '</td></tr>';
      }).join('') + '</tbody></table></div>' + window.AdminUI.pagination(d.pagination);
      var el = document.getElementById('c-content'); el.innerHTML = html;
      window.AdminUI.bindPager(el, function (pg) { st.page = pg; loadReports(); });
      el.querySelectorAll('[data-act]').forEach(function (b) {
        b.onclick = function () {
          var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
          if (act === 'ignore') handleReport(id, 'ignore');
          else if (act === 'handle') handleReport(id, 'handle');
        };
      });
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }
  function reportActions(r) {
    if (r.status === 'pending') return '<button class="btn btn-sm" data-act="ignore" data-id="' + r.id + '">忽略</button> <button class="btn btn-sm btn-danger" data-act="handle" data-id="' + r.id + '">处理</button>';
    return '<span style="color:var(--text-dim)">已处理</span>';
  }
  function handleReport(id, action) {
    var reason = action === 'handle' ? '已处理举报（下架/删除对应内容）' : '举报不成立，已忽略';
    window.AdminUI.confirm(action === 'handle' ? '处理举报' : '忽略举报',
      '确定' + (action === 'handle' ? '处理' : '忽略') + '该举报？对应内容将被' + (action === 'handle' ? '下架/删除' : '保留') + '。',
      function () {
        window.AdminAPI.put('/admin/reports/' + id + '/handle', { action: action, reason: reason })
          .then(function () { window.AdminUI.toast('已' + (action === 'handle' ? '处理' : '忽略'), 'ok'); loadReports(); })
          .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
      });
  }

  return { title: '内容审核', render: render };
})();
