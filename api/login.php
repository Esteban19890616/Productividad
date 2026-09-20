<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$email = trim((string) ($body['email'] ?? ''));
$clave = (string) ($body['password'] ?? '');

if ($email === '' || $clave === '') {
    error_json('Ingresa correo y contraseña');
}

$pdo = obtenerConexion();
$stmt = $pdo->prepare('SELECT id, email, clave_hash, nombre_completo, rol, activo FROM usuarios WHERE email = ?');
$stmt->execute([$email]);
$u = $stmt->fetch();

if (!$u || !password_verify($clave, $u['clave_hash'])) {
    error_json('Correo o contraseña incorrectos', 401);
}
if (!$u['activo']) {
    error_json('Tu cuenta está desactivada. Contacta a tu administrador.', 403);
}

$sesionUsuario = [
    'id' => $u['id'],
    'email' => $u['email'],
    'nombre_completo' => $u['nombre_completo'],
    'rol' => $u['rol'],
];
$_SESSION['usuario'] = $sesionUsuario;

responder(['usuario' => $sesionUsuario]);
