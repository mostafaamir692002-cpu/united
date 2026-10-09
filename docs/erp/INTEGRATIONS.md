# Integrations (n8n, Hermes)

The ERP is the source of truth. External channels (email / WhatsApp → n8n → Hermes)
only **submit orders** and **read their status back**; everything after that —
preparation, trips, delivery, invoicing, accounting — happens inside the ERP.

## Keys

* Created by the system administrator: **الإدارة → التكاملات** (`integrations.manage`).
* One key per channel (`code`: `n8n`, `hermes`, …), shown **once**; only its SHA-256
  is stored. Revoking takes effect on the next call.
* Scopes: `orders.create`, `orders.status`.
* The old shared `N8N_API_KEY` environment key keeps working (scope `orders.create`)
  so running flows don't break; its calls are logged as `legacy`. Replace it with a
  per-channel key, then remove the variable.

Send the key as `x-api-key: uk_…`.

## Submit an order

`POST /api/orders` (scope `orders.create`)

```json
{
  "external_id": "whatsapp-2026-12-20-0001",
  "customer_name": "مطعم البحر",
  "customer_account_id": "optional — exact customer id if known",
  "delivery_date": "2026-12-20",
  "delivery_time": "08:00",
  "notes": "optional",
  "source": "hermes",
  "items": [{ "product_name": "طماطم", "quantity": 12, "unit": "KG" }]
}
```

* `external_id` is the idempotency key: the same message sent again (a retry, a
  duplicate webhook) returns the same order — never a second one, even concurrently.
* The payload is validated exactly like a manual order (400 with the reason).
* Unknown customers and products are never guessed: the order is created and lands
  in the mapping queues for a person to resolve.

## Read the status

`GET /api/integrations/orders/{external_id}` (scope `orders.status`)

```json
{ "order": { "externalId": "…", "orderNumber": "UN-20261220-0001", "status": "dispatched",
  "deliveryDate": "2026-12-20",
  "trip": { "number": "TRP-2026-00012", "status": "completed", "delivery": "partial", "deliveredAt": "…", "receiverName": "…" },
  "invoice": { "number": "INV-2026-00031", "status": "issued", "issueDate": "2026-12-20" } } }
```

No prices, quantities or balances leave through this endpoint.

## Errors and the log

Errors are JSON `{ "error": "…" }` with the HTTP status (400 validation, 401 key,
403 scope, 404 not found, 409 conflict). Every call — accepted or refused — is
recorded in an append-only integration log (caller, path, status, external id,
result, error, duration), visible under **الإدارة → التكاملات**. Keys are never logged.
