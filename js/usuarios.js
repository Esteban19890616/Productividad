// PRISMA — Administración de usuarios, roles e invitaciones (solo ADMINISTRADOR)
import { apiGet, apiPost } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, iniciales } from './ui.js';

let perfilActual = null;

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfilActual = await montarNav('usuarios.html');

  if (perfilActual.rol !== 'ADMINISTRADOR') {
    document.getElementById('card-invitar')?.remove();
    document.getElementById('tabla-usuarios').innerHTML =
      `<div class="empty-state">🔒 Esta sección es solo para administradores.</div>`;
    document.getElementById('tabla-invitaciones').closest('.card')?.remove();
    return;
  }

  document.getElementById('form-invitar').addEventListener('submit', invitar);
  await Promise.all([cargar(), cargarInvitaciones()]);
}

async function invitar(e) {
  e.preventDefault();
  const email = document.getElementById('inv-email').value.trim();
  const rol = document.getElementById('inv-rol').value;
  if (!email) return;

  try {
    await apiPost('/invitaciones.php', { accion: 'crear', email, rol_asignado: rol });
  } catch (err) {
    toast('Error invitando: ' + err.message, 'error');
    return;
  }

  toast(`Invitación creada para ${email}. Comparte el enlace de PRISMA con esa persona.`, 'success');
  document.getElementById('form-invitar').reset();
  await cargarInvitaciones();
}

async function cargarInvitaciones() {
  let data;
  try {
    ({ invitaciones: data } = await apiGet('/invitaciones.php'));
  } catch (e) {
    document.getElementById('tabla-invitaciones').innerHTML = `<div class="empty-state">Error: ${e.message}</div>`;
    return;
  }

  const cont = document.getElementById('tabla-invitaciones');
  const pendientes = data.filter(i => !Number(i.usado));
  const usadas = data.filter(i => Number(i.usado));

  if (data.length === 0) {
    cont.innerHTML = `<div class="empty-state">Todavía no has invitado a nadie.</div>`;
    return;
  }

  cont.innerHTML = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="text-align:left; color:var(--text-muted); font-size:12px; text-transform:uppercase;">
          <th style="padding:10px;">Correo</th>
          <th style="padding:10px;">Rol asignado</th>
          <th style="padding:10px;">Estado</th>
          <th style="padding:10px;"></th>
        </tr>
      </thead>
      <tbody>
        ${pendientes.map(i => `
          <tr style="border-top:1px solid var(--border);">
            <td style="padding:10px;">${i.email}</td>
            <td style="padding:10px;">${i.rol_asignado}</td>
            <td style="padding:10px;"><span class="badge badge-MEDIA">Pendiente</span></td>
            <td style="padding:10px;">
              <button class="btn btn-sm btn-danger" data-id="${i.id}" data-accion="cancelar">Cancelar</button>
            </td>
          </tr>
        `).join('')}
        ${usadas.map(i => `
          <tr style="border-top:1px solid var(--border); opacity:0.6;">
            <td style="padding:10px;">${i.email}</td>
            <td style="padding:10px;">${i.rol_asignado}</td>
            <td style="padding:10px;"><span class="badge badge-BAJA">Usada</span></td>
            <td style="padding:10px;"></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  cont.querySelectorAll('[data-accion="cancelar"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await apiPost('/invitaciones.php', { accion: 'cancelar', id: btn.dataset.id });
      } catch (e) {
        toast('Error: ' + e.message, 'error');
        return;
      }
      toast('Invitación cancelada', 'success');
      await cargarInvitaciones();
    });
  });
}

async function cargar() {
  let data;
  try {
    ({ usuarios: data } = await apiGet('/usuarios.php'));
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }

  const cont = document.getElementById('tabla-usuarios');
  cont.innerHTML = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr style="text-align:left; color:var(--text-muted); font-size:12px; text-transform:uppercase;">
          <th style="padding:10px;">Persona</th>
          <th style="padding:10px;">Rol</th>
          <th style="padding:10px;">Horas/día</th>
          <th style="padding:10px;">Estado</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(u => `
          <tr style="border-top:1px solid var(--border);" data-id="${u.id}">
            <td style="padding:10px; display:flex; align-items:center; gap:10px;">
              <div class="avatar" style="width:28px;height:28px;font-size:11px;">${iniciales(u.nombre_completo)}</div>
              ${u.nombre_completo}
            </td>
            <td style="padding:10px;">
              <select class="sel-rol" data-id="${u.id}">
                <option value="USUARIO" ${u.rol === 'USUARIO' ? 'selected' : ''}>USUARIO</option>
                <option value="ADMINISTRADOR" ${u.rol === 'ADMINISTRADOR' ? 'selected' : ''}>ADMINISTRADOR</option>
              </select>
            </td>
            <td style="padding:10px;">
              <input type="number" class="inp-horas" data-id="${u.id}" value="${u.horas_disponibles_dia}" style="width:80px;" min="1" max="16" />
            </td>
            <td style="padding:10px;">
              <label style="display:flex; align-items:center; gap:6px; font-weight:400;">
                <input type="checkbox" class="chk-activo" data-id="${u.id}" ${Number(u.activo) ? 'checked' : ''} style="width:auto;" /> Activo
              </label>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  cont.querySelectorAll('.sel-rol').forEach(sel => {
    sel.addEventListener('change', () => actualizar(sel.dataset.id, { rol: sel.value }));
  });
  cont.querySelectorAll('.inp-horas').forEach(inp => {
    inp.addEventListener('change', () => actualizar(inp.dataset.id, { horas_disponibles_dia: Number(inp.value) }));
  });
  cont.querySelectorAll('.chk-activo').forEach(chk => {
    chk.addEventListener('change', () => actualizar(chk.dataset.id, { activo: chk.checked }));
  });
}

async function actualizar(id, cambios) {
  try {
    await apiPost('/usuarios.php', { id, ...cambios });
  } catch (e) {
    toast('Error actualizando: ' + e.message, 'error');
    return;
  }
  toast('Actualizado', 'success');
}

init();
