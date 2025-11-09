# Catalog Service - E-commerce Microservice

## Overview
The Catalog Service is a microservice responsible for managing the product catalog in an e-commerce platform. It provides CRUD operations, search functionality, pricing management, and product activation/deactivation capabilities.

## Architecture

### Technology Stack
- **Framework**: Spring Boot 3.2.0
- **Language**: Java 17
- **Database**: MySQL 8.0
- **Build Tool**: Maven
- **API Documentation**: OpenAPI 3.0 (Swagger)
- **Containerization**: Docker
- **Orchestration**: Kubernetes (Minikube)
- **Monitoring**: Spring Actuator + Prometheus

### Database Schema
**Products Table**:
- `product_id` (BIGINT, Primary Key, Auto-increment)
- `sku` (VARCHAR(50), Unique, Not Null)
- `name` (VARCHAR(255), Not Null)
- `category` (VARCHAR(100), Not Null)
- `price` (DECIMAL(10,2), Not Null)
- `is_active` (BOOLEAN, Not Null, Default: true)
- `created_at` (TIMESTAMP, Not Null)
- `updated_at` (TIMESTAMP)

### API Endpoints

#### Product Management
- `POST /v1/products` - Create a new product
- `GET /v1/products/{productId}` - Get product by ID
- `GET /v1/products/sku/{sku}` - Get product by SKU
- `GET /v1/products` - Get all products (paginated)
- `PUT /v1/products/{productId}` - Update product
- `DELETE /v1/products/{productId}` - Delete product

#### Search & Filter
- `GET /v1/products/search?keyword={keyword}` - Search products
- `GET /v1/products/filter?category={category}&isActive={true/false}` - Filter products

#### Pricing
- `GET /v1/products/{productId}/price` - Get product price
- `PATCH /v1/products/{productId}/price` - Update product price

#### Activation
- `PATCH /v1/products/{productId}/activate` - Activate product
- `PATCH /v1/products/{productId}/deactivate` - Deactivate product

#### Monitoring
- `GET /actuator/health` - Health check
- `GET /actuator/metrics` - Metrics
- `GET /actuator/prometheus` - Prometheus metrics

#### API Documentation
- `GET /swagger-ui.html` - Swagger UI
- `GET /v1/api-docs` - OpenAPI JSON spec

## Getting Started

### Prerequisites
- Java 17 or higher
- Maven 3.8+
- Docker & Docker Compose
- Minikube (for Kubernetes deployment)
- kubectl

### Local Development

#### 1. Clone the Repository
git clone <repository-url>
cd catalog-service


#### 2. Build the Project
mvn clean package


#### 3. Run Locally (with local MySQL)
Start MySQL
docker run -d --name mysql -e MYSQL_ROOT_PASSWORD=root123 -e MYSQL_DATABASE=catalog_db -p 3306:3306 mysql:8.0

Run the application
mvn spring-boot:run



#### 4. Access the Application
- API Base URL: http://localhost:8081
- Swagger UI: http://localhost:8081/swagger-ui.html
- Health Check: http://localhost:8081/actuator/health

## Docker Deployment

### Build Docker Image
docker build -t catalog-service:1.0.0 .



### Run with Docker Compose
docker-compose up -d



### Check Container Status
docker-compose ps



### View Logs
docker-compose logs -f catalog-service



### Stop Services
docker-compose down



## Kubernetes Deployment on Minikube

### 1. Start Minikube
minikube start --driver=docker --cpus=4 --memory=7000


### 2. Enable Addons
minikube addons enable metrics-server
minikube addons enable ingress



### 3. Build Docker Image in Minikube
minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t catalog-service:1.0.0 .



### 4. Deploy to Kubernetes
Apply configurations in order
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mysql-deployment.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml



### 5. Check Deployment Status
kubectl get pods
kubectl get services
kubectl get deployments



### 6. Access the Service
Get Minikube IP
minikube ip

Access service
curl http://$(minikube ip):30081/actuator/health

Or use port forwarding
kubectl port-forward service/catalog-service 8081:8081



### 7. View Logs
kubectl logs -f deployment/catalog-service



### 8. Scale the Service
kubectl scale deployment catalog-service --replicas=3