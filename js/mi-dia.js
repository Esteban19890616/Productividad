// PRISMA — Lógica de "Mi día"
import { apiGet, apiPost } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import {
  toast, abrirModal, cerrarModal, formatearFecha, formatearMinutos, escapeHtml, opcionesTipoActividad, iconoTipo,
  htmlEvidencias, cargarListaEvidencias, activarSubidaEvidencias,
  htmlSubtareas, cargarListaSubtareas, activarAltaSubtareas,
  htmlObservaciones, cargarListaObservaciones, activarAltaObservaciones,
} from './ui.js';

const HOY = new Date().toISOString().slice(0, 10);

let perfil = null;
let misActividades = [];

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfil = await montarNav('mi-dia.html');
  await cargarTodo();

  // Sin WebSockets en este backend: refresca cada 30s para reflejar cambios de otras personas.
  setInterval(cargarTodo, 30000);

  document.getElementById('btn-nueva-actividad').addEventListener('click', () => abrirModalNuevaActividad());
}

async function cargarTodo() {
  let todas;
  try {
    ({ actividades: todas } = await apiGet('/actividades.php'));
  } catch (e) {
    toast('Error cargando actividades: ' + e.message, 'error');
    return;
  }

  misActividades = todas.filter(a => a.responsable_id === perfil.id);
  const pendientes = misActividades.filter(a => !['COMPLETADA', 'CANCELADA'].includes(a.estado));

  const vencidas = pendientes.filter(a => a.dias_restantes < 0);
  const proximas = pendientes.filter(a => a.dias_restantes >= 0 && a.dias_restantes <= 2);
  const programadasHoy = pendientes.filter(a => a.fecha_limite === HOY && a.dias_restantes > 2);

  renderLista('lista-urgentes', 'count-urgentes', vencidas, true);
  renderLista('lista-proximas', 'count-proximas', proximas, false);
  renderLista('lista-hoy', 'count-hoy', programadasHoy, false);

  const completadasHoy = misActividades.filter(a => a.estado === 'COMPLETADA' && (a.completada_at || '').slice(0, 10) === HOY).length;

  document.getElementById('stat-pendientes').textContent = pendientes.length;
  document.getElementById('stat-vencidas').textContent = vencidas.length;
  document.getElementById('stat-completadas').textContent = completadasHoy;

  const minutosHoy = pendientes
    .filter(a => a.fecha_limite === HOY)
    .reduce((sum, a) => sum + (a.tiempo_estimado_min || 0), 0);
  const horasDisponibles = Number(perfil.horas_disponibles_dia || 8);
  const minutosDisponibles = horasDisponibles * 60;
  const porcentaje = minutosDisponibles > 0 ? Math.round((minutosHoy / minutosDisponibles) * 100) : 0;

  document.getElementById('stat-carga').textContent = porcentaje + '%';
  const barra = document.getElementById('barra-carga');
  barra.style.width = Math.min(porcentaje, 100) + '%';
  barra.classList.toggle('over', porcentaje > 100);

  const actividadesHoy = pendientes.filter(a => a.fecha_limite === HOY);
  const resumen = document.getElementById('resumen-dia');
  if (minutosDisponibles === 0) {
    resumen.textContent = `Tienes ${actividadesHoy.length} actividades para hoy.`;
  } else if (minutosHoy > minutosDisponibles) {
    const exceso = minutosHoy - minutosDisponibles;
    const trasladables = Math.ceil(exceso / 60);
    resumen.textContent = `Tienes ${formatearMinutos(minutosDisponibles)} disponibles hoy y ${formatearMinutos(minutosHoy)} de actividades. Considera trasladar ~${trasladables} actividad(es).`;
  } else {
    resumen.textContent = `Tienes ${formatearMinutos(minutosDisponibles)} disponibles hoy y ${formatearMinutos(minutosHoy)} de actividades. Vas bien.`;
  }

  await cargarReuniones();
}

async function cargarReuniones() {
  const inicioHoy = HOY + ' 00:00:00';
  const finHoy = HOY + ' 23:59:59';

  let data = [];
  try {
    ({ reuniones: data } = await apiGet('/reuniones.php', { desde: inicioHoy, hasta: finHoy }));
  } catch { /* si falla, se muestra como "sin reuniones" */ }

  const cont = document.getElementById('lista-reuniones');
  const count = document.getElementById('count-reuniones');
  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">📅</div>Sin reuniones para hoy</div>`;
    count.textContent = '0';
    return;
  }
  count.textContent = data.length;
  cont.innerHTML = data.map(r => `
    <div class="activity-row">
      <div>
        <div class="title">${escapeHtml(r.titulo)}</div>
        <div class="meta">${new Date(r.fecha_inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} · ${(r.participantes || []).join(', ') || 'Sin participantes'}</div>
      </div>
    </div>
  `).join('');
}

