<?php
// Radar de pendientes: situaciones que requieren atención (vencidas, próximas
// a vencer, bloqueadas, estancadas).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$condicionAlcance = $sesion['rol'] === 'ADMINISTRADOR' ? '1=1' : 'a.responsable_id = :uid OR a.creador_id = :uid2';

$sql = "
  SELECT
    a.id AS actividad_id, a.titulo, a.responsable_id, resp.nombre_completo AS responsable_nombre,
    a.fecha_limite, a.estado,
    CASE
      WHEN a.estado NOT IN ('COMPLETADA','CANCELADA') AND a.fecha_limite < CURDATE() THEN 'VENCIDA'
      WHEN a.estado NOT IN ('COMPLETADA','CANCELADA') AND a.fecha_limite <= DATE_ADD(CURDATE(), INTERVAL 2 DAY) THEN 'PROXIMA_A_VENCER'
      WHEN a.estado = 'BLOQUEADA' THEN 'BLOQUEADA'
      WHEN a.estado = 'PENDIENTE' AND a.updated_at < DATE_SUB(NOW(), INTERVAL 5 DAY) THEN 'ESTANCADA'
      ELSE NULL
    END AS situacion
  FROM actividades a
  LEFT JOIN usuarios resp ON resp.id = a.responsable_id
  WHERE a.estado NOT IN ('COMPLETADA', 'CANCELADA')
    AND ($condicionAlcance)
    AND (
      a.fecha_limite <= DATE_ADD(CURDATE(), INTERVAL 2 DAY)
      OR a.estado = 'BLOQUEADA'
      OR a.updated_at < DATE_SUB(NOW(), INTERVAL 5 DAY)
    )
  ORDER BY a.fecha_limite ASC
";

$stmt = $pdo->prepare($sql);
if ($sesion['rol'] !== 'ADMINISTRADOR') {
    $stmt->bindValue(':uid', $sesion['id']);
    $stmt->bindValue(':uid2', $sesion['id']);
}
$stmt->execute();

responder(['radar' => array_values(array_filter($stmt->fetchAll(), fn($f) => $f['situacion'] !== null))]);
