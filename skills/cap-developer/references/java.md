# CAP Java — runtime-specific guidance

Read this file when the project is a CAP Java app (Maven `pom.xml`, `srv/` module, `mvn cds:watch`).
The parent `SKILL.md` covers shared CDS modeling, declarative annotations, sample data, and the
"Don't" list — this file only covers what is Java-specific.

## Project Initialization

When starting a new Java project, run:

```sh
cds init <name> --java
cd <name>
mvn cds:watch          # start the dev loop
```

**Important**: `cds init <name>` always creates a **subdirectory** named `<name>` inside the current
working directory. If you need the project files at a specific location, either:
- Run `cds init <name>` and then `cd` into the created folder, OR
- Run `cds init` to directly initialize inside the current working directory

### Maven project structure

`cds init --java` creates a multi-module Maven project:
- **Root `pom.xml`** — parent POM (packaging `pom`), contains `<modules>` with the `srv` submodule.
- **`srv/pom.xml`** — the Spring Boot application module (packaging `jar`), depends on parent.

**Critical**: Always run Maven goals from the **project root** directory (where the parent
`pom.xml` lives), never from `srv/` directly. The maven-enforcer-plugin's
`ReactorModuleConvergence` rule will fail if you run from a submodule.

```sh
# Correct — from project root:
mvn compile
mvn spring-boot:run

# WRONG — from srv/ directory or using -pl srv:
mvn spring-boot:run -pl srv   # ReactorModuleConvergence will fail
cd srv && mvn compile          # will fail
```

### CDS Projection Syntax

