// 页面管理：运营公告 / Banner（小程序首页展示）
window.Views = window.Views || {};
window.Views.pages = (function () {
  function esc(s) { return window.AdminUI.escapeHtml(s); }
  function field(l, i) { return '<label class="field">' + l + i + '</label>'; }
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }

  function render(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<span class="hint" style="color:var(--text-dim)">运营公告 / Banner：启用后在小程序首页展示</span>' +
        '<span class="grow"></span>' +
        '<button class="btn btn-sm btn-primary" id="p-add">+ 新增公告</button>' +
      '</div>' +
      '<div id="pages-table"></div>';
    document.getElementById('p-add').onclick = function () { openEditor(null); };
    load();
  }

  function load() {
    window.AdminAPI.get('/admin/announcements').then(function (d) {
      var list = d.data || [];
      var html = '<div class="table-wrap"><table><thead><tr><th>标题</th><th>类型</th><th>内容</th><th>跳转链接</th><th>排序</th><th>状态</th><th>操作</th></tr></thead><tbody>';
      if (!list.length) html += '<tr><td colspan="7" class="empty">暂无公告</td></tr>';
      else html += list.map(function (a) {
        return '<tr>' +
          '<td>' + esc(a.title) + '</td>' +
          '<td>' + (a.type === 'banner' ? '<span class="badge blue">Banner</span>' : '<span class="badge gray">公告</span>') + '</td>' +
          '<td class="wrap">' + esc(a.content || '-') + '</td>' +
          '<td class="wrap">' + esc(a.link || '-') + '</td>' +
          '<td>' + (a.sort_order || 0) + '</td>' +
          '<td>' + window.AdminUI.statusBadge(a.status) + '</td>' +
          '<td class="nowrap"><button class="btn btn-sm" data-edit="' + a.id + '">编辑</button> <button class="btn btn-sm btn-danger" data-del="' + a.id + '">删除</button></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
      var el = document.getElementById('pages-table'); el.innerHTML = html;
      el.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { openEditor(b.getAttribute('data-edit')); }; });
      el.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { delAnn(b.getAttribute('data-del')); }; });
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function openEditor(id) {
    var p = id
      ? window.AdminAPI.get('/admin/announcements').then(function (d) { return { data: (d.data || []).filter(function (x) { return x.id === id; })[0] || {} }; })
      : Promise.resolve({ data: {} });
    p.then(function (r) {
      var a = r.data || {};
      var html = '<div class="modal-head"><h3>' + (id ? '编辑公告' : '新增公告') + '</h3><button class="modal-close" data-close>×</button></div>' +
        '<div class="modal-body">' +
          field('标题', '<input id="a-title" value="' + esc(a.title || '') + '">') +
          field('类型', sel('a-type', [['announcement', '公告条'], ['banner', 'Banner 大图']], a.type || 'announcement')) +
          field('内容', '<textarea id="a-content">' + esc(a.content || '') + '</textarea>') +
          field('跳转链接', '<input id="a-link" value="' + esc(a.link || '') + '" placeholder="如 /pages/index/index">') +
          '<div class="row"><div style="flex:1">' + field('排序', '<input id="a-sort" value="' + (a.sort_order || 0) + '">') + '</div>' +
          '<div style="flex:1">' + field('状态', sel('a-status', [['active', '启用'], ['inactive', '停用']], a.status || 'active')) + '</div></div>' +
        '</div>' +
        '<div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="a-save">保存</button></div>';
      window.AdminUI.modal(html);
      var root = document.getElementById('modal-root');
      var c = root.querySelector('[data-close]'); if (c) c.onclick = window.AdminUI.closeModal;
      root.querySelector('#a-save').onclick = function () {
        var body = {
          title: document.getElementById('a-title').value,
          type: document.getElementById('a-type').value,
          content: document.getElementById('a-content').value,
          link: document.getElementById('a-link').value,
          sort_order: document.getElementById('a-sort').value,
          status: document.getElementById('a-status').value
        };
        if (!body.title) { window.AdminUI.toast('标题不能为空', 'err'); return; }
        var pp = id ? window.AdminAPI.put('/admin/announcements/' + id, body) : window.AdminAPI.post('/admin/announcements', body);
        pp.then(function () { window.AdminUI.closeModal(); window.AdminUI.toast('已保存', 'ok'); load(); })
          .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
      };
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function delAnn(id) {
    window.AdminUI.confirm('删除公告', '确定删除该公告？', function () {
      window.AdminAPI.del('/admin/announcements/' + id)
        .then(function () { window.AdminUI.toast('已删除', 'ok'); load(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    });
  }

  return { title: '页面管理', render: render };
})();
