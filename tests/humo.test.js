// Prueba rápida: abre la app, recorre todo y registra gastos como lo haría una persona.
var test = require('node:test');
var assert = require('node:assert/strict');
var { cargarApp, problemas } = require('./ayuda');

var PESTANAS = ['home', 'exp', 'cards', 'meta', 'save', 'set'];

function sinProblemas(t, donde) {
  var p = problemas(t.doc.body);
  assert.deepEqual(p, [], 'Aparecen valores rotos en ' + donde + ':\n' + p.join('\n'));
}

function mesesAtras(n) {
  var d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-15';
}

// Llena el formulario de gasto y toca Guardar.
function registrarGasto(t, g) {
  t.click('#fab');
  assert.ok(t.$('#xf'), 'No se abrió el formulario de gasto');
  if (g.cur) t.click('#xf button[data-act="cur"][data-v="' + g.cur + '"]');
  if (g.cat) t.escribir('#f_cat', g.cat);
  t.escribir('#f_amt', g.amt);
  if (g.merchant) t.escribir('#f_merchant', g.merchant);
  if (g.card) t.click('#f_cpick button[data-id="' + g.card + '"]');
  if (g.date) t.escribir('#f_date', g.date);
  if (g.intl) { t.$('#f_intl').checked = true; t.escribir('#f_intl', 'on'); }
  if (g.goal) t.escribir('#f_goal', g.goal);
  if (g.reimb) {
    t.$('#f_reimb').checked = true; t.escribir('#f_reimb', 'on');
    t.escribir('#f_rexp', g.reimb.exp);
    if (g.reimb.got != null) t.escribir('#f_rgot', g.reimb.got);
  }
  sinProblemas(t, 'el formulario de gasto');
  t.click('#sheet button[data-act="save-exp"]');
  assert.equal(t.$('#xf'), null, 'El formulario no se cerró al guardar');
}

test('arranca sin datos y sin errores', function () {
  var t = cargarApp();
  assert.deepEqual(t.errores, []);
  assert.equal(t.app.S.v, 11);
  assert.ok(t.$('#vin').innerHTML.length > 0, 'La pantalla de inicio quedó vacía');
  sinProblemas(t, 'Inicio');
  t.cerrar();
});

