// PRISMA — Objetivos y proyectos (estructura jerárquica)
import { apiGet, apiPost } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, abrirModal, cerrarModal, escapeHtml } from './ui.js';

let perfil = null;

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfil = await montarNav('proyectos.html');
  await cargar();
  document.getElementById('btn-nuevo-objetivo').addEventListener('click', () => abrirModalObjetivo());
}

async function cargar() {
  let objetivos;
  try {
    ({ objetivos } = await apiGet('/objetivos.php'));
  } catch (e) {
    toast('Error cargando objetivos: ' + e.message, 'error');
    return;
  }

  const cont = document.getElementById('lista-objetivos');
  if (!objetivos || objetivos.length === 0) {
    cont.innerHTML = `<div class="card empty-state"><div class="icon">🧭</div>Aún no tienes objetivos. Crea el primero.</div>`;
    return;
  }

  cont.innerHTML = objetivos.map(o => `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <div>
          <h3>🧭 ${escapeHtml(o.nombre)}</h3>
          <div class="subtitle" style="font-size:13px; color:var(--text-secondary); margin-top:2px;">${escapeHtml(o.descripcion || '')}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="badge badge-MEDIA">${o.estado}</span>
          <button class="btn btn-sm btn-nuevo-proyecto" data-objetivo="${o.id}">+ Proyecto</button>
        </div>
      </div>
      ${(o.proyectos || []).length === 0
        ? `<div class="empty-state" style="padding:16px;">Sin proyectos todavía</div>`
        : `<div class="grid grid-3">
            ${o.proyectos.map(p => {
              const total = Number(p.total_actividades) || 0;
              const completadas = Number(p.completadas) || 0;
              const pct = total ? Math.round((completadas / total) * 100) : 0;
              return `
                <div class="stat-tile">
                  <div style="font-weight:700; margin-bottom:4px;">${escapeHtml(p.nombre)}</div>
                  <div class="progress-track" style="margin:8px 0;"><div class="progress-fill" style="width:${pct}%"></div></div>
                  <div class="label">${completadas}/${total} actividades · ${p.estado}</div>
                </div>
              `;
            }).join('')}
          </div>`
      }
    </div>
  `).join('');

  cont.querySelectorAll('.btn-nuevo-proyecto').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProyecto(btn.dataset.objetivo));
  });
}

function abrirModalObjetivo() {
  abrirModal(`
    <div class="modal-header"><h3>Nuevo objetivo</h3></div>
    <form id="form-objetivo">
      <div class="field"><label>Nombre</label><input type="text" id="ob-nombre" required /></div>
      <div class="field"><label>Descripción</label><textarea id="ob-descripcion" rows="2"></textarea></div>
      <button type="submit" class="btn btn-primary" style="width:100%">Crear objetivo</button>
    </form>
  `);
  document.getElementById('form-objetivo').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('/objetivos.php', {
        accion: 'crear',
        nombre: document.getElementById('ob-nombre').value.trim(),
        descripcion: document.getElementById('ob-descripcion').value.trim() || null,
      });
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast('Objetivo creado', 'success');
    cargar();
  });
}

async function abrirModalProyecto(objetivoId) {
  let empresas = [];
  try {
    ({ empresas } = await apiGet('/empresas.php'));
  } catch { /* si falla, el selector queda vacío */ }
  empresas = (empresas || []).filter(e => Number(e.activa));

  abrirModal(`
    <div class="modal-header"><h3>Nuevo proyecto</h3></div>
    <form id="form-proyecto">
      <div class="field"><label>Nombre</label><input type="text" id="py-nombre" required /></div>
      <div class="field"><label>Descripción</label><textarea id="py-descripcion" rows="2"></textarea></div>
      <div class="field">
        <label>Empresa (opcional)</label>
        <select id="py-empresa">
          <option value="">— Sin empresa —</option>
          ${empresas.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('')}
        </select>
      </div>
      <div class="field-row">
        <div class="field"><label>Fecha inicio</label><input type="date" id="py-inicio" /></div>
        <div class="field"><label>Fecha fin</label><input type="date" id="py-fin" /></div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%">Crear proyecto</button>
    </form>
  `);
  document.getElementById('form-proyecto').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('/proyectos.php', {
        accion: 'crear',
        objetivo_id: objetivoId,
        nombre: document.getElementById('py-nombre').value.trim(),
        descripcion: document.getElementById('py-descripcion').value.trim() || null,
        empresa_id: document.getElementById('py-empresa').value || null,
        fecha_inicio: document.getElementById('py-inicio').value || null,
        fecha_fin: document.getElementById('py-fin').value || null,
      });
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast('Proyecto creado', 'success');
    cargar();
  });
}

init();
