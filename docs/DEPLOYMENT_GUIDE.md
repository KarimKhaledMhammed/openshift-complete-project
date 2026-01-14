# 📚 Bookstore Application - Deployment Guide

This guide provides step-by-step instructions for running the Bookstore application locally and on OpenShift using the provided automation scripts.

---

## Part 1: Local Deployment

### Prerequisites

- ✅ Podman installed and running
- ✅ Git installed
- ✅ At least 4GB of free RAM
- ✅ Ports 3000, 3306, 6379, and 8080 available

### Step-by-Step Instructions

#### Step 1: Navigate to Project Directory

```bash
cd ~/Project-student-version
```

#### Step 2: Make Scripts Executable (if needed)

```bash
chmod +x scripts/*.sh
```

#### Step 3: Run Local Deployment Script

```bash
./scripts/run-local.sh
```

**This script will automatically:**
- Check if Podman is running
- Create a Podman network
- Start MySQL container with proper environment variables
- Start Redis container
- Start Backend container linked to MySQL and Redis
- Start Frontend container
- Display service status and access URLs

**Expected output:**
```
🏃 Running Bookstore Application Locally...
🧹 Cleaning up existing containers...
🏗️  Building images...
🚀 Starting services...
⏳ Waiting for MySQL 8.0 to initialize...

📊 Service Status:
NAME       STATUS    PORTS
mysql      Up        0.0.0.0:3306->3306/tcp
redis      Up        0.0.0.0:6379->6379/tcp
backend    Up        0.0.0.0:3000->3000/tcp
frontend   Up        0.0.0.0:8080->8080/tcp

✅ Application is running!

🌐 Access the application:
   Frontend: http://localhost:8080
   Backend API: http://localhost:3000
   MySQL: localhost:3306 (user: bookstore, password: securepassword123)
   Redis: localhost:6379
```

#### Step 4: Test the Application

```bash
# Test backend health
curl http://localhost:3000/api/health

# Get all books
curl http://localhost:3000/api/books

# Access frontend in browser
# Open: http://localhost:8080
```

**Expected results:**
- Health endpoint: `{"status":"healthy"}`
- Books endpoint: JSON array with 8 books
- Frontend: Bookstore web interface

#### Step 5: View Logs (Optional)

```bash
# View all logs
podman logs mysql
podman logs redis
podman logs backend
podman logs frontend

# Follow logs in real-time
podman logs -f backend
podman logs -f mysql
```

### Stopping Local Deployment

```bash
# Stop all containers
podman stop frontend backend redis mysql

# Remove all containers
podman rm frontend backend redis mysql

# Remove network
podman network rm bookstore-net
```

### Troubleshooting Local Deployment

| Problem | Solution |
|---------|----------|
| Script fails with "Podman is not running" | Start Podman service<br>Verify: `podman info` |
| Port already in use | Stop existing containers: `podman stop mysql redis backend frontend`<br>Then remove them: `podman rm mysql redis backend frontend` |
| Backend cannot connect to database | Wait longer for MySQL initialization (15-20 seconds)<br>Check MySQL logs: `podman logs mysql` |

---

## Part 2: OpenShift Deployment

### Prerequisites

- ✅ OpenShift cluster access (CRC or full cluster)
- ✅ OpenShift CLI (`oc`) installed
- ✅ Cluster admin privileges (for creating projects)
- ✅ At least 4GB of free resources in cluster

### Step-by-Step Instructions

#### Step 1: Login to OpenShift

```bash
# For CRC (local OpenShift)
oc login -u developer -p developer https://api.crc.testing:6443

# For remote cluster
oc login <cluster-url> --token=<your-token>

# Verify login
oc whoami
```

**Expected output:** Your username

#### Step 2: Create Project

```bash
oc new-project bookstore-project

# Verify project was created
oc project
```

**Expected output:** `Using project "bookstore-project"`

