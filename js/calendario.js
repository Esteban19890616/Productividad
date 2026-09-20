// PRISMA — Calendario vivo: muestra carga real de trabajo por día, no solo eventos
import { apiGet } from './api.js';
import { requerirSesion } from './auth.js';
import { montarNav } from './nav.js';
import { toast, escapeHtml } from './ui.js';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const COLORES = ['#ff4d6d', '#ff9f43', '#ffd166', '#4ecb71', '#4ee1ff', '#9b6bff'];

async function init() {
  const session = await requerirSesion();
  if (!session) return;
  const perfil = await montarNav('calendario.html');

  const inicioSemana = new Date();
  inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay()); // domingo de esta semana

  const fechas = Array.from({ length: 7 }, (_, i) => {
    const f = new Date(inicioSemana);
    f.setDate(f.getDate() + i);
    return f;
  });

  const desde = fechas[0].toISOString().slice(0, 10);
  const hasta = fechas[6].toISOString().slice(0, 10);

  let actividades = [], reuniones = [];
  try {
    const [resA, resR] = await Promise.all([
      apiGet('/actividades.php'),
      apiGet('/reuniones.php', { desde: desde + ' 00:00:00', hasta: hasta + ' 23:59:59' }),
    ]);
    actividades = (resA.actividades || []).filter(a =>
      a.responsable_id === perfil.id && !['COMPLETADA', 'CANCELADA'].includes(a.estado)
      && a.fecha_limite >= desde && a.fecha_limite <= hasta
    );
    reuniones = resR.reuniones || [];
  } catch (e) {
    toast('Error cargando el calendario: ' + e.message, 'error');
  }

  const minutosDisponibles = Number(perfil.horas_disponibles_dia || 8) * 60;
  const cont = document.getElementById('semana');

  cont.innerHTML = fechas.map((f, i) => {
    const fechaStr = f.toISOString().slice(0, 10);
    const actividadesDia = actividades.filter(a => a.fecha_limite === fechaStr);
    const reunionesDia = reuniones.filter(r => r.fecha_inicio.slice(0, 10) === fechaStr);

    const minutosOcupados = actividadesDia.reduce((s, a) => s + (a.tiempo_estimado_min || 0), 0) + reunionesDia.length * 60;
    const carga = minutosDisponibles > 0 ? Math.round((minutosOcupados / minutosDisponibles) * 100) : 0;

    const bloques = [
      ...reunionesDia.map(r => ({ titulo: r.titulo, hora: new Date(r.fecha_inicio).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) })),
      ...actividadesDia.map(a => ({ titulo: a.titulo, hora: null })),
    ];

    return `
      <div class="dia-col">
        <div class="dia-nombre">${DIAS[f.getDay()]}</div>
        <div class="dia-fecha">${f.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</div>
        ${bloques.map((b, j) => `
          <div class="bloque" style="background:${COLORES[j % COLORES.length]}">
            ${b.hora ? b.hora + ' — ' : ''}${escapeHtml(b.titulo)}
          </div>
        `).join('') || '<div style="color:var(--text-muted); font-size:12px;">Sin actividades</div>'}
        <div style="flex:1"></div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:8px;">Carga estimada: ${carga}%</div>
        <div class="progress-track" style="margin-top:4px;">
          <div class="progress-fill ${carga > 100 ? 'over' : ''}" style="width:${Math.min(carga, 100)}%"></div>
        </div>
        ${carga > 100 ? `<div style="color:var(--critica); font-size:11px; margin-top:6px;">⚠️ ${((minutosOcupados - minutosDisponibles) / 60).toFixed(1)}h de más</div>` : ''}
      </div>
    `;
  }).join('');
}

init();
