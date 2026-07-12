const { wechatLogin, getUserProfile } = require('../../utils/auth')
const app = getApp()

Page({
  data: {
    loading: false
  },

  // 微信授权登录
  async handleWechatLogin() {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      // 1. 获取用户资料（需要用户点击）
      let userInfo = {}
      try {
        userInfo = await getUserProfile()
      } catch (e) {
        console.log('用户拒绝授权资料，使用默认头像')
      }

      // 2. 微信登录
      await wechatLogin()

      // 3. 如果有用户资料，更新到全局
      if (userInfo.nickName) {
        const stored = wx.getStorageSync('userInfo') || {}
        const merged = { ...stored, username: userInfo.nickName, avatar: userInfo.avatarUrl }
        wx.setStorageSync('userInfo', merged)
        app.globalData.userInfo = merged
      }

      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (e) {
      console.error('[login] 登录失败:', e)
      wx.showToast({ title: e.message || '登录失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  // 跳过登录
  handleSkip() {
    wx.navigateBack()
  }
})