function renderLista(idLista, idCount, items, permitirReprogramar) {
  const cont = document.getElementById(idLista);
  document.getElementById(idCount).textContent = items.length;

  if (items.length === 0) {
    cont.innerHTML = `<div class="empty-state"><div class="icon">✨</div>Nada por aquí</div>`;
    return;
  }

  cont.innerHTML = items.map(a => `
    <div class="activity-row" data-id="${a.id}">
      <span title="${a.tipo}">${iconoTipo(a.tipo)}</span>
      <div style="flex:1">
        <div class="title">${escapeHtml(a.titulo)}</div>
        <div class="meta">
          ${a.proyecto_nombre ? escapeHtml(a.proyecto_nombre) + ' · ' : ''}
          Vence ${formatearFecha(a.fecha_limite)} · ${formatearMinutos(a.tiempo_estimado_min)}
          ${a.dias_retraso > 0 ? ` · ${a.dias_retraso}d de retraso` : ''}
        </div>
      </div>
      <span class="badge badge-${a.prioridad_etiqueta}">${a.prioridad_etiqueta}</span>
      <button class="btn btn-sm btn-completar" data-id="${a.id}" data-titulo="${escapeHtml(a.titulo)}">✓</button>
      ${permitirReprogramar ? `<button class="btn btn-sm btn-reprogramar" data-id="${a.id}" data-titulo="${escapeHtml(a.titulo)}" data-min="${a.tiempo_estimado_min}">↻ Reprogramar</button>` : ''}
    </div>
  `).join('');

  cont.querySelectorAll('.btn-completar').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); abrirModalCompletar(btn.dataset.id, btn.dataset.titulo); });
  });
  cont.querySelectorAll('.btn-reprogramar').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirModalReprogramar(btn.dataset.id, btn.dataset.titulo, Number(btn.dataset.min));
    });
  });
}

function abrirModalCompletar(id, titulo) {
  abrirModal(`
    <div class="modal-header"><h3>Completar: ${escapeHtml(titulo)}</h3></div>
    <p style="color:var(--text-secondary); font-size:14px; margin-bottom:12px;">
      Puedes adjuntar evidencia de que se ejecutó (opcional).
    </p>
    ${htmlSubtareas('completar-sub')}
    ${htmlEvidencias('completar-evidencia')}
    ${htmlObservaciones('completar-obs')}
    <button type="button" class="btn btn-primary" style="width:100%" id="btn-confirmar-completar">Marcar como completada</button>
  `);

  cargarListaSubtareas('completar-sub', id);
  activarAltaSubtareas('completar-sub', id);
  cargarListaEvidencias('completar-evidencia', id);
  activarSubidaEvidencias('completar-evidencia', id);
  cargarListaObservaciones('completar-obs', id);
  activarAltaObservaciones('completar-obs', id);

  document.getElementById('btn-confirmar-completar').addEventListener('click', async () => {
    try {
      await apiPost('/actividades.php', { accion: 'completar', id });
    } catch (e) {
      toast('Error: ' + e.message, 'error');
      return;
    }
    cerrarModal();
    toast('Actividad completada', 'success');
    cargarTodo();
  });
}

// ---------------- Reprogramación automática ----------------
function abrirModalReprogramar(actividadId, titulo, minutosEstimados) {
  const opciones = calcularOpcionesReprogramacion();
  abrirModal(`
    <div class="modal-header"><h3>Reprogramar: ${escapeHtml(titulo)}</h3></div>
    <p style="color:var(--text-secondary); font-size:14px; margin-bottom:16px;">Esta actividad quedó pendiente. Elige dónde ubicarla sin sobrecargar tu agenda:</p>
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${opciones.map((op, i) => `
        <button class="btn" style="justify-content:space-between;" data-fecha="${op.fecha}">
          <span>Opción ${String.fromCharCode(65 + i)}: ${formatearFecha(op.fecha)}</span>
          <span style="color:var(--text-muted); font-size:12px;">carga actual ${op.porcentaje}%</span>
        </button>
      `).join('')}
      <button class="btn" id="btn-dividir">Dividir en 3 bloques</button>
    </div>
  `);

  document.querySelectorAll('[data-fecha]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await apiPost('/actividades.php', { accion: 'actualizar', id: actividadId, fecha_limite: btn.dataset.fecha });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
        return;
      }
      cerrarModal();
      toast('Actividad reprogramada', 'success');
      cargarTodo();
    });
  });

  document.getElementById('btn-dividir').addEventListener('click', async () => {
    const titulos = [1, 2, 3].map(n => `Parte ${n}/3 — ${titulo}`);
    try {
      await apiPost('/subactividades.php', { accion: 'crear_multiples', actividad_id: actividadId, titulos });
      await apiPost('/actividades.php', { accion: 'actualizar', id: actividadId, estado: 'EN_PROGRESO' });
    } catch (e) {
      toast('Error al dividir: ' + e.message, 'error');
      return;
    }
    cerrarModal();
    toast('Actividad dividida en 3 subactividades', 'success');
    cargarTodo();
  });
}

