"""
One-time script to normalize item_name and inventory_id in inventory.csv and sales.csv
to match the live database's code->item_name mapping.

Usage: python normalize_datasets.py <db_json_mapping_file>
  or:  python normalize_datasets.py --inline

The --inline flag uses a hardcoded mapping exported from the AutoVet database.
"""

import csv
import sys
import os
import json
import shutil

# Canonical code -> (inventory_id, item_name) mapping from the live AutoVet database.
# Update this map if new inventory codes are added to the DB.
DB_MAPPING = {
    "INV-001": (13, "Nobivac Rabies (MSD) – rabies vaccine"),
    "INV-002": (12, "Nobivac DHPPi (MSD) – canine core combo vaccine"),
    "INV-003": (14, "Nobivac L4 (MSD) – leptospirosis vaccine"),
    "INV-004": (15, "Nobivac KC (MSD) – kennel cough (intranasal)"),
    "INV-005": (16, "Nobivac Tricat Trio (MSD) – feline core vaccine"),
    "INV-006": (17, "Synulox palatable tablets (Zoetis) – amoxicillin/clavulanic acid"),
    "INV-007": (18, "Cerenia 16 mg tablets (maropitant)"),
    "INV-008": (19, "Metacam 1.5 mg/ml oral suspension (meloxicam)"),
    "INV-009": (22, "Zoletil (Virbac) – injectable anesthetic"),
    "INV-010": (24, "Syringe 1 mL (sterile)"),
    "INV-011": (25, "Syringe 3 mL (sterile)"),
    "INV-012": (26, "Needle 23G / 25G (sterile)"),
    "INV-013": (27, "IV catheter (22G / 24G)"),
    "INV-014": (28, "Disposable gloves (box, 100 pcs)"),
    "INV-015": (29, "Gauze pads (sterile packs)"),
    "INV-016": (30, "Cotton balls / cotton rolls"),
    "INV-017": (31, "70% alcohol (500 mL – 1L)"),
    "INV-018": (32, "VetClean Anti-Tick & Flea Dog Shampoo 250ml"),
    "INV-019": (33, "PetDerm Sensitive Skin Cat Shampoo 200ml"),
    "INV-020": (34, "FungiCare Medicated Antifungal Shampoo 250ml"),
    "INV-021": (35, "CoatSoft Pet Conditioner 200ml"),
    "INV-022": (36, "FeshPaws Grooming Cologne (Baby Powder) 100ml"),
    "INV-023": (37, "KnotFree Detangling Spray 150ml"),
    "INV-024": (38, "Rabigen Anti-Rabies Vaccine 1ml (Canine/Feline)"),
    "INV-025": (39, "Vanguard Plus 5-in-1 Vaccine for Dogs 1 Dose"),
    "INV-026": (40, "Vanguard Plus 6-in-1 Vaccine for Dogs 1 Dose"),
    "INV-027": (41, "Felocell 4-in-1 Vaccine for Cats 1 Dose"),
    "INV-028": (42, "Drontal"),
}

DATASETS_DIR = os.path.join(os.path.dirname(__file__), "storage", "datasets")


def normalize_csv(filepath, code_col, item_name_col, id_col=None):
    backup_path = filepath + ".bak"
    shutil.copy2(filepath, backup_path)
    print(f"  Backup saved: {backup_path}")

    fixed = 0
    rows_out = []

    with open(filepath, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            code = row.get(code_col, "").strip()
            if code in DB_MAPPING:
                db_id, db_name = DB_MAPPING[code]
                if row.get(item_name_col, "").strip() != db_name:
                    row[item_name_col] = db_name
                    fixed += 1
                if id_col and str(row.get(id_col, "")).strip() != str(db_id):
                    row[id_col] = db_id
            rows_out.append(row)

    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows_out)

    print(f"  Fixed {fixed} item_name mismatches in {os.path.basename(filepath)}")


def main():
    inventory_csv = os.path.join(DATASETS_DIR, "inventory.csv")
    sales_csv = os.path.join(DATASETS_DIR, "sales.csv")

    print("Normalizing inventory.csv ...")
    normalize_csv(inventory_csv, code_col='code', item_name_col='item_name', id_col='inventory_id')

    print("Normalizing sales.csv ...")
    normalize_csv(sales_csv, code_col='code', item_name_col='item_name', id_col='inventory_id')

    print("\nDataset normalization complete.")


if __name__ == '__main__':
    main()
