<?php
// Observaciones: comentarios de trabajo que cualquiera con acceso a la
// actividad puede ir dejando sobre lo que se hizo — en la actividad completa
// o en una subactividad puntual. Es un registro manual (a diferencia de la
// `bitacora`, que es automática e inmutable).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

function actividadOAutorizada(PDO $pdo, string $actividadId, array $sesion): array {
    $stmt = $pdo->prepare('SELECT responsable_id, creador_id FROM actividades WHERE id = ?');
    $stmt->execute([$actividadId]);
    $actividad = $stmt->fetch();
    if (!$actividad) error_json('Actividad no encontrada', 404);
    if (!puedeGestionarActividad($sesion, $actividad)) error_json('No autorizado', 403);
    return $actividad;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $actividadId = (string) ($_GET['actividad_id'] ?? '');
    if ($actividadId === '') error_json('Falta actividad_id');
    actividadOAutorizada($pdo, $actividadId, $sesion);

    $stmt = $pdo->prepare(
        'SELECT o.*, u.nombre_completo AS usuario_nombre, s.titulo AS subactividad_titulo
         FROM observaciones o
         LEFT JOIN usuarios u ON u.id = o.usuario_id
         LEFT JOIN subactividades s ON s.id = o.subactividad_id
         WHERE o.actividad_id = ? ORDER BY o.created_at ASC'
    );
    $stmt->execute([$actividadId]);
    responder(['observaciones' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

if ($accion === 'crear') {
    $actividadId = (string) ($body['actividad_id'] ?? '');
    $subactividadId = trim((string) ($body['subactividad_id'] ?? '')) ?: null;
    $texto = trim((string) ($body['texto'] ?? ''));

    if ($actividadId === '') error_json('Falta actividad_id');
    if ($texto === '') error_json('Escribe algo para la observación');
    actividadOAutorizada($pdo, $actividadId, $sesion);

    if ($subactividadId !== null) {
        $stmt = $pdo->prepare('SELECT 1 FROM subactividades WHERE id = ? AND actividad_id = ?');
        $stmt->execute([$subactividadId, $actividadId]);
        if (!$stmt->fetchColumn()) error_json('La subtarea indicada no pertenece a esta actividad');
    }

    $id = idUnico('obs');
    $pdo->prepare('INSERT INTO observaciones (id, actividad_id, subactividad_id, usuario_id, texto) VALUES (?, ?, ?, ?, ?)')
        ->execute([$id, $actividadId, $subactividadId, $sesion['id'], $texto]);

    $stmt = $pdo->prepare(
        'SELECT o.*, u.nombre_completo AS usuario_nombre, s.titulo AS subactividad_titulo
         FROM observaciones o
         LEFT JOIN usuarios u ON u.id = o.usuario_id
         LEFT JOIN subactividades s ON s.id = o.subactividad_id
         WHERE o.id = ?'
    );
    $stmt->execute([$id]);
    responder(['ok' => true, 'observacion' => $stmt->fetch()]);

} elseif ($accion === 'eliminar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la observación a eliminar');

    $stmt = $pdo->prepare('SELECT * FROM observaciones WHERE id = ?');
    $stmt->execute([$id]);
    $obs = $stmt->fetch();
    if (!$obs) error_json('Observación no encontrada', 404);
    if ($sesion['rol'] !== 'ADMINISTRADOR' && $obs['usuario_id'] !== $sesion['id']) error_json('No autorizado', 403);

    $pdo->prepare('DELETE FROM observaciones WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
