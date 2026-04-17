import type { Question, Answer, ScoreCategory } from '../types'

// ─── Keyword-based scoring (всегда работает, бесплатно) ───────────────────────

function scoreByKeywords(answer: string, question: Question): number {
  const text = answer.toLowerCase()

  const hasGood = question.good_keywords.some(kw => text.includes(kw.toLowerCase()))
  const hasBad  = question.bad_keywords.some(kw => text.includes(kw.toLowerCase()))

  if (hasBad)  return 0
  if (hasGood) return question.weight
  return question.weight * 0.5 // нейтральный ответ
}

// ─── OpenAI scoring (если VITE_OPENAI_KEY задан) ─────────────────────────────

async function scoreWithAI(
  answer: string,
  question: Question
): Promise<number> {
  const apiKey = import.meta.env.VITE_OPENAI_KEY
  if (!apiKey) return scoreByKeywords(answer, question)

  try {
    const prompt = `Ты — HR-ассистент. Оцени ответ кандидата на вопрос по шкале 0-${question.weight}.

Вопрос: "${question.text}"
Ответ кандидата: "${answer}"
Хорошие признаки ответа: ${question.good_keywords.join(', ')}
Плохие признаки: ${question.bad_keywords.join(', ')}

Ответь ТОЛЬКО числом от 0 до ${question.weight}. Без пояснений.`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 5,
        temperature: 0,
      }),
    })

    const data = await res.json()
    const raw = data.choices?.[0]?.message?.content?.trim()
    const score = parseFloat(raw)
    if (isNaN(score)) return scoreByKeywords(answer, question)
    return Math.min(Math.max(score, 0), question.weight)
  } catch {
    return scoreByKeywords(answer, question)
  }
}

// ─── Главная функция ──────────────────────────────────────────────────────────

export async function scoreAnswers(
  questions: Question[],
  rawAnswers: Record<string, string>
): Promise<Answer[]> {
  const scored: Answer[] = []

  for (const q of questions) {
    const text = rawAnswers[q.id] ?? ''
    const score = await scoreWithAI(text, q)
    scored.push({
      question_id:   q.id,
      question_text: q.text,
      answer_text:   text,
      score:         Math.round(score * 10) / 10,
      max_score:     q.weight,
    })
  }

  return scored
}

export function calcTotalScore(answers: Answer[]): number {
  if (!answers.length) return 0
  const total = answers.reduce((s, a) => s + a.score, 0)
  const max   = answers.reduce((s, a) => s + a.max_score, 0)
  if (!max) return 0
  return Math.round((total / max) * 100)
}

export function getCategory(score: number, passScore = 60): ScoreCategory {
  if (score >= 80)        return 'green'
  if (score >= passScore) return 'yellow'
  return 'red'
}

export function categoryLabel(c: ScoreCategory) {
  return { green: 'Отличный', yellow: 'Средний', red: 'Не подходит' }[c]
}

export function categoryMessage(c: ScoreCategory) {
  return {
    green:  'Отлично! Мы свяжемся с вами для назначения собеседования.',
    yellow: 'Спасибо! Мы рассмотрим вашу анкету и свяжемся в ближайшее время.',
    red:    'Спасибо за интерес! К сожалению, ваш опыт пока не совсем подходит. Сохраним ваш контакт на будущее.',
  }[c]
}
