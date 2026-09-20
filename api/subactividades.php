<?php
// Subactividades: dividir una actividad en subtareas gestionables (crear,
// renombrar, marcar completada, reordenar por creación y eliminar). También
// se usa para la división automática en bloques desde "Mi día".
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

/** Actividad de una subactividad + valida que la sesión pueda gestionarla.
 *  Devuelve la subactividad (fila completa) para que el caller no repita la consulta. */
function subactividadOAutorizada(PDO $pdo, string $subactividadId, array $sesion): array {
    $stmt = $pdo->prepare('SELECT * FROM subactividades WHERE id = ?');
    $stmt->execute([$subactividadId]);
    $sub = $stmt->fetch();
    if (!$sub) error_json('Subactividad no encontrada', 404);

    $stmt = $pdo->prepare('SELECT responsable_id, creador_id FROM actividades WHERE id = ?');
    $stmt->execute([$sub['actividad_id']]);
    $actividad = $stmt->fetch();
    if (!$actividad) error_json('Actividad no encontrada', 404);
    if (!puedeGestionarActividad($sesion, $actividad)) error_json('No autorizado', 403);

    return $sub;
}

function actividadOAutorizada(PDO $pdo, string $actividadId, array $sesion): array {
    $stmt = $pdo->prepare('SELECT responsable_id, creador_id FROM actividades WHERE id = ?');
    $stmt->execute([$actividadId]);
    $actividad = $stmt->fetch();
    if (!$actividad) error_json('Actividad no encontrada', 404);
    if (!puedeGestionarActividad($sesion, $actividad)) error_json('No autorizado', 403);
    return $actividad;
}

function subactividadPorId(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare(
        'SELECT s.*, u.nombre_completo AS responsable_nombre FROM subactividades s
         LEFT JOIN usuarios u ON u.id = s.responsable_id
         WHERE s.id = ?'
    );
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila ?: null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $actividadId = (string) ($_GET['actividad_id'] ?? '');
    if ($actividadId === '') error_json('Falta actividad_id');
    actividadOAutorizada($pdo, $actividadId, $sesion);

    $stmt = $pdo->prepare(
        'SELECT s.*, u.nombre_completo AS responsable_nombre FROM subactividades s
         LEFT JOIN usuarios u ON u.id = s.responsable_id
         WHERE s.actividad_id = ? ORDER BY s.orden ASC, s.created_at ASC'
    );
    $stmt->execute([$actividadId]);
    responder(['subactividades' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? '');

if ($accion === 'crear') {
    $actividadId = (string) ($body['actividad_id'] ?? '');
    $titulo = trim((string) ($body['titulo'] ?? ''));
    if ($actividadId === '') error_json('Falta actividad_id');
    if ($titulo === '') error_json('Ingresa el título de la subtarea');
    actividadOAutorizada($pdo, $actividadId, $sesion);

    $stmt = $pdo->prepare('SELECT COALESCE(MAX(orden), 0) FROM subactividades WHERE actividad_id = ?');
    $stmt->execute([$actividadId]);
    $siguienteOrden = (int) $stmt->fetchColumn() + 1;

    $id = idUnico('sub');
    $pdo->prepare('INSERT INTO subactividades (id, actividad_id, titulo, responsable_id, orden) VALUES (?, ?, ?, ?, ?)')
        ->execute([$id, $actividadId, $titulo, $body['responsable_id'] ?? null, $siguienteOrden]);

    responder(['ok' => true, 'subactividad' => subactividadPorId($pdo, $id)]);

} elseif ($accion === 'crear_multiples') {
    // Usado por "Mi día" para dividir una actividad atrasada en bloques.
    $actividadId = (string) ($body['actividad_id'] ?? '');
    $titulos = $body['titulos'] ?? [];
    if ($actividadId === '' || !is_array($titulos) || empty($titulos)) {
        error_json('Faltan datos para crear las subactividades');
    }
    actividadOAutorizada($pdo, $actividadId, $sesion);

    $stmt = $pdo->prepare('SELECT COALESCE(MAX(orden), 0) FROM subactividades WHERE actividad_id = ?');
    $stmt->execute([$actividadId]);
    $orden = (int) $stmt->fetchColumn();

    $insertar = $pdo->prepare('INSERT INTO subactividades (id, actividad_id, titulo, orden) VALUES (?, ?, ?, ?)');
    foreach (array_values($titulos) as $titulo) {
        $orden++;
        $insertar->execute([idUnico('sub'), $actividadId, (string) $titulo, $orden]);
    }

    responder(['ok' => true]);

} elseif ($accion === 'actualizar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la subtarea a actualizar');
    $actual = subactividadOAutorizada($pdo, $id, $sesion);

    $titulo = trim((string) ($body['titulo'] ?? $actual['titulo']));
    if ($titulo === '') error_json('El título no puede quedar vacío');

    $pdo->prepare('UPDATE subactividades SET titulo = ?, responsable_id = ? WHERE id = ?')
        ->execute([$titulo, $body['responsable_id'] ?? $actual['responsable_id'], $id]);

    responder(['ok' => true, 'subactividad' => subactividadPorId($pdo, $id)]);

} elseif ($accion === 'alternar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la subtarea');
    $actual = subactividadOAutorizada($pdo, $id, $sesion);

    $completada = !empty($body['completada']);
    $pdo->prepare('UPDATE subactividades SET completada = ?, completada_at = ? WHERE id = ?')
        ->execute([$completada ? 1 : 0, $completada ? date('Y-m-d H:i:s') : null, $id]);

    responder(['ok' => true, 'subactividad' => subactividadPorId($pdo, $id)]);

} elseif ($accion === 'eliminar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la subtarea a eliminar');
    subactividadOAutorizada($pdo, $id, $sesion);

    $pdo->prepare('DELETE FROM subactividades WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
