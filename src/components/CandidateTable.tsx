import { useEffect, useState } from 'react'
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { categoryLabel } from '../lib/scoring'
import CandidateModal from './CandidateModal'
import type { Candidate, ScoreCategory, CandidateStatus } from '../types'

type SortKey = 'created_at' | 'total_score' | 'name'
type SortDir = 'asc' | 'desc'

const CATEGORY_COLORS: Record<ScoreCategory, string> = {
  green:  'text-emerald-400 bg-emerald-400/10',
  yellow: 'text-yellow-400 bg-yellow-400/10',
  red:    'text-red-400 bg-red-400/10',
}

const STATUS_LABELS: Record<CandidateStatus, string> = {
  new:       'Новый',
  interview: 'Интервью',
  hired:     'Принят',
  rejected:  'Отказ',
  pending:   'На паузе',
}

export default function CandidateTable() {
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterCat, setFilterCat]   = useState<ScoreCategory | 'all'>('all')
  const [sortKey, setSortKey]       = useState<SortKey>('created_at')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const [selected, setSelected]     = useState<Candidate | null>(null)

  useEffect(() => { loadCandidates() }, [])

  async function loadCandidates() {
    setLoading(true)
    const { data } = await supabase
      .from('candidates')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setCandidates(data as Candidate[])
    setLoading(false)
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = candidates
    .filter(c => {
      if (filterCat !== 'all' && c.category !== filterCat) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.vacancy_title?.toLowerCase().includes(q)
        )
      }
      return true
    })
    .sort((a, b) => {
      let va: string | number = a[sortKey]
      let vb: string | number = b[sortKey]
      if (typeof va === 'string') va = va.toLowerCase()
      if (typeof vb === 'string') vb = vb.toLowerCase()
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  function exportCSV() {
    const header = ['Имя', 'Email', 'Телефон', 'Вакансия', 'Балл', 'Категория', 'Статус', 'Дата']
    const rows = filtered.map(c => [
      c.name, c.email, c.phone || '',
      c.vacancy_title || '', c.total_score,
      categoryLabel(c.category), STATUS_LABELS[c.status],
      new Date(c.created_at).toLocaleString('ru-RU'),
    ])
    const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'candidates.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="opacity-20 ml-1"><ChevronUp size={12} /></span>
    return sortDir === 'asc'
      ? <ChevronUp size={12} className="ml-1 text-violet-400" />
      : <ChevronDown size={12} className="ml-1 text-violet-400" />
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Кандидаты</h1>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors disabled:opacity-40"
        >
          <Download size={14} />
          CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по имени, email, вакансии…"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          {(['all', 'green', 'yellow', 'red'] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                filterCat === cat
                  ? cat === 'all' ? 'bg-violet-600 text-white'
                    : cat === 'green' ? 'bg-emerald-600 text-white'
                    : cat === 'yellow' ? 'bg-yellow-600 text-white'
                    : 'bg-red-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {cat === 'all' ? 'Все' : categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Search size={32} className="mx-auto mb-3 opacity-30" />
          <p>Кандидаты не найдены</p>
        </div>
      ) : (
        <div className="bg-dark-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('name')}
                      className="flex items-center text-xs font-medium text-slate-500 hover:text-white transition-colors"
                    >
                      Имя <SortIcon col="name" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Вакансия</th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('total_score')}
                      className="flex items-center text-xs font-medium text-slate-500 hover:text-white transition-colors"
                    >
                      Балл <SortIcon col="total_score" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Категория</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">Статус</th>
                  <th className="px-4 py-3 text-left">
                    <button
                      onClick={() => toggleSort('created_at')}
                      className="flex items-center text-xs font-medium text-slate-500 hover:text-white transition-colors"
                    >
                      Дата <SortIcon col="created_at" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="border-b border-slate-800 last:border-0 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-white font-medium">{c.name || '—'}</p>
                        <p className="text-xs text-slate-500">{c.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 max-w-[160px]">
                      <span className="truncate block">{c.vacancy_title || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{c.total_score}%</span>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              c.category === 'green' ? 'bg-emerald-500' :
                              c.category === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${c.total_score}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${CATEGORY_COLORS[c.category]}`}>
                        {categoryLabel(c.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {STATUS_LABELS[c.status]}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-slate-800 text-xs text-slate-600">
            Показано: {filtered.length} из {candidates.length}
          </div>
        </div>
      )}

      {selected && (
        <CandidateModal
          candidate={selected}
          onClose={() => setSelected(null)}
          onUpdate={updated => {
            setCandidates(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelected(updated)
          }}
        />
      )}
    </div>
  )
}
