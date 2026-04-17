export type ScoreCategory = 'green' | 'yellow' | 'red'
export type CandidateStatus = 'new' | 'interview' | 'hired' | 'rejected' | 'pending'

export interface Question {
  id: string
  text: string
  weight: number // 1-5
  good_keywords: string[]
  bad_keywords: string[]
  required: boolean
}

export interface Vacancy {
  id: string
  company_name: string
  title: string
  description: string
  salary: string
  schedule: string
  format: string // офис / удалёнка / гибрид
  pass_score: number // % для зелёного, напр. 60
  questions: Question[]
  created_at: string
  is_active: boolean
  telegram_chat_id?: string // куда слать уведомления
}

export interface Answer {
  question_id: string
  question_text: string
  answer_text: string
  score: number
  max_score: number
}

export interface Candidate {
  id: string
  vacancy_id: string
  vacancy_title?: string
  name: string
  email: string
  phone?: string
  answers: Answer[]
  total_score: number       // 0-100 %
  category: ScoreCategory
  status: CandidateStatus
  notes: string
  created_at: string
}

export interface DashboardStats {
  total: number
  green: number
  yellow: number
  red: number
  today: number
  avg_score: number
}
