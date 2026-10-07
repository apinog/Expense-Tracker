# Expense-Tracker

App personal de presupuesto y gastos en colones y dólares. Es una PWA de un solo archivo, pensada para iPhone, alojada en GitHub Pages. No tiene servidor: los datos viven en el `localStorage` del dispositivo.

## Reglas que no se rompen

1. **El repo es público. Nunca poner datos personales** en el código, en este archivo ni en los commits: ingreso, saldos reales, números o últimos dígitos de tarjetas, datos de cuentas. Las fotos de tarjetas ya tienen los últimos dígitos tapados.
2. **Cada cambio sube la versión del caché** en `sw.js` (`const CACHE = 'mis-gastos-vN'`). Sin eso, el iPhone no toma la versión nueva.
3. **Nunca borrar ni romper los datos guardados del usuario.** Si cambia la forma de los datos: subir `v` en `seed()` y agregar un bloque de migración en `load()`, siguiendo los bloques `if((out.v||1)<N)` que ya existen.
4. **Idioma de la interfaz:** inglés (desde el 2026-10-05, a pedido del usuario). Español solo cuando hace falta: nombres propios de comercios, tarjetas, SINPE Móvil, Marchamo. Sin apóstrofos dentro de strings JS con comillas simples.
5. **Formato de números:** comas en los miles y sin decimales, siempre (`money()`, `short()`, `fmtIn()`). Los campos de monto se leen con `num()`, que acepta comas.
6. **Mobile primero, iPhone en Safari y como app instalada.** Campos de texto de 16px o más (si no, iOS hace zoom). Probar siempre en un viewport de 390x844.
7. **No inventar datos:** ni dominios web, ni tasas de recompensa, ni logos. Si falta un dato, pedirlo. **No dibujar logos de marcas**: usar imágenes que el usuario manda o el favicon del sitio web del comercio.
8. **Sin frameworks ni build.** HTML, CSS y JavaScript sin dependencias (solo las fuentes de Google). Mantener el estilo del archivo (`var`, funciones, strings de plantilla).

## Archivos

- `index.html`: toda la app. Incluye imágenes en base64 (`IMG` para tarjetas, `MIMG` para logos de comercios).
- `sw.js`: service worker. Red primero para `index.html`, caché para lo demás. El tipo de cambio nunca se cachea.
- `manifest.json` y `icons/`: lo que hace falta para instalarla como app.
- `cards/`: fotos originales de las tarjetas (480x302, `.webp` o `.jpg`). La app usa la copia incrustada en `index.html`; si cambia una foto, actualizar las dos.

## Cómo está armada

- **Estado:** un objeto `S` guardado en `localStorage` con la clave `gastos_tracker_v1`. Campos: `settings`, `fx`, `cats`, `cards`, `recurring`, `budgets` (`base` y `over` por mes), `goals`, `contribs`, `expenses`, `redeems`, `incomes` (ingresos extra: `{id,date,amt,cur,rate,note}`), `fuel` (cargas de gasolina: `{id,date,odo,l,ppl,total,full,missed,expId?}`), `car` (`{name,year}`), `merchants`, `generated`, `ui`. La versión del esquema es `v` (hoy 21). Antes de importar un respaldo o de borrar todo, la app guarda una copia en `gastos_tracker_v1_antes` para poder deshacer. Importar pasa por `load()`, así un respaldo viejo se actualiza con las migraciones.
- **Pantallas:** funciones `view*()` que devuelven HTML como texto. `render()` lo pone en `#vin`. Los eventos usan delegación con `data-act` y un `switch` en `act()`.
- **Formularios:** hojas inferiores con `openSheet()`. Se ajustan al teclado con `visualViewport` y el botón Guardar queda fijo abajo.
- **Layout tipo app:** `#app` es una columna fija; `#view` es el único elemento que scrollea. Encabezado y barra inferior no se mueven. No usar `position: sticky` ni `fixed` para cosas nuevas sin probar en iPhone.
- **Pestañas:** Home, Expenses, Cards, Budget, Savings, Car. Settings se abre con el ícono de arriba a la derecha.
- **Diseño:** tema "fintech" violeta (bloque `tema fintech` al final del CSS), fuente Plus Jakarta Sans, secciones como tarjetas redondeadas. Las categorías usan íconos de línea propios (`CATICO`, `catIco()`); las categorías creadas por el usuario usan su emoji.

