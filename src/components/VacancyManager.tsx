import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, Copy, Check, ExternalLink, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Vacancy, Question } from '../types'

const EMPTY_QUESTION = (): Question => ({
  id: crypto.randomUUID(),
  text: '',
  weight: 3,
  good_keywords: [],
  bad_keywords: [],
  required: false,
})

const EMPTY_VACANCY = (): Omit<Vacancy, 'id' | 'created_at'> => ({
  company_name: '',
  title: '',
  description: '',
  salary: '',
  schedule: '',
  format: '',
  pass_score: 60,
  questions: [EMPTY_QUESTION()],
  is_active: true,
  telegram_chat_id: '',
})

export default function VacancyManager() {
  const [vacancies, setVacancies]   = useState<Vacancy[]>([])
  const [loading, setLoading]       = useState(true)
  const [editing, setEditing]       = useState<Partial<Vacancy> | null>(null)
  const [isNew, setIsNew]           = useState(false)
  const [saving, setSaving]         = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied]         = useState<string | null>(null)

  useEffect(() => { loadVacancies() }, [])

  async function loadVacancies() {
    setLoading(true)
    const { data } = await supabase.from('vacancies').select('*').order('created_at', { ascending: false })
    if (data) setVacancies(data as Vacancy[])
    setLoading(false)
  }

  function startNew() {
    setEditing(EMPTY_VACANCY())
    setIsNew(true)
  }

  function startEdit(v: Vacancy) {
    setEditing({ ...v, questions: v.questions.map(q => ({ ...q })) })
    setIsNew(false)
  }

  function cancelEdit() {
    setEditing(null)
  }

  async function saveVacancy() {
    if (!editing) return
    const { company_name, title, questions } = editing
    if (!company_name?.trim() || !title?.trim()) return
    if (!questions?.length) return
    if (questions.some(q => !q.text.trim())) return

    setSaving(true)
    if (isNew) {
      const { data } = await supabase
        .from('vacancies')
        .insert({ ...editing, created_at: new Date().toISOString() })
        .select()
        .single()
      if (data) setVacancies(prev => [data as Vacancy, ...prev])
    } else {
      const { data } = await supabase
        .from('vacancies')
        .update(editing)
        .eq('id', (editing as Vacancy).id)
        .select()
        .single()
      if (data) setVacancies(prev => prev.map(v => v.id === data.id ? data as Vacancy : v))
    }
    setSaving(false)
    setEditing(null)
  }

  async function toggleActive(v: Vacancy) {
    const { data } = await supabase
      .from('vacancies')
      .update({ is_active: !v.is_active })
      .eq('id', v.id)
      .select()
      .single()
    if (data) setVacancies(prev => prev.map(x => x.id === data.id ? data as Vacancy : x))
  }

  async function deleteVacancy(id: string) {
    if (!confirm('Удалить вакансию? Кандидаты останутся в базе.')) return
    await supabase.from('vacancies').delete().eq('id', id)
    setVacancies(prev => prev.filter(v => v.id !== id))
  }

  function copyLink(id: string) {
    const url = `${window.location.origin}/apply/${id}`
    navigator.clipboard.writeText(url)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  // Question editing helpers
  function updateQuestion(idx: number, patch: Partial<Question>) {
    if (!editing) return
    const questions = [...(editing.questions || [])]
    questions[idx] = { ...questions[idx], ...patch }
    setEditing({ ...editing, questions })
  }

  function addQuestion() {
    if (!editing) return
    setEditing({ ...editing, questions: [...(editing.questions || []), EMPTY_QUESTION()] })
  }

  function removeQuestion(idx: number) {
    if (!editing) return
    const questions = (editing.questions || []).filter((_, i) => i !== idx)
    setEditing({ ...editing, questions })
  }

  function parseKeywords(str: string): string[] {
    return str.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // --- EDIT FORM ---
  if (editing) {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{isNew ? 'Новая вакансия' : 'Редактировать вакансию'}</h1>
          <button onClick={cancelEdit} className="text-slate-500 hover:text-white text-sm transition-colors">Отмена</button>
        </div>

        <div className="space-y-4">
          {/* Basic info */}
          <div className="bg-dark-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-400">Основная информация</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Компания *">
                <input
                  value={editing.company_name || ''}
                  onChange={e => setEditing({ ...editing, company_name: e.target.value })}
                  placeholder="Название компании"
                  className="input-field"
                />
              </Field>
              <Field label="Вакансия *">
                <input
                  value={editing.title || ''}
                  onChange={e => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Название должности"
                  className="input-field"
                />
              </Field>
              <Field label="Зарплата">
                <input
                  value={editing.salary || ''}
                  onChange={e => setEditing({ ...editing, salary: e.target.value })}
                  placeholder="от 80 000 ₽"
                  className="input-field"
                />
              </Field>
              <Field label="График">
                <input
                  value={editing.schedule || ''}
                  onChange={e => setEditing({ ...editing, schedule: e.target.value })}
                  placeholder="5/2, 9-18"
                  className="input-field"
                />
              </Field>
              <Field label="Формат">
                <input
                  value={editing.format || ''}
                  onChange={e => setEditing({ ...editing, format: e.target.value })}
                  placeholder="Офис / Удалённо / Гибрид"
                  className="input-field"
                />
              </Field>
              <Field label={`Проходной балл: ${editing.pass_score ?? 60}%`}>
                <input
                  type="range" min={10} max={90} step={5}
                  value={editing.pass_score ?? 60}
                  onChange={e => setEditing({ ...editing, pass_score: Number(e.target.value) })}
                  className="w-full accent-violet-500 mt-2"
                />
              </Field>
            </div>

            <Field label="Описание вакансии">
              <textarea
                value={editing.description || ''}
                onChange={e => setEditing({ ...editing, description: e.target.value })}
                rows={3}
                placeholder="Краткое описание обязанностей…"
                className="input-field resize-none"
              />
            </Field>

            <Field label="Telegram Chat ID (для уведомлений)">
              <input
                value={editing.telegram_chat_id || ''}
                onChange={e => setEditing({ ...editing, telegram_chat_id: e.target.value })}
                placeholder="-1001234567890"
                className="input-field"
              />
            </Field>
          </div>

          {/* Questions */}
          <div className="bg-dark-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-400">Вопросы скрининга</h2>

            {(editing.questions || []).map((q, idx) => (
              <div key={q.id} className="border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500 font-medium">Вопрос {idx + 1}</span>
                  {(editing.questions || []).length > 1 && (
                    <button onClick={() => removeQuestion(idx)} className="text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <textarea
                  value={q.text}
                  onChange={e => updateQuestion(idx, { text: e.target.value })}
                  rows={2}
                  placeholder="Текст вопроса для кандидата…"
                  className="input-field resize-none"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Field label={`Вес: ${q.weight}`}>
                    <input
                      type="range" min={1} max={5} step={1}
                      value={q.weight}
                      onChange={e => updateQuestion(idx, { weight: Number(e.target.value) })}
                      className="w-full accent-violet-500 mt-1"
                    />
                  </Field>
                  <Field label="Обязательный">
                    <button
                      onClick={() => updateQuestion(idx, { required: !q.required })}
                      className={`mt-1 text-sm flex items-center gap-2 ${q.required ? 'text-violet-400' : 'text-slate-500'}`}
                    >
                      {q.required ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      {q.required ? 'Да' : 'Нет'}
                    </button>
                  </Field>
                </div>
                <Field label="Ключевые слова «хорошего» ответа (через запятую)">
                  <input
                    value={q.good_keywords.join(', ')}
                    onChange={e => updateQuestion(idx, { good_keywords: parseKeywords(e.target.value) })}
                    placeholder="опыт, продажи, результат…"
                    className="input-field"
                  />
                </Field>
                <Field label="Ключевые слова «плохого» ответа (через запятую)">
                  <input
                    value={q.bad_keywords.join(', ')}
                    onChange={e => updateQuestion(idx, { bad_keywords: parseKeywords(e.target.value) })}
                    placeholder="не умею, не знаю…"
                    className="input-field"
                  />
                </Field>
              </div>
            ))}

            <button
              onClick={addQuestion}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
            >
              <Plus size={16} />
              Добавить вопрос
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={saveVacancy}
            disabled={saving || !editing.company_name?.trim() || !editing.title?.trim()}
            className="px-6 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors"
          >
            {saving ? 'Сохраняю…' : isNew ? 'Создать вакансию' : 'Сохранить изменения'}
          </button>
          <button onClick={cancelEdit} className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition-colors">
            Отмена
          </button>
        </div>
      </div>
    )
  }

  // --- LIST ---
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Вакансии</h1>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus size={16} />
          Новая вакансия
        </button>
      </div>

      {vacancies.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <p className="text-4xl mb-4">📋</p>
          <p>Вакансий пока нет.</p>
          <button onClick={startNew} className="mt-4 text-violet-400 hover:text-violet-300 text-sm transition-colors">
            Создать первую →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {vacancies.map(v => (
            <div key={v.id} className="bg-dark-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Active toggle */}
                <button onClick={() => toggleActive(v)} className="shrink-0">
                  {v.is_active
                    ? <ToggleRight size={22} className="text-violet-400" />
                    : <ToggleLeft size={22} className="text-slate-600" />
                  }
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{v.title}</p>
                    {!v.is_active && (
                      <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full shrink-0">Закрыта</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{v.company_name} · {v.questions.length} вопр. · порог {v.pass_score}%</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => copyLink(v.id)}
                    title="Копировать ссылку"
                    className="p-2 text-slate-500 hover:text-violet-400 transition-colors rounded-lg hover:bg-slate-800"
                  >
                    {copied === v.id ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
                  </button>
                  <a
                    href={`/apply/${v.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Открыть анкету"
                    className="p-2 text-slate-500 hover:text-violet-400 transition-colors rounded-lg hover:bg-slate-800"
                  >
                    <ExternalLink size={15} />
                  </a>
                  <button
                    onClick={() => startEdit(v)}
                    title="Редактировать"
                    className="p-2 text-slate-500 hover:text-violet-400 transition-colors rounded-lg hover:bg-slate-800"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => deleteVacancy(v.id)}
                    title="Удалить"
                    className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-slate-800"
                  >
                    <Trash2 size={15} />
                  </button>
                  <button
                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800"
                  >
                    {expandedId === v.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </button>
                </div>
              </div>

              {expandedId === v.id && (
                <div className="border-t border-slate-800 px-5 py-4">
                  <p className="text-xs font-medium text-slate-500 mb-2">Ссылка для кандидата:</p>
                  <div className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 mb-4">
                    <code className="text-xs text-violet-300 flex-1 truncate">
                      {window.location.origin}/apply/{v.id}
                    </code>
                    <button onClick={() => copyLink(v.id)} className="shrink-0 text-slate-500 hover:text-violet-400 transition-colors">
                      {copied === v.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mb-2">Вопросы ({v.questions.length}):</p>
                  <ol className="space-y-1">
                    {v.questions.map((q, i) => (
                      <li key={q.id} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-slate-600 shrink-0">{i + 1}.</span>
                        <span>{q.text} <span className="text-slate-600">(вес {q.weight})</span></span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
