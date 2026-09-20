# PRISMA

Plataforma de gestión de tareas, actividades y procesos administrativos multiusuario, con motor de prioridad automática, radar de pendientes, informes sectorizados por empresa y bitácora inmutable.

## Stack

- **Frontend**: HTML + CSS + JavaScript vanilla (sin build step). Se despliega tal cual en Hostinger.
- **Backend**: **PHP + MySQL/MariaDB**, corriendo directamente en tu propio Hostinger (mismo patrón que [Inventarios](https://github.com/Esteban19890616/Inventarios)).
- **Sesión**: sesiones de PHP con cookie `httponly`; contraseñas con `password_hash`/`password_verify` (nunca en texto plano).
- **Concurrencia**: las actividades tienen control de concurrencia optimista (columna `version`) — si dos personas editan lo mismo a la vez, la segunda recibe un aviso en vez de sobrescribir en silencio.
- **Auditoría**: la bitácora se llena sola con triggers de MySQL; nadie puede editarla ni borrarla desde la aplicación.

## Estructura del proyecto

```
├── index.html              # Login / registro
├── css/styles.css          # Sistema de diseño
├── js/                     # Lógica de cada pantalla (fetch hacia /api)
├── app/                    # Páginas internas (Mi día, Actividades, Informes, ...)
├── api/                    # Backend en PHP (lee/escribe en MySQL)
│   ├── config.php          # Credenciales de conexión (editar en el servidor)
│   ├── db.php               # Conexión PDO
│   ├── helpers.php          # Sesión, permisos, motor de prioridad
│   ├── login.php / logout.php / sesion.php / registro.php
│   ├── invitaciones.php     # Solo el ADMINISTRADOR autoriza nuevos correos
│   ├── usuarios.php / empresas.php / objetivos.php / proyectos.php
│   ├── actividades.php      # Núcleo del sistema (con control de concurrencia)
│   ├── reuniones.php / subactividades.php
│   ├── responsables.php / radar.php / bitacora.php / informes.php
└── sql/schema.sql          # DDL MySQL — instalación nueva
```

## Puesta en marcha

### 1. Crear la base de datos en Hostinger

1. En **hPanel → Bases de datos → Bases de datos MySQL**, crea una base de datos, un usuario, y asígnale ese usuario con todos los permisos.
2. Anota los 4 datos que te dan: host (normalmente `localhost`), nombre de la base de datos, usuario y contraseña.
3. Entra a **phpMyAdmin** (desde el mismo panel), selecciona tu base de datos → pestaña **Importar** → sube [`sql/schema.sql`](sql/schema.sql).

### 2. Subir los archivos

1. Sube todo el contenido de este repositorio a `public_html/` (o a una subcarpeta si usas un subdominio) vía **Administrador de archivos** o FTP.
2. Edita **directamente en el servidor** el archivo `api/config.php` con los 4 datos del paso 1. No subas tu contraseña real a GitHub.

### 3. Crear tu cuenta

Abre tu dominio y regístrate desde la pantalla de inicio — el primer usuario que se registra queda automáticamente como **ADMINISTRADOR**. Cualquier otra persona necesita que tú la invites primero desde **Usuarios y roles**.

### 4. Publicar cambios futuros en GitHub

```bash
git add .
git commit -m "Actualización de PRISMA"
git push origin main
```

(Recuerda: `api/config.php` con tu contraseña real vive solo en el servidor, nunca lo subas con las credenciales puestas.)

## Roles

- **ADMINISTRADOR**: ve y edita todo el sistema, invita usuarios y gestiona roles.
- **USUARIO**: ve y edita lo que crea o lo que tiene asignado. Solo puede registrarse si un administrador lo invitó primero.

## Estado actual (v1 — núcleo de gestión + Mi Día + Informes)

Construido:
- Autenticación por sesión, roles (ADMINISTRADOR / USUARIO) y registro controlado por invitación.
- Estructura Objetivo → Proyecto → Proceso → Actividad → Subactividad.
- Empresas (clientes) para sectorizar proyectos, actividades e informes.
- Tipo de actividad (tarea, reunión, clase, capacitación, llamada, inspección, visita, documento, desplazamiento, seguimiento, otro).
- "Mi día": actividades urgentes/próximas/programadas, reuniones del día, carga vs. tiempo disponible.
- Motor de prioridad dinámica (vencimiento, importancia, impacto, dependencias, retraso).
- Reprogramación automática de actividades vencidas (sugerencias por menor carga).
- Calendario vivo semanal con carga estimada por día.
- Centro de responsabilidades (quién tiene qué pendiente).
- Radar de pendientes (vencidas, próximas, bloqueadas, estancadas).
- Informes por periodo, con desglose por proyecto/empresa/persona, exportables a CSV e impresión/PDF.
- Bitácora inmutable de auditoría (quién hizo qué, cuándo), poblada automáticamente por triggers de MySQL.
- Control de concurrencia optimista en actividades (evita que dos personas se pisen los cambios).

Pendiente para siguientes fases: asistente conversacional con Claude, buzón de pendientes (OCR/documentos), procedimientos con etapas visuales, automatizaciones SI→ENTONCES, modo emergencia, detector de tareas repetitivas, sistema de logros.
