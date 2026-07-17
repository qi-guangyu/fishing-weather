// 应用启动：登录态判断、登录页、侧边栏、顶栏
(function () {
  var MENUS = [
    { view: 'dashboard', label: '统计看板', icon: '📊' },
    { view: 'spots', label: '钓点管理', icon: '📍' },
    { view: 'submissions', label: '投稿审核', icon: '📝' },
    { view: 'content', label: '内容审核', icon: '💬' },
    { view: 'users', label: '用户管理', icon: '👤' },
    { view: 'pages', label: '页面管理', icon: '📄' }
  ];

  function showLogin() {
    document.getElementById('app-view').classList.add('hidden');
    var lv = document.getElementById('login-view');
    lv.classList.remove('hidden');
    lv.innerHTML =
      '<div class="login-card">' +
      '<h1>🎣 钓鱼天气</h1><div class="sub">管理后台登录</div>' +
      '<label class="field" style="margin-bottom:14px">账号<input id="lg-user" placeholder="管理员账号" value="admin"></label>' +
      '<label class="field" style="margin-bottom:18px">密码<input id="lg-pass" type="password" placeholder="密码" value="admin123"></label>' +
      '<button class="btn btn-primary" id="lg-btn" style="width:100%;justify-content:center">登 录</button>' +
      '<p id="lg-err" style="color:var(--danger);font-size:12px;margin-top:10px;min-height:16px"></p>' +
      '</div>';
    document.getElementById('lg-btn').onclick = doLogin;
    document.getElementById('lg-pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  }

  function doLogin() {
    var u = document.getElementById('lg-user').value.trim();
    var p = document.getElementById('lg-pass').value;
    var err = document.getElementById('lg-err');
    if (!u || !p) { err.textContent = '请输入账号和密码'; return; }
    var btn = document.getElementById('lg-btn');
    btn.disabled = true; btn.textContent = '登录中...';
    window.AdminAPI.post('/auth/login', { username: u, password: p })
      .then(function (r) {
        if (!r.user || (r.user.role !== 'super_admin' && r.user.role !== 'admin')) {
          window.AdminAuth.setSession(r.token, r.user);
          window.AdminAuth.logout();
          throw new Error('该账号无管理权限');
        }
        window.AdminAuth.setSession(r.token, r.user);
        showApp();
      })
      .catch(function (e) {
        err.textContent = e.message || '登录失败';
        btn.disabled = false; btn.textContent = '登 录';
      });
  }

  function showApp() {
    document.getElementById('login-view').classList.add('hidden');
    var av = document.getElementById('app-view');
    av.classList.remove('hidden');
    renderMenu();
    renderTopbar();
    window.Router.start();
  }

  function renderMenu() {
    var nav = document.getElementById('menu');
    nav.innerHTML = MENUS.map(function (m) {
      return '<a href="#/' + m.view + '" data-view="' + m.view + '"><span class="ico">' + m.icon + '</span>' + m.label + '</a>';
    }).join('');
  }

  function renderTopbar() {
    var u = window.AdminAuth.getUser();
    var roleText = u.role === 'super_admin' ? '超级管理员' : '管理员';
    document.getElementById('user-name').textContent = (u.nickname || u.username) + '（' + roleText + '）';
    document.getElementById('logout-btn').onclick = function () {
      window.AdminUI.confirm('退出登录', '确定要退出当前账号吗？', function () {
        window.AdminAuth.logout();
        location.reload();
      });
    };
  }

  if (window.AdminAuth.isLoggedIn()) showApp();
  else showLogin();
})();
