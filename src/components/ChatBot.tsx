import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import type { Vacancy } from '../types'

interface Message {
  from: 'bot' | 'user'
  text: string
}

interface Props {
  vacancy: Vacancy
  onFinish: (answers: Record<string, string>) => Promise<void>
}

// Системные вопросы (всегда первые)
const SYS_QUESTIONS = [
  { id: '__name__',  text: 'Как вас зовут?' },
  { id: '__email__', text: 'Ваш email для связи?' },
  { id: '__phone__', text: 'Номер телефона (необязательно — можно пропустить)' },
]

export default function ChatBot({ vacancy, onFinish }: Props) {
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [step, setStep]           = useState(0)     // индекс текущего вопроса
  const [answers, setAnswers]     = useState<Record<string, string>>({})
  const [typing, setTyping]       = useState(false)
  const [sending, setSending]     = useState(false)
  const [finished, setFinished]   = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Все вопросы: системные + вопросы вакансии
  const allQuestions = [
    ...SYS_QUESTIONS,
    ...vacancy.questions.map(q => ({ id: q.id, text: q.text })),
  ]
  const totalSteps = allQuestions.length
  const progress   = Math.round((step / totalSteps) * 100)

  // Добавить сообщение от бота с задержкой (имитация печати)
  function botSay(text: string, delay = 700) {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(prev => [...prev, { from: 'bot', text }])
    }, delay)
  }

  // Инициализация: приветствие + первый вопрос
  useEffect(() => {
    botSay(`Здравствуйте! 👋 Я помощник компании «${vacancy.company_name}». Помогу оформить вашу анкету на вакансию «${vacancy.title}».`, 500)
    botSay(`Ответьте, пожалуйста, на ${totalSteps} коротких вопроса. Это займёт 3–5 минут.`, 1400)
    botSay(allQuestions[0].text, 2400)
  }, []) // eslint-disable-line

  // Скролл вниз при новых сообщениях
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending || finished) return

    setInput('')
    setMessages(prev => [...prev, { from: 'user', text }])

    const currentQ = allQuestions[step]
    const newAnswers = { ...answers, [currentQ.id]: text }
    setAnswers(newAnswers)

    const nextStep = step + 1

    if (nextStep >= totalSteps) {
      // Все вопросы заданы
      setFinished(true)
      botSay('Спасибо за ответы! ✅ Обрабатываю вашу анкету…')
      setSending(true)
      await onFinish(newAnswers)
      setSending(false)
    } else {
      setStep(nextStep)
      botSay(`Спасибо, записал. Вопрос ${nextStep + 1} из ${totalSteps}:`, 400)
      botSay(allQuestions[nextStep].text, 1000)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      <div className="h-1 bg-slate-800">
        <div
          className="h-full bg-violet-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="px-4 py-2 text-xs text-slate-500 text-right">
        {step < totalSteps ? `Вопрос ${step + 1} из ${totalSteps}` : 'Готово'}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
          >
            {msg.from === 'bot' && (
              <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs text-white shrink-0">
                🤖
              </div>
            )}
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                msg.from === 'bot'
                  ? 'bg-slate-800 text-slate-100 rounded-bl-sm'
                  : 'bg-violet-600 text-white rounded-br-sm'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {typing && (
          <div className="flex items-end gap-2">
            <div className="w-7 h-7 rounded-full bg-violet-600 flex items-center justify-center text-xs shrink-0">
              🤖
            </div>
            <div className="bg-slate-800 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={finished ? 'Анкета отправлена' : 'Напишите ответ…'}
            disabled={finished || typing || sending}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || finished || typing || sending}
            className="w-11 h-11 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-colors shrink-0"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send size={16} className="text-white" />
            }
          </button>
        </div>
      </div>
    </div>
  )
}