#### Step 3: Navigate to Project Directory

```bash
cd ~/Project-student-version
```

#### Step 4: Build Images on OpenShift

```bash
./scripts/build-on-openshift.sh
```

**This script will automatically:**
- Create ImageStreams for each component
- Create BuildConfigs using Docker strategy
- Upload source code and build images
- Tag images as v1.0

**Expected output:**
```
🏗️  Building images on OpenShift...

📦 Building bookstore-backend...
   Uploading source from backend...
   [Build logs...]
   Push successful

📦 Building bookstore-frontend...
   Uploading source from frontend...
   [Build logs...]
   Push successful

📦 Building bookstore-database...
   Uploading source from database...
   [Build logs...]
   Push successful

✅ All images built successfully!

📋 Image Summary:
   - bookstore-backend:v1.0  (Node.js 18)
   - bookstore-frontend:v1.0 (Nginx)
   - bookstore-database:v1.0 (MySQL 8.0)

Next step: Run './scripts/deploy-openshift.sh' to deploy
```

⏱️ **Build time:** Approximately 5-10 minutes depending on network speed

#### Step 5: Deploy Application

```bash
./scripts/deploy-openshift.sh
```

**This script will automatically:**
- Apply base resources (deployments, services, PVC, secrets)
- Wait for MySQL to initialize
- Verify MySQL initialization
- Apply security policies (network policies)
- Apply autoscaling (HPA, PDB)
- Display pod status and application URL

**Expected output:**
```
🚀 Deploying to OpenShift...
Already on project "bookstore-project"

📦 Applying base resources...
secret/bookstore-secrets configured
persistentvolumeclaim/mysql-pvc created
service/backend unchanged
service/frontend unchanged
service/mysql unchanged
service/redis unchanged
deployment.apps/mysql created
deployment.apps/redis created
deployment.apps/backend created
deployment.apps/frontend created
route.route.openshift.io/bookstore created

⏳ Waiting for MySQL 8.0 to initialize...
pod/mysql-xxx condition met

🔍 Verifying MySQL initialization...
✅ MySQL 8.0 initialized successfully
   - Database 'bookstore' created
   - User 'bookstore' created with full privileges
   - Sample data loaded (8 books)

🔒 Applying security policies...
networkpolicy.networking.k8s.io/allow-backend-to-db created
networkpolicy.networking.k8s.io/allow-backend-to-redis created
networkpolicy.networking.k8s.io/allow-frontend-to-backend created
networkpolicy.networking.k8s.io/default-deny-ingress created

📈 Applying autoscaling configuration...
horizontalpodautoscaler.autoscaling/bookstore-backend-hpa created
poddisruptionbudget.policy/bookstore-backend-pdb created

📊 Pod Status:
NAME                        READY   STATUS    RESTARTS   AGE
backend-xxx                 1/1     Running   0          30s
frontend-xxx                1/1     Running   0          30s
mysql-xxx                   1/1     Running   0          35s
redis-xxx                   1/1     Running   0          30s

🌐 Application URL:
bookstore-bookstore-project.apps.crc.testing
```

⏱️ **Deployment time:** Approximately 2-3 minutes

#### Step 6: Test the Application

```bash
# Get the application URL
export APP_URL=$(oc get route bookstore -o jsonpath='{.spec.host}')
echo "Application URL: http://$APP_URL"

# Test backend health
curl http://$APP_URL/api/health

# Test backend readiness
curl http://$APP_URL/api/ready

# Get all books
curl http://$APP_URL/api/books

# Access frontend in browser
# Open: http://$APP_URL
```

**Expected results:**
- Health endpoint: `{"status":"healthy"}`
- Ready endpoint: `{"status":"ready","database":"connected","redis":"connected"}`
- Books endpoint: JSON array with 8 books
- Frontend: Bookstore web interface

#### Step 7: Monitor Deployment (Optional)

