import { useEffect, useState } from 'react'
import { fetchProfile, saveProfile } from '../api/profile'
import { ApiError } from '../api/client'
import './ProfilePage.css'

/** 三种五行算法的说明文案（点击格子 ⓘ 弹出） */
const ELEMENT_INFO = {
  tiangan: {
    title: '天干五行',
    body: '以出生农历年的「天干」对应五行：甲乙木、丙丁火、戊己土、庚辛金、壬癸水。只看年份，同一年出生的人结果都相同。',
  },
  nayin: {
    title: '纳音五行',
    body: '以出生年的「干支组合」对应纳音，六十甲子两两一组共三十种（如戊辰、己巳为「大林木」）。民间所说"某年出生是什么命"，通常指的就是纳音。',
  },
  rizhu: {
    title: '日主五行',
    body: '以出生「当天」的日柱天干对应五行（如甲子日出生为「甲木」）。八字命理以日主为"本命"核心：同年出生的人纳音相同，日主却因生日不同而各异。命理师说"你属甲木"，指的就是日主。',
  },
} as const

/** 三种算法的对比总结，固定显示在弹窗底部 */
const ELEMENT_INFO_FOOTER =
  '三者都"对"，只是取的柱子不同：天干五行与纳音看「年柱」，日主看「日柱」。'

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [birthTime, setBirthTime] = useState('')
  const [mbti, setMbti] = useState('')
  const [computed, setComputed] = useState({
    lunar: '',
    zodiac_sign: '',
    chinese_zodiac: '',
    five_element: '',
    nayin: '',
    day_master: '',
  })
  const [infoTopic, setInfoTopic] = useState<keyof typeof ELEMENT_INFO | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProfile()
      .then((p) => {
        setDisplayName(p.display_name || '')
        setBirthDate(p.birth_date || '')
        setBirthTime(p.birth_time || '')
        setMbti(p.mbti || '')
        setComputed({
          lunar: p.lunar || '-',
          zodiac_sign: p.zodiac_sign || '-',
          chinese_zodiac: p.chinese_zodiac || '-',
          five_element: p.five_element || '-',
          nayin: p.nayin || '-',
          day_master: p.day_master || '-',
        })
      })
      .finally(() => setLoading(false))
  }, [])

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    try {
      const saved = await saveProfile({
        display_name: displayName,
        birth_date: birthDate,
        birth_time: birthTime || null,
        mbti: mbti || null,
      })
      setComputed({
        lunar: saved.lunar || '-',
        zodiac_sign: saved.zodiac_sign || '-',
        chinese_zodiac: saved.chinese_zodiac || '-',
        five_element: saved.five_element || '-',
        nayin: saved.nayin || '-',
        day_master: saved.day_master || '-',
      })
      setMessage('已保存')
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : '保存失败')
    }
  }

  if (loading) return <p className="loading">加载中...</p>

  return (
    <div className="profile-page">
      <form className="card" onSubmit={onSave}>
        <h3>个人信息</h3>
        <label>
          姓名
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </label>
        <label>
          公历生日
          <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
        </label>
        <label>
          出生时间（可选）
          <input type="time" value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
        </label>
        <label>
          MBTI（可选）
          <input value={mbti} onChange={(e) => setMbti(e.target.value)} placeholder="如 INTJ" />
        </label>
        <button type="submit">保存</button>
        {message && <p className="msg">{message}</p>}
      </form>

      <div className="card fortune-card">
        <h3>命理信息</h3>
        <div className="fortune-grid">
          <div className="fortune-tile">
            <span className="fortune-label">星座</span>
            <strong className="fortune-value">{computed.zodiac_sign}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">生肖</span>
            <strong className="fortune-value">{computed.chinese_zodiac}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">
              天干五行
              <button type="button" className="info-btn" aria-label="天干五行说明" onClick={() => setInfoTopic('tiangan')}>
                ⓘ
              </button>
            </span>
            <strong className="fortune-value element">{computed.five_element}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">
              纳音五行
              <button type="button" className="info-btn" aria-label="纳音五行说明" onClick={() => setInfoTopic('nayin')}>
                ⓘ
              </button>
            </span>
            <strong className="fortune-value element">{computed.nayin}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">
              日主五行
              <button type="button" className="info-btn" aria-label="日主五行说明" onClick={() => setInfoTopic('rizhu')}>
                ⓘ
              </button>
            </span>
            <strong className="fortune-value element">{computed.day_master}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">农历</span>
            <strong className="fortune-value lunar">{computed.lunar}</strong>
          </div>
        </div>
      </div>

      {infoTopic && (
        <div className="info-backdrop" onClick={() => setInfoTopic(null)}>
          <div className="info-modal" onClick={(e) => e.stopPropagation()}>
            <div className="info-modal-header">
              <h4>{ELEMENT_INFO[infoTopic].title}</h4>
              <button type="button" className="info-close" aria-label="关闭" onClick={() => setInfoTopic(null)}>
                ✕
              </button>
            </div>
            <p className="info-modal-body">{ELEMENT_INFO[infoTopic].body}</p>
            <p className="info-modal-footer">{ELEMENT_INFO_FOOTER}</p>
          </div>
        </div>
      )}
    </div>
  )
}
