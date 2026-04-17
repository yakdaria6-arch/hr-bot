import { useState } from 'react'
import { Lock, Bot } from 'lucide-react'

interface Props {
  onLogin: () => void
}

export default function AdminLogin({ onLogin }: Props) {
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [shake, setShake]       = useState(false)

  const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('hr_admin_auth', '1')
      onLogin()
    } else {
      setError('Неверный пароль')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-dark-950 flex items-center justify-center p-4">
      <div className={`w-full max-w-sm ${shake ? 'animate-shake' : ''}`}>
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-violet-600 rounded-2xl mb-4">
            <Bot size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">HR Бот</h1>
          <p className="text-slate-400 text-sm mt-1">Панель администратора</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-dark-850 border border-slate-700/50 rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Пароль
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Введите пароль"
                autoFocus
                className="w-full bg-dark-900 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
            </div>
            {error && (
              <p className="text-red-400 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Войти
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          Пароль задаётся в переменной <code className="text-slate-500">VITE_ADMIN_PASSWORD</code>
        </p>
      </div>
    </div>
  )
}
