<?php
// Reuniones en las que el usuario en sesión participa, opcionalmente
// filtradas por rango de fecha (?desde=...&hasta=... en formato datetime).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$desde = (string) ($_GET['desde'] ?? '');
$hasta = (string) ($_GET['hasta'] ?? '');

$condiciones = ['rp.usuario_id = ?'];
$valores = [$sesion['id']];
if ($desde !== '') { $condiciones[] = 'r.fecha_inicio >= ?'; $valores[] = $desde; }
if ($hasta !== '') { $condiciones[] = 'r.fecha_inicio <= ?'; $valores[] = $hasta; }

$sql = 'SELECT DISTINCT r.* FROM reuniones r
        JOIN reunion_participantes rp ON rp.reunion_id = r.id
        WHERE ' . implode(' AND ', $condiciones) . '
        ORDER BY r.fecha_inicio';
$stmt = $pdo->prepare($sql);
$stmt->execute($valores);
$reuniones = $stmt->fetchAll();

$stmtPart = $pdo->prepare(
    'SELECT u.nombre_completo FROM reunion_participantes rp JOIN usuarios u ON u.id = rp.usuario_id WHERE rp.reunion_id = ?'
);
foreach ($reuniones as &$r) {
    $stmtPart->execute([$r['id']]);
    $r['participantes'] = array_column($stmtPart->fetchAll(), 'nombre_completo');
}
unset($r);

responder(['reuniones' => $reuniones]);
