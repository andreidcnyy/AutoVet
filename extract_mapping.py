import pandas as pd
import os

csv_path = os.path.join('backend', 'storage', 'datasets', 'inventory.csv')
df = pd.read_csv(csv_path)

# Group by name and get the first code
mapping = df.groupby('item_name')['code'].first().to_dict()

# Print it in a PHP-ready format for Tinker
php_mapping = "[\n"
for name, code in mapping.items():
    # Escaping apostrophes for PHP
    safe_name = name.replace("'", "''")
    php_mapping += f"    '{safe_name}' => '{code}',\n"
php_mapping += "]"

print(php_mapping)
