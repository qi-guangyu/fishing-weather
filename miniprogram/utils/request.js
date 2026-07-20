/**
 * 统一请求封装
 *
 * 双模式：
 *  1) callContainer 私有协议（config.CLOUD_ENV 已填）：走微信云托管私有通道，
 *     免配置 request 合法域名、不受网关 INVALID_HOST 限制，体验版/预览即可直接用。
 *  2) 直连模式（CLOUD_ENV 为空）：用 API_BASE + wx.request，仅本地调试或已备案自定义域名时有效。
 */

const { SERVICE_NAME } = require('../config.js')

function buildQuery(data) {
  if (!data) return ''
  const keys = Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null)
  if (!keys.length) return ''
  const qs = keys
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(data[k]))
    .join('&')
  return '?' + qs
}

function request(options) {
  return new Promise((resolve, reject) => {
    const app = getApp()
    if (!app || !app.globalData) {
      reject({ code: -1, message: '应用未初始化' })
      return
    }

    const cloudEnv = app.globalData.cloudEnv
    const token = wx.getStorageSync('token')
    const method = options.method || 'GET'
    const isGet = method === 'GET'

    // callContainer 模式下 GET 参数拼进 path，POST/PUT 走 data
    const path = options.url + (isGet ? buildQuery(options.data) : '')
    const body = isGet ? {} : (options.data || {})

    const header = {
      'Content-Type': 'application/json',
      'Authorization': token ? 'Bearer ' + token : '',
      ...options.header
    }

    if (cloudEnv) {
      // ===== 路线 B：callContainer 私有协议 =====
      // 防御：真机基础库若不支持 callContainer / init 未就绪，直接同步抛错会导致页面 onLoad 崩溃（白屏只剩框架）。
      // 这里全部转成 reject，由页面 catch 走 mock 兜底，绝不白屏。
      if (typeof wx.cloud === 'undefined' || typeof wx.cloud.callContainer !== 'function') {
        reject({ code: -2, message: '当前微信版本不支持 callContainer，请升级微信到最新版' })
        return
      }
      // 超时兜底：真机首次 callContainer 可能卡在云登录握手（既不 success 也不 fail），
      // 导致页面 await 永远不返回、白屏只剩框架。8s 后强制 reject，由页面走 mock/空态，绝不白屏。
      let settled = false
      const timer = setTimeout(function () {
        if (settled) return
        settled = true
        reject({ code: -3, message: '请求超时（云托管握手未完成）' })
      }, 8000)
      try {
        wx.cloud.callContainer({
          config: { env: cloudEnv },
          path: path,
          method: method,
          data: body,
          header: Object.assign({ 'X-WX-SERVICE': SERVICE_NAME }, header),
          success(res) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            handleResponse(res, app, resolve, reject)
          },
          fail(err) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            reject({ code: -1, message: '网络错误', detail: err })
          }
        })
      } catch (e) {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject({ code: -1, message: 'callContainer 调用异常', detail: e })
      }
    } else {
      // ===== 直连模式 =====
      wx.request({
        url: (options.baseUrl || app.globalData.apiBase) + options.url,
        method: method,
        data: options.data || {},
        header: header,
        success(res) {
          handleResponse(res, app, resolve, reject)
        },
        fail(err) {
          reject({ code: -1, message: '网络错误', detail: err })
        }
      })
    }
  })
}

function handleResponse(res, app, resolve, reject) {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    resolve(res.data)
  } else if (res.statusCode === 401) {
    wx.removeStorageSync('token')
    wx.removeStorageSync('userInfo')
    app.globalData.token = null
    app.globalData.userInfo = null
    reject({ code: 401, message: '登录已过期，请重新登录' })
  } else {
    // 后端统一用 { error } 返回错误；部分旧接口用 { message }，二者兼容
    reject({ code: res.statusCode, message: (res.data && (res.data.error || res.data.message)) || '请求失败' })
  }
}

/**
 * 和风天气API请求（走后端代理，避免小程序暴露和风 key）
 */
function qweatherRequest(path, params) {
  return new Promise((resolve, reject) => {
    const app = getApp()
    // path 形如 /v7/weather/now -> 提取 type: now|24h|15d
    const type = path.split('/').pop()
    const url = '/api/weather/' + type

    request({ url: url, method: 'GET', data: params || {} })
      .then(resolve)
      .catch(err => reject(err))
  })
}

module.exports = { request, qweatherRequest }
