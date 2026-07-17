/**
 * 统一请求封装
 */
const app = getApp()

function request(options) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    wx.request({
      url: (options.baseUrl || app.globalData.apiBase) + options.url,
      method: options.method || 'GET',
      data: options.data || {},
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        ...options.header
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // token过期，清除登录状态
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          app.globalData.token = null
          app.globalData.userInfo = null
          reject({ code: 401, message: '登录已过期，请重新登录' })
        } else {
          reject({ code: res.statusCode, message: res.data.message || '请求失败' })
        }
      },
      fail(err) {
        reject({ code: -1, message: '网络错误', detail: err })
      }
    })
  })
}

/**
 * 和风天气API请求（走后端代理，避免小程序暴露和风 key）
 */
function qweatherRequest(path, params) {
  return new Promise((resolve, reject) => {
    const app = getApp()
    // path 形如 /v7/weather/now -> 提取 type: now|24h|7d
    const type = path.split('/').pop()
    const url = app.globalData.apiBase + '/api/weather/' + type
    wx.request({
      url: url,
      method: 'GET',
      data: params || {},
      success(res) {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          reject(new Error('天气API返回: ' + res.statusCode))
        }
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = { request, qweatherRequest }
