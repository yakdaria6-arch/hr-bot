// WB Анализатор отзывов конкурентов
// Использование: node wb_analyzer.mjs <артикул WB> [--limit=1000] [--period=7d]
// Периоды: --period=1d  --period=7d  --period=30d
// Пример: node wb_analyzer.mjs 175088486 --period=30d

const nmId = parseInt(process.argv[2]) || 175088486;
const args = process.argv.slice(3);

const limitArg = args.find(a => a.startsWith('--limit='));
const periodArg = args.find(a => a.startsWith('--period='));

const TARGET_REVIEWS = limitArg ? parseInt(limitArg.split('=')[1]) : Infinity;

function parsePeriod(arg) {
  if (!arg) return null;
  const val = arg.split('=')[1];
  const now = Date.now();
  if (val === '1d')  return new Date(now - 1  * 24 * 60 * 60 * 1000);
  if (val === '7d')  return new Date(now - 7  * 24 * 60 * 60 * 1000);
  if (val === '30d') return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}
const periodFrom = parsePeriod(periodArg);

if (periodFrom) {
  console.log(`📅 Фильтр по периоду: с ${periodFrom.toLocaleDateString('ru-RU')}`);
}

// Шаг 1: Получаем imt_id через basket API
function getBasketNum(vol) {
  if      (vol <= 143)  return '01';
  else if (vol <= 287)  return '02';
  else if (vol <= 431)  return '03';
  else if (vol <= 719)  return '04';
  else if (vol <= 1007) return '05';
  else if (vol <= 1061) return '06';
  else if (vol <= 1115) return '07';
  else if (vol <= 1169) return '08';
  else if (vol <= 1313) return '09';
  else if (vol <= 1601) return '10';
  else if (vol <= 1655) return '11';
  else if (vol <= 1919) return '12';
  else if (vol <= 2045) return '13';
  else if (vol <= 2189) return '14';
  else if (vol <= 2405) return '15';
  else if (vol <= 2621) return '16';
  else if (vol <= 2837) return '17';
  else if (vol <= 3053) return '18';
  else if (vol <= 3269) return '19';
  else if (vol <= 3485) return '20';
  else if (vol <= 3701) return '21';
  else if (vol <= 3917) return '22';
  else if (vol <= 4133) return '23';
  else if (vol <= 4349) return '24';
  else if (vol <= 4565) return '25';
  else if (vol <= 4781) return '26';
  else if (vol <= 4997) return '27';
  else if (vol <= 5213) return '28';
  else if (vol <= 5429) return '29';
  else if (vol <= 5645) return '30';
  else return '31';
}

async function getImtId(nmId) {
  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.wildberries.ru/' };

  // Пробуем сначала вычисленный basket, потом перебираем соседние
  const guessed = getBasketNum(vol);
  const candidates = [guessed];
  for (let i = 1; i <= 5; i++) {
    const n = parseInt(guessed) + i;
    candidates.push(String(n).padStart(2, '0'));
    const m = parseInt(guessed) - i;
    if (m >= 1) candidates.unshift(String(m).padStart(2, '0'));
  }

  for (const basket of [...new Set(candidates)]) {
    const url = `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.imt_id) return { imtId: data.imt_id, name: data.imt_name, brand: data.subj_root_name };
    } catch {}
  }
  throw new Error(`Не удалось найти карточку товара ни в одном basket`);
}

// Шаг 2: Собираем отзывы с пагинацией
async function fetchReviews(imtId) {
  const allReviews = new Map(); // дедупликация по id
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.wildberries.ru/'
  };

  const orders = ['dateDesc', 'dateAsc', 'rankAsc'];

  for (const order of orders) {
    if (allReviews.size >= TARGET_REVIEWS) break;

    let skip = 0;
    let hasMore = true;

    while (hasMore && allReviews.size < TARGET_REVIEWS) {
      const url = `https://feedbacks2.wb.ru/feedbacks/v2/${imtId}?order=${order}&skip=${skip}&take=5000`;
      try {
        const res = await fetch(url, { headers });
        const data = await res.json();
        const feedbacks = data.feedbacks || [];

        if (feedbacks.length === 0) { hasMore = false; break; }

        const beforeSize = allReviews.size;
        let hitPeriodBound = false;

        feedbacks.forEach(f => {
          const text = [f.text, f.pros, f.cons].filter(Boolean).join(' ').trim();
          if (text.length <= 10) return;

          const date = f.createdDate?.slice(0, 10) || '';
          const createdAt = f.createdDate ? new Date(f.createdDate) : null;

          // Если отзыв старше периода — пропускаем и ставим флаг
          if (periodFrom && createdAt && createdAt < periodFrom) {
            hitPeriodBound = true;
            return;
          }

          allReviews.set(f.id, {
            text: f.text || '',
            pros: f.pros || '',
            cons: f.cons || '',
            rating: f.productValuation,
            date,
          });
        });

        console.log(`  [${order}] skip=${skip} получено: ${feedbacks.length}, всего с текстом: ${allReviews.size}`);

        // Останавливаемся если достигли границы периода
        if (periodFrom && hitPeriodBound) {
          console.log('  → достигли границы периода, останавливаемся');
          hasMore = false;
          break;
        }

        // Если новых отзывов не добавилось — дальше нет смысла
        if (allReviews.size === beforeSize) { hasMore = false; break; }

        skip += feedbacks.length;
        await new Promise(r => setTimeout(r, 800));
      } catch(e) {
        console.log(`  Ошибка [${order}] skip=${skip}:`, e.message);
        hasMore = false;
      }
    }
  }

  return Array.from(allReviews.values());
}

