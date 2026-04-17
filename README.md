# HR Bot

Чат-бот для первичного скрининга кандидатов. Задаёт вопросы, автоматически оценивает ответы, уведомляет HR в Telegram.

## Стек

- **React 18 + TypeScript + Vite**
- **Tailwind CSS** — тёмная тема
- **Supabase** — база данных (vacancies + candidates)
- **OpenAI gpt-4o-mini** — умная оценка ответов (опционально, есть ключевое-словный fallback)
- **Telegram Bot API** — уведомления HR о новых кандидатах

---

## Запуск

### 1. Установить зависимости

```bash
npm install
```

### 2. Настроить Supabase

1. Создать проект на [supabase.com](https://supabase.com)
2. Открыть **SQL Editor** и выполнить `supabase/schema.sql`
3. Скопировать **Project URL** и **anon key** из Settings → API

### 3. Заполнить `.env`

```bash
cp .env.example .env
```

Заполнить переменные в `.env` (минимум нужны SUPABASE_URL и SUPABASE_ANON_KEY).

### 4. Запустить

```bash
npm run dev
```

Открыть [http://localhost:5173/admin](http://localhost:5173/admin)

---

## Переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `VITE_SUPABASE_URL` | ✅ | URL проекта Supabase |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Публичный ключ Supabase |
| `VITE_ADMIN_PASSWORD` | ✅ | Пароль для /admin (по умолчанию `admin123`) |
| `VITE_OPENAI_KEY` | — | sk-... для умной оценки через GPT |
| `VITE_TELEGRAM_BOT_TOKEN` | — | Токен бота от @BotFather |
| `VITE_TELEGRAM_CHAT_ID` | — | ID чата/канала для уведомлений |

---

## Как это работает

1. HR создаёт вакансию в `/admin` → получает ссылку `/apply/:id`
2. Кандидат переходит по ссылке → чат-бот задаёт вопросы
3. Система оценивает ответы (0–100%) по ключевым словам или GPT
4. Результат сохраняется в Supabase
5. Если кандидат зелёный или жёлтый — HR получает уведомление в Telegram
6. HR видит всех кандидатов в панели, меняет статусы, оставляет заметки, экспортирует CSV

### Категории кандидатов

- 🟢 **Подходит** (≥80%) — уведомление в Telegram
- 🟡 **Рассмотреть** (≥pass_score, <80%) — уведомление в Telegram  
- 🔴 **Не подходит** (<pass_score) — без уведомления

---

## Деплой (Vercel / Netlify)

```bash
npm run build
```

Папка `dist/` — статический сайт. Деплоится на любой хостинг статики.

На Vercel/Netlify добавить все переменные `VITE_*` в Environment Variables проекта.

> **Важно**: так как это SPA с React Router, нужно настроить redirect всех 404 → `index.html`.
> - Vercel: создать `vercel.json` с `{"rewrites": [{"source": "/(.*)", "destination": "/"}]}`
> - Netlify: создать `public/_redirects` со строкой `/* /index.html 200`
