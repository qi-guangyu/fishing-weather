// 认证状态管理（token + 用户信息存 localStorage）
window.AdminAuth = {
  getToken: function () { return localStorage.getItem('admin_token'); },
  getUser: function () {
    try { return JSON.parse(localStorage.getItem('admin_user')); } catch (e) { return null; }
  },
  isLoggedIn: function () {
    var u = this.getUser();
    return !!(u && u.role && (u.role === 'super_admin' || u.role === 'admin'));
  },
  setSession: function (token, user) {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_user', JSON.stringify(user));
  },
  logout: function () {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
  },
  isSuper: function () {
    var u = this.getUser();
    return !!(u && u.role === 'super_admin');
  }
};
