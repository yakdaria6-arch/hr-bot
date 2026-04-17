import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { scoreAnswers, calcTotalScore, getCategory, categoryMessage } from '../lib/scoring'
import { notifyTelegram } from '../lib/telegram'
import type { Vacancy, Candidate } from '../types'
import ChatBot from '../components/ChatBot'

export default function ApplyPage() {
  const { vacancyId } = useParams<{ vacancyId: string }>()
  const [vacancy, setVacancy] = useState<Vacancy | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [done, setDone] = useState(false)
  const [finalMessage, setFinalMessage] = useState('')

  useEffect(() => {
    if (!vacancyId) { setNotFound(true); setLoading(false); return }
    supabase
      .from('vacancies')
      .select('*')
      .eq('id', vacancyId)
      .eq('is_active', true)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setNotFound(true) }
        else { setVacancy(data as Vacancy) }
        setLoading(false)
      })
  }, [vacancyId])

  async function handleFinish(rawAnswers: Record<string, string>) {
    if (!vacancy) return

    const answers    = await scoreAnswers(vacancy.questions, rawAnswers)
    const score      = calcTotalScore(answers)
    const category   = getCategory(score, vacancy.pass_score)
    const message    = categoryMessage(category)

    const candidate: Omit<Candidate, 'id'> = {
      vacancy_id:   vacancy.id,
      vacancy_title: vacancy.title,
      name:  rawAnswers['__name__']  || '',
      email: rawAnswers['__email__'] || '',
      phone: rawAnswers['__phone__'] || '',
      answers,
      total_score: score,
      category,
      status: 'new',
      notes: '',
      created_at: new Date().toISOString(),
    }

    const { data } = await supabase
      .from('candidates')
      .insert(candidate)
      .select()
      .single()

    if (data && category !== 'red') {
      await notifyTelegram(data as Candidate, vacancy)
    }

    setFinalMessage(message)
    setDone(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !vacancy) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4 text-center">
        <div>
          <p className="text-6xl mb-4">😕</p>
          <h1 className="text-2xl font-bold text-white mb-2">Вакансия не найдена</h1>
          <p className="text-slate-400">Возможно, ссылка устарела или вакансия закрыта.</p>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">✅</div>
          <h1 className="text-2xl font-bold text-white mb-4">Анкета отправлена!</h1>
          <p className="text-slate-300 text-lg leading-relaxed bg-dark-850 border border-slate-700/50 rounded-2xl p-6">
            {finalMessage}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 bg-dark-900 px-4 py-3 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          {vacancy.company_name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate">{vacancy.company_name}</p>
          <p className="text-slate-400 text-xs truncate">{vacancy.title}</p>
        </div>
      </div>

      {/* Vacancy info bar */}
      <div className="bg-dark-900/60 border-b border-slate-800 px-4 py-2 flex gap-4 text-xs text-slate-400 overflow-x-auto">
        {vacancy.salary   && <span>💰 {vacancy.salary}</span>}
        {vacancy.schedule && <span>🕐 {vacancy.schedule}</span>}
        {vacancy.format   && <span>📍 {vacancy.format}</span>}
      </div>

      {/* Chat */}
      <div className="flex-1 flex flex-col max-w-2xl w-full mx-auto">
        <ChatBot vacancy={vacancy} onFinish={handleFinish} />
      </div>
    </div>
  )
}
