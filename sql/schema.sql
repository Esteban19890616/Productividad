-- PRISMA — Esquema MySQL/MariaDB (instalación nueva)
-- Ejecutar en: panel de hosting -> Bases de datos MySQL -> phpMyAdmin -> Importar/SQL
--
-- Convenciones (iguales a Inventarios):
--   * IDs como VARCHAR(40): prefijo + hex aleatorio, generados en PHP (idUnico()).
--   * Contraseñas con password_hash()/password_verify() de PHP (nunca en texto plano).
--   * `version` en tablas editables por varias personas a la vez: control de
--     concurrencia optimista (si alguien más ya cambió el registro, el guardado
--     se rechaza con 409 en vez de sobrescribir en silencio).
--   * La bitácora se llena SOLA con triggers; el usuario que hizo el cambio se
--     toma de la variable de sesión MySQL @usuario_actual_id, que cada endpoint
--     PHP fija apenas confirma quién inició sesión (ver helpers.php).

SET NAMES utf8mb4;

-- ============================================================
-- USUARIOS
-- ============================================================
CREATE TABLE usuarios (
  id VARCHAR(40) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  clave_hash VARCHAR(255) NOT NULL,
  nombre_completo VARCHAR(255) NOT NULL,
  rol ENUM('ADMINISTRADOR','USUARIO') NOT NULL DEFAULT 'USUARIO',
  horas_disponibles_dia DECIMAL(4,2) NOT NULL DEFAULT 8,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  anthropic_api_key_encrypted TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- INVITACIONES: solo un administrador autoriza correos a registrarse
-- ============================================================
CREATE TABLE invitaciones (
  id VARCHAR(40) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  rol_asignado ENUM('ADMINISTRADOR','USUARIO') NOT NULL DEFAULT 'USUARIO',
  creado_por VARCHAR(40) NOT NULL,
  usado TINYINT(1) NOT NULL DEFAULT 0,
  usado_por VARCHAR(40) NULL,
  usado_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id),
  FOREIGN KEY (usado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_invitaciones_email ON invitaciones(email);

-- ============================================================
-- EMPRESAS (clientes) — para sectorizar proyectos/actividades/informes
-- ============================================================
CREATE TABLE empresas (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  nit VARCHAR(50) NULL,
  contacto_nombre VARCHAR(255) NULL,
  contacto_email VARCHAR(255) NULL,
  contacto_telefono VARCHAR(50) NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#7fae7a',
  activa TINYINT(1) NOT NULL DEFAULT 1,
  creado_por VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creado_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- JERARQUÍA: OBJETIVOS -> PROYECTOS -> PROCESOS -> ACTIVIDADES -> SUBACTIVIDADES
-- ============================================================
CREATE TABLE objetivos (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  owner_id VARCHAR(40) NOT NULL,
  estado ENUM('ACTIVO','PAUSADO','COMPLETADO','CANCELADO') NOT NULL DEFAULT 'ACTIVO',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE proyectos (
  id VARCHAR(40) PRIMARY KEY,
  objetivo_id VARCHAR(40) NULL,
  empresa_id VARCHAR(40) NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  owner_id VARCHAR(40) NOT NULL,
  estado ENUM('ACTIVO','PAUSADO','COMPLETADO','CANCELADO') NOT NULL DEFAULT 'ACTIVO',
  fecha_inicio DATE NULL,
  fecha_fin DATE NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (objetivo_id) REFERENCES objetivos(id) ON DELETE SET NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE procesos (
  id VARCHAR(40) PRIMARY KEY,
  proyecto_id VARCHAR(40) NULL,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  es_plantilla TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE etapas_proceso (
  id VARCHAR(40) PRIMARY KEY,
  proceso_id VARCHAR(40) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  orden INT NOT NULL DEFAULT 0,
  responsable_id VARCHAR(40) NULL,
  requiere_documento TINYINT(1) NOT NULL DEFAULT 0,
  requiere_foto TINYINT(1) NOT NULL DEFAULT 0,
  requiere_aprobacion TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (proceso_id) REFERENCES procesos(id) ON DELETE CASCADE,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE actividades (
  id VARCHAR(40) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  proyecto_id VARCHAR(40) NULL,
  etapa_id VARCHAR(40) NULL,
  empresa_id VARCHAR(40) NULL,
  responsable_id VARCHAR(40) NOT NULL,
  creador_id VARCHAR(40) NOT NULL,
  fecha_inicio DATE NULL,
  fecha_limite DATE NOT NULL,
  tiempo_estimado_min INT NOT NULL DEFAULT 30,
  importancia TINYINT NOT NULL DEFAULT 3,
  impacto TINYINT NOT NULL DEFAULT 3,
  estado ENUM('PENDIENTE','EN_PROGRESO','COMPLETADA','BLOQUEADA','CANCELADA') NOT NULL DEFAULT 'PENDIENTE',
  tipo ENUM('TAREA','REUNION','CLASE','CAPACITACION','LLAMADA','INSPECCION','VISITA','DOCUMENTO','VIAJE','SEGUIMIENTO','OTRO') NOT NULL DEFAULT 'TAREA',
  bloqueada_motivo TEXT NULL,
  completada_at DATETIME NULL,
  version INT NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL,
  FOREIGN KEY (etapa_id) REFERENCES etapas_proceso(id) ON DELETE SET NULL,
  FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE SET NULL,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id),
  FOREIGN KEY (creador_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_actividades_responsable ON actividades(responsable_id);
CREATE INDEX idx_actividades_fecha_limite ON actividades(fecha_limite);
CREATE INDEX idx_actividades_estado ON actividades(estado);
CREATE INDEX idx_actividades_empresa ON actividades(empresa_id);

CREATE TABLE subactividades (
  id VARCHAR(40) PRIMARY KEY,
  actividad_id VARCHAR(40) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  completada TINYINT(1) NOT NULL DEFAULT 0,
  responsable_id VARCHAR(40) NULL,
  orden INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE dependencias_actividad (
  actividad_id VARCHAR(40) NOT NULL,
  depende_de_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (actividad_id, depende_de_id),
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  FOREIGN KEY (depende_de_id) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- REUNIONES
-- ============================================================
CREATE TABLE reuniones (
  id VARCHAR(40) PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NULL,
  fecha_inicio DATETIME NOT NULL,
  fecha_fin DATETIME NOT NULL,
  actividad_relacionada_id VARCHAR(40) NULL,
  creador_id VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actividad_relacionada_id) REFERENCES actividades(id) ON DELETE SET NULL,
  FOREIGN KEY (creador_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reunion_participantes (
  reunion_id VARCHAR(40) NOT NULL,
  usuario_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (reunion_id, usuario_id),
  FOREIGN KEY (reunion_id) REFERENCES reuniones(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- DOCUMENTOS (metadatos; el archivo se guarda en /uploads del servidor)
-- ============================================================
CREATE TABLE documentos (
  id VARCHAR(40) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  ruta_archivo VARCHAR(500) NOT NULL,
  tipo VARCHAR(100) NULL,
  actividad_id VARCHAR(40) NULL,
  subido_por VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  FOREIGN KEY (subido_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- ALERTAS / NOTIFICACIONES
-- ============================================================
CREATE TABLE alertas (
  id VARCHAR(40) PRIMARY KEY,
  usuario_id VARCHAR(40) NOT NULL,
  actividad_id VARCHAR(40) NULL,
  tipo ENUM('VENCIMIENTO','RETRASO','BLOQUEO','ASIGNACION','SISTEMA') NOT NULL,
  mensaje VARCHAR(500) NOT NULL,
  leida TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- BITÁCORA / AUDITORÍA — inmutable, se llena sola con triggers
-- ============================================================
CREATE TABLE bitacora (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tabla VARCHAR(50) NOT NULL,
  registro_id VARCHAR(40) NULL,
  accion ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  usuario_id VARCHAR(40) NULL,
  datos_anteriores JSON NULL,
  datos_nuevos JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_bitacora_tabla_registro ON bitacora(tabla, registro_id);
CREATE INDEX idx_bitacora_created_at ON bitacora(created_at);

DELIMITER //

CREATE TRIGGER trg_bita_objetivos_i AFTER INSERT ON objetivos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_nuevos)
  VALUES ('objetivos', NEW.id, 'INSERT', @usuario_actual_id, JSON_OBJECT('nombre', NEW.nombre, 'estado', NEW.estado));
END//
CREATE TRIGGER trg_bita_objetivos_u AFTER UPDATE ON objetivos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  VALUES ('objetivos', NEW.id, 'UPDATE', @usuario_actual_id,
    JSON_OBJECT('nombre', OLD.nombre, 'estado', OLD.estado),
    JSON_OBJECT('nombre', NEW.nombre, 'estado', NEW.estado));
END//
CREATE TRIGGER trg_bita_objetivos_d AFTER DELETE ON objetivos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores)
  VALUES ('objetivos', OLD.id, 'DELETE', @usuario_actual_id, JSON_OBJECT('nombre', OLD.nombre));
END//

CREATE TRIGGER trg_bita_proyectos_i AFTER INSERT ON proyectos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_nuevos)
  VALUES ('proyectos', NEW.id, 'INSERT', @usuario_actual_id, JSON_OBJECT('nombre', NEW.nombre, 'estado', NEW.estado));
END//
CREATE TRIGGER trg_bita_proyectos_u AFTER UPDATE ON proyectos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  VALUES ('proyectos', NEW.id, 'UPDATE', @usuario_actual_id,
    JSON_OBJECT('nombre', OLD.nombre, 'estado', OLD.estado),
    JSON_OBJECT('nombre', NEW.nombre, 'estado', NEW.estado));
END//
CREATE TRIGGER trg_bita_proyectos_d AFTER DELETE ON proyectos FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores)
  VALUES ('proyectos', OLD.id, 'DELETE', @usuario_actual_id, JSON_OBJECT('nombre', OLD.nombre));
END//

CREATE TRIGGER trg_bita_actividades_i AFTER INSERT ON actividades FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_nuevos)
  VALUES ('actividades', NEW.id, 'INSERT', @usuario_actual_id,
    JSON_OBJECT('titulo', NEW.titulo, 'estado', NEW.estado, 'fecha_limite', NEW.fecha_limite, 'responsable_id', NEW.responsable_id));
END//
CREATE TRIGGER trg_bita_actividades_u AFTER UPDATE ON actividades FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  VALUES ('actividades', NEW.id, 'UPDATE', @usuario_actual_id,
    JSON_OBJECT('titulo', OLD.titulo, 'estado', OLD.estado, 'fecha_limite', OLD.fecha_limite, 'responsable_id', OLD.responsable_id),
    JSON_OBJECT('titulo', NEW.titulo, 'estado', NEW.estado, 'fecha_limite', NEW.fecha_limite, 'responsable_id', NEW.responsable_id));
END//
CREATE TRIGGER trg_bita_actividades_d AFTER DELETE ON actividades FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores)
  VALUES ('actividades', OLD.id, 'DELETE', @usuario_actual_id, JSON_OBJECT('titulo', OLD.titulo, 'estado', OLD.estado));
END//

CREATE TRIGGER trg_bita_empresas_i AFTER INSERT ON empresas FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_nuevos)
  VALUES ('empresas', NEW.id, 'INSERT', @usuario_actual_id, JSON_OBJECT('nombre', NEW.nombre));
END//
CREATE TRIGGER trg_bita_empresas_u AFTER UPDATE ON empresas FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores, datos_nuevos)
  VALUES ('empresas', NEW.id, 'UPDATE', @usuario_actual_id, JSON_OBJECT('nombre', OLD.nombre), JSON_OBJECT('nombre', NEW.nombre));
END//
CREATE TRIGGER trg_bita_empresas_d AFTER DELETE ON empresas FOR EACH ROW
BEGIN
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_id, datos_anteriores)
  VALUES ('empresas', OLD.id, 'DELETE', @usuario_actual_id, JSON_OBJECT('nombre', OLD.nombre));
END//

DELIMITER ;
