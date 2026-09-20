<?php
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();
header('Content-Type: application/json; charset=utf-8');

function responder($datos, int $codigo = 200): void {
    http_response_code($codigo);
    echo json_encode($datos, JSON_UNESCAPED_UNICODE);
    exit;
}

function error_json(string $mensaje, int $codigo = 400): void {
    responder(['error' => $mensaje], $codigo);
}

/** Responde 409: alguien más ya modificó este registro mientras tanto. */
function error_conflicto(array $actual): void {
    responder(['error' => 'conflicto', 'mensaje' => 'Otra persona modificó esto mientras tanto.', 'actual' => $actual], 409);
}

function leerJson(): array {
    $crudo = file_get_contents('php://input');
    $datos = json_decode($crudo, true);
    return is_array($datos) ? $datos : [];
}

function idUnico(string $prefijo): string {
    return $prefijo . '_' . bin2hex(random_bytes(8));
}

/* =========================================================================
 * SESIÓN Y PERMISOS
 * ========================================================================= */

/** Identidad de la sesión actual, o null si no ha iniciado sesión. */
function usuarioSesion(): ?array {
    return $_SESSION['usuario'] ?? null;
}

/** Corta con 401 si no hay sesión; deja lista @usuario_actual_id para que
 *  los triggers de bitácora sepan quién hizo el cambio; devuelve la sesión. */
function requerirSesion(): array {
    $u = usuarioSesion();
    if (!$u) error_json('No has iniciado sesión', 401);
    establecerUsuarioActual($u['id']);
    return $u;
}

/** Corta con 403 si el usuario en sesión no es ADMINISTRADOR. */
function requerirAdmin(): array {
    $u = requerirSesion();
    if ($u['rol'] !== 'ADMINISTRADOR') error_json('No autorizado', 403);
    return $u;
}

/** Fija la variable de sesión MySQL que leen los triggers de bitácora. */
function establecerUsuarioActual(string $usuarioId): void {
    $pdo = obtenerConexion();
    $pdo->exec('SET @usuario_actual_id = ' . $pdo->quote($usuarioId));
}

/** true si el usuario en sesión puede ver/editar una actividad
 *  (administrador, responsable o quien la creó). */
function puedeGestionarActividad(array $usuarioSesion, array $actividad): bool {
    return $usuarioSesion['rol'] === 'ADMINISTRADOR'
        || $actividad['responsable_id'] === $usuarioSesion['id']
        || $actividad['creador_id'] === $usuarioSesion['id'];
}

/* =========================================================================
 * MOTOR DE PRIORIDAD DINÁMICA
 * ========================================================================= */
function calcularPrioridad(?string $fechaLimite, int $importancia, int $impacto, int $numDependientes, string $estado): array {
    if (in_array($estado, ['COMPLETADA', 'CANCELADA'], true) || !$fechaLimite) {
        return ['puntuacion' => 0, 'etiqueta' => 'N/A', 'dias_restantes' => null, 'dias_retraso' => 0];
    }

    $hoy = new DateTime('today');
    $limite = new DateTime($fechaLimite);
    $diasRestantes = (int) $hoy->diff($limite)->format('%r%a');
    $diasRetraso = max(0, -$diasRestantes);

    if ($diasRestantes < 0) {
        $base = 40 + min($diasRetraso * 5, 30);
    } elseif ($diasRestantes === 0) {
        $base = 35;
    } elseif ($diasRestantes <= 2) {
        $base = 25;
    } elseif ($diasRestantes <= 5) {
        $base = 15;
    } else {
        $base = 5;
    }

    $puntuacion = min(100, $base + ($importancia * 4) + ($impacto * 4) + min($numDependientes * 5, 20));

    if ($puntuacion >= 70) $etiqueta = 'CRITICA';
    elseif ($puntuacion >= 50) $etiqueta = 'ALTA';
    elseif ($puntuacion >= 30) $etiqueta = 'MEDIA';
    else $etiqueta = 'BAJA';

    return ['puntuacion' => $puntuacion, 'etiqueta' => $etiqueta, 'dias_restantes' => $diasRestantes, 'dias_retraso' => $diasRetraso];
}

/** Fragmento SQL reutilizable: actividades con sus nombres relacionados
 *  (proyecto, responsable, creador, empresa efectiva) y su conteo de
 *  dependientes. Úsalo como 'SELECT ' . actividadesJoinSql() . ' WHERE ...'. */
function actividadesJoinSql(): string {
    return '
      a.*,
      p.nombre AS proyecto_nombre,
      resp.nombre_completo AS responsable_nombre,
      creador.nombre_completo AS creador_nombre,
      COALESCE(emp_act.id, emp_proy.id) AS empresa_id_efectiva,
      COALESCE(emp_act.nombre, emp_proy.nombre) AS empresa_nombre,
      COALESCE(emp_act.color, emp_proy.color) AS empresa_color,
      (SELECT COUNT(*) FROM dependencias_actividad d WHERE d.depende_de_id = a.id) AS num_dependientes
      FROM actividades a
      LEFT JOIN proyectos p ON p.id = a.proyecto_id
      LEFT JOIN usuarios resp ON resp.id = a.responsable_id
      LEFT JOIN usuarios creador ON creador.id = a.creador_id
      LEFT JOIN empresas emp_act ON emp_act.id = a.empresa_id
      LEFT JOIN empresas emp_proy ON emp_proy.id = p.empresa_id
    ';
}

/** Añade a cada fila de actividad sus campos de prioridad calculada
 *  (puntuacion, etiqueta, dias_restantes, dias_retraso). */
function conPrioridad(array $actividad): array {
    $numDep = $actividad['num_dependientes'] ?? 0;
    $calc = calcularPrioridad($actividad['fecha_limite'] ?? null, (int) $actividad['importancia'], (int) $actividad['impacto'], (int) $numDep, $actividad['estado']);
    $actividad['prioridad_puntuacion'] = $calc['puntuacion'];
    $actividad['prioridad_etiqueta'] = $calc['etiqueta'];
    $actividad['dias_restantes'] = $calc['dias_restantes'];
    $actividad['dias_retraso'] = $calc['dias_retraso'];
    return $actividad;
}
