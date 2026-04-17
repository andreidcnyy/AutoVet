<?php

namespace App\Enums;

/**
 * Centralized role definitions for AutoVet.
 *
 * Use these constants everywhere role comparisons are needed
 * instead of scattered hardcoded strings.
 */
enum Roles: string
{
    case ADMIN        = 'admin';
    case VETERINARIAN = 'veterinarian';
    case STAFF        = 'staff';
    case OWNER        = 'owner';

    /**
     * Roles that can perform administrative write operations.
     */
    public static function adminRoles(): array
    {
        return [self::ADMIN->value, self::VETERINARIAN->value];
    }

    /**
     * Roles with clinical privileges (diagnose, write medical records).
     */
    public static function clinicalRoles(): array
    {
        return [self::VETERINARIAN->value, self::ADMIN->value];
    }

    /**
     * All roles that have any level of system access.
     */
    public static function all(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Roles representing clinic employees.
     */
    public static function employeeRoles(): array
    {
        return [self::ADMIN->value, self::VETERINARIAN->value, self::STAFF->value];
    }

    /**
     * Returns true if the given string matches this role (case-insensitive).
     */
    public function matches(string $role): bool
    {
        return $role === $this->value;
    }
}
