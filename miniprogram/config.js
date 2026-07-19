// 小程序后端地址配置
// 【P0 部署】把 API_BASE 改为微信云托管分配的服务地址（HTTPS，不含末尾斜杠）。
// 例如：https://xxxxxx.ap-shanghai.run.tcloudbase.com
// 拿到云托管「公网访问地址」后，只改这一行，然后重新上传小程序即可。
//
// === 微信云托管 callContainer 模式（推荐自用，免域名备案，规避 INVALID_HOST）===
// 填写 CLOUD_ENV（云托管环境 ID）后，小程序走微信私有协议调用后端，
// 无需配置 request 合法域名、不受网关 INVALID_HOST 限制，体验版/预览即可直接用。
// SERVICE_NAME 为云托管控制台「服务管理」里的服务名称（本例 express-498e）。
module.exports = {
  // 直连模式地址（仅本地调试、或已备案自定义域名时有效）
  API_BASE: 'https://express-498e-28i241-9-1453163295.sh.run.tcloudbase.com',

  // 云托管环境 ID：控制台「环境配置」可见，形如 prod-xxxxxxxx 或一串字母数字。
  // 留空 => 走上面的 API_BASE 直连（本地调试）；填写 => 走 callContainer（线上自用）。
  CLOUD_ENV: 'prod-d9gmr5ocxdc6aa294',

  // 云托管服务名称（控制台 → 服务管理 → 服务名称）
  SERVICE_NAME: 'express-498e'
};
