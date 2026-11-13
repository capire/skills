# CAP Java — runtime-specific guidance

Read this file when the project is a CAP Java app (Maven `pom.xml`, `srv/` module, `mvn cds:watch`).
Shared, runtime-agnostic guidance lives in sibling references — `cds-modeling.md`,
`declarative.md`, `custom-logic.md`, `sample-data.md` — and the "Don't" list is in `SKILL.md`.
This file only covers what is Java-specific.

## Project Initialization

When starting a new Java project, run:

For SDK 5.0, use JDK 21+ and Maven 3.9.14+. Newly generated projects default to JDK 25;
match the installed JDK to the generated POM or deliberately adjust its release configuration.
For older projects, inspect their POM and supported toolchain rather than applying current defaults.
See [SDK 5.0 migration prerequisites](https://cap.cloud.sap/docs/java/migration).

```sh
cds init <name> --java
cd <name>
mvn cds:watch          # start the dev loop
```

**Important**: `cds init <name>` always creates a **subdirectory** named `<name>` inside the current
working directory. If you need the project files at a specific location, either:
- Run `cds init <name>` and then `cd` into the created folder, OR
- Run `cds init --java` to directly initialize inside the current working directory

### Maven project structure

`cds init --java` creates a multi-module Maven project:
- **Root `pom.xml`** — parent POM (packaging `pom`), contains `<modules>` with the `srv` submodule.
- **`srv/pom.xml`** — the Spring Boot application module (packaging `jar`), depends on parent.

For a newly generated project, start with the documented commands from the **project root**:

```sh
mvn compile
mvn spring-boot:run
```

Module selection (`-pl`, `-am`) and submodule commands depend on the POM, effective plugin
configuration, and goal. Do not diagnose every `-pl srv` invocation as a reactor failure:
inspect the actual Maven error and project configuration. Some documented workflows run
from `srv/`, such as `mvn cds:auto-build`. See [running Java applications](https://cap.cloud.sap/docs/java/developing-applications/running).

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
- Register via `@Before`, `@On`, `@After` on an `EventHandler` bean for the intended service.
  Event inference comes from a **typed event context**, entity inference from **typed entity data**.
  `List<Orders>` alone can infer Orders, not CREATE. A method name does not choose the event.
  - `@Before(event = CqnService.EVENT_CREATE) public void validate(List<Orders> orders)` keeps
    CREATE explicit while inferring the entity.
  - `@Before public void validate(CdsCreateEventContext context, List<Orders> orders)` can infer both.
  - `@After(entity = Books_.CDS_NAME) public void afterRead(CdsReadEventContext context)` infers READ
    from the context and explicitly selects the generated service entity name.
  - Handler annotation `entity` attributes take CDS-name **strings**, not `Books_.class` literals
    (SDK 5.0). Prefer generated `Books_.CDS_NAME` over handwritten names. Query builders still use
    typed classes, e.g. `Select.from(Books_.class)`.
  - `@On public void submitOrder(SubmitOrderContext context)` infers the custom action from its
    generated context. Inspect the exact generated name, especially for bound actions.
  Missing event information is a registration error, not an inferred CREATE handler.
  See [handler annotations and signature inference](https://cap.cloud.sap/docs/java/event-handlers/).

### Important API facts

- **Generated typed service interfaces** — for every CDS-modeled service the code generator emits
  a typed interface, e.g. `service CatalogService` → `cds.gen.catalogservice.CatalogService`. It
  extends `CqnService` and exposes typed methods for each declared action/function, plus nested
  `Application` / `Remote` sub-interfaces (`CatalogService.Application extends ApplicationService,
  CatalogService`). **Inject the generated interface by type** rather than looking up a service by
  name/qualifier — you get compile-time-checked action calls and typed parameters:
  ```java
  @Autowired CatalogService.Application catalog;   // the generated application-service interface

  // typed bound-action call — no string lookups, parameters and return type are checked
  Books_ ref = CQL.entity(Books_.class).filter(b -> b.ID().eq(bookId));
  Reviews r = catalog.review(ref, 5);
  ```
  Use this for service-tier calls (invoking actions/functions, triggering events through the full
  handler chain). **Prefer the application/CQN service over `PersistenceService` whenever you can.**
- **Choose the service tier intentionally.** `PersistenceService` does not invoke the target
  application service's handlers or its authorization/input-validation pipeline. Business writes
  relying on those checks should go through that application service. Persistence services still
  have generic providers, including managed-data handling (`@cds.on.insert` / `@cds.on.update`),
  and database constraints still apply: the data is not simply written "raw".
  Direct persistence queries are appropriate for internal bookkeeping, technical tables, or
  guarded atomic arithmetic inside an already authorized custom action. Avoid recursively calling
  the same application-service UPDATE from its own UPDATE handler.
  See [persistence generic providers](https://cap.cloud.sap/docs/java/cqn-services/#persistenceservice).
- **`CdsService` does not exist** — `CqnService` is still the source of event constants
  (`CqnService.EVENT_READ`, `CqnService.EVENT_CREATE`, etc.). Import:
  `com.sap.cds.services.cds.CqnService`. You don't need to inject `CqnService` directly — the
  generated typed service interface extends it, so the constants are available on any service
  reference you already hold.
- **`CqnReference.Segment`** does NOT have a `keys()` method.
  To extract keys from a bound action or entity reference, use `CqnAnalyzer`:
  ```java
  CqnAnalyzer analyzer = CqnAnalyzer.create(context.getModel());
  // For bound actions — extract keys from the CQN statement:
  AnalysisResult result = analyzer.analyze(context.getCqn());
  String id = (String) result.targetKeys().get("ID");
  ```
  `targetKeys()` addresses the action's entity; `rootKeys()` may address a different entity on
  a navigated reference. Handle composite keys using the actual model.
- **Typed vs. untyped query results** depend on SDK version, generated `linkedInterfaces`, and
  the static query type/selected execution overload. With SDK 5.0 and linked generated interfaces,
  typed `Select<T>` and `Update<T>` overloads return `CdsResult<D>`. Untyped CQN overloads return
  `Result`. `Result` extends `CdsResult<Row>`, not vice versa; a typed `CdsResult<Books>` cannot
  be assigned directly to `Result`.
  ```java
  // SDK 5.0, linkedInterfaces=true:
  CdsResult<Books> books = db.run(
      Select.from(Books_.class).where(b -> b.ID().eq(id))
  );
  Books book = books.single();

  // Explicitly untyped query execution:
  CqnSelect query = Select.from(Books_.class).where(b -> b.ID().eq(id));
  Result result = db.run(query);
  Books sameBook = result.single(Books.class);

  // INSERT still uses the untyped CqnInsert overload in SDK 5.0:
  Result inserted = db.run(Insert.into(Books_.class).entry(newBook));
  Books created = inserted.single(Books.class);
  ```
  `var` is also valid; verify the selected overload instead of guessing the return type from
  a class literal alone. Do not generalize typed SELECT behavior to INSERT.
  See [linked typed results](https://cap.cloud.sap/docs/java/working-with-cql/query-execution#typed-result-processing)
  and the [SDK 5.0 overloads](https://javadoc.io/static/com.sap.cds/cds-services-api/5.0.0/com/sap/cds/services/cds/CqnService.html).
- **Error handling in `@On` handlers** — two patterns:
  - `throw new ServiceException(ErrorStatuses.XXX, "msg")` — aborts immediately with the given HTTP
    status. Use for validation failures where you want a clean error response. Common statuses:
    `ErrorStatuses.CONFLICT` (409), `ErrorStatuses.NOT_FOUND` (404), `ErrorStatuses.BAD_REQUEST`
    (400). Import: `com.sap.cds.services.ErrorStatuses`
  - `messages.error("msg")` collects errors. In `@Before`, CAP calls `messages.throwIfError()`
    at the end of the phase; aggregation is useful for multiple input errors. In `@On`, call
    `messages.throwIfError()` to abort on collected errors, or reject immediately. Do not merely
    return from an unfinished action; successful custom actions must set the declared result
    or mark a void context completed. See [indicating errors](https://cap.cloud.sap/docs/java/event-handlers/indicating-errors).
  - Localize Java handler messages via Spring `src/main/resources/messages.properties` and pass
    the message key. CDS constraint messages use their service's i18n bundle.
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

   // CORRECT — positive quantity validated by the action; guard stock in the same update
   var updated = db.run(Update.entity(Books_.class)
       .where(b -> b.ID().eq(bookId).and(b.stock().ge(quantity)))
       .set(b -> b.stock(), s -> s.minus(quantity)));
   if (updated.rowCount() != 1) {
       throw new ServiceException(ErrorStatuses.CONFLICT, "BOOK_UNAVAILABLE");
   }
  ```
  This pattern applies to any read-modify-write cycle: counters, stock levels, balances, sequence
  numbers. Use `.set(field, expr)` with CQN expressions, or supported locking/optimistic
  concurrency control. Atomic arithmetic prevents lost updates; the stock predicate additionally
  prevents overselling. Validate positive quantities before running the query.

## Generated Code and Build

After `mvn compile`, CDS model classes are generated into `srv/src/gen/java/`. These are typed
accessor interfaces for your CDS entities. Key patterns:

- **Entity interfaces**: `cds.gen.<servicename>.<EntityName>` — getters/setters for entity elements
- **Entity metadata**: `cds.gen.<servicename>.<EntityName>_` — static CDS element references for
  queries (e.g. `Books_.ID`, `Books_.TITLE`)
- **Action/function contexts**: in SDK 5.0, bound contexts are entity-prefixed, e.g.
  `BooksReviewContext`; inspect the actual generated files rather than assuming
  `<ActionName>Context`. `uniqueEventContexts` was a historical option removed in SDK 4.0.

Build/code-generate and inspect the types when implementing handlers:

```sh
mvn compile    # triggers CDS build + Java code generation
```

Then inspect `srv/src/gen/java/` to see the exact generated class names and available methods
before writing handler code. This avoids guessing at API shapes.

## Running and Verifying

### Starting the application

For the generated project, the documented starting point is the project root:

```sh
mvn spring-boot:run
```

By default, the OData adapter is mounted at `/odata/v4`; its base path is configurable.
Service paths come from `@path` annotations in CDS:
- `service CatalogService @(path: '/browse')` → `http://localhost:8080/odata/v4/browse/`
- `service AdminService @(path: '/admin')` → `http://localhost:8080/odata/v4/admin/`
- Derive unannotated service paths from the effective model and startup logs rather than guessing.

### Verifying the app in CI / benchmarks

When running the app in background, use an actual configured entity endpoint and credentials.
The example below assumes the `/browse/Books` service shown above and default local mock users.
Use a protected endpoint and an authorized user if the check must also verify authentication:

```sh
# 2. Start in background, redirect output for debugging
mvn spring-boot:run > /tmp/app_output.log 2>&1 &
APP_PID=$!

# 3. Poll an authenticated entity request; substitute the actual service URL/user
READY=0
for i in $(seq 1 30); do
    HTTP_CODE=$(curl -s -u authenticated: -o /dev/null -w "%{http_code}" \
        http://localhost:8080/odata/v4/browse/Books 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "OData service is ready (HTTP $HTTP_CODE)"
        READY=1
        break
    fi
    if [ $i -eq 30 ]; then
        echo "TIMEOUT — last 30 lines of log:"
        tail -30 /tmp/app_output.log
    fi
    sleep 2
done

# 4. Test endpoints...
STATUS=1
if [ "$READY" = "1" ]; then
    curl --fail -s -u authenticated: http://localhost:8080/odata/v4/browse/Books
    STATUS=$?
fi

# 5. Clean up
kill $APP_PID 2>/dev/null
wait $APP_PID 2>/dev/null
exit "$STATUS"  # preserve the verification outcome, not the intentional process termination
```

**Port notes**:
- The default port is **8080**. Override with `-Dspring-boot.run.arguments="--server.port=8080"` if needed.
- A previous version may already be running, blocking the port.
- A **404** at the bare adapter path `/odata/v4/` alone does not establish startup failure.
  Inspect the configured endpoint and logs; a wrong service path, port, or base path can also give 404.
- A **401** proves an authentication layer responded, not that the entity/database is ready.
  Repeat with a configured user's credentials. A successful entity read exercises that service
  and database path; `$metadata` checks protocol/model availability, not database readiness.
- Configured health/readiness endpoints are another option when their dependencies and exposure
  are installed; see [health checks](https://cap.cloud.sap/docs/guides/deploy/health-checks).

## Mock Users for Development

CAP Java uses Spring Security with mock users for local development. **Two things are required**:

### Ensure Spring Security is available

Check `srv/pom.xml` and its dependency tree first. Platform starter bundles may already provide
the authentication dependencies; otherwise add the Spring Security starter:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

Local mocks require the security middleware to be present. Verify the effective dependencies
and active profile instead of diagnosing every 401 as a missing direct dependency.
See [Java mock users and prerequisites](https://cap.cloud.sap/docs/java/security#mock-users).

### Configure mock users in `srv/src/main/resources/application.yaml`

```yaml
---
spring:
  config.activate.on-profile: default
cds:
  security:
    mock:
      users:
        alice:
          # password defaults to empty; set one only when needed for local tests
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
- SDK 5.0 defaults to `model-relaxed`: endpoints protected by `@requires`/`@restrict` require
  authentication; unrestricted endpoints may be public. Inspect the project's authentication mode.
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