// PRISMA — Módulo de informes: resumen de actividad por periodo,
// desglose por proyecto, empresa y persona, exportable a CSV y a PDF (impresión).
import { apiGet } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, formatearFecha, formatearMinutos, escapeHtml } from './ui.js';

let perfil = null;
let filasInforme = [];

function primerDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function hoyIso() {
  return new Date().toISOString().slice(0, 10);
}

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfil = await montarNav('informes.html');

  document.getElementById('f-desde').value = primerDiaMes();
  document.getElementById('f-hasta').value = hoyIso();

  if (perfil.rol === 'ADMINISTRADOR') {
    document.getElementById('campo-responsable').classList.remove('hidden');
    try {
      const { usuarios } = await apiGet('/usuarios.php');
      const sel = document.getElementById('f-responsable');
      (usuarios || []).forEach(u => {
        sel.insertAdjacentHTML('beforeend', `<option value="${u.id}">${escapeHtml(u.nombre_completo)}</option>`);
      });
    } catch { /* opcional */ }
  }

  try {
    const { empresas } = await apiGet('/empresas.php');
    const selEmpresa = document.getElementById('f-empresa');
    (empresas || []).forEach(e => {
      selEmpresa.insertAdjacentHTML('beforeend', `<option value="${e.id}">${escapeHtml(e.nombre)}</option>`);
    });
  } catch { /* opcional */ }

  document.getElementById('form-filtros').addEventListener('submit', (e) => { e.preventDefault(); generar(); });
  document.getElementById('btn-csv').addEventListener('click', descargarCsv);
  document.getElementById('btn-imprimir').addEventListener('click', () => window.print());

  await generar();
}

async function generar() {
  const desde = document.getElementById('f-desde').value;
  const hasta = document.getElementById('f-hasta').value;
  const responsableId = document.getElementById('f-responsable')?.value || '';
  const empresaId = document.getElementById('f-empresa').value || '';

  if (!desde || !hasta) return;

  const cont = document.getElementById('resultado-informe');
  cont.innerHTML = `<div class="skeleton" style="height:120px;"></div>`;

  try {
    const params = { desde, hasta };
    if (responsableId) params.responsable_id = responsableId;
    if (empresaId) params.empresa_id = empresaId;
    ({ actividades: filasInforme } = await apiGet('/informes.php', params));
  } catch (e) {
    cont.innerHTML = `<div class="empty-state">Error: ${escapeHtml(e.message)}</div>`;
    return;
  }

  render(desde, hasta);
}

