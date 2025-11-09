#!/bin/bash

# Test script for Order Service API
# This script tests the order creation workflow

BASE_URL="${ORDER_SERVICE_URL:-http://localhost:8080}"
IDEMPOTENCY_KEY="TEST-$(date +%s)"

echo "=========================================="
echo "Testing Order Service API"
echo "=========================================="
echo "Base URL: $BASE_URL"
echo "Idempotency Key: $IDEMPOTENCY_KEY"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/health" 2>&1)
HTTP_STATUS=$(echo "$HEALTH_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Health check passed${NC}"
    echo "Response: $BODY"
else
    echo -e "${RED}✗ Health check failed (Status: $HTTP_STATUS)${NC}"
    echo "Response: $BODY"
fi
echo ""

# Test 2: Check Catalog Service (if accessible)
echo -e "${YELLOW}Test 2: Catalog Service Check${NC}"
CATALOG_URL="${CATALOG_SERVICE_URL:-http://localhost:8081/v1}"
CATALOG_HEALTH=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$CATALOG_URL/../actuator/health" 2>&1 || curl -s -w "\nHTTP_STATUS:%{http_code}" "$CATALOG_URL/health" 2>&1)
CATALOG_STATUS=$(echo "$CATALOG_HEALTH" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$CATALOG_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Catalog service is accessible${NC}"
else
    echo -e "${RED}✗ Catalog service may not be running (Status: $CATALOG_STATUS)${NC}"
    echo "Expected URL: $CATALOG_URL"
fi
echo ""

# Test 3: Check Inventory Service (if accessible)
echo -e "${YELLOW}Test 3: Inventory Service Check${NC}"
INVENTORY_URL="${INVENTORY_SERVICE_URL:-http://localhost:8082}"
INVENTORY_HEALTH=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$INVENTORY_URL/health" 2>&1)
INVENTORY_STATUS=$(echo "$INVENTORY_HEALTH" | grep "HTTP_STATUS" | cut -d: -f2)

if [ "$INVENTORY_STATUS" = "200" ]; then
    echo -e "${GREEN}✓ Inventory service is accessible${NC}"
else
    echo -e "${RED}✗ Inventory service may not be running (Status: $INVENTORY_STATUS)${NC}"
    echo "Expected URL: $INVENTORY_URL"
fi
echo ""

# Test 4: Create Order (with sample SKU - adjust based on your catalog)
echo -e "${YELLOW}Test 4: Create Order${NC}"
ORDER_PAYLOAD=$(cat <<EOF
{
  "userId": 1,
  "items": [
    {
      "sku": "ELEC-001",
      "qty": 2
    }
  ]
}
EOF
)

echo "Request payload:"
echo "$ORDER_PAYLOAD" | jq '.' 2>/dev/null || echo "$ORDER_PAYLOAD"
echo ""

ORDER_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL/v1/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "$ORDER_PAYLOAD" 2>&1)

HTTP_STATUS=$(echo "$ORDER_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$ORDER_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "201" ]; then
    echo -e "${GREEN}✓ Order created successfully${NC}"
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
elif [ "$HTTP_STATUS" = "500" ]; then
    echo -e "${RED}✗ Order creation failed (Status: $HTTP_STATUS)${NC}"
    echo "Error response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo -e "${YELLOW}Common issues:${NC}"
    echo "1. Catalog service not running or unreachable"
    echo "2. Product SKU doesn't exist in catalog"
    echo "3. Inventory service not running"
    echo "4. Payment service not running"
else
    echo -e "${RED}✗ Unexpected status: $HTTP_STATUS${NC}"
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
fi
echo ""

# Test 5: Get Order by ID (if order was created)
if [ "$HTTP_STATUS" = "201" ]; then
    ORDER_ID=$(echo "$BODY" | jq -r '.order_id' 2>/dev/null)
    if [ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
        echo -e "${YELLOW}Test 5: Get Order by ID ($ORDER_ID)${NC}"
        GET_RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" "$BASE_URL/v1/orders/$ORDER_ID" 2>&1)
        GET_STATUS=$(echo "$GET_RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
        GET_BODY=$(echo "$GET_RESPONSE" | sed '/HTTP_STATUS/d')
        
        if [ "$GET_STATUS" = "200" ]; then
            echo -e "${GREEN}✓ Order retrieved successfully${NC}"
            echo "Order details:"
            echo "$GET_BODY" | jq '.' 2>/dev/null || echo "$GET_BODY"
        else
            echo -e "${RED}✗ Failed to retrieve order (Status: $GET_STATUS)${NC}"
            echo "$GET_BODY"
        fi
    fi
fi

echo ""
echo "=========================================="
echo "Test completed"
echo "=========================================="

