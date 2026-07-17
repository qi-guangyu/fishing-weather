// 通用 UI 工具：转义、日期、Toast、Modal、确认框、状态徽章、分页
window.AdminUI = (function () {
  function escapeHtml(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(s) {
    if (!s) return '-';
    var d = new Date(s.indexOf('T') < 0 ? s.replace(' ', 'T') + 'Z' : s);
    if (isNaN(d.getTime())) return s;
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function toast(msg, type) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast ' + (type === 'err' ? 'err' : type === 'ok' ? 'ok' : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 2600);
  }

  function modal(html) {
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-mask" data-close></div><div class="modal">' + html + '</div>';
    root.classList.add('show');
    var mask = root.querySelector('[data-close]');
    if (mask) mask.onclick = closeModal;
  }

  function closeModal() {
    var root = document.getElementById('modal-root');
    root.classList.remove('show');
    root.innerHTML = '';
  }

  function confirm(title, text, onOk, okText) {
    modal(
      '<div class="modal-head"><h3>' + escapeHtml(title) + '</h3></div>' +
      '<div class="modal-body"><p style="color:var(--text-dim)">' + escapeHtml(text) + '</p></div>' +
      '<div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button>' +
      '<button class="btn btn-danger" id="cfm-ok">' + (okText || '确定') + '</button></div>'
    );
    var root = document.getElementById('modal-root');
    var c = root.querySelector('[data-close]'); if (c) c.onclick = closeModal;
    root.querySelector('#cfm-ok').onclick = function () { closeModal(); onOk(); };
  }

  var STATUS_MAP = {
    published: ['green', '已发布'], offline: ['gray', '已下架'], draft: ['amber', '草稿'],
    pending: ['amber', '待审核'], rejected: ['red', '已驳回'], deleted: ['red', '已删除'],
    approved: ['green', '已通过'], active: ['green', '启用'], inactive: ['gray', '停用'],
    ignored: ['gray', '已忽略'], handled: ['blue', '已处理'], banned: ['red', '已禁用']
  };
  function statusBadge(status) {
    var m = STATUS_MAP[status] || ['gray', status || '-'];
    return '<span class="badge ' + m[0] + '">' + m[1] + '</span>';
  }

  function roleBadge(role) {
    if (role === 'super_admin') return '<span class="badge super">超级管理员</span>';
    if (role === 'admin') return '<span class="badge blue">管理员</span>';
    return '<span class="badge gray">用户</span>';
  }

  function pagination(p) {
    if (!p || p.totalPages <= 1) return '';
    var html = '<div class="pager"><span class="info">共 ' + p.total + ' 条 · 第 ' + p.page + '/' + p.totalPages + ' 页</span>';
    html += '<button class="btn btn-sm" data-pg="1">«</button>';
    html += '<button class="btn btn-sm" data-pg="' + (p.page - 1) + '"' + (p.page <= 1 ? ' disabled' : '') + '>上一页</button>';
    html += '<button class="btn btn-sm" data-pg="' + (p.page + 1) + '"' + (p.page >= p.totalPages ? ' disabled' : '') + '>下一页</button>';
    html += '<button class="btn btn-sm" data-pg="' + p.totalPages + '">»</button></div>';
    return html;
  }

  function bindPager(container, onPage) {
    container.querySelectorAll('[data-pg]').forEach(function (btn) {
      btn.onclick = function () {
        var pg = parseInt(btn.getAttribute('data-pg'));
        if (!isNaN(pg) && pg >= 1) onPage(pg);
      };
    });
  }

  return {
    escapeHtml: escapeHtml, fmtDate: fmtDate, toast: toast, modal: modal, closeModal: closeModal,
    confirm: confirm, statusBadge: statusBadge, roleBadge: roleBadge,
    pagination: pagination, bindPager: bindPager
  };
})();
