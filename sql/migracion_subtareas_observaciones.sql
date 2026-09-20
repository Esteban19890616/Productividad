-- PRISMA — Migración: subtareas gestionables + observaciones de trabajo
-- Ejecutar en: panel de hosting -> Bases de datos MySQL -> phpMyAdmin -> Importar/SQL
--
-- Qué agrega:
--   1) `subactividades.completada_at` — para saber cuándo se completó cada
--      subtarea (antes solo existía el booleano `completada`).
--   2) Tabla `observaciones` — comentarios de trabajo que cualquiera con
--      acceso a la actividad puede ir dejando sobre lo que se hizo, tanto en
--      la actividad completa como en una subactividad puntual. Es un registro
--      manual y editable-por-borrado, distinto de la `bitacora` (que es
--      automática e inmutable, generada por triggers).
--
-- Seguro de ejecutar sobre una base de datos ya en uso: no toca datos
-- existentes, solo agrega columna/tabla/índices nuevos.

SET NAMES utf8mb4;

ALTER TABLE subactividades
  ADD COLUMN completada_at DATETIME NULL AFTER completada;

CREATE TABLE observaciones (
  id VARCHAR(40) PRIMARY KEY,
  actividad_id VARCHAR(40) NOT NULL,
  subactividad_id VARCHAR(40) NULL,
  usuario_id VARCHAR(40) NOT NULL,
  texto TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actividad_id) REFERENCES actividades(id) ON DELETE CASCADE,
  FOREIGN KEY (subactividad_id) REFERENCES subactividades(id) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_observaciones_actividad ON observaciones(actividad_id);
CREATE INDEX idx_observaciones_subactividad ON observaciones(subactividad_id);
CREATE INDEX idx_observaciones_created_at ON observaciones(created_at);
