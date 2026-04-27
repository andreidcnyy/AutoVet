<?php
$users = [
    ['root', ''],
    ['root1', 'knhygYmXLqeXqhkyoaHKGUgzORbqoDbN'],
    ['root', 'root'],
];

foreach ($users as $u) {
    try {
        $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=autovet", $u[0], $u[1]);
        echo "SUCCESS: " . $u[0] . "\n";
        exit;
    } catch (PDOException $e) {
        echo "FAILED: " . $u[0] . " - " . $e->getMessage() . "\n";
    }
}
