// PRISMA — Listado y gestión completa de actividades
import { apiGet, apiPost } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import {
  toast, abrirModal, cerrarModal, formatearFecha, formatearMinutos, escapeHtml, opcionesTipoActividad, iconoTipo,
  htmlEvidencias, cargarListaEvidencias, activarSubidaEvidencias,
  htmlSubtareas, cargarListaSubtareas, activarAltaSubtareas,
  htmlObservaciones, cargarListaObservaciones, activarAltaObservaciones,
} from './ui.js';

let perfil = null;
let cache = [];

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfil = await montarNav('actividades.html');
  await cargar();

  document.getElementById('btn-nueva').addEventListener('click', () => abrirModalActividad());
  document.getElementById('f-estado').addEventListener('change', render);
  document.getElementById('f-orden').addEventListener('change', render);
  document.getElementById('f-buscar').addEventListener('input', render);
  document.getElementById('f-tipo').addEventListener('change', render);

  // Sin WebSockets en este backend: refresca cada 30s para reflejar cambios de otras personas.
  setInterval(cargar, 30000);
}

async function cargar() {
  let data;
  try {
    ({ actividades: data } = await apiGet('/actividades.php'));
  } catch (e) {
    toast('Error cargando actividades: ' + e.message, 'error');
    return;
  }
  cache = data || [];
  render();
}

function render() {
  const estado = document.getElementById('f-estado').value;
  const orden = document.getElementById('f-orden').value;
  const tipo = document.getElementById('f-tipo').value;
  const busqueda = document.getElementById('f-buscar').value.toLowerCase();

  let items = cache.filter(a =>
    (!estado || a.estado === estado) &&
    (!tipo || a.tipo === tipo) &&
    (!busqueda || a.titulo.toLowerCase().includes(busqueda))
  );

  items = orden === 'fecha'
    ? [...items].sort((a, b) => (a.fecha_limite || '').localeCompare(b.fecha_limite || ''))
    : [...items].sort((a, b) => b.prioridad_puntuacion - a.prioridad_puntuacion);

  const cont = document.getElementById('tabla-actividades');
  if (items.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">📭</div>No hay actividades con estos filtros</div>`;
    return;
  }

  cont.innerHTML = items.map(a => `
    <div class="activity-row" data-id="${a.id}">
      <span title="${a.tipo}">${iconoTipo(a.tipo)}</span>
      <div style="flex:1">
        <div class="title">${escapeHtml(a.titulo)}</div>
        <div class="meta">
          ${a.responsable_nombre ? escapeHtml(a.responsable_nombre) + ' · ' : ''}
          Vence ${formatearFecha(a.fecha_limite)} · ${formatearMinutos(a.tiempo_estimado_min)} · ${a.estado}
        </div>
      </div>
      ${a.prioridad_etiqueta !== 'N/A' ? `<span class="badge badge-${a.prioridad_etiqueta}">${a.prioridad_etiqueta}</span>` : ''}
      <button class="btn btn-sm btn-editar" data-id="${a.id}">Editar</button>
    </div>
  `).join('');

  cont.querySelectorAll('.btn-editar').forEach(btn => {
    btn.addEventListener('click', () => abrirModalActividad(cache.find(a => a.id === btn.dataset.id)));
  });
}

