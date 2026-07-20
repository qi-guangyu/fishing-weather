const { resolveImage, TRANSPARENT } = require('../../utils/image')

Component({
  properties: {
    // 原始图片引用：data:/cloud:///相对路径 /uploads/xxx.jpg / http(s)
    src: { type: String, value: '' },
    // 图片裁剪模式，透传给内部 <image>
    mode: { type: String, value: 'aspectFill' },
    // 外部样式类（沿用原 <image> 的 class，保证布局不变）
    imgClass: { type: String, value: '' }
  },

  data: { displaySrc: TRANSPARENT },

  observers: {
    // src 变化即重新解析；解析前展示透明占位，避免裂图
    src(val) {
      const v = val || ''
      if (!v) { this.setData({ displaySrc: TRANSPARENT }); return }
      resolveImage(v).then((d) => {
        this.setData({ displaySrc: d || TRANSPARENT })
      }).catch(() => {})
    }
  },

  methods: {
    onTap() {
      if (this.data.displaySrc && this.data.displaySrc !== TRANSPARENT) {
        // 把已解析的本地地址透传给页面，供预览等使用
        this.triggerEvent('tap', { src: this.data.displaySrc })
      }
    }
  }
})
