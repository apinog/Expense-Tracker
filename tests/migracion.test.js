// Prueba de migración: datos guardados con versiones viejas deben sobrevivir al abrir la app nueva.
// Todos los montos son inventados.
var test = require('node:test');
var assert = require('node:assert/strict');
var { cargarApp, problemas } = require('./ayuda');

function clone(o) { return JSON.parse(JSON.stringify(o)); }

// Arma datos como los dejaba la versión `v`, partiendo de los datos iniciales de hoy.
function datosViejos(v) {
  var t = cargarApp(); var d = clone(t.app.S); t.cerrar();
  d.v = v;
  d.settings.disp = 'USD';
  d.settings.income = 123456;
  d.fx = { rate: 512.34, ts: 1, manual: true, est: false };
  d.expenses = [
    { id: 'e1', ts: 1, date: '2026-10-03', amt: 10000, cur: 'CRC', rate: 510, cat: 'super', card: 'amexeco', merchant: 'Vindi', note: 'compra', intl: false },
    { id: 'e2', ts: 2, date: '2026-10-05', amt: 25, cur: 'USD', rate: 505, cat: 'online', card: 'amexblue', merchant: 'Amazon', note: '', intl: true },
    { id: 'e5', ts: 5, date: '2026-10-06', amt: 9000, cur: 'CRC', rate: 505, cat: 'comida', card: 'bct', merchant: 'Sushi de prueba', note: (v < 12 ? 'Uber Eats' : ''), intl: false, via: (v < 12 ? undefined : 'Uber Eats') },
    { id: 'e3', ts: 3, date: '2026-10-01', amt: 1000, cur: 'CRC', rate: 500, cat: 'gym', card: 'debcrc', merchant: 'Gimnasio', note: '', intl: false, recurId: 'r_gym' },
    { id: 'e4', ts: 4, date: '2026-10-01', amt: 2000, cur: 'CRC', rate: 500, cat: 'telefono', card: 'debcrc', merchant: 'Teléfono', note: '', intl: false, recurId: 'r_tel' }
  ];
  d.contribs = [{ id: 'k1', goal: d.goals[0].id, date: '2026-10-02', amt: 5000, note: '' }];
  d.budgets.over = { '2026-10': { super: { amt: 99999, cur: 'CRC' } } };

  if (v < 2) d.cards = d.cards.filter(function (c) { return c.id !== 'sinpe'; });
  if (v < 3) {
    d.recurring.push({ id: 'r_fee', name: 'Comisión', cat: 'comisiones', amt: 3, cur: 'USD', card: 'debcrc', day: 1, fixed: true, intl: false, active: true });
    d.recurring.forEach(function (r) { if (r.id === 'r_loan') { delete r.fee; r.cur = 'USD'; r.merchant = 'Préstamo del carro'; } });
    d.budgets.base.prestamo = { amt: 100, cur: 'USD' };
    d.budgets.base.comisiones = { amt: 3, cur: 'USD' };
  }
  if (v < 4) d.cards.forEach(function (c) { delete c.img; delete c.minRedeem; delete c.startBal; });
  if (v < 5) {
    delete d.merchants;
    d.recurring.forEach(function (r) { if (r.id === 'r_gym') { r.name = 'Gym'; r.merchant = 'Gimnasio'; } });
  }
  if (v < 6) d.recurring.forEach(function (r) { if (r.id === 'r_tel') r.merchant = 'Teléfono'; });
  if (v < 7) {
    if (d.merchants) d.merchants.forEach(function (m) { delete m.site; });
    d.goals = d.goals.filter(function (g) { return g.name !== 'Marchamo'; });
  }
  if (v < 8) {
    d.cats = d.cats.filter(function (c) { return c.id !== 'medicos'; });
    delete d.budgets.base.medicos;
    d.cards.forEach(function (c) { if (c.id === 'amexeco') delete c.rates.clinicas; });
  }
  if (v < 9 && d.merchants) {
    var conSitio = ['Vindi', 'Fresh Market', 'AMPM', 'Más x Menos', 'Farmacia Fischel', 'Farmacia Sabá', 'Farmacia La Bomba'];
    d.merchants.forEach(function (m) {
      if (conSitio.indexOf(m.name) >= 0) m.site = '';
      if (m.name === 'Automercado' && v >= 7) m.site = 'automercado.cr';
      if (m.name === 'Farmacia Roma') m.img = '';
      if (m.name === 'Amazon') m.site = 'amazon.es'; // puesto a mano: no se toca
    });
  }
  if (v < 10) {
    if (d.merchants) {
      d.merchants = d.merchants.filter(function (m) { return !/^(Hospital|Magna|Laboratorios)/.test(m.name); });
      d.merchants.forEach(function (m) { if (m.name === 'Automercado' || m.name === 'Farmacia Americana') m.img = ''; });
    }
    d.cards.forEach(function (c) { if (c.id === 'gana') { c.type = 'cashback'; c.rates = { otros: 0.5 }; c.placeholder = true; c.name = 'Gana Premios Gold'; c.img = ''; c.minRedeem = 0; c.capYear = null; delete c.nosug; } });
  }
  if (v < 11 && d.merchants) {
    var nuevos = ['Nova Cinemas', 'Maluco', 'Uber Eats', 'EGS Escazú', "Dick's Sporting Goods", 'Delta Air Lines', 'ChatGPT'];
    d.merchants = d.merchants.filter(function (m) { return nuevos.indexOf(m.name) < 0; });
  }
  if (v < 13 && d.merchants) d.merchants.forEach(function (m) { if (m.name === 'Subway' || m.name === 'Maluco') m.img = ''; });
  if (v < 14) d.recurring.forEach(function (r) { r.day = r.id === 'r_tel' ? 10 : 1; delete r.auto; });
  if (v < 2) delete d.redeems;
  return d;
}

