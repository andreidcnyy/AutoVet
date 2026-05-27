<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class InventoryCategory extends Model
{
    use SoftDeletes;

    protected $table = 'mdm_inventory_categories';
    protected $fillable = ['name', 'status'];
}
