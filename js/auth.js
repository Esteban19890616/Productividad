// PRISMA — Autenticación y sesión (backend PHP con sesiones de servidor)
import { apiGet, apiPost } from './api.js';

export async function obtenerPerfil() {
  try {
    const { usuario } = await apiGet('/sesion.php');
    return usuario;
  } catch {
    return null;
  }
}

export async function requerirSesion() {
  const perfil = await obtenerPerfil();
  if (!perfil) {
    window.location.href = '/index.html';
    return null;
  }
  return perfil;
}

export async function iniciarSesion(email, password) {
  try {
    const { usuario } = await apiPost('/login.php', { email, password });
    return { data: { usuario }, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function registrarUsuario(email, password, nombreCompleto) {
  try {
    const { usuario } = await apiPost('/registro.php', { email, password, nombre_completo: nombreCompleto });
    return { data: { usuario }, error: null };
  } catch (e) {
    return { data: null, error: e };
  }
}

export async function cerrarSesion() {
  await apiPost('/logout.php');
  window.location.href = '/index.html';
}
