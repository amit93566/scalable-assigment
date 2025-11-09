# Order Service API Testing Guide

## Fixed Issues

### 1. **AggregateError Handling**
- Fixed handling of `AggregateError` from `Promise.all()` when multiple catalog requests fail
- Now properly extracts the first actual error from the aggregate

### 2. **Error Message Extraction**
- Improved error message extraction at multiple levels:
  - Individual item processing (inner catch)
  - Overall catalog service call (outer catch)
- Added comprehensive logging to debug issues
- Handles generic "Error" messages by extracting additional context

### 3. **Docker Compose Configuration**
- Added default values for service URLs:
  - `CATALOG_SERVICE_URL: http://localhost:8081/v1`
  - `INVENTORY_SERVICE_URL: http://localhost:8082`
  - `PAYMENT_SERVICE_URL: http://localhost:8083/`

## Testing the API

### Prerequisites
1. Ensure all services are running:
   - Catalog Service (port 8081)
   - Inventory Service (port 8082)
   - Payment Service (port 8083)
   - Order Service (port 8080)

### Quick Test

#### 1. Health Check
```bash
curl http://localhost:8080/health
```

#### 2. Create Order (with valid SKU)
```bash
curl -X POST http://localhost:8080/v1/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: TEST-$(date +%s)" \
  -d '{
    "userId": 1,
    "items": [
      {
        "sku": "ELEC-001",
        "qty": 2
      }
    ]
  }'
```

#### 3. Get Order by ID
```bash
curl http://localhost:8080/v1/orders/{ORDER_ID}
```

### Automated Test Script
Run the comprehensive test script:
```bash
cd /home/blade/projects/scalable/ss_order_service-master
./test-order-api.sh
```

Or with custom URLs:
```bash
ORDER_SERVICE_URL=http://localhost:8080 \
CATALOG_SERVICE_URL=http://localhost:8081/v1 \
INVENTORY_SERVICE_URL=http://localhost:8082 \
./test-order-api.sh
```

## Expected Error Messages

After the fixes, you should now see specific error messages instead of generic "Error":

### Catalog Service Errors:
- `"Cannot connect to catalog service for SKU ELEC-001 (ECONNREFUSED). Is the service running at http://localhost:8081/v1/products/sku/ELEC-001?"`
- `"Catalog Service unreachable or timeout (ECONNREFUSED) (URL: http://localhost:8081/v1/products/sku/ELEC-001). Check if catalog service is running. Try: curl http://localhost:8081/v1/health"`
- `"Product not found for SKU: ELEC-001"`
- `"Catalog service returned status 500: Internal Server Error"`

### Common Issues and Solutions:

1. **Catalog Service Not Running**
   - Check: `curl http://localhost:8081/v1/health` or `curl http://localhost:8081/actuator/health`
   - Start catalog service if needed

2. **Product SKU Doesn't Exist**
   - Verify SKU exists in catalog: `curl http://localhost:8081/v1/products/sku/{SKU}`
   - Create product in catalog if needed

3. **Network Connectivity**
   - If using Docker, ensure services can communicate
   - Check docker-compose networks are configured correctly

4. **Environment Variables**
   - Verify `CATALOG_SERVICE_URL` is set correctly
   - Check docker-compose.yml environment section

## Workflow Verification

The order creation workflow follows this sequence:

1. ✅ **Pre-Saga**: Verify prices from Catalog Service (by SKU)
2. ✅ **Create Order**: Create order with PENDING status
3. ✅ **Reserve Inventory**: Call `/v1/inventory/reserve`
4. ✅ **Calculate Totals**: Σ(unit_price × qty) + 5% tax + $50 shipping
5. ✅ **Process Payment**: Call `/v1/payments/charge` with Idempotency-Key
6. ✅ **Confirm Order**: Update order with payment_status = SUCCESS
7. ✅ **Compensation**: On failure, release inventory reservations

## Debugging

If errors persist, check the logs for detailed error information:

```bash
# View order service logs
docker logs order-service

# Follow logs in real-time
docker logs -f order-service
```

Look for:
- `[CATALOG] Error fetching product for SKU...` - Individual item errors
- `Pre-Saga failed (Catalog Service Error). Full error object:` - Overall error details
- `AggregateError detected` - When Promise.all fails

