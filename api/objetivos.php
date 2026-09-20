<?php
// Objetivos, con sus proyectos anidados y el conteo de actividades de cada uno.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $esAdmin = $sesion['rol'] === 'ADMINISTRADOR';

    if ($esAdmin) {
        $objetivos = $pdo->query('SELECT * FROM objetivos ORDER BY created_at DESC')->fetchAll();
    } else {
        $stmt = $pdo->prepare(
            'SELECT DISTINCT o.* FROM objetivos o
             LEFT JOIN proyectos p ON p.objetivo_id = o.id
             LEFT JOIN actividades a ON a.proyecto_id = p.id
             WHERE o.owner_id = ? OR a.responsable_id = ?
             ORDER BY o.created_at DESC'
        );
        $stmt->execute([$sesion['id'], $sesion['id']]);
        $objetivos = $stmt->fetchAll();
    }

    $stmtProyectos = $pdo->prepare(
        'SELECT p.*,
            (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id) AS total_actividades,
            (SELECT COUNT(*) FROM actividades a WHERE a.proyecto_id = p.id AND a.estado = "COMPLETADA") AS completadas
         FROM proyectos p WHERE p.objetivo_id = ? ORDER BY p.created_at DESC'
    );
    foreach ($objetivos as &$o) {
        $stmtProyectos->execute([$o['id']]);
        $o['proyectos'] = $stmtProyectos->fetchAll();
    }
    unset($o);

    responder(['objetivos' => $objetivos]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

if ($accion === 'crear') {
    $nombre = trim((string) ($body['nombre'] ?? ''));
    if ($nombre === '') error_json('Ingresa el nombre del objetivo');

    $id = idUnico('obj');
    $pdo->prepare('INSERT INTO objetivos (id, nombre, descripcion, owner_id) VALUES (?, ?, ?, ?)')
        ->execute([$id, $nombre, $body['descripcion'] ?? null, $sesion['id']]);
    responder(['ok' => true, 'id' => $id]);

} elseif ($accion === 'actualizar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta el objetivo a actualizar');

    $stmt = $pdo->prepare('SELECT owner_id FROM objetivos WHERE id = ?');
    $stmt->execute([$id]);
    $owner = $stmt->fetchColumn();
    if ($owner === false) error_json('Objetivo no encontrado', 404);
    if ($sesion['rol'] !== 'ADMINISTRADOR' && $owner !== $sesion['id']) error_json('No autorizado', 403);

    $pdo->prepare('UPDATE objetivos SET nombre=?, descripcion=?, estado=? WHERE id=?')
        ->execute([trim((string) ($body['nombre'] ?? '')), $body['descripcion'] ?? null, $body['estado'] ?? 'ACTIVO', $id]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
