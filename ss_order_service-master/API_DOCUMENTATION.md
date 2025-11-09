# Order Service API Documentation

**Base URL:** `http://localhost:8080`  
**API Version:** `/v1`

---

## 1. POST /v1/orders
Create a new order using the Saga pattern (Reserve → Pay → Ship workflow).

### Request

**Headers:**
```
Content-Type: application/json
Idempotency-Key: <unique-key> (optional but recommended)
```

**Body:**
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "sku": "SKU-001"
    },
    {
      "productId": 2,
      "quantity": 1,
      "sku": "SKU-002"
    }
  ]
}
```

**Field Descriptions:**
- `userId` (required): Customer/User ID
- `items` (required): Array of order items
  - `productId` (required): Product ID from Catalog Service
  - `quantity` (required): Quantity to order (can also use `qty`)
  - `sku` (optional): SKU for reference (helpful for inventory service)

### Response (201 Created - Success)

```json
{
  "order_id": 401,
  "customer_id": 1,
  "order_status": "PENDING",
  "payment_status": "SUCCESS",
  "order_total": "47.50",
  "created_at": "2025-01-15T10:30:00.000Z",
  "totals_signature": "a1b2c3d4e5f6...",
  "payment_id": null,
  "totals": {
    "subtotal": 30.00,
    "taxRate": 0.05,
    "taxAmount": 1.50,
    "shippingCost": 16.00,
    "total": 47.50
  },
  "items": [
    {
      "order_item_id": 801,
      "order_id": 401,
      "product_id": 1,
      "sku": "SKU-001",
      "quantity": 2,
      "unit_price": "10.00",
      "line_status": "PENDING",
      "product_name": null,
      "tax_rate": "0.0500"
    },
    {
      "order_item_id": 802,
      "order_id": 401,
      "product_id": 2,
      "sku": "SKU-002",
      "quantity": 1,
      "unit_price": "10.00",
      "line_status": "PENDING",
      "product_name": null,
      "tax_rate": "0.0500"
    }
  ]
}
```

**Totals Breakdown (Workflow-3):**
- `totals.subtotal`: Sum of (unit_price × quantity) for all items
- `totals.taxRate`: Tax rate applied (0.05 = 5%)
- `totals.taxAmount`: Tax amount calculated on subtotal
- `totals.shippingCost`: Shipping cost (10.00 + items × 2.00)
- `totals.total`: Final total (subtotal + tax + shipping)

**Workflow-3 Totals Calculation:**
The response includes a `totals` object with the complete breakdown:
- `subtotal`: `(10.00 × 2) + (10.00 × 1) = 30.00`
- `taxRate`: `0.05` (5%)
- `taxAmount`: `30.00 × 0.05 = 1.50`
- `shippingCost`: `10.00 + (3 items × 2.00) = 16.00`
- `total`: `30.00 + 1.50 + 16.00 = 47.50`
- `totals_signature`: SHA-256 hash of all totals components (stored in order record)

### Response (400 Bad Request - Validation Error)

```json
{
  "error": "INVALID_REQUEST",
  "message": "Missing userId or items."
}
```

### Response (500 Internal Server Error - Saga Failed)

```json
{
  "error": "ORDER_CREATION_FAILED",
  "message": "Pricing verification failed: Price not found for product ID: 999",
  "order_id": 401
}
```

**Common Error Scenarios:**
- Catalog service unavailable: `"Pricing verification failed: Cannot connect to catalog service"`
- Product not found: `"Price not found for product ID: X"`
- Inventory reservation failed: `"Inventory service error (400): ..."`
- Payment failed: `"Payment service error (500): ..."`

---

## 2. GET /v1/orders/:id
Get order details by ID.

### Request

**URL Parameters:**
- `id` (required): Order ID

**Example:**
```
GET /v1/orders/401
```

### Response (200 OK)

```json
{
  "order_id": 401,
  "customer_id": 1,
  "order_status": "PENDING",
  "payment_status": "SUCCESS",
  "order_total": "47.50",
  "created_at": "2025-01-15T10:30:00.000Z",
  "totals_signature": "a1b2c3d4e5f6...",
  "payment_id": "PAY-12345",
  "items": [
    {
      "order_item_id": 801,
      "order_id": 401,
      "product_id": 1,
      "sku": "SKU-001",
      "quantity": 2,
      "unit_price": "10.00",
      "line_status": "PENDING",
      "product_name": null,
      "tax_rate": "0.0500"
    }
  ]
}
```

### Response (404 Not Found)

```json
{
  "error": "ORDER_NOT_FOUND",
  "message": "Order 999 not found."
}
```

---

## 3. GET /v1/orders
List all orders (with pagination - returns last 50).

### Request

**Query Parameters:**
- None (simple listing, returns last 50 orders)

**Example:**
```
GET /v1/orders
```

### Response (200 OK)

```json
[
  {
    "order_id": 401,
    "customer_id": 1,
    "order_status": "PENDING",
    "payment_status": "SUCCESS",
    "order_total": "47.50",
    "created_at": "2025-01-15T10:30:00.000Z",
    "totals_signature": "a1b2c3d4e5f6...",
    "payment_id": null,
    "items": [...]
  },
  {
    "order_id": 400,
    "customer_id": 2,
    "order_status": "DELIVERED",
    "payment_status": "SUCCESS",
    "order_total": "25.00",
    "created_at": "2025-01-14T09:15:00.000Z",
    "totals_signature": "b2c3d4e5f6a1...",
    "payment_id": "PAY-12344",
    "items": [...]
  }
]
```

---

## Testing Examples

### cURL Examples

#### 1. Create Order (Basic)
```bash
curl -X POST http://localhost:8080/v1/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-$(date +%s)" \
  -d '{
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ]
  }'
