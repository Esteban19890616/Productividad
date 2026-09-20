<?php
// Proyectos: crear/actualizar dentro de un objetivo.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

if ($accion === 'crear') {
    $nombre = trim((string) ($body['nombre'] ?? ''));
    $objetivoId = (string) ($body['objetivo_id'] ?? '');
    if ($nombre === '') error_json('Ingresa el nombre del proyecto');
    if ($objetivoId === '') error_json('Falta el objetivo padre');

    $id = idUnico('proy');
    $pdo->prepare(
        'INSERT INTO proyectos (id, objetivo_id, empresa_id, nombre, descripcion, fecha_inicio, fecha_fin, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $objetivoId, $body['empresa_id'] ?? null, $nombre,
        $body['descripcion'] ?? null, $body['fecha_inicio'] ?? null, $body['fecha_fin'] ?? null,
        $sesion['id'],
    ]);
    responder(['ok' => true, 'id' => $id]);

} elseif ($accion === 'actualizar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta el proyecto a actualizar');

    $stmt = $pdo->prepare('SELECT owner_id FROM proyectos WHERE id = ?');
    $stmt->execute([$id]);
    $owner = $stmt->fetchColumn();
    if ($owner === false) error_json('Proyecto no encontrado', 404);
    if ($sesion['rol'] !== 'ADMINISTRADOR' && $owner !== $sesion['id']) error_json('No autorizado', 403);

    $pdo->prepare('UPDATE proyectos SET nombre=?, descripcion=?, empresa_id=?, estado=?, fecha_inicio=?, fecha_fin=? WHERE id=?')
        ->execute([
            trim((string) ($body['nombre'] ?? '')), $body['descripcion'] ?? null,
            $body['empresa_id'] ?? null, $body['estado'] ?? 'ACTIVO',
            $body['fecha_inicio'] ?? null, $body['fecha_fin'] ?? null, $id,
        ]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
