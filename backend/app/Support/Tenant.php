<?php

namespace App\Support;

use App\Enums\Roles;
use App\Models\Admin;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Exists;

/**
 * Clinic restriction for queries the global ClinicScope cannot reach:
 * DB::table() builders and validation rules. Eloquent models with HasClinic
 * are already scoped; raw builders and `exists:` rules are not, so they read
 * and accept every clinic's rows.
 */
class Tenant
{
    /**
     * The caller's clinic, or null when no clinic restriction applies:
     * super admins, console, and portal clients. A client's own rows are
     * already limited by ownership checks, and their clinic_id does not
     * always match the shared lookup tables (see PetController::unscopedName),
     * so restricting them here would break the portal's dropdowns.
     */
    public static function clinicId(): ?int
    {
        $user = auth()->user();

        if (! $user instanceof Admin || $user->role === Roles::SUPER_ADMIN->value) {
            return null;
        }

        return $user->clinic_id ? (int) $user->clinic_id : -1; // -1 matches nothing
    }

    /** Adds "$column = caller's clinic" to a query builder when the caller is clinic-bound. */
    public static function scope($query, string $column)
    {
        $clinicId = self::clinicId();

        return $clinicId === null ? $query : $query->where($column, $clinicId);
    }

    /**
     * An `exists` rule limited to the caller's clinic, for tables that carry
     * clinic_id. Without it, staff could attach records to another clinic's
     * pets, owners or services by id.
     */
    public static function exists(string $table, string $column = 'id'): Exists
    {
        $rule = Rule::exists($table, $column);
        $clinicId = self::clinicId();

        return $clinicId === null ? $rule : $rule->where('clinic_id', $clinicId);
    }
}
