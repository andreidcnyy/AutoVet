// Builds the AutoVet testing collections (Postman v2.1) used for the
// integration, system and security test activities.
// Run: node docs/postman/testing/build.js
// Then: npx newman run docs/postman/testing/<collection> -e docs/postman/testing/AutoVet-QA.postman_environment.json
const fs = require("fs");
const path = require("path");

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const H = [
  { key: "Accept", value: "application/json" },
  { key: "Content-Type", value: "application/json" },
];

function req(name, method, url, { body, token, tests = [], pre = [] } = {}) {
  const request = { method, header: [...H], url: `{{base_url}}${url}` };
  if (token) request.header.push({ key: "Authorization", value: `Bearer {{${token}}}` });
  if (body !== undefined) request.body = { mode: "raw", raw: typeof body === "string" ? body : JSON.stringify(body, null, 2) };
  const event = [];
  if (pre.length) event.push({ listen: "prerequest", script: { type: "text/javascript", exec: pre } });
  if (tests.length) event.push({ listen: "test", script: { type: "text/javascript", exec: tests } });
  return { name, event, request };
}

const login = (name, emailVar, tokenVar, extra = "") =>
  req(name, "POST", "/api/login", {
    body: `{\n  "email": "{{${emailVar}}}",\n  "password": "{{password}}"${extra}\n}`,
    tests: [
      "const body = pm.response.json();",
      "pm.test('Login succeeds (200) and returns a token', () => {",
      "  pm.response.to.have.status(200);",
      "  pm.expect(body.token).to.be.a('string');",
      "});",
      `pm.environment.set('${tokenVar}', body.token);`,
    ],
  });

const expectStatus = (code, label) => [
  `pm.test(${JSON.stringify(`${label} (HTTP ${code})`)}, () => pm.response.to.have.status(${code}));`,
];

function collection(name, description, items) {
  return { info: { name, description, schema: SCHEMA }, item: items };
}

// --- 1. Integration: AI forecasting module ---------------------------------
const integration = collection(
  "AutoVet - Integration Test: AI Forecasting Module",
  "Laravel API -> MySQL usage history -> Python (scikit-learn) forecast -> JSON back to the dashboard.",
  [
    login("Log in as clinic admin", "admin_email", "admin_token"),
    req("Read the item's current stock from MySQL", "GET", "/api/inventory/{{forecast_inventory_id}}", {
      token: "admin_token",
      tests: [
        "const body = pm.response.json(); const item = body.data || body;",
        "pm.test('Inventory record is returned (HTTP 200)', () => pm.response.to.have.status(200));",
        "pm.environment.set('db_stock_level', item.stock_level);",
        "pm.environment.set('db_min_stock_level', item.min_stock_level);",
      ],
    }),
    req("Run the AI stock-out forecast", "GET", "/api/inventory/{{forecast_inventory_id}}/forecast?history_days=365", {
      token: "admin_token",
      tests: [
        "const f = pm.response.json();",
        "pm.test('Forecast endpoint responds (HTTP 200) with JSON', () => {",
        "  pm.response.to.have.status(200);",
        "  pm.response.to.be.json;",
        "});",
        "pm.test('Python model ran: scikit-learn LinearRegression', () => {",
        "  pm.expect(f.prediction_status).to.eql('Success');",
        "  pm.expect(f.ml_algorithm).to.eql('scikit-learn LinearRegression');",
        "  pm.expect(f.regression_target).to.eql('cumulative_consumption_vs_day_index');",
        "});",
        "pm.test('Forecast used the stock stored in MySQL', () => {",
        "  pm.expect(Number(f.current_stock)).to.eql(Number(pm.environment.get('db_stock_level')));",
        "  pm.expect(Number(f.min_stock_level)).to.eql(Number(pm.environment.get('db_min_stock_level')));",
        "});",
        "pm.test('Learned a positive daily usage rate from the history', () => {",
        "  pm.expect(f.regression_slope).to.be.above(0);",
        "  pm.expect(f.average_daily_consumption).to.be.above(0);",
        "});",
        "pm.test('Model was validated on held-out data (80/20 split)', () => {",
        "  pm.expect(f.validation_method).to.eql('80/20 holdout');",
        "  pm.expect(f.trend_fit_score).to.be.within(0, 1);",
        "  pm.expect(f.rmse).to.be.at.least(0);",
        "  pm.expect(f.mae).to.be.at.least(0);",
        "});",
        "pm.test('Predicted stock-out date is a real future date', () => {",
        "  pm.expect(new Date(f.predicted_stockout_date) > new Date()).to.be.true;",
        "  pm.expect(f.days_until_stockout).to.be.above(0);",
        "});",
        "console.log(`Forecast for ${f.item_name}: ${f.average_daily_consumption}/day, stock-out ${f.predicted_stockout_date} (${f.days_until_stockout} days), R2=${f.trend_fit_score}, test R2=${f.test_r2}, RMSE=${f.rmse}, MAE=${f.mae}`);",
      ],
    }),
  ]
);

