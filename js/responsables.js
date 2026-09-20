// PRISMA — Centro de responsabilidades
import { apiGet } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, iniciales } from './ui.js';

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  await montarNav('responsables.html');

  let data;
  try {
    ({ responsables: data } = await apiGet('/responsables.php'));
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }

  const cont = document.getElementById('tabla-responsables');
  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state">Sin datos todavía</div>`;
    return;
  }

  cont.innerHTML = `
    <div style="overflow-x:auto;">
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="text-align:left; color:var(--text-muted); font-size:12px; text-transform:uppercase;">
          <th style="padding:10px;">Persona</th>
          <th style="padding:10px;">Pendientes</th>
          <th style="padding:10px;">Vencidos</th>
          <th style="padding:10px;">Hoy</th>
          <th style="padding:10px;">Próxima semana</th>
          <th style="padding:10px;"></th>
        </tr>
      </thead>
      <tbody>
        ${data.map(r => `
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px; display:flex; align-items:center; gap:10px;">
              <div class="avatar" style="width:28px;height:28px;font-size:11px;">${iniciales(r.nombre_completo)}</div>
              ${r.nombre_completo}
            </td>
            <td style="padding:10px;">${r.pendientes}</td>
            <td style="padding:10px;">
              ${r.vencidos > 0 ? `<span class="badge badge-CRITICA">${r.vencidos}</span>` : '0'}
            </td>
            <td style="padding:10px;">${r.hoy}</td>
            <td style="padding:10px;">${r.proxima_semana}</td>
            <td style="padding:10px; color:var(--text-muted); font-size:12px;">
              ${r.vencidos >= 3 ? `⚠️ ${r.vencidos} vencidos` : ''}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    </div>
  `;
}

init();
