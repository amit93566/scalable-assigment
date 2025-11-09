# E-commerce Microservices Platform (ECI)

## Problem Statement 4 — E-commerce with Inventory (ECI)

A scalable microservices-based e-commerce platform with inventory management across multiple warehouses, implementing database-per-service architecture with no shared tables or cross-DB joins.

## Overview

### Base Schema

The platform manages the following core entities:

- **Customers** (customer_id, name, email, phone, created_at)
- **Products** (product_id, sku, name, category, price, is_active)
- **Inventory** (inventory_id, product_id, warehouse, on_hand, reserved, updated_at)
- **Orders** (order_id, customer_id, order_status, payment_status, order_total, created_at)
- **Order_Items** (order_item_id, order_id, product_id, sku, quantity, unit_price)
- **Payments** (payment_id, order_id, amount, method, status, reference, created_at)
- **Shipments** (shipment_id, order_id, carrier, status, tracking_no, shipped_at, delivered_at) - *Not implemented*

### Seed Data

- 100 customers
- 120 products
- 3 warehouses (WH1, WH2, WH3)
- 400 orders
- ~900 order_items + movements



## Architecture

### Technology Stack

```
| Service | Technology | Database | Port |
| Catalog Service | Spring Boot 3.2.0 (Java 17) | MySQL 8.0 | 8081 |
| Inventory Service | Node.js (Express) | MySQL 8.0 | 8082 |
| Order Service | Node.js (Express, Prisma) | MySQL 8.0 | 8080 |
| Payment Service | Spring Boot 3.2.0 (Java 17) | PostgreSQL 15 | 8083 |
```


### Design Principles

- **Database-Per-Service**: Each service owns its database with no shared tables
- **API-First**: All inter-service communication via REST APIs
- **Idempotency**: Critical operations support idempotency keys
- **Eventual Consistency**: Services maintain eventual consistency through API calls
- **Saga Pattern**: Distributed transactions managed via Saga orchestration



## Microservices

### 1. Catalog Service ✅

**Repository**: `catalog-service-master/`

**Responsibilities**:
- Product CRUD operations
- Product search and filtering
- Price management
- Product activation/deactivation

**Key Features**:
- OpenAPI 3.0 documentation (Swagger UI)
- Pagination support
- Category-based filtering
- Price updates with audit trail

**API Endpoints**:
```
POST   /v1/products              - Create product
GET    /v1/products/{id}         - Get product by ID
GET    /v1/products/sku/{sku}    - Get product by SKU
GET    /v1/products              - List products (paginated)
PUT    /v1/products/{id}         - Update product
DELETE /v1/products/{id}         - Delete product
GET    /v1/products/search        - Search products
GET    /v1/products/filter       - Filter products
PATCH  /v1/products/{id}/price   - Update price
PATCH  /v1/products/{id}/activate - Activate product
PATCH  /v1/products/{id}/deactivate - Deactivate product
```

**Health & Metrics**:
- Health: `GET /actuator/health`
- API Docs: `GET /swagger-ui.html`



### 2. Inventory Service ✅

**Repository**: `inventory-service/`

**Responsibilities**:
- Inventory management per warehouse
- Stock reservation and release
- Inventory movements tracking
- Reservation expiration management

**Key Features**:
- Warehouse allocation strategy (single-warehouse first, fallback to split)
- Reservation TTL (15 minutes)
- Atomic reservation operations
- Idempotent reserve/release operations
- Low-stock alerts
- Automatic reservation expiration cleanup

**API Endpoints**:
```
POST   /v1/inventory/reserve      - Reserve inventory (idempotent)
POST   /v1/inventory/release     - Release reservations
POST   /v1/inventory/ship        - Ship reserved items
GET    /v1/inventory/{productId} - Get inventory by product
GET    /v1/inventory/warehouse/{warehouse} - Get warehouse inventory
GET    /v1/inventory/movements   - Get inventory movements
GET    /health                   - Health check
```

