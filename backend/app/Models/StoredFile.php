<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A file (image) stored as bytes in the database instead of external object
 * storage. Served via the /storage/{path} route. Paths are stored without a
 * leading slash and without a "storage/" prefix (e.g. "clinics/logos/x.png").
 */
class StoredFile extends Model
{
    protected $table = 'stored_files';

    protected $fillable = ['path', 'mime', 'size', 'contents'];

    /** Create or replace the file at $path with the given bytes. */
    public static function store(string $path, string $bytes, ?string $mime = null): self
    {
        $path = ltrim($path, '/');

        return static::updateOrCreate(
            ['path' => $path],
            ['mime' => $mime, 'size' => strlen($bytes), 'contents' => $bytes]
        );
    }
}
