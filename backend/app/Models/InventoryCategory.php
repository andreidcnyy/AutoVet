<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class InventoryCategory extends Model
{
    protected $table = 'mdm_inventory_categories';
    protected $fillable = ['name', 'status'];
}
