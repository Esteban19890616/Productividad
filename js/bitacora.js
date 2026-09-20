// PRISMA — Visor de bitácora (solo lectura; los registros los crea el trigger de la BD)
import { apiGet } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast } from './ui.js';

const ACCION_LABEL = { INSERT: '➕ Creó', UPDATE: '✏️ Editó', DELETE: '🗑️ Eliminó' };

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  await montarNav('bitacora.html');

  let data;
  try {
    ({ bitacora: data } = await apiGet('/bitacora.php'));
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }

  const cont = document.getElementById('lista-bitacora');
  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state">Aún no hay actividad registrada</div>`;
    return;
  }

  cont.innerHTML = data.map(r => {
    const registro = r.datos_nuevos || r.datos_anteriores;
    const nombre = registro?.titulo || registro?.nombre || r.registro_id;
    return `
      <div class="activity-row">
        <div style="flex:1">
          <div class="title">${ACCION_LABEL[r.accion] || r.accion} <strong>${r.tabla}</strong>: ${nombre ?? ''}</div>
          <div class="meta">${r.usuario_nombre || 'Sistema'} · ${new Date(r.created_at).toLocaleString('es-CO')}</div>
        </div>
      </div>
    `;
  }).join('');
}

init();
