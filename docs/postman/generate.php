<?php
// Builds a Postman v2.1 collection from `php artisan route:list --json --path=api`.
// Usage (from backend/): php artisan route:list --json --path=api > routes.json && php ../docs/postman/generate.php routes.json . ../docs/postman
[$_, $routesFile, $backend, $out] = $argv;
require $backend.'/vendor/autoload.php';

// A real file/image rule token, not the word inside e.g. a data:image regex.
const FILE_RULE = "/(?:^|['\"|])(?:image|file)(?:['\"|:]|$)|mimes:/";

$routes = json_decode(file_get_contents($routesFile), true);

function methodBody(string $action): ?string
{
    if (! str_contains($action, '@')) return null;
    [$class, $method] = explode('@', $action);
    try {
        $rm = new ReflectionMethod($class, $method);
    } catch (Throwable $e) {
        return null;
    }
    $lines = file($rm->getFileName());
    return implode('', array_slice($lines, $rm->getStartLine() - 1, $rm->getEndLine() - $rm->getStartLine() + 1));
}

/** Top-level keys + rule text of the first validate([...]) / Validator::make(..., [...]) in the method. */
function rules(?string $src): array
{
    if (! $src) return [];
    if (! preg_match('/(?:->validate\(|Validator::make\([^,]+,|\$rules\s*=|processImport\([^,]+,[^,]+,)\s*\[/', $src, $m, PREG_OFFSET_CAPTURE)) return [];
    $start = $m[0][1] + strlen($m[0][0]);
    $depth = 1; $i = $start; $n = strlen($src);
    while ($i < $n && $depth > 0) {
        $c = $src[$i];
        if ($c === '[') $depth++;
        if ($c === ']') $depth--;
        $i++;
    }
    $arr = substr($src, $start, $i - $start - 1);
    // Keep only depth-0 text so nested rule arrays don't produce keys.
    $flat = ''; $d = 0;
    for ($j = 0; $j < strlen($arr); $j++) {
        $c = $arr[$j];
        if ($c === '[' || $c === '(') { $d++; $flat .= $c; continue; }
        if ($c === ']' || $c === ')') { $d--; $flat .= $c; continue; }
        $flat .= $d === 0 ? $c : ($c === ',' ? ';' : $c);
    }
    $out = [];
    foreach (preg_split('/,\s*(?=[\'"])/', $flat) as $part) {
        if (preg_match('/^\s*[\'"]([A-Za-z0-9_.*]+)[\'"]\s*=>\s*(.*)$/s', trim($part), $mm)) {
            $out[$mm[1]] = $mm[2];
        }
    }
    return $out;
}

function sample(string $key, string $rule)
{
    $r = strtolower($rule);
    if (str_contains($r, 'email')) return 'user@example.com';
    if (str_contains($key, 'password')) return 'password123';
    if (str_contains($r, 'boolean')) return true;
    if (str_contains($r, 'array')) return [];
    if (preg_match('/integer|numeric|exists:/', $r) || str_ends_with($key, '_id')) return 1;
    if (str_contains($r, 'date_format:h:i') || str_contains($key, 'time')) return '09:00';
    if (str_contains($r, 'date')) return date('Y-m-d');
    if (preg_match('/in:([^|\'"]+)/', $r, $m)) return explode(',', $m[1])[0];
    return '';
}

