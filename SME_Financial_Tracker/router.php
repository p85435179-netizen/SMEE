<?php
// Router for local development: php -S 127.0.0.1:8080 router.php
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH) ?: '/');
if(preg_match('~(?:^|/)(?:data|database|exports|tests|\.[^/]*)(?:/|$)~i',$path)) {http_response_code(403);exit('Forbidden');}
return false;

