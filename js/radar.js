// PRISMA — Radar de pendientes: detección continua de situaciones que requieren atención
import { apiGet } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, formatearFecha, escapeHtml } from './ui.js';

const ETIQUETAS = {
  VENCIDA: { icon: '🔴', label: 'Vencida', clase: 'CRITICA' },
  PROXIMA_A_VENCER: { icon: '🟠', label: 'Próxima a vencer', clase: 'ALTA' },
  BLOQUEADA: { icon: '🟣', label: 'Bloqueada', clase: 'MEDIA' },
  ESTANCADA: { icon: '🔵', label: 'Estancada (5+ días sin avance)', clase: 'BAJA' },
};

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  await montarNav('radar.html');

  let data;
  try {
    ({ radar: data } = await apiGet('/radar.php'));
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }

  document.getElementById('resumen-radar').textContent =
    data.length > 0 ? `⚠️ ${data.length} situación(es) requieren atención` : 'Todo en orden, sin alertas activas';

  const cont = document.getElementById('lista-radar');
  if (data.length === 0) {
    cont.innerHTML = `<div class="card empty-state"><div class="icon">✅</div>No hay situaciones pendientes por revisar</div>`;
    return;
  }

  cont.innerHTML = data.map((item, i) => {
    const e = ETIQUETAS[item.situacion] || { icon: '⚫', label: item.situacion, clase: 'MEDIA' };
    return `
      <div class="card" style="margin-bottom:10px; display:flex; align-items:center; gap:14px;">
        <span style="font-size:20px;">${e.icon}</span>
        <div style="flex:1">
          <div style="font-weight:600;">${i + 1}. ${escapeHtml(item.titulo)}</div>
          <div class="meta" style="color:var(--text-muted); font-size:13px; margin-top:2px;">
            ${item.responsable_nombre ? escapeHtml(item.responsable_nombre) + ' · ' : ''}Vence ${formatearFecha(item.fecha_limite)}
          </div>
        </div>
        <span class="badge badge-${e.clase}">${e.label}</span>
      </div>
    `;
  }).join('');
}

init();