**Warehouse Allocation Strategy**:
1. **Single-Warehouse First**: Attempts to fulfill entire order from one warehouse
2. **Split Allocation**: If single warehouse cannot fulfill, splits across multiple warehouses

**Reservation TTL**:
- Reservations expire after 15 minutes if order not confirmed
- Background job releases expired reservations automatically



### 3. Order Service ✅

**Repository**: `ss_order_service-master/`

**Responsibilities**:
- Order creation and management
- Order orchestration (Saga pattern)
- Total calculation (subtotal + tax + shipping)
- Coordination with Inventory and Payment services

**Key Features**:
- Idempotent order creation
- Saga pattern for distributed transactions
- Totals signature for tampering detection
- Banker's rounding for all calculations
- Compensation logic for rollback

**API Endpoints**:
```
POST   /v1/orders                - Create order (idempotent)
GET    /v1/orders/{id}            - Get order by ID
GET    /v1/orders                 - List orders
PATCH  /v1/orders/{id}/cancel    - Cancel order
GET    /health                   - Health check
```

**Order Workflow**:
1. Validate items and fetch prices from Catalog Service
2. Create order with status `PENDING`
3. Reserve inventory via Inventory Service
4. Process payment via Payment Service
5. Update order status based on payment result
6. Compensate (release inventory) on failure



### 4. Payment Service ✅

**Repository**: `payments-service/`

**Responsibilities**:
- Payment processing (charge/refund)
- Idempotent payment operations
- Payment status tracking
- Integration with Order Service

**Key Features**:
- Idempotent charge operations
- Payment status updates
- Refund support
- Transaction reference tracking

**API Endpoints**:
```
POST   /v1/payments               - Charge payment (idempotent)
POST   /v1/payments/{id}/refund   - Refund payment (idempotent)
GET    /v1/payments/{id}          - Get payment by ID
GET    /v1/payments/order/{orderId} - Get payments by order
GET    /actuator/health          - Health check
```



## Database-Per-Service Split

### Database Ownership

Each service maintains its own database with complete ownership of its data:
```
| Service | Database | Tables | Technology |
| Catalog | `catalog_db` | `products` | MySQL 8.0 |
| Inventory | `inventory_db` | `inventory`, `reservations`, `inventory_movements` | MySQL 8.0 |
| Orders | `order_db` | `eci_orders`, `eci_order_items`, `idempotency_keys` | MySQL 8.0 |
| Payments | `paymentsdb` | `payments` | PostgreSQL 15 |
```


### ER Diagrams

#### Catalog Service Database

```
┌─────────────────┐
│    products     │
├─────────────────┤
│ product_id (PK) │
│ sku (UNIQUE)    │
│ name            │
│ category        │
│ price           │
│ is_active       │
│ created_at      │
│ updated_at      │
└─────────────────┘
```

#### Inventory Service Database

```
┌──────────────────────┐
│     inventory        │
├──────────────────────┤
│ inventory_id (PK)    │
│ product_id           │
│ warehouse            │
│ on_hand              │
│ reserved             │
│ updated_at           │
│ UNIQUE(product_id,   │
│        warehouse)    │
└──────────────────────┘
         │
         │
┌──────────────────────┐
│   reservations       │
├──────────────────────┤
│ reservation_id (PK)  │
│ order_id             │
│ product_id           │
│ sku                  │
│ warehouse            │
│ quantity             │
│ idempotency_key      │
│ reserved_at          │
│ expires_at           │
│ status               │
└──────────────────────┘
         │
         │
┌──────────────────────┐
│ inventory_movements  │
├──────────────────────┤
│ movement_id (PK)     │
│ product_id           │
│ sku                  │
│ warehouse            │
│ movement_type        │
│ quantity             │
│ created_at           │
│ reference_order_id   │
│ notes                │
└──────────────────────┘
```

#### Order Service Database

