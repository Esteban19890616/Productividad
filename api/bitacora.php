<?php
// Bitácora: solo lectura. Se llena sola con triggers de MySQL; nadie puede
// escribirla ni borrarla desde aquí.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

if ($sesion['rol'] === 'ADMINISTRADOR') {
    $stmt = $pdo->query(
        'SELECT b.*, u.nombre_completo AS usuario_nombre FROM bitacora b
         LEFT JOIN usuarios u ON u.id = b.usuario_id
         ORDER BY b.created_at DESC LIMIT 300'
    );
} else {
    $stmt = $pdo->prepare(
        'SELECT b.*, u.nombre_completo AS usuario_nombre FROM bitacora b
         LEFT JOIN usuarios u ON u.id = b.usuario_id
         WHERE b.usuario_id = ? ORDER BY b.created_at DESC LIMIT 300'
    );
    $stmt->execute([$sesion['id']]);
}

$filas = $stmt->fetchAll();
foreach ($filas as &$f) {
    $f['datos_anteriores'] = $f['datos_anteriores'] ? json_decode($f['datos_anteriores'], true) : null;
    $f['datos_nuevos'] = $f['datos_nuevos'] ? json_decode($f['datos_nuevos'], true) : null;
}
unset($f);

responder(['bitacora' => $filas]);
