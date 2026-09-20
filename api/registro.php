<?php
// Registro controlado por invitación: el primer usuario del sistema se
// convierte en ADMINISTRADOR (fundador) sin necesitar invitación; cualquier
// otro correo debe tener una invitación pendiente creada por un admin desde
// "Usuarios y roles" (ver api/invitaciones.php).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$email = trim((string) ($body['email'] ?? ''));
$clave = (string) ($body['password'] ?? '');
$nombre = trim((string) ($body['nombre_completo'] ?? ''));

if ($email === '' || $clave === '' || $nombre === '') {
    error_json('Completa correo, contraseña y nombre');
}
if (strlen($clave) < 6) {
    error_json('La contraseña debe tener al menos 6 caracteres');
}

$pdo = obtenerConexion();

$existe = $pdo->prepare('SELECT 1 FROM usuarios WHERE email = ?');
$existe->execute([$email]);
if ($existe->fetchColumn()) {
    error_json('Ese correo ya tiene una cuenta. Inicia sesión en vez de registrarte.');
}

$totalUsuarios = (int) $pdo->query('SELECT COUNT(*) FROM usuarios')->fetchColumn();
$rol = 'USUARIO';
$invitacion = null;

if ($totalUsuarios === 0) {
    $rol = 'ADMINISTRADOR';
} else {
    $stmt = $pdo->prepare('SELECT * FROM invitaciones WHERE email = ? AND usado = 0 LIMIT 1');
    $stmt->execute([$email]);
    $invitacion = $stmt->fetch();
    if (!$invitacion) {
        error_json('Tu correo no está autorizado para registrarte en PRISMA. Pide a tu administrador que te invite desde "Usuarios y roles".', 403);
    }
    $rol = $invitacion['rol_asignado'];
}

$id = idUnico('usr');
try {
    $pdo->beginTransaction();
    $pdo->prepare('INSERT INTO usuarios (id, email, clave_hash, nombre_completo, rol) VALUES (?, ?, ?, ?, ?)')
        ->execute([$id, $email, password_hash($clave, PASSWORD_DEFAULT), $nombre, $rol]);

    if ($invitacion) {
        $pdo->prepare('UPDATE invitaciones SET usado = 1, usado_por = ?, usado_at = NOW() WHERE id = ?')
            ->execute([$id, $invitacion['id']]);
    }
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    error_json('No se pudo crear la cuenta: ' . $e->getMessage(), 500);
}

$sesionUsuario = ['id' => $id, 'email' => $email, 'nombre_completo' => $nombre, 'rol' => $rol];
$_SESSION['usuario'] = $sesionUsuario;

responder(['usuario' => $sesionUsuario]);