async function abrirModalActividad(actividad = null) {
  let usuarios = [], empresas = [];
  try {
    [{ usuarios }, { empresas }] = await Promise.all([apiGet('/usuarios.php'), apiGet('/empresas.php')]);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }
  empresas = (empresas || []).filter(e => Number(e.activa));
  const esEdicion = !!actividad;

  abrirModal(`
    <div class="modal-header"><h3>${esEdicion ? 'Editar' : 'Nueva'} actividad</h3></div>
    <form id="form-actividad">
      <div class="field">
        <label>Título</label>
        <input type="text" id="fa-titulo" required value="${escapeHtml(actividad?.titulo || '')}" />
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea id="fa-descripcion" rows="2">${escapeHtml(actividad?.descripcion || '')}</textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Responsable</label>
          <select id="fa-responsable">
            ${usuarios.map(u => `<option value="${u.id}" ${u.id === (actividad?.responsable_id || perfil.id) ? 'selected' : ''}>${escapeHtml(u.nombre_completo)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Estado</label>
          <select id="fa-estado">
            ${['PENDIENTE', 'EN_PROGRESO', 'BLOQUEADA', 'COMPLETADA', 'CANCELADA'].map(s => `<option value="${s}" ${actividad?.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Fecha límite</label>
          <input type="date" id="fa-fecha" required value="${actividad?.fecha_limite || new Date().toISOString().slice(0, 10)}" />
        </div>
        <div class="field">
          <label>Tiempo estimado (min)</label>
          <input type="number" id="fa-tiempo" value="${actividad?.tiempo_estimado_min ?? 30}" min="5" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Empresa (opcional)</label>
          <select id="fa-empresa">
            <option value="">— Sin empresa —</option>
            ${empresas.map(e => `<option value="${e.id}" ${actividad?.empresa_id === e.id ? 'selected' : ''}>${escapeHtml(e.nombre)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Tipo de actividad</label>
          <select id="fa-tipo">${opcionesTipoActividad(actividad?.tipo || 'TAREA')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Importancia (1-5)</label>
          <input type="number" id="fa-importancia" value="${actividad?.importancia ?? 3}" min="1" max="5" />
        </div>
        <div class="field">
          <label>Impacto (1-5)</label>
          <input type="number" id="fa-impacto" value="${actividad?.impacto ?? 3}" min="1" max="5" />
        </div>
      </div>
      ${esEdicion ? htmlSubtareas('fa-sub') : ''}
      ${esEdicion ? htmlEvidencias('fa-evidencia') : ''}
      ${esEdicion ? htmlObservaciones('fa-obs') : ''}
      <div style="display:flex; gap:10px;">
        <button type="submit" class="btn btn-primary" style="flex:1">${esEdicion ? 'Guardar cambios' : 'Crear actividad'}</button>
        ${esEdicion ? `<button type="button" class="btn btn-danger" id="btn-eliminar">Eliminar</button>` : ''}
      </div>
    </form>
  `);

  if (esEdicion) {
    cargarListaSubtareas('fa-sub', actividad.id);
    activarAltaSubtareas('fa-sub', actividad.id);
    cargarListaEvidencias('fa-evidencia', actividad.id);
    activarSubidaEvidencias('fa-evidencia', actividad.id);
    cargarListaObservaciones('fa-obs', actividad.id);
    activarAltaObservaciones('fa-obs', actividad.id);
  }

  document.getElementById('form-actividad').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      accion: esEdicion ? 'actualizar' : 'crear',
      titulo: document.getElementById('fa-titulo').value.trim(),
      descripcion: document.getElementById('fa-descripcion').value.trim() || null,
      responsable_id: document.getElementById('fa-responsable').value,
      empresa_id: document.getElementById('fa-empresa').value || null,
      tipo: document.getElementById('fa-tipo').value,
      estado: document.getElementById('fa-estado').value,
      fecha_limite: document.getElementById('fa-fecha').value,
      tiempo_estimado_min: Number(document.getElementById('fa-tiempo').value),
      importancia: Number(document.getElementById('fa-importancia').value),
      impacto: Number(document.getElementById('fa-impacto').value),
    };
    if (esEdicion) {
      payload.id = actividad.id;
      payload.version = actividad.version;
    }

    try {
      await apiPost('/actividades.php', payload);
    } catch (err) {
      if (err.status === 409) {
        toast('Otra persona modificó esta actividad mientras tanto. Se recargó con los datos más recientes.', 'error');
        cargar();
        return;
      }
      toast('Error: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast(esEdicion ? 'Actividad actualizada' : 'Actividad creada', 'success');
    cargar();
  });

  document.getElementById('btn-eliminar')?.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta actividad? Quedará registrada en la bitácora.')) return;
    try {
      await apiPost('/actividades.php', { accion: 'eliminar', id: actividad.id });
    } catch (err) {
      toast('Error eliminando: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast('Actividad eliminada', 'success');
    cargar();
  });
}

init();