## Modelo del gasto

`{id, ts, date, amt, cur, rate, cat, card, merchant, via?, note, intl, recurId?, per?, auto?, goal?, reimb?, split?}`

- `rate` es colones por dólar **al momento de registrar**. Cada gasto guarda el suyo para que el historial no cambie cuando el dólar se mueve. Los totales se convierten con ese `rate`.
- `goal`: gasto pagado con una meta de ahorro. No cuenta contra el presupuesto y se descuenta del saldo de la meta.
- `reimb: {exp, got}`: reembolso del seguro médico. En el presupuesto cuenta el monto menos lo recibido (`netOf()`). Las recompensas se calculan sobre el monto completo.
- `split: {mine, got}`: gasto compartido. En el presupuesto cuenta solo `mine` (`myShare()`, usado por `netOf()`); lo que falta (`owedOf()`) sale en Home como "Owed to you". Las recompensas siguen sobre el monto completo.
- `recurId`: viene de un fijo automático.
- `per`: mes (`YYYY-MM`) que cubre un fijo. Si se paga antes (el préstamo se paga una semana antes del día 2), cuenta para ese mes. `mOf(e)` da el mes de un gasto para presupuesto, listas y gráficos; los totales por tarjeta y los topes de recompensas siguen la fecha real.
- `via`: app de entrega con la que se pidió (por ahora solo `'Uber Eats'`, lista `DELIVERY`). `merchant` es el restaurante. Solo se pregunta en categorías del grupo `rest`. El gráfico puede agrupar por app de entrega.

## Reglas de negocio importantes

