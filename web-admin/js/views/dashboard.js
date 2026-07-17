// 统计看板：数据概览 + 趋势 + 排行榜 + 地区分布 + 操作日志 + 天气刷新
window.Views = window.Views || {};
window.Views.dashboard = {
  title: '统计看板',
  render: function (container) {
    container.innerHTML =
      '<div class="row between" style="margin-bottom:16px">' +
        '<strong style="font-size:15px">数据概览</strong>' +
        '<button class="btn btn-sm" id="btn-refresh-weather">🔄 刷新气象缓存</button>' +
      '</div>' +
      '<div id="stat-grid" class="stat-grid"><div class="empty">加载中...</div></div>' +
      '<div class="row" style="align-items:flex-start;margin-top:18px">' +
        '<div class="card" style="flex:2;min-width:300px"><h3>近 7 天新增趋势 <span class="hint">钓点</span></h3><div id="trend"></div></div>' +
        '<div class="card" style="flex:1;min-width:240px"><h3>地区钓点分布</h3><div id="districts"></div></div>' +
      '</div>' +
      '<div class="row" style="align-items:flex-start">' +
        '<div class="card" style="flex:1;min-width:240px"><h3>🔥 收藏 Top10</h3><div id="rank-fav" class="rank-list"></div></div>' +
        '<div class="card" style="flex:1;min-width:240px"><h3>🎣 渔获 Top10</h3><div id="rank-catch" class="rank-list"></div></div>' +
        '<div class="card" style="flex:1;min-width:240px"><h3>💬 评论 Top10</h3><div id="rank-cmt" class="rank-list"></div></div>' +
      '</div>' +
      '<div class="card"><h3>📋 最近操作日志</h3><div id="logs"></div></div>';

    document.getElementById('btn-refresh-weather').onclick = function () {
      var btn = this; btn.disabled = true; btn.textContent = '刷新中...';
      window.AdminAPI.post('/admin/weather/refresh')
        .then(function (r) { window.AdminUI.toast('已刷新 ' + r.updated + '/' + r.total + ' 个钓点', 'ok'); })
        .catch(function (e) { window.AdminUI.toast(e.message, 'err'); })
        .finally(function () { btn.disabled = false; btn.textContent = '🔄 刷新气象缓存'; });
    };

    loadStats();
    loadLogs();
  }
};

function loadStats() {
  window.AdminAPI.get('/admin/statistics').then(function (d) {
    var t = d.totals || {};
    var cards = [
      { n: t.spots || 0, l: '钓点总数' },
      { n: t.published || 0, l: '已发布', c: 'green' },
      { n: t.pendingSubmissions || 0, l: '待审投稿', alert: t.pendingSubmissions > 0 },
      { n: t.offline || 0, l: '已下架' },
      { n: t.catches || 0, l: '渔获数' },
      { n: t.comments || 0, l: '评论数' },
      { n: t.pendingReports || 0, l: '待处理举报', alert: t.pendingReports > 0 }
    ];
    document.getElementById('stat-grid').innerHTML = cards.map(function (c) {
      return '<div class="stat' + (c.alert ? ' alert' : '') + '"><div class="num">' + c.n + '</div><div class="lbl">' + c.l + '</div></div>';
    }).join('');

    renderTrend(d.trends);
    renderRank('rank-fav', d.topFavorites, 'favorites_count');
    renderRank('rank-catch', d.topCatches, 'catches_count');
    renderRank('rank-cmt', d.topComments, 'comments_count');

    return window.AdminAPI.get('/admin/statistics/districts');
  }).then(function (dd) {
    var list = (dd && dd.data) || [];
    document.getElementById('districts').innerHTML = list.length
      ? list.slice(0, 12).map(function (r) {
          return '<div class="rank-item"><span class="nm">' + window.AdminUI.escapeHtml(r.name) + '</span><span class="vl">' + (r.spot_count || 0) + '</span></div>';
        }).join('')
      : '<div class="empty">暂无数据</div>';
  }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
}

function renderTrend(trends) {
  var el = document.getElementById('trend');
  var spots = (trends && trends.spots) || [];
  if (!spots.length) { el.innerHTML = '<div class="empty">近 7 天暂无新增</div>'; return; }
  var max = Math.max.apply(null, spots.map(function (s) { return s.cnt; }).concat([1]));
  el.innerHTML = '<div class="trend">' + spots.map(function (s) {
    var h = Math.round((s.cnt / max) * 100);
    return '<div class="bar" style="height:' + h + '%" title="' + s.day + ': ' + s.cnt + ' 个"><span>' + s.day.slice(5) + '</span></div>';
  }).join('') + '</div>';
}

function renderRank(id, list, field) {
  var el = document.getElementById(id);
  if (!list || !list.length) { el.innerHTML = '<div class="empty">暂无数据</div>'; return; }
  el.innerHTML = list.map(function (s, i) {
    return '<div class="rank-item"><span class="rk">' + (i + 1) + '</span><span class="nm">' + window.AdminUI.escapeHtml(s.name) + '</span><span class="vl">' + (s[field] || 0) + '</span></div>';
  }).join('');
}

function loadLogs() {
  window.AdminAPI.get('/admin/logs', { page: 1, size: 10 }).then(function (d) {
    var list = d.data || [];
    document.getElementById('logs').innerHTML = list.length
      ? '<div class="table-wrap"><table><thead><tr><th>时间</th><th>管理员</th><th>操作</th><th>详情</th></tr></thead><tbody>' +
        list.map(function (l) {
          return '<tr><td>' + window.AdminUI.fmtDate(l.created_at) + '</td><td>' + window.AdminUI.escapeHtml(l.admin_name || '-') +
            '</td><td>' + window.AdminUI.escapeHtml(l.action) + '</td><td class="wrap">' + window.AdminUI.escapeHtml(l.detail || '') + '</td></tr>';
        }).join('') + '</tbody></table></div>'
      : '<div class="empty">暂无日志</div>';
  }).catch(function (e) { window.AdminUI.toast(e.message, 'err'); });
}
