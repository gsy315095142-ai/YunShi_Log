interface ExportPreviewModalProps {
  image: string | null
  /** 上传服务器失败的离线兜底预览：保存能力受浏览器限制，给出额外提示 */
  offline?: boolean
  onClose: () => void
}

// 长图预览：手机长按图片保存到相册，也可下载为文件
// 样式在 ChatExport.css 中，由 ChatExportBar.tsx 引入，此处不重复 import
export default function ExportPreviewModal({ image, offline, onClose }: ExportPreviewModalProps) {
  if (!image) return null

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        {offline ? (
          <p className="export-tip warn">
            ⚠️ 长图未能上传到服务器，当前为本地预览：请尝试<b>长按图片</b>保存；
            若无反应，可<b>截屏保存</b>，或换个浏览器（如系统自带浏览器）打开本页面重试
          </p>
        ) : (
          <p className="export-tip">✅ 长图已生成：手机<b>长按图片</b>即可保存到相册，也可点下方按钮下载</p>
        )}
        <div className="export-img-wrap">
          <img src={image} alt="对话长图" />
        </div>
        <div className="export-actions">
          <a className="tool-btn primary" href={image} download="运势Log对话长图.png" target="_blank" rel="noreferrer">
            下载 PNG
          </a>
          <button type="button" className="tool-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  )
}
