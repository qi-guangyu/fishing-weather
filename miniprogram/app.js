App({
  globalData: {
    // 后端API地址 - 部署后替换为你的Render地址
    apiBase: 'https://your-render-app.onrender.com',
    // 和风天气API配置
    qweatherKey: '195df4dbb8574d3dbbf024de1e1230b7',
    qweatherHost: 'ma6x8a83gy.re.qweatherapi.com',
    // 用户信息
    userInfo: null,
    token: null,
    // 当前城市
    currentCity: '常熟'
  },
  onLaunch() {
    // 从本地存储恢复登录状态
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    if (token) {
      this.globalData.token = token
      this.globalData.userInfo = userInfo
    }
    // 从本地存储恢复城市
    const savedCity = wx.getStorageSync('currentCity')
    if (savedCity) {
      this.globalData.currentCity = savedCity
    }
  }
})
