# AutoVet API — Postman

All 252 backend API routes, grouped by feature.

| File | What it is |
|---|---|
| `AutoVet-API.postman_collection.json` | The requests, with example bodies taken from each endpoint's validation rules |
| `AutoVet-Local.postman_environment.json` | `base_url` = `http://localhost:8000` (`php artisan serve`), seeded admin login |
| `AutoVet-Live.postman_environment.json` | `base_url` = `https://autovet.onrender.com`; fill in `email` / `password` yourself |

## Use it

1. Postman → **Import** → drop all three JSON files in.
2. Pick the **AutoVet Local** or **AutoVet Live** environment (top right).
3. Run **Auth → POST /login**. Its test script saves the returned token into the environment.
4. Every other request sends that token as `Authorization: Bearer {{token}}` automatically.

Placeholder IDs (`:id`, `pet_id: 1`, …) and empty strings must be replaced with real values.
Endpoints that upload files (pet photo, clinic logo, CSV imports) use form-data with a file field.

The live backend sleeps when idle, so the first request there can take up to a minute.
