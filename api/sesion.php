<?php
require_once __DIR__ . '/helpers.php';

$u = usuarioSesion();
responder(['usuario' => $u]);
