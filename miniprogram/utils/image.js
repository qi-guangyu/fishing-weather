/**
 * 图片地址解析工具
 * 统一处理三种图片来源，返回「可直接用于 <image src> 的本地地址」：
 *   1) data: 开头（base64）             -> 直接写本地临时文件
 *   2) cloud:// 开头（微信云存储 fileID） -> wx.cloud.getTempFileURL 换取临时 URL
 *   3) 相对路径 /uploads/xxx.jpg 或 http(s) 绝对地址：
 *        - 直连模式（无 CLOUD_ENV）：直接拼 apiBase 或原样返回
 *        - callContainer 模式：经 /api/file 代理取图字节，写本地临时文件
 *
 * 为什么落本地临时文件而不是返回 data URI 字符串？
 * callContainer 下图片只能经私有协议取回，返回的 base64 可能很大（数 MB）。
 * 若直接塞进 setData 跨 JS↔Native 桥，会严重拖慢渲染；写本地临时文件后
 * setData 只携带一个短路径，符合「最小化 setData 载荷」的微信性能规范。
 */

const { request } = require('./request')

const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

// 已解析过的路径缓存（key=相对路径），避免同一张图反复代理
const _cache = Object.create(null)

// 将 base64 data URI 写成本地临时文件，返回临时路径
function writeTempFile(dataUri, cb) {
  const m = /^data:(image\/\w+);base64,(.+)$/.exec(dataUri || '')
  if (!m) { cb(''); return }
  const ext = (m[1].split('/')[1] || 'png')
  const fsMgr = wx.getFileSystemManager()
  const tmp = wx.env.USER_DATA_PATH + '/ugc_' + Date.now() + '_' + Math.floor(Math.random() * 1e4) + '.' + ext
  fsMgr.writeFile({
    filePath: tmp,
    data: m[2],
    encoding: 'base64',
    success: () => cb(tmp),
    fail: () => cb('')
  })
}

// 经 callContainer 私有协议代理取图（后端 /api/file 返回 data URI）
function proxyFetch(p, resolve) {
  if (_cache[p]) { resolve(_cache[p]); return }
  request({ url: '/api/file', data: { path: p } })
    .then((r) => {
      const d = (r && (r.data || r.url)) || ''
      if (!d) { resolve(''); return }
      writeTempFile(d, (tmp) => {
        if (tmp) { _cache[p] = tmp; resolve(tmp) }
        else resolve('')
      })
    })
    .catch(() => resolve(''))
}

/**
 * 解析任意图片引用为可显示的本地地址
 * @param {string} ref 图片引用（data:/cloud:///相对路径/http）
 * @returns {Promise<string>} 本地临时路径或空字符串
 */
function resolveImage(ref) {
  return new Promise((resolve) => {
    if (!ref) { resolve(''); return }
    const app = getApp() || {}
    const g = app.globalData || {}
    const cloudEnv = g.cloudEnv
    const apiBase = g.apiBase || ''

    // 1) base64 data URI：写临时文件
    if (ref.indexOf('data:') === 0) {
      writeTempFile(ref, resolve)
      return
    }
    // 2) 微信云存储 fileID
    if (ref.indexOf('cloud://') === 0) {
      if (!cloudEnv || !wx.cloud || !wx.cloud.getTempFileURL) { resolve(''); return }
      wx.cloud.getTempFileURL({
        fileList: [ref],
        success: (r) => {
          const t = r.fileList && r.fileList[0]
          resolve((t && t.tempFileURL) || '')
        },
        fail: () => resolve('')
      })
      return
    }
    // 3) 绝对 http(s)
    if (ref.indexOf('http') === 0) {
      if (cloudEnv && apiBase && ref.indexOf(apiBase) === 0) {
        proxyFetch(ref.slice(apiBase.length), resolve) // 本域图片走代理
      } else {
        resolve(ref) // 外链尽力直连（需域名白名单）
      }
      return
    }
    // 4) 相对路径 /uploads/xxx.jpg
    if (cloudEnv) {
      proxyFetch(ref, resolve)
    } else {
      resolve(apiBase + ref)
    }
  })
}

module.exports = { resolveImage, TRANSPARENT }
