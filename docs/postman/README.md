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

## Testing collections (`testing/`)

Used for the testing activities in `docs/AutoVet-Testing-Activities.pdf`.

| File | Test |
|---|---|
| `01-Integration-AI-Forecast` | API → MySQL usage history → Python scikit-learn forecast → JSON |
| `02-System-Patient-Journey` | Client books online → admin approves → vet adds record → invoice → stock deducts |
| `03-Security-RBAC` | Client / staff / vet / admin can reach only what their role allows |
| `load-test.js` | 30 simultaneous users on the dashboard (target: dashboard < 3 s) |

They run against a local server on a **copy** of the database, never production:

```bash
# from backend/: serve a QA copy of the DB on port 8010
DB_DATABASE=autovet_qa AI_API_URL=null MAIL_MAILER=log BROADCAST_CONNECTION=log php artisan serve --port 8010 --no-reload
# from docs/postman/testing/
node build.js                      # regenerate the collections
npx newman run 02-System-Patient-Journey.postman_collection.json -e AutoVet-QA.postman_environment.json
node load-test.js 30 30 3000       # BASE_URLS=... ACCOUNTS=... to spread across workers/accounts
```

The QA accounts use the seeded test password (`password123`).
Step-by-step PowerShell instructions: `docs/AutoVet-Testing-Guide.pdf`.
