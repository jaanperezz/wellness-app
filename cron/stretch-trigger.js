#!/usr/bin/env node
/**
 * Dispara la alarma de pausa activa cada 30 min llamando al endpoint de Vercel.
 * Vive en el VPS (no en Vercel) porque el plan Hobby de Vercel solo permite
 * cron 1x/día — su cron aquí no tiene esa restricción, y este mismo patrón
 * (cron cada 5 min + auto-filtro de hora Madrid real) es el que ya usa
 * personal-os para ser inmune a cambios de hora (CET/CEST).
 * Cron: cada 5 minutos en el crontab de root del VPS.
 */
'use strict';

const https = require('https');
const fs = require('fs');

const ENV_PATH = require('path').join(__dirname, '..', '.env.cron');
const env = {};
try {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch { /* sin .env.cron */ }

const ACTIVE_START = 9;  // hora Madrid de inicio de la ventana activa
const ACTIVE_END = 21;   // hora Madrid de fin (exclusiva)

function hourMadrid() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(new Date()));
}
function minuteMadrid() {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', minute: '2-digit' }).format(new Date()));
}

function main() {
  const h = hourMadrid();
  const m = minuteMadrid();
  if (h < ACTIVE_START || h >= ACTIVE_END) return; // fuera de ventana activa
  if (!(m < 5 || (m >= 30 && m < 35))) return; // solo en los boundaries de :00 y :30 (ventana de 5min por la granularidad del cron)

  if (!env.STRETCH_CRON_SECRET) { console.error('[stretch-trigger] falta STRETCH_CRON_SECRET en .env.cron'); return; }

  https.get(`https://wellness-app.vercel.app/api/stretch-alert?key=${env.STRETCH_CRON_SECRET}`, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => console.log(`[stretch-trigger] ${new Date().toISOString()} status=${res.statusCode} ${data}`));
  }).on('error', (e) => console.error('[stretch-trigger] error:', e.message));
}

main();