```
┌──────────────────────┐
│    eci_orders        │
├──────────────────────┤
│ order_id (PK)        │
│ customer_id          │
│ order_status         │
│ payment_status       │
│ order_total          │
│ totals_signature     │
│ payment_id           │
│ created_at           │
└──────────────────────┘
         │
         │ 1:N
         │
┌──────────────────────┐
│  eci_order_items     │
├──────────────────────┤
│ order_item_id (PK)   │
│ order_id (FK)        │
│ product_id           │
│ sku                  │
│ quantity             │
│ unit_price           │
│ line_status          │
│ product_name         │
│ tax_rate             │
└──────────────────────┘

┌──────────────────────┐
│ idempotency_keys     │
├──────────────────────┤
│ key (PK)             │
│ resource_path        │
│ request_hash         │
│ response_code        │
│ response_body        │
│ created_at           │
└──────────────────────┘
```

#### Payment Service Database

```
┌──────────────────────┐
│      payments        │
├──────────────────────┤
│ payment_id (PK)      │
│ order_id             │
│ amount               │
│ currency             │
│ payment_method       │
│ status               │
│ provider_transaction │
│ idempotency_key      │
│ created_at           │
│ updated_at           │
└──────────────────────┘
```

### Context Map - Data Ownership

```
┌─────────────────────────────────────────────────────────────┐
│                    ECI Platform Context Map                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Catalog    │      │  Inventory   │      │    Orders    │
│   Service    │      │   Service    │      │   Service    │
├──────────────┤      ├──────────────┤      ├──────────────┤
│ Owns:        │      │ Owns:        │      │ Owns:        │
│ - Products   │      │ - Inventory  │      │ - Orders     │
│              │      │ - Reservations│     │ - Order Items│
│              │      │ - Movements   │      │              │
│              │      │              │      │              │
│ Replicates: │      │ Replicates:  │      │ Replicates:  │
│ (None)       │      │ (None)       │      │ - product_id │
│              │      │              │      │ - sku        │
│              │      │              │      │ - unit_price │
│              │      │              │      │ - product_name│
└──────┬───────┘      └──────┬───────┘      └──────┬───────┘
       │                     │                     │
       │ API: GET /products  │ API: POST /reserve │ API: POST /orders
       │                     │ API: POST /release │ API: GET /orders
       │                     │                     │
       └─────────────────────┴─────────────────────┘
                             │
                             │
                    ┌────────┴────────┐
                    │   Payment       │
                    │   Service       │
                    ├─────────────────┤
                    │ Owns:           │
                    │ - Payments      │
                    │                 │
                    │ Replicates:     │
                    │ - order_id      │
                    │                 │
                    │ API: POST /charge│
                    │ API: POST /refund│
                    └─────────────────┘
```

### Data Replication Strategy

**Read Models in Order Service**:
- `product_id`: Reference to product (no FK constraint)
- `sku`: Product SKU (denormalized for performance)
- `unit_price`: Price at time of order (snapshot)
- `product_name`: Product name at time of order (snapshot)

**Rationale**:
- Prevents cross-DB joins
- Maintains historical accuracy (prices may change)
- Improves query performance
- Enables order fulfillment even if product is deleted

## Containerization with Docker

### Dockerfiles

Each service includes a `Dockerfile`:

- **Catalog Service**: `catalog-service-master/Dockerfile`
- **Inventory Service**: `inventory-service/Dockerfile`
- **Order Service**: `ss_order_service-master/Dockerfile`
- **Payment Service**: `payments-service/Dockerfile`

### Docker Compose

**File**: `docker-compose.yml` (root directory)

**Services**:
- 4 databases (MySQL for Catalog, Inventory, Orders; PostgreSQL for Payments)
- 4 microservices
- Health checks configured
- Network: `microservices-net` (bridge)

**Usage**:
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f <service-name>

# Stop services
docker-compose down
```

**Health Endpoints**:
- Catalog: `http://localhost:8081/actuator/health`
- Inventory: `http://localhost:8082/health`
- Orders: `http://localhost:8080/health`
- Payments: `http://localhost:8083/actuator/health`





