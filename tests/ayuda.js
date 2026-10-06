// Utilidades compartidas: cargar index.html en jsdom y revisar la pantalla.
var fs = require('fs');
var path = require('path');
var { JSDOM } = require('jsdom');

var HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
var KEY = 'gastos_tracker_v1';

// Carga la app. Si se pasan `datos`, se guardan antes en localStorage como si ya existieran.
function cargarApp(datos, opts) {
  opts = opts || {};
  var errores = [];
  var dom = new JSDOM(HTML, {
    url: 'http://localhost/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    beforeParse: function (w) {
      if (datos !== undefined) w.localStorage.setItem(KEY, typeof datos === 'string' ? datos : JSON.stringify(datos));
      // sin red: el tipo de cambio se queda con el guardado
      w.fetch = function () { return Promise.reject(new Error('sin red en pruebas')); };
      w.confirm = function () { return true; };
      w.alert = function () {};
      if (!opts.autoLog) w.__noAutoLog = true;
      w.addEventListener('error', function (e) { errores.push(e.error || e.message); });
    }
  });
  dom.virtualConsole.on('jsdomError', function (e) { errores.push(e); });
  var w = dom.window;
  return {
    dom: dom, w: w, doc: w.document, app: w.__app, errores: errores,
    guardado: function () { return JSON.parse(w.localStorage.getItem(KEY)); },
    $: function (s) { return w.document.querySelector(s); },
    click: function (sel) {
      var el = typeof sel === 'string' ? w.document.querySelector(sel) : sel;
      if (!el) throw new Error('No encontré ' + sel);
      el.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    },
    escribir: function (sel, valor) {
      var el = w.document.querySelector(sel);
      if (!el) throw new Error('No encontré ' + sel);
      el.value = valor;
      el.dispatchEvent(new w.Event('input', { bubbles: true }));
      el.dispatchEvent(new w.Event('change', { bubbles: true }));
    },
    cerrar: function () { w.close(); }
  };
}

// Busca NaN, undefined, null o Infinity visibles en el texto o en atributos (por ejemplo, en el SVG).
// Ignora las imágenes en base64, que pueden contener esas letras por casualidad.
var MALO = /\bNaN\b|\bundefined\b|\bInfinity\b|\[object Object\]/;
function problemas(raiz) {
  var hallados = [];
  var copia = raiz.cloneNode(true);
  copia.querySelectorAll('script, style, template').forEach(function (el) { el.remove(); });
  var texto = copia.textContent || '';
  var m = MALO.exec(texto);
  if (m) hallados.push('texto: …' + texto.slice(Math.max(0, m.index - 40), m.index + 30).replace(/\s+/g, ' ') + '…');
  copia.querySelectorAll('*').forEach(function (el) {
    Array.prototype.forEach.call(el.attributes, function (a) {
      if (/^data:/.test(a.value)) return;
      if (MALO.test(a.value)) hallados.push('<' + el.tagName.toLowerCase() + ' ' + a.name + '="' + a.value.slice(0, 80) + '">');
    });
  });
  return hallados;
}

module.exports = { cargarApp: cargarApp, problemas: problemas, KEY: KEY };