$folders = [];
foreach ($routes as $route) {
    $methods = explode('|', $route['method']);
    $method = $methods[0];
    $uri = $route['uri'];
    if ($uri === 'api') continue;

    $segments = explode('/', $uri);
    $folder = $segments[1] ?? 'misc';
    if ($folder === 'api') $folder = 'queue monitoring'; // routes under api/api/*
    if (in_array($folder, ['portal', 'super-admin', 'public']) && isset($segments[2]) && ! str_starts_with($segments[2], '{')) {
        $folder .= ' / '.$segments[2];
    }

    $pathParts = [];
    $variables = [];
    foreach ($segments as $s) {
        if (preg_match('/^\{(\w+)\??\}$/', $s, $m)) {
            $pathParts[] = ':'.$m[1];
            $variables[] = ['key' => $m[1], 'value' => '1'];
        } else {
            $pathParts[] = $s;
        }
    }

    $isAuthed = (bool) preg_grep('/Authenticate|auth:sanctum/', $route['middleware']);
    $action = $route['action'];
    $shortAction = str_replace('App\\Http\\Controllers\\', '', $action);

    $request = [
        'method' => $method,
        'header' => [['key' => 'Accept', 'value' => 'application/json']],
        'url' => [
            'raw' => '{{base_url}}/'.implode('/', $pathParts),
            'host' => ['{{base_url}}'],
            'path' => $pathParts,
        ],
        'description' => "Handler: `{$shortAction}`".($isAuthed ? '' : "\n\nPublic: no token needed."),
    ];
    if ($variables) $request['url']['variable'] = $variables;
    if (! $isAuthed) $request['auth'] = ['type' => 'noauth'];

    $item = ['name' => "{$method} /".implode('/', array_slice($pathParts, 1)), 'request' => &$request];

    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
        $rules = rules(methodBody($action));
        $isImport = str_contains($action, 'ImportController@');
        $hasFile = $isImport || (bool) preg_grep(FILE_RULE, $rules);
        if ($uri === 'api/login') {
            $request['body'] = ['mode' => 'raw', 'raw' => "{\n  \"email\": \"{{email}}\",\n  \"password\": \"{{password}}\"\n}", 'options' => ['raw' => ['language' => 'json']]];
            $item['event'] = [[
                'listen' => 'test',
                'script' => ['type' => 'text/javascript', 'exec' => [
                    "const body = pm.response.json();",
                    "if (body.token) {",
                    "  pm.environment.set('token', body.token);",
                    "  pm.test('Token saved to environment', () => pm.expect(body.token).to.be.a('string'));",
                    "} else {",
                    "  pm.test('Login failed: ' + (body.error || body.message || pm.response.code), () => pm.expect.fail());",
                    "}",
                ]],
            ]];
        } elseif ($hasFile) {
            $form = [];
            foreach ($rules as $k => $r) {
                if (str_contains($k, '*') || str_contains($k, '.')) continue;
                if ($isImport) continue; // these are the CSV's columns, not form fields
                $v = sample($k, $r);
                $form[] = preg_match(FILE_RULE, $r)
                    ? ['key' => $k, 'type' => 'file', 'src' => []]
                    : ['key' => $k, 'value' => is_bool($v) ? ($v ? '1' : '0') : (is_array($v) ? '' : (string) $v), 'type' => 'text'];
            }
            if ($isImport) {
                $form[] = ['key' => 'file', 'type' => 'file', 'src' => [], 'description' => 'CSV with columns: '.implode(', ', array_keys($rules))];
            }
            if ($method !== 'POST') {
                // PHP only parses multipart bodies on POST; Laravel reads _method.
                $form[] = ['key' => '_method', 'value' => $method, 'type' => 'text'];
                $request['method'] = 'POST';
            }
            $request['body'] = ['mode' => 'formdata', 'formdata' => $form];
        } elseif ($rules) {
            $body = [];
            foreach ($rules as $k => $r) {
                if (str_contains($k, '*') || str_contains($k, '.')) continue;
                $body[$k] = sample($k, $r);
            }
            $request['body'] = ['mode' => 'raw', 'raw' => json_encode($body ?: new stdClass, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), 'options' => ['raw' => ['language' => 'json']]];
        }
    }

    $folders[$folder][] = $item;
    unset($request, $item);
}

ksort($folders);
// Auth first so "log in" is the first thing people see.
$authNames = ['login', 'logout', 'register', 'auth', 'password', 'change-password', 'user', 'profile'];
$first = []; $rest = [];
foreach ($folders as $name => $items) {
    in_array($name, $authNames) ? $first[$name] = $items : $rest[$name] = $items;
}
$authItems = array_merge(...array_values(array_map(fn ($n) => $first[$n] ?? [], $authNames)));

$collection = [
    'info' => [
        'name' => 'AutoVet API',
        'description' => "All AutoVet backend API routes, generated from `php artisan route:list`.\n\n"
            ."1. Pick an environment (AutoVet Local or AutoVet Live) and fill in `email` and `password`.\n"
            ."2. Run **Auth → POST /login**. It saves the token to the environment.\n"
            ."3. Every other request sends that token as a Bearer token automatically.\n\n"
            ."Example bodies come from each endpoint's validation rules. Replace the placeholder IDs and values with real ones.",
        'schema' => 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    ],
    'auth' => ['type' => 'bearer', 'bearer' => [['key' => 'token', 'value' => '{{token}}', 'type' => 'string']]],
    'item' => array_merge(
        [['name' => 'Auth', 'item' => $authItems]],
        array_map(fn ($name, $items) => ['name' => $name, 'item' => $items], array_keys($rest), $rest)
    ),
];

@mkdir($out, 0777, true);
file_put_contents("$out/AutoVet-API.postman_collection.json", json_encode($collection, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

$env = fn ($name, $url, $email, $password) => [
    'name' => $name,
    'values' => [
        ['key' => 'base_url', 'value' => $url, 'type' => 'default', 'enabled' => true],
        ['key' => 'email', 'value' => $email, 'type' => 'default', 'enabled' => true],
        ['key' => 'password', 'value' => $password, 'type' => 'secret', 'enabled' => true],
        ['key' => 'token', 'value' => '', 'type' => 'secret', 'enabled' => true],
    ],
    '_postman_variable_scope' => 'environment',
];
file_put_contents("$out/AutoVet-Local.postman_environment.json", json_encode($env('AutoVet Local', 'http://localhost:8000', 'admin@autovet.com', 'password123'), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
file_put_contents("$out/AutoVet-Live.postman_environment.json", json_encode($env('AutoVet Live', 'https://autovet.onrender.com', '', ''), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

$count = array_sum(array_map('count', $folders));
echo "requests: $count, folders: ".(count($rest) + 1)."\n";
