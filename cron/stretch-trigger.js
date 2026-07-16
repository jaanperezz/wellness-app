#!/usr/bin/env node
/**
 * Despachador de notificaciones del Wellness — vive en el VPS (crontab de root,
 * cada 5 min) porque el plan Hobby de Vercel solo permite cron 1x/día.
 * Auto-filtra por hora Madrid real (Intl) — inmune a CET/CEST, mismo patrón
 * que personal-os.
 *
 * Dispara (hora Madrid):
 *  - Pausa activa (estiramientos):  :00 y :30 de 9:00-20:30  → /api/stretch-alert
 *  - Repesca pendientes (espalda1º): 12:00 · 16:30 · 20:30    → /api/push-trigger?type=repesca
 *  - Comida franja abierta:          7:00 13:00 17:00 20:00   → /api/push-trigger?type=meal_open
 *  - Comida cierre de franja:        8:30 14:30 18:00 21:00   → /api/push-trigger?type=meal_check
 *
 * Cron: cada 5 minutos → cada evento usa ventana [M, M+5) para disparar UNA vez.
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

const BASE = 'https://wellness-app.vercel.app';
const ACTIVE_START = 9;   // ventana de pausas activas (hora Madrid)
const ACTIVE_END = 21;

function madrid(part) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', [part]: '2-digit', hour12: false }).format(new Date()));
}

function hit(path, label) {
  https.get(`${BASE}${path}${path.includes('?') ? '&' : '?'}key=${env.STRETCH_CRON_SECRET}`, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => console.log(`[wellness-trigger] ${new Date().toISOString()} ${label} status=${res.statusCode} ${data}`));
  }).on('error', (e) => console.error(`[wellness-trigger] ${label} error:`, e.message));
}

function at(h, targetH, m, targetM) { return h === targetH && m >= targetM && m < targetM + 5; }

function main() {
  if (!env.STRETCH_CRON_SECRET) { console.error('[wellness-trigger] falta STRETCH_CRON_SECRET en .env.cron'); return; }
  const h = madrid('hour');
  const m = madrid('minute');

  // 1. Pausa activa cada 30 min en ventana 9-21
  if (h >= ACTIVE_START && h < ACTIVE_END && (m < 5 || (m >= 30 && m < 35))) {
    hit('/api/stretch-alert', 'stretch');
  }

  // 2. Repescas de pendientes (espalda primero — el SW compone el cuerpo)
  if (at(h, 12, m, 0) || at(h, 16, m, 30) || at(h, 20, m, 30)) {
    hit('/api/push-trigger?type=repesca', 'repesca');
  }

  // 3. Comidas — apertura de franja
  const opens = { 7: 0, 13: 1, 17: 2, 20: 3 };
  if (m < 5 && opens[h] !== undefined) {
    hit(`/api/push-trigger?type=meal_open&slot=${opens[h]}`, `meal_open:${opens[h]}`);
  }

  // 4. Comidas — aviso de cierre (solo pesa si no está registrada; lo decide el SW)
  if (at(h, 8, m, 30)) hit('/api/push-trigger?type=meal_check&slot=0', 'meal_check:0');
  if (at(h, 14, m, 30)) hit('/api/push-trigger?type=meal_check&slot=1', 'meal_check:1');
  if (at(h, 18, m, 0)) hit('/api/push-trigger?type=meal_check&slot=2', 'meal_check:2');
  if (at(h, 21, m, 0)) hit('/api/push-trigger?type=meal_check&slot=3', 'meal_check:3');
}

main();
