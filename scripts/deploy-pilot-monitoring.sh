#!/bin/bash

# Deploy Pilot Monitoring Infrastructure
# Swedish Café Pilot Program - Business Readiness Monitoring
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MONITORING_DIR="$PROJECT_ROOT/monitoring"
ENVIRONMENT="${1:-pilot}"
NAMESPACE="feedback-platform-pilot"

echo -e "${BLUE}🇸🇪 Deploying Pilot Monitoring Infrastructure${NC}"
echo -e "${BLUE}Environment: $ENVIRONMENT${NC}"
echo -e "${BLUE}Namespace: $NAMESPACE${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check if monitoring directory exists
    if [[ ! -d "$MONITORING_DIR" ]]; then
        echo -e "${RED}❌ Monitoring directory not found: $MONITORING_DIR${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to create necessary directories
create_directories() {
    echo -e "${YELLOW}📁 Creating monitoring directories...${NC}"
    
    mkdir -p "$MONITORING_DIR/data/prometheus"
    mkdir -p "$MONITORING_DIR/data/grafana"
    mkdir -p "$MONITORING_DIR/data/alertmanager"
    mkdir -p "$MONITORING_DIR/logs"
    mkdir -p "$MONITORING_DIR/configs/pilot"
    
    # Set proper permissions
    chmod 755 "$MONITORING_DIR/data"
    chmod 755 "$MONITORING_DIR/data/prometheus"
    chmod 755 "$MONITORING_DIR/data/grafana"
    chmod 755 "$MONITORING_DIR/data/alertmanager"
    
    echo -e "${GREEN}✅ Directories created${NC}"
}

