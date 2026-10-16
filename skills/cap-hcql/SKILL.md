---
name: cap-hcql
description: Use when querying CAP services via HCQL protocol endpoints with POST requests and plain text CQL statements in the body. Also read the cap-cql skill!
license: Apache-2.0
---

# The HCQL Protocol

Query CAP services via HCQL (*CQL over HTTP*): send CQL statements as plain text POST bodies. Base URL: `http://localhost:<port>/<service's hcql endpoint>`.
Note: Port isn't always 4004.

**IMPORTANT:** Ensure to read the `cap-cql` skill to use CQL correctly!


## Inspect what a service provides

Send `/?describe` requests to a service's HCQL endpoint, to receive metadata and schema information. For example:

```http
GET /hcql/admin/?describe=Books,Authors
```
⇒ returns detailed metadata about the given entities and their elements 

```http
GET /hcql/admin/?describe=all
```
⇒ returns detailed metadata about all entities

```http
GET /hcql/admin/?describe
```
⇒ compact overview with just names of entities


```
{
  service: name,
    entities: { <name>: { kind:'entity', elements } },
    actions: { <name>: { kind:'action', params, returns } },
}
```

 Associations in `elements` show as e.g. *`{ type: "Association to many Books" }`*

## Understanding Foreign Keys and Associations

When working with associated entities, **inspect the entity metadata** to identify correct field names. Use the HCQL `?describe=` endpoint against the base URL derived above:

```bash
curl "<baseUrl>/?describe=Books"     # e.g. http://localhost:<port>/hcql/admin/?describe=Books
```

This reveals which fields are associations and what their key is. For example:

```json
{
  "currency": { "type": "Association to Currencies" },
}
```

- **Association field name** (`currency`) - use this in expansions: `SELECT from Books { ..., currency.code }`

The foreign key might be:
- The association name + `_ID` (e.g., `currency_ID`)
- The key field of the target entity (e.g., `currency_code` if Currencies uses `code` as key)
- Check the metadata to be sure; don't assume

## Querying

### CQL Text Method (Plain Text Body)

POST a CQL SELECT statement in plain text body:

```http
POST http://localhost:4004/hcql/admin
Content-Type: text/plain

SELECT from Authors { ID, name, ... }
```

- **Always** fetch only the elements required. **Don't** do SELECT *!

- Use the `cap-cql` skill for query syntax, including association traversal and nested expands.

Concrete `curl` invocation (note `Content-Type: text/plain` and the CQL in the body):

```bash
curl -s "http://localhost:4004/hcql/admin" \
  -H "Content-Type: text/plain" \
  --data 'SELECT from Authors { ID, name }'
```

### JSON Method (Entity Path + JSON Body)

Alternatively, POST JSON directly to the entity path for creating nested structures:

```http
POST http://localhost:4004/hcql/admin/Books
Content-Type: application/json

{
  "title": "The Book",
  "author": { "ID": 150 },
  "genre": { "code": "a1223..." },
  "price": 9.99
}
```

This method is particularly useful for **INSERT operations with nested compositions**. For example, creating hierarchical data with children:

```http
POST http://localhost:4004/hcql/admin/Genres
Content-Type: application/json

{
  "name": "Science Fiction",
  "children": [
    { "name": "Cyberpunk" },
    { "name": "Hard Sci-Fi" }
  ]
}
```

**Choice of method:**
- Use **CQL text** for queries (SELECT), filtering, and association traversal
- Use **JSON path** for simpler INSERTs, especially with nested compositions
- Use **JSON path** for **any write whose text values contain apostrophes or quotes** — it avoids CQL string escaping, which can silently corrupt data

> [!important] Validate values against declared types before writing
> The `?describe=` metadata carries each element's type, e.g. `{ "code": { "key": true, "type": "String(5)" } }`. Keys and codes are commonly length-limited. **Check every value against its declared type/length before writing** — otherwise the write fails with `ASSERT_DATA_TYPE` (e.g. a 6-char code rejected against `String(5)`, or a region code rejected against a country's `String(3)`).

> [!warning] Composition sub-paths may not backfill the parent link
> Nested compositions reliably set the parent/backlink field only when written as **one nested body on the parent entity** (e.g. `POST /Countries` with `{ ..., "regions": [ ... ] }`). POSTing directly to a composition **sub-path** (e.g. `POST /Regions/GBENG/children`) may create the child **without** populating its backlink FK (e.g. `_parent` stays `null`). Read the child back; if the FK is empty, set it explicitly with a CQL `UPDATE` (see below). Also note an array body posted to a sub-path may be rejected — post child objects individually.

### Updating via JSON (`PATCH`)

To update a single record without CQL string escaping, `PATCH` the keyed entity path with a JSON body of just the changed fields:

```http
PATCH http://localhost:4004/hcql/admin/Books/272
Content-Type: application/json

{ "descr": "Wilde's 1895 comedy of manners...", "price": 8.99 }
```

This is the safest way to write free text (descriptions, names like `O'Brien`). Prefer it over plain-text `UPDATE ... with { descr: '...' }` for such values.

> [!warning] Keyed JSON paths assume a single key named `ID`
> `PATCH`/`POST /Entity/<value>` (and the `Books/272` form above) assume the entity has a single key element named `ID`. For entities keyed by a differently-named field (e.g. `code`), these fail (e.g. `"ID" not found in ...`), and a plain `POST` to the keyed path may be treated as a create/replace (yielding NOT NULL errors). For such entities, update via CQL instead: `UPDATE <Entity> set <field> = '...' where <key> = '...'`.


## Actions

Call provided actions like that:

```http
POST http://localhost:4004/hcql/admin/<action>
Content-Type: application/json

{ ...arguments }
```

- A `2xx` response means successful; even without any output returned.

## Responses

- Success: results in `data` → `{ "data": [ {...}, ... ] }`
- Error: details in `errors` → `{ "errors": [ { code, message, ... } ] }`
- **Text writes:** always read the value back after writing — malformed CQL escaping can store corrupted text (e.g. doubled apostrophes) with a `2xx`/`affected: 1` and **no error**.
- **Empty response body during reload:** when the server is restarting/redeploying (e.g. `cds watch` reacting to a file change — including a CSV edit), requests may return an **empty body**, which is *not* valid JSON and will break naive parsers. This is transient, not an error. **Poll until you get a non-empty JSON response** (~1s intervals) before treating a call as failed.
- On `401`, use basic auth with a local mock user — e.g. `alice` or `bob` with an empty password:
  ```bash
  curl -s -u alice: "http://localhost:4004/hcql/admin" \
    -H "Content-Type: text/plain" \
    --data 'SELECT from Authors { ID, name }'
  ```
