<?php
// Informes: actividades dentro de un rango de fechas (por fecha límite),
// opcionalmente filtradas por responsable y/o empresa.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();
$esAdmin = $sesion['rol'] === 'ADMINISTRADOR';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    error_json('Método no permitido', 405);
}

$desde = (string) ($_GET['desde'] ?? '');
$hasta = (string) ($_GET['hasta'] ?? '');
$responsableId = (string) ($_GET['responsable_id'] ?? '');
$empresaId = (string) ($_GET['empresa_id'] ?? '');

if ($desde === '' || $hasta === '') error_json('Indica el rango de fechas (desde y hasta)');

$condiciones = ['a.fecha_limite >= ?', 'a.fecha_limite <= ?'];
$valores = [$desde, $hasta];

if (!$esAdmin) {
    $condiciones[] = '(a.responsable_id = ? OR a.creador_id = ?)';
    $valores[] = $sesion['id'];
    $valores[] = $sesion['id'];
} elseif ($responsableId !== '') {
    $condiciones[] = 'a.responsable_id = ?';
    $valores[] = $responsableId;
}

$sql = 'SELECT ' . actividadesJoinSql() . ' WHERE ' . implode(' AND ', $condiciones) . ' ORDER BY a.fecha_limite ASC';
$stmt = $pdo->prepare($sql);
$stmt->execute($valores);
$filas = array_map('conPrioridad', $stmt->fetchAll());

if ($empresaId !== '') {
    $filas = array_values(array_filter($filas, fn($f) => $f['empresa_id_efectiva'] === $empresaId));
}

if (!empty($filas)) {
    $ids = array_column($filas, 'id');
    $marcadores = implode(',', array_fill(0, count($ids), '?'));
    $stmtDocs = $pdo->prepare("SELECT id, nombre, ruta_archivo, tipo, actividad_id FROM documentos WHERE actividad_id IN ($marcadores)");
    $stmtDocs->execute($ids);
    $docsPorActividad = [];
    foreach ($stmtDocs->fetchAll() as $doc) {
        $docsPorActividad[$doc['actividad_id']][] = $doc;
    }
    foreach ($filas as &$f) {
        $f['evidencias'] = $docsPorActividad[$f['id']] ?? [];
    }
    unset($f);
}

responder(['actividades' => $filas]);
