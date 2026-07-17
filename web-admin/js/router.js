// 极简 hash 路由：#/viewName -> Views[viewName].render(container)
window.Router = {
  start: function () {
    var self = this;
    window.addEventListener('hashchange', function () { self.render(); });
    if (!location.hash || location.hash === '#/login') location.hash = '#/dashboard';
    else self.render();
  },
  go: function (v) { location.hash = '#/' + v; },
  render: function () {
    var view = (location.hash.replace('#/', '').split('?')[0]) || 'dashboard';
    var v = window.Views && window.Views[view];
    var container = document.getElementById('view-container');
    if (!v) { container.innerHTML = '<div class="empty">页面不存在</div>'; return; }
    document.getElementById('page-title').textContent = v.title || '';
    var links = document.querySelectorAll('#menu a');
    links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-view') === view); });
    container.innerHTML = '';
    try { v.render(container); }
    catch (e) { container.innerHTML = '<div class="empty">加载失败：' + (e && e.message ? e.message : e) + '</div>'; }
  }
};
