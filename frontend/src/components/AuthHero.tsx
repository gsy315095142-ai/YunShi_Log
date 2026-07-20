const ELEMENTS = [
  { name: '金', label: '金', color: '#d4af37', glow: 'rgba(212, 175, 55, 0.35)' },
  { name: '木', label: '木', color: '#3d8b6e', glow: 'rgba(61, 139, 110, 0.35)' },
  { name: '水', label: '水', color: '#3a6ea5', glow: 'rgba(58, 110, 165, 0.35)' },
  { name: '火', label: '火', color: '#c45c3e', glow: 'rgba(196, 92, 62, 0.35)' },
  { name: '土', label: '土', color: '#a67c52', glow: 'rgba(166, 124, 82, 0.35)' },
] as const

interface AuthHeroProps {
  title: string
  subtitle: string
}

export default function AuthHero({ title, subtitle }: AuthHeroProps) {
  return (
    <div className="auth-hero">
      <div className="auth-hero-orbit" aria-hidden>
        <span className="auth-orbit-ring" />
        <span className="auth-orbit-ring auth-orbit-ring--inner" />
      </div>
      <p className="auth-brand">运势 Log</p>
      <h1 className="auth-title">{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      <div className="auth-elements" aria-label="五行">
        {ELEMENTS.map((el) => (
          <div
            key={el.name}
            className="auth-element"
            style={{ '--el-color': el.color, '--el-glow': el.glow } as React.CSSProperties}
          >
            <span className="auth-element-char">{el.label}</span>
            <span className="auth-element-name">{el.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