**Actions returning service entities** — an unbound action can `returns` a service entity by name.
The entity must be defined in the same service (order doesn't matter in CDS):

```cds
service CatalogService {
  action submitOrder(items: many { book_ID: UUID; quantity: Integer; }) returns Orders;
  entity Orders as projection on db.Orders;
}
```

## Custom Handlers

When writing custom handlers, follow these best practices:
- Register via `@Before`, `@On`, `@After` and let CAP Java auto-detect the event and entity via
  reflection if they are present in the method signature; avoid manually checking the event type
  or entity name in the handler body
  - The handler signature can already contain information on the event, do not duplicate it in the
    method annotation. For example:
    - `@Before(event = CqnService.EVENT_READ) public void beforeRead(Stream<Books> books)` => event: `READ`, entity: `Books_`
    - `@On public void onRead(CdsReadEventContext context, List<Books> books)` => event: `READ`, entity: `Books_`
    - `@After(entity = Books_.class) public void afterRead(CdsReadEventContext context)` => event: `READ`, entity: `Books_`
  - Prefer typed classes over strings:
    - `@On(entity = Books_.class)` with `cds.gen.catalogservice.Books_` => entity: `CatalogService.Books`
    - `@On public submitOrder(SubmitOrderContext)` with `cds.gen.catalogservice.SubmitOrderContext` => event: `submitOrder`

### Important API facts

- **Generated typed service interfaces** — for every CDS-modeled service the code generator emits
  a typed interface, e.g. `service CatalogService` → `cds.gen.catalogservice.CatalogService`. It
  extends `CqnService` and exposes typed methods for each declared action/function, plus nested
  `Application` / `Remote` sub-interfaces (`CatalogService.Application extends ApplicationService,
  CatalogService`). **Inject the generated interface by type** rather than looking up a service by
  name/qualifier — you get compile-time-checked action calls and typed parameters:
  ```java
  @Autowired CatalogService catalog;   // cds.gen.catalogservice.CatalogService

  // typed bound-action call — no string lookups, parameters and return type are checked
  Books_ ref = CQL.entity(Books_.class).filter(b -> b.ID().eq(bookId));
  Reviews r = catalog.review(ref, 5);
  ```
  Use this for service-tier calls (invoking actions/functions, triggering events through the full
  handler chain). **Prefer the application/CQN service over `PersistenceService` whenever you can.**
- **`PersistenceService` bypasses the application service layer** — going through `PersistenceService`
  (or any service-tier query routed straight at the database) skips everything that the application
  service would normally apply: `@Before`/`@On`/`@After` handlers on the target service, input
  validation, `@assert.*` constraints, `@mandatory` / `@readonly` / `@insertonly` checks,
  authorization from `@requires` / `@restrict`, field-level `@restrict.grant`, computed elements,
  default values from `@cds.on.insert` / `@cds.on.update`, managed associations resolution,
  localization, and draft handling. The data lands in the database raw. Reach for
  `PersistenceService` only when you genuinely need that — e.g. internal bookkeeping a custom
  handler is itself implementing, atomic DB-side arithmetic (see the race-condition note below), or
  reading/writing technical tables not exposed as a service. For anything that represents business
  logic on a modeled entity, inject the generated typed service interface and let the framework run
  the full handler chain.
- **`CdsService` does not exist** — `CqnService` is still the source of event constants
  (`CqnService.EVENT_READ`, `CqnService.EVENT_CREATE`, etc.). Import:
  `com.sap.cds.services.cds.CqnService`. You don't need to inject `CqnService` directly — the
  generated typed service interface extends it, so the constants are available on any service
  reference you already hold.
- **`CqnReference.Segment`** only has `id()` and `filter()` — it does NOT have a `keys()` method.
  To extract keys from a bound action or entity reference, use `CqnAnalyzer`:
  ```java
  CqnAnalyzer analyzer = CqnAnalyzer.create(context.getModel());
  // For bound actions — extract keys from the CQN statement:
  AnalysisResult result = analyzer.analyze(context.getCqn());
  String id = (String) result.targetKeys().get("ID");
  ```
- **Typed vs. untyped query results** — `CqnService.run()` has two overload families:
  - `run(CqnSelect)`, `run(CqnInsert)`, ... (untyped, e.g. from `CQL.parse(...)`) → returns `com.sap.cds.Result`
  - `run(Select<T>)`, `run(Insert<T>)`, ... (typed, e.g. from `Select.from(Books_.class)`) → returns `com.sap.cds.CdsResult<D>`

  `CdsResult<D>` is **not** a subtype of `Result`. Do not assign a typed query result to a `Result`
  variable — it will not compile. Use the correct type:
  ```java
  // CORRECT — typed select returns CdsResult<Books>
  CdsResult<Books> books = db.run(
      Select.from(Books_.class).where(b -> b.ID().eq(id))
  );
  Books book = books.single();          // typed accessor
  List<Books> list = books.list();      // typed list
  books.stream().forEach(b -> ...);    // typed stream

  // ALSO CORRECT — untyped CqnSelect returns Result
  Result result = db.run(Select.from("bookshop.Books").where(...));
  result.single(Books.class);           // manual mapping
  ```
  **Rule**: When using `Select.from(Entity_.class)`, always declare the variable as `CdsResult<Entity>`.

  The same applies to typed `Update`: `run(Update<T>)` returns `CdsResult<D>`, not `Result`.
- **Error handling in `@On` handlers** — two patterns:
  - `throw new ServiceException(ErrorStatuses.XXX, "msg")` — aborts immediately with the given HTTP
    status. Use for validation failures where you want a clean error response. Common statuses:
    `ErrorStatuses.CONFLICT` (409), `ErrorStatuses.NOT_FOUND` (404), `ErrorStatuses.BAD_REQUEST`
    (400). Import: `com.sap.cds.services.ErrorStatuses`
  - `messages.error("msg")` — collects errors without aborting. **Important**: if you use
    `messages.error()` inside an `@On` handler and then `return`, you **must** still call
    `context.setCompleted()` before returning. Otherwise the framework will add a confusing
    "No ON handler completed the processing" wrapper error. Prefer
    `throw new ServiceException(...)` for immediate validation failures in `@On` handlers.
- Prefer autowired injection by class over injection by `@Qualifier`. Default to the generated
  typed service interface (e.g. `@Autowired CatalogService catalog`) — it runs the full handler
  chain, applies authorization and validation, and gives you typed action/function calls. Only fall
  back to `@Autowired PersistenceService db` when you specifically need to bypass that layer for
  DB-tier work (see the `PersistenceService bypasses the application service layer` note above).
- Rely on CAP's intrinsic transaction handling — no manual transactions
- Minimize DB round-trips:
  - Combine checks into the query itself rather than SELECT + check + UPDATE
  - Avoid selecting in a loop. Instead expand over associations via the query api
- Push down to the database: Rather than pull data into memory to then aggregate on it, build a
  purposeful query using the CAP Java query API.
- **Avoid race conditions in updates** — never read a value, compute a new value in Java, then
  write it back. Another request can read the same stale value between your read and write.
  Instead, push arithmetic to the database using the typed Update API:
  ```java
  // WRONG — race condition: two concurrent requests both read stock=10,
  // both compute 10-1=9, both write 9 (one decrement is lost)
  int newStock = book.getStock() - quantity;
  db.run(Update.entity(Books_.class)
      .where(b -> b.ID().eq(bookId))
      .data(Books.STOCK, newStock));

  // CORRECT — atomic: the decrement is a single SQL statement (SET stock = stock - ?)
  // executed transactionally by the database; no lost updates possible
  db.run(Update.entity(Books_.class)
      .where(b -> b.ID().eq(bookId))
      .set(b -> b.stock(), s -> s.minus(quantity)));
  ```
  This pattern applies to any read-modify-write cycle: counters, stock levels, balances, sequence
  numbers. Always use `.set(field, expr)` with CQN expressions to push the operation down to SQL.

## Generated Code and Build

After `mvn compile`, CDS model classes are generated into `srv/src/gen/java/`. These are typed
accessor interfaces for your CDS entities. Key patterns:

- **Entity interfaces**: `cds.gen.<servicename>.<EntityName>` — getters/setters for entity elements
- **Entity metadata**: `cds.gen.<servicename>.<EntityName>_` — static CDS element references for
  queries (e.g. `Books_.ID`, `Books_.TITLE`)
- **Action/function contexts**: `cds.gen.<servicename>.<ActionName>Context` — typed context for
  bound/unbound actions

**Always build before writing handlers** — you need the generated types to write correct imports:

```sh
mvn compile    # triggers CDS build + Java code generation
```

Then inspect `srv/src/gen/java/` to see the exact generated class names and available methods
before writing handler code. This avoids guessing at API shapes.

## Running and Verifying

### Starting the application

Always start from the project root:

```sh
mvn spring-boot:run
```

The OData servlet is mounted at `/odata/v4`. Service paths come from `@path` annotations in CDS:
- `service CatalogService @(path: '/browse')` → `http://localhost:8080/odata/v4/browse/`
- `service AdminService @(path: '/admin')` → `http://localhost:8080/odata/v4/admin/`
- Without `@path`, it uses the service name: `CatalogService` → `/odata/v4/CatalogService/`

### Verifying the app in CI / benchmarks

When running the app in background to test endpoints:

```sh
# 2. Start in background, redirect output for debugging
mvn spring-boot:run > /tmp/app_output.log 2>&1 &
APP_PID=$!

# 3. Poll until the OData service responds (use an actual service endpoint, NOT /odata/v4/ which returns 404)
for i in $(seq 1 30); do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/odata/v4/browse/Books 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ]; then
        echo "OData service is ready (HTTP $HTTP_CODE)"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "TIMEOUT — last 30 lines of log:"
        tail -30 /tmp/app_output.log
    fi
    sleep 2
done

# 4. Test endpoints...
curl -s http://localhost:8080/odata/v4/browse/Books

# 5. Clean up
kill $APP_PID 2>/dev/null
wait $APP_PID 2>/dev/null
```

**Port notes**:
- The default port is **8080**. Override with `-Dspring-boot.run.arguments="--server.port=8080"` if needed.
- A previous version may already be running, blocking the port.
- **Critical**: The `/odata/v4/` root path returns **404** — it is NOT a valid health-check
  endpoint. Always poll an actual service entity endpoint like `/odata/v4/browse/Books`. A `200`
  means the service is ready; a `401` means authentication is required (service is up but needs
  credentials). A `000` (no response) or connection refused means the server hasn't started yet.
- A 404 on `/odata/v4/browse/Books` with the error "No static resource" means your request hit
  Spring's **static resource handler** not the CDS servlet — this indicates the CAP OData servlet
  is not yet registered or port is occupied by a different process.

## Mock Users for Development

CAP Java uses Spring Security with mock users for local development. **Two things are required**:

### Add the Spring Security dependency to `srv/pom.xml`

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

**Critical**: Without this dependency, mock users will NOT work — all requests with `-u user:pass`
will get `401 "You need to be logged in"` even though the app starts successfully. The
`cds-starter-spring-boot` does NOT include Spring Security automatically.

Do **not** use `cds-feature-identity` for local mock auth — it requires additional runtime
dependencies that may not be locally cached. Use `spring-boot-starter-security` which is managed
by the Spring Boot parent BOM and is always resolvable.

### Configure mock users in `srv/src/main/resources/application.yaml`

```yaml
---
spring:
  config.activate.on-profile: default
  sql.init.platform: h2
cds:
  data-source.auto-config.enabled: false
  security:
    mock:
      users:
        alice:
          password: "..."  # omit unless explicitely requested
          roles:
            - admin
        bob:
          roles:
            - user
```

**Key points**:
- The password is an empty string by default — allows `curl -u alice:` without a password.
- Role names must match what your `@requires` / `@restrict` annotations expect.
- The `authenticated-user` pseudo-role in `@requires` / `@restrict` applies to every authenticated user.
- In CAP Java, services by default require an authenticated user.
- Without this config, an authenticated endpoint can still be queried using `curl -u authenticated:`

## HTTP Test Files

Use `cds add http` to generate `.http` test files (compatible with VS Code REST Client and
IntelliJ HTTP Client):

```sh
cds add http
```

This creates `test/http/<ServiceName>.http` for each service, with placeholder requests for all
entities and actions.

**After generating**, customize the files:
1. Replace placeholder data with realistic values matching your seed data (use actual IDs from CSV
   files).
2. Set `@username` to the correct mock user index for the service's authorization level.
3. For roundtrip scenarios, chain requests using response variables:
   ```http
   @server=http://localhost:8080
   @username=alice
   @password=

   ### Admin creates a new book
   # @name createBook
   POST {{server}}/odata/v4/admin/Books
   Content-Type: application/json
   Authorization: Basic {{username}}:{{password}}

   {
     "title": "New Book",
     "author_ID": "existing-author-uuid",
     "price": 19.99,
     "stock": 50
   }

   ### Customer browses (uses different user)
   # @name browseBooks
   GET {{server}}/odata/v4/browse/Books?$filter=title eq 'New Book'
   Authorization: Basic bob:
   ```

4. The generated files include `GET`, `POST`, `PATCH`, `DELETE` for entities and `POST`, `GET` for
   actions/functions. Remove operations that your service doesn't allow (e.g., remove
   `PATCH`/`DELETE` from `@readonly` entities).