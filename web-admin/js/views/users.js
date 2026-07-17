// 用户管理：列表查看 + 超级管理员修改角色/状态
window.Views = window.Views || {};
window.Views.users = (function () {
  var state = { page: 1 };
  function esc(s) { return window.AdminUI.escapeHtml(s); }
  function field(l, i) { return '<label class="field">' + l + i + '</label>'; }
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }

  function render(container) {
    container.innerHTML =
      '<div class="toolbar"><span class="hint" style="color:var(--text-dim)">查看用户列表；仅超级管理员可修改角色与状态</span></div>' +
      '<div id="users-table"></div>';
    load();
  }

  function load() {
    window.AdminAPI.get('/admin/users', { page: state.page, size: 20 }).then(function (d) {
      var list = d.data || [];
      var isSuper = window.AdminAuth.isSuper();
      var html = '<div class="table-wrap"><table><thead><tr><th>用户名</th><th>昵称</th><th>角色</th><th>状态</th><th>注册时间</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="6" class="empty">暂无用户</td></tr>';
      else html += list.map(function (u) {
        return '<tr>' +
          '<td>' + esc(u.username) + '</td>' +
          '<td>' + esc(u.nickname || '-') + '</td>' +
          '<td>' + window.AdminUI.roleBadge(u.role) + '</td>' +
          '<td>' + window.AdminUI.statusBadge(u.status || 'active') + '</td>' +
          '<td>' + window.AdminUI.fmtDate(u.created_at) + '</td>' +
          '<td class="nowrap">' + (isSuper
            ? '<button class="btn btn-sm" data-edit="' + u.id + '" data-role="' + u.role + '" data-status="' + (u.status || 'active') + '">编辑</button>'
            : '<span style="color:var(--text-dim)">无权限</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>' + window.AdminUI.pagination(d.pagination);
      var el = document.getElementById('users-table'); el.innerHTML = html;
      window.AdminUI.bindPager(el, function (pg) { state.page = pg; load(); });
      el.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () { editUser(b.getAttribute('data-edit'), b.getAttribute('data-role'), b.getAttribute('data-status')); };
      });
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function editUser(id, role, status) {
    var html = '<div class="modal-head"><h3>编辑用户</h3><button class="modal-close" data-close>×</button></div>' +
      '<div class="modal-body">' +
        field('角色', sel('u-role', [['user', '普通用户'], ['admin', '管理员'], ['super_admin', '超级管理员']], role)) +
        field('状态', sel('u-status', [['active', '正常'], ['banned', '禁用']], status)) +
      '</div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="u-save">保存</button></div>';
    window.AdminUI.modal(html);
    var root = document.getElementById('modal-root');
    var c = root.querySelector('[data-close]'); if (c) c.onclick = window.AdminUI.closeModal;
    root.querySelector('#u-save').onclick = function () {
      window.AdminAPI.put('/admin/users/' + id, { role: document.getElementById('u-role').value, status: document.getElementById('u-status').value })
        .then(function () { window.AdminUI.closeModal(); window.AdminUI.toast('已保存', 'ok'); load(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    };
  }

  return { title: '用户管理', render: render };
})();