// --- 2. System: full patient journey ---------------------------------------
const journey = collection(
  "AutoVet - System Test: Patient Journey",
  "Client books online -> admin approves -> veterinarian adds medical record -> invoice is generated -> inventory deducts automatically.",
  [
    login("1. Client logs in to the portal", "client_email", "client_token", ',\n  "source": "portal"'),
    req("2. Client books an appointment online", "POST", "/api/appointments", {
      token: "client_token",
      pre: [
        "// A random weekday 9-365 days ahead and a random half-hour slot. The clinic",
        "// allows at most 2 bookings per pet per day, so a fixed date would make the",
        "// third run of the day fail (correctly) with 422.",
        "const d = new Date(); d.setDate(d.getDate() + 9 + Math.floor(Math.random() * 357));",
        "while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() + 1);",
        "pm.environment.set('booking_date', d.toISOString().slice(0, 10));",
        "const h = 8 + Math.floor(Math.random() * 8), m = Math.random() < 0.5 ? '00' : '30';",
        "pm.environment.set('booking_time', `${String(h).padStart(2, '0')}:${m}`);",
      ],
      body: '{\n  "pet_id": {{journey_pet_id}},\n  "service_id": {{journey_service_id}},\n  "date": "{{booking_date}}",\n  "time": "{{booking_time}}",\n  "notes": "Booked online - system test"\n}',
      tests: [
        "const a = pm.response.json();",
        ...expectStatus(201, "Booking is accepted"),
        "pm.test('Online booking starts as pending', () => {",
        "  pm.expect(a.status).to.eql('pending');",
        "  pm.expect(a.is_walk_in).to.eql(false);",
        "});",
        "pm.environment.set('appointment_id', a.id);",
      ],
    }),
    login("3. Clinic admin logs in", "admin_email", "admin_token"),
    req("4. Admin approves the booking", "POST", "/api/appointments/{{appointment_id}}/approve", {
      token: "admin_token",
      body: "{}",
      tests: [
        ...expectStatus(200, "Approval succeeds"),
        "pm.test('Appointment is now approved', () => pm.expect(pm.response.json().status).to.eql('approved'));",
      ],
    }),
    login("5. Veterinarian logs in", "vet_email", "vet_token"),
    req("6. Veterinarian adds the medical record", "POST", "/api/medical-records", {
      token: "vet_token",
      body: '{\n  "pet_id": {{journey_pet_id}},\n  "appointment_id": {{appointment_id}},\n  "chief_complaint": "Annual check-up and vaccination",\n  "findings": "Normal temperature, heart and lungs clear",\n  "diagnosis": "Healthy",\n  "treatment_plan": "Anti-rabies vaccine administered"\n}',
      tests: [
        "const r = pm.response.json();",
        ...expectStatus(201, "Medical record is saved"),
        "pm.test('Record is linked to the pet and the appointment', () => {",
        "  pm.expect(r.pet_id).to.eql(Number(pm.environment.get('journey_pet_id')));",
        "  pm.expect(r.appointment_id).to.eql(Number(pm.environment.get('appointment_id')));",
        "});",
        "pm.environment.set('medical_record_id', r.id);",
      ],
    }),
    req("7. Read inventory stock before billing", "GET", "/api/inventory/{{journey_inventory_id}}", {
      token: "admin_token",
      tests: [
        "const body = pm.response.json(); const item = body.data || body;",
        ...expectStatus(200, "Inventory item is found"),
        "pm.environment.set('stock_before', item.stock_level);",
        "pm.environment.set('item_price', item.selling_price);",
        "console.log(`Stock before billing: ${item.stock_level} x ${item.item_name}`);",
      ],
    }),
    req("8. System generates the invoice (finalized)", "POST", "/api/invoices", {
      token: "admin_token",
      pre: [
        "const qty = Number(pm.environment.get('journey_qty'));",
        "const price = Number(pm.environment.get('item_price'));",
        "const service = 400;",
        "pm.environment.set('item_amount', (qty * price).toFixed(2));",
        "pm.environment.set('invoice_total', (service + qty * price).toFixed(2));",
      ],
      body: '{\n  "pet_id": {{journey_pet_id}},\n  "appointment_id": {{appointment_id}},\n  "status": "Finalized",\n  "subtotal": {{invoice_total}},\n  "discount_type": "fixed",\n  "discount_value": 0,\n  "tax_rate": 12,\n  "total": {{invoice_total}},\n  "amount_paid": 0,\n  "items": [\n    { "item_type": "service", "service_id": {{journey_service_id}}, "name": "General Consultation / Check-up", "qty": 1, "unit_price": 400, "amount": 400 },\n    { "item_type": "inventory", "inventory_id": {{journey_inventory_id}}, "name": "Anti-rabies vaccine", "qty": {{journey_qty}}, "unit_price": {{item_price}}, "amount": {{item_amount}} }\n  ]\n}',
      tests: [
        "const inv = pm.response.json();",
        ...expectStatus(201, "Invoice is created"),
        "pm.test('Invoice is finalized with a number and the right total', () => {",
        "  pm.expect(inv.status).to.eql('Finalized');",
        "  pm.expect(inv.invoice_number).to.match(/^VB-/);",
        "  pm.expect(Number(inv.total)).to.eql(Number(pm.environment.get('invoice_total')));",
        "});",
        "pm.test('Invoice is flagged as having deducted stock', () => pm.expect(inv.stock_deducted).to.eql(true));",
        "console.log(`Invoice ${inv.invoice_number}: total ${inv.total}`);",
      ],
    }),
    req("9. Inventory was deducted automatically", "GET", "/api/inventory/{{journey_inventory_id}}", {
      token: "admin_token",
      tests: [
        "const body = pm.response.json(); const item = body.data || body;",
        "const before = Number(pm.environment.get('stock_before'));",
        "const qty = Number(pm.environment.get('journey_qty'));",
        ...expectStatus(200, "Inventory item is found"),
        "pm.test(`Stock went down by exactly ${qty}`, () => pm.expect(Number(item.stock_level)).to.eql(before - qty));",
        "console.log(`Stock after billing: ${item.stock_level} (was ${before})`);",
      ],
    }),
  ]
);

