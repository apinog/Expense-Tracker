// Prueba rápida: abre la app, recorre todo y registra gastos como lo haría una persona.
var test = require('node:test');
var assert = require('node:assert/strict');
var { cargarApp, problemas } = require('./ayuda');

var PESTANAS = ['home', 'exp', 'cards', 'meta', 'save', 'car', 'set'];

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
  if (g.via) t.click('#f_viabox button[data-v="' + g.via + '"]');
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
  assert.equal(t.app.S.v, 23);
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

  registrarGasto(t, { cat: 'comida', amt: '9,800', merchant: 'Sushi de prueba', via: 'Uber Eats', card: 'bct' });
  var ue = t.app.S.expenses[2];
  assert.equal(ue.via, 'Uber Eats', 'Debe guardar la app de entrega');
  assert.equal(ue.merchant, 'Sushi de prueba');
  registrarGasto(t, { cat: 'super', amt: '1,000', via: 'Uber Eats' });
  assert.equal(t.app.S.expenses[3].via, '', 'Fuera de Comida no se guarda app de entrega');
  t.click('[data-act="tab"][data-v="exp"]');
  assert.ok(t.$('.row img.via'), 'El pedido muestra el logo de Uber Eats');
  t.app.S.expenses.splice(2, 2);
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
  assert.equal(guardado.expenses.length, 4, 'Los gastos deben quedar en localStorage');

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

