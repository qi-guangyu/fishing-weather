// 钓点管理：列表/筛选/分页/批量操作/状态切换/编辑/导出
window.Views = window.Views || {};
window.Views.spots = (function () {
  var state = { page: 1, filters: {} };

  function esc(s) { return window.AdminUI.escapeHtml(s); }
  function v(id) { var el = document.getElementById(id); return el ? el.value : ''; }
  function num(n) { return (n === undefined || n === null) ? '' : n; }
  function field(l, i) { return '<label class="field">' + l + i + '</label>'; }
  function sel(id, opts, val) {
    return '<select id="' + id + '">' + opts.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>';
    }).join('') + '</select>';
  }

  function render(container) {
    container.innerHTML =
      '<div class="toolbar">' +
        '<select id="f-status"><option value="">全部状态</option><option value="published">已发布</option><option value="offline">已下架</option><option value="draft">草稿</option><option value="pending">待审核</option></select>' +
        '<select id="f-water"><option value="">水体类型</option><option>水库</option><option>河流</option><option>湖泊</option><option>野塘</option><option>黑坑</option><option>江河</option></select>' +
        '<select id="f-fee"><option value="">收费类型</option><option value="free">免费</option><option value="paid">收费</option></select>' +
        '<input id="f-keyword" placeholder="名称/地址关键词">' +
        '<select id="f-sort"><option value="">默认排序</option><option value="favorites">按收藏</option><option value="comments">按评论</option></select>' +
        '<button class="btn btn-sm" id="btn-search">搜索</button>' +
        '<span class="grow"></span>' +
        '<button class="btn btn-sm" id="btn-export">⬇ 导出CSV</button>' +
        '<button class="btn btn-sm btn-primary" id="btn-add">+ 新增钓点</button>' +
      '</div>' +
      '<div id="batch-bar" class="toolbar" style="display:none">' +
        '<span id="sel-info" style="color:var(--text-dim)"></span>' +
        '<button class="btn btn-sm" data-batch="publish">批量上架</button>' +
        '<button class="btn btn-sm" data-batch="offline">批量下架</button>' +
        '<button class="btn btn-sm btn-danger" data-batch="delete">批量删除</button>' +
      '</div>' +
      '<div id="spots-table"></div>';

    var self = this;
    document.getElementById('btn-search').onclick = function () {
      state.page = 1;
      state.filters = { status: v('f-status'), water_type: v('f-water'), fee_type: v('f-fee'), keyword: v('f-keyword'), sort: v('f-sort') };
      load();
    };
    document.getElementById('f-keyword').addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('btn-search').click(); });
    document.getElementById('btn-export').onclick = function () { window.open('/api/admin/spots/export', '_blank'); };
    document.getElementById('btn-add').onclick = function () { openEditor(null); };
    container.querySelectorAll('[data-batch]').forEach(function (b) {
      b.onclick = function () { batch(b.getAttribute('data-batch')); };
    });
    load();
  }

  function load() {
    var q = Object.assign({ page: state.page, size: 20 }, state.filters);
    window.AdminAPI.get('/admin/spots', q).then(renderTable).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function renderTable(d) {
    var list = d.data || [];
    var html = '<div class="table-wrap"><table><thead><tr>' +
      '<th><input type="checkbox" id="sel-all"></th><th>名称</th><th>地区</th><th>水体</th><th>收费</th><th>收藏</th><th>评论</th><th>状态</th><th>提交人</th><th>操作</th></tr></thead><tbody>';
    if (!list.length) html += '<tr><td colspan="10" class="empty">暂无钓点</td></tr>';
    else html += list.map(function (s) {
      return '<tr data-id="' + s.id + '">' +
        '<td><input type="checkbox" class="sel-row" value="' + s.id + '"></td>' +
        '<td class="wrap">' + esc(s.name) + '</td>' +
        '<td>' + esc([s.province, s.city, s.district].filter(Boolean).join('/') || '-') + '</td>' +
        '<td>' + esc(s.water_type || '-') + '</td>' +
        '<td>' + (s.fee_type === 'free' ? '免费' : s.fee_type === 'paid' ? '收费' : (s.fee_type || '-')) + (s.fee_price ? ' ¥' + s.fee_price : '') + '</td>' +
        '<td>' + (s.favorites_count || 0) + '</td>' +
        '<td>' + (s.comments_count || 0) + '</td>' +
        '<td>' + window.AdminUI.statusBadge(s.status) + '</td>' +
        '<td>' + esc(s.submitter_name || '-') + '</td>' +
        '<td class="nowrap">' + rowActions(s) + '</td>' +
      '</tr>';
    }).join('') + '</tbody></table></div>';
    html += window.AdminUI.pagination(d.pagination);

    var el = document.getElementById('spots-table');
    el.innerHTML = html;
    window.AdminUI.bindPager(el, function (pg) { state.page = pg; load(); });

    var selAll = el.querySelector('#sel-all');
    if (selAll) selAll.onclick = function () { el.querySelectorAll('.sel-row').forEach(function (c) { c.checked = selAll.checked; }); updateSel(el); };
    el.querySelectorAll('.sel-row').forEach(function (c) { c.onclick = function () { updateSel(el); }; });
    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.onclick = function () {
        var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
        if (act === 'edit') openEditor(id);
        else if (act === 'online') setStatus(id, 'published');
        else if (act === 'offline') setStatus(id, 'offline');
        else if (act === 'draft') setStatus(id, 'draft');
        else if (act === 'del') setStatus(id, 'deleted');
      };
    });
  }

  function updateSel(el) {
    var checked = el.querySelectorAll('.sel-row:checked');
    var bar = document.getElementById('batch-bar');
    if (bar) {
      bar.style.display = checked.length ? 'flex' : 'none';
      var info = document.getElementById('sel-info');
      if (info) info.textContent = '已选 ' + checked.length + ' 个';
    }
  }

  function rowActions(s) {
    var b = '';
    if (s.status !== 'published') b += '<button class="btn btn-sm btn-primary" data-act="online" data-id="' + s.id + '">上架</button> ';
    if (s.status === 'published') b += '<button class="btn btn-sm" data-act="offline" data-id="' + s.id + '">下架</button> ';
    b += '<button class="btn btn-sm" data-act="edit" data-id="' + s.id + '">编辑</button> ';
    if (window.AdminAuth.isSuper()) b += '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + s.id + '">删除</button>';
    return b;
  }

  function setStatus(id, status) {
    var map = { published: '上架', offline: '下架', draft: '转草稿', deleted: '删除' };
    window.AdminUI.confirm(map[status] + '钓点', '确定要' + map[status] + '该钓点吗？', function () {
      window.AdminAPI.put('/admin/spots/' + id + '/status', { status: status })
        .then(function () { window.AdminUI.toast('操作成功', 'ok'); load(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    }, '确定' + map[status]);
  }

  function batch(action) {
    var checked = document.querySelectorAll('#spots-table .sel-row:checked');
    if (!checked.length) { window.AdminUI.toast('请先选择钓点', 'err'); return; }
    var ids = Array.prototype.map.call(checked, function (c) { return c.value; });
    var map = { publish: '上架', offline: '下架', delete: '删除' };
    if (action === 'delete' && !window.AdminAuth.isSuper()) { window.AdminUI.toast('仅超级管理员可批量删除', 'err'); return; }
    window.AdminUI.confirm('批量' + map[action], '确定批量' + map[action] + ' ' + ids.length + ' 个钓点？', function () {
      window.AdminAPI.post('/admin/spots/batch', { ids: ids, action: action })
        .then(function () { window.AdminUI.toast('已批量' + map[action], 'ok'); load(); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
    });
  }

  function openEditor(id) {
    var p = id ? window.AdminAPI.get('/admin/spots/' + id) : Promise.resolve({ data: {} });
    p.then(function (r) {
      var s = r.data || {};
      var isEdit = !!id;
      var html = '<div class="modal-head"><h3>' + (isEdit ? '编辑钓点' : '新增钓点') + '</h3><button class="modal-close" data-close>×</button></div>' +
        '<div class="modal-body">' +
          field('名称', '<input id="e-name" value="' + esc(s.name || '') + '">') +
          field('地址', '<input id="e-address" value="' + esc(s.address || '') + '">') +
          '<div class="row"><div style="flex:1">' + field('省份', '<input id="e-province" value="' + esc(s.province || '') + '">') + '</div><div style="flex:1">' + field('城市', '<input id="e-city" value="' + esc(s.city || '') + '">') + '</div><div style="flex:1">' + field('区县', '<input id="e-district" value="' + esc(s.district || '') + '">') + '</div></div>' +
          '<div class="row"><div style="flex:1">' + field('纬度', '<input id="e-lat" value="' + num(s.latitude) + '">') + '</div><div style="flex:1">' + field('经度', '<input id="e-lng" value="' + num(s.longitude) + '">') + '</div></div>' +
          '<div class="row"><div style="flex:1">' + field('水体类型', '<input id="e-water" value="' + esc(s.water_type || '') + '">') + '</div><div style="flex:1">' + field('目标鱼种', '<input id="e-fish" value="' + esc(s.target_fish || '') + '">') + '</div></div>' +
          '<div class="row"><div style="flex:1">' + field('收费类型', sel('e-fee', [['', '未知'], ['free', '免费'], ['paid', '收费']], s.fee_type)) + '</div><div style="flex:1">' + field('价格(元)', '<input id="e-price" value="' + num(s.fee_price) + '">') + '</div></div>' +
          field('状态', sel('e-status', [['published', '已发布'], ['offline', '已下架'], ['draft', '草稿'], ['pending', '待审核']], s.status || 'published')) +
          field('描述', '<textarea id="e-desc">' + esc(s.description || '') + '</textarea>') +
        '</div>' +
        '<div class="modal-foot"><button class="btn btn-ghost" data-close>取消</button><button class="btn btn-primary" id="e-save">保存</button></div>';
      window.AdminUI.modal(html);
      var root = document.getElementById('modal-root');
      var c = root.querySelector('[data-close]'); if (c) c.onclick = window.AdminUI.closeModal;
      root.querySelector('#e-save').onclick = function () { save(id); };
    }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  function save(id) {
    var fd = new FormData();
    ['name', 'address', 'province', 'city', 'district', 'latitude', 'longitude', 'water_type', 'target_fish', 'fee_type', 'fee_price', 'status', 'description'].forEach(function (k) {
      fd.append(k, v('e-' + (k === 'description' ? 'desc' : k === 'fee_price' ? 'price' : k)));
    });
    var p = id ? window.AdminAPI.put('/admin/spots/' + id, fd) : window.AdminAPI.post('/admin/spots', fd);
    p.then(function () { window.AdminUI.closeModal(); window.AdminUI.toast('保存成功', 'ok'); load(); })
      .catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
  }

  return { title: '钓点管理', render: render };
})();
