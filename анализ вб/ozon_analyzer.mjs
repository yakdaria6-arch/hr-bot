// Ozon Анализатор отзывов
// Использование: node ozon_analyzer.mjs <ссылка на товар Ozon>
// Пример: node ozon_analyzer.mjs https://www.ozon.ru/product/shampun-mixit-123456789/

import { writeFileSync } from "fs";

const input = process.argv[2];
const TARGET_REVIEWS = 200;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "ru-RU,ru;q=0.9",
  "Origin": "https://www.ozon.ru",
  "Referer": "https://www.ozon.ru/",
  "x-o3-app-name": "ozonapp_android",
  "x-o3-app-version": "6.47.0",
};

// Извлекаем slug из URL или используем как slug напрямую
function extractSlug(input) {
  if (!input) {
    console.error("❌ Укажи ссылку на товар Ozon");
    console.error("Пример: node ozon_analyzer.mjs https://www.ozon.ru/product/nazvanie-12345678/");
    process.exit(1);
  }
  // https://www.ozon.ru/product/nazvanie-tovara-123456789/
  const match = input.match(/ozon\.ru\/product\/([^/?#]+)/);
  if (match) return match[1];
  // Если передали просто slug
  return input.replace(/\/$/, "");
}

// Получаем отзывы через entrypoint-api (публичный, без авторизации)
async function fetchReviewsPage(slug, page = 1) {
  const url = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=/product/${slug}/reviews/?page=${page}&sort=date_desc`;

  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    return null;
  }
}

// Вытаскиваем отзывы из ответа
function parseReviews(data) {
  const reviews = [];

  // Ozon возвращает страницу как набор виджетов
  const widgets = data?.widgetStates || {};

  for (const [key, value] of Object.entries(widgets)) {
    if (!key.includes("webReview") && !key.includes("reviews")) continue;

    let parsed;
    try {
      parsed = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      continue;
    }

    // Собираем отзывы из виджета
    const items = parsed?.reviews || parsed?.items || [];
    for (const item of items) {
      const text = item?.content?.text || item?.text || "";
      const rating = item?.rating || item?.score || 0;
      const date = item?.date || item?.publishedAt || "";
      const pros = item?.content?.aspects?.find(a => a.type === "PROS")?.text || "";
      const cons = item?.content?.aspects?.find(a => a.type === "CONS")?.text || "";

      if (text.length > 10) {
        reviews.push({ text, rating, date, pros, cons });
      }
    }
  }

  return reviews;
}

// Получаем название товара из ответа
function parseProductName(data) {
  const widgets = data?.widgetStates || {};
  for (const [key, value] of Object.entries(widgets)) {
    if (!key.includes("webProductHeading") && !key.includes("header")) continue;
    try {
      const parsed = typeof value === "string" ? JSON.parse(value) : value;
      const name = parsed?.title || parsed?.name || parsed?.heading;
      if (name) return name;
    } catch { continue; }
  }
  return slug;
}

// Основная функция сбора отзывов
async function collectReviews(slug) {
  console.log(`\n📦 Загружаю товар: ${slug}\n`);

  const allReviews = [];
  let page = 1;
  let productName = slug;

  while (allReviews.length < TARGET_REVIEWS) {
    process.stdout.write(`  Страница ${page}... `);
    const data = await fetchReviewsPage(slug, page);

    if (!data) {
      console.log("❌ Ошибка запроса");
      break;
    }

    if (page === 1) {
      productName = parseProductName(data);
    }

    const reviews = parseReviews(data);

    if (reviews.length === 0) {
      console.log("стоп (отзывы закончились)");
      break;
    }

    allReviews.push(...reviews);
    console.log(`получено ${reviews.length} (всего: ${allReviews.length})`);

    page++;
    await new Promise(r => setTimeout(r, 800));
  }

  return { productName, reviews: allReviews };
}

// Анализ через Claude API
async function analyzeWithClaude(productName, reviews) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("\n⚠️  ANTHROPIC_API_KEY не найден — показываю сырые отзывы\n");
    return null;
  }

  const reviewsText = reviews
    .slice(0, 300)
    .map((r, i) =>
      `${i + 1}. [${r.rating}★] ${r.text}${r.pros ? " ✅ " + r.pros : ""}${r.cons ? " ❌ " + r.cons : ""}`
    )
    .join("\n");

  console.log("\n🤖 Анализирую отзывы...\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2500,
      messages: [
        {
          role: "user",
          content: `Ты опытный маркетолог. Проанализируй ${reviews.length} реальных отзывов покупателей с Ozon на товар "${productName}".

Сделай структурированный анализ:

1. КТО ПОКУПАЕТ — портрет ЦА (пол, возраст если упоминается, для себя/семьи/подарок, контекст покупки)
2. ТОП-5 ПРИЧИН ПОКУПКИ — что привлекает, за что хвалят чаще всего
3. ТОП-5 ПРОБЛЕМ — главные жалобы и разочарования
4. ТРИГГЕРЫ ПОВТОРНОЙ ПОКУПКИ — почему берут снова
5. ЯЗЫК КЛИЕНТА — дословные фразы которые повторяются, минимум 6 в кавычках
6. ИНСАЙТ ДЛЯ КАРТОЧКИ — что изменить в описании чтобы повысить конверсию
7. ИТОГО — одно предложение: кто этот покупатель и что ему важно

Отзывы:
${reviewsText}

Отвечай конкретно, без воды.`,
        },
      ],
    }),
  });

  const result = await res.json();
  return result?.content?.[0]?.text || null;
}

// Сохраняем отзывы в файл
function saveReviews(slug, reviews) {
  const filename = `reviews_ozon_${slug.split("-").pop()}.txt`;
  const content = reviews.map((r, i) =>
    `${i + 1}. [${r.rating}★] ${r.text}${r.pros ? "\n   ✅ " + r.pros : ""}${r.cons ? "\n   ❌ " + r.cons : ""}`
  ).join("\n\n");
  writeFileSync(filename, content, "utf8");
  console.log(`\n💾 Отзывы сохранены в ${filename}`);
  return filename;
}

// MAIN
const slug = extractSlug(input);
const { productName, reviews } = await collectReviews(slug);

if (reviews.length === 0) {
  console.log("\n❌ Отзывы не получены.");
  console.log("Возможные причины:");
  console.log("  1. Ozon изменил структуру API — нужно обновить парсер");
  console.log("  2. Товар не найден или нет отзывов");
  console.log("  3. Ozon заблокировал запрос — попробуй через минуту");
  process.exit(1);
}

console.log(`\n✅ Собрано отзывов: ${reviews.length}`);
console.log(`📦 Товар: ${productName}`);

// Показываем примеры
console.log("\n📝 Примеры отзывов:");
console.log("─".repeat(60));
reviews.slice(0, 3).forEach((r, i) => {
  console.log(`${i + 1}. [${r.rating}★] ${r.text.slice(0, 150)}${r.text.length > 150 ? "..." : ""}`);
});
console.log("─".repeat(60));

// Сохраняем отзывы
saveReviews(slug, reviews);

const analysis = await analyzeWithClaude(productName, reviews);

if (analysis) {
  console.log("\n" + "═".repeat(60));
  console.log(`АНАЛИЗ ОТЗЫВОВ — ${productName.toUpperCase()}`);
  console.log("═".repeat(60));
  console.log(analysis);
  console.log("═".repeat(60));

  const resultFile = `result_ozon_${slug.split("-").pop()}.md`;
  const content = `# Анализ ЦА: ${productName}\n\nOzon slug: ${slug}\nОтзывов: ${Math.min(reviews.length, 300)}\nДата: ${new Date().toLocaleDateString("ru-RU")}\n\n${analysis}`;
  writeFileSync(resultFile, content, "utf8");
  console.log(`💾 Анализ сохранён: ${resultFile}`);
} else {
  console.log("\nВсе отзывы:");
  reviews.forEach((r, i) => console.log(`\n${i + 1}. [${r.rating}★] ${r.text}`));
}