## Kubernetes Deployment on Minikube

### Prerequisites

- Minikube installed
- kubectl configured
- Docker images built (or using remote registry)

### Deployment Structure

**Directory**: `k8s/`

```
k8s/
├── catalog/          # Catalog service manifests
├── orders/           # Orders service manifests
├── inventory/        # Inventory service manifests
├── payments/         # Payments service manifests
├── ingress/          # Ingress configuration
├── monitoring/       # logging
└── deploy.sh         # Automated deployment script
```

### Automated Deployment

```bash
cd k8s
./deploy.sh
```

### Manual Deployment

See [k8s/README.md](k8s/README.md) for detailed manual deployment steps.


### Logging

**Format**: Structured JSON

**PII Masking**:
- Email addresses masked
- Phone numbers masked
- Addresses masked
- Implementation: `logger.js` with `maskPii()` function

**Log Levels**:
- ERROR: Critical errors
- WARN: Warnings
- INFO: Business events
- DEBUG: Detailed debugging


## API Documentation

### API Versioning

All APIs use `/v1` prefix:
- `/v1/products`
- `/v1/orders`
- `/v1/inventory`
- `/v1/payments`

### OpenAPI 3.0

**Catalog Service**: `http://localhost:8081/swagger-ui.html`

**Payment Service**: OpenAPI spec available at `/v1/api-docs`

### Standard Error Schema

```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "status": 404,
  "error": "Resource Not Found",
  "message": "Product with ID 999 not found",
  "path": "/v1/products/999"
}
```

### Pagination

**Query Parameters**:
- `page`: Page number (default: 0)
- `size`: Page size (default: 20)
- `sort`: Sort field and direction (e.g., `name,asc`)

**Response**:
```json
{
  "content": [...],
  "page": 0,
  "size": 20,
  "totalElements": 120,
  "totalPages": 6
}
```

### Filters

**Catalog Service**:
- `category`: Filter by category
- `isActive`: Filter by active status
- `keyword`: Search by keyword

**Inventory Service**:
- `warehouse`: Filter by warehouse
- `productId`: Filter by product



## Getting Started

### Local Development

1. **Clone Repository**:
   ```bash
   git clone <repository-url>
   cd scalable
   ```

2. **Start Services with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

3. **Initialize Databases**:
   ```bash
   # Seed data is automatically loaded from Infra/init/
   # Or manually run SQL scripts in Infra/init/
   ```

4. **Verify Services**:
   ```bash
   curl http://localhost:8081/actuator/health  # Catalog
   curl http://localhost:8082/health          # Inventory
   curl http://localhost:8080/health          # Orders
   curl http://localhost:8083/actuator/health # Payments
   ```

### Kubernetes Deployment

See [k8s/README.md](k8s/README.md) for detailed deployment instructions.



**Service-Specific Documentation**:
- [Catalog Service README](catalog-service-master/README.md)
- [Order Service API Documentation](ss_order_service-master/API_DOCUMENTATION.md)
- [Order Service Testing Guide](ss_order_service-master/TESTING.md)




## Project Structure

```
scalable/
├── catalog-service-master/    # Catalog Service (Java Spring Boot)
├── inventory-service/          # Inventory Service (Node.js)
├── ss_order_service-master/    # Order Service (Node.js)
├── payments-service/           # Payment Service (Java Spring Boot)
├── k8s/                        # Kubernetes manifests
├── Infra/                      # Database initialization scripts
├── docker-compose.yml          # Docker Compose configuration
└── README.md                   # This file
```

## Contributors

- [AMIT KUMAR ROUT](https://github.com/amit93566)
- [KHUSHIKA RANJAN](https://github.com/2024tm93564-khushika)
- [KHARE VAISHNAVI ASHOK](https://github.com/Bits-vaishnavi)
- [YASH JHA](https://github.com/YashJha1)



