/**
 * 微信授权登录模块
 */
const { request } = require('./request')

/**
 * 微信登录流程：
 * 1. wx.login() 获取 code
 * 2. 发送 code 到后端，后端调用微信API换取 openid
 * 3. 后端创建/查找用户，返回 JWT token
 * 4. 本地保存 token 和用户信息
 */
function wechatLogin() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(loginRes) {
        if (!loginRes.code) {
          reject(new Error('微信登录失败: 未获取到code'))
          return
        }
        // 发送code到后端
        request({
          url: '/api/auth/wechat-login',
          method: 'POST',
          data: { code: loginRes.code }
        }).then(data => {
          // 保存登录状态
          wx.setStorageSync('token', data.access_token || data.token)
          wx.setStorageSync('userInfo', data.user || data)
          const app = getApp()
          app.globalData.token = data.access_token || data.token
          app.globalData.userInfo = data.user || data
          resolve(data.user || data)
        }).catch(err => {
          // 后端不可用时，使用本地临时登录
          console.warn('[auth] 后端登录失败，使用临时模式:', err)
          const tempUser = {
            id: 'local_' + Date.now(),
            username: '微信用户',
            avatar: '',
            role: 'user'
          }
          resolve(tempUser)
        })
      },
      fail(err) {
        reject(new Error('微信登录失败: ' + err.errMsg))
      }
    })
  })
}

/**
 * 检查登录状态
 */
function isLoggedIn() {
  const token = wx.getStorageSync('token')
  return !!token
}

/**
 * 退出登录
 */
function logout() {
  wx.removeStorageSync('token')
  wx.removeStorageSync('userInfo')
  const app = getApp()
  app.globalData.token = null
  app.globalData.userInfo = null
}

/**
 * 更新用户资料（昵称 / 头像）
 * - 头像为微信 chooseAvatar 返回的本地临时文件路径。
 * - callContainer 模式下 wx.uploadFile 直连 apiBase 会被网关拦截，故改为：
 *   读文件为 base64 → 经 request() PUT（走 callContainer 私有协议）上报 { nickname, avatarBase64 }。
 * - 头像/昵称更新失败一律视为「非致命」：resolve(null)，绝不影响登录主流程。
 */
function updateProfile({ nickname, avatarPath } = {}) {
  const token = wx.getStorageSync('token')
  const header = token ? { Authorization: 'Bearer ' + token } : {}
  return new Promise((resolve) => {
    if (!nickname && !avatarPath) { resolve(null); return }

    const send = (avatarBase64) => {
      const data = {}
      if (nickname) data.nickname = nickname
      if (avatarBase64) data.avatarBase64 = avatarBase64
      request({
        url: '/api/auth/profile',
        method: 'PUT',
        header,
        data
      }).then(d => resolve((d && d.user) || null)).catch(() => resolve(null))
    }

    if (avatarPath) {
      const ext = (avatarPath.match(/\.(\w+)(?:\?.*)?$/) || [, 'png'])[1].toLowerCase()
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg'
        : ext === 'webp' ? 'image/webp'
        : ext === 'gif' ? 'image/gif'
        : 'image/png'
      wx.getFileSystemManager().readFile({
        filePath: avatarPath,
        encoding: 'base64',
        success: r => send('data:' + mime + ';base64,' + r.data),
        fail: () => send(undefined) // 读不到就只传昵称，不阻断
      })
    } else {
      send(undefined)
    }
  })
}

module.exports = { wechatLogin, isLoggedIn, logout, updateProfile }
