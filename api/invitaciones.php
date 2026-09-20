<?php
// Invitaciones: solo el ADMINISTRADOR autoriza correos a registrarse.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$admin = requerirAdmin();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stmt = $pdo->query('SELECT id, email, rol_asignado, usado, usado_at, created_at FROM invitaciones ORDER BY created_at DESC');
    responder(['invitaciones' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

if ($accion === 'crear') {
    $email = trim((string) ($body['email'] ?? ''));
    $rol = (string) ($body['rol_asignado'] ?? 'USUARIO');
    if ($email === '') error_json('Ingresa un correo');
    if (!in_array($rol, ['ADMINISTRADOR', 'USUARIO'], true)) error_json('Rol no válido');

    $pendiente = $pdo->prepare('SELECT 1 FROM invitaciones WHERE email = ? AND usado = 0');
    $pendiente->execute([$email]);
    if ($pendiente->fetchColumn()) error_json('Ese correo ya tiene una invitación pendiente');

    $existe = $pdo->prepare('SELECT 1 FROM usuarios WHERE email = ?');
    $existe->execute([$email]);
    if ($existe->fetchColumn()) error_json('Ese correo ya tiene una cuenta en PRISMA');

    $id = idUnico('inv');
    $pdo->prepare('INSERT INTO invitaciones (id, email, rol_asignado, creado_por) VALUES (?, ?, ?, ?)')
        ->execute([$id, $email, $rol, $admin['id']]);

    responder(['ok' => true, 'id' => $id]);
} elseif ($accion === 'cancelar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la invitación a cancelar');
    $pdo->prepare('DELETE FROM invitaciones WHERE id = ? AND usado = 0')->execute([$id]);
    responder(['ok' => true]);
} else {
    error_json('Acción no reconocida');
}
