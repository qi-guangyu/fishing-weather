const { wechatLogin, updateProfile } = require('../../utils/auth')

Page({
  data: {
    loading: false,
    avatarUrl: '',
    nickname: '',
    showPrivacy: false
  },

  onLoad() {
    // 首次进入且未同意隐私协议时弹出授权
    if (!wx.getStorageSync('privacyConsent')) {
      this.setData({ showPrivacy: true })
    }
  },

  // 微信头像选择（chooseAvatar 返回本地临时文件路径）
  onChooseAvatar(e) {
    this.setData({ avatarUrl: e.detail.avatarUrl })
  },

  // 昵称输入
  onNickInput(e) {
    this.setData({ nickname: e.detail.value || e.detail.nickName || '' })
  },

  // ---------- 隐私授权 ----------
  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },
  agreePrivacy() {
    wx.setStorageSync('privacyConsent', true)
    this.setData({ showPrivacy: false })
  },
  rejectPrivacy() {
    this.setData({ showPrivacy: false })
    wx.showToast({ title: '需同意隐私协议后登录', icon: 'none' })
  },

  // ---------- 微信登录 ----------
  async handleWechatLogin() {
    const app = getApp()
    if (this.data.loading) return
    // 未同意隐私协议则先弹窗
    if (!wx.getStorageSync('privacyConsent')) {
      this.setData({ showPrivacy: true })
      return
    }
    this.setData({ loading: true })
    try {
      // 1. 静默登录（wx.login → 后端换 openid）
      await wechatLogin()

      // 如果请求后端失败、走的是本地临时模式（fallback），就直接显示错误，不跳转不伪装成功
      if (app.globalData._authFallback) {
        const reason = app.globalData._authFallbackReason || '后端服务未连通'
        app.globalData._authFallback = false
        app.globalData._authFallbackReason = null
        throw new Error('微信登录失败: ' + reason)
      }

      // 2. 若用户填写了昵称/头像，补提交到后端
      const { nickname, avatarUrl } = this.data
      if (nickname || avatarUrl) {
        const updated = await updateProfile({ nickname, avatarPath: avatarUrl })
        if (updated) {
          const stored = wx.getStorageSync('userInfo') || {}
          const merged = {
            ...stored,
            nickname: updated.nickname || stored.nickname,
            avatar: updated.avatar || stored.avatar
          }
          wx.setStorageSync('userInfo', merged)
          app.globalData.userInfo = merged
        }
      }

      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 1000)
    } catch (e) {
      console.error('[login] 登录失败:', e)
      wx.showToast({ title: (e && e.message) || '登录失败', icon: 'none' })
    }
    this.setData({ loading: false })
  },

  // 跳过登录
  handleSkip() {
    wx.navigateBack()
  }
})
