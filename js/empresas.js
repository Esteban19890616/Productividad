// PRISMA — Empresas (clientes): CRUD simple para sectorizar proyectos/actividades/informes
import { apiGet, apiPost } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, abrirModal, cerrarModal, escapeHtml } from './ui.js';

let perfil = null;

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  perfil = await montarNav('empresas.html');
  await cargar();
  document.getElementById('btn-nueva-empresa').addEventListener('click', () => abrirModalEmpresa());
}

async function cargar() {
  let data;
  try {
    ({ empresas: data } = await apiGet('/empresas.php'));
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    return;
  }

  const cont = document.getElementById('lista-empresas');
  if (!data || data.length === 0) {
    cont.innerHTML = `<div class="card empty-state" style="grid-column:1/-1;"><div class="icon">🏢</div>Aún no has creado ninguna empresa.</div>`;
    return;
  }

  cont.innerHTML = data.map(emp => `
    <div class="card">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <div style="width:14px;height:14px;border-radius:4px;background:${escapeHtml(emp.color)};flex-shrink:0;"></div>
        <h3 style="font-size:15px;">${escapeHtml(emp.nombre)}</h3>
        ${!Number(emp.activa) ? '<span class="badge badge-BAJA">Inactiva</span>' : ''}
      </div>
      ${emp.nit ? `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:4px;">NIT: ${escapeHtml(emp.nit)}</div>` : ''}
      ${emp.contacto_nombre ? `<div style="font-size:13px; color:var(--text-secondary);">👤 ${escapeHtml(emp.contacto_nombre)}</div>` : ''}
      ${emp.contacto_email ? `<div style="font-size:13px; color:var(--text-secondary);">✉️ ${escapeHtml(emp.contacto_email)}</div>` : ''}
      ${emp.contacto_telefono ? `<div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">📞 ${escapeHtml(emp.contacto_telefono)}</div>` : ''}
      <button class="btn btn-sm" style="margin-top:10px;" data-id="${emp.id}">Editar</button>
    </div>
  `).join('');

  cont.querySelectorAll('button[data-id]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEmpresa(data.find(e => e.id === btn.dataset.id)));
  });
}

function abrirModalEmpresa(empresa = null) {
  const esEdicion = !!empresa;
  abrirModal(`
    <div class="modal-header"><h3>${esEdicion ? 'Editar' : 'Nueva'} empresa</h3></div>
    <form id="form-empresa">
      <div class="field"><label>Nombre</label><input type="text" id="em-nombre" required value="${escapeHtml(empresa?.nombre || '')}" /></div>
      <div class="field"><label>NIT (opcional)</label><input type="text" id="em-nit" value="${escapeHtml(empresa?.nit || '')}" /></div>
      <div class="field-row">
        <div class="field"><label>Contacto</label><input type="text" id="em-contacto" value="${escapeHtml(empresa?.contacto_nombre || '')}" /></div>
        <div class="field"><label>Color</label><input type="color" id="em-color" value="${empresa?.color || '#7fae7a'}" /></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Correo contacto</label><input type="email" id="em-email" value="${escapeHtml(empresa?.contacto_email || '')}" /></div>
        <div class="field"><label>Teléfono</label><input type="text" id="em-telefono" value="${escapeHtml(empresa?.contacto_telefono || '')}" /></div>
      </div>
      ${esEdicion ? `
        <label style="display:flex; align-items:center; gap:8px; font-weight:400; margin-bottom:16px;">
          <input type="checkbox" id="em-activa" style="width:auto;" ${Number(empresa.activa) ? 'checked' : ''} /> Empresa activa
        </label>
      ` : ''}
      <button type="submit" class="btn btn-primary" style="width:100%">${esEdicion ? 'Guardar cambios' : 'Crear empresa'}</button>
    </form>
  `);

  document.getElementById('form-empresa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      accion: esEdicion ? 'actualizar' : 'crear',
      nombre: document.getElementById('em-nombre').value.trim(),
      nit: document.getElementById('em-nit').value.trim() || null,
      contacto_nombre: document.getElementById('em-contacto').value.trim() || null,
      contacto_email: document.getElementById('em-email').value.trim() || null,
      contacto_telefono: document.getElementById('em-telefono').value.trim() || null,
      color: document.getElementById('em-color').value,
    };
    if (esEdicion) {
      payload.id = empresa.id;
      payload.activa = document.getElementById('em-activa').checked;
    }

    try {
      await apiPost('/empresas.php', payload);
    } catch (err) {
      toast('Error: ' + err.message, 'error');
      return;
    }
    cerrarModal();
    toast(esEdicion ? 'Empresa actualizada' : 'Empresa creada', 'success');
    cargar();
  });
}

init();
