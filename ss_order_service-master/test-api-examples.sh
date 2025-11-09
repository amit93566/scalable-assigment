#!/bin/bash

# Order Service API Test Examples
# Make sure all services are running before testing

BASE_URL="http://localhost:8080"
IDEMPOTENCY_KEY="test-$(date +%s)"

echo "=========================================="
echo "Order Service API Test Examples"
echo "=========================================="
echo ""

# Test 1: Create Order
echo "Test 1: Create Order"
echo "-------------------"
echo "Request:"
echo "POST $BASE_URL/v1/orders"
echo "Headers:"
echo "  Content-Type: application/json"
echo "  Idempotency-Key: $IDEMPOTENCY_KEY"
echo "Body:"
cat <<EOF
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
EOF
echo ""
echo "Response:"
RESPONSE=$(curl -s -X POST "$BASE_URL/v1/orders" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
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
  }')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract order_id if successful
ORDER_ID=$(echo "$RESPONSE" | jq -r '.order_id' 2>/dev/null)

if [ ! -z "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ]; then
  echo "✓ Order created successfully! Order ID: $ORDER_ID"
  echo ""
  
  # Test 2: Get Order by ID
  echo "Test 2: Get Order by ID"
  echo "-------------------"
  echo "Request:"
  echo "GET $BASE_URL/v1/orders/$ORDER_ID"
  echo ""
  echo "Response:"
  curl -s "$BASE_URL/v1/orders/$ORDER_ID" | jq '.' 2>/dev/null || curl -s "$BASE_URL/v1/orders/$ORDER_ID"
  echo ""
fi

# Test 3: List Orders
echo "Test 3: List Orders"
echo "-------------------"
echo "Request:"
echo "GET $BASE_URL/v1/orders"
echo ""
echo "Response (first 2 orders):"
curl -s "$BASE_URL/v1/orders" | jq '.[0:2]' 2>/dev/null || curl -s "$BASE_URL/v1/orders" | head -20
echo ""

echo "=========================================="
echo "Test Complete"
echo "=========================================="

