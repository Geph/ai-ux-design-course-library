<?php
/**
 * Same-origin URL metadata scraper for the static (cPanel) deployment.
 * The app is exported statically, so it has no Next.js API routes; this endpoint
 * replaces them and avoids browser CORS limits entirely.
 *
 * Usage: /uxd/scrape.php?url=https%3A%2F%2Fexample.com
 * Returns: { title, author, summary, thumbnail, year, type, duration }
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: public, max-age=3600');

const MAX_BYTES = 2000000;
const TIMEOUT_SECONDS = 12;

function respond(array $data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(array_merge([
        'title' => '',
        'author' => '',
        'summary' => '',
        'thumbnail' => '',
        'year' => null,
        'type' => null,
        'duration' => null,
    ], $data), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Blocks non-http(s) schemes and hosts that resolve to private/loopback ranges. */
function is_fetchable_url(string $url): bool
{
    $parts = parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return false;
    }
    if (!in_array(strtolower($parts['scheme']), ['http', 'https'], true)) {
        return false;
    }

    $host = strtolower($parts['host']);
    if ($host === 'localhost' || substr($host, -6) === '.local') {
        return false;
    }

    $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : (gethostbynamel($host) ?: []);
    foreach ($addresses as $address) {
        $isPublic = filter_var(
            $address,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
        );
        if ($isPublic === false) {
            return false;
        }
    }

    return true;
}

/** @return array{body: string, contentType: string, finalUrl: string}|null */
function http_get(string $url): ?array
{
    if (!function_exists('curl_init')) {
        $context = stream_context_create([
            'http' => [
                'timeout' => TIMEOUT_SECONDS,
                'follow_location' => 1,
                'max_redirects' => 4,
                'header' => "User-Agent: Mozilla/5.0 (compatible; UXDAILibrary/1.0)\r\nAccept-Language: en-US,en;q=0.9\r\n",
            ],
        ]);
        $body = @file_get_contents($url, false, $context, 0, MAX_BYTES);
        if ($body === false) {
            return null;
        }
        $contentType = '';
        foreach ($http_response_header ?? [] as $header) {
            if (stripos($header, 'content-type:') === 0) {
                $contentType = trim(substr($header, 13));
            }
        }
        return ['body' => $body, 'contentType' => $contentType, 'finalUrl' => $url];
    }

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 4,
        CURLOPT_TIMEOUT => TIMEOUT_SECONDS,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
        CURLOPT_HTTPHEADER => [
            'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language: en-US,en;q=0.9',
        ],
        CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
        CURLOPT_BUFFERSIZE => 65536,
        CURLOPT_NOPROGRESS => false,
        CURLOPT_PROGRESSFUNCTION => static function ($resource, $downloadSize, $downloaded) {
            return $downloaded > MAX_BYTES ? 1 : 0;
        },
    ]);

    $body = curl_exec($handle);
    $contentType = (string) curl_getinfo($handle, CURLINFO_CONTENT_TYPE);
    $finalUrl = (string) curl_getinfo($handle, CURLINFO_EFFECTIVE_URL);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);

    if ($body === false || $status >= 400) {
        return null;
    }

    return ['body' => (string) $body, 'contentType' => $contentType, 'finalUrl' => $finalUrl ?: $url];
}

/** HEAD request used to confirm an image exists without downloading it. */
function http_head_ok(string $url, int $minBytes = 0): bool
{
    if (!function_exists('curl_init')) {
        return true;
    }

    $handle = curl_init($url);
    curl_setopt_array($handle, [
        CURLOPT_NOBODY => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 3,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; UXDAILibrary/1.0)',
    ]);
    curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    $length = (float) curl_getinfo($handle, CURLINFO_CONTENT_LENGTH_DOWNLOAD);
    curl_close($handle);

    if ($status >= 400) {
        return false;
    }
    return $minBytes <= 0 || $length <= 0 || $length >= $minBytes;
}

