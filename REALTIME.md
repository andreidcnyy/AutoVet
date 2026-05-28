# Real-Time (WebSocket) Setup — AutoVet

This system uses **Laravel Reverb** (WebSockets) so the admin dashboard and the
client portal update **without a browser refresh**. This document is the
single source of truth for keeping real-time working. If pages start "lagging"
or only update after a manual refresh, check this file first.

---

## How it works (end to end)

```
Controller action  ──▶  event(new SomethingHappened($model))
                         (event implements ShouldBroadcastNow)
                              │
                              ▼
                        Reverb server  ──▶  WebSocket  ──▶  Echo client
                                                              .listen('.event.name', cb)
                                                              └─ updates React state instantly
```

Every page also keeps a **polling fallback** (10–30s `setInterval` + refetch on
tab focus). So even if WebSockets are down, data is still eventually consistent
— the websocket just makes it instant.

---

## Why events are `ShouldBroadcastNow` (do NOT change back)

All events in `backend/app/Events/*` implement **`ShouldBroadcastNow`**, not
`ShouldBroadcast`.

- `ShouldBroadcast` = the broadcast is pushed onto the **queue**. It only fires
  when a `php artisan queue:work` worker picks it up. If no worker is running
  (or it's slow), real-time is delayed or never happens. **This was the original
  cause of the "delay" bug.**
- `ShouldBroadcastNow` = the broadcast is sent **synchronously** during the
  request. No queue worker needed. This is what we want.

If you add a new broadcast event, implement `ShouldBroadcastNow`.

---

## Required environment variables

### Backend (`backend/.env`) — production AND local-with-realtime

```env
BROADCAST_CONNECTION=reverb        # NOT "log" — "log" only writes to a file, nothing is sent

REVERB_APP_ID=your-app-id
REVERB_APP_KEY=your-app-key
REVERB_APP_SECRET=your-app-secret
REVERB_HOST=your-reverb-host       # e.g. the Railway/host domain
REVERB_PORT=443                    # 8080 for plain local ws, 443 for wss
REVERB_SCHEME=https                # http for local, https in production
```

> ⚠️ A common mistake: leaving `BROADCAST_CONNECTION=log` locally. With `log`,
> broadcasts are written to `storage/logs` and never reach the browser, so only
> the polling fallback works (the "delay"). Set it to `reverb`.

### Frontend — both apps (`frontend/admin/.env` and `frontend/portal/.env`)

```env
VITE_REVERB_APP_KEY=your-app-key   # must match REVERB_APP_KEY
VITE_REVERB_HOST=your-reverb-host
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

The admin (`frontend/admin/src/utils/echo.js`) and portal
(`frontend/portal/src/utils/echo.ts`) Echo clients read these and must point at
the same Reverb server as the backend.

---

## The Reverb server must be running

Broadcasting only works if the Reverb websocket server process is alive:

```bash
cd backend
php artisan reverb:start          # local
# production: run "php artisan reverb:start" as a long-lived process/service
```

On Railway (or any host) this is a **separate always-on process** from the web
server. If it's not running, no websocket messages are delivered.

---

## Authorized channels (`backend/routes/channels.php`)

| Channel                       | Who can subscribe                     |
| ----------------------------- | ------------------------------------- |
| `admin.appointments`          | admin / clinical / staff              |
| `admin.inventory`             | admin / clinical / staff              |
| `admin.notifications`         | admin / clinical / staff              |
| `admin.invoices`              | admin / clinical / staff              |
| `client.appointments.{id}`    | the owner whose user id == {id}       |
| `client.invoices.{id}`        | the owner whose user id == {id}       |
| `client.portal.{id}`          | the owner whose user id == {id}       |
| `notifications.{id}`          | the user whose id == {id}             |

---

## Events → channels → frontend listener

| Event                      | `broadcastAs()`              | Channels                                   |
| -------------------------- | --------------------------- | ------------------------------------------ |
| `AppointmentCreated`       | `appointment.created`       | `admin.appointments`, `client.appointments.{id}` |
| `AppointmentStatusUpdated` | `appointment.status.updated`| `admin.appointments`, `client.appointments.{id}` |
| `AppointmentDeleted`       | `appointment.deleted`       | `admin.appointments`, `client.appointments.{id}` |
| `InvoiceUpdated`           | `invoice.updated`           | `admin.invoices`, `client.invoices.{id}`   |
| `NotificationCreated`      | `notification.created`      | `admin.notifications` or `notifications.{id}` |
| `EntityCreated`            | `entity.created`            | `admin.notifications`                      |
| `InventoryUpdated`         | `inventory.updated`         | `admin.inventory`                          |
| `LowStockDetected`         | `inventory.low_stock`       | `admin.inventory`                          |
| `PortalUserStatusChanged`  | `portal.status.changed`     | `client.portal.{id}`, `admin.notifications`|

> The frontend listens with a **leading dot**: `.listen('.invoice.updated', cb)`.
> The dot tells Echo to use the custom `broadcastAs()` name verbatim.

---

## Private-channel authorization route (critical, easy to miss)

Both SPAs use **Bearer-token (Sanctum) auth**, not session cookies, and their Echo
clients point at **`/api/broadcasting/auth`**. Laravel's default broadcasting auth
route is `/broadcasting/auth` on the **session/web** guard — which does NOT match.

So a custom route is registered inside the Sanctum group in `routes/api.php`:

```php
Route::group(['middleware' => ['auth:sanctum', 'maintenance']], function () {
    Route::post('/broadcasting/auth', function (Request $request) {
        return \Illuminate\Support\Facades\Broadcast::auth($request);
    });
    // ...
});
```

Without this, the websocket connects (`101 Switching Protocols`) but every private
channel subscription is rejected — so it *looks* connected yet nothing is live.

**How to verify:** DevTools → Network → `broadcasting/auth` must return **200**
(403/419 = auth misconfigured), and the WS frames must show
`pusher_internal:subscription_succeeded` (not `pusher:subscription_error`).

---

## Checklist: adding a new real-time feature

1. **Event** — create `app/Events/MyEvent.php` implementing `ShouldBroadcastNow`,
   with `broadcastOn()` (admin channel + client channel if a portal user should
   see it) and a clear `broadcastAs()`.
2. **Fire it** — `event(new MyEvent($model))` in the controller after the DB write
   (or `broadcast(new MyEvent($model))->toOthers()` to skip the originator).
3. **Channel auth** — add the channel to `routes/channels.php` if it's new.
4. **Listen** — in the React page, `echo.private('channel').listen('.my.event', refetch)`
   inside a `useEffect`, and `echo.leave('channel')` in the cleanup.
5. **Fallback** — keep a `setInterval` refetch (10–30s) + a `visibilitychange`
   refetch so the feature still works if websockets drop.
6. **Verify names match** — the string in `broadcastAs()` must equal the
   `.listen('.<name>')` string (minus the leading dot).

---

## Troubleshooting "it's not real-time / it lags"

1. `BROADCAST_CONNECTION` is `reverb`, not `log`. ← most common
2. Reverb server process is actually running.
3. Backend `REVERB_*` and frontend `VITE_REVERB_*` keys/host/port **match**.
4. The event implements `ShouldBroadcastNow` (not `ShouldBroadcast`).
5. The channel is authorized in `routes/channels.php`.
6. `broadcastAs()` name matches the frontend `.listen('.name')`.
7. Browser console: look for Reverb/Pusher connection errors (wrong host/port/TLS).
8. If all else fails, the polling fallback still refreshes within 30s — if even
   that doesn't update, the bug is in the fetch function, not in real-time.