test('un fijo pagado antes cuenta para el mes que cubre', function () {
  var t = cargarApp();
  var S = t.app.S, d = new Date(), cur = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  var p = cur.split('-').map(Number), nd = new Date(p[0], p[1], 1), nm = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0');
  S.ui.month = cur; t.app.render();
  // registrar hoy la cuota del préstamo del mes siguiente
  t.app.act('pay-fixed', { dataset: { id: 'r_loan', per: nm } });
  assert.ok(t.$('#f_per'), 'Debe preguntar qué mes se está pagando');
  assert.equal(t.$('#f_per').value, nm);
  t.click('#sheet button[data-act="save-exp"]');
  var e = S.expenses.find(function (x) { return x.recurId === 'r_loan'; });
  assert.equal(e.per, nm, 'Guarda el mes que cubre');
  assert.equal(e.date.slice(0, 7), cur, 'La fecha sigue siendo la del pago');
  assert.ok(t.app.monthStats(nm).ex.some(function (x) { return x.id === e.id; }), 'Cuenta en el mes que cubre');
  assert.ok(!t.app.monthStats(cur).ex.some(function (x) { return x.id === e.id; }), 'No cuenta en el mes en que se pagó');
  // en el mes siguiente el préstamo aparece pagado
  S.ui.month = nm; S.ui.tab = 'home'; t.app.render();
  var rows = Array.prototype.map.call(t.doc.querySelectorAll('.fixrow'), function (r) { return r.textContent; });
  assert.ok(rows.some(function (x) { return /Car loan/.test(x) && /Paid/.test(x); }), 'El préstamo sale pagado en el mes que cubre');
  // los fijos muestran su fecha
  S.ui.month = cur; t.app.render();
  assert.ok(/Due |Overdue since|Due today|Auto-pay on/.test(t.$('#vin').textContent), 'Los pendientes muestran la fecha');
  var p2 = problemas(t.doc.body);
  assert.deepEqual(p2, [], p2.join('\n'));
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('explorador de gráficos: todas las combinaciones', function () {
  var t = cargarApp();
  // gastos repartidos en varios meses, monedas y tarjetas
  [
    { cat: 'super', amt: '25,000', card: 'amexeco', merchant: 'Automercado' },
    { cat: 'comida', amt: '8,500', card: 'bct' },
    { cat: 'comida', amt: '12,000', card: 'bct', merchant: 'Pizza de prueba', via: 'Uber Eats' },
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
  var grupos = ['cat', 'card', 'merchant', 'via', 'day', 'week', 'month'];
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

test('tope anual en millas de la Gane Premios', function () {
  var t = cargarApp(), S = t.app.S, y = S.ui.month.slice(0, 4);
  S.expenses.push({ id: 'g1', ts: 1, date: y + '-01-10', amt: 20000, cur: 'USD', rate: 500, cat: 'otros', card: 'gana', merchant: '', note: '', intl: false });
  S.expenses.push({ id: 'g2', ts: 2, date: y + '-02-10', amt: 10000, cur: 'USD', rate: 500, cat: 'otros', card: 'gana', merchant: '', note: '', intl: false });
  t.app.act('disp', { dataset: { v: 'CRC' } }); // guarda y recalcula
  var rw = t.app.rewards(), tot = rw.get('g1').miles + rw.get('g2').miles;
  assert.equal(Math.round(tot), 25000, 'No pasa de 25,000 millas al año');
  t.click('[data-act="tab"][data-v="cards"]');
  assert.ok(/Gane Premios Gold/.test(t.$('#vin').textContent));
  t.cerrar();
});

function pegarAP(t, texto) {
  t.click('#fab');
  t.click('[data-act="ap-paste"]'); // en jsdom no hay portapapeles: aparece el campo para pegar a mano
  t.escribir('#ap_txt', texto);
}

test('Apple Pay: pegar una compra llena el formulario', function () {
  var t = cargarApp(), S = t.app.S;
  pegarAP(t, 'Mis gastos|₡15,000.00|AUTOMERCADO ESCAZU|AMEX CLASICO ECONOMIA para Google y Apple');
  assert.equal(t.$('#f_amt').value, '15,000');
  assert.equal(t.$('#f_cur').value, 'CRC');
  assert.equal(t.$('#f_merchant').value, 'Automercado');
  assert.equal(t.$('#f_cat').value, 'super', 'Toma la categoría del comercio');
  assert.equal(t.$('#f_card').value, 'amexeco');
  t.click('#sheet button[data-act="save-exp"]');
  var e = S.expenses[S.expenses.length - 1];
  assert.equal(e.amt, 15000); assert.equal(e.merchant, 'Automercado'); assert.equal(e.card, 'amexeco');

  // dólares con centavos, débito en dólares
  pegarAP(t, 'Expense-Tracker|$12.50|NIKE.COM|Visa Débito');
  assert.equal(t.$('#f_cur').value, 'USD');
  assert.equal(t.$('#f_merchant').value, 'Nike');
  assert.equal(t.$('#f_card').value, 'debusd');
  t.click('#sheet [data-act="cancel"]');

  // comercio nuevo: se escribe bonito y lo que el usuario corrige se recuerda
  pegarAP(t, 'Mis gastos|₡4.500,00|SODA LA PRUEBA SA|Tarjeta de Crédito Cash Back');
  assert.equal(t.$('#f_amt').value, '4,500');
  assert.equal(t.$('#f_merchant').value, 'Soda La Prueba Sa');
  assert.equal(t.$('#f_card').value, 'bct');
  t.escribir('#f_merchant', 'Soda La Prueba');
  t.click('#sheet button[data-act="save-exp"]');
  pegarAP(t, 'Mis gastos|₡3,000|SODA LA PRUEBA SA|Tarjeta de Crédito Cash Back');
  assert.equal(t.$('#f_merchant').value, 'Soda La Prueba', 'Recuerda el nombre corregido');
  t.click('#sheet [data-act="cancel"]');

  // un texto que no es del atajo no toca nada
  pegarAP(t, 'hola');
  assert.equal(t.$('#f_merchant').value, '');
  t.click('#sheet [data-act="cancel"]');
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('los cobros automáticos se registran solos y no vuelven si se borran', function () {
  var base = cargarApp(); var d = JSON.parse(JSON.stringify(base.app.S)); base.cerrar();
  var hoy = new Date(), m = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  d.settings.autoFrom = m;
  d.recurring.forEach(function (r) { if (r.id === 'r_claude') r.day = 1; if (r.id === 'r_yt') r.day = 31; });
  var t = cargarApp(d, { autoLog: true });
  var c = t.app.S.expenses.filter(function (e) { return e.recurId === 'r_claude'; });
  assert.equal(c.length, 1, 'Claude se registra solo el día 1');
  assert.equal(c[0].per, m); assert.equal(c[0].card, 'amexblue'); assert.equal(c[0].auto, true);
  assert.ok(!t.app.S.expenses.some(function (e) { return e.recurId === 'r_yt'; }) || hoy.getDate() >= 28, 'YouTube espera a su día');
  // si lo borrás, no vuelve
  t.app.S.expenses = t.app.S.expenses.filter(function (e) { return e.recurId !== 'r_claude'; });
  var g = JSON.parse(JSON.stringify(t.app.S)); t.cerrar();
  var t2 = cargarApp(g, { autoLog: true });
  assert.ok(!t2.app.S.expenses.some(function (e) { return e.recurId === 'r_claude'; }), 'Un cobro borrado no se vuelve a registrar');
  assert.deepEqual(t2.errores, []);
  t2.cerrar();
});

test('Viu se comparte 50/50: solo la mitad cuenta y el resto se debe', function () {
  var base = cargarApp(); var d = JSON.parse(JSON.stringify(base.app.S)); base.cerrar();
  var hoy = new Date(), m = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  d.settings.autoFrom = m;
  d.recurring.forEach(function (r) { if (r.id === 'r_viu') { r.day = 1; r.start = m; r.auto = true; } /* Viu se paga a mano; aquí se prueba el registro automático de un fijo compartido */ });
  var t = cargarApp(d, { autoLog: true });
  var v = t.app.S.expenses.find(function (e) { return e.recurId === 'r_viu'; });
  assert.ok(v, 'Viu se registra solo');
  assert.equal(v.amt, 20.99);
  assert.deepEqual(JSON.parse(JSON.stringify(v.split)), { mine: 10.5, got: 0 });
  // el formulario del fijo trae la mitad marcada
  t.app.render(); t.click('[data-act="tab"][data-v="set"]');
  var vr = t.app.S.recurring.find(function (r) { return r.id === 'r_viu'; });
  assert.equal(vr.split, true);
  assert.ok(!cargarApp().app.S.recurring.find(function (r) { return r.id === 'r_viu'; }).auto, 'Viu no es cobro automático');
  t.cerrar();
  var t2 = cargarApp();
  t2.app.S.ui.tab = 'exp'; t2.app.S.ui.month = '2026-12'; t2.app.render();
  t2.click('[data-act="pay-fixed"][data-id="r_viu"]');
  assert.equal(t2.$('#f_split').checked, true, 'Al registrar Viu a mano, ya viene compartido');
  assert.ok(Math.abs(parseFloat(t2.$('#f_smine').value) - 10.5) <= 0.5, 'La mitad de 20.99');
  assert.deepEqual(t2.errores, []);
  t2.cerrar();
});

test('carro: Year deja ver años anteriores (2025)', function () {
  var t = cargarApp(), S = t.app.S;
  S.ui.tab = 'car'; S.ui.carP = 'year'; t.app.render();
  var cy = new Date().getFullYear();
  assert.ok(t.$('#vin').textContent.indexOf(String(cy)) >= 0);
  for (var i = 0; i < 5; i++) { var b = t.$('[data-act="cary"][data-v="-1"]'); if (!b.disabled) t.click('[data-act="cary"][data-v="-1"]'); }
  assert.equal(S.ui.carY, 2025, 'No baja de 2025, el primer año con cargas');
  assert.ok(t.$('[data-act="cary"][data-v="-1"]').disabled);
  var txt = t.$('#vin').textContent;
  assert.ok(/\d+ fill-ups/.test(txt) && !/ 0 fill-ups/.test(txt), 'Muestra las cargas de 2025');
  var pr = problemas(t.doc.body); assert.deepEqual(pr, []);
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('seguro: un solo pago cubre varios gastos y se reparte', function () {
  var t = cargarApp(), S = t.app.S;
  var hoy = new Date(), d = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-01';
  [['i1', 'salud', 40000], ['i2', 'salud', 50000], ['i3', 'salud', 10000]].forEach(function (x) {
    S.expenses.push({ id: x[0], ts: 1, date: d, amt: x[2], cur: 'CRC', rate: 500, cat: x[1], card: 'debcrc', merchant: 'Prueba ' + x[0], note: '', intl: false, reimb: { exp: null, got: null } });
  });
  S.ui.tab = 'home'; S.ui.month = d.slice(0, 7); t.app.render();
  var antes = t.app.monthStats(d.slice(0, 7));
  assert.equal(antes.ins, 100000, 'Los tres cuentan completos mientras esperan');
  assert.ok(t.$('#vin').textContent.indexOf('waiting on insurance') >= 0);
  assert.ok(t.$('#vin').textContent.indexOf('..') < 0, 'Sin punto doble');
  t.click('[data-act="ins-pay"]');
  assert.equal(t.doc.querySelectorAll('.ins_ck').length, 3);
  t.escribir('#ip_amt', '80,000');
  t.click('#sheet [data-act="save-ins"]');
  var got = ['i1', 'i2', 'i3'].map(function (id) { return S.expenses.find(function (e) { return e.id === id; }).reimb.got; });
  assert.deepEqual(got, [32000, 40000, 8000], 'Se reparte según lo que costó cada uno');
  var desp = t.app.monthStats(d.slice(0, 7));
  assert.equal(desp.ins, 0);
  assert.equal(Math.round(antes.spent - desp.spent), 80000, 'Solo cuenta lo que no devolvieron');
  assert.ok(!t.$('[data-act="ins-pay"]'), 'Ya no quedan pendientes');
  var pr = problemas(t.doc.body); assert.deepEqual(pr, []);
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('consultas con presupuesto anual: no cuentan en el mes y se ven contra el año', function () {
  var t = cargarApp(), S = t.app.S;
  var hoy = new Date(), m = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  var antes = t.app.monthStats(m);
  S.expenses.push({ id: 'y1', ts: 1, date: m + '-01', amt: 200000, cur: 'CRC', rate: 500, cat: 'medicos', card: 'debcrc', merchant: 'Óptica', note: '', intl: false });
  S.expenses.push({ id: 'y2', ts: 1, date: m + '-02', amt: 5000, cur: 'CRC', rate: 500, cat: 'ropa', card: 'debcrc', merchant: 'Tienda', note: '', intl: false });
  S.ui.tab = 'home'; S.ui.month = m; S.settings.disp = 'CRC'; t.app.render();
  var st = t.app.monthStats(m);
  assert.equal(st.spent - antes.spent, 5000, 'La consulta no entra en el presupuesto del mes');
  assert.equal(st.occ, 200000);
  var txt = t.$('#vin').textContent;
  assert.ok(txt.indexOf('340K/yr') >= 0 && txt.indexOf('Left this year') >= 0, 'El mosaico muestra el año');
  assert.ok(txt.indexOf('No budget') >= 0, 'Ropa sin presupuesto se ve neutral');
  // en Budget: sección anual y se puede volver a mensual
  S.ui.tab = 'meta'; t.app.render();
  assert.ok(t.$('#vin').textContent.indexOf('Once in a while') >= 0);
  t.click('[data-act="cat-yearly"][data-id="medicos"]');
  assert.ok(!S.cats.find(function (c) { return c.id === 'medicos'; }).yearly);
  t.escribir('#yr_add', 'ropa');
  assert.ok(S.cats.find(function (c) { return c.id === 'ropa'; }).yearly);
  var pr = problemas(t.doc.body); assert.deepEqual(pr, []);
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('fijos cada 3 meses y anuales aparecen solo cuando tocan', function () {
  var t = cargarApp(), S = t.app.S;
  var nombres = function (m) { S.ui.month = m; S.ui.tab = 'exp'; t.app.render(); return t.$('#vin').textContent; };
  var dic = nombres('2026-12'), ene = nombres('2027-01'), mar = nombres('2027-03'), nov = nombres('2026-11');
  assert.ok(/Uber One/.test(dic) && /Viu/.test(dic) && /Marchamo/.test(dic), 'En diciembre tocan los tres');
  assert.ok(!/Uber One/.test(ene) && !/Viu/.test(ene) && !/Marchamo/.test(ene), 'En enero no toca ninguno');
  assert.ok(/Viu/.test(mar) && !/Uber One/.test(mar), 'Viu vuelve a los 3 meses');
  assert.ok(!/Marchamo/.test(nov), 'El marchamo no aparece en noviembre');
  assert.ok(/Amount varies/.test(dic), 'El marchamo no tiene monto fijo');
  // al registrar el marchamo, viene con la meta de ahorro elegida y el monto vacío
  S.ui.month = '2026-12'; t.app.render();
  t.app.act('pay-fixed', { dataset: { id: 'r_marchamo', per: '2026-12' } });
  assert.equal(t.$('#f_goal').value, 'g_march');
  assert.equal(t.$('#f_amt').value, '');
  t.cerrar();
});

test('gastos compartidos: solo tu parte cuenta y lo demás te lo deben', function () {
  var t = cargarApp(), S = t.app.S;
  t.click('#fab'); t.escribir('#f_cat', 'comida'); t.escribir('#f_amt', '40,000');
  t.$('#f_split').checked = true; t.escribir('#f_split', 'on');
  assert.equal(t.$('#f_smine').value, '20,000', 'Por defecto propone la mitad');
  t.click('#sheet button[data-act="save-exp"]');
  var e = S.expenses[S.expenses.length - 1];
  assert.deepEqual(JSON.parse(JSON.stringify(e.split)), { mine: 20000, got: 0 });
  var st = t.app.monthStats(S.ui.month);
  assert.equal(Math.round(st.by.comida.spent), 20000, 'En el presupuesto cuenta solo tu parte');
  t.click('[data-act="tab"][data-v="home"]');
  assert.ok(/Owed to you/.test(t.$('#vin').textContent), 'Aparece lo que te deben');
  // cuando te pagan, desaparece
  e.split.got = 20000; t.app.render();
  assert.ok(!/Owed to you/.test(t.$('#vin').textContent));
  t.cerrar();
});

test('ingresos extra y tasa de ahorro', function () {
  var t = cargarApp(), S = t.app.S;
  S.settings.income = 1000000;
  t.click('[data-act="tab"][data-v="meta"]');
  t.click('[data-act="add-income"]');
  t.escribir('#i_amt', '200,000'); t.escribir('#i_note', 'Bonus');
  t.click('#sheet button[data-act="save-income"]');
  assert.equal(S.incomes.length, 1);
  assert.ok(/Bonus/.test(t.$('#vin').textContent), 'El ingreso extra sale en el resumen');
  t.click('[data-act="tab"][data-v="home"]');
  var txt = t.$('#vin').textContent;
  assert.ok(/Income and savings rate/.test(txt) && /1,200,000/.test(txt), 'Inicio suma el ingreso fijo y el extra');
  var p = problemas(t.doc.body); assert.deepEqual(p, [], p.join('\n'));
  t.cerrar();
});

test('pestaña Car: historial, métricas y filtros', function () {
  var t = cargarApp(), S = t.app.S;
  assert.equal(S.fuel.length, 28, 'Trae las 28 cargas del historial');
  assert.equal(S.fuel.filter(function (f) { return f.missed; }).length, 4);
  S.ui.carP = 'all'; S.ui.tab = 'car'; t.app.render();
  var txt = t.$('#vin').textContent;
  assert.ok(/Toyota Yaris Cross/.test(txt));
  assert.ok(/8,244 km/.test(txt), 'Distancia total del historial');
  assert.ok(/9\.4 L\/100/.test(txt), 'Consumo promedio sin las cargas marcadas');
  ['month', 'year', 'ytd', '12m', 'all'].forEach(function (p) {
    ['eff', 'km', 'spend', 'price'].forEach(function (c) {
      S.ui.carP = p; S.ui.carC = c; t.app.render();
      var pr = problemas(t.doc.body); assert.deepEqual(pr, [], p + '/' + c + ': ' + pr.join('\n'));
    });
  });
  // el historial no cuenta en el presupuesto
  assert.equal(t.app.monthStats('2026-09').by.gasolina.spent, 0);
  t.cerrar();
});

test('registrar una carga desde el formulario', function () {
  var t = cargarApp(), S = t.app.S;
  S.ui.tab = 'car'; t.app.render();
  t.click('#fab');
  assert.equal(t.$('#f_cat').value, 'gasolina');
  assert.notEqual(t.$('#f_fuelbox').style.display, 'none');
  t.escribir('#f_amt', '21,780'); t.escribir('#f_odo', '8,600'); t.escribir('#f_ppl', '726');
  t.click('#sheet button[data-act="save-exp"]');
  var e = S.expenses[S.expenses.length - 1], f = S.fuel.find(function (x) { return x.expId === e.id; });
  assert.ok(f, 'La carga queda enlazada al gasto');
  assert.equal(f.odo, 8600); assert.equal(f.l, 30); assert.equal(f.full, true);
  // borrar el gasto borra la carga
  t.app.act('edit-exp', { dataset: { id: e.id } });
  t.click('#sheet [data-act="del-exp"]');
  assert.ok(!S.fuel.some(function (x) { return x.expId === e.id; }));
  t.cerrar();
});

test('tarjeta por defecto según la categoría', function () {
  var t = cargarApp();
  t.click('#fab');
  t.escribir('#f_cat', 'online');
  assert.equal(t.$('#f_card').value, 'amexblue', 'Online va con Amex Blue');
  t.escribir('#f_cat', 'salidas');
  assert.equal(t.$('#f_card').value, 'amexblue', 'Salidas y bares van con Amex Blue');
  t.escribir('#f_cat', 'super');
  assert.equal(t.$('#f_card').value, 'amexeco', 'El día a día va con Amex EconoMía');
  t.escribir('#f_amt', '50,000');
  assert.ok(!/BCT/.test(t.$('#prev').textContent), 'La BCT es de respaldo: no se sugiere');
  t.click('#sheet [data-act="cancel"]');
  // con historial, gana la tarjeta que más usás en esa categoría
  var S = t.app.S, d = S.ui.month + '-02';
  [1, 2, 3].forEach(function (i) { S.expenses.push({ id: 'h' + i, ts: i, date: d, amt: 1000, cur: 'CRC', rate: 500, cat: 'gasolina', card: 'premia', merchant: '', note: '', intl: false }); });
  t.click('#fab'); t.escribir('#f_cat', 'gasolina');
  assert.equal(t.$('#f_card').value, 'premia', 'Usa la tarjeta habitual de la categoría');
  t.cerrar();
});

test('la Gane Premios queda de última opción', function () {
  var t = cargarApp();
  t.click('#fab');
  t.escribir('#f_cat', 'otros');
  t.escribir('#f_amt', '100,000');
  assert.notEqual(t.$('#f_card').value, 'gana', 'No se elige sola');
  assert.ok(!/Gane/.test(t.$('#prev').textContent), 'No aparece como mejor opción');
  var btns = t.doc.querySelectorAll('#f_cpick button');
  assert.equal(btns[btns.length - 1].dataset.id, 'gana', 'Está de última en la lista');
  t.cerrar();
});

test('respaldo: aviso semanal', function () {
  var t = cargarApp(), S = t.app.S, dia = 864e5;
  S.expenses.push({ id: 'b1', ts: Date.now() - 3 * dia, date: S.ui.month + '-01', amt: 1000, cur: 'CRC', rate: S.fx.rate, cat: 'otros', card: 'debcrc', merchant: '', note: '', intl: false });
  t.click('[data-act="tab"][data-v="home"]');
  assert.ok(/You have not backed up/.test(t.$('#vin').textContent), 'Sin respaldo debe avisar');
  S.settings.lastBackup = Date.now() - 2 * dia; t.app.render();
  assert.ok(!t.$('#vin [data-act="export"]'), 'Con respaldo reciente no avisa');
  S.settings.lastBackup = Date.now() - 8 * dia; t.app.render();
  assert.ok(/last backup was 8 days ago/.test(t.$('#vin').textContent), 'A la semana vuelve a avisar');
  t.cerrar();
});

function ids(S) { return JSON.parse(JSON.stringify(S.expenses.map(function (e) { return e.id; }))); }

function importar(t, datos) {
  var inp = t.$('#impfile');
  var f = new t.w.File([JSON.stringify(datos)], 'respaldo.json', { type: 'application/json' });
  Object.defineProperty(inp, 'files', { value: [f], configurable: true });
  inp.dispatchEvent(new t.w.Event('change', { bubbles: true }));
  return new Promise(function (r) { setTimeout(r, 100); });
}

test('respaldo: importar uno viejo lo actualiza y se puede deshacer', async function () {
  var t = cargarApp(), S = t.app.S;
  S.expenses.push({ id: 'actual', ts: 1, date: S.ui.month + '-02', amt: 5000, cur: 'CRC', rate: S.fx.rate, cat: 'super', card: 'debcrc', merchant: 'Vindi', note: '', intl: false });
  t.click('[data-act="tab"][data-v="set"]');
  // respaldo de una versión vieja: sin comercios ni categoría de consultas médicas
  var viejo = JSON.parse(JSON.stringify(S));
  viejo.v = 3; delete viejo.merchants;
  viejo.cats = viejo.cats.filter(function (c) { return c.id !== 'medicos'; });
  viejo.expenses = [{ id: 'resp1', ts: 2, date: S.ui.month + '-03', amt: 7000, cur: 'CRC', rate: 500, cat: 'comida', card: 'bct', merchant: 'Starbucks', note: '', intl: false }];
  await importar(t, viejo);
  S = t.app.S;
  assert.equal(S.v, 23, 'El respaldo viejo pasa por la actualización');
  assert.deepEqual(ids(S), ['resp1']);
  assert.ok(S.merchants.length > 0 && S.cats.some(function (c) { return c.id === 'medicos'; }));
  t.click('[data-act="tab"][data-v="set"]');
  assert.ok(t.$('[data-act="undo-prev"]'), 'Aparece el botón para deshacer');
  t.click('[data-act="undo-prev"]');
  assert.deepEqual(ids(t.app.S), ['actual'], 'Deshacer vuelve a los datos de antes');
  // un archivo que no es respaldo no toca nada
  t.click('[data-act="tab"][data-v="set"]');
  await importar(t, { hola: 1 });
  assert.deepEqual(ids(t.app.S), ['actual']);
  assert.deepEqual(t.errores, []);
  t.cerrar();
});

test('respaldo: borrar todo se puede deshacer', function () {
  var t = cargarApp();
  t.app.S.expenses.push({ id: 'x1', ts: 1, date: t.app.S.ui.month + '-02', amt: 100, cur: 'CRC', rate: 500, cat: 'otros', card: 'debcrc', merchant: '', note: '', intl: false });
  t.click('[data-act="tab"][data-v="set"]');
  t.click('[data-act="reset"]');
  assert.equal(t.app.S.expenses.length, 0);
  t.click('[data-act="tab"][data-v="set"]');
  t.click('[data-act="undo-prev"]');
  assert.equal(t.app.S.expenses.length, 1, 'Vuelve el gasto borrado');
  assert.equal(t.guardado().expenses.length, 1, 'Y queda guardado');
  t.cerrar();
});
