// WB Мониторинг новых отзывов за период
// Использование: node wb_monitor.mjs <артикул> <дней>
// Пример: node wb_monitor.mjs 175088486 30
// Покажет только отзывы за последние 30 дней

const nmId = parseInt(process.argv[2]) || 175088486;
const DAYS = parseInt(process.argv[3]) || 30;
const DATE_FROM = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);

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
      if (data.imt_id) return { imtId: data.imt_id, name: data.imt_name };
    } catch {}
  }
  throw new Error(`Не удалось найти карточку товара`);
}

async function fetchRecentReviews(imtId) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.wildberries.ru/'
  };

  const allReviews = new Map();
  let skip = 0;
  let hasMore = true;
  let reachedOld = false;

  while (hasMore && !reachedOld) {
    const url = `https://feedbacks2.wb.ru/feedbacks/v2/${imtId}?order=dateDesc&skip=${skip}&take=5000`;
    try {
      const res = await fetch(url, { headers });
      const data = await res.json();
      const feedbacks = data.feedbacks || [];

      if (feedbacks.length === 0) { hasMore = false; break; }

      for (const f of feedbacks) {
        const date = new Date(f.createdDate);
        // Дошли до старых — дальше не идём
        if (date < DATE_FROM) { reachedOld = true; break; }

        const text = [f.text, f.pros, f.cons].filter(Boolean).join(' ').trim();
        if (text.length > 10) {
          allReviews.set(f.id, {
            text: f.text || '',
            pros: f.pros || '',
            cons: f.cons || '',
            rating: f.productValuation,
            date: f.createdDate?.slice(0, 10)
          });
        }
      }

      console.log(`  skip=${skip} получено: ${feedbacks.length}, за период: ${allReviews.size}`);
      skip += feedbacks.length;
      await new Promise(r => setTimeout(r, 800));
    } catch(e) {
      console.log(`  Ошибка skip=${skip}:`, e.message);
      hasMore = false;
    }
  }

  return Array.from(allReviews.values());
}

function summarize(reviews) {
  const ratings = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => { if (ratings[r.rating] !== undefined) ratings[r.rating]++; });

  const avgRating = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1);

  console.log('\n📊 СВОДКА ЗА ПЕРИОД:');
  console.log(`   Всего отзывов с текстом: ${reviews.length}`);
  console.log(`   Средний рейтинг: ${avgRating}★`);
  console.log(`   Распределение: 5★×${ratings[5]}  4★×${ratings[4]}  3★×${ratings[3]}  2★×${ratings[2]}  1★×${ratings[1]}`);

  const negative = reviews.filter(r => r.rating <= 2);
  if (negative.length) {
    console.log(`\n❗ НЕГАТИВНЫЕ ОТЗЫВЫ (${negative.length} шт):`);
    console.log('─'.repeat(60));
    negative.forEach((r, i) => {
      const text = [r.text, r.pros, r.cons].filter(Boolean).join(' | ').slice(0, 200);
      console.log(`${i+1}. [${r.rating}★] ${r.date} — ${text}`);
    });
  }

  const positive = reviews.filter(r => r.rating === 5).slice(0, 5);
  if (positive.length) {
    console.log(`\n✅ ПРИМЕРЫ ПОЗИТИВНЫХ (топ-5):`);
    console.log('─'.repeat(60));
    positive.forEach((r, i) => {
      const text = [r.text, r.pros].filter(Boolean).join(' | ').slice(0, 150);
      console.log(`${i+1}. [${r.rating}★] ${r.date} — ${text}`);
    });
  }
}

async function main() {
  const dateStr = DATE_FROM.toLocaleDateString('ru-RU');
  console.log(`\n📦 WB Мониторинг отзывов`);
  console.log(`Артикул: ${nmId} | Период: последние ${DAYS} дней (с ${dateStr})\n`);

  console.log('🔍 Получаю информацию о товаре...');
  const { imtId, name } = await getImtId(nmId);
  console.log(`✅ Товар: ${name}\n`);

  console.log('📥 Собираю новые отзывы...');
  const reviews = await fetchRecentReviews(imtId);

  if (!reviews.length) {
    console.log(`\n✅ За последние ${DAYS} дней новых отзывов с текстом нет`);
    return;
  }

  summarize(reviews);

  // Сохраняем в файл
  const fs = await import('fs');
  const filename = `monitor_${nmId}_${DAYS}d.txt`;
  const lines = reviews.map((r, i) => {
    const parts = [r.text, r.pros ? 'Плюсы: '+r.pros : '', r.cons ? 'Минусы: '+r.cons : ''].filter(Boolean).join(' | ');
    return `${i+1}. [${r.rating}★] ${r.date} — ${parts}`;
  });
  fs.writeFileSync(filename, lines.join('\n'), 'utf8');
  console.log(`\n💾 Сохранено в файл: ${filename}`);
}

main().catch(e => {
  console.error('Ошибка:', e.message);
  process.exit(1);
});