function clean_text(string $value, int $limit): string
{
    $value = html_entity_decode($value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $value = preg_replace('/\s+/u', ' ', $value) ?? $value;
    $value = trim($value);

    $hasMultibyte = function_exists('mb_strlen');
    $length = $hasMultibyte ? mb_strlen($value) : strlen($value);
    if ($length > $limit) {
        $value = $hasMultibyte ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
        $value = rtrim($value) . '...';
    }
    return $value;
}

function meta_content(string $html, string $property): string
{
    $escaped = preg_quote($property, '/');
    $patterns = [
        '/<meta[^>]+(?:property|name|itemprop)=["\']' . $escaped . '["\'][^>]*content=["\']([^"\']*)["\']/i',
        '/<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name|itemprop)=["\']' . $escaped . '["\']/i',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $html, $matches)) {
            return $matches[1];
        }
    }
    return '';
}

function extract_year(string $value): ?int
{
    if ($value === '') {
        return null;
    }
    if (preg_match('/(19|20)\d{2}/', $value, $matches)) {
        $year = (int) $matches[0];
        $max = (int) date('Y') + 1;
        if ($year >= 1900 && $year <= $max) {
            return $year;
        }
    }
    return null;
}

/** Pulls datePublished/author out of JSON-LD blocks. */
function json_ld_values(string $html): array
{
    $result = ['date' => '', 'author' => '', 'description' => '', 'image' => ''];
    if (!preg_match_all('/<script[^>]+type=["\']application\/ld\+json["\'][^>]*>(.*?)<\/script>/is', $html, $matches)) {
        return $result;
    }

    foreach ($matches[1] as $block) {
        $decoded = json_decode(trim($block), true);
        if (!is_array($decoded)) {
            continue;
        }
        $candidates = isset($decoded[0]) ? $decoded : [$decoded];
        if (isset($decoded['@graph']) && is_array($decoded['@graph'])) {
            $candidates = array_merge($candidates, $decoded['@graph']);
        }

        foreach ($candidates as $node) {
            if (!is_array($node)) {
                continue;
            }
            if ($result['date'] === '') {
                foreach (['datePublished', 'dateCreated', 'uploadDate', 'dateModified'] as $key) {
                    if (!empty($node[$key]) && is_string($node[$key])) {
                        $result['date'] = $node[$key];
                        break;
                    }
                }
            }
            if ($result['author'] === '' && !empty($node['author'])) {
                $author = $node['author'];
                if (is_array($author)) {
                    $author = isset($author['name']) ? $author['name'] : (isset($author[0]['name']) ? $author[0]['name'] : '');
                }
                if (is_string($author)) {
                    $result['author'] = $author;
                }
            }
            if ($result['description'] === '' && !empty($node['description']) && is_string($node['description'])) {
                $result['description'] = $node['description'];
            }
            if ($result['image'] === '' && !empty($node['image'])) {
                $image = $node['image'];
                if (is_array($image)) {
                    $image = isset($image['url']) ? $image['url'] : (isset($image[0]) ? $image[0] : '');
                }
                if (is_string($image)) {
                    $result['image'] = $image;
                }
            }
        }
    }

    return $result;
}

function absolute_url(string $candidate, string $baseUrl): string
{
    if ($candidate === '' || preg_match('/^https?:\/\//i', $candidate)) {
        return $candidate;
    }
    $base = parse_url($baseUrl);
    if (!$base || empty($base['scheme']) || empty($base['host'])) {
        return '';
    }
    if (strpos($candidate, '//') === 0) {
        return $base['scheme'] . ':' . $candidate;
    }
    $origin = $base['scheme'] . '://' . $base['host'];
    if (strpos($candidate, '/') === 0) {
        return $origin . $candidate;
    }
    $path = isset($base['path']) ? preg_replace('/\/[^\/]*$/', '/', $base['path']) : '/';
    return $origin . $path . $candidate;
}

function youtube_id(string $url): ?string
{
    $patterns = [
        '/(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{6,})/i',
        '/youtube\.com\/shorts\/([A-Za-z0-9_-]{6,})/i',
    ];
    foreach ($patterns as $pattern) {
        if (preg_match($pattern, $url, $matches)) {
            return $matches[1];
        }
    }
    return null;
}

