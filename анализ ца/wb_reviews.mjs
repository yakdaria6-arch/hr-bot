// Сбор отзывов конкурентов на WB по запросу "шампунь mixit"

const query = "шампунь mixit";
const MAX_PRODUCTS = 5;
const MAX_REVIEWS_PER_PRODUCT = 30;

// Шаг 1: Поиск товаров
async function searchProducts(query) {
  const url = `https://search.wb.ru/exactmatch/ru/common/v9/search?appType=1&curr=rub&dest=-1257786&lang=ru&page=1&query=${encodeURIComponent(query)}&resultset=catalog&sort=popular&spp=30`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json"
    }
  });

  const data = await res.json();
  const products = data?.data?.products || [];

  return products.slice(0, MAX_PRODUCTS).map(p => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.priceU ? Math.round(p.priceU / 100) : 0,
    rating: p.rating,
    feedbacks: p.feedbacks
  }));
}

// Шаг 2: Получение отзывов по артикулу
async function getReviews(productId) {
  // WB хранит отзывы на разных бакетах в зависимости от артикула
  const vol = Math.floor(productId / 100000);
  const part = Math.floor(productId / 1000);

  const urls = [
    `https://feedbacks2.wb.ru/feedbacks/v2/${productId}`,
    `https://feedbacks1.wb.ru/feedbacks/v2/${productId}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json",
          "Origin": "https://www.wildberries.ru",
          "Referer": "https://www.wildberries.ru/"
        }
      });

      if (!res.ok) continue;
      const data = await res.json();
      const feedbacks = data?.feedbacks || [];

      return feedbacks.slice(0, MAX_REVIEWS_PER_PRODUCT).map(f => ({
        text: f.text || "",
        pros: f.pros || "",
        cons: f.cons || "",
        rating: f.productValuation || 0,
        date: f.createdDate || ""
      })).filter(f => f.text.length > 10);

    } catch (e) {
      continue;
    }
  }
  return [];
}

// Шаг 3: AI-анализ через Anthropic API
async function analyzeWithClaude(productName, reviews) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log("⚠️  ANTHROPIC_API_KEY не найден — показываю сырые отзывы");
    return null;
  }

  const reviewsText = reviews.map((r, i) =>
    `${i+1}. [${r.rating}★] ${r.text}${r.pros ? " Плюсы: "+r.pros : ""}${r.cons ? " Минусы: "+r.cons : ""}`
  ).join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: `Ты маркетолог. Проанализируй ${reviews.length} отзывов на товар "${productName}" и выдай:

1. КТО ПОКУПАЕТ (портрет: пол, возраст, контекст — для себя/подарок/семья)
2. ТОП-5 ПРИЧИН ПОКУПКИ (что нравится, за что хвалят)
3. ТОП-5 ПРОБЛЕМ (жалобы, разочарования)
4. ЯЗЫК КЛИЕНТА (дословные фразы которые повторяются)
5. ВЫВОД (одно предложение: кто этот покупатель и что ему важно)

Отзывы:
${reviewsText}

Отвечай структурированно, конкретно, без воды.`
      }]
    })
  });

  const data = await res.json();
  return data?.content?.[0]?.text || null;
}

// MAIN
async function main() {
  console.log(`\n🔍 Ищу товары по запросу: "${query}"...\n`);

  const products = await searchProducts(query);

  if (!products.length) {
    console.log("❌ Товары не найдены");
    return;
  }

  console.log(`✅ Найдено товаров: ${products.length}\n`);
  products.forEach((p, i) => {
    console.log(`${i+1}. ${p.brand} — ${p.name}`);
    console.log(`   Артикул: ${p.id} | Цена: ${p.price}₽ | Рейтинг: ${p.rating}⭐ | Отзывов: ${p.feedbacks}`);
  });

  console.log("\n📥 Собираю отзывы...\n");

  const allReviews = [];

  for (const product of products) {
    console.log(`→ ${product.brand} — ${product.name} (арт. ${product.id})`);
    const reviews = await getReviews(product.id);
    console.log(`  Получено отзывов: ${reviews.length}`);
    allReviews.push(...reviews);
    await new Promise(r => setTimeout(r, 1000)); // пауза между запросами
  }

  console.log(`\n📊 Всего отзывов собрано: ${allReviews.length}\n`);

  if (!allReviews.length) {
    console.log("❌ Отзывы не получены. Возможно WB изменил API.");
    return;
  }

  // Показать первые 5 отзывов
  console.log("📝 Примеры отзывов:");
  console.log("─".repeat(60));
  allReviews.slice(0, 5).forEach((r, i) => {
    console.log(`${i+1}. [${r.rating}★] ${r.text.slice(0, 150)}${r.text.length > 150 ? "..." : ""}`);
  });
  console.log("─".repeat(60));

  // AI анализ
  console.log("\n🤖 Запускаю AI-анализ...\n");
  const analysis = await analyzeWithClaude(`шампунь Mixit`, allReviews);

  if (analysis) {
    console.log("═".repeat(60));
    console.log("АНАЛИЗ ЦЕЛЕВОЙ АУДИТОРИИ — ШАМПУНЬ MIXIT (WB)");
    console.log("═".repeat(60));
    console.log(analysis);
    console.log("═".repeat(60));
  } else {
    // Показать все отзывы без анализа
    console.log("\nВсе собранные отзывы:");
    allReviews.forEach((r, i) => {
      console.log(`\n${i+1}. [${r.rating}★] ${r.text}`);
    });
  }
}

main().catch(console.error);
