#!/bin/bash

# E-commerce Microservices Deployment Script for Minikube
# This script deploys all services, databases, and monitoring stack

set -e

NAMESPACE="eci"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "SCRIPT_DIR: $SCRIPT_DIR"

echo "=========================================="
echo "E-commerce Microservices Deployment"
echo "=========================================="

# Check if minikube is running
echo "Checking Minikube status..."
if ! minikube status > /dev/null 2>&1; then
    echo "Minikube is not running. Starting Minikube..."
    minikube start --memory=4096 --cpus=2 --disk-size=20g
else
    echo "Minikube is already running."
fi

# Wait for Minikube to be fully ready
echo "Waiting for Minikube to be ready..."
sleep 5
minikube status

# Enable required addons (only if minikube is running)
echo "Enabling Minikube addons..."
if minikube status > /dev/null 2>&1; then
    echo "  Enabling ingress addon..."
    minikube addons enable ingress || echo "  Warning: Failed to enable ingress addon (may already be enabled)"
    
    echo "  Enabling metrics-server addon..."
    minikube addons enable metrics-server || echo "  Warning: Failed to enable metrics-server addon (may already be enabled)"
    
    echo "Addons enabled. Current addon status:"
    minikube addons list | grep -E "ingress|metrics-server"
else
    echo "ERROR: Minikube is not running. Cannot enable addons."
    echo "Please start Minikube manually: minikube start --memory=4096 --cpus=2"
    exit 1
fi

# Create namespace
echo "Creating namespace: $NAMESPACE"
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-namespace.yml"

# Wait for namespace to be ready
kubectl wait --for=condition=Active namespace/$NAMESPACE --timeout=30s || true

# Build Docker images in Minikube's Docker environment
echo "Building Docker images in Minikube..."
eval $(minikube -p minikube docker-env)

# Get the project root directory (parent of k8s directory)
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Build catalog-service image
echo "  Building catalog-service image..."
cd "$PROJECT_ROOT/catalog-service-master"
docker build -t catalog-service:1.0.0 . || {
    echo "ERROR: Failed to build catalog-service image"
    exit 1
}

# Build inventory-service image
echo "  Building inventory-service image..."
cd "$PROJECT_ROOT/inventory-service"
docker build -t inventory-service:latest . || {
    echo "ERROR: Failed to build inventory-service image"
    exit 1
}

# Build orders-service image
echo "  Building orders-service image..."
cd "$PROJECT_ROOT/ss_order_service-master"
docker build -t orders-service:latest . || {
    echo "ERROR: Failed to build orders-service image"
    exit 1
}

# Build payments-service image (if it exists)
if [ -d "$PROJECT_ROOT/payments-service" ]; then
    echo "  Building payments-service image..."
    cd "$PROJECT_ROOT/payments-service"
    if [ -f "Dockerfile" ]; then
        docker build -t payments-service:latest . || {
            echo "WARNING: Failed to build payments-service image (continuing anyway)"
        }
    fi
fi

echo "Docker images built successfully."
echo ""

# Create ConfigMaps from init files (required before database deployment)
echo "Creating ConfigMaps from init files..."
INIT_DIR="$(cd "$SCRIPT_DIR/../Infra/init" && pwd)"

# Catalog ConfigMaps
echo "  Creating Catalog ConfigMaps..."
kubectl create configmap catalog-db-init \
  --from-file="$INIT_DIR/catalog/init_catalog.sql" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

kubectl create configmap catalog-csv \
  --from-file="$INIT_DIR/catalog/eci_products.csv" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

# Orders ConfigMaps
echo "  Creating Orders ConfigMaps..."
kubectl create configmap orders-db-init \
  --from-file="$INIT_DIR/orders/init_orders.sql" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

kubectl create configmap orders-csv \
  --from-file="$INIT_DIR/orders/eci_orders.csv" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

kubectl create configmap order-items-csv \
  --from-file="$INIT_DIR/orders/eci_order_items.csv" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

# Inventory ConfigMaps
echo "  Creating Inventory ConfigMaps..."
kubectl create configmap inventory-db-init \
  --from-file="$INIT_DIR/inventory/init_inventory.sql" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

kubectl create configmap inventory-csv \
  --from-file="$INIT_DIR/inventory/eci_inventory.csv" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

# Payments ConfigMaps
echo "  Creating Payments ConfigMaps..."
kubectl create configmap payments-db-init \
  --from-file="$INIT_DIR/payments/init_payments.sql" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

