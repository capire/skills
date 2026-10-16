---
name: cap-messaging
description: Add event-driven pub-sub messaging to a CAP Node.js application. Covers declaring events in CDS, emitting and receiving events with srv.emit/srv.on, the transactional outbox for reliable delivery, local development with file-based-messaging, connecting to production brokers (SAP Event Mesh, SAP Cloud Application Event Hub), and hybrid testing with cds bind. Use this skill whenever a developer wants to add messaging, async events, pub-sub, cross-service event communication, or integrate with a message broker in a CAP app.
license: Apache-2.0
metadata:
  author: cap-team
  team: cap
---

## What I do

Guide developers step-by-step through adding event-driven pub-sub messaging to a CAP Node.js
application — from declaring events in CDS, wiring up emit/receive handlers, configuring a
message channel for cross-process communication, ensuring reliable delivery with the outbox
pattern, and connecting to production brokers.

## MCP Server

Always use `cds-mcp_search_docs` to:
- Look up current `cds.MessagingService` APIs and configuration options before writing code
- Verify event annotation syntax and broker-specific settings
- Check hybrid testing setup details for a specific broker

## Core Concepts

CAP messaging has two layers:

| Layer | What it is |
|---|---|
| **Conceptual** | Events declared in CDS, emitted/received via service APIs — broker-independent |
| **Technical** | `cds.MessagingService` implementations that connect to real brokers |

In a single process, conceptual events flow through the CAP event bus with no broker needed.
When services run in **separate processes**, a message channel is required — but application
code stays unchanged. This is the key insight: topology (co-located vs. microservices) is a
configuration concern, not a code concern.

**Why messaging over synchronous calls:**
- **Resilience** — messages persist when the receiver is down; delivered when it restarts
- **Decoupling** — emitters don't know receivers; future services can subscribe without changing the emitter

## Step 1 — Declare Events in CDS

Define events inside a service in a `.cds` file:

```cds
service ReviewsService {
  event reviewed {
    subject : String;
    count   : Integer;
    rating  : Decimal;
  }
}
```

