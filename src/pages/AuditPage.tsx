import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

type Step = 'form' | 'uploading' | 'done' | 'error'

const MAX_FILES = 20
const PRICE = '3 000 ₽'

export default function AuditPage() {
  const [url, setUrl] = useState('')
  const [contact, setContact] = useState('')
  const [notes, setNotes] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [step, setStep] = useState<Step>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function detectPlatform(u: string): 'ozon' | 'wb' | null {
    if (u.includes('ozon.ru')) return 'ozon'
    if (u.includes('wildberries.ru') || u.includes('wb.ru')) return 'wb'
    return null
  }

  function handleFiles(incoming: FileList | null) {
    if (!incoming) return
    const arr = Array.from(incoming).filter(f => f.type.startsWith('image/'))
    setFiles(prev => [...prev, ...arr].slice(0, MAX_FILES))
  }

  function removeFile(i: number) {
    setFiles(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const platform = detectPlatform(url)
    if (!platform) {
      setErrorMsg('Укажи ссылку на Ozon или Wildberries')
      return
    }
    if (!contact.trim()) {
      setErrorMsg('Укажи email или Telegram для связи')
      return
    }

    setStep('uploading')
    setErrorMsg('')

    try {
      // Upload screenshots to Supabase Storage
      const uploadedPaths: string[] = []
      for (const file of files) {
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error } = await supabase.storage
          .from('audit-screenshots')
          .upload(path, file)
        if (!error) uploadedPaths.push(path)
      }

      // Save order to DB
      const { error: dbError } = await supabase.from('audit_orders').insert({
        url: url.trim(),
        platform,
        contact: contact.trim(),
        notes: notes.trim(),
        screenshots: uploadedPaths,
        status: 'new',
      })

      if (dbError) throw dbError
      setStep('done')
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка при отправке')
      setStep('error')
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-white mb-4">Заявка принята!</h1>
          <p className="text-slate-300 text-base leading-relaxed bg-dark-900 border border-slate-700/50 rounded-2xl p-6">
            Мы свяжемся с тобой в течение <strong className="text-white">24 часов</strong> и пришлём готовый PDF-отчёт.
            <br /><br />
            <span className="text-slate-400 text-sm">Если не написали — напомни: <a href="https://t.me/annawilhelm" className="text-violet-400 hover:underline">@annawilhelm</a></span>
          </p>
        </div>
      </div>
    )
  }

  const platform = detectPlatform(url)

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-violet-950/60 to-dark-950 border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-600/20 text-violet-400 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-violet-500/30">
            📊 Аудит карточки товара WB / Ozon
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
            Узнай, почему карточка<br />
            <span className="text-violet-400">не продаёт</span>
          </h1>
          <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
            Анализируем сотни реальных отзывов покупателей и разбираем каждый слайд карточки.
            Получаешь конкретный список правок — не советы, а готовые фразы и ТЗ для дизайнера.
          </p>
        </div>
      </div>

      {/* What you get */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 gap-3 mb-10">
          {[
            ['👤', 'Портрет покупателя', 'Кто покупает, зачем, в каком контексте'],
            ['✅', 'Топ-5 причин покупки', 'За что хвалят — на языке реальных отзывов'],
            ['❗', 'Топ-5 проблем', 'Главные жалобы с цитатами покупателей'],
            ['🖼', 'Аудит каждого слайда', 'Что плохо, что исправить, что добавить'],
            ['📝', 'Готовый текст описания', 'Можно скопировать и вставить сразу'],
            ['🎯', 'Приоритеты правок 1–2–3', 'Что делать сначала, что потом'],
          ].map(([emoji, title, desc]) => (
            <div key={title} className="bg-dark-900 border border-slate-800 rounded-xl p-4">
              <div className="text-2xl mb-2">{emoji}</div>
              <div className="font-semibold text-sm text-white mb-1">{title}</div>
              <div className="text-xs text-slate-400 leading-snug">{desc}</div>
            </div>
          ))}
        </div>

        {/* Order form */}
        <div className="bg-dark-900 border border-slate-700/60 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Заказать аудит</h2>
            <span className="text-violet-400 font-bold text-xl">{PRICE}</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Ссылка на товар *
              </label>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://www.ozon.ru/product/... или wildberries.ru/catalog/..."
                className="w-full bg-dark-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
              {url && !platform && (
                <p className="text-red-400 text-xs mt-1">Поддерживаются только Ozon и Wildberries</p>
              )}
              {platform && (
                <p className="text-green-400 text-xs mt-1">
                  {platform === 'ozon' ? '🟠 Ozon' : '🟣 Wildberries'} — распознано
                </p>
              )}
            </div>

            {/* Contact */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Telegram или email *
              </label>
              <input
                type="text"
                value={contact}
                onChange={e => setContact(e.target.value)}
                placeholder="@username или example@mail.ru"
                className="w-full bg-dark-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
                required
              />
            </div>

            {/* Screenshots */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Скрины карточки (инфографика, описание)
                <span className="text-slate-500 font-normal ml-1">— до {MAX_FILES} фото</span>
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-xl p-6 text-center cursor-pointer transition-colors"
              >
                <div className="text-3xl mb-2">📎</div>
                <p className="text-sm text-slate-400">Нажми чтобы выбрать файлы</p>
                <p className="text-xs text-slate-600 mt-1">PNG, JPG, WEBP</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
              {files.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-dark-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300">
                      🖼 {f.name.length > 20 ? f.name.slice(0, 17) + '...' : f.name}
                      <button type="button" onClick={() => removeFile(i)} className="text-slate-500 hover:text-red-400 ml-1">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Комментарий <span className="text-slate-500 font-normal">(необязательно)</span>
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Что беспокоит? Недавно меняли поставщика, упал CTR, много возвратов..."
                rows={3}
                className="w-full bg-dark-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors resize-none"
              />
            </div>

            {errorMsg && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={step === 'uploading'}
              className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              {step === 'uploading' ? '⏳ Отправляем...' : `Заказать аудит — ${PRICE}`}
            </button>

            <p className="text-center text-xs text-slate-500">
              Готовый PDF придёт в течение 24 часов. Реквизиты для оплаты — после подтверждения заявки.
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
