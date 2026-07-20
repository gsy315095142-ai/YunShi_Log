import { useEffect, useState } from 'react'
import { fetchProfile, saveProfile } from '../api/profile'
import { ApiError } from '../api/client'
import './ProfilePage.css'

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
  })
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
            <span className="fortune-label">天干五行</span>
            <strong className="fortune-value element">{computed.five_element}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">纳音五行</span>
            <strong className="fortune-value element">{computed.nayin}</strong>
          </div>
          <div className="fortune-tile">
            <span className="fortune-label">农历</span>
            <strong className="fortune-value lunar">{computed.lunar}</strong>
          </div>
        </div>
      </div>
    </div>
  )
}