Conventions:
- Declare events in the service that **owns** them (the emitter's service)
- Use past-tense names: `reviewed`, `OrderPlaced`, `StockChanged`
- Without `@topic`, the topic is the fully qualified name: `<namespace>.<ServiceName>.<EventName>`
- Use `@topic` only when the broker requires a specific name:

```cds
@topic: 'my.company/orders/placed/v1'
event OrderPlaced { ID: UUID; amount: Decimal; }
```

## Step 2 — Emit Events

Emit from a service handler using `this.emit`:

```js
module.exports = class ReviewsService extends cds.ApplicationService {
  async init() {
    this.after(['CREATE', 'UPDATE'], 'Reviews', async (review) => {
      const { subject } = review
      const { count, avg: rating } = await SELECT.one
        `count(*) as count, avg(rating) as avg`
        .from('Reviews').where({ subject })
      await this.emit('reviewed', { subject, count, rating })
    })
    return super.init()
  }
}
```

Key rules:
- Call `this.emit(eventName, data)` inside a service handler — emits on the owning service
- Always emit in `srv.after`, never `srv.before` — the transaction hasn't committed yet, and
  the event would fire even if the operation is later rejected
- CAP automatically applies transactional semantics: the event fires only **after** the
  surrounding DB transaction commits

## Step 3 — Receive Events

Subscribe to events from another service using `service.on`:

```js
module.exports = class BookstoreService extends cds.ApplicationService {
  async init() {
    const reviews = await cds.connect.to('ReviewsService')
    const { Books } = this.entities

    reviews.on('reviewed', async ({ data: { subject, count, rating } }) => {
      await UPDATE(Books, subject).with({ numReviews: count, rating })
    })

    return super.init()
  }
}
```

Key rules:
- Connect to the emitting service first: `cds.connect.to('ServiceName')`
- Register handlers with `remoteService.on(...)` — **not** `this.on` (that only receives events
  on the current service)
- Handlers run under `cds.User.privileged` — implement authorization checks explicitly if needed
- When the handler resolves successfully the message is acknowledged by the broker

## Step 4 — Enable Cross-Process Messaging

In-process eventing works out of the box. For **separate processes**, configure a channel.

### Local Development: `file-based-messaging`

Add to `package.json`:

```json
"cds": {
  "requires": {
    "messaging": {
      "[development]": { "kind": "file-based-messaging" }
    }
  }
}
```

Start each service in its own terminal — see `cap-inner-loop` for the server lifecycle
(starting in a separate terminal window, discovering the actual ports, stopping servers):

```sh
cds watch reviews
cds watch bookstore
```

Ports are assigned dynamically; use `cds bindings` to look up each server's real URL.

Messages emitted by `reviews` are written to `~/.cds-msg-box` and picked up by `bookstore` —
even if `bookstore` was down when the message was emitted (resilience in action).

To inspect unconsumed messages:

```sh
cat ~/.cds-msg-box
# ReviewsService.reviewed {"data":{"subject":"201",...}, "headers": {...}}
```

### Production Brokers

Configure a real broker for production. Swap the kind per profile:

```json
"cds": {
  "requires": {
    "messaging": {
      "[development]": { "kind": "file-based-messaging" },
      "[production]":  { "kind": "event-broker" }
    }
  }
}
```

| Broker | npm add | kind |
|---|---|---|
| SAP Cloud Application Event Hub | `@cap-js/event-broker` | `event-broker` |
| SAP Event Mesh | `@sap/xb-msg-amqp-v100` | `enterprise-messaging` |
| SAP Advanced Event Mesh | `@cap-js/enterprise-messaging` | `enterprise-messaging` |

Use `cds-mcp_search_docs` for the full configuration for each broker.

## Step 5 — Reliable Delivery with the Outbox

### Outgoing (Outbox)

The **transactional outbox** ensures events aren't lost if the broker is temporarily
unavailable. Wrap a service with `cds.outboxed()`:

```js
const reviewsSvc = await cds.connect.to('ReviewsService')
const reviews_ = cds.outboxed(reviewsSvc)  // events stored in DB, sent after commit

this.after('SAVE', Orders, async (order) => {
  await reviews_.emit('OrderCreated', { orderId: order.ID })
})
```

The outbox persists the event in a DB table within the same transaction and forwards it with
automatic retries. To bypass the outbox for an immediate emit:

```js
await cds.unboxed(reviews_).emit('OrderCreated', { orderId: order.ID })
```

> For `this.emit(...)` inside a service handler, CAP already applies transactional semantics
> automatically — no need to wrap with `cds.outboxed()`.

### Incoming (Inbox, Beta)

Persist received messages before processing for at-least-once delivery:

```json
"cds": {
  "requires": {
    "messaging": {
      "kind": "enterprise-messaging",
      "inboxed": true
    }
  }
}
```

## Step 6 — Multiple Channels

Route different events through different brokers using `composite-messaging`:

```json
"cds": {
  "requires": {
    "messaging": {
      "kind": "composite-messaging",
      "routes": {
        "ChannelA": ["**/ReviewsService/*"],
        "ChannelB": ["**/sap/s4/**"]
      }
    },
    "ChannelA": { "kind": "enterprise-messaging" },
    "ChannelB": { "kind": "enterprise-messaging" }
  }
}
```

Route patterns use glob syntax: `**` matches any characters, `*` matches any except `/` and `.`.

## Step 7 — Hybrid Testing

Test locally against a real cloud broker:

```sh
# 1. Add the AMQP client (required for enterprise-messaging-shared)
npm add @sap/xb-msg-amqp-v100

# 2. Bind to the cloud messaging service instance
cds bind -2 <instance>:<service-key>

# 3. Run services with the hybrid profile
cds watch reviews   --profile hybrid
cds watch bookstore --profile hybrid
```

The `cds bind` adds service bindings to the local environment, which is picked up by the hybrid profile.
Bindings land in `.cdsrc-private.json`; remove them after hybrid testing to revert to
file-based development. Verify with `cds env requires --profile hybrid`.

## CloudEvents Format

Enable CloudEvents-compliant wire format for interoperability with external systems:

```json
"cds": {
  "requires": {
    "messaging": {
      "format": "cloudevents"
    }
  }
}
```

CAP fills all mandatory fields (`type`, `source`, `id`, `specversion`, `datacontenttype`,
`time`) automatically. Application code does not change.

## Common Mistakes

- **Emitting in `srv.before`** — the transaction hasn't committed; use `srv.after` instead
- **`this.on('eventName', ...)` for remote events** — only catches events on the current
  service; use `remoteService.on(...)` for events from another service
- **No `cds.outboxed()` for fire-and-forget writes** — without it, a broker outage silently
  drops events
- **Missing `[development]` profile for `file-based-messaging`** — without it, cross-process
  events are silently discarded; check `~/.cds-msg-box` to verify messages are landing
- **Low-level API (`cds.connect.to('messaging').emit(...)`)** — bypasses in-process eventing,
  loses service-local topic names, and breaks co-location. Prefer the conceptual API
- **Stale bindings after hybrid testing** — if `cds watch` tries to connect to
  a remote URL unexpectedly, remove the leftover binding from `.cdsrc-private.json`

## Related Skills

- `cap-developer` — general CAP Node.js patterns and project structure
- `cap-add-remote-service` — consuming external OData/S4 services in your CAP app
- `cap-troubleshooting` — diagnose why events aren't received or services fail to start
