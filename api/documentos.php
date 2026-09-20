<?php
// Evidencias de actividades (fotos/PDF): hasta 4 archivos por actividad.
// Recibe multipart/form-data para subir, JSON para listar/eliminar.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

const MAX_ARCHIVOS_POR_ACTIVIDAD = 4;
const MAX_PESO_BYTES = 8 * 1024 * 1024; // 8 MB por archivo

$sesion = requerirSesion();
$pdo = obtenerConexion();

function actividadOAutorizado(PDO $pdo, string $actividadId, array $sesion): array {
    $stmt = $pdo->prepare('SELECT responsable_id, creador_id FROM actividades WHERE id = ?');
    $stmt->execute([$actividadId]);
    $actividad = $stmt->fetch();
    if (!$actividad) error_json('Actividad no encontrada', 404);
    if (!puedeGestionarActividad($sesion, $actividad)) error_json('No autorizado', 403);
    return $actividad;
}

/** Valida el CONTENIDO real del archivo (no el nombre ni el Content-Type que
 *  manda el navegador) y devuelve ['ext' => ..., 'tipo' => ...] o null. */
function tipoValido(string $rutaTemporal): ?array {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mime = finfo_file($finfo, $rutaTemporal);
    finfo_close($finfo);

    return match ($mime) {
        'image/jpeg' => ['ext' => 'jpg', 'tipo' => $mime],
        'image/png' => ['ext' => 'png', 'tipo' => $mime],
        'image/webp' => ['ext' => 'webp', 'tipo' => $mime],
        'application/pdf' => ['ext' => 'pdf', 'tipo' => $mime],
        default => null,
    };
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $actividadId = (string) ($_GET['actividad_id'] ?? '');
    if ($actividadId === '') error_json('Falta actividad_id');
    actividadOAutorizado($pdo, $actividadId, $sesion);

    $stmt = $pdo->prepare(
        'SELECT d.*, u.nombre_completo AS subido_por_nombre FROM documentos d
         LEFT JOIN usuarios u ON u.id = d.subido_por
         WHERE d.actividad_id = ? ORDER BY d.created_at'
    );
    $stmt->execute([$actividadId]);
    responder(['documentos' => $stmt->fetchAll()]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    error_json('Método no permitido', 405);
}

// Eliminar: llega como JSON normal.
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (str_starts_with($contentType, 'application/json')) {
    $body = leerJson();
    if (($body['accion'] ?? '') !== 'eliminar') error_json('Acción no reconocida');

    $id = (string) ($body['id'] ?? '');
    if ($id === '') error_json('Falta el documento a eliminar');

    $stmt = $pdo->prepare('SELECT * FROM documentos WHERE id = ?');
    $stmt->execute([$id]);
    $doc = $stmt->fetch();
    if (!$doc) error_json('Documento no encontrado', 404);
    if ($sesion['rol'] !== 'ADMINISTRADOR' && $doc['subido_por'] !== $sesion['id']) error_json('No autorizado', 403);

    $rutaFisica = __DIR__ . '/../' . $doc['ruta_archivo'];
    if (is_file($rutaFisica)) unlink($rutaFisica);
    $pdo->prepare('DELETE FROM documentos WHERE id = ?')->execute([$id]);

    responder(['ok' => true]);
}

// Subir: llega como multipart/form-data.
$actividadId = (string) ($_POST['actividad_id'] ?? '');
if ($actividadId === '') error_json('Falta actividad_id');
actividadOAutorizado($pdo, $actividadId, $sesion);

if (empty($_FILES['archivos'])) error_json('No se recibió ningún archivo');

$actuales = $pdo->prepare('SELECT COUNT(*) FROM documentos WHERE actividad_id = ?');
$actuales->execute([$actividadId]);
$totalActual = (int) $actuales->fetchColumn();

$nombres = $_FILES['archivos']['name'];
$cantidadNueva = count($nombres);
if ($totalActual + $cantidadNueva > MAX_ARCHIVOS_POR_ACTIVIDAD) {
    error_json('Máximo ' . MAX_ARCHIVOS_POR_ACTIVIDAD . ' archivos de evidencia por actividad (ya tienes ' . $totalActual . ')');
}

$dirDestino = __DIR__ . '/../uploads/evidencias/' . $actividadId;
if (!is_dir($dirDestino) && !mkdir($dirDestino, 0755, true) && !is_dir($dirDestino)) {
    error_json('No se pudo preparar la carpeta de evidencias en el servidor', 500);
}

$guardados = [];
for ($i = 0; $i < $cantidadNueva; $i++) {
    if ($_FILES['archivos']['error'][$i] !== UPLOAD_ERR_OK) {
        error_json('Error subiendo "' . $nombres[$i] . '"');
    }
    if ($_FILES['archivos']['size'][$i] > MAX_PESO_BYTES) {
        error_json('"' . $nombres[$i] . '" pesa más de 8 MB');
    }

    $tmp = $_FILES['archivos']['tmp_name'][$i];
    $info = tipoValido($tmp);
    if (!$info) {
        error_json('"' . $nombres[$i] . '" no es una foto (JPG/PNG/WebP) ni un PDF válido');
    }

    $idDoc = idUnico('doc');
    $nombreArchivo = $idDoc . '.' . $info['ext'];
    $rutaRelativa = 'uploads/evidencias/' . $actividadId . '/' . $nombreArchivo;
    $rutaAbsoluta = __DIR__ . '/../' . $rutaRelativa;

    if (!move_uploaded_file($tmp, $rutaAbsoluta)) {
        error_json('No se pudo guardar "' . $nombres[$i] . '" en el servidor', 500);
    }

    $pdo->prepare('INSERT INTO documentos (id, nombre, ruta_archivo, tipo, actividad_id, subido_por) VALUES (?, ?, ?, ?, ?, ?)')
        ->execute([$idDoc, $nombres[$i], $rutaRelativa, $info['tipo'], $actividadId, $sesion['id']]);

    $guardados[] = ['id' => $idDoc, 'nombre' => $nombres[$i], 'ruta_archivo' => $rutaRelativa, 'tipo' => $info['tipo']];
}

responder(['ok' => true, 'documentos' => $guardados]);
