import type { Candidate, Vacancy } from '../types'
import { categoryLabel } from './scoring'

export async function notifyTelegram(
  candidate: Candidate,
  vacancy: Vacancy
): Promise<void> {
  const botToken = import.meta.env.VITE_TELEGRAM_BOT_TOKEN
  const chatId   = vacancy.telegram_chat_id || import.meta.env.VITE_TELEGRAM_CHAT_ID

  if (!botToken || !chatId) return

  const emoji = { green: '🟢', yellow: '🟡', red: '🔴' }[candidate.category]
  const label = categoryLabel(candidate.category)

  const topAnswers = candidate.answers
    .slice(0, 4)
    .map(a => `• <b>${a.question_text}</b>\n  ${a.answer_text.slice(0, 120)}`)
    .join('\n\n')

  const text = [
    `${emoji} <b>Новый кандидат — ${label}</b>`,
    '',
    `📋 <b>Вакансия:</b> ${vacancy.title} | ${vacancy.company_name}`,
    `👤 <b>Имя:</b> ${candidate.name}`,
    `📧 <b>Email:</b> ${candidate.email}`,
    candidate.phone ? `📱 <b>Телефон:</b> ${candidate.phone}` : '',
    `🎯 <b>Балл:</b> ${candidate.total_score}%`,
    '',
    '<b>Ответы:</b>',
    topAnswers,
    '',
    `🔗 Открыть: ${window.location.origin}/admin`,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text,
        parse_mode: 'HTML',
      }),
    })
  } catch (e) {
    console.warn('Telegram notify failed:', e)
  }
}
