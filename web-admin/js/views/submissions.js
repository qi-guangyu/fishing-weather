// 投稿审核：用户提交的钓点待管理员通过/驳回
window.Views = window.Views || {};
window.Views.submissions = (function () {
  var state = { page: 1, status: '' };
  function esc(s) { return window.AdminUI.escapeHtml(s); }

  function render(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<select id="s-status"><option value="">全部投稿</option><option value="pending">待审核</option><option value="rejected">已驳回</option></select>' +
        '<button class="btn btn-sm" id="s-search">筛选</button>' +
        '<span class="grow"></span>' +
        '<span class="hint" style="color:var(--text-dim)">用户投稿需审核通过后才对外展示</span>' +
      '</div>' +
      '<div id="sub-table"></div>';
    document.getElementById('s-search').onclick = function () {
      state.page = 1; state.status = document.getElementById('s-status').value; load();
    };
    load();
  }

  function load() {
    var q = { page: state.page, size: 20 };
    if (state.status) q.status = state.status;
    window.AdminAPI.get('/admin/submissions', q).then(renderTable).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function renderTable(d) {
    var list = d.data || [];
    var html = '<div class="table-wrap"><table><thead><tr><th>名称</th><th>地区</th><th>水体</th><th>提交人</th><th>时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    if (!list.length) html += '<tr><td colspan="7" class="empty">暂无投稿</td></tr>';
    else html += list.map(function (s) {
      return '<tr>' +
        '<td class="wrap">' + esc(s.name) + '</td>' +
        '<td>' + esc([s.province, s.city, s.district].filter(Boolean).join('/') || '-') + '</td>' +
        '<td>' + esc(s.water_type || '-') + '</td>' +
        '<td>' + esc(s.submitter_name || '-') + '</td>' +
        '<td>' + window.AdminUI.fmtDate(s.created_at) + '</td>' +
        '<td>' + window.AdminUI.statusBadge(s.status) + '</td>' +
        '<td class="nowrap">' + rowActions(s) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
    html += window.AdminUI.pagination(d.pagination);
    var el = document.getElementById('sub-table'); el.innerHTML = html;
    window.AdminUI.bindPager(el, function (pg) { state.page = pg; load(); });
    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
        if (act === 'approve') review(id, 'approve');
        else if (act === 'reject') reject(id);
      };
    });
  }

  function rowActions(s) {
    if (s.status === 'pending') return '<button class="btn btn-sm btn-primary" data-act="approve" data-id="' + s.id + '">通过</button> <button class="btn btn-sm btn-danger" data-act="reject" data-id="' + s.id + '">驳回</button>';
    return '<span style="color:var(--text-dim)">已处理</span>';
  }

  function review(id, action) {
    window.AdminAPI.put('/admin/submissions/' + id + '/review', { action: action })
      .then(function () { window.AdminUI.toast('已通过', 'ok'); load(); })
      .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function reject(id) {
    var html = '<div class="modal-head"><h3>驳回投稿</h3><button class="modal-close" data-close>×</button></div>' +
      '<div class="modal-body"><label class="field">驳回理由<textarea id="r-reason" placeholder="请填写驳回理由（可选）"></textarea></label></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-danger" id="r-ok">确认驳回</button></div>';
    window.AdminUI.modal(html);
    var root = document.getElementById('modal-root');
    var c = root.querySelector('[data-close]'); if (c) c.onclick = window.AdminUI.closeModal;
    root.querySelector('#r-ok').onclick = function () {
      window.AdminAPI.put('/admin/submissions/' + id + '/review', { action: 'reject', reason: document.getElementById('r-reason').value })
        .then(function () { window.AdminUI.closeModal(); window.AdminUI.toast('已驳回', 'ok'); load(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    };
  }

  return { title: '投稿审核', render: render };
})();
