# Технический отчёт: автоматический сбор и AI-анализ отзывов WB и Ozon

---

## 1. КАК СОБИРАТЬ ОТЗЫВЫ

### Wildberries — два способа

**Способ A: Официальный API (свои отзывы)**
- Токен → личный кабинет продавца → Настройки → Доступ к API → категория "Feedbacks and Questions"
- Лимит: 3 запроса/секунду, бесплатно
- **Ограничение: только отзывы на СВОИ товары**

**Способ B: Публичный API (чужие отзывы конкурентов)**
```python
import requests

# Получить данные по артикулу конкурента (без авторизации)
article_id = 174938948
url = f"https://feedbacks2.wb.ru/feedbacks/v2/{article_id}"
feedbacks = requests.get(url).json()
# Возвращает: текст отзыва, оценку, дату, pros/cons
```
- Прокси нужны при 50+ запросах в час с одного IP

### Ozon — сложнее

- **Официальный API отзывов** — только при подписке Premium Plus: **24 990 руб/мес** (слишком дорого)
- **Парсинг через Playwright** — динамический JS, нужны прокси + обход капчи

```python
from playwright.async_api import async_playwright

async def parse_ozon_reviews(url):
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(user_agent="Mozilla/5.0...")
        await page.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        await page.goto(url)
        # ... парсинг CSS-селекторами
```

### Готовые GitHub-проекты (рабочие, 2025)
- `eslazarev/wildberries-sdk` — официальный Python SDK для WB API
- `korovokliu/ozon-wildberries-parser` — парсит оба маркетплейса
- `Timur1991/parser_wildberries_2023` — обновлён в 2025, стабильный

### Сложность и нужны ли прокси

| Источник | Сложность | Прокси | Капча |
|---|---|---|---|
| WB (свои отзывы, API) | Низкая | Нет | Нет |
| WB (чужие, публичный API) | Средняя | Нужны при 50+ req/ч | Редко |
| Ozon (платный API) | Низкая | Нет | Нет |
| Ozon (парсинг JS) | Высокая | Обязательно | Да |

---

## 2. КАК АНАЛИЗИРОВАТЬ ЧЕРЕЗ ИИ

### Вариант A — Локальные модели (бесплатно, быстро)

**Dostoevsky** — лучшая библиотека для сентимент-анализа на русском:
```python
# pip install dostoevsky
from dostoevsky.models import FastTextSocialNetworkModel
model = FastTextSocialNetworkModel(tokenizer=tokenizer)
results = model.predict(reviews, k=5)
# → {'positive': 0.92, 'negative': 0.02, 'neutral': 0.04}
```
Классифицирует: positive / negative / neutral / speech / skip

**RuBERT** — точнее, но медленнее (нужен GPU):
- Модель: `blanchefort/rubert-base-cased-sentiment`
- Обучена на 351 797 текстах на русском
- Через `transformers` от HuggingFace

### Вариант B — Claude API / GPT (самый мощный)

Извлекает структурированную информацию которую локальные модели не умеют:

```python
import anthropic, json

client = anthropic.Anthropic()

def analyze_reviews_batch(reviews: list[str]) -> dict:
    reviews_text = "\n".join([f"{i+1}. {r}" for i, r in enumerate(reviews)])
    
    message = client.messages.create(
        model="claude-haiku-4-5",  # самый дешёвый
        max_tokens=2000,
        messages=[{"role": "user", "content": f"""
Проанализируй отзывы и извлеки в JSON:
1. Портрет ЦА (пол, возраст, контекст использования)
2. Топ-5 причин покупки
3. Топ-5 проблем и жалоб
4. Эмоциональные триггеры
5. Сценарии использования
6. Упоминания конкурентов

Отзывы:
{reviews_text}
"""}]
    )
    return json.loads(message.content[0].text)

# Батчинг по 25 отзывов
for i in range(0, len(all_reviews), 25):
    result = analyze_reviews_batch(all_reviews[i:i+25])
```

---

## 3. СТОИМОСТЬ CLAUDE API — КОНКРЕТНЫЕ ЦИФРЫ

Средний отзыв = ~100 слов ≈ 150 токенов.
**500 отзывов = ~101 000 input + 20 000 output токенов**

| Модель | Стоимость 500 отзывов |
|---|---|
| **Claude Haiku 4.5** | **~$0.20** |
| Claude Sonnet 4.6 | ~$0.60 |
| GPT-4o | ~$0.45 |

**Batch API (скидка 50%):** Claude Haiku → **~$0.10 за 500 отзывов**

Анализ 10 000 отзывов = ~$2. Это копейки.

---

## 4. ЧТО ВЫДАЁТ АНАЛИЗ НА ВЫХОДЕ

Из 500 отзывов AI-пайплайн автоматически извлекает:

**Портрет ЦА:**
- Пол/возраст (если упоминается: "покупала маме", "для ребёнка 5 лет")
- Контекст жизни ("для офиса", "беременная", "занимаюсь спортом")
- Сценарии: "подарок", "ежедневное использование", "профессиональное применение"

**Продуктовые инсайты:**
- Топ жалоб: размерная сетка, запах, цвет не как на фото, хрупкая упаковка
- Топ похвал: мягкость, быстрая доставка, соответствие описанию
- Неожиданные сценарии использования

**Конкурентный анализ:**
- Упоминания конкурентных брендов
- Почему переключились на этот товар / ушли к конкуренту

---

## 5. СРОКИ MVP

| Вариант | Что включает | Срок |
|---|---|---|
| **Минимальный скрипт** | WB API + Dostoevsky + CSV | **3–5 дней** |
| **MVP инструмент** | WB+Ozon + Claude API + Streamlit | **1.5–2 недели** |
| **Продукт (SaaS)** | БД + прокси + веб-интерфейс | **4–6 недель** |

### Рекомендуемый стек MVP
```
Сбор:      wildberries-sdk + Playwright (Ozon)
Хранение:  SQLite → PostgreSQL/Supabase
Анализ:    Dostoevsky (быстро) + Claude Haiku API (глубоко)
Интерфейс: Streamlit (быстрее всего)
Деплой:    Railway / Amvera
```

### Главные трудности
1. Ozon без подписки — Playwright + прокси, нестабильно (меняет вёрстку)
2. WB чужие отзывы — недокументированный API, URL меняются
3. Промпт-инжиниринг — нужен стабильный JSON-output от LLM
4. Борьба маркетплейсов с ботами — код нужно обновлять

---

*Источники: habr.com, openapi.wildberries.ru, dev.ozon.ru, github.com, huggingface.co, platform.claude.com*
*Дата исследования: апрель 2026*
