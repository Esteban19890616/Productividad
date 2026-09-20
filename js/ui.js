// PRISMA — Utilidades de UI compartidas (toasts, modales, formateo)
import { apiGet, apiPost, apiUpload } from './api.js';

export function toast(mensaje, tipo = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = mensaje;
  if (tipo === 'error') el.style.borderColor = 'var(--critica)';
  if (tipo === 'success') el.style.borderColor = 'var(--baja)';
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function abrirModal(contenidoHtml) {
  cerrarModal();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal">${contenidoHtml}</div>`;
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) cerrarModal();
  });
  document.body.appendChild(backdrop);
  return backdrop;
}

export function cerrarModal() {
  document.getElementById('modal-backdrop')?.remove();
}

export function formatearFecha(fechaIso) {
  if (!fechaIso) return '—';
  const f = new Date(fechaIso + (fechaIso.length === 10 ? 'T00:00:00' : ''));
  return f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatearMinutos(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}

export function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
}

export const TIPOS_ACTIVIDAD = {
  TAREA: { icono: '📋', label: 'Tarea' },
  REUNION: { icono: '👥', label: 'Reunión' },
  CLASE: { icono: '🎓', label: 'Clase' },
  CAPACITACION: { icono: '🧑‍🏫', label: 'Capacitación' },
  LLAMADA: { icono: '📞', label: 'Llamada' },
  INSPECCION: { icono: '🔍', label: 'Inspección' },
  VISITA: { icono: '📍', label: 'Visita' },
  DOCUMENTO: { icono: '📄', label: 'Documento/Informe' },
  VIAJE: { icono: '🚗', label: 'Desplazamiento' },
  SEGUIMIENTO: { icono: '🔁', label: 'Seguimiento' },
  OTRO: { icono: '⚙️', label: 'Otro' },
};

export function opcionesTipoActividad(seleccionado = 'TAREA') {
  return Object.entries(TIPOS_ACTIVIDAD)
    .map(([valor, t]) => `<option value="${valor}" ${valor === seleccionado ? 'selected' : ''}>${t.icono} ${t.label}</option>`)
    .join('');
}

export function iconoTipo(tipo) {
  return TIPOS_ACTIVIDAD[tipo]?.icono || '📋';
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

/* =========================================================================
 * EVIDENCIAS (fotos/PDF adjuntas a una actividad)
 *
 * Un solo lugar para esta lógica: antes vivía duplicada en el modal de
 * "Editar actividad" y en el de "Completar actividad", y las dos copias se
 * fueron desincronizando (un arreglo en una no llegaba a la otra). Ambos
 * modales ahora llaman a estas mismas tres funciones.
 * ========================================================================= */

/** HTML del bloque (lista + input); insértalo en el modal y luego llama a
 *  cargarListaEvidencias() y activarSubidaEvidencias() con el mismo idPrefix. */
export function htmlEvidencias(idPrefix, etiqueta = 'Evidencias (fotos o PDF, máx. 4)') {
  return `
    <div class="field">
      <label>${etiqueta}</label>
      <div id="${idPrefix}-lista" style="margin-bottom:10px;"></div>
      <input type="file" id="${idPrefix}-input" accept="image/png,image/jpeg,image/webp,application/pdf" multiple />
    </div>
  `;
}

export async function cargarListaEvidencias(idPrefix, actividadId) {
  const cont = document.getElementById(`${idPrefix}-lista`);
  if (!cont) return;
  cont.innerHTML = `<div class="skeleton" style="height:24px;"></div>`;

  let documentos = [];
  try {
    ({ documentos } = await apiGet('/documentos.php', { actividad_id: actividadId }));
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--critica); font-size:13px;">Error: ${escapeHtml(e.message)}</div>`;
    return;
  }

  if (documentos.length === 0) {
    cont.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Sin evidencias todavía.</div>`;
    return;
  }

  cont.innerHTML = documentos.map(d => {
    const esImagen = d.tipo.startsWith('image/');
    return `
      <div style="display:flex; align-items:center; gap:10px; padding:6px 0;">
        ${esImagen
          ? `<a href="../${d.ruta_archivo}" target="_blank"><img src="../${d.ruta_archivo}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;" /></a>`
          : `<a href="../${d.ruta_archivo}" target="_blank" style="font-size:22px;">📄</a>`
        }
        <a href="../${d.ruta_archivo}" target="_blank" style="flex:1; font-size:13px; color:var(--text-primary);">${escapeHtml(d.nombre)}</a>
        <button type="button" class="btn btn-sm btn-danger" data-doc-id="${d.id}">Quitar</button>
      </div>
    `;
  }).join('');

  cont.querySelectorAll('[data-doc-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await apiPost('/documentos.php', { accion: 'eliminar', id: btn.dataset.docId });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
        return;
      }
      cargarListaEvidencias(idPrefix, actividadId);
    });
  });
}

/** Sube en cuanto se elijan archivos (no espera a que se guarde el formulario). */
export function activarSubidaEvidencias(idPrefix, actividadId) {
  const input = document.getElementById(`${idPrefix}-input`);
  if (!input) return;

  input.addEventListener('change', async (e) => {
    const archivos = e.target.files;
    if (!archivos.length) return;

    const formData = new FormData();
    formData.append('actividad_id', actividadId);
    for (const archivo of archivos) formData.append('archivos[]', archivo);

    try {
      await apiUpload('/documentos.php', formData);
    } catch (err) {
      toast('Error subiendo evidencia: ' + err.message, 'error');
      e.target.value = '';
      return;
    }
    e.target.value = '';
    toast('Evidencia subida', 'success');
    cargarListaEvidencias(idPrefix, actividadId);
  });
}
