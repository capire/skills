---
name: cap-hcql
description: Use to query CAP services via HCQL (CQL over HTTP), including CRUD and action calls. Also read the cap-cql skill!
license: Apache-2.0
---
# HCQL — CQL over HTTP

## Fast, Reliable Workflow

Given the server URL and HCQL endpoints are known, e.g. from `cds bindings`:

1. Inspect needed schema at once with: `GET /?describe=Books,submitOrder`.
2. Reuse that info; refresh on endpoint/model changes or unresolved references.
3. Use **[REST-style requests](#rest-style-requests) for simple reads/writes; [Full CQL](#full-cql-requests) for complex ones**.
4. Use discovered names/types, don't guess; use bindings for string-escaping issues.
5. Don't fetch-and-loop! → filter, navigate, expand, and aggregate in queries.
6. Avoid `SELECT *`; fetch needed columns only and `limit` rows.
7. Check HTTP status before parsing. Correct invalid requests; never blindly retry!

See `cap-cql` for details on CQL syntax and `cap-inner-loop` for service and endpoint discovery using `cds bindings`, and for starting/stopping CAP servers.

## Discovery and Schema

Paths below are relative to that server.

```http
GET /?describe=Books,Authors
```

Examples in here show service-local paths. Prefix them with the discovered server address, e.g., `http://localhost:4004` and HCQL endpoint, e.g., `/hcql/admin` to get full URLs.

## REST-style Requests

Use REST-style requests for reads with selected columns/paths, filtering, ordering and pagination, and for writes with JSON payloads:

| Method + path        | Operation       | Body                            |
| -------------------- | --------------- | ------------------------------- |
| GET `/entity/:id`    | Read single row | None                            |
| GET `/entity`        | Read many rows  | None                            |
| POST `/entity`       | INSERT          | JSON object or array            |
| PUT `/entity/:id`    | UPSERT          | JSON object with all keys       |
| PATCH `/entity/:id`  | UPDATE          | JSON object with changed fields |
| DELETE `/entity/:id` | DELETE          | None                            |

- PATCH/DELETE address one row by its key; see [limitations](#limitations-and-validation) for key constraints.

### Simple reads with query parameters

```http
GET /Books/201?$select=ID,title,author.name
GET /Books?$select=ID,title&$search=foo&$orderby=ID&$top=20
```

- Supports: `$select`, `$where`, `$search`, `$orderby`, `$top`, `$skip` – lowercase, url-encoded.
- **Values use CQL expressions**, not OData syntax (`stock > 0`, not `stock gt 0`).
- For [full-text search](#full-text-search), use `$search=<term>`; or CQL variant to combine with other predicates.

### Writes with JSON payloads

```http
PATCH /Books/201
Content-Type: application/json

{ "stock": 23, "author": { "ID": 101 } }
```

- Nested writes expand along **compositions** only, not arbitrary associations.
- We can write an association's nested **foreign keys** – e.g. as above with `{ID:101}`
- For bulk inserts, POST one JSON array rather than looping:

```http
POST /Books
Content-Type: application/json

[
  { "ID": 222, "title": "Silmarillion" },
  { "ID": 223, "title": "The Hobbit" }
]
```

### Deep updates

**PATCH with a composition collection deletes unlisted children.** See [Deep Updates in cap-cql](../cap-cql/SKILL.md#deep-updates).
In JSON, `[]` clears a to-many composition; `null` removes a to-one composition.


## Full CQL Requests

Use CQL for complex requests. POST to **service root** as JSON with `cql` and optional `args`:

```http
POST /
Content-Type: application/json

{
  "cql": "...",
  "args": [...]
}
```

With `cql` and `args` like that:

```sql :cql
SELECT from Books { ID, title, author { ID, name } }
where stock > ? and author.name = ?
order by ID
limit 20
```
```json
[0, "O'Brien"]
```

See `cap-cql` for syntax and [limitations and validation](#limitations-and-validation) for outward-facing query safeguards.

### Binding parameters

CQL accepts positional `?`, as well as indexed `?n` and named `:name` binding parameters, which we can use like that:

```json
{"cql":"SELECT from Books[?] { ID, title }","args":[201]}
{"cql":"SELECT from Books[?1] { ID, title } where stock >= ?2","args":[201,1]}
{"cql":"SELECT from Books[:ID] { ID, title } where stock >= :minimum","args":{"ID":201,"minimum":1}}
```

Bindings require the Core QL parser (`compatible` or `cap.core`), not the compiler fallback.

## Full-text Search

Use `$search` for full-text searches across multiple fields, in REST requests, and CQL:

```http
GET /Books?$search=pro
```

```sql :cql
SELECT ID, title from Books where $search like 'poe' limit 20
```

- No SQL LIKE wildcards required


## Calling Actions and Functions

```http
POST /submitOrder
Content-Type: application/json

{ "book": 201, "quantity": 1 }
```

- Discover unbound signatures with `/?describe=<operation>`. They can also be called at the service root with `{"cql":"CALL submitOrder with { book: 201, quantity: 1 }"}`.
- Discover instance-bound signatures with `/?describe=<entity>` under `entities.<entity>.actions`; call `/<entity>/<id>/<operation>` with operation arguments in the JSON body or query parameters.
- Prefer POST for actions; URL-encode instance keys. The URL key identifies the instance; arguments do not override it.

## Localized Data

CAP services serve localized data for fields marked `localized:true` in schemas.  
Simply set `Accept-Language` to the user's language, if not English:

```http
GET /Books?$select=ID,title&$search=bront
Accept-Language: de
```

**Write localized data** using implicit `texts` associations in *CQL*, with values `ID, locale` as primary keys; use a language-only locale  – e.g., `de`, not `de-DE`:

```sql :cql
UPDATE Books:texts[201,'de'] with {
  title: 'Sturmhöhe', descr: 'Emily Brontë wrote ...'
}
```

You can also read from `<entity>:texts`:

```sql :cql
SELECT from Books:texts[201,'de'] { title }
SELECT locale, title from Books:texts where ID=201
```

## Limitations and Validation

### Outward-facing HCQL

Default query validation protects endpoints used by external clients and agents:

- Targets and navigation stay within exposed service entities, including generated `texts`. Managed associations to non-exposed targets allow discovered foreign-key fields only, not target data or wildcards.
- References and expressions are checked in all clauses, including infix filters, nested projections, search, and pagination. JOINs, UNIONs, subqueries (including INSERT/UPSERT sources), subject aliases, malformed CQN, raw SQL fragments, and non-allowlisted functions or pseudo variables are rejected.
- UPDATE/DELETE require complete positional keys on the **final target**. `UPDATE … SET` is disallowed, including literal assignments; use PATCH or `UPDATE … with { … }`, or a modeled action for atomic business updates.
- Pass untrusted binding values as scalar data, not CQN expressions. Do not relax server guards merely to make a client request succeed.

Selective server opt-ins: `cds.protocols.hcql.allows.UPDATE.with = true` permits SET; `allows.UPDATE.many = true` and `allows.DELETE.many = true` permit bulk writes. Function and pseudo-variable allowlists use `allows.functions` and `allows.pseudos`.

### Trusted internal service-to-service HCQL

Set `cds.protocols.hcql.allows.cqn.any = true` **before server startup** to bypass HCQL query validation and its restrictions. Prefer CQN for query shapes beyond the CQL parser's supported syntax. Use only for trusted internal endpoints, never as a client-side workaround.

This bypass does **not** disable body parsing, HTTP routing, application-service authorization, or input validation. These protocol constraints still apply:

- CQL text must parse; comments are rejected. Bindings require the Core QL parser.
- REST `/:entity/:id` routes require exactly one key; use CQL/CQN for composite-key data requests.
- Operation routes accept GET/POST only. Instance calls require one key and do not support collection-bound operations; modeled root CALL supports unbound operations only.
- `$search like ?` belongs in the top-level WHERE and combines with other predicates using `and` only.

## Responses

Query/action responses use `{ data: ... }`; failures use `{ errors: [...] }`. Responses may include `messages`; a nullish result with messages omits `data`.

| Status | Handling                                                                           |
| ------ | ---------------------------------------------------------------------------------- |
| 2xx    | Success; INSERT returns **201**.  Don't assume writes to return full records.      |
| 200    | Empty collections return `{data:[]}`.                                             |
| 204    | Nullish result without messages, including missing single-row reads. **No body: do not parse JSON.** |
| 400    | Fix syntax, bindings, schema names, or request form using the error message.       |
| 401    | Ask the user for user name; no pwd required – **do not guess** or retry unchanged. |
| 403    | Authorization or write guard denied the request; **do not bypass** it.             |
| 404    | Missing to-one writes or unknown bound-operation paths; not the normal missing-read response. |
