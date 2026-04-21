// Автоматически скачивает фото карточки товара с Ozon или WB
// Использование: node grab_card.mjs <ссылка>
// Пример Ozon: node grab_card.mjs https://www.ozon.ru/product/nazvanie-123456/
// Пример WB:   node grab_card.mjs https://www.wildberries.ru/catalog/123456/detail.aspx

import puppeteer from 'puppeteer';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2];

if (!url) {
  console.error('❌ Укажи ссылку на товар');
  process.exit(1);
}

const isOzon = url.includes('ozon.ru');
const isWB   = url.includes('wildberries.ru');

if (!isOzon && !isWB) {
  console.error('❌ Поддерживаются только Ozon и Wildberries');
  process.exit(1);
}

// Загружаем куки
function loadCookies() {
  const file = join(__dir, 'ozon_cookies.txt');
  if (existsSync(file)) return readFileSync(file, 'utf8').trim();
  return '';
}

// Извлекаем slug/артикул
function extractSlug(url) {
  const m = url.match(/ozon\.ru\/product\/([^/?#]+)/);
  return m ? m[1] : null;
}
function extractWBArticle(url) {
  const m = url.match(/catalog\/(\d+)/);
  return m ? m[1] : null;
}

// Скачиваем файл
async function downloadFile(url, dest, headers = {}) {
  const res = await fetch(url, { headers });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return true;
}

// ─── OZON (через Puppeteer с перехватом сетевых запросов) ───────────────────
async function grabOzon(slug) {
  const article = slug.match(/(\d{7,})/)?.[1] || slug.split('-').pop();
  const outDir  = join(__dir, `card_${article}`);
  if (!existsSync(outDir)) mkdirSync(outDir);

  console.log(`\n🖼  Ozon · арт. ${article}`);

  const rawCookies = loadCookies();

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1440,900',
    ],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  // Перехватываем все сетевые ответы с картинками
  const capturedImages = new Map(); // url → buffer
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.includes('ir.ozon.com') && !url.includes('cdn1.ozone')) return;
    if (!/\.(jpg|webp|jpeg)/i.test(url)) return;
    if (capturedImages.has(url)) return;
    try {
      const buf = await response.buffer();
      if (buf.length > 10000) capturedImages.set(url, buf); // игнорируем маленькие (иконки)
    } catch {}
  });

  try {
    // Ставим куки через первый переход на домен
    if (rawCookies) {
      await page.goto('https://www.ozon.ru/', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
      await page.evaluate((c) => { c.split(';').forEach(p => document.cookie = p.trim()); }, rawCookies);
    }

    console.log('🌐 Открываю карточку товара...');
    await page.goto(`https://www.ozon.ru/product/${slug}/`, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 2000));

    // Прокручиваем галерею — кликаем стрелку вперёд несколько раз
    for (let i = 0; i < 15; i++) {
      await page.evaluate(() => {
        const selectors = ['[class*="next"]','[class*="Next"]','[aria-label*="ледующ"]','[class*="arrow"]'];
        for (const sel of selectors) {
          const btn = document.querySelector(sel);
          if (btn) { btn.click(); return; }
        }
        // Если нет кнопки — прокручиваем галерею
        const gallery = document.querySelector('[class*="gallery"], [class*="Gallery"]');
        if (gallery) gallery.scrollBy(300, 0);
      });
      await new Promise(r => setTimeout(r, 500));
    }
    await new Promise(r => setTimeout(r, 1500));

    console.log(`🔍 Перехвачено картинок: ${capturedImages.size}`);
  } finally {
    await browser.close();
  }

  if (capturedImages.size === 0) {
    console.log('⚠️  Ozon заблокировал доступ. Сохрани первое фото вручную в папку card_' + article + '/slide_01.webp');
    return null;
  }

  // Сортируем по размеру (большие — это реальные слайды)
  const sorted = [...capturedImages.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 15);

  let saved = 0;
  for (let i = 0; i < sorted.length; i++) {
    const [url, buf] = sorted[i];
    const ext = url.includes('.webp') ? 'webp' : 'jpg';
    const filename = `slide_${String(i + 1).padStart(2, '0')}.${ext}`;
    writeFileSync(join(outDir, filename), buf);
    console.log(`  ✅ ${filename} (${Math.round(buf.length/1024)}KB)`);
    saved++;
  }

  console.log(`\n✅ Сохранено: ${saved} фото → папка card_${article}/`);
  const firstExt = sorted[0]?.[0].includes('.webp') ? 'webp' : 'jpg';
  return join(outDir, `slide_01.${firstExt}`);
}

// ─── WILDBERRIES ─────────────────────────────────────────────────────────────
async function grabWB(article) {
  const outDir = join(__dir, `card_${article}`);
  if (!existsSync(outDir)) mkdirSync(outDir);

  console.log(`\n🖼  Wildberries · арт. ${article}`);

  const art  = parseInt(article);
  const vol  = Math.floor(art / 100000);
  const part = Math.floor(art / 1000);

  // Определяем номер basket по диапазону vol
  const ranges = [
    [143,'01'],[287,'02'],[431,'03'],[719,'04'],[1007,'05'],
    [1061,'06'],[1115,'07'],[1169,'08'],[1313,'09'],[1601,'10'],
    [1655,'11'],[1919,'12'],[2045,'13'],[2189,'14'],[2405,'15'],
    [2621,'16'],[2837,'17'],[3053,'18'],[3269,'19'],[3485,'20'],
  ];
  const basket = (ranges.find(([max]) => vol <= max)?.[1]) || '21';

  console.log(`📐 basket-${basket}, vol${vol}, part${part}`);

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.wildberries.ru/',
  };

  let saved = 0;
  for (let i = 1; i <= 15; i++) {
    const imgUrl = `https://basket-${basket}.wbbasket.ru/vol${vol}/part${part}/${article}/images/big/${i}.webp`;
    const filename = `slide_${String(i).padStart(2, '0')}.webp`;
    const ok = await downloadFile(imgUrl, join(outDir, filename), headers);
    if (ok) { console.log(`  ✅ ${filename}`); saved++; }
    else break; // дошли до конца галереи
  }

  console.log(`\n✅ Сохранено: ${saved} фото → папка card_${article}/`);
  return saved > 0 ? join(outDir, 'slide_01.webp') : null;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
let firstPhoto = null;

if (isOzon) {
  const slug = extractSlug(url);
  if (!slug) { console.error('❌ Не удалось извлечь slug из URL'); process.exit(1); }
  firstPhoto = await grabOzon(slug);
}

if (isWB) {
  const article = extractWBArticle(url);
  if (!article) { console.error('❌ Не удалось найти артикул в URL'); process.exit(1); }
  firstPhoto = await grabWB(article);
}

if (firstPhoto) {
  console.log(`\n🖼  Первое фото для отчёта: ${firstPhoto}`);
}