function vimeo_id(string $url): ?string
{
    return preg_match('/vimeo\.com\/(?:video\/)?(\d+)/i', $url, $matches) ? $matches[1] : null;
}

function drive_file_id(string $url): ?string
{
    if (preg_match('/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/i', $url, $matches)) {
        return $matches[1];
    }
    if (preg_match('/drive\.google\.com\/open\?id=([A-Za-z0-9_-]+)/i', $url, $matches)) {
        return $matches[1];
    }
    return null;
}

function format_duration(int $seconds): string
{
    $hours = intdiv($seconds, 3600);
    $minutes = intdiv($seconds % 3600, 60);
    $secs = $seconds % 60;
    return $hours > 0
        ? sprintf('%d:%02d:%02d', $hours, $minutes, $secs)
        : sprintf('%d:%02d', $minutes, $secs);
}

$url = isset($_GET['url']) ? trim((string) $_GET['url']) : '';
if ($url === '') {
    respond(['error' => 'Missing url parameter'], 400);
}
if (!is_fetchable_url($url)) {
    respond(['error' => 'URL is not fetchable'], 400);
}

// --- YouTube -----------------------------------------------------------------
$videoId = youtube_id($url);
if ($videoId !== null) {
    $title = '';
    $author = '';
    $summary = '';
    $year = null;
    $duration = null;

    $oembed = http_get('https://www.youtube.com/oembed?url=' . urlencode($url) . '&format=json');
    if ($oembed !== null) {
        $data = json_decode($oembed['body'], true);
        if (is_array($data)) {
            $title = clean_text((string) ($data['title'] ?? ''), 300);
            $author = clean_text((string) ($data['author_name'] ?? ''), 160);
        }
    }

    $page = http_get('https://www.youtube.com/watch?v=' . $videoId);
    if ($page !== null) {
        $html = $page['body'];

        if ($title === '') {
            $title = clean_text(meta_content($html, 'og:title'), 300);
        }
        if (preg_match('/"shortDescription":"((?:[^"\\\\]|\\\\.)*)"/', $html, $matches)) {
            $decoded = json_decode('"' . $matches[1] . '"');
            if (is_string($decoded)) {
                $summary = clean_text($decoded, 700);
            }
        }
        if ($summary === '') {
            $metaDescription = meta_content($html, 'og:description');
            if ($metaDescription !== '' && stripos($metaDescription, 'Enjoy the videos and music') === false) {
                $summary = clean_text($metaDescription, 700);
            }
        }
        if (preg_match('/"lengthSeconds":"(\d+)"/', $html, $matches)) {
            $duration = format_duration((int) $matches[1]);
        }
        foreach (['publishDate', 'uploadDate', 'datePublished'] as $key) {
            if (preg_match('/"' . $key . '":"([^"]+)"/', $html, $matches)) {
                $year = extract_year($matches[1]);
                if ($year !== null) {
                    break;
                }
            }
        }
    }

    // maxresdefault is missing for some uploads; hqdefault always exists.
    $thumbnail = 'https://i.ytimg.com/vi/' . $videoId . '/maxresdefault.jpg';
    if (!http_head_ok($thumbnail, 2000)) {
        $thumbnail = 'https://i.ytimg.com/vi/' . $videoId . '/hqdefault.jpg';
    }

    respond([
        'title' => $title,
        'author' => $author,
        'summary' => $summary,
        'thumbnail' => $thumbnail,
        'year' => $year,
        'type' => 'video',
        'duration' => $duration,
    ]);
}

// --- Vimeo -------------------------------------------------------------------
$vimeoId = vimeo_id($url);
if ($vimeoId !== null) {
    $oembed = http_get('https://vimeo.com/api/oembed.json?url=' . urlencode($url));
    if ($oembed !== null) {
        $data = json_decode($oembed['body'], true);
        if (is_array($data)) {
            respond([
                'title' => clean_text((string) ($data['title'] ?? ''), 300),
                'author' => clean_text((string) ($data['author_name'] ?? ''), 160),
                'summary' => clean_text((string) ($data['description'] ?? ''), 700),
                'thumbnail' => (string) ($data['thumbnail_url'] ?? ''),
                'year' => extract_year((string) ($data['upload_date'] ?? '')),
                'type' => 'video',
                'duration' => isset($data['duration']) ? format_duration((int) $data['duration']) : null,
            ]);
        }
    }
}