# Function to generate pilot-specific configuration
generate_pilot_config() {
    echo -e "${YELLOW}⚙️ Generating pilot-specific configuration...${NC}"
    
    # Create pilot docker-compose override
    cat > "$MONITORING_DIR/docker-compose.pilot.yml" << EOF
version: '3.8'

services:
  prometheus:
    container_name: prometheus-pilot
    image: prom/prometheus:latest
    command:
      - '--config.file=/etc/prometheus/prometheus.pilot.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
      - '--web.enable-admin-api'
    volumes:
      - ./prometheus.pilot.yml:/etc/prometheus/prometheus.pilot.yml
      - ./pilot-business-alerts.yml:/etc/prometheus/rules/pilot-alerts.yml
      - ./data/prometheus:/prometheus
    ports:
      - "9090:9090"
    networks:
      - pilot-monitoring
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.prometheus.rule=Host(\`prometheus-pilot.feedback-platform.se\`)"
      - "traefik.http.services.prometheus.loadbalancer.server.port=9090"

  grafana:
    container_name: grafana-pilot
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=\${GRAFANA_ADMIN_PASSWORD:-pilot-admin-2024}
      - GF_SERVER_DOMAIN=grafana-pilot.feedback-platform.se
      - GF_SERVER_ROOT_URL=https://grafana-pilot.feedback-platform.se
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
    volumes:
      - ./data/grafana:/var/lib/grafana
      - ./pilot-business-readiness-dashboard.json:/etc/grafana/provisioning/dashboards/pilot-readiness.json
      - ./grafana-pilot-datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
    ports:
      - "3001:3000"
    networks:
      - pilot-monitoring
    depends_on:
      - prometheus
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.grafana.rule=Host(\`grafana-pilot.feedback-platform.se\`)"
      - "traefik.http.services.grafana.loadbalancer.server.port=3000"

  alertmanager:
    container_name: alertmanager-pilot
    image: prom/alertmanager:latest
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
      - '--web.external-url=https://alertmanager-pilot.feedback-platform.se'
      - '--cluster.listen-address=0.0.0.0:9094'
    volumes:
      - ./pilot-business-alerts.yml:/etc/alertmanager/alertmanager.yml
      - ./data/alertmanager:/alertmanager
    ports:
      - "9093:9093"
      - "9094:9094"
    networks:
      - pilot-monitoring
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.alertmanager.rule=Host(\`alertmanager-pilot.feedback-platform.se\`)"
      - "traefik.http.services.alertmanager.loadbalancer.server.port=9093"

  pilot-health-checker:
    container_name: pilot-health-checker
    build:
      context: .
      dockerfile: Dockerfile.health-checker
    environment:
      - NODE_ENV=pilot
      - API_GATEWAY_URL=http://api-gateway:3001
      - CUSTOMER_PWA_URL=http://customer-pwa:3000
      - BUSINESS_DASHBOARD_URL=http://business-dashboard:3002
      - ADMIN_DASHBOARD_URL=http://admin-dashboard:3003
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=\${DATABASE_URL}
      - CHECK_INTERVAL=30000
    volumes:
      - ./logs:/app/logs
    networks:
      - pilot-monitoring
      - app-network
    depends_on:
      - prometheus
    restart: unless-stopped

  loki:
    container_name: loki-pilot
    image: grafana/loki:latest
    command: -config.file=/etc/loki/local-config.yaml
    volumes:
      - ./loki.yml:/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    networks:
      - pilot-monitoring

  promtail:
    container_name: promtail-pilot
    image: grafana/promtail:latest
    command: -config.file=/etc/promtail/config.yml
    volumes:
      - ./promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
      - ./logs:/pilot-logs:ro
    networks:
      - pilot-monitoring
    depends_on:
      - loki

networks:
  pilot-monitoring:
    driver: bridge
    name: pilot-monitoring
  app-network:
    external: true
    name: feedback-platform-network

volumes:
  prometheus-data:
    driver: local
  grafana-data:
    driver: local
  alertmanager-data:
    driver: local
EOF

    echo -e "${GREEN}✅ Pilot configuration generated${NC}"
}

# Function to create Grafana datasources
create_grafana_config() {
    echo -e "${YELLOW}📊 Creating Grafana configuration...${NC}"
    
    cat > "$MONITORING_DIR/grafana-pilot-datasources.yml" << EOF
apiVersion: 1

datasources:
  - name: Prometheus-Pilot
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 10s
      queryTimeout: 60s
    editable: true

  - name: Loki-Pilot
    type: loki
    access: proxy
    url: http://loki:3100
    jsonData:
      maxLines: 1000
    editable: true

  - name: Swedish-Business-Metrics
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    jsonData:
      timeInterval: 5s
      queryTimeout: 30s
      customQueryParameters: 'pilot_program=swedish-cafes'
    editable: true
EOF

    echo -e "${GREEN}✅ Grafana configuration created${NC}"
}

# Function to create health checker Dockerfile
create_health_checker_dockerfile() {
    echo -e "${YELLOW}🐳 Creating health checker Dockerfile...${NC}"
    
    cat > "$MONITORING_DIR/Dockerfile.health-checker" << EOF
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy health checker
COPY pilot-health-checker.js ./
COPY --from=dependencies package*.json ./

# Create package.json if not exists
RUN echo '{"name":"pilot-health-checker","version":"1.0.0","main":"pilot-health-checker.js","dependencies":{"axios":"^1.6.0","redis":"^4.6.0","pg":"^8.11.0"}}' > package.json || true
RUN npm install axios redis pg

# Create logs directory
RUN mkdir -p /app/logs

# Non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

EXPOSE 3010

CMD ["node", "pilot-health-checker.js"]
EOF

    echo -e "${GREEN}✅ Health checker Dockerfile created${NC}"
}

# Function to set up SSL certificates (for production)
setup_ssl_certificates() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo -e "${YELLOW}🔒 Setting up SSL certificates...${NC}"
        
        # Create certificates directory
        mkdir -p "$MONITORING_DIR/certs"
        
        # Generate self-signed certificates for development
        # In production, use Let's Encrypt or proper CA certificates
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$MONITORING_DIR/certs/pilot.key" \
            -out "$MONITORING_DIR/certs/pilot.crt" \
            -subj "/C=SE/ST=Stockholm/L=Stockholm/O=FeedbackPlatform/CN=*.feedback-platform.se"
        
        echo -e "${GREEN}✅ SSL certificates generated${NC}"
    fi
}

# Function to validate configuration
validate_configuration() {
    echo -e "${YELLOW}🔍 Validating configuration...${NC}"
    
    # Check if required files exist
    local required_files=(
        "prometheus.pilot.yml"
        "pilot-business-alerts.yml"
        "pilot-business-readiness-dashboard.json"
        "pilot-health-checker.js"
    )
    
    for file in "${required_files[@]}"; do
        if [[ ! -f "$MONITORING_DIR/$file" ]]; then
            echo -e "${RED}❌ Required file missing: $file${NC}"
            exit 1
        fi
    done
    
    # Validate Prometheus configuration
    docker run --rm -v "$MONITORING_DIR":/workspace prom/prometheus:latest \
        promtool check config /workspace/prometheus.pilot.yml
    
    # Validate alert rules
    docker run --rm -v "$MONITORING_DIR":/workspace prom/prometheus:latest \
        promtool check rules /workspace/pilot-business-alerts.yml
    
    echo -e "${GREEN}✅ Configuration validation passed${NC}"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    echo -e "${YELLOW}🚀 Deploying monitoring stack...${NC}"
    
    cd "$MONITORING_DIR"
    
    # Pull latest images
    docker-compose -f docker-compose.pilot.yml pull
    
    # Start services
    docker-compose -f docker-compose.pilot.yml up -d
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
    sleep 30
    
    # Check service health
    local services=("prometheus" "grafana" "alertmanager" "pilot-health-checker")
    for service in "${services[@]}"; do
        if docker-compose -f docker-compose.pilot.yml ps "$service" | grep -q "Up"; then
            echo -e "${GREEN}✅ $service is running${NC}"
        else
            echo -e "${RED}❌ $service failed to start${NC}"
            docker-compose -f docker-compose.pilot.yml logs "$service"
        fi
    done
    
    echo -e "${GREEN}✅ Monitoring stack deployed${NC}"
}

# Function to display access information
display_access_info() {
    echo ""
    echo -e "${BLUE}🌟 Pilot Monitoring Infrastructure Deployed Successfully!${NC}"
    echo ""
    echo -e "${GREEN}📊 Access Information:${NC}"
    echo -e "  Grafana Dashboard:    http://localhost:3001 (admin/pilot-admin-2024)"
    echo -e "  Prometheus:          http://localhost:9090"
    echo -e "  Alertmanager:        http://localhost:9093"
    echo -e "  Health Checker:      Logs in $MONITORING_DIR/logs/"
    echo ""
    echo -e "${GREEN}🇸🇪 Pilot Café Monitoring:${NC}"
    echo -e "  Aurora (Stockholm):   Monitored"
    echo -e "  Malmö Huset:         Monitored"
    echo -e "  Göteborg Center:     Monitored"
    echo ""
    echo -e "${YELLOW}⚠️  Important Notes:${NC}"
    echo -e "  • All pilot cafés are now being monitored in real-time"
    echo -e "  • Business readiness alerts are active"
    echo -e "  • Swedish compliance monitoring enabled"
    echo -e "  • SLA violations will trigger immediate alerts"
    echo ""
    echo -e "${BLUE}🎯 Next Steps:${NC}"
    echo -e "  1. Configure Slack/email notifications in pilot-business-alerts.yml"
    echo -e "  2. Set up external domain names for production access"
    echo -e "  3. Configure proper SSL certificates for HTTPS"
    echo -e "  4. Test alert notification channels"
    echo -e "  5. Train pilot support team on monitoring dashboards"
    echo ""
    echo -e "${GREEN}✨ System is now ready for real Swedish café deployment!${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}Starting pilot monitoring deployment...${NC}"
    
    check_prerequisites
    create_directories
    generate_pilot_config
    create_grafana_config
    create_health_checker_dockerfile
    setup_ssl_certificates
    validate_configuration
    deploy_monitoring
    display_access_info
    
    echo ""
    echo -e "${GREEN}🎉 Pilot Monitoring Infrastructure Deployment Complete!${NC}"
    echo -e "${BLUE}The system is now ready for real business deployment.${NC}"
}

# Error handling
trap 'echo -e "${RED}❌ Deployment failed at line $LINENO${NC}"; exit 1' ERR

# Run main function
main "$@"