// WB Генератор отчёта
// Использование: node wb_report.mjs <артикул>
// Пример: node wb_report.mjs 175088486
//
// Скрипт берёт файл reviews_<артикул>.txt, анализирует
// и генерирует красивый HTML отчёт готовый к отправке клиенту.
// Для PDF — открой HTML в браузере и нажми Ctrl+P → Сохранить как PDF

import fs from 'fs';

const nmId = process.argv[2] || '175088486';
const reviewsFile = `reviews_${nmId}.txt`;

if (!fs.existsSync(reviewsFile)) {
  console.error(`❌ Файл ${reviewsFile} не найден. Сначала запусти: node wb_analyzer.mjs ${nmId}`);
  process.exit(1);
}

const reviewsRaw = fs.readFileSync(reviewsFile, 'utf8');
const lines = reviewsRaw.split('\n').filter(Boolean);

// Парсим отзывы
const reviews = lines.map(line => {
  const ratingMatch = line.match(/\[(\d)★\]/);
  const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
  const text = line.replace(/^\d+\.\s*\[\d★\]\s*/, '').trim();
  return { rating, text };
});

// Считаем статистику
const total = reviews.length;
const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
reviews.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });
const avg = (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1);
const positive = Math.round((dist[5] + dist[4]) / total * 100);
const negative = Math.round((dist[1] + dist[2]) / total * 100);

const today = new Date().toLocaleDateString('ru-RU');

// Читаем анализ если есть
const analysisFile = `result_${nmId}.md`;
const hasAnalysis = fs.existsSync(analysisFile);
const analysisText = hasAnalysis ? fs.readFileSync(analysisFile, 'utf8') : '';

