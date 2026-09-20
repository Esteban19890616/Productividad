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

/** Fecha + hora corta para timestamps de MySQL ("2026-09-20 14:32:10"),
 *  usada en observaciones. Muestra "Hoy" en vez de la fecha si aplica. */
export function formatearFechaHora(fechaHoraSql) {
  if (!fechaHoraSql) return '—';
  const f = new Date(fechaHoraSql.replace(' ', 'T'));
  const esHoy = f.toDateString() === new Date().toDateString();
  const fechaTxt = esHoy ? 'Hoy' : f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  const horaTxt = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
  return `${fechaTxt} · ${horaTxt}`;
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

/* =========================================================================
 * SUBTAREAS (subactividades de una actividad)
 *
 * htmlSubtareas() da el marcado; cargarListaSubtareas() trae los datos y
 * pinta la lista (incluye el hilo de observaciones de cada subtarea, ya que
 * ambas cosas viajan en el mismo fetch); activarAltaSubtareas() conecta el
 * botón "Agregar" una sola vez (igual que con evidencias).
 * ========================================================================= */

export function htmlSubtareas(idPrefix) {
  return `
    <div class="field">
      <label>Subtareas</label>
      <div id="${idPrefix}-sub-lista" style="margin-bottom:10px;"></div>
      <div style="display:flex; gap:8px;">
        <input type="text" id="${idPrefix}-sub-input" placeholder="Nueva subtarea…" style="flex:1;" />
        <button type="button" class="btn btn-sm" id="${idPrefix}-sub-add">Agregar</button>
      </div>
    </div>
  `;
}

export async function cargarListaSubtareas(idPrefix, actividadId) {
  const cont = document.getElementById(`${idPrefix}-sub-lista`);
  if (!cont) return;
  cont.innerHTML = `<div class="skeleton" style="height:20px;"></div>`;

  let subactividades = [], observaciones = [];
  try {
    [{ subactividades }, { observaciones }] = await Promise.all([
      apiGet('/subactividades.php', { actividad_id: actividadId }),
      apiGet('/observaciones.php', { actividad_id: actividadId }),
    ]);
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--critica); font-size:13px;">Error: ${escapeHtml(e.message)}</div>`;
    return;
  }
  subactividades = subactividades || [];
  observaciones = observaciones || [];

  if (subactividades.length === 0) {
    cont.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Sin subtareas todavía.</div>`;
    return;
  }

  const completadas = subactividades.filter(s => Number(s.completada)).length;
  cont.innerHTML = `
    <div style="color:var(--text-muted); font-size:12px; margin-bottom:8px;">${completadas}/${subactividades.length} completadas</div>
    ${subactividades.map(s => {
      const obsDeEsta = observaciones.filter(o => o.subactividad_id === s.id);
      return `
      <div class="subtarea-item">
        <div class="subtarea-fila">
          <input type="checkbox" data-sub-check="${s.id}" ${Number(s.completada) ? 'checked' : ''} />
          <span class="subtarea-titulo ${Number(s.completada) ? 'completada' : ''}">${escapeHtml(s.titulo)}</span>
          <button type="button" class="btn-link" data-sub-obs-toggle="${s.id}">💬${obsDeEsta.length ? ' ' + obsDeEsta.length : ''}</button>
          <button type="button" class="btn-link btn-link-danger" data-sub-eliminar="${s.id}">✕</button>
        </div>
        <div class="subtarea-obs" id="${idPrefix}-sub-obs-${s.id}" hidden></div>
      </div>`;
    }).join('')}
  `;

  cont.querySelectorAll('[data-sub-check]').forEach(chk => {
    chk.addEventListener('change', async () => {
      chk.disabled = true;
      try {
        await apiPost('/subactividades.php', { accion: 'alternar', id: chk.dataset.subCheck, completada: chk.checked });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
      }
      cargarListaSubtareas(idPrefix, actividadId);
    });
  });

  cont.querySelectorAll('[data-sub-eliminar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta subtarea? También se borrarán sus observaciones.')) return;
      try {
        await apiPost('/subactividades.php', { accion: 'eliminar', id: btn.dataset.subEliminar });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
        return;
      }
      cargarListaSubtareas(idPrefix, actividadId);
    });
  });

  cont.querySelectorAll('[data-sub-obs-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const subId = btn.dataset.subObsToggle;
      const panel = document.getElementById(`${idPrefix}-sub-obs-${subId}`);
      const estabaOculto = panel.hidden;
      cont.querySelectorAll('.subtarea-obs').forEach(p => { p.hidden = true; p.innerHTML = ''; });
      if (!estabaOculto) return;

      panel.hidden = false;
      panel.innerHTML = `
        <div class="obs-mini-lista"></div>
        <div style="display:flex; gap:6px; margin-top:6px;">
          <input type="text" class="obs-mini-input" placeholder="Observación sobre esta subtarea…" style="flex:1;" />
          <button type="button" class="btn btn-sm obs-mini-add">Agregar</button>
        </div>`;
      const obsDeEsta = observaciones.filter(o => o.subactividad_id === subId);
      renderObservacionesEnLista(panel.querySelector('.obs-mini-lista'), obsDeEsta, idPrefix, actividadId);

      panel.querySelector('.obs-mini-add').addEventListener('click', async () => {
        const input = panel.querySelector('.obs-mini-input');
        const texto = input.value.trim();
        if (!texto) return;
        try {
          await apiPost('/observaciones.php', { accion: 'crear', actividad_id: actividadId, subactividad_id: subId, texto });
        } catch (e) {
          toast('Error: ' + e.message, 'error');
          return;
        }
        cargarListaSubtareas(idPrefix, actividadId);
      });
    });
  });
}

/** Conecta el botón "Agregar" de subtareas una sola vez. */
export function activarAltaSubtareas(idPrefix, actividadId) {
  const boton = document.getElementById(`${idPrefix}-sub-add`);
  const input = document.getElementById(`${idPrefix}-sub-input`);
  if (!boton || !input) return;

  const crear = async () => {
    const titulo = input.value.trim();
    if (!titulo) return;
    boton.disabled = true;
    try {
      await apiPost('/subactividades.php', { accion: 'crear', actividad_id: actividadId, titulo });
    } catch (e) {
      toast('Error: ' + e.message, 'error');
      boton.disabled = false;
      return;
    }
    input.value = '';
    boton.disabled = false;
    cargarListaSubtareas(idPrefix, actividadId);
  };

  boton.addEventListener('click', crear);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); crear(); }
  });
}

/* =========================================================================
 * OBSERVACIONES generales de la actividad completa (no ligadas a una
 * subtarea). Las observaciones por subtarea se muestran dentro de
 * cargarListaSubtareas(); esto es solo el hilo a nivel de la actividad.
 * ========================================================================= */

export function htmlObservaciones(idPrefix) {
  return `
    <div class="field">
      <label>Observaciones generales</label>
      <div id="${idPrefix}-obs-lista" style="margin-bottom:10px;"></div>
      <div style="display:flex; gap:8px;">
        <textarea id="${idPrefix}-obs-input" rows="2" placeholder="Cuenta qué hiciste o deja algo por tener en cuenta…" style="flex:1;"></textarea>
        <button type="button" class="btn btn-sm" id="${idPrefix}-obs-add">Agregar</button>
      </div>
    </div>
  `;
}

export async function cargarListaObservaciones(idPrefix, actividadId) {
  const cont = document.getElementById(`${idPrefix}-obs-lista`);
  if (!cont) return;
  cont.innerHTML = `<div class="skeleton" style="height:20px;"></div>`;

  let observaciones = [];
  try {
    ({ observaciones } = await apiGet('/observaciones.php', { actividad_id: actividadId }));
  } catch (e) {
    cont.innerHTML = `<div style="color:var(--critica); font-size:13px;">Error: ${escapeHtml(e.message)}</div>`;
    return;
  }
  const generales = (observaciones || []).filter(o => !o.subactividad_id);
  renderObservacionesEnLista(cont, generales, idPrefix, actividadId);
}

/** Conecta el botón "Agregar" de observaciones generales una sola vez. */
export function activarAltaObservaciones(idPrefix, actividadId) {
  const boton = document.getElementById(`${idPrefix}-obs-add`);
  const input = document.getElementById(`${idPrefix}-obs-input`);
  if (!boton || !input) return;

  boton.addEventListener('click', async () => {
    const texto = input.value.trim();
    if (!texto) return;
    boton.disabled = true;
    try {
      await apiPost('/observaciones.php', { accion: 'crear', actividad_id: actividadId, texto });
    } catch (e) {
      toast('Error: ' + e.message, 'error');
      boton.disabled = false;
      return;
    }
    input.value = '';
    boton.disabled = false;
    cargarListaObservaciones(idPrefix, actividadId);
  });
}

/** Pinta una lista de observaciones (autor, fecha, texto, borrar) dentro de
 *  `cont`. Compartida por el hilo general y por el mini-hilo de cada
 *  subtarea. Borrar refresca ambas listas por simplicidad (son datos
 *  livianos por actividad; no vale la pena rastrear cuál llamó a cuál). */
function renderObservacionesEnLista(cont, observaciones, idPrefix, actividadId) {
  if (observaciones.length === 0) {
    cont.innerHTML = `<div style="color:var(--text-muted); font-size:13px;">Sin observaciones todavía.</div>`;
    return;
  }

  cont.innerHTML = observaciones.map(o => `
    <div class="obs-item">
      <div class="avatar" style="width:24px; height:24px; font-size:11px; flex:none;">${iniciales(o.usuario_nombre)}</div>
      <div style="flex:1; min-width:0;">
        <div style="font-size:12px; color:var(--text-muted);">
          <strong style="color:var(--text-secondary);">${escapeHtml(o.usuario_nombre || 'Alguien')}</strong>
          · ${formatearFechaHora(o.created_at)}
        </div>
        <div style="font-size:14px; overflow-wrap:break-word;">${escapeHtml(o.texto)}</div>
      </div>
      <button type="button" class="btn-link btn-link-danger" data-obs-eliminar="${o.id}">✕</button>
    </div>
  `).join('');

  cont.querySelectorAll('[data-obs-eliminar]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta observación?')) return;
      try {
        await apiPost('/observaciones.php', { accion: 'eliminar', id: btn.dataset.obsEliminar });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
        return;
      }
      cargarListaObservaciones(idPrefix, actividadId);
      cargarListaSubtareas(idPrefix, actividadId);
    });
  });
}