for (var v = 1; v <= 16; v++) (function (v) {
  test('datos de la versión ' + v + ' se conservan al abrir la app', function () {
    var viejo = datosViejos(v);
    var t = cargarApp(viejo);
    var S = clone(t.app.S); // copia: los objetos de jsdom vienen de otra ventana
    assert.deepEqual(t.errores, []);
    assert.equal(S.v, 16, 'La versión debe quedar en 16');

    // lo del usuario sigue igual
    assert.equal(S.settings.disp, 'USD');
    assert.equal(S.settings.income, 123456);
    assert.equal(S.fx.rate, 512.34, 'El tipo de cambio fijado a mano no se toca');
    assert.equal(S.fx.manual, true);
    assert.equal(S.expenses.length, 5);
    var e5 = S.expenses.find(function (e) { return e.id === 'e5'; });
    assert.equal(e5.via, 'Uber Eats', 'La nota Uber Eats pasa a app de entrega');
    assert.equal(e5.note, '');
    ['e1', 'e2', 'e3', 'e4'].forEach(function (id, i) {
      var a = viejo.expenses[i], b = S.expenses.find(function (e) { return e.id === id; });
      assert.ok(b, 'Se perdió el gasto ' + id);
      ['date', 'amt', 'cur', 'rate', 'cat', 'card', 'note', 'intl'].forEach(function (k) {
        assert.equal(b[k], viejo.expenses.find(function (x) { return x.id === id; })[k], 'Cambió ' + k + ' del gasto ' + id);
      });
    });
    assert.deepEqual(S.contribs, viejo.contribs);
    assert.deepEqual(S.budgets.over, viejo.budgets.over);
    viejo.goals.forEach(function (g) { assert.ok(S.goals.some(function (x) { return x.id === g.id; }), 'Se perdió la meta ' + g.name); });

    // lo que agregan las migraciones
    assert.ok(S.cards.some(function (c) { return c.id === 'sinpe'; }), 'Falta SINPE Móvil');
    assert.ok(S.cats.some(function (c) { return c.id === 'medicos'; }), 'Falta Consultas médicas');
    assert.ok(Array.isArray(S.merchants) && S.merchants.length > 0, 'Faltan los comercios');
    assert.ok(Array.isArray(S.redeems), 'Falta la lista de canjes');
    assert.ok(S.goals.some(function (g) { return g.name === 'Marchamo'; }), 'Falta la meta Marchamo');
    var eco = S.cards.find(function (c) { return c.id === 'amexeco'; });
    assert.equal(eco.rates.clinicas, 4);
    S.cards.forEach(function (c) { if (c.type !== 'none') assert.equal(typeof c.minRedeem, 'number', c.id + ' sin mínimo de canje'); });

    if (v < 3) {
      assert.ok(!S.recurring.some(function (r) { return r.id === 'r_fee'; }), 'La comisión debe unirse al préstamo');
      assert.equal(S.recurring.find(function (r) { return r.id === 'r_loan'; }).fee, 3);
      assert.equal(S.budgets.base.prestamo.amt, 103);
      assert.equal(S.budgets.base.comisiones.amt, 0);
    }
    var merch = function (n) { return S.merchants.find(function (m) { return m.name === n; }); };
    assert.equal(merch('Vindi').site, 'vindi.cr');
    assert.equal(merch('Farmacia La Bomba').site, 'farmacialabomba.com');
    assert.equal(merch('Automercado').site, 'automercadoesmilugar.com');
    assert.equal(merch('Farmacia Roma').img, 'm:roma');
    assert.equal(merch('Automercado').img, 'm:automercado');
    assert.equal(merch('Uber Eats').cat, 'comida');
    assert.equal(merch("Dick's Sporting Goods").cat, 'online');
    assert.equal(merch('EGS Escazú').cat, 'gasolina');
    assert.equal(merch('Delta Air Lines').site, 'delta.com');
    assert.equal(merch('Viu').img, 'm:viu');
    var rec = function (id) { return S.recurring.find(function (r) { return r.id === id; }); };
    assert.equal(rec('r_claude').day, 27); assert.equal(rec('r_claude').auto, true);
    assert.equal(rec('r_yt').day, 23); assert.equal(rec('r_loan').day, 2); assert.equal(rec('r_gym').day, 15);
    if (v < 14) assert.equal(rec('r_tel').day, 10, 'Un día cambiado a mano no se toca');
    assert.equal(merch('Subway').img, 'm:subway');
    assert.equal(merch('Maluco').img, 'm:maluco');
    assert.equal(merch("Dick's Sporting Goods").img, 'm:dicks');
    assert.equal(merch('Farmacia Americana').img, 'm:americana');
    assert.equal(merch('Hospital Clínica Bíblica').cat, 'medicos');
    assert.equal(merch('Hospital Clínica Bíblica').img, 'm:biblica');
    var gana = S.cards.find(function (c) { return c.id === 'gana'; });
    assert.equal(gana.type, 'miles'); assert.equal(gana.rates.otros, 1); assert.ok(!gana.placeholder);
    assert.equal(gana.name, 'Gane Premios Gold'); assert.equal(gana.img, 'cards/gane-premios.jpg'); assert.equal(gana.minRedeem, 1000); assert.equal(gana.capYear, 25000); assert.equal(gana.nosug, true);
    if (v >= 5 && v < 9) assert.equal(merch('Amazon').site, 'amazon.es', 'Un sitio puesto a mano no se cambia');
    if (v < 5) assert.equal(S.expenses.find(function (e) { return e.id === 'e3'; }).merchant, 'Costa Rica Country Club');
    if (v < 6) assert.equal(S.expenses.find(function (e) { return e.id === 'e4'; }).merchant, 'Liberty Costa Rica');
    if (v === 16) assert.deepEqual(S.expenses, viejo.expenses, 'Con la versión actual no se toca nada');

    // la app se ve bien con los datos migrados
    ['home', 'exp', 'cards', 'meta', 'save', 'set'].forEach(function (p) {
      t.click('[data-act="tab"][data-v="' + p + '"]');
      var pr = problemas(t.doc.body);
      assert.deepEqual(pr, [], 'Valores rotos en ' + p + ':\n' + pr.join('\n'));
    });

    // y queda guardado
    t.app.render();
    t.click('[data-act="tab"][data-v="home"]');
    var g = t.guardado();
    assert.equal(g.v, 16);
    assert.equal(g.expenses.length, 5);
    t.cerrar();

    // abrir otra vez no cambia nada
    var t2 = cargarApp(g);
    assert.deepEqual(clone(t2.app.S.expenses), g.expenses);
    assert.equal(t2.app.S.cards.length, g.cards.length, 'Abrir dos veces no debe duplicar tarjetas');
    assert.equal(t2.app.S.merchants.length, g.merchants.length, 'Abrir dos veces no debe duplicar comercios');
    t2.cerrar();
  });
})(v);
