# Kubernetes Deployment for E-commerce Microservices

## Overview
This directory contains Kubernetes manifests for deploying the e-commerce microservices on Minikube with monitoring infrastructure.

## Directory Structure
```
k8s/
├── catalog/          # Catalog service manifests
├── orders/           # Orders service manifests
├── inventory/        # Inventory service manifests
├── payments/         # Payments service manifests
├── ingress/          # Ingress configuration
├── monitoring/       # Prometheus, Grafana, and logging configs
├── deploy.sh         # Automated deployment script
└── DEPLOYMENT_WORKFLOW.md  # Detailed deployment workflow
```

## Quick Start

### Prerequisites
- Minikube installed
- kubectl configured
- Docker images available (or using remote registry)

### Automated Deployment
```bash
cd /home/blade/projects/scalable/k8s
./deploy.sh
```

### Manual Deployment
Follow the steps in [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md)

## Services

### Catalog Service
- **Port**: 8080
- **NodePort**: 30080
- **Health**: `/actuator/health`
- **Metrics**: `/actuator/prometheus`

### Orders Service
- **Port**: 8082
- **NodePort**: 30082
- **Health**: `/actuator/health` or `/v1/orders`
- **Metrics**: `/actuator/prometheus`

### Inventory Service
- **Port**: 8081
- **NodePort**: 30081
- **Health**: `/actuator/health` or `/v1/inventory`
- **Metrics**: `/actuator/prometheus`

### Payments Service
- **Port**: 8083
- **NodePort**: 30083
- **Health**: `/actuator/health` or `/v1/payments`
- **Metrics**: `/actuator/prometheus`

## Monitoring

### Prometheus
- **Port**: 9090
- **NodePort**: 30090
- **Access**: `http://$(minikube ip):30090`

### Grafana
- **Port**: 3000
- **NodePort**: 30300
- **Access**: `http://$(minikube ip):30300`
- **Credentials**: admin/admin

### Metrics Collected
- `orders_placed_total` - Total orders created
- `payments_failed_total` - Failed payment attempts
- `inventory_reserve_latency_ms` - Inventory reservation latency
- `stockouts_total` - Stockout events
- `http_server_requests_seconds` - HTTP request latency
- `jvm_memory_used_bytes` - JVM memory usage

## Logging
- All services log in structured JSON format
- PII (email, phone, address) should be masked in application code
- Logging configuration available in `monitoring/logging-configmap.yml`

## Ingress
Ingress is configured for host-based routing:
- Host: `api.eci.local`
- Paths:
  - `/v1/products` → Catalog Service
  - `/v1/orders` → Orders Service
  - `/v1/inventory` → Inventory Service
  - `/v1/payments` → Payments Service

To use ingress, add to `/etc/hosts`:
```
$(minikube ip) api.eci.local
```

## Verification

### Check Pod Status
```bash
kubectl get pods -n eci
```

### Check Services
```bash
kubectl get svc -n eci
```

### Check Ingress
```bash
kubectl get ingress -n eci
```

### Test API
```bash
MINIKUBE_IP=$(minikube ip)
curl http://$MINIKUBE_IP:30080/v1/products
```

### Check Metrics
```bash
MINIKUBE_IP=$(minikube ip)
curl http://$MINIKUBE_IP:30080/actuator/prometheus | grep orders_placed_total
```

## Troubleshooting

### View Pod Logs
```bash
kubectl logs -n eci <pod-name>
kubectl logs -n eci -l app=catalog-service
```

### Describe Pod
```bash
kubectl describe pod -n eci <pod-name>
```

### Restart Deployment
```bash
kubectl rollout restart deployment/<deployment-name> -n eci
```

### Delete and Redeploy
```bash
kubectl delete -f <manifest-file>
kubectl apply -f <manifest-file>
```

## Cleanup
```bash
# Delete all resources
kubectl delete namespace eci

# Or delete specific resources
kubectl delete -f <directory>
```

## Resources
- [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) - Detailed deployment workflow
- [Main README](../README.md) - Overall project documentation

