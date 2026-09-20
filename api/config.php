<?php
// -----------------------------------------------------------------------
// Datos de conexión a la base de datos MySQL.
//
// Este archivo SÍ se sube a GitHub (con valores de ejemplo) y por eso cada
// despliegue desde Git lo reemplaza. Las credenciales REALES van en
// `config.local.php` (mismo carpeta), que nunca se sube al repositorio
// (está en .gitignore) — así un redespliegue nunca te las borra.
//
// La primera vez en el servidor: crea el archivo api/config.local.php con
// este contenido, reemplazando los 4 valores por los que te da tu panel de
// hosting (cPanel, Hostinger, etc. -> sección "Bases de datos MySQL"):
//
//   <?php
//   define('DB_HOST', 'localhost');
//   define('DB_NAME', 'nombre_de_tu_base_de_datos');
//   define('DB_USER', 'usuario_de_tu_base_de_datos');
//   define('DB_PASS', 'contraseña_de_tu_base_de_datos');
// -----------------------------------------------------------------------

$configLocal = __DIR__ . '/config.local.php';

if (is_file($configLocal)) {
    require $configLocal;
} else {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'nombre_de_tu_base_de_datos');
    define('DB_USER', 'usuario_de_tu_base_de_datos');
    define('DB_PASS', 'contraseña_de_tu_base_de_datos');
}