- **Carro (pestaña Car):** Toyota Yaris Cross 2025. `S.fuel` trae el historial de Road Trip (jun 2025 a sep 2026, `FUEL0`, solo fechas; el usuario aceptó que esté en el repo) y las cargas nuevas, que se crean desde un gasto de Gas con "Fill-up details" (`expId` las enlaza; borrar el gasto borra la carga). El historial no cuenta en presupuestos. `fuelList()` calcula tramo y consumo: una carga cuenta para el consumo solo si ella y la anterior fueron a tanque lleno y no tiene `missed`. Filtros Month/Year/YTD/12M/All, métricas, gráficos (`drawSeries` con formato propio) e ideas (`carInsights()`). No hay API del precio de RECOPE (su página no permite leerla desde otra web): el precio actual es el de la última carga.
- **Ingresos:** `settings.income` es el ingreso fijo mensual; `incomes` guarda bonos y pagos únicos. `monthIncome()` los suma y Home muestra la tasa de ahorro del mes.
- **Moneda:** colones y dólares. Un interruptor cambia lo que se muestra. Presupuestos y metas guardan su moneda original.
- **Tipo de cambio:** primero `api.hacienda.go.cr/indicadores/tc/dolar` (referencia BCCR, venta), luego `open.er-api.com`, luego `api.exchangerate-api.com`. Se refresca cada 6 horas. Si falla, usa el último guardado. El usuario también puede fijarlo a mano.
- **Recompensas:** cada tarjeta tiene `type` (`cashback`, `miles` o `none`) y tasas por grupo de comercio (`super`, `salud`, `clinicas`, `rest`, `mascotas`, `gasolina`, `viajes`, `entret`, `tiendas`, `otros`), más una tasa `intl` para compras del exterior. Hay topes mensual y anual. `rewards()` los aplica por gasto. `bestCards()` sugiere la tarjeta que más rinde. El saldo estimado es saldo inicial + ganado − canjes. La Gane Premios Gold (BAC) da 1 milla por dólar, con tope de 25,000 millas al año y mínimo de 1,000 para canjear (página oficial de BAC). BAC no publica el valor de la milla en dinero (2 millas Gane Premios = 1 milla LifeMiles); usa el mismo `mileUSD` que la Premia. En tarjetas de millas los topes se cuentan en millas. La Gane Premios ya casi no se usa: tiene `nosug` (última opción, nunca se sugiere ni se elige sola).
- **Apple Pay:** un atajo de iPhone (automatización de Wallet) copia `Expense-Tracker|monto|comercio|tarjeta` (el archivo del atajo se arma y se firma en la Mac con `shortcuts sign`). En "Nuevo gasto", el botón "Pegar compra de Apple Pay" lo lee (`parseAP()`), reconoce la tarjeta por su nombre en Wallet (`WALLET`; las dos "Visa Débito" se separan por moneda) y el comercio (`walletMerchant()`), y recuerda lo que el usuario corrige en `settings.apMerch` y `settings.apCard`. Nunca guardar números de tarjeta.
- **Fijos automáticos (`recurring`):** `every` (1, 3, 6 o 12 meses) y `start` (`YYYY-MM` del próximo cobro) definen en qué meses toca (`billDue()`); `goal` opcional hace que se paguen con una meta de ahorro (el Marchamo, monto variable `amt:0`, vence el 15 de diciembre). Uber One es anual (14 dic, Amex Blue), Viu cada 3 meses por PayPal (que usa la BAC Débito $, sin recompensas). `day` es el día límite de pago, o el día en que se cobra solo si `auto`. La lista de pendientes va ordenada por fecha y avisa a 3 días; la cuota del mes siguiente aparece `LEAD` (10) días antes. Los que tienen `auto` (Claude, YouTube) se registran solos el día del cobro con `autoLogBills()` (gasto con `auto:true`), desde `settings.autoFrom`; si el usuario borra uno, `settings.autoDone` evita que vuelva. Los demás NO se agregan solos: aparecen como pendientes y el usuario los registra uno por uno cuando los paga. El préstamo tiene un campo `fee` para la comisión de transferencia.
- **Comercios:** en el formulario solo se muestran los de la categoría elegida. Logo: imagen propia primero, después el favicon del `site` del comercio, después las iniciales.
- **Inicio:** vista Mes y Año. Arriba va lo disponible para gastos variables, con una marca de cuánto del mes ya pasó. Incluye ideas automáticas, mosaicos de categorías en dos columnas, fijos del mes, reembolsos pendientes, ahorro, una tabla plegable de meta contra gasto y un explorador de gráficos propio en SVG. Los primeros días del mes aparece el cierre del mes anterior, con sugerencias de metas.

## Cómo probar

Todavía no hay pruebas en el repo. **Primera tarea sugerida:** crear `tests/` con:

1. Una prueba rápida en jsdom: cargar `index.html`, recorrer las pestañas, registrar gastos en colones y dólares, probar todas las combinaciones del explorador de gráficos y verificar que no aparezcan `NaN` ni `undefined`.
2. Una prueba de migración: guardar datos con una versión vieja de `v` y comprobar que se conservan.
3. Capturas con Playwright a 390x844 de cada pestaña y de las hojas de formulario.

Para probar con el service worker hay que servir por HTTP (`python3 -m http.server`), porque no funciona con `file://`. La app expone `window.__app` para las pruebas.

## Despliegue

GitHub Pages desde la rama `main`, carpeta raíz. Después de subir cambios tarda 1 o 2 minutos. En el iPhone, cerrar y abrir la app dos veces para que tome la versión nueva.

## Pendientes

- Logos de comercios: el usuario los va a mandar como imágenes.
- Detalle de gasolina por carga: litros, precio por litro, kilometraje y rendimiento. Diseñarlo después de unas dos semanas de uso real.
- Vigilar cómo se ve y se siente en un iPhone real. No se probó en Safari de verdad, solo en un navegador simulado.

## Cómo trabajar con el usuario

- No programa. Desde el 2026-10-05 prefiere conversar en inglés, con pasos cortos y sin jerga.
- Antes de un cambio grande, mostrar un plan breve y esperar el visto bueno.
- Al terminar, decir con claridad qué cambió, qué se probó y qué no se pudo probar.
- Si algo se ve mal en pantalla, pedir una captura en vez de adivinar.
