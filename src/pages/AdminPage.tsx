import { useState } from 'react'
import { LayoutDashboard, Users, Briefcase, LogOut, Bot, BarChart2 } from 'lucide-react'
import Dashboard from '../components/Dashboard'
import CandidateTable from '../components/CandidateTable'
import VacancyManager from '../components/VacancyManager'
import AuditOrders from '../components/AuditOrders'

type Tab = 'dashboard' | 'candidates' | 'vacancies' | 'audits'

interface Props {
  onLogout: () => void
}

export default function AdminPage({ onLogout }: Props) {
  const [tab, setTab] = useState<Tab>('dashboard')

  const tabs = [
    { id: 'dashboard' as Tab,  label: 'Дашборд',    Icon: LayoutDashboard },
    { id: 'candidates' as Tab, label: 'Кандидаты',  Icon: Users },
    { id: 'vacancies' as Tab,  label: 'Вакансии',   Icon: Briefcase },
    { id: 'audits' as Tab,     label: 'Аудиты',     Icon: BarChart2 },
  ]

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-dark-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
            <Bot size={16} className="text-white" />
          </div>
          <span className="font-bold text-white text-sm">HR Бот</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left ${
                tab === id
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {tab === 'dashboard'  && <Dashboard />}
        {tab === 'candidates' && <CandidateTable />}
        {tab === 'vacancies'  && <VacancyManager />}
        {tab === 'audits'     && <AuditOrders />}
      </main>
    </div>
  )
}