```bash
# Watch pod status
oc get pods -l app=bookstore -w

# View logs
oc logs -f deployment/backend
oc logs -f deployment/mysql

# Check resource usage
oc adm top pods -l app=bookstore

# Check HPA status
oc get hpa
```

### Updating the Application

After making code changes:

```bash
# 1. Rebuild images
./scripts/build-on-openshift.sh

# 2. Restart deployments
oc rollout restart deployment/backend
oc rollout restart deployment/frontend

# 3. Watch rollout
oc rollout status deployment/backend
```

### Cleanup

```bash
./scripts/cleanup.sh
```

**This script will automatically:**
- Delete all deployments
- Delete all services
- Delete routes
- Delete PVCs
- Delete secrets
- Delete network policies
- Delete autoscaling resources
- Delete builds and imagestreams

**Expected output:**
```
🧹 Cleaning up OpenShift resources...
📦 Deleting deployments...
🌐 Deleting services...
🛣️  Deleting routes...
💾 Deleting persistent volume claims...
🔐 Deleting secrets...
🔒 Deleting network policies...
📈 Deleting autoscaling resources...
🏗️  Deleting builds and images...

✅ Cleanup complete!

To redeploy:
  1. ./scripts/build-on-openshift.sh
  2. ./scripts/deploy-openshift.sh
```

### Troubleshooting OpenShift Deployment

| Problem | Solution |
|---------|----------|
| Build fails | Check build logs: `oc logs -f bc/bookstore-backend`<br>Ensure network connectivity to pull base images |
| Pods stuck in "Pending" state | Check resource availability: `oc describe pod <pod-name>`<br>Look for "Insufficient cpu" or "Insufficient memory" |
| MySQL pod in "CrashLoopBackOff" | Check logs: `oc logs deployment/mysql`<br>Ensure PVC is bound: `oc get pvc`<br>Delete and redeploy if needed |
| Cannot access application via route | Check route exists: `oc get route bookstore`<br>Verify ingress controller is running |

---

## Additional Information

### Available Scripts

| Script | Description |
|--------|-------------|
| `scripts/run-local.sh` | Run application locally with Podman |
| `scripts/build-on-openshift.sh` | Build images on OpenShift |
| `scripts/deploy-openshift.sh` | Deploy application to OpenShift |
| `scripts/cleanup.sh` | Clean up all OpenShift resources |
| `scripts/check-prerequisites.sh` | Check if all prerequisites are met |
| `scripts/scan-images.sh` | Run security scans with Trivy |
| `scripts/validate-security.sh` | Validate security configurations |

### Database Details

- **Database:** MySQL 8.0
- **Default Database:** bookstore
- **Default User:** bookstore
- **Default Password:** securepassword123
- **Sample Data:** 8 books pre-loaded

### Architecture

```
Frontend (Nginx) → Backend (Node.js) → Redis (Cache)
                                     → MySQL (Database)
```

### Ports

| Service | Port |
|---------|------|
| Frontend | 8080 |
| Backend | 3000 |
| MySQL | 3306 |
| Redis | 6379 |

### Quick Reference

#### Local Development

```bash
# Start
./scripts/run-local.sh

# Stop
podman stop frontend backend redis mysql
podman rm frontend backend redis mysql

# Logs
podman logs -f backend
```

#### OpenShift

```bash
# Build
./scripts/build-on-openshift.sh

# Deploy
./scripts/deploy-openshift.sh

# Clean
./scripts/cleanup.sh

# Status
oc get pods -l app=bookstore

# Logs
oc logs -f deployment/backend

# URL
oc get route bookstore -o jsonpath='{.spec.host}'
```

---

## Support

For issues or questions:

1. Check logs first (`podman logs <container>` or `oc logs`)
2. Review troubleshooting sections above
3. Verify all prerequisites are met
4. Ensure all scripts are executable (`chmod +x scripts/*.sh`)

---

**Good luck! 🚀**
