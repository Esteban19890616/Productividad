<?php
// Centro de responsabilidades: cuántas actividades tiene pendientes/vencidas
// cada persona.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$sql = '
  SELECT
    u.id AS usuario_id,
    u.nombre_completo,
    SUM(CASE WHEN a.estado NOT IN ("COMPLETADA","CANCELADA") THEN 1 ELSE 0 END) AS pendientes,
    SUM(CASE WHEN a.estado NOT IN ("COMPLETADA","CANCELADA") AND a.fecha_limite < CURDATE() THEN 1 ELSE 0 END) AS vencidos,
    SUM(CASE WHEN a.estado NOT IN ("COMPLETADA","CANCELADA") AND a.fecha_limite = CURDATE() THEN 1 ELSE 0 END) AS hoy,
    SUM(CASE WHEN a.estado NOT IN ("COMPLETADA","CANCELADA") AND a.fecha_limite BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS proxima_semana
  FROM usuarios u
  LEFT JOIN actividades a ON a.responsable_id = u.id
  WHERE u.activo = 1
  GROUP BY u.id, u.nombre_completo
  ORDER BY vencidos DESC
';

responder(['responsables' => $pdo->query($sql)->fetchAll()]);