kubectl create configmap payments-csv \
  --from-file="$INIT_DIR/payments/eci_payments.csv" \
  -n $NAMESPACE --dry-run=client -o yaml | kubectl apply -f - || true

echo "ConfigMaps created successfully."
echo ""

# Deploy Databases
echo "Deploying databases..."
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-db.yml"
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-configmap.yml"
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-secret.yml"

kubectl apply -f "$SCRIPT_DIR/orders/orders-db.yml"
kubectl apply -f "$SCRIPT_DIR/orders/orders-secret.yml"

kubectl apply -f "$SCRIPT_DIR/inventory/inventory-db.yml"
kubectl apply -f "$SCRIPT_DIR/inventory/inventory-secret.yml"
kubectl apply -f "$SCRIPT_DIR/inventory/inventory-configmap.yml"

kubectl apply -f "$SCRIPT_DIR/payments/payments-db.yml"
kubectl apply -f "$SCRIPT_DIR/payments/payments-secret.yml"

# Wait for databases to be ready
echo "Waiting for databases to be ready..."
kubectl wait --for=condition=ready pod -l app=catalog-db -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=orders-db -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=inventory-db -n $NAMESPACE --timeout=120s
kubectl wait --for=condition=ready pod -l app=payments-db -n $NAMESPACE --timeout=120s

echo 
# Deploy Services
echo "Deploying microservices..."
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-deployment.yml"
kubectl apply -f "$SCRIPT_DIR/catalog/catalog-service.yml"

kubectl apply -f "$SCRIPT_DIR/orders/orders-service.yml"

kubectl apply -f "$SCRIPT_DIR/inventory/inventory-deployment.yml"
kubectl apply -f "$SCRIPT_DIR/inventory/inventory-service.yml"

kubectl apply -f "$SCRIPT_DIR/payments/payments-deployment.yml"

# Deploy Ingress
echo "Deploying Ingress..."
kubectl apply -f "$SCRIPT_DIR/ingress/ingress.yml"

# Deploy Monitoring Stack
echo "Deploying monitoring stack..."
kubectl apply -f "$SCRIPT_DIR/monitoring/prometheus-configmap.yml"
kubectl apply -f "$SCRIPT_DIR/monitoring/prometheus-deployment.yml"
kubectl apply -f "$SCRIPT_DIR/monitoring/prometheus-service.yml"

kubectl apply -f "$SCRIPT_DIR/monitoring/grafana-configmap.yml"
kubectl apply -f "$SCRIPT_DIR/monitoring/grafana-deployment.yml"
kubectl apply -f "$SCRIPT_DIR/monitoring/grafana-service.yml"

kubectl apply -f "$SCRIPT_DIR/monitoring/logging-configmap.yml"

# Wait for services to be ready
echo "Waiting for services to be ready..."
kubectl wait --for=condition=ready pod -l app=catalog-service -n $NAMESPACE --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=orders-service -n $NAMESPACE --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=inventory-service -n $NAMESPACE --timeout=300s || true
kubectl wait --for=condition=ready pod -l app=payments-service -n $NAMESPACE --timeout=300s || true

# Display deployment status
echo ""
echo "=========================================="
echo "Deployment Status"
echo "=========================================="
kubectl get pods -n $NAMESPACE
echo ""
kubectl get svc -n $NAMESPACE
echo ""
kubectl get ingress -n $NAMESPACE
echo ""

# Get Minikube IP
MINIKUBE_IP=$(minikube ip)
echo "=========================================="
echo "Access Information"
echo "=========================================="
echo "Minikube IP: $MINIKUBE_IP"
echo ""
echo "Services (NodePort):"
echo "  Catalog:    http://$MINIKUBE_IP:30080/v1/products"
echo "  Orders:     http://$MINIKUBE_IP:30082/v1/orders"
echo "  Inventory:  http://$MINIKUBE_IP:30081/v1/inventory"
echo "  Payments:   http://$MINIKUBE_IP:30083/v1/payments"
echo ""
#echo "Monitoring:"
#echo "  Prometheus: http://$MINIKUBE_IP:30090"
#echo "  Grafana:    http://$MINIKUBE_IP:30300 (admin/admin)"
echo ""
#echo "To port-forward for local access:"
#echo "  kubectl port-forward -n $NAMESPACE svc/grafana 3000:3000"
#echo "  kubectl port-forward -n $NAMESPACE svc/prometheus 9090:9090"
echo "=========================================="

