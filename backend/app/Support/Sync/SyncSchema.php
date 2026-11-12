<?php

namespace App\Support\Sync;

/**
 * What the clinic <-> cloud sync carries, and how each record's links are
 * expressed so they mean the same thing on both databases.
 *
 * Numeric ids are local to one database: owner 12 on the clinic computer is a
 * different person from owner 12 in the cloud. So nothing travels by id.
 *
 *   uuid refs     - links to other synced records are sent as that record's uuid
 *                   and turned back into the receiving side's own id.
 *   natural refs  - links to reference data that is not synced (staff accounts,
 *                   species, breeds, categories) are sent by a natural key such
 *                   as an e-mail address or a name.
 *
 * ENTITIES is in dependency order: a record is always listed after the records
 * it points to, so applying them in this order never meets a missing parent.
 */
final class SyncSchema
{
    public const ENTITIES = [
        'Service' => [
            'table' => 'services',
            'uuid_refs' => [],
            'natural_refs' => ['deleted_by' => 'admin'],
        ],
        'Owner' => [
            'table' => 'owners',
            'uuid_refs' => [],
            'natural_refs' => ['user_id' => 'portal_user', 'deleted_by' => 'admin'],
        ],
        'Pet' => [
            'table' => 'pets',
            'uuid_refs' => ['owner_id' => 'owners'],
            'natural_refs' => [
                'species_id' => 'species',
                'breed_id' => 'breed',
                'size_category_id' => 'size_category',
                'deleted_by' => 'admin',
            ],
        ],
        'Inventory' => [
            'table' => 'inventories',
            'uuid_refs' => [],
            'natural_refs' => ['inventory_category_id' => 'inventory_category', 'deleted_by' => 'admin'],
        ],
        'Appointment' => [
            'table' => 'appointments',
            'uuid_refs' => ['pet_id' => 'pets', 'service_id' => 'services'],
            'natural_refs' => ['vet_id' => 'admin', 'deleted_by' => 'admin'],
        ],
        'MedicalRecord' => [
            'table' => 'medical_records',
            'uuid_refs' => ['pet_id' => 'pets', 'appointment_id' => 'appointments'],
            'natural_refs' => ['vet_id' => 'admin', 'deleted_by' => 'admin'],
        ],
        'Invoice' => [
            'table' => 'invoices',
            'uuid_refs' => ['pet_id' => 'pets', 'appointment_id' => 'appointments'],
            'natural_refs' => [],
        ],
        'InvoiceItem' => [
            'table' => 'invoice_items',
            'uuid_refs' => ['invoice_id' => 'invoices', 'service_id' => 'services', 'inventory_id' => 'inventories'],
            'natural_refs' => [],
        ],
        'CmsContent' => [
            'table' => 'cms_contents',
            'uuid_refs' => [],
            'natural_refs' => ['deleted_by' => 'admin'],
        ],
    ];

    /**
     * Natural-key lookups: [table, key columns]. A breed is identified by its
     * name together with its species' name, since breed names repeat across
     * species in principle.
     */
    public const LOOKUPS = [
        'admin' => ['table' => 'admins', 'key' => 'email'],
        'portal_user' => ['table' => 'portal_users', 'key' => 'email'],
        'species' => ['table' => 'species', 'key' => 'name'],
        'size_category' => ['table' => 'pet_size_categories', 'key' => 'name'],
        'inventory_category' => ['table' => 'mdm_inventory_categories', 'key' => 'name'],
        'breed' => ['table' => 'breeds', 'key' => 'name'],
    ];

    /** Columns that belong to one database only and never travel. */
    public const LOCAL_COLUMNS = ['id', 'clinic_id', 'sync_status', 'synced_at'];

    /**
     * Columns that must stay unique across the whole table. When a record made
     * on the other side collides with a different record here (two invoices
     * numbered VB-2026-11-0005 while offline), the incoming one keeps a suffix
     * instead of being rejected.
     */
    public const UNIQUE_COLUMNS = [
        'invoices' => ['invoice_number'],
        'inventories' => ['sku'],
    ];

    public static function has(string $type): bool
    {
        return isset(self::ENTITIES[$type]);
    }

    public static function table(string $type): string
    {
        return self::ENTITIES[$type]['table'];
    }

    /** Position in dependency order, for sorting a batch parents-first. */
    public static function order(string $type): int
    {
        $i = array_search($type, array_keys(self::ENTITIES), true);

        return $i === false ? PHP_INT_MAX : $i;
    }
}