function calcularOpcionesReprogramacion() {
  const horasDisponibles = Number(perfil.horas_disponibles_dia || 8);
  const minutosDisponibles = horasDisponibles * 60;
  const candidatas = [];
  for (let i = 1; i <= 7 && candidatas.length < 3; i++) {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + i);
    if (fecha.getDay() === 0 || fecha.getDay() === 6) continue; // salta fines de semana
    const fechaStr = fecha.toISOString().slice(0, 10);

    const minutosOcupados = misActividades
      .filter(a => !['COMPLETADA', 'CANCELADA'].includes(a.estado) && a.fecha_limite === fechaStr)
      .reduce((s, a) => s + (a.tiempo_estimado_min || 0), 0);
    const porcentaje = minutosDisponibles > 0 ? Math.round((minutosOcupados / minutosDisponibles) * 100) : 0;
    candidatas.push({ fecha: fechaStr, porcentaje });
  }
  return candidatas.sort((a, b) => a.porcentaje - b.porcentaje).slice(0, 3);
}

// ---------------- Nueva actividad ----------------
async function abrirModalNuevaActividad() {
  let usuarios = [], empresas = [];
  try {
    [{ usuarios }, { empresas }] = await Promise.all([apiGet('/usuarios.php'), apiGet('/empresas.php')]);
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }
  empresas = (empresas || []).filter(e => Number(e.activa));

  abrirModal(`
    <div class="modal-header"><h3>Nueva actividad</h3></div>
    <form id="form-nueva-actividad">
      <div class="field">
        <label>Título</label>
        <input type="text" id="na-titulo" required />
      </div>
      <div class="field">
        <label>Descripción</label>
        <textarea id="na-descripcion" rows="2"></textarea>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Responsable</label>
          <select id="na-responsable">
            ${usuarios.map(u => `<option value="${u.id}" ${u.id === perfil.id ? 'selected' : ''}>${escapeHtml(u.nombre_completo)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Empresa (opcional)</label>
          <select id="na-empresa">
            <option value="">— Sin empresa —</option>
            ${empresas.map(e => `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Tipo de actividad</label>
          <select id="na-tipo">${opcionesTipoActividad('TAREA')}</select>
        </div>
        <div class="field">
          <label>Fecha límite</label>
          <input type="date" id="na-fecha" required value="${HOY}" />
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Tiempo estimado (min)</label>
          <input type="number" id="na-tiempo" value="30" min="5" />
        </div>
        <div class="field">
          <label>Importancia (1-5)</label>
          <input type="number" id="na-importancia" value="3" min="1" max="5" />
        </div>
        <div class="field">
          <label>Impacto (1-5)</label>
          <input type="number" id="na-impacto" value="3" min="1" max="5" />
        </div>
      </div>
      <button type="submit" class="btn btn-primary" style="width:100%">Crear actividad</button>
    </form>
  `);

  document.getElementById('form-nueva-actividad').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await apiPost('/actividades.php', {
        accion: 'crear',
        titulo: document.getElementById('na-titulo').value.trim(),
        descripcion: document.getElementById('na-descripcion').value.trim() || null,
        responsable_id: document.getElementById('na-responsable').value,
        empresa_id: document.getElementById('na-empresa').value || null,
        tipo: document.getElementById('na-tipo').value,
        fecha_limite: document.getElementById('na-fecha').value,
        tiempo_estimado_min: Number(document.getElementById('na-tiempo').value),
        importancia: Number(document.getElementById('na-importancia').value),
        impacto: Number(document.getElementById('na-impacto').value),
      });
    } catch (err) {
      toast('Error creando actividad: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast('Actividad creada', 'success');
    cargarTodo();
  });
}

init();
