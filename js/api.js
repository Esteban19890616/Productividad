// PRISMA — Cliente HTTP hacia el backend PHP (reemplaza al antiguo cliente de Supabase)
const BASE = '/api';

async function llamar(endpoint, opciones = {}) {
  const resp = await fetch(BASE + endpoint, {
    credentials: 'same-origin',
    headers: opciones.body ? { 'Content-Type': 'application/json' } : {},
    ...opciones,
  });

  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta vacía */ }

  if (!resp.ok) {
    const error = new Error(datos?.mensaje || datos?.error || `Error ${resp.status}`);
    error.status = resp.status;
    error.datos = datos;
    throw error;
  }
  return datos;
}

export function apiGet(endpoint, params = {}) {
  const query = new URLSearchParams(params).toString();
  return llamar(endpoint + (query ? `?${query}` : ''));
}

export function apiPost(endpoint, cuerpo = {}) {
  return llamar(endpoint, { method: 'POST', body: JSON.stringify(cuerpo) });
}
