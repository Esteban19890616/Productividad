<?php
// Subactividades: usado hoy para "dividir en bloques" desde reprogramación.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$actividadId = (string) ($body['actividad_id'] ?? '');
$titulos = $body['titulos'] ?? [];

if ($actividadId === '' || !is_array($titulos) || empty($titulos)) {
    error_json('Faltan datos para crear las subactividades');
}

$stmt = $pdo->prepare('SELECT responsable_id, creador_id FROM actividades WHERE id = ?');
$stmt->execute([$actividadId]);
$actividad = $stmt->fetch();
if (!$actividad) error_json('Actividad no encontrada', 404);
if (!puedeGestionarActividad($sesion, $actividad)) error_json('No autorizado', 403);

$insertar = $pdo->prepare('INSERT INTO subactividades (id, actividad_id, titulo, orden) VALUES (?, ?, ?, ?)');
foreach (array_values($titulos) as $i => $titulo) {
    $insertar->execute([idUnico('sub'), $actividadId, (string) $titulo, $i + 1]);
}

responder(['ok' => true]);
