// Ozon Анализатор отзывов
// Использование: node ozon_analyzer.mjs <ссылка> [--limit=1000] [--period=7d]
// Периоды: --period=1d  --period=7d  --period=30d
// Пример: node ozon_analyzer.mjs https://www.ozon.ru/product/nazvanie-123456/ --period=30d

import { writeFileSync, readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const input = process.argv[2];
const args = process.argv.slice(3);

// Парсим аргументы --limit и --period
const limitArg = args.find(a => a.startsWith("--limit="));
const periodArg = args.find(a => a.startsWith("--period="));

const TARGET_REVIEWS = limitArg ? parseInt(limitArg.split("=")[1]) : Infinity;

// Вычисляем минимальную дату из --period
function parsePeriod(arg) {
  if (!arg) return null;
  const val = arg.split("=")[1];
  const now = Date.now();
  if (val === "1d")  return new Date(now - 1  * 24 * 60 * 60 * 1000);
  if (val === "7d")  return new Date(now - 7  * 24 * 60 * 60 * 1000);
  if (val === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return null;
}
const periodFrom = parsePeriod(periodArg);

if (periodFrom) {
  console.log(`📅 Фильтр по периоду: с ${periodFrom.toLocaleDateString("ru-RU")}`);
}

// Читаем куки из файла ozon_cookies.txt если есть
function loadCookies() {
  const file = join(dirname(fileURLToPath(import.meta.url)), "ozon_cookies.txt");
  if (existsSync(file)) {
    const cookies = readFileSync(file, "utf8").trim();
    if (cookies) {
      console.log("🍪 Куки загружены из ozon_cookies.txt");
      return cookies;
    }
  }
  console.log("⚠️  Файл ozon_cookies.txt не найден — запросы могут быть заблокированы");
  console.log("   Инструкция: откройте ozon.ru в браузере → F12 → Network → любой запрос → скопируйте Cookie: ...");
  return "";
}

const COOKIES = loadCookies();

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Accept-Language": "ru-RU,ru;q=0.9",
  "Referer": "https://www.ozon.ru/",
  ...(COOKIES && { "Cookie": COOKIES }),
};

// Извлекаем slug из URL или используем как slug напрямую
function extractSlug(input) {
  if (!input) {
    console.error("❌ Укажи ссылку на товар Ozon");
    console.error("Пример: node ozon_analyzer.mjs https://www.ozon.ru/product/nazvanie-12345678/");
    process.exit(1);
  }
  const match = input.match(/ozon\.ru\/product\/([^/?#]+)/);
  if (match) return match[1];
  return input.replace(/\/$/, "");
}

// Выполняет запрос следуя __rr редиректам Ozon
async function ozonFetch(url) {
  let headers = { ...HEADERS };
  try {
    for (let i = 0; i < 5; i++) {
      const res = await fetch(url, { headers, redirect: "manual" });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) {
        const m = setCookie.match(/^([^=]+)=([^;]+)/);
        if (m) headers.Cookie = (headers.Cookie || "") + `; ${m[1]}=${m[2]}`;
      }
      if (res.status === 200) return await res.json();
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`HTTP ${res.status}`);
      url = loc;
      await new Promise(r => setTimeout(r, 300));
    }
    throw new Error("Слишком много редиректов");
  } catch (e) {
    return null;
  }
}

// Получаем страницу отзывов
async function fetchReviewsPage(slug, nextParams = null, pageNum = 1) {
  let pageQuery;
  if (nextParams && typeof nextParams === "string" && nextParams.startsWith("?")) {
    pageQuery = `/product/${slug}/reviews/${nextParams}`;
  } else if (nextParams && typeof nextParams === "string") {
    pageQuery = `/product/${slug}/reviews/?${nextParams}`;
  } else {
    pageQuery = `/product/${slug}/reviews/?page=${pageNum}&sort=date_desc`;
  }
  const url = `https://www.ozon.ru/api/entrypoint-api.bx/page/json/v2?url=${encodeURIComponent(pageQuery)}`;
  return ozonFetch(url);
}

// Вытаскиваем отзывы из ответа
function parseReviews(data) {
  const reviews = [];
  const widgets = data?.widgetStates || {};

  for (const [key, value] of Object.entries(widgets)) {
    if (!key.startsWith("webListReviews")) continue;

    let parsed;
    try {
      parsed = typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      continue;
    }

    for (const item of (parsed?.reviews || [])) {
      const text = item?.content?.comment || "";
      const rating = item?.content?.score || 0;
      const publishedAt = item?.publishedAt ? new Date(item.publishedAt * 1000) : null;
      const date = publishedAt ? publishedAt.toISOString().slice(0, 10) : "";
      const pros = item?.content?.positive || "";
      const cons = item?.content?.negative || "";

      if (text.length > 5) {
        reviews.push({ text, rating, date, pros, cons, publishedAt });
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

// Вытаскиваем nextButton из paging виджета
function parseNextButton(data) {
  const widgets = data?.widgetStates || {};
  const reviewKey = Object.keys(widgets).find(k => k.startsWith("webListReviews"));
  if (!reviewKey) return null;
  try {
    const widget = typeof widgets[reviewKey] === "string" ? JSON.parse(widgets[reviewKey]) : widgets[reviewKey];
    const btn = widget?.paging?.nextButton;
    if (!btn) return null;
    // nextButton может быть строкой-URL или объектом {url, action}
    if (typeof btn === "string") return btn;
    if (btn?.url) return btn.url;
    if (btn?.action?.link) return btn.action.link;
    return null;
  } catch { return null; }
}

// Основная функция сбора отзывов
async function collectReviews(slug) {
  console.log(`\n📦 Загружаю товар: ${slug}\n`);

  const allReviews = [];
  let pageNum = 1;
  let nextParams = null;
  let productName = slug;
  let emptyStreak = 0; // сколько пустых страниц подряд

  while (allReviews.length < TARGET_REVIEWS) {
    process.stdout.write(`  Страница ${pageNum}... `);
    const data = await fetchReviewsPage(slug, nextParams, pageNum);

    if (!data) {
      console.log("❌ Ошибка запроса");
      emptyStreak++;
      if (emptyStreak >= 3) { console.log("  → 3 ошибки подряд, останавливаемся"); break; }
      pageNum++;
      await new Promise(r => setTimeout(r, 1500));
      continue;
    }

    if (pageNum === 1) {
      productName = parseProductName(data);
    }

    const reviews = parseReviews(data);

    if (reviews.length === 0) {
      emptyStreak++;
      console.log(`пусто (${emptyStreak}/3)`);
      if (emptyStreak >= 3) {
        console.log("  → стоп (отзывы закончились)");
        break;
      }
      pageNum++;
      await new Promise(r => setTimeout(r, 1000));
      continue;
    }

    emptyStreak = 0;

    // Фильтр по периоду — отзывы отсортированы по убыванию даты
    if (periodFrom) {
      const filtered = reviews.filter(r => r.publishedAt && r.publishedAt >= periodFrom);
      const oldestOnPage = reviews[reviews.length - 1]?.publishedAt;

      allReviews.push(...filtered);
      console.log(`получено ${filtered.length} за период (всего: ${allReviews.length})`);

      if (oldestOnPage && oldestOnPage < periodFrom) {
        console.log("  → достигли границы периода, останавливаемся");
        break;
      }
    } else {
      allReviews.push(...reviews);
      console.log(`получено ${reviews.length} (всего: ${allReviews.length})`);
    }

    nextParams = parseNextButton(data);
    // Если nextButton не найден — пробуем ручную пагинацию
    if (!nextParams) {
      process.stdout.write(`  [нет nextButton, пробуем страницу ${pageNum + 1}] `);
    }

    pageNum++;
    await new Promise(r => setTimeout(r, 800));
  }

  // Убираем технический timestamp перед возвратом
  return {
    productName,
    reviews: allReviews.map(({ publishedAt, ...r }) => r),
  };
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
function saveReviews(slug, reviews, period) {
  const suffix = period ? `_${period.split("=")[1]}` : "";
  const filename = `reviews_ozon_${slug.split("-").pop()}${suffix}.txt`;
  const content = reviews.map((r, i) =>
    `${i + 1}. [${r.rating}★] [${r.date}] ${r.text}${r.pros ? "\n   ✅ " + r.pros : ""}${r.cons ? "\n   ❌ " + r.cons : ""}`
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
  if (periodFrom) console.log("  4. За указанный период отзывов нет");
  process.exit(1);
}

console.log(`\n✅ Собрано отзывов: ${reviews.length}`);
console.log(`📦 Товар: ${productName}`);
if (periodArg) console.log(`📅 Период: ${periodArg.split("=")[1]}`);

// Показываем примеры
console.log("\n📝 Примеры отзывов:");
console.log("─".repeat(60));
reviews.slice(0, 3).forEach((r, i) => {
  console.log(`${i + 1}. [${r.rating}★] [${r.date}] ${r.text.slice(0, 150)}${r.text.length > 150 ? "..." : ""}`);
});
console.log("─".repeat(60));

// Сохраняем отзывы
saveReviews(slug, reviews, periodArg);

const analysis = await analyzeWithClaude(productName, reviews);

if (analysis) {
  console.log("\n" + "═".repeat(60));
  console.log(`АНАЛИЗ ОТЗЫВОВ — ${productName.toUpperCase()}`);
  console.log("═".repeat(60));
  console.log(analysis);
  console.log("═".repeat(60));

  const suffix = periodArg ? `_${periodArg.split("=")[1]}` : "";
  const resultFile = `result_ozon_${slug.split("-").pop()}${suffix}.md`;
  const content = `# Анализ ЦА: ${productName}\n\nOzon slug: ${slug}\nОтзывов: ${Math.min(reviews.length, 300)}\nПериод: ${periodArg || "все время"}\nДата: ${new Date().toLocaleDateString("ru-RU")}\n\n${analysis}`;
  writeFileSync(resultFile, content, "utf8");
  console.log(`💾 Анализ сохранён: ${resultFile}`);
} else {
  console.log("\nВсе отзывы:");
  reviews.forEach((r, i) => console.log(`\n${i + 1}. [${r.rating}★] [${r.date}] ${r.text}`));
}
