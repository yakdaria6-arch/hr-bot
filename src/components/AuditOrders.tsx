import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Status = 'new' | 'processing' | 'done'

interface AuditOrder {
  id: string
  url: string
  platform: 'ozon' | 'wb'
  contact: string
  notes: string
  screenshots: string[]
  status: Status
  pdf_url: string
  created_at: string
}

const STATUS_LABELS: Record<Status, string> = {
  new: 'Новая',
  processing: 'В работе',
  done: 'Готово',
}
const STATUS_COLORS: Record<Status, string> = {
  new: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  processing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  done: 'bg-green-500/20 text-green-400 border-green-500/30',
}

export default function AuditOrders() {
  const [orders, setOrders] = useState<AuditOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const [pdfInputs, setPdfInputs] = useState<Record<string, string>>({})

  async function load() {
    const { data } = await supabase
      .from('audit_orders')
      .select('*')
      .order('created_at', { ascending: false })
    setOrders((data as AuditOrder[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: Status) {
    await supabase.from('audit_orders').update({ status }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o))
  }

  async function savePdfUrl(id: string) {
    const pdf_url = pdfInputs[id]?.trim() || ''
    await supabase.from('audit_orders').update({ pdf_url, status: 'done' }).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, pdf_url, status: 'done' } : o))
    setPdfInputs(prev => ({ ...prev, [id]: '' }))
  }

  function getScreenshotUrl(path: string) {
    const { data } = supabase.storage.from('audit-screenshots').getPublicUrl(path)
    return data.publicUrl
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)

  const counts = {
    all: orders.length,
    new: orders.filter(o => o.status === 'new').length,
    processing: orders.filter(o => o.status === 'processing').length,
    done: orders.filter(o => o.status === 'done').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-white">Заявки на аудит</h1>
        <button onClick={load} className="text-slate-400 hover:text-white text-sm transition-colors">↻ Обновить</button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['all', 'new', 'processing', 'done'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
              filter === s
                ? 'bg-violet-600 text-white border-violet-600'
                : 'text-slate-400 border-slate-700 hover:text-white hover:border-slate-600'
            }`}
          >
            {s === 'all' ? 'Все' : STATUS_LABELS[s]}
            <span className="ml-1.5 opacity-70">{counts[s]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-slate-500">
          <div className="text-4xl mb-3">📭</div>
          <p>Заявок нет</p>
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(order => (
          <div key={order.id} className="bg-dark-900 border border-slate-800 rounded-2xl p-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    order.platform === 'ozon'
                      ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                      : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  }`}>
                    {order.platform === 'ozon' ? '🟠 Ozon' : '🟣 WB'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <span className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleDateString('ru-RU', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
                <a
                  href={order.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-violet-400 hover:underline break-all"
                >
                  {order.url}
                </a>
              </div>
            </div>

            {/* Contact + notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-dark-950 rounded-xl px-3 py-2">
                <p className="text-xs text-slate-500 mb-0.5">Контакт</p>
                <p className="text-sm text-white">{order.contact}</p>
              </div>
              {order.notes && (
                <div className="bg-dark-950 rounded-xl px-3 py-2">
                  <p className="text-xs text-slate-500 mb-0.5">Комментарий</p>
                  <p className="text-sm text-slate-300">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Screenshots */}
            {order.screenshots?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-2">Скрины ({order.screenshots.length})</p>
                <div className="flex gap-2 flex-wrap">
                  {order.screenshots.map((path, i) => (
                    <a
                      key={i}
                      href={getScreenshotUrl(path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-14 h-14 bg-dark-950 border border-slate-700 rounded-lg overflow-hidden hover:border-violet-500 transition-colors flex items-center justify-center text-slate-500 text-xs"
                    >
                      <img
                        src={getScreenshotUrl(path)}
                        alt={`slide ${i+1}`}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap pt-3 border-t border-slate-800">
              {/* Status buttons */}
              {order.status !== 'processing' && order.status !== 'done' && (
                <button
                  onClick={() => setStatus(order.id, 'processing')}
                  className="text-xs px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors"
                >
                  → В работу
                </button>
              )}

              {/* PDF URL input */}
              {order.status !== 'done' && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <input
                    type="text"
                    value={pdfInputs[order.id] || ''}
                    onChange={e => setPdfInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                    placeholder="Ссылка на PDF-отчёт..."
                    className="flex-1 bg-dark-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-500 min-w-0"
                  />
                  <button
                    onClick={() => savePdfUrl(order.id)}
                    disabled={!pdfInputs[order.id]?.trim()}
                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600/20 text-green-400 border border-green-500/30 hover:bg-green-600/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    ✅ Готово
                  </button>
                </div>
              )}

              {/* PDF link if done */}
              {order.pdf_url && (
                <a
                  href={order.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/40 transition-colors"
                >
                  📄 PDF-отчёт
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
