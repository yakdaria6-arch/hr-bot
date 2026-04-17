import { useState } from 'react'
import { X, Mail, Phone, Star, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { categoryLabel } from '../lib/scoring'
import type { Candidate, CandidateStatus } from '../types'

interface Props {
  candidate: Candidate
  onClose: () => void
  onUpdate: (updated: Candidate) => void
}

const STATUS_OPTIONS: { value: CandidateStatus; label: string }[] = [
  { value: 'new',       label: 'Новый' },
  { value: 'interview', label: 'Интервью' },
  { value: 'hired',     label: 'Принят' },
  { value: 'rejected',  label: 'Отказ' },
  { value: 'pending',   label: 'На паузе' },
]

export default function CandidateModal({ candidate, onClose, onUpdate }: Props) {
  const [status, setStatus] = useState<CandidateStatus>(candidate.status)
  const [notes, setNotes]   = useState(candidate.notes || '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const categoryColors = {
    green:  'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    yellow: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
    red:    'text-red-400 bg-red-400/10 border-red-400/30',
  }

  async function handleSave() {
    setSaving(true)
    const { data } = await supabase
      .from('candidates')
      .update({ status, notes })
      .eq('id', candidate.id)
      .select()
      .single()
    setSaving(false)
    if (data) onUpdate(data as Candidate)
  }

  // Score bar: percent of max for this answer
  function scorePercent(score: number, max: number) {
    return max > 0 ? Math.round((score / max) * 100) : 0
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-dark-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${categoryColors[candidate.category]}`}>
              {categoryLabel(candidate.category)}
            </div>
            <h2 className="text-white font-semibold">{candidate.name || 'Без имени'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Contact info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {candidate.email && (
              <a
                href={`mailto:${candidate.email}`}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-violet-400 transition-colors"
              >
                <Mail size={14} className="text-slate-500" />
                {candidate.email}
              </a>
            )}
            {candidate.phone && (
              <a
                href={`tel:${candidate.phone}`}
                className="flex items-center gap-2 text-sm text-slate-300 hover:text-violet-400 transition-colors"
              >
                <Phone size={14} className="text-slate-500" />
                {candidate.phone}
              </a>
            )}
          </div>

          {/* Score */}
          <div className="bg-slate-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-400 flex items-center gap-1">
                <Star size={14} /> Итоговый балл
              </span>
              <span className="text-2xl font-bold text-white">{candidate.total_score}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  candidate.category === 'green' ? 'bg-emerald-500' :
                  candidate.category === 'yellow' ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${candidate.total_score}%` }}
              />
            </div>
          </div>

          {/* Answers */}
          <div>
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Ответы на вопросы</h3>
            <div className="space-y-2">
              {candidate.answers.map((a, i) => {
                const pct = scorePercent(a.score, a.max_score)
                const isOpen = expanded === a.question_id
                return (
                  <div key={a.question_id} className="bg-slate-800/50 rounded-xl overflow-hidden">
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 text-left"
                      onClick={() => setExpanded(isOpen ? null : a.question_id)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-slate-500 text-xs shrink-0">#{i + 1}</span>
                        <span className="text-sm text-slate-300 truncate">{a.question_text}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`text-xs font-medium ${
                          pct >= 80 ? 'text-emerald-400' : pct >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {a.score}/{a.max_score}
                        </span>
                        {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3 border-t border-slate-700/50">
                        <p className="text-sm text-slate-200 mt-3 leading-relaxed">{a.answer_text}</p>
                        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status & Notes */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Статус</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      status === opt.value
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-400 mb-2 block">Заметки</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Личные заметки о кандидате…"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex justify-between items-center">
          <p className="text-xs text-slate-500">
            {new Date(candidate.created_at).toLocaleString('ru-RU')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Закрыть
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl transition-colors"
            >
              {saving ? 'Сохраняю…' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
