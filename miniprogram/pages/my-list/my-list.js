const { request } = require('../../utils/request')
const app = getApp()

const TYPE_MAP = {
  catches: { title: '我的渔获', api: '/api/user/catches', empty: '还没有发布渔获，去钓点详情页晒一晒吧' },
  favorites: { title: '我的收藏', api: '/api/user/favorites', empty: '还没有收藏钓点，去钓点页逛逛吧' },
  comments: { title: '我的评论', api: '/api/user/comments', empty: '还没有发表评论' },
  submissions: { title: '我的投稿', api: '/api/user/submissions', empty: '还没有投稿钓点' }
}

const WATER_MAP = { river: '江河', reservoir: '水库', lake: '湖泊', pond: '池塘', stream: '溪流' };
const FEE_MAP = { free: '免费', per_day: '按天', per_jin: '按斤', other: '其他' };

const STATUS_MAP = {
  pending: ['待审核', 'status-pending'],
  published: ['已发布', 'status-published'],
  rejected: ['已拒绝', 'status-rejected'],
  deleted: ['已删除', 'status-rejected']
}

function indexLevel(idx) {
  if (idx == null) return { text: '', cls: '' }
  if (idx >= 80) return { text: '优', cls: 'level-good' }
  if (idx >= 60) return { text: '良', cls: 'level-ok' }
  if (idx >= 40) return { text: '一般', cls: 'level-mid' }
  return { text: '差', cls: 'level-bad' }
}

function toDate(s) { return (s || '').slice(0, 10) }

Page({
  data: {
    type: 'catches',
    cfg: TYPE_MAP.catches,
    list: [],
    page: 0,
    size: 10,
    noMore: false,
    loading: false
  },

  onLoad(q) {
    const type = q.type || 'catches'
    const cfg = TYPE_MAP[type] || TYPE_MAP.catches
    wx.setNavigationBarTitle({ title: cfg.title })
    this.setData({ type, cfg })
    this.loadData(true)
  },

  async loadData(reset) {
    if (this.data.loading) return
    const page = reset ? 1 : this.data.page + 1
    if (!reset && this.data.noMore) return
    this.setData({ loading: true })
    try {
      const res = await request({ url: `${this.data.cfg.api}?page=${page}&size=${this.data.size}` })
      const raw = (res && res.data) || []
      const items = raw.map(it => this.normalize(it))
      const list = reset ? items : this.data.list.concat(items)
      const totalPages = (res && res.pagination && res.pagination.totalPages) || 1
      this.setData({ list, page, noMore: page >= totalPages, loading: false })
    } catch (e) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  normalize(it) {
    const base = (app.globalData && app.globalData.apiBase) || 'http://localhost:3456'
    const date = toDate(it.created_at)
    if (this.data.type === 'favorites') {
      const imgs = Array.isArray(it.images) ? it.images : []
      const lv = indexLevel(it.fishing_index)
      return {
        id: it.id, spotId: it.spot_id, statusText: '',
        cover: imgs[0] ? base + imgs[0] : '',
        name: it.spot_name, addr: it.address,
        tags: [WATER_MAP[it.water_type] || it.water_type, FEE_MAP[it.fee_type] || it.fee_type].filter(Boolean),
        indexLevel: lv.text, indexClass: lv.cls, date
      }
    }
    if (this.data.type === 'submissions') {
      const imgs = Array.isArray(it.images) ? it.images : []
      const st = STATUS_MAP[it.status] || ['未知', '']
      return {
        id: it.id, statusText: st[0],
        cover: imgs[0] ? base + imgs[0] : '',
        name: it.name, addr: it.address,
        tags: [WATER_MAP[it.water_type] || it.water_type, FEE_MAP[it.fee_type] || it.fee_type].filter(Boolean),
        statusClass: st[1], date
      }
    }
    if (this.data.type === 'catches') {
      return {
        id: it.id,
        img: it.image ? base + it.image : '',
        spot: it.spot_name, weight: it.weight, feeling: it.feeling, date
      }
    }
    // comments
    return {
      id: it.id,
      img: it.image ? base + it.image : '',
      spot: it.spot_name, content: it.content, date
    }
  },

  onReachBottom() { this.loadData(false) },

  onPullDownRefresh() {
    this.loadData(true)
    wx.stopPullDownRefresh()
  },

  goSpot(e) {
    const ds = e.currentTarget.dataset
    if (ds.status && ds.status !== '已发布') {
      wx.showToast({ title: ds.status + '，暂不可查看', icon: 'none' })
      return
    }
    if (ds.id) wx.navigateTo({ url: '/pages/spot-detail/spot-detail?id=' + ds.id })
  }
})
