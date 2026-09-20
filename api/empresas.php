<?php
// Empresas (clientes): cualquiera con sesión las ve y crea; solo el creador
// o un administrador las edita.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

$sesion = requerirSesion();
$pdo = obtenerConexion();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if ($sesion['rol'] === 'ADMINISTRADOR') {
        $stmt = $pdo->query('SELECT * FROM empresas ORDER BY nombre');
    } else {
        $stmt = $pdo->prepare('SELECT * FROM empresas WHERE creado_por = ? ORDER BY nombre');
        $stmt->execute([$sesion['id']]);
    }
    responder(['empresas' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

$body = leerJson();
$accion = (string) ($body['accion'] ?? 'crear');

function empresaEditablePor(PDO $pdo, string $id, array $sesion): array {
    $stmt = $pdo->prepare('SELECT * FROM empresas WHERE id = ?');
    $stmt->execute([$id]);
    $emp = $stmt->fetch();
    if (!$emp) error_json('Empresa no encontrada', 404);
    if ($sesion['rol'] !== 'ADMINISTRADOR' && $emp['creado_por'] !== $sesion['id']) {
        error_json('No autorizado', 403);
    }
    return $emp;
}

if ($accion === 'crear') {
    $nombre = trim((string) ($body['nombre'] ?? ''));
    if ($nombre === '') error_json('Ingresa el nombre de la empresa');

    $id = idUnico('emp');
    $pdo->prepare('INSERT INTO empresas (id, nombre, nit, contacto_nombre, contacto_email, contacto_telefono, color, creado_por) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        ->execute([
            $id, $nombre,
            $body['nit'] ?? null, $body['contacto_nombre'] ?? null,
            $body['contacto_email'] ?? null, $body['contacto_telefono'] ?? null,
            $body['color'] ?? '#7fae7a', $sesion['id'],
        ]);
    responder(['ok' => true, 'id' => $id]);

} elseif ($accion === 'actualizar') {
    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta la empresa a actualizar');
    empresaEditablePor($pdo, $id, $sesion);

    $pdo->prepare('UPDATE empresas SET nombre=?, nit=?, contacto_nombre=?, contacto_email=?, contacto_telefono=?, color=?, activa=? WHERE id=?')
        ->execute([
            trim((string) ($body['nombre'] ?? '')),
            $body['nit'] ?? null, $body['contacto_nombre'] ?? null,
            $body['contacto_email'] ?? null, $body['contacto_telefono'] ?? null,
            $body['color'] ?? '#7fae7a', !empty($body['activa']) ? 1 : 0,
            $id,
        ]);
    responder(['ok' => true]);

} else {
    error_json('Acción no reconocida');
}