test('recorre todas las pestañas en colones y en dólares', function () {
  var t = cargarApp();
  ['CRC', 'USD'].forEach(function (mon) {
    t.click('#top button[data-act="disp"][data-v="' + mon + '"]');
    PESTANAS.forEach(function (p) {
      t.click('[data-act="tab"][data-v="' + p + '"]');
      assert.equal(t.app.S.ui.tab, p);
      sinProblemas(t, 'la pestaña ' + p + ' (' + mon + ')');
    });
  });
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('registra gastos en colones y dólares y los guarda bien', function () {
  var t = cargarApp();
  var fx = t.app.S.fx.rate;

  registrarGasto(t, { cat: 'super', amt: '12,500', merchant: 'Automercado', card: 'amexeco' });
  registrarGasto(t, { cat: 'online', cur: 'USD', amt: '40', merchant: 'Amazon', card: 'amexblue', intl: true });

  var ex = t.app.S.expenses;
  assert.equal(ex.length, 2);
  assert.equal(ex[0].amt, 12500, 'num() debe leer 12,500 como doce mil quinientos');
  assert.equal(ex[0].cur, 'CRC');
  assert.equal(ex[0].cat, 'super');
  assert.equal(ex[0].card, 'amexeco');
  assert.equal(ex[0].rate, fx, 'Cada gasto guarda el tipo de cambio del momento');
  assert.equal(ex[1].amt, 40);
  assert.equal(ex[1].cur, 'USD');
  assert.equal(ex[1].intl, true);

  var guardado = t.guardado();
  assert.equal(guardado.expenses.length, 2, 'Los gastos deben quedar en localStorage');

  // si el dólar cambia, el historial no se mueve
  t.app.S.fx.rate = fx * 2; t.app.render();
  assert.equal(t.app.S.expenses[1].rate, fx);

  ['CRC', 'USD'].forEach(function (mon) {
    t.click('#top button[data-act="disp"][data-v="' + mon + '"]');
    PESTANAS.forEach(function (p) {
      t.click('[data-act="tab"][data-v="' + p + '"]');
      sinProblemas(t, 'la pestaña ' + p + ' con gastos (' + mon + ')');
    });
  });
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('reembolsos, gastos con meta y fijos pendientes', function () {
  var t = cargarApp();
  var meta = t.app.S.goals[0].id;
  registrarGasto(t, { cat: 'medicos', amt: '30,000', reimb: { exp: '20,000' } });
  registrarGasto(t, { cat: 'viajes', cur: 'USD', amt: '150', goal: meta });

  var r = t.app.S.expenses[0];
  assert.deepEqual(JSON.parse(JSON.stringify(r.reimb)), { exp: 20000, got: null });
  assert.equal(t.app.S.expenses[1].goal, meta);

  // registrar un fijo desde la lista de pendientes de Inicio
  t.click('[data-act="tab"][data-v="home"]');
  var fijo = t.$('[data-act="pay-fixed"]');
  if (fijo) {
    t.click(fijo);
    assert.ok(t.$('#xf'), 'No se abrió el formulario del fijo');
    t.click('#sheet button[data-act="save-exp"]');
    assert.ok(t.app.S.expenses.some(function (e) { return e.recurId; }), 'El fijo no quedó registrado');
  }
  PESTANAS.forEach(function (p) {
    t.click('[data-act="tab"][data-v="' + p + '"]');
    sinProblemas(t, 'la pestaña ' + p + ' con reembolso y meta');
  });
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('explorador de gráficos: todas las combinaciones', function () {
  var t = cargarApp();
  // gastos repartidos en varios meses, monedas y tarjetas
  [
    { cat: 'super', amt: '25,000', card: 'amexeco', merchant: 'Automercado' },
    { cat: 'comida', amt: '8,500', card: 'bct' },
    { cat: 'online', cur: 'USD', amt: '35', card: 'amexblue', intl: true },
    { cat: 'gasolina', amt: '20,000', card: 'premia', date: mesesAtras(1) },
    { cat: 'salidas', cur: 'USD', amt: '60', card: 'debusd', date: mesesAtras(2) },
    { cat: 'super', amt: '18,000', card: 'sinpe', date: mesesAtras(4) }
  ].forEach(function (g) { registrarGasto(t, g); });
  t.click('[data-act="tab"][data-v="home"]');
  var hoy = new Date(), mes = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  t.app.S.ui.month = mes;

  var S = t.app.S, c = S.ui.chart, n = 0;
  var medidas = ['gasto', 'reward'];
  var periodos = ['month', '3m', '6m', 'year', 'all', 'custom'];
  var grupos = ['cat', 'card', 'merchant', 'day', 'week', 'month'];
  var filtros = [['all', 'all'], ['super', 'all'], ['all', 'amexeco'], ['viajes', 'all']];
  var esTiempo = function (g) { return ['day', 'week', 'month'].indexOf(g) >= 0; };

  [['month', 'CRC'], ['month', 'USD'], ['year', 'CRC']].forEach(function (vm) {
    var vista = vm[0], mon = vm[1];
    S.ui.home = vista; S.settings.disp = mon;
    {
      medidas.forEach(function (me) { periodos.forEach(function (pe) { grupos.forEach(function (gr) {
        var tipos = esTiempo(gr) ? ['col', 'line'] : ['bar', 'donut'];
        var acum = esTiempo(gr) ? [true, false] : [true];
        tipos.forEach(function (ti) { acum.forEach(function (cu) { filtros.forEach(function (fi) {
          c.measure = me; c.period = pe; c.group = gr; c.type = ti; c.cum = cu; c.cat = fi[0]; c.card = fi[1];
          if (pe === 'custom') { c.from = mesesAtras(5).slice(0, 7); c.to = mes; }
          t.app.render();
          var p = problemas(t.$('#vin'));
          assert.deepEqual(p, [], 'Gráfico roto con ' + JSON.stringify({ vista: vista, mon: mon, chart: c }) + ':\n' + p.join('\n'));
          n++;
        }); }); });
      }); }); });
    }
  });
  assert.ok(n > 1000, 'Se probaron ' + n + ' combinaciones');
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('las hojas de formulario abren sin valores rotos', function () {
  var t = cargarApp();
  registrarGasto(t, { cat: 'super', amt: '10,000', card: 'amexeco' });
  var hojas = [
    ['home', '#top [data-act="fx"]'],
    ['exp', '[data-act="edit-exp"]'],
    ['cards', '[data-act="edit-card"]'],
    ['cards', '[data-act="add-redeem"]'],
    ['meta', '[data-act="add-cat"]'],
    ['meta', '[data-act="edit-recur"]'],
    ['meta', '[data-act="add-recur"]'],
    ['save', '#fab'],
    ['save', '[data-act="add-goal"]'],
    ['save', '[data-act="edit-goal"]'],
    ['set', '[data-act="bal-sheet"]'],
    ['set', '[data-act="add-merch"]'],
    ['set', '[data-act="edit-merch"]']
  ];
  hojas.forEach(function (h) {
    t.click('[data-act="tab"][data-v="' + h[0] + '"]');
    var b = t.$(h[1]);
    if (!b) return; // ese botón puede no estar en esta versión
    t.click(b);
    assert.ok(t.$('#sheet .sheet'), 'No se abrió la hoja de ' + h[1]);
    sinProblemas(t, 'la hoja ' + h[1]);
    t.click('#sheet .overlay');
    assert.equal(t.$('#sheet .sheet'), null, 'La hoja no se cerró');
  });
  assert.deepEqual(t.errores, []);
  t.cerrar();
});
