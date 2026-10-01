# Pruebas

Estas pruebas no son parte de la app: la app sigue siendo un solo archivo sin dependencias.
Necesitan Node.js (desde nodejs.org).

La primera vez, desde esta carpeta:

```
npm install
npx playwright install webkit
```

Después:

- `npm test`: prueba rápida (pestañas, gastos en ₡ y $, todas las combinaciones del explorador de gráficos) y prueba de migración de datos viejos. Tarda segundos.
- `npm run capturas`: capturas a 390x844 en Safari (WebKit) de cada pestaña y de las hojas de formulario. Quedan en `tests/capturas/`.
- `npm run todo`: las dos cosas.

| Archivo | Qué hace |
|---|---|
| `ayuda.js` | Carga `index.html` en jsdom sin red y busca `NaN` o `undefined` en pantalla |
| `humo.test.js` | Prueba rápida |
| `migracion.test.js` | Arma datos como los guardaba cada versión (1 a 8) y revisa que nada se pierda |
| `capturas.spec.js` | Capturas con Playwright; también revisa que nada se salga de la pantalla y que los campos tengan 16px o más |

Si cambia la versión de los datos (`v` en `seed()`), agregar el caso nuevo en `datosViejos()` de `migracion.test.js`.