// --- Google Drive ------------------------------------------------------------
$driveId = drive_file_id($url);
if ($driveId !== null) {
    $title = '';
    $page = http_get('https://drive.google.com/file/d/' . $driveId . '/view');
    if ($page !== null) {
        $title = clean_text(meta_content($page['body'], 'og:title'), 300);
        if ($title === '' && preg_match('/<title[^>]*>([^<]+)<\/title>/i', $page['body'], $matches)) {
            $title = clean_text(preg_replace('/ - Google Drive$/', '', $matches[1]) ?? $matches[1], 300);
        }
    }
    $isPdf = stripos($title, '.pdf') !== false;
    respond([
        'title' => clean_text(preg_replace('/\.(pdf|docx?|pptx?)$/i', '', $title) ?? $title, 300),
        'thumbnail' => 'https://drive.google.com/thumbnail?id=' . $driveId . '&sz=w1200',
        'type' => $isPdf ? 'pdf' : null,
    ]);
}

// --- Generic page ------------------------------------------------------------
$response = http_get($url);
if ($response === null) {
    respond(['error' => 'Unable to fetch URL']);
}

if (stripos($response['contentType'], 'application/pdf') !== false) {
    $filename = basename((string) parse_url($url, PHP_URL_PATH));
    respond([
        'title' => clean_text(str_replace(['-', '_'], ' ', preg_replace('/\.pdf$/i', '', $filename) ?? $filename), 300),
        'type' => 'pdf',
    ]);
}

$html = $response['body'];
$baseUrl = $response['finalUrl'];
$jsonLd = json_ld_values($html);

$title = meta_content($html, 'og:title');
if ($title === '') {
    $title = meta_content($html, 'twitter:title');
}
if ($title === '' && preg_match('/<title[^>]*>([^<]+)<\/title>/i', $html, $matches)) {
    $title = $matches[1];
}

$summary = meta_content($html, 'og:description');
if ($summary === '') {
    $summary = meta_content($html, 'twitter:description');
}
if ($summary === '') {
    $summary = meta_content($html, 'description');
}
if ($summary === '') {
    $summary = $jsonLd['description'];
}

$author = meta_content($html, 'author');
if ($author === '') {
    $author = meta_content($html, 'citation_author');
}
if ($author === '') {
    $author = $jsonLd['author'];
}
if ($author === '') {
    $author = meta_content($html, 'article:author');
}
if ($author === '' || preg_match('/^https?:\/\//i', $author)) {
    $author = meta_content($html, 'og:site_name');
}

$thumbnail = meta_content($html, 'og:image');
if ($thumbnail === '') {
    $thumbnail = meta_content($html, 'og:image:secure_url');
}
if ($thumbnail === '') {
    $thumbnail = meta_content($html, 'twitter:image');
}
if ($thumbnail === '') {
    $thumbnail = $jsonLd['image'];
}

$dateCandidates = [
    $jsonLd['date'],
    meta_content($html, 'article:published_time'),
    meta_content($html, 'citation_publication_date'),
    meta_content($html, 'citation_date'),
    meta_content($html, 'datePublished'),
    meta_content($html, 'date'),
    meta_content($html, 'dc.date'),
];
$year = null;
foreach ($dateCandidates as $candidate) {
    $year = extract_year((string) $candidate);
    if ($year !== null) {
        break;
    }
}
if ($year === null && preg_match('/<time[^>]+datetime=["\']([^"\']+)["\']/i', $html, $matches)) {
    $year = extract_year($matches[1]);
}

respond([
    'title' => clean_text($title, 300),
    'author' => clean_text($author, 160),
    'summary' => clean_text($summary, 700),
    'thumbnail' => absolute_url(clean_text($thumbnail, 500), $baseUrl),
    'year' => $year,
]);