```

#### 2. Create Order (With SKU)
```bash
curl -X POST http://localhost:8080/v1/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-test-001" \
  -d '{
    "userId": 1,
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "sku": "SKU-001"
      },
      {
        "productId": 2,
        "quantity": 1,
        "sku": "SKU-002"
      }
    ]
  }'
```

#### 3. Get Order by ID
```bash
curl http://localhost:8080/v1/orders/401
```

#### 4. List All Orders
```bash
curl http://localhost:8080/v1/orders
```

### JavaScript/Fetch Examples

#### Create Order
```javascript
const response = await fetch('http://localhost:8080/v1/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Idempotency-Key': `order-${Date.now()}`
  },
  body: JSON.stringify({
    userId: 1,
    items: [
      {
        productId: 1,
        quantity: 2,
        sku: 'SKU-001'
      }
    ]
  })
});

const order = await response.json();
console.log('Created order:', order);
```

#### Get Order
```javascript
const response = await fetch('http://localhost:8080/v1/orders/401');
const order = await response.json();
console.log('Order details:', order);
```

### Postman Collection

**Collection Variables:**
- `base_url`: `http://localhost:8080`
- `order_id`: (set after creating order)

**Request 1: Create Order**
- Method: `POST`
- URL: `{{base_url}}/v1/orders`
- Headers:
  - `Content-Type: application/json`
  - `Idempotency-Key: {{$timestamp}}`
- Body (raw JSON):
```json
{
  "userId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2
    }
  ]
}
```

**Request 2: Get Order**
- Method: `GET`
- URL: `{{base_url}}/v1/orders/{{order_id}}`

---

## Workflow-3 Features (Pricing, Totals & Signature)

### Totals Calculation Formula

1. **Subtotal**: `Σ(unit_price × quantity)` for all items
2. **Tax**: `subtotal × 0.05` (5% tax rate)
3. **Shipping**: `10.00 + (total_items × 2.00)`
4. **Total**: `subtotal + tax + shipping`
5. **All amounts**: Rounded using banker's rounding to 2 decimal places

### Totals Signature

The `totals_signature` field contains a SHA-256 hash of:
- All items (product_id, quantity, price) - sorted by product_id
- Subtotal
- Tax rate
- Tax amount
- Shipping cost
- Total

This signature can be used to detect tampering by recalculating and comparing.

### Example Calculation

**Input:**
- Item 1: productId=1, quantity=2, price=10.00
- Item 2: productId=2, quantity=1, price=10.00

**Calculation:**
```
Subtotal = (10.00 × 2) + (10.00 × 1) = 30.00
Tax Rate = 0.05 (5%)
Tax Amount = 30.00 × 0.05 = 1.50
Shipping Cost = 10.00 + (3 items × 2.00) = 16.00
Total = 30.00 + 1.50 + 16.00 = 47.50
```

**Response `totals` object:**
```json
{
  "subtotal": 30.00,
  "taxRate": 0.05,
  "taxAmount": 1.50,
  "shippingCost": 16.00,
  "total": 47.50
}
```

---

## Order Status Values

- `order_status`: `PENDING` | `DELIVERED` | `CANCELLED`
- `payment_status`: `PENDING` | `SUCCESS` | `FAILED`
- `line_status`: `PENDING` | `SHIPPED` | `CANCELLED`

---

## Idempotency

The API supports idempotency via the `Idempotency-Key` header. If the same key is used:
- First request: Creates and processes the order
- Subsequent requests: Returns the same response from the first request

**Best Practice:** Use a unique key per order attempt, e.g., `order-{userId}-{timestamp}` or `order-{userId}-{orderNumber}`

---

## Error Handling

All errors follow this format:
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "order_id": 123  // Optional, if order was created before failure
}
```

**Common Error Codes:**
- `INVALID_REQUEST`: Missing required fields
- `ORDER_NOT_FOUND`: Order ID doesn't exist
- `ORDER_CREATION_FAILED`: Saga workflow failed
- `INTERNAL_SERVER_ERROR`: Unexpected server error