// --- 3. Security: role-based access control --------------------------------
const rbac = collection(
  "AutoVet - Security Test: Role-Based Access Control",
  "Each role can reach only what it is allowed to. Expected denials are the passing result.",
  [
    login("Log in as client (pet owner)", "client_email", "client_token", ',\n  "source": "portal"'),
    login("Log in as staff", "staff_email", "staff_token"),
    login("Log in as veterinarian", "vet_email", "vet_token"),
    login("Log in as clinic admin", "admin_email", "admin_token"),
    req("No token: appointments are not readable", "GET", "/api/appointments", {
      tests: expectStatus(401, "Unauthenticated request is rejected"),
    }),
    req("Client: cannot change clinic settings", "PUT", "/api/settings", {
      token: "client_token", body: { clinic_name: "Changed by client" },
      tests: expectStatus(403, "Client is forbidden from admin settings"),
    }),
    req("Client: cannot list staff accounts", "GET", "/api/users", {
      token: "client_token", tests: expectStatus(403, "Client is forbidden from user management"),
    }),
    req("Client: cannot read the audit trail", "GET", "/api/audit-logs", {
      token: "client_token", tests: expectStatus(403, "Client is forbidden from audit logs"),
    }),
    req("Client: cannot book for someone else's pet", "POST", "/api/appointments", {
      token: "client_token",
      body: '{\n  "pet_id": {{other_owner_pet_id}},\n  "service_id": 1,\n  "date": "2026-12-01",\n  "time": "10:00"\n}',
      tests: expectStatus(403, "Client is forbidden from another owner's pet"),
    }),
    req("Client: can open own portal overview", "GET", "/api/portal/overview", {
      token: "client_token", tests: expectStatus(200, "Client reaches own portal data"),
    }),
    req("Vet: creates a medical record (allowed)", "POST", "/api/medical-records", {
      token: "vet_token",
      body: '{\n  "pet_id": {{journey_pet_id}},\n  "chief_complaint": "RBAC test record",\n  "diagnosis": "N/A"\n}',
      tests: [
        ...expectStatus(201, "Veterinarian may create medical records"),
        "pm.environment.set('rbac_record_id', pm.response.json().id);",
      ],
    }),
    req("Staff: can view the medical record", "GET", "/api/medical-records/{{rbac_record_id}}", {
      token: "staff_token", tests: expectStatus(200, "Staff may read medical records"),
    }),
    req("Staff: cannot delete the medical record", "DELETE", "/api/medical-records/{{rbac_record_id}}", {
      token: "staff_token", tests: expectStatus(403, "Staff is forbidden from deleting medical records"),
    }),
    req("Staff: cannot create a medical record", "POST", "/api/medical-records", {
      token: "staff_token",
      body: '{\n  "pet_id": {{journey_pet_id}},\n  "diagnosis": "Should be refused"\n}',
      tests: expectStatus(403, "Staff is forbidden from writing medical records"),
    }),
    req("Staff: cannot change clinic settings", "PUT", "/api/settings", {
      token: "staff_token", body: { clinic_name: "Changed by staff" },
      tests: expectStatus(403, "Staff is forbidden from admin settings"),
    }),
    req("Clinic admin: cannot open super-admin clinic list", "GET", "/api/super-admin/clinics", {
      token: "admin_token", tests: expectStatus(403, "Clinic admin is forbidden from super-admin area"),
    }),
    req("Record still exists after the refused delete", "GET", "/api/medical-records/{{rbac_record_id}}", {
      token: "admin_token", tests: expectStatus(200, "Medical record was not deleted"),
    }),
  ]
);

const env = {
  name: "AutoVet QA (local)",
  values: Object.entries({
    base_url: "http://127.0.0.1:8010",
    password: "password123",
    admin_email: "admin@autovet.com",
    vet_email: "maria.santos@petwellness.ph",
    staff_email: "joy.mendoza@petwellness.ph",
    client_email: "andrea.villanueva@petwellness.ph",
    journey_pet_id: "98",
    other_owner_pet_id: "101",
    journey_service_id: "1",
    journey_inventory_id: "2",
    journey_qty: "1",
    forecast_inventory_id: "32",
  }).map(([key, value]) => ({ key, value, type: key === "password" ? "secret" : "default", enabled: true })),
  _postman_variable_scope: "environment",
};

const out = __dirname;
const write = (file, data) => fs.writeFileSync(path.join(out, file), JSON.stringify(data, null, 2));
write("01-Integration-AI-Forecast.postman_collection.json", integration);
write("02-System-Patient-Journey.postman_collection.json", journey);
write("03-Security-RBAC.postman_collection.json", rbac);
write("AutoVet-QA.postman_environment.json", env);
console.log("written to", out);
