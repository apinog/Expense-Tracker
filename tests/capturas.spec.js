// Capturas de cada pestaña y de las hojas de formulario, a 390x844.
// Quedan en tests/capturas/ (no se suben al repo).
var { test, expect } = require('@playwright/test');
var path = require('path');

var DIR = path.join(__dirname, 'capturas');
var PESTANAS = [['home', 'inicio'], ['exp', 'gastos'], ['cards', 'tarjetas'], ['meta', 'metas'], ['save', 'ahorro'], ['set', 'ajustes']];
var HOJAS = [
  ['home', '#fab', 'hoja-gasto'],
  ['home', '#top [data-act="fx"]', 'hoja-tipo-cambio'],
  ['cards', '[data-act="edit-card"]', 'hoja-tarjeta'],
  ['cards', '[data-act="add-redeem"]', 'hoja-canje'],
  ['meta', '[data-act="add-cat"]', 'hoja-categoria'],
  ['meta', '[data-act="add-recur"]', 'hoja-fijo'],
  ['save', '#fab', 'hoja-aporte'],
  ['save', '[data-act="add-goal"]', 'hoja-meta'],
  ['set', '[data-act="bal-sheet"]', 'hoja-saldos'],
  ['set', '[data-act="add-merch"]', 'hoja-comercio']
];

test.beforeEach(async function ({ page }) {
  // sin red externa: tipo de cambio y favicons no cambian las capturas
  await page.route(/hacienda|er-api|exchangerate-api|google\.com\/s2\/favicons/, function (r) { return r.abort(); });
  await page.goto('index.html');
  await page.evaluate(function () { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(function () { return window.__app; });
  // un par de gastos de ejemplo para que las pantallas no estén vacías (montos inventados)
  await page.evaluate(function () {
    var S = window.__app.S, d = new Date(), m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    S.ui.month = m;
    S.expenses.push(
      { id: 'p1', ts: 1, date: m + '-02', amt: 15000, cur: 'CRC', rate: S.fx.rate, cat: 'super', card: 'amexeco', merchant: 'Automercado', note: '', intl: false },
      { id: 'p2', ts: 2, date: m + '-03', amt: 30, cur: 'USD', rate: S.fx.rate, cat: 'online', card: 'amexblue', merchant: 'Amazon', note: '', intl: true },
      { id: 'p3', ts: 3, date: m + '-04', amt: 9000, cur: 'CRC', rate: S.fx.rate, cat: 'comida', card: 'bct', merchant: '', note: '', intl: false }
    );
    window.__app.render();
  });
});

for (var i = 0; i < PESTANAS.length; i++) (function (p) {
  test('pestaña ' + p[1], async function ({ page }) {
    await page.click('[data-act="tab"][data-v="' + p[0] + '"]');
    var texto = await page.locator('#vin').innerText();
    expect(texto).not.toMatch(/\bNaN\b|\bundefined\b/);
    // nada se sale de lo ancho de la pantalla
    var ancho = await page.evaluate(function () { return document.documentElement.scrollWidth; });
    expect(ancho).toBeLessThanOrEqual(390);
    await page.screenshot({ path: path.join(DIR, p[1] + '.png') });
  });
})(PESTANAS[i]);

for (var j = 0; j < HOJAS.length; j++) (function (h) {
  test(h[2], async function ({ page }) {
    await page.click('[data-act="tab"][data-v="' + h[0] + '"]');
    if (h[0] === 'cards') await page.locator('details.cfold summary').first().click(); // las tarjetas vienen plegadas
    var b = page.locator(h[1]).first();
    test.skip(await b.count() === 0, 'No está el botón ' + h[1]);
    await b.click();
    await expect(page.locator('#sheet .sheet')).toBeVisible();
    // iOS hace zoom si un campo tiene letra de menos de 16px
    var chicos = await page.evaluate(function () {
      return Array.prototype.filter.call(document.querySelectorAll('#sheet input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), #sheet select, #sheet textarea'),
        function (el) { return parseFloat(getComputedStyle(el).fontSize) < 16; }).map(function (el) { return el.id || el.name || el.tagName; });
    });
    expect(chicos, 'Campos con letra menor a 16px').toEqual([]);
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(DIR, h[2] + '.png') });
  });
})(HOJAS[j]);
