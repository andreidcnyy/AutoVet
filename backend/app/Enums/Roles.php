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
    case SUPER_ADMIN  = 'super_admin';
    case CLINIC_ADMIN = 'clinic_admin';
    case VETERINARIAN = 'veterinarian';
    case STAFF        = 'staff';
    case OWNER        = 'owner'; // Portal Client

    /**
     * Roles that can perform administrative write operations.
     */
    public static function adminRoles(): array
    {
        return [self::SUPER_ADMIN->value, self::CLINIC_ADMIN->value, self::VETERINARIAN->value];
    }

    /**
     * Roles allowed to READ the clinic dashboard and analytics.
     *
     * Wider than adminRoles() because front-desk staff need the dashboard
     * counters and the analytics charts to do their job — the admin sidebar
     * already lists both for them (CLINIC_STAFF_ROLES in the frontend).
     * Financial endpoints (sales revenue, top services) stay on adminRoles();
     * the dashboard hides that card from staff.
     */
    public static function dashboardRoles(): array
    {
        return [...self::adminRoles(), self::STAFF->value];
    }

    /**
     * Roles with clinical privileges (diagnose, write medical records).
     */
    public static function clinicalRoles(): array
    {
        return [self::VETERINARIAN->value, self::CLINIC_ADMIN->value];
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
        return [self::CLINIC_ADMIN->value, self::VETERINARIAN->value, self::STAFF->value];
    }

    /**
     * Roles that manage accounts and platform data (users, archives of
     * accounts, backups of the whole platform).
     */
    public static function managerRoles(): array
    {
        return [self::SUPER_ADMIN->value, self::CLINIC_ADMIN->value];
    }

    /** Seniority used when one account acts on another. Higher outranks lower. */
    public static function rank(?string $role): int
    {
        return match ($role) {
            self::SUPER_ADMIN->value  => 4,
            self::CLINIC_ADMIN->value => 3,
            self::VETERINARIAN->value => 2,
            self::STAFF->value        => 1,
            default                   => 0,
        };
    }

    /**
     * Whether $actorRole may give an account $targetRole, or act on an account
     * that already holds it. Managers may work up to their own rank (a clinic
     * admin may add another clinic admin); everyone else only strictly below
     * theirs, so a veterinarian manages staff and nothing above.
     */
    public static function canManage(?string $actorRole, ?string $targetRole): bool
    {
        $actor  = self::rank($actorRole);
        $target = self::rank($targetRole);

        if ($target === 0) {
            return false;
        }

        return in_array($actorRole, self::managerRoles(), true)
            ? $target <= $actor
            : $target < $actor;
    }

    /**
     * Returns true if the given string matches this role (case-insensitive).
     */
    public function matches(string $role): bool
    {
        return $role === $this->value;
    }
}
