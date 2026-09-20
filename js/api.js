// PRISMA — Cliente HTTP hacia el backend PHP (reemplaza al antiguo cliente de Supabase)
const BASE = '/api';

async function llamar(endpoint, opciones = {}) {
  // FormData necesita que el navegador fije su propio Content-Type (con el
  // boundary del multipart); solo forzamos JSON cuando el body es texto.
  const esFormData = opciones.body instanceof FormData;
  const resp = await fetch(BASE + endpoint, {
    credentials: 'same-origin',
    headers: opciones.body && !esFormData ? { 'Content-Type': 'application/json' } : {},
    ...opciones,
  });

  let datos = null;
  try { datos = await resp.json(); } catch { /* respuesta vacía */ }

  // Sesión vencida o cerrada en otra pestaña: en vez de dejar la pantalla
  // pegada en "cargando" o mostrando un error que nadie alcanza a leer,
  // regresa al login directamente (excepto en el propio intento de login,
  // donde un 401 es simplemente "contraseña incorrecta", no sesión vencida).
  const esLogin = endpoint.startsWith('/login.php') || endpoint.startsWith('/registro.php');
  if (resp.status === 401 && !esLogin) {
    window.location.href = '/index.html?sesion_vencida=1';
    // Sigue lanzando el error (no lo dejamos "colgado" con una promesa que
    // nunca resuelve): si por lo que sea la redirección tarda o falla, la
    // pantalla debe poder mostrar el error en vez de quedarse congelada.
    throw new Error('Sesión vencida');
  }

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

/** Para subir archivos (multipart/form-data). No fijes Content-Type: el
 *  navegador debe poner el boundary correcto por su cuenta. */
export function apiUpload(endpoint, formData) {
  return llamar(endpoint, { method: 'POST', body: formData });
}