// Примеры отзывов для отчёта
const topPositive = reviews.filter(r => r.rating === 5).slice(0, 3);
const topNegative = reviews.filter(r => r.rating <= 2).slice(0, 3);

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Аудит карточки WB — Артикул ${nmId}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; color: #222; }
  .page { max-width: 860px; margin: 0 auto; background: #fff; padding: 48px; }

  /* Шапка */
  .header { border-bottom: 3px solid #2563eb; padding-bottom: 24px; margin-bottom: 32px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand { font-size: 13px; color: #2563eb; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; }
  .date { font-size: 13px; color: #888; }
  .title { font-size: 28px; font-weight: 700; margin: 12px 0 4px; }
  .subtitle { font-size: 14px; color: #666; }

  /* Статистика */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .stat { background: #f0f4ff; border-radius: 12px; padding: 16px; text-align: center; }
  .stat-num { font-size: 32px; font-weight: 700; color: #2563eb; }
  .stat-label { font-size: 12px; color: #666; margin-top: 4px; }

  /* Рейтинг бар */
  .rating-bars { margin-bottom: 32px; }
  .rating-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .rating-label { font-size: 13px; width: 24px; text-align: right; }
  .rating-bar-wrap { flex: 1; background: #eee; border-radius: 4px; height: 10px; }
  .rating-bar { height: 10px; border-radius: 4px; background: #2563eb; }
  .rating-bar.negative { background: #ef4444; }
  .rating-bar.neutral { background: #f59e0b; }
  .rating-count { font-size: 12px; color: #888; width: 32px; }

  /* Секции */
  .section { margin-bottom: 32px; }
  .section-title { font-size: 16px; font-weight: 700; color: #2563eb; border-left: 4px solid #2563eb; padding-left: 12px; margin-bottom: 16px; text-transform: uppercase; letter-spacing: 0.5px; }

  /* Карточки причин/проблем */
  .cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
  .card.positive { border-left: 4px solid #22c55e; }
  .card.negative { border-left: 4px solid #ef4444; }
  .card-num { font-size: 11px; color: #888; margin-bottom: 4px; }
  .card-text { font-size: 14px; font-weight: 600; }
  .card-quote { font-size: 12px; color: #666; margin-top: 6px; font-style: italic; }

  /* Язык клиента */
  .phrases { display: flex; flex-wrap: wrap; gap: 8px; }
  .phrase { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 20px; padding: 6px 14px; font-size: 13px; color: #1d4ed8; }

  /* Отзывы */
  .review { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
  .review.positive { border-left: 4px solid #22c55e; }
  .review.negative { border-left: 4px solid #ef4444; }
  .review-stars { color: #f59e0b; font-size: 14px; margin-bottom: 6px; }
  .review-text { font-size: 13px; color: #444; line-height: 1.5; }

  /* Правки */
  .fix { display: flex; gap: 12px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 10px; margin-bottom: 8px; }
  .fix-num { background: #2563eb; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
  .fix-text { font-size: 14px; line-height: 1.5; }

  /* Итог */
  .conclusion { background: #eff6ff; border: 2px solid #2563eb; border-radius: 12px; padding: 20px 24px; }
  .conclusion-text { font-size: 16px; font-weight: 600; color: #1e40af; line-height: 1.6; }

  /* Футер */
  .footer { margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #999; }

  @media print {
    body { background: #fff; }
    .page { padding: 24px; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page">

  <!-- Шапка -->
  <div class="header">
    <div class="header-top">
      <span class="brand">WB Аудит карточки</span>
      <span class="date">${today}</span>
    </div>
    <div class="title">Анализ отзывов покупателей</div>
    <div class="subtitle">Артикул: ${nmId} &nbsp;•&nbsp; Отзывов проанализировано: ${total}</div>
  </div>

  <!-- Статистика -->
  <div class="stats">
    <div class="stat">
      <div class="stat-num">${total}</div>
      <div class="stat-label">Отзывов с текстом</div>
    </div>
    <div class="stat">
      <div class="stat-num">${avg}★</div>
      <div class="stat-label">Средний рейтинг</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#22c55e">${positive}%</div>
      <div class="stat-label">Позитивных (4-5★)</div>
    </div>
    <div class="stat">
      <div class="stat-num" style="color:#ef4444">${negative}%</div>
      <div class="stat-label">Негативных (1-2★)</div>
    </div>
  </div>

  <!-- Распределение рейтингов -->
  <div class="section">
    <div class="section-title">Распределение оценок</div>
    <div class="rating-bars">
      ${[5,4,3,2,1].map(s => {
        const count = dist[s];
        const pct = total > 0 ? Math.round(count / total * 100) : 0;
        const cls = s >= 4 ? '' : s === 3 ? 'neutral' : 'negative';
        return `<div class="rating-row">
          <div class="rating-label">${s}★</div>
          <div class="rating-bar-wrap"><div class="rating-bar ${cls}" style="width:${pct}%"></div></div>
          <div class="rating-count">${count}</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <!-- Примеры позитивных отзывов -->
  <div class="section">
    <div class="section-title">✅ Что покупатели хвалят</div>
    ${topPositive.map(r => `
    <div class="review positive">
      <div class="review-stars">★★★★★</div>
      <div class="review-text">${escapeHtml(r.text.slice(0, 250))}</div>
    </div>`).join('')}
  </div>

  <!-- Примеры негативных отзывов -->
  ${topNegative.length ? `
  <div class="section">
    <div class="section-title">❗ Главные жалобы</div>
    ${topNegative.map(r => `
    <div class="review negative">
      <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)} ${r.rating}/5</div>
      <div class="review-text">${escapeHtml(r.text.slice(0, 250))}</div>
    </div>`).join('')}
  </div>` : ''}

  <!-- Место для анализа -->
  <div class="section">
    <div class="section-title">📋 Рекомендации по карточке</div>
    <div class="fix">
      <div class="fix-num">1</div>
      <div class="fix-text">Заполните этот раздел после анализа отзывов в Claude Code</div>
    </div>
    <div class="fix">
      <div class="fix-num">2</div>
      <div class="fix-text">Используй файл ПРОМПТ_для_анализа.md — вставь в чат вместе с отзывами и скринами карточки</div>
    </div>
    <div class="fix">
      <div class="fix-num">3</div>
      <div class="fix-text">Готовые правки скопируй сюда и пересохрани HTML</div>
    </div>
  </div>

  <!-- Итог -->
  <div class="section">
    <div class="section-title">🎯 Итог</div>
    <div class="conclusion">
      <div class="conclusion-text">Вставь сюда итоговый вывод после анализа</div>
    </div>
  </div>

  <!-- Футер -->
  <div class="footer">
    Отчёт подготовлен на основе ${total} реальных отзывов покупателей с Wildberries &nbsp;•&nbsp; ${today}<br>
    Для получения PDF: Ctrl+P → Сохранить как PDF
  </div>

</div>
</body>
</html>`;

const outputFile = `report_${nmId}.html`;
fs.writeFileSync(outputFile, html, 'utf8');
console.log(`\n✅ Отчёт создан: ${outputFile}`);
console.log(`   Открой в браузере — там вся статистика`);
console.log(`   Для PDF: Ctrl+P → Сохранить как PDF\n`);
