// 请求封装：同源默认 '/api'，独立部署时可在 index.html 前设置 window.API_BASE = 'https://你的后端域名'
window.AdminAPI = (function () {
  var BASE = window.API_BASE || '';

  function buildQuery(q) {
    if (!q) return '';
    var parts = [];
    Object.keys(q).forEach(function (k) {
      if (q[k] !== undefined && q[k] !== null && q[k] !== '') {
        parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(q[k]));
      }
    });
    return parts.length ? ('?' + parts.join('&')) : '';
  }

  function request(path, opts) {
    opts = opts || {};
    var token = localStorage.getItem('admin_token');
    var headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body !== undefined && opts.body !== null) {
      if (typeof FormData !== 'undefined' && opts.body instanceof FormData) {
        init.body = opts.body; // 浏览器自动设置 multipart boundary（上传文件用）
      } else {
        headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(opts.body);
      }
    }
    return fetch(BASE + '/api' + path + (opts.query ? buildQuery(opts.query) : ''), init)
      .then(function (resp) {
        if (resp.status === 401) {
          if (window.AdminAuth) window.AdminAuth.logout();
          if (location.hash !== '#/login') location.hash = '#/login';
          throw new Error('登录已过期，请重新登录');
        }
        return resp.json().catch(function () { return {}; }).then(function (data) {
          if (!resp.ok) throw new Error(data.error || ('请求失败 (' + resp.status + ')'));
          return data;
        });
      });
  }

  return {
    get: function (p, q) { return request(p, { method: 'GET', query: q }); },
    post: function (p, b) { return request(p, { method: 'POST', body: b }); },
    put: function (p, b) { return request(p, { method: 'PUT', body: b }); },
    del: function (p, b) { return request(p, { method: 'DELETE', body: b }); }
  };
})();
