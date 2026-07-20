/**
 * 应用版本更新说明数据。
 * 新版本发布时在数组头部追加一条记录即可，弹窗自动按顺序展示。
 */

export interface ChangelogEntry {
  version: string
  date: string
  title: string
  items: string[]
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: 'v0.1.26071901',
    date: '2026-07-19',
    title: '筑基 · 应用框架搭建完成',
    items: [
      '搭建整体技术框架：FastAPI 后端 + SQLite 数据库 + React 前端，手机优先的响应式布局',
      '账号体系上线：开放注册与登录，数据按用户隔离，互不可见',
      '个人信息页：填写姓名、公历生日、出生时间与 MBTI，自动推算农历、星座、生肖、五行',
      '每日记录页：月历视图记录每日大事小情，同一天支持多条记录，可增删改',
      'AI 测算页：「测算大师」聊天式解读，支持 DeepSeek / 智谱双厂商，输入 @ 可关联某日记录',
      '联网搜索：接入 SearXNG，测算时可结合时事辅助分析',
    ],
  },
]
