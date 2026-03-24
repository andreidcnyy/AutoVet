<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Species extends Model
{
    protected $fillable = ['name', 'status'];

    public function breeds()
    {
        return $this->hasMany(Breed::class);
    }
}
