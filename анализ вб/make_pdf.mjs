// Конвертер HTML → PDF
// Использование: node make_pdf.mjs <файл.html>
// Пример: node make_pdf.mjs audit_ozon_176815681_antitsarapki.html
//
// PDF получит имя по названию товара и артикулу из HTML-заголовка

import puppeteer from 'puppeteer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

const htmlArg = process.argv[2];
if (!htmlArg) {
  console.error('❌ Укажи HTML-файл: node make_pdf.mjs audit_ozon_176815681_antitsarapki.html');
  process.exit(1);
}

const htmlPath = resolve(__dir, htmlArg);
if (!existsSync(htmlPath)) {
  console.error(`❌ Файл не найден: ${htmlPath}`);
  process.exit(1);
}

// Читаем title из HTML для имени файла
const html = readFileSync(htmlPath, 'utf8');
const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
const rawTitle = titleMatch ? titleMatch[1] : basename(htmlArg, '.html');

// Артикул — последнее число из имени файла
const articleMatch = basename(htmlArg).match(/(\d{6,})/);
const article = articleMatch ? articleMatch[1] : '';

// Чистим название: убираем "Аудит карточки — " и похожие префиксы
const cleanTitle = rawTitle
  .replace(/^(Аудит карточки\s*[—–-]\s*)/i, '')
  .replace(/[<>:"/\\|?*]/g, '')
  .trim()
  .replace(/\s+/g, '_');

const pdfName = article
  ? `Аудит_${cleanTitle}_арт${article}.pdf`
  : `Аудит_${cleanTitle}.pdf`;

const pdfPath = resolve(__dir, pdfName);

console.log(`\n📄 Конвертирую: ${basename(htmlArg)}`);
console.log(`   → ${pdfName}\n`);

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();

await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0', right: '0', bottom: '0', left: '0' },
});

await browser.close();

console.log(`✅ PDF готов: ${pdfName}`);
console.log(`   Путь: ${pdfPath}\n`);
