// WB Анализатор отзывов конкурентов
// Использование: node wb_analyzer.mjs <артикул WB>
// Пример: node wb_analyzer.mjs 175088486

const nmId = parseInt(process.argv[2]) || 175088486;
const TARGET_REVIEWS = 300; // сколько отзывов с текстом собрать

// Шаг 1: Получаем imt_id через basket API
function getBasketUrl(nmId) {
  const vol = Math.floor(nmId / 100000);
  const part = Math.floor(nmId / 1000);
  let basket;
  if      (vol <= 143)  basket = '01';
  else if (vol <= 287)  basket = '02';
  else if (vol <= 431)  basket = '03';
  else if (vol <= 719)  basket = '04';
  else if (vol <= 1007) basket = '05';
  else if (vol <= 1061) basket = '06';
  else if (vol <= 1115) basket = '07';
  else if (vol <= 1169) basket = '08';
  else if (vol <= 1313) basket = '09';
  else if (vol <= 1601) basket = '10';
  else if (vol <= 1655) basket = '11';
  else if (vol <= 1919) basket = '12';
  else if (vol <= 2045) basket = '13';
  else if (vol <= 2189) basket = '14';
  else if (vol <= 2405) basket = '15';
  else if (vol <= 2621) basket = '16';
  else if (vol <= 2837) basket = '17';
  else if (vol <= 3053) basket = '18';
  else if (vol <= 3269) basket = '19';
  else if (vol <= 3485) basket = '20';
  else basket = '21';
  return `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${nmId}/info/ru/card.json`;
}

async function getImtId(nmId) {
  const url = getBasketUrl(nmId);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.wildberries.ru/' } });
  if (!res.ok) throw new Error(`Не удалось получить карточку товара: ${res.status}`);
  const data = await res.json();
  return { imtId: data.imt_id, name: data.imt_name, brand: data.subj_root_name };
}

// Шаг 2: Собираем отзывы (несколько страниц)
async function fetchReviews(imtId) {
  const orders = ['dateDesc', 'dateAsc', 'rankAsc'];
  const allReviews = new Map(); // дедупликация по id

  for (const order of orders) {
    if (allReviews.size >= TARGET_REVIEWS) break;

    const url = `https://feedbacks2.wb.ru/feedbacks/v2/${imtId}?order=${order}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': `https://www.wildberries.ru/`
        }
      });
      const data = await res.json();
      const feedbacks = data.feedbacks || [];

      feedbacks.forEach(f => {
        const text = [f.text, f.pros, f.cons].filter(Boolean).join(' ').trim();
        if (text.length > 10) allReviews.set(f.id, {
          text: f.text || '',
          pros: f.pros || '',
          cons: f.cons || '',
          rating: f.productValuation,
          date: f.createdDate?.slice(0,10)
        });
      });

      console.log(`  [${order}] получено: ${feedbacks.length}, с текстом: ${allReviews.size}`);
      await new Promise(r => setTimeout(r, 1000));
    } catch(e) {
      console.log(`  Ошибка [${order}]:`, e.message);
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
      model: 'claude-haiku-4-5',
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
  console.log(`Артикул: ${nmId}\n`);

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
  const filename = `reviews_${nmId}.txt`;
  const lines = reviews.slice(0, 300).map((r, i) => {
    const parts = [r.text, r.pros ? 'Плюсы: '+r.pros : '', r.cons ? 'Минусы: '+r.cons : ''].filter(Boolean).join(' | ');
    return `${i+1}. [${r.rating}★] ${parts}`;
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

    const resultFile = `result_${nmId}.md`;
    const content = `# Анализ ЦА: ${name}\n\nАртикул WB: ${nmId} | imt_id: ${imtId}\nОтзывов: ${Math.min(reviews.length, 150)}\nДата: ${new Date().toLocaleDateString('ru-RU')}\n\n${analysis}`;
    fs.writeFileSync(resultFile, content, 'utf8');
    console.log(`💾 Анализ сохранён: ${resultFile}`);
  }
}

main().catch(e => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
