# App Wellness — Spec de integraciones (orden de Jan 2026-07-16)

> **Estado**: el código de la app vive en el Mac de Jan (tarea t_well01: subirlo al servidor). Este spec queda listo para implementar en cuanto el repo aterrice aquí. Asunción: app iOS nativa (SwiftUI) — si no, avisar y se adapta.

---

## 1. Timer cada 30 min — estiramientos obligatorios con bloqueo

**Realidad iOS primero (no prometer lo imposible):** ninguna app puede bloquear la pantalla del sistema iOS. Lo máximo legal y real es el mecanismo que ya dominamos de VEDA Escudo: **Family Controls + ManagedSettings shield** — la app bloquea las DEMÁS apps (todas las categorías elegidas) hasta que marques la rutina como hecha. En la práctica: el móvil queda inservible salvo para hacer los estiramientos → es el "obligatorio" real que existe en iOS.

**Mecánica:**
- `DeviceActivitySchedule` repetido :00/:30 dentro de la ventana activa (por defecto 09:00-21:00, configurable, con pausa manual "reunión").
- Al disparar: notificación time-sensitive + shield de ManagedSettings sobre las categorías configuradas.
- El shield cae SOLO al completar el check-in de la rutina en la app (checklist con timer por ejercicio).
- Registro: streak diario + % cumplimiento (dato para los recordatorios del punto 3).

**Rutina de 30 min (dictamen mío — escritorio/espalda, ~4 min, sin material):**
| # | Ejercicio | Dosis | Por qué |
|---|---|---|---|
| 1 | Chin tucks de pie | 10 reps | Descarga cervical por postura de pantalla |
| 2 | Extensión torácica manos en nuca (de pie, mirando techo) | 8 reps | Revierte la flexión torácica de silla — clave espalda |
| 3 | Cat-camel de pie (manos en muslos) | 10 reps | Moviliza toda la columna sin suelo |
| 4 | Estiramiento pectoral en marco de puerta | 30 s/lado | Abre el cierre de hombros |
| 5 | Zancada de flexor de cadera + alcance arriba | 30 s/lado | Psoas acortado por sedestación = tirón lumbar |

## 2. Rutina de movilización matinal (en ayunas)

**Realidad iOS:** no existe API pública de "primer desbloqueo del día". Implementación en dos capas:
1. **Notificación** time-sensitive a la hora de despertar (rango configurable, p.ej. 07:00) con la rutina como attachment (imagen/vídeo) y deep-link a "modo guiado".
2. **Refuerzo Atajos**: automatización personal "Cuando se detiene la alarma → abrir wellness://rutina-manana". Esto sí dispara con el despertar real. La app expone el URL scheme; el atajo lo montas tú en 1 min (te paso los pasos cuando esté implementado).

**Contenido:** los ejercicios del vídeo que Jan pasará — ⛔ BLOQUEADO hasta recibir el vídeo. Tabla a rellenar (ejercicio · dosis · timestamp del vídeo · nota de ejecución). Marcado "en ayunas" en la card.

## 3. Recordatorios de pendientes — espalda primero

- Motor de deuda: toda rutina no completada (bloques de 30', matinal) se apila en una cola diaria.
- Notificaciones de repesca: 12:00 · 17:00 · 20:30 con lo pendiente.
- Orden de la cola: ejercicios de espalda SIEMPRE arriba (peso 2×: extensión torácica, cat-camel, movilidad lumbar del vídeo matinal). Copy de la notificación nombra primero la espalda ("Te queda: extensión torácica + 2 más").
- La deuda muere a las 23:00 (no arrastrar culpa al día siguiente; el streak refleja el % del día).

## 4. Comidas — franjas + notificaciones + fotos

**Franjas por defecto (ajustables en Settings):**
| Comida | Franja | Notificación |
|---|---|---|
| Desayuno | 07:30–09:00 | Al inicio de franja (tras rutina matinal — en ayunas primero, luego desayuno) |
| Comida | 13:30–14:30 | Al inicio; repesca al cierre si no marcada |
| Merienda | 17:30–18:00 | Al inicio |
| Cena | 20:30–21:30 | Al inicio; repesca al cierre |

- Cada notificación lleva **la foto del plato** como attachment (UNNotificationAttachment) + qué toca comer.
- ⛔ BLOQUEADO — contexto de las fotos: la "foto del desayuno" que menciona Jan NO está en el servidor (buscado en PROJECTS y Mastermind). Necesito: la dieta/plan de comidas y la foto de referencia del desayuno (o dónde vive ese contexto — ¿sesión del Mac?). En cuanto llegue: set homogéneo de fotos por comida con Higgsfield (misma estética: luz natural, plato centrado, fondo neutro cream) — mismo método que heroes Averon.

---

## Permisos/entitlements que pedirá la app
Family Controls (bloqueo) · Notificaciones (time-sensitive) · opcional HealthKit (lectura sueño, fase 2).

## Pendiente de Jan (bloqueantes)
1. Subir el código de la app al servidor (t_well01) — sin esto no se implementa nada.
2. Vídeo de movilización matinal → relleno la tabla del punto 2.
3. Dieta + foto del desayuno (o decirme dónde está ese contexto) → genero el set de fotos de comidas.
