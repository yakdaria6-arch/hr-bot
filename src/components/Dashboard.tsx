import { useEffect, useState } from 'react'
import { Users, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { DashboardStats, Candidate } from '../types'

interface VacancyStats {
  title: string
  total: number
  green: number
  yellow: number
  red: number
}

export default function Dashboard() {
  const [stats, setStats]     = useState<DashboardStats | null>(null)
  const [byVacancy, setByVacancy] = useState<VacancyStats[]>([])
  const [recent, setRecent]   = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    const { data: candidates } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })

    if (!candidates) { setLoading(false); return }

    const all = candidates as Candidate[]
    const today = new Date().toDateString()

    const s: DashboardStats = {
      total:     all.length,
      green:     all.filter(c => c.category === 'green').length,
      yellow:    all.filter(c => c.category === 'yellow').length,
      red:       all.filter(c => c.category === 'red').length,
      today:     all.filter(c => new Date(c.created_at).toDateString() === today).length,
      avg_score: all.length ? Math.round(all.reduce((s, c) => s + c.total_score, 0) / all.length) : 0,
    }
    setStats(s)

    // Group by vacancy
    const map = new Map<string, VacancyStats>()
    all.forEach(c => {
      const title = c.vacancy_title || c.vacancy_id
      if (!map.has(title)) map.set(title, { title, total: 0, green: 0, yellow: 0, red: 0 })
      const vs = map.get(title)!
      vs.total++
      vs[c.category]++
    })
    setByVacancy(Array.from(map.values()).sort((a, b) => b.total - a.total))

    setRecent(all.slice(0, 5))
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const s = stats!

  const cards = [
    { label: 'Всего кандидатов', value: s.total, icon: Users, color: 'text-violet-400', bg: 'bg-violet-400/10' },
    { label: 'Подходят',         value: s.green,  icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    { label: 'На рассмотрении',  value: s.yellow, icon: Clock,       color: 'text-yellow-400',  bg: 'bg-yellow-400/10' },
    { label: 'Не подходят',      value: s.red,    icon: XCircle,     color: 'text-red-400',      bg: 'bg-red-400/10' },
    { label: 'Сегодня',          value: s.today,  icon: TrendingUp,  color: 'text-sky-400',      bg: 'bg-sky-400/10' },
    { label: 'Средний балл',     value: `${s.avg_score}%`, icon: TrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-white">Дашборд</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-dark-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className={`${bg} p-3 rounded-xl`}>
              <Icon size={20} className={color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-slate-400 text-xs mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* By vacancy */}
      {byVacancy.length > 0 && (
        <div className="bg-dark-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">По вакансиям</h2>
          <div className="space-y-3">
            {byVacancy.map(v => (
              <div key={v.title}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300 truncate max-w-xs">{v.title}</span>
                  <span className="text-slate-500 shrink-0 ml-4">{v.total} чел.</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                  {v.green  > 0 && <div className="bg-emerald-500 rounded-full" style={{ flex: v.green }} />}
                  {v.yellow > 0 && <div className="bg-yellow-500 rounded-full"  style={{ flex: v.yellow }} />}
                  {v.red    > 0 && <div className="bg-red-500 rounded-full"     style={{ flex: v.red }} />}
                </div>
                <div className="flex gap-3 text-xs text-slate-500 mt-1">
                  <span className="text-emerald-400">{v.green} подходят</span>
                  <span className="text-yellow-400">{v.yellow} на рассмотрении</span>
                  <span className="text-red-400">{v.red} не подходят</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent */}
      {recent.length > 0 && (
        <div className="bg-dark-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Последние кандидаты</h2>
          <div className="space-y-2">
            {recent.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    c.category === 'green' ? 'bg-emerald-400' :
                    c.category === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <div>
                    <p className="text-sm text-white">{c.name || '—'}</p>
                    <p className="text-xs text-slate-500">{c.vacancy_title || ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-white">{c.total_score}%</p>
                  <p className="text-xs text-slate-500">
                    {new Date(c.created_at).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {s.total === 0 && (
        <div className="text-center py-16 text-slate-500">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>Кандидатов пока нет.</p>
          <p className="text-sm mt-1">Создайте вакансию и разошлите ссылку.</p>
        </div>
      )}
    </div>
  )
}
