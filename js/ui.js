// PRISMA — Utilidades de UI compartidas (toasts, modales, formateo)

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
