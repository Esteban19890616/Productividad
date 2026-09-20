// PRISMA — Barra lateral y encabezado compartidos entre las páginas de /app
import { obtenerPerfil, cerrarSesion } from './auth.js';
import { iniciales } from './ui.js';

const ENLACES = [
  { href: 'mi-dia.html', icon: '🏠', label: 'Mi día' },
  { href: 'actividades.html', icon: '✅', label: 'Actividades' },
  { href: 'proyectos.html', icon: '🗂️', label: 'Objetivos y proyectos' },
  { href: 'empresas.html', icon: '🏢', label: 'Empresas' },
  { href: 'calendario.html', icon: '📅', label: 'Calendario' },
  { href: 'responsables.html', icon: '👥', label: 'Centro de responsabilidades' },
  { href: 'radar.html', icon: '🛰️', label: 'Radar de pendientes' },
  { href: 'bitacora.html', icon: '📝', label: 'Bitácora' },
  { href: 'informes.html', icon: '📑', label: 'Informes' },
];

export async function montarNav(paginaActual) {
  const perfil = await obtenerPerfil();
  const shell = document.getElementById('app-shell');
  if (!shell) return perfil;

  const enlacesHtml = ENLACES.map(e => `
    <div class="nav-link ${e.href === paginaActual ? 'active' : ''}" data-href="${e.href}">
      <span class="icon">${e.icon}</span><span>${e.label}</span>
    </div>
  `).join('');

  const esAdmin = perfil?.rol === 'ADMINISTRADOR';

  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';
  sidebar.innerHTML = `
    <div class="brand"><img src="../assets/img/logo-prisma.png" alt="PRISMA" /></div>
    ${enlacesHtml}
    ${esAdmin ? `
      <div class="nav-section-label">Administración</div>
      <div class="nav-link ${paginaActual === 'usuarios.html' ? 'active' : ''}" data-href="usuarios.html">
        <span class="icon">🛡️</span><span>Usuarios y roles</span>
      </div>
    ` : ''}
    <div style="flex:1"></div>
    <div class="nav-link" id="btn-logout"><span class="icon">🚪</span><span>Cerrar sesión</span></div>
  `;

  shell.prepend(sidebar);

  // En pantallas angostas el CSS oculta la barra lateral por completo; sin
  // este botón no habría ninguna forma de abrirla ni de cambiar de página
  // o cerrar sesión desde el celular.
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  shell.appendChild(backdrop);

  const cerrarMenuMovil = () => {
    sidebar.classList.remove('open');
    backdrop.classList.remove('open');
  };

  const topbar = shell.querySelector('.topbar');
  if (topbar) {
    const btnMenu = document.createElement('button');
    btnMenu.type = 'button';
    btnMenu.className = 'btn-menu-movil';
    btnMenu.setAttribute('aria-label', 'Abrir menú');
    btnMenu.textContent = '☰';
    topbar.prepend(btnMenu);
    btnMenu.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('open');
    });
  }
  backdrop.addEventListener('click', cerrarMenuMovil);

  sidebar.querySelectorAll('[data-href]').forEach(el => {
    el.addEventListener('click', () => { window.location.href = el.dataset.href; });
  });
  sidebar.querySelector('#btn-logout').addEventListener('click', cerrarSesion);

  const topbarUser = document.getElementById('topbar-user');
  if (topbarUser && perfil) {
    topbarUser.innerHTML = `
      <div class="user-chip">
        <div class="avatar">${iniciales(perfil.nombre_completo)}</div>
        <span>${perfil.nombre_completo}</span>
      </div>
    `;
  }

  return perfil;
}
