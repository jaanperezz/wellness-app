#!/usr/bin/env node
/**
 * Despachador de notificaciones del Wellness — vive en el VPS (crontab de root,
 * cada 5 min) porque el plan Hobby de Vercel solo permite cron 1x/día.
 * Auto-filtra por hora Madrid real (Intl) — inmune a CET/CEST, mismo patrón
 * que personal-os.
 *
 * ⚠️ ESM obligatorio: el package.json del proyecto es "type":"module" — la
 * versión anterior usaba require() y llevaba crasheando desde el 7-jul sin
 * enviar nada. Además apuntaba a wellness-app.vercel.app, que NO es nuestro
 * proyecto (el dominio real es wellness-app-jet-eta.vercel.app).
 *
 * Dispara (hora Madrid):
 *  - Pausa activa (estiramientos):  :00 y :30 de 9:00-20:30  → /api/stretch-alert
 *  - Repesca pendientes (espalda1º): 12:00 · 16:30 · 20:30    → /api/push-trigger?type=repesca
 *  - Comida franja abierta:          7:00 13:00 17:00 20:00   → /api/push-trigger?type=meal_open
 *  - Comida cierre de franja:        8:30 14:30 18:00 21:00   → /api/push-trigger?type=meal_check
 *
 * Cron cada 5 min → cada evento usa ventana [M, M+5) para disparar UNA vez.
 * Test manual: `node stretch-trigger.js repesca` (o stretch · meal_open:1 · meal_check:2)
 */
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env.cron');
const env = {};
try {
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch { /* sin .env.cron */ }

const BASE = 'https://wellness-app-jet-eta.vercel.app';
const ACTIVE_START = 7;   // ventana de pings de pausa (hora Madrid) — el endpoint decide
const ACTIVE_END = 22;

function madrid(part) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', [part]: '2-digit', hour12: false }).format(new Date()));
}

function hit(pathname, label) {
  https.get(`${BASE}${pathname}${pathname.includes('?') ? '&' : '?'}key=${env.STRETCH_CRON_SECRET}`, (res) => {
    let data = '';
    res.on('data', (c) => { data += c; });
    res.on('end', () => console.log(`[wellness-trigger] ${new Date().toISOString()} ${label} status=${res.statusCode} ${data}`));
  }).on('error', (e) => console.error(`[wellness-trigger] ${label} error:`, e.message));
}

function at(h, targetH, m, targetM) { return h === targetH && m >= targetM && m < targetM + 5; }

function main() {
  if (!env.STRETCH_CRON_SECRET) { console.error('[wellness-trigger] falta STRETCH_CRON_SECRET en .env.cron'); return; }

  // Modo test: `node stretch-trigger.js <trigger>` fuerza un disparo concreto.
  const force = process.argv[2];
  if (force) {
    if (force === 'stretch') return hit('/api/stretch-alert', 'stretch[TEST]');
    if (force === 'repesca') return hit('/api/push-trigger?type=repesca', 'repesca[TEST]');
    const mo = force.match(/^meal_(open|check):([0-3])$/);
    if (mo) return hit(`/api/push-trigger?type=meal_${mo[1]}&slot=${mo[2]}`, `${force}[TEST]`);
    return console.error(`[wellness-trigger] trigger desconocido: ${force}`);
  }

  const h = madrid('hour');
  const m = madrid('minute');

  // 1. Pausa activa — ping cada 5 min; el endpoint decide según el "modo trabajo"
  //    de Jan (cadencia real: 30 min desde su última pausa, no reloj de pared).
  if (h >= ACTIVE_START && h < ACTIVE_END) {
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

  // 4. Comidas — aviso de cierre (el SW lo silencia si la franja ya está registrada)
  if (at(h, 8, m, 30)) hit('/api/push-trigger?type=meal_check&slot=0', 'meal_check:0');
  if (at(h, 14, m, 30)) hit('/api/push-trigger?type=meal_check&slot=1', 'meal_check:1');
  if (at(h, 18, m, 0)) hit('/api/push-trigger?type=meal_check&slot=2', 'meal_check:2');
  if (at(h, 21, m, 0)) hit('/api/push-trigger?type=meal_check&slot=3', 'meal_check:3');
}

main();
