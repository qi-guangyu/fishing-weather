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
 * 获取用户信息（需要用户点击按钮授权）
 */
function getUserProfile() {
  return new Promise((resolve, reject) => {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success(res) {
        resolve(res.userInfo)
      },
      fail(err) {
        reject(err)
      }
    })
  })
}

module.exports = { wechatLogin, isLoggedIn, logout, getUserProfile }
