/** 与 vite.config.ts 中 base 一致，生产环境为 /sylog/ */
export const APP_BASE = import.meta.env.BASE_URL

export function appPath(path: string): string {
  const base = APP_BASE.endsWith('/') ? APP_BASE : `${APP_BASE}/`
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${base}${clean}`
}
