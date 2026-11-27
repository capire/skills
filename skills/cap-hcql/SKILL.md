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

- `/:id` requires a single-field primary key; use CQL for composite-key lookups.
- PATCH/DELETE address one row by its key. 

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

- HCQL rejects JOINs, UNIONs, sub-selects, comments, and unknown functions.
- UPDATE/DELETE must be to-one → provide complete keys on the **final target**.
- Find more details in `cap-cql`.

### Binding parameters

CQL accepts positional `?`, as well as indexed `?n` and named `:name` binding parameters, which we can use like that:

```json
{"cql":"UPDATE Books[?] set stock -= ? where stock >= ?","args":[201,1,1]}
{"cql":"UPDATE Books[?1] set stock -= ?2 where stock >= ?2","args":[201,1]}
{"cql":"UPDATE Books[:ID] set stock -= :quantity where stock >= :quantity",
"args":{"ID":201,"quantity":1}}
```

## Full-text Search

Use `$search` for full-text searches across multiple fields, in REST requests, and CQL:

```http
GET /Books?$search=pro
```

```sql :cql
SELECT ID, title from Books where $search like 'poe' limit 20
```

- Use `$search like ?` in the **top-level** `where` clauses only
- No SQL LIKE wildcards required
- Combine with other predicates using **`and` only**


## Calling Actions

```http
POST /submitOrder
Content-Type: application/json

{ "book": 201, "quantity": 1 }
```

- Inspect arguments using `/?describe=<operation>` on the service. 
- Only unbound actions – not entity-bound ones

## Localized Data

CAP services serve localized data for fields marked `localized:true` in schemas.  
Simply set `Accept-Language` to the user's language, if not English:

```http
GET /Books?$select=ID,title&$search=bront
Accept-Language: de
```

**Write localized data** using implicit `texts` associations in *CQL*, with values `ID, locale` as primary keys; use a language-only locale  – e.g., `de`, not `de-DE`:

```json
{
  "cql": "UPDATE Books:texts[201,'de'] set title = ?, descr = ?",
  "args": [ "Sturmhöhe", "Emily Brontë wrote ..." ]
}
```

You can also read from `<entity>:texts`:

```sql :cql
SELECT from Books:texts[201,'de'] { title }
SELECT locale, title from Books:texts where ID=201
```


## Responses

Query/action responses use `{ data: ... }`; failures use `{ errors: [...] }`.

| Status | Handling                                                                           |
| ------ | ---------------------------------------------------------------------------------- |
| 2xx    | Success; INSERT returns **201**.  Don't assume writes to return full records.      |
| 200    | With `{data:[]}` for non-matched filters; `{data:null}` for to-one reads.          |
| 204    | Null result w/o data or messages. – **no body: do not parse JSON.**                |
| 400    | Fix syntax, bindings, schema names, or request form using the error message.       |
| 401    | Ask the user for user name; no pwd required – **do not guess** or retry unchanged. |
| 403    | Authorization or write guard denied the request; **do not bypass** it.             |
| 404    | Not found, including missing to-one writes; not the normal missing-read response.  |
