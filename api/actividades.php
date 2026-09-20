<?php
// Actividades: núcleo del sistema. Lectura con prioridad calculada al vuelo;
// escritura con control de concurrencia optimista (columna `version`) para
// que dos personas editando lo mismo a la vez nunca se pisen en silencio.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();
$esAdmin = $sesion['rol'] === 'ADMINISTRADOR';

function actividadPorId(PDO $pdo, string $id): ?array {
    $stmt = $pdo->prepare('SELECT ' . actividadesJoinSql() . ' WHERE a.id = ?');
    $stmt->execute([$id]);
    $fila = $stmt->fetch();
    return $fila ? conPrioridad($fila) : null;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($esAdmin) {
        $stmt = $pdo->query('SELECT ' . actividadesJoinSql() . ' ORDER BY a.fecha_limite ASC');
        $filas = $stmt->fetchAll();
    } else {
        $stmt = $pdo->prepare('SELECT ' . actividadesJoinSql() . ' WHERE a.responsable_id = ? OR a.creador_id = ? ORDER BY a.fecha_limite ASC');
        $stmt->execute([$sesion['id'], $sesion['id']]);
        $filas = $stmt->fetchAll();
    }
    responder(['actividades' => array_map('conPrioridad', $filas)]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

if ($accion === 'crear') {
    $titulo = trim((string) ($body['titulo'] ?? ''));
    $fechaLimite = (string) ($body['fecha_limite'] ?? '');
    $responsableId = (string) ($body['responsable_id'] ?? $sesion['id']);
    if ($titulo === '') error_json('Ingresa el título de la actividad');
    if ($fechaLimite === '') error_json('Ingresa la fecha límite');

    $id = idUnico('act');
    $pdo->prepare(
        'INSERT INTO actividades
         (id, titulo, descripcion, proyecto_id, empresa_id, tipo, responsable_id, creador_id,
          fecha_inicio, fecha_limite, tiempo_estimado_min, importancia, impacto, estado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id, $titulo, $body['descripcion'] ?? null, $body['proyecto_id'] ?? null, $body['empresa_id'] ?? null,
        $body['tipo'] ?? 'TAREA', $responsableId, $sesion['id'],
        $body['fecha_inicio'] ?? null, $fechaLimite,
        (int) ($body['tiempo_estimado_min'] ?? 30), (int) ($body['importancia'] ?? 3), (int) ($body['impacto'] ?? 3),
        $body['estado'] ?? 'PENDIENTE',
    ]);

    responder(['ok' => true, 'actividad' => actividadPorId($pdo, $id)]);

} elseif ($accion === 'actualizar' || $accion === 'completar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la actividad a actualizar');

    $stmt = $pdo->prepare('SELECT * FROM actividades WHERE id = ?');
    $stmt->execute([$id]);
    $actual = $stmt->fetch();
    if (!$actual) error_json('Actividad no encontrada', 404);
    if (!puedeGestionarActividad($sesion, $actual)) error_json('No autorizado', 403);

    $versionRecibida = (int) ($body['version'] ?? 0);
    if ($versionRecibida !== 0 && $versionRecibida !== (int) $actual['version']) {
        error_conflicto(conPrioridad(actividadPorId($pdo, $id)));
    }

    if ($accion === 'completar') {
        $pdo->prepare('UPDATE actividades SET estado = "COMPLETADA", completada_at = NOW(), version = version + 1 WHERE id = ?')
            ->execute([$id]);
        responder(['ok' => true, 'actividad' => actividadPorId($pdo, $id)]);
    }

    $estado = (string) ($body['estado'] ?? $actual['estado']);
    $completadaAt = $actual['completada_at'];
    if ($estado === 'COMPLETADA' && $actual['estado'] !== 'COMPLETADA') {
        $completadaAt = date('Y-m-d H:i:s');
    }

    $pdo->prepare(
        'UPDATE actividades SET
            titulo=?, descripcion=?, proyecto_id=?, empresa_id=?, tipo=?, responsable_id=?,
            fecha_inicio=?, fecha_limite=?, tiempo_estimado_min=?, importancia=?, impacto=?,
            estado=?, bloqueada_motivo=?, completada_at=?, version = version + 1
         WHERE id = ?'
    )->execute([
        trim((string) ($body['titulo'] ?? $actual['titulo'])), $body['descripcion'] ?? $actual['descripcion'],
        $body['proyecto_id'] ?? $actual['proyecto_id'], $body['empresa_id'] ?? $actual['empresa_id'],
        $body['tipo'] ?? $actual['tipo'], $body['responsable_id'] ?? $actual['responsable_id'],
        $body['fecha_inicio'] ?? $actual['fecha_inicio'], $body['fecha_limite'] ?? $actual['fecha_limite'],
        (int) ($body['tiempo_estimado_min'] ?? $actual['tiempo_estimado_min']),
        (int) ($body['importancia'] ?? $actual['importancia']), (int) ($body['impacto'] ?? $actual['impacto']),
        $estado, $body['bloqueada_motivo'] ?? $actual['bloqueada_motivo'], $completadaAt,
        $id,
    ]);

    responder(['ok' => true, 'actividad' => actividadPorId($pdo, $id)]);

} elseif ($accion === 'eliminar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la actividad a eliminar');

    $stmt = $pdo->prepare('SELECT creador_id FROM actividades WHERE id = ?');
    $stmt->execute([$id]);
    $creadorId = $stmt->fetchColumn();
    if ($creadorId === false) error_json('Actividad no encontrada', 404);
    if (!$esAdmin && $creadorId !== $sesion['id']) error_json('No autorizado', 403);

    $pdo->prepare('DELETE FROM actividades WHERE id = ?')->execute([$id]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
