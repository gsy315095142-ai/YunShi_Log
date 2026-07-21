interface ExportPreviewModalProps {
  image: string | null
  onClose: () => void
}

// 长图预览：手机长按图片保存到相册，也可下载为文件
// 样式在 ChatExport.css 中，由 ChatExportBar.tsx 引入，此处不重复 import
export default function ExportPreviewModal({ image, onClose }: ExportPreviewModalProps) {
  if (!image) return null

  return (
    <div className="export-backdrop" onClick={onClose}>
      <div className="export-modal" onClick={(e) => e.stopPropagation()}>
        <p className="export-tip">✅ 长图已生成：手机<b>长按图片</b>即可保存到相册</p>
        <div className="export-img-wrap">
          <img src={image} alt="对话长图" />
        </div>
        <div className="export-actions">
          <a className="tool-btn primary" href={image} download="运势Log对话长图.png">
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