function render(desde, hasta) {
  const cont = document.getElementById('resultado-informe');

  if (filasInforme.length === 0) {
    cont.innerHTML = `<div class="empty-state">📭 No hay actividades con fecha límite en ese periodo.</div>`;
    return;
  }

  const total = filasInforme.length;
  const completadas = filasInforme.filter(a => a.estado === 'COMPLETADA');
  const canceladas = filasInforme.filter(a => a.estado === 'CANCELADA');
  const vencidas = filasInforme.filter(a => a.estado !== 'COMPLETADA' && a.estado !== 'CANCELADA' && a.dias_retraso > 0);
  const enCurso = total - completadas.length - canceladas.length - vencidas.length;
  const cumplimiento = total > 0 ? Math.round((completadas.length / (total - canceladas.length || 1)) * 100) : 0;
  const minutosInvertidos = completadas.reduce((acc, a) => acc + (a.tiempo_estimado_min || 0), 0);

  // Desglose por proyecto
  const porProyecto = {};
  filasInforme.forEach(a => {
    const clave = a.proyecto_nombre || 'Sin proyecto';
    porProyecto[clave] ??= { total: 0, completadas: 0 };
    porProyecto[clave].total++;
    if (a.estado === 'COMPLETADA') porProyecto[clave].completadas++;
  });

  // Desglose por empresa
  const porEmpresa = {};
  filasInforme.forEach(a => {
    const clave = a.empresa_nombre || 'Sin empresa';
    porEmpresa[clave] ??= { total: 0, completadas: 0, color: a.empresa_color || 'var(--text-muted)' };
    porEmpresa[clave].total++;
    if (a.estado === 'COMPLETADA') porEmpresa[clave].completadas++;
  });

  // Desglose por persona (solo admin)
  let bloquePersonas = '';
  if (perfil.rol === 'ADMINISTRADOR') {
    const porPersona = {};
    filasInforme.forEach(a => {
      const clave = a.responsable_nombre || 'Sin asignar';
      porPersona[clave] ??= { total: 0, completadas: 0, vencidas: 0 };
      porPersona[clave].total++;
      if (a.estado === 'COMPLETADA') porPersona[clave].completadas++;
      if (a.estado !== 'COMPLETADA' && a.estado !== 'CANCELADA' && a.dias_retraso > 0) porPersona[clave].vencidas++;
    });
    bloquePersonas = `
      <div class="card" style="margin-bottom:18px;">
        <div class="card-header"><h3>Desglose por persona</h3></div>
        ${Object.entries(porPersona).map(([nombre, s]) => `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
              <span>${escapeHtml(nombre)}</span>
              <span style="color:var(--text-muted);">${s.completadas}/${s.total} completadas ${s.vencidas ? `· <span style="color:var(--critica);">${s.vencidas} vencidas</span>` : ''}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${s.total ? (s.completadas / s.total) * 100 : 0}%"></div></div>
          </div>
        `).join('')}
      </div>
    `;
  }

  cont.innerHTML = `
    <div class="grid grid-4" style="margin-bottom:18px;">
      <div class="stat-tile"><div class="value">${total}</div><div class="label">Actividades en el periodo</div></div>
      <div class="stat-tile"><div class="value">${completadas.length}</div><div class="label">Completadas</div></div>
      <div class="stat-tile"><div class="value" style="color:${vencidas.length ? 'var(--critica)' : 'inherit'}">${vencidas.length}</div><div class="label">Vencidas sin completar</div></div>
      <div class="stat-tile"><div class="value">${cumplimiento}%</div><div class="label">Cumplimiento</div></div>
    </div>

    <div class="grid grid-3" style="margin-bottom:18px;">
      <div class="card">
        <div class="card-header"><h3>Desglose por proyecto</h3></div>
        ${Object.entries(porProyecto).map(([nombre, s]) => `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px;">
              <span>${escapeHtml(nombre)}</span>
              <span style="color:var(--text-muted);">${s.completadas}/${s.total}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${s.total ? (s.completadas / s.total) * 100 : 0}%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><h3>Desglose por empresa</h3></div>
        ${Object.entries(porEmpresa).map(([nombre, s]) => `
          <div style="margin-bottom:14px;">
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:13px; margin-bottom:6px;">
              <span style="display:flex; align-items:center; gap:6px;">
                <span style="width:9px;height:9px;border-radius:3px;background:${s.color};display:inline-block;"></span>
                ${escapeHtml(nombre)}
              </span>
              <span style="color:var(--text-muted);">${s.completadas}/${s.total}</span>
            </div>
            <div class="progress-track"><div class="progress-fill" style="width:${s.total ? (s.completadas / s.total) * 100 : 0}%"></div></div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><h3>Tiempo invertido</h3></div>
        <div class="stat-tile" style="margin-bottom:10px;">
          <div class="value">${formatearMinutos(minutosInvertidos)}</div>
          <div class="label">En actividades completadas del periodo</div>
        </div>
        <div style="font-size:13px; color:var(--text-secondary);">
          ${enCurso} actividad(es) todavía en progreso o pendientes dentro del rango.
        </div>
      </div>
    </div>

    ${bloquePersonas}

    <div class="card">
      <div class="card-header">
        <h3>Detalle de actividades</h3>
        <span class="count">${desde} → ${hasta}</span>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; color:var(--text-muted); font-size:11px; text-transform:uppercase;">
              <th style="padding:8px;">Actividad</th>
              <th style="padding:8px;">Proyecto</th>
              <th style="padding:8px;">Empresa</th>
              <th style="padding:8px;">Responsable</th>
              <th style="padding:8px;">Fecha límite</th>
              <th style="padding:8px;">Estado</th>
              <th style="padding:8px;">Prioridad</th>
              <th style="padding:8px;">Evidencias</th>
            </tr>
          </thead>
          <tbody>
            ${filasInforme.map(a => `
              <tr style="border-top:1px solid var(--border);">
                <td style="padding:8px;">${escapeHtml(a.titulo)}</td>
                <td style="padding:8px;">${escapeHtml(a.proyecto_nombre || '—')}</td>
                <td style="padding:8px;">${escapeHtml(a.empresa_nombre || '—')}</td>
                <td style="padding:8px;">${escapeHtml(a.responsable_nombre || '—')}</td>
                <td style="padding:8px;">${formatearFecha(a.fecha_limite)}</td>
                <td style="padding:8px;">${a.estado}</td>
                <td style="padding:8px;">${a.prioridad_etiqueta !== 'N/A' ? `<span class="badge badge-${a.prioridad_etiqueta}">${a.prioridad_etiqueta}</span>` : '—'}</td>
                <td style="padding:8px;">${renderEvidenciasInforme(a.evidencias)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderEvidenciasInforme(evidencias) {
  if (!evidencias || evidencias.length === 0) return '<span style="color:var(--text-muted);">—</span>';
  return `<div style="display:flex; gap:4px; flex-wrap:wrap;">${evidencias.map(d => {
    const esImagen = d.tipo.startsWith('image/');
    return esImagen
      ? `<a href="../${d.ruta_archivo}" target="_blank"><img src="../${d.ruta_archivo}" style="width:32px;height:32px;object-fit:cover;border-radius:4px;" title="${escapeHtml(d.nombre)}" /></a>`
      : `<a href="../${d.ruta_archivo}" target="_blank" title="${escapeHtml(d.nombre)}" style="font-size:18px;">📄</a>`;
  }).join('')}</div>`;
}

function descargarCsv() {
  if (filasInforme.length === 0) { toast('No hay datos para exportar', 'error'); return; }

  const encabezados = ['Actividad', 'Proyecto', 'Empresa', 'Responsable', 'Fecha límite', 'Estado', 'Prioridad', 'Tiempo estimado (min)', 'Evidencias'];
  const filas = filasInforme.map(a => [
    a.titulo, a.proyecto_nombre || '', a.empresa_nombre || '', a.responsable_nombre || '', a.fecha_limite, a.estado,
    a.prioridad_etiqueta, a.tiempo_estimado_min, (a.evidencias || []).length,
  ]);

  const escaparCelda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [encabezados, ...filas].map(fila => fila.map(escaparCelda).join(',')).join('\r\n');

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prisma-informe-${document.getElementById('f-desde').value}_a_${document.getElementById('f-hasta').value}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

init();
