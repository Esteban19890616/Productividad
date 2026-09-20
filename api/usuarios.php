<?php
// Listado de usuarios (cualquiera con sesión, para elegir responsables) y
// administración de roles/horas/estado (solo ADMINISTRADOR).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($sesion['rol'] === 'ADMINISTRADOR') {
        $stmt = $pdo->query('SELECT id, email, nombre_completo, rol, horas_disponibles_dia, activo FROM usuarios ORDER BY nombre_completo');
    } else {
        $stmt = $pdo->query("SELECT id, nombre_completo FROM usuarios WHERE activo = 1 ORDER BY nombre_completo");
    }
    responder(['usuarios' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

requerirAdmin();
$body = leerJson();
$id = (string) ($body['id'] ?? '');
if ($id === '') error_json('Falta el usuario a actualizar');

$campos = [];
$valores = [];
if (isset($body['rol']) && in_array($body['rol'], ['ADMINISTRADOR', 'USUARIO'], true)) {
    $campos[] = 'rol = ?';
    $valores[] = $body['rol'];
}
if (isset($body['horas_disponibles_dia'])) {
    $campos[] = 'horas_disponibles_dia = ?';
    $valores[] = (float) $body['horas_disponibles_dia'];
}
if (isset($body['activo'])) {
    $campos[] = 'activo = ?';
    $valores[] = $body['activo'] ? 1 : 0;
}
if (empty($campos)) error_json('Nada para actualizar');

$valores[] = $id;
$pdo->prepare('UPDATE usuarios SET ' . implode(', ', $campos) . ' WHERE id = ?')->execute($valores);

responder(['ok' => true]);
