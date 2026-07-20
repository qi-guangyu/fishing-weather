const { isLoggedIn, updateProfile } = require('../../utils/auth')
const { resolveImage } = require('../../utils/image')

Page({
  data: {
    nickname: '',
    username: '',
    avatarDisplay: '',     // 头像显示地址（经 resolveImage 解析后的本地路径）
    newAvatarPath: '',     // 新选的本地临时图路径（未保存前为空）
    saving: false,
    dirty: false,
    maxLen: 32
  },

  onLoad() {
    const u = wx.getStorageSync('userInfo') || {}
    this.setData({
      nickname: u.nickname || u.username || '',
      username: u.username || ''
    })
    if (u.avatar) {
      // 解析为本地可直接显示的地址（callContainer 经 /api/file 落临时文件；直连拼 apiBase）
      resolveImage(u.avatar).then(p => {
        if (p && !this.data.newAvatarPath) this.setData({ avatarDisplay: p })
      })
    }
  },

  noop() {},

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value, dirty: true })
  },

  chooseAvatar() {
    if (!isLoggedIn()) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const temp = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!temp) return
        // 先用本地临时图即时预览，保存时再经 updateProfile 上报
        this.setData({ avatarDisplay: temp, newAvatarPath: temp, dirty: true })
      }
    })
  },

  async save() {
    if (!isLoggedIn()) return
    const name = (this.data.nickname || '').trim()
    if (!name) { wx.showToast({ title: '昵称不能为空', icon: 'none' }); return }
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '保存中...' })
    try {
      const updated = await updateProfile({
        nickname: name,
        avatarPath: this.data.newAvatarPath || undefined
      })
      wx.hideLoading()
      // 合并回本地 userInfo（profile.onShow 会自动用最新值刷新）
      const base = wx.getStorageSync('userInfo') || {}
      const merged = Object.assign({}, base, updated || {})
      if (!updated) merged.nickname = name
      if (updated && updated.avatar) merged.avatar = updated.avatar
      wx.setStorageSync('userInfo', merged)
      this.setData({ saving: false, dirty: false, newAvatarPath: '' })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => wx.navigateBack(), 500)
    } catch (e) {
      wx.hideLoading()
      this.setData({ saving: false })
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  cancel() {
    if (this.data.dirty) {
      wx.showModal({
        title: '放弃修改？',
        content: '您有未保存的更改',
        success: (r) => { if (r.confirm) wx.navigateBack() }
      })
    } else {
      wx.navigateBack()
    }
  }
})
