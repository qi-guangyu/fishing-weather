const { API_BASE, CLOUD_ENV, SERVICE_NAME } = require('./config.js');

App({
  globalData: {
    // 后端API地址：见 miniprogram/config.js（部署后改为云托管 HTTPS 域名）
    apiBase: API_BASE,
    // 云托管环境ID（为空则走直连模式，填了则走 callContainer 私有协议）
    cloudEnv: CLOUD_ENV,
    // 用户信息
    userInfo: null,
    token: null,
    // 当前城市
    currentCity: '常熟'
  },
  onLaunch() {
    // 初始化云能力（callContainer 模式必须 wx.cloud.init）
    // 必须 try/catch 包裹：init 抛错会导致整个小程序启动失败（表现=只显示 tabBar 框架 + wx://not-found）
    if (CLOUD_ENV) {
      try {
        if (!wx.cloud) {
          console.error('请使用 2.2.3 或以上的基础库以使用云能力');
        } else {
          wx.cloud.init({ env: CLOUD_ENV, traceUser: true });
          // 预热：在 onLaunch 阶段先完成一次云登录握手，
          // 避免首屏页面（气象/钓点）的第一次 callContainer 在真机上卡住。
          this.warmUpCloud();
        }
      } catch (e) {
        console.error('wx.cloud.init 失败（不影响静态页面渲染）:', e);
      }
    }
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
  },
  // 预热云登录：发一个轻量请求打通 callContainer 握手，失败也无所谓（有超时兜底）
  warmUpCloud() {
    try {
      wx.cloud.callContainer({
        config: { env: CLOUD_ENV },
        path: '/api/version',
        method: 'GET',
        header: { 'X-WX-SERVICE': SERVICE_NAME },
        success: () => console.log('[云] 预热成功'),
        fail: (e) => console.warn('[云] 预热失败（不影响功能）', e)
      });
    } catch (e) { /* 忽略 */ }
  }
})