// Шаг 3: Анализ через Claude API
async function analyzeWithClaude(productName, reviews) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('\n⚠️  Установи ANTHROPIC_API_KEY для AI-анализа');
    console.log('Пример: set ANTHROPIC_API_KEY=sk-ant-...\n');
    return null;
  }

  const sample = reviews.slice(0, 150);
  const reviewsText = sample.map((r, i) => {
    const parts = [r.text, r.pros ? '+ ' + r.pros : '', r.cons ? '- ' + r.cons : ''].filter(Boolean).join(' ');
    return `${i+1}. [${r.rating}★] ${parts.slice(0, 200)}`;
  }).join('\n');

  console.log(`\n🤖 Анализирую ${sample.length} отзывов через Claude...\n`);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Ты опытный маркетолог. Проанализируй ${sample.length} реальных отзывов покупателей с Wildberries на товар "${productName}".

Сделай структурированный анализ:

1. КТО ПОКУПАЕТ — портрет ЦА (пол, возраст если упоминается, для себя/семьи/подарок, тип волос)
2. ТОП-5 ПРИЧИН ПОКУПКИ — что привлекает, за что хвалят чаще всего
3. ТОП-5 ПРОБЛЕМ — главные жалобы и разочарования
4. ТРИГГЕРЫ ПОВТОРНОЙ ПОКУПКИ — почему берут снова
5. ЯЗЫК КЛИЕНТА — дословные фразы которые повторяются
6. ИНСАЙТ ДЛЯ КАРТОЧКИ — что изменить в описании чтобы повысить конверсию
7. ИТОГО — одно предложение: кто этот покупатель и что ему важно

Отзывы:
${reviewsText}`
      }]
    })
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

// MAIN
async function main() {
  console.log(`\n📦 WB Анализатор отзывов`);
  console.log(`Артикул: ${nmId}`);
  if (periodArg) console.log(`📅 Период: ${periodArg.split('=')[1]}`);
  console.log();

  // Получаем imt_id
  console.log('🔍 Получаю информацию о товаре...');
  const { imtId, name } = await getImtId(nmId);
  console.log(`✅ Товар: ${name}`);
  console.log(`   imt_id: ${imtId}\n`);

  // Собираем отзывы
  console.log('📥 Собираю отзывы...');
  const reviews = await fetchReviews(imtId);
  console.log(`\n✅ Итого отзывов с текстом: ${reviews.length}\n`);

  if (!reviews.length) {
    console.log('❌ Отзывы не найдены');
    return;
  }

  // Показываем примеры
  console.log('📝 Примеры отзывов:');
  console.log('─'.repeat(60));
  reviews.slice(0, 5).forEach((r, i) => {
    const text = [r.text, r.pros, r.cons].filter(Boolean).join(' | ').slice(0, 150);
    console.log(`${i+1}. [${r.rating}★] ${text}`);
  });
  console.log('─'.repeat(60));

  // AI анализ
  const analysis = await analyzeWithClaude(name, reviews);

  // Всегда сохраняем отзывы в файл для анализа
  const fs = await import('fs');
  const suffix = periodArg ? `_${periodArg.split('=')[1]}` : '';
  const filename = `reviews_${nmId}${suffix}.txt`;
  const lines = reviews.slice(0, 300).map((r, i) => {
    const parts = [r.text, r.pros ? 'Плюсы: '+r.pros : '', r.cons ? 'Минусы: '+r.cons : ''].filter(Boolean).join(' | ');
    return `${i+1}. [${r.rating}★] [${r.date}] ${parts}`;
  });
  fs.writeFileSync(filename, lines.join('\n'), 'utf8');
  console.log(`\n💾 Отзывы сохранены в файл: ${filename}`);
  console.log(`   Скинь этот файл в чат с Claude для анализа!`);

  if (analysis) {
    console.log('\n' + '═'.repeat(60));
    console.log('АНАЛИЗ ЦЕЛЕВОЙ АУДИТОРИИ');
    console.log('═'.repeat(60));
    console.log(analysis);
    console.log('═'.repeat(60));

    const resultFile = `result_${nmId}${suffix}.md`;
    const content = `# Анализ ЦА: ${name}\n\nАртикул WB: ${nmId} | imt_id: ${imtId}\nОтзывов: ${Math.min(reviews.length, 150)}\nПериод: ${periodArg || 'все время'}\nДата: ${new Date().toLocaleDateString('ru-RU')}\n\n${analysis}`;
    fs.writeFileSync(resultFile, content, 'utf8');
    console.log(`💾 Анализ сохранён: ${resultFile}`);
  }
}

main().catch(e => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
