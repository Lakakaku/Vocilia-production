#!/bin/bash

# AI Feedback Platform - Pilot Domain Setup Script
# Sets up SSL certificates and domain configuration for Swedish pilot cafés

set -e

echo "🇸🇪 Setting up Swedish Pilot Program Domains..."

# Pilot domain configuration
MAIN_DOMAIN="feedbackai.se"
STAGING_DOMAINS=(
    "staging.${MAIN_DOMAIN}"
    "business.staging.${MAIN_DOMAIN}"
    "admin.staging.${MAIN_DOMAIN}"
)

# Pilot café subdomains (one per café)
PILOT_CAFE_DOMAINS=(
    "aurora.${MAIN_DOMAIN}"      # Café Aurora - Stockholm
    "malmohuset.${MAIN_DOMAIN}"  # Malmö Huset - Malmö
    "goteborg.${MAIN_DOMAIN}"    # Göteborg Café - Göteborg
)

# Check if running with proper permissions
if [[ $EUID -ne 0 ]] && [[ -z "$SUDO_USER" ]]; then
    echo "⚠️  This script may need sudo access for SSL certificate management."
    echo "   Run with: sudo ./scripts/setup-pilot-domains.sh"
fi

# Create SSL directory
mkdir -p nginx/ssl
mkdir -p nginx/ssl/pilot-cafes

echo "📋 Pilot Domain Configuration"
echo "============================"
echo "Main staging: ${STAGING_DOMAINS[0]}"
echo "Business portal: ${STAGING_DOMAINS[1]}"
echo "Admin portal: ${STAGING_DOMAINS[2]}"
echo ""
echo "Pilot café domains:"
for domain in "${PILOT_CAFE_DOMAINS[@]}"; do
    echo "  - https://$domain"
done
echo ""

# Function to generate self-signed certificate
generate_self_signed_cert() {
    local domain=$1
    local cert_dir=$2
    
    echo "🔒 Generating self-signed certificate for $domain..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$cert_dir/${domain}.key" \
        -out "$cert_dir/${domain}.crt" \
        -subj "/C=SE/ST=Stockholm/L=Stockholm/O=AI Feedback Platform/CN=$domain" \
        -addext "subjectAltName=DNS:$domain,DNS:www.$domain"
    
    echo "   ✅ Self-signed certificate created for $domain"
}

# Function to setup Let's Encrypt certificate
setup_letsencrypt() {
    local domain=$1
    
    echo "🔒 Setting up Let's Encrypt certificate for $domain..."
    
    # Check if certbot is available
    if ! command -v certbot &> /dev/null; then
        echo "   📦 Installing certbot..."
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y certbot python3-certbot-nginx
        elif command -v yum &> /dev/null; then
            sudo yum install -y certbot python3-certbot-nginx
        else
            echo "   ❌ Unable to install certbot automatically. Please install manually."
            return 1
        fi
    fi
    
    # Generate certificate
    sudo certbot certonly --nginx \
        --non-interactive \
        --agree-tos \
        --email "admin@${MAIN_DOMAIN}" \
        -d "$domain"
    
    # Copy certificates to nginx directory
    sudo cp "/etc/letsencrypt/live/$domain/fullchain.pem" "nginx/ssl/${domain}.crt"
    sudo cp "/etc/letsencrypt/live/$domain/privkey.pem" "nginx/ssl/${domain}.key"
    sudo chown $USER:$USER "nginx/ssl/${domain}.crt" "nginx/ssl/${domain}.key"
    
    echo "   ✅ Let's Encrypt certificate configured for $domain"
}

# Main certificate setup
echo "🔐 SSL Certificate Setup"
echo "======================="

# Check if user wants Let's Encrypt or self-signed certificates
read -p "Use Let's Encrypt certificates? (y/N): " use_letsencrypt

if [[ "$use_letsencrypt" =~ ^[Yy]$ ]]; then
    echo "📝 Setting up Let's Encrypt certificates..."
    
    # Verify DNS is properly configured
    echo "⚠️  Before proceeding, ensure DNS records are configured:"
    for domain in "${STAGING_DOMAINS[@]}" "${PILOT_CAFE_DOMAINS[@]}"; do
        echo "   $domain -> $(dig +short A $domain 2>/dev/null || echo 'NOT CONFIGURED')"
    done
    echo ""
    
    read -p "Are all DNS records configured and propagated? (y/N): " dns_ready
    
    if [[ "$dns_ready" =~ ^[Yy]$ ]]; then
        # Setup Let's Encrypt for all domains
        for domain in "${STAGING_DOMAINS[@]}"; do
            setup_letsencrypt "$domain" || generate_self_signed_cert "$domain" "nginx/ssl"
        done
        
        for domain in "${PILOT_CAFE_DOMAINS[@]}"; do
            setup_letsencrypt "$domain" || generate_self_signed_cert "$domain" "nginx/ssl/pilot-cafes"
        done
    else
        echo "❌ Please configure DNS records first, then re-run this script."
        exit 1
    fi
else
    echo "📝 Generating self-signed certificates..."
    
    # Generate self-signed certificates
    for domain in "${STAGING_DOMAINS[@]}"; do
        generate_self_signed_cert "$domain" "nginx/ssl"
    done
    
    for domain in "${PILOT_CAFE_DOMAINS[@]}"; do
        generate_self_signed_cert "$domain" "nginx/ssl/pilot-cafes"
    done
    
    echo ""
    echo "⚠️  Self-signed certificates created. Replace with real certificates before production!"
fi

# Create pilot-specific nginx configurations
echo ""
echo "🏪 Creating pilot café nginx configurations..."

for i in "${!PILOT_CAFE_DOMAINS[@]}"; do
    domain="${PILOT_CAFE_DOMAINS[$i]}"
    cafe_name=$(echo "$domain" | cut -d'.' -f1)
    
    cat > "nginx/sites/${cafe_name}.conf" << EOF
# Pilot Café: $cafe_name
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $domain;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/pilot-cafes/${domain}.crt;
    ssl_certificate_key /etc/nginx/ssl/pilot-cafes/${domain}.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers on;

    # Pilot café specific headers
    add_header X-Pilot-Cafe "$cafe_name";
    add_header X-Pilot-Program "swedish-cafes-2024";

    # Redirect to main staging with café parameter
    location / {
        return 301 https://staging.${MAIN_DOMAIN}/?cafe=$cafe_name;
    }

    # Direct QR code access for this café
    location /qr {
        proxy_pass http://customer_pwa;
        proxy_set_header Host staging.${MAIN_DOMAIN};
        proxy_set_header X-Pilot-Cafe "$cafe_name";
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    
    echo "   ✅ Configuration created for $cafe_name ($domain)"
done

# Create domain verification script
cat > "scripts/verify-pilot-domains.sh" << 'EOF'
#!/bin/bash

# Verify all pilot domains are accessible

DOMAINS=(
    "staging.feedbackai.se"
    "business.staging.feedbackai.se" 
    "admin.staging.feedbackai.se"
    "aurora.feedbackai.se"
    "malmohuset.feedbackai.se"
    "goteborg.feedbackai.se"
)

echo "🔍 Verifying pilot domain accessibility..."

for domain in "${DOMAINS[@]}"; do
    echo -n "   Checking $domain... "
    
    if curl -f -s --max-time 10 "https://$domain" > /dev/null 2>&1; then
        echo "✅ OK"
    else
        echo "❌ FAILED"
    fi
done

echo ""
echo "📊 SSL Certificate Status:"
for domain in "${DOMAINS[@]}"; do
    echo "   $domain:"
    if openssl s_client -connect "$domain:443" -servername "$domain" < /dev/null 2>/dev/null | openssl x509 -noout -dates 2>/dev/null; then
        echo "     ✅ SSL Certificate valid"
    else
        echo "     ❌ SSL Certificate invalid or not found"
    fi
done
EOF

chmod +x scripts/verify-pilot-domains.sh

# Create DNS record template for user
cat > "pilot-dns-records.txt" << EOF
# DNS Records Required for Swedish Pilot Program
# Copy these records to your DNS provider

# Main staging environment
staging.feedbackai.se.           IN  A     YOUR_SERVER_IP
business.staging.feedbackai.se.  IN  A     YOUR_SERVER_IP
admin.staging.feedbackai.se.     IN  A     YOUR_SERVER_IP

# Pilot café domains
aurora.feedbackai.se.            IN  A     YOUR_SERVER_IP
malmohuset.feedbackai.se.        IN  A     YOUR_SERVER_IP
goteborg.feedbackai.se.          IN  A     YOUR_SERVER_IP

# Optional: wildcard for future expansion
*.feedbackai.se.                 IN  A     YOUR_SERVER_IP

# CNAME records (alternative to A records)
# staging.feedbackai.se.           IN  CNAME your-server.example.com.
# business.staging.feedbackai.se.  IN  CNAME your-server.example.com.
# admin.staging.feedbackai.se.     IN  CNAME your-server.example.com.
EOF

# Create SSL renewal script for Let's Encrypt
if [[ "$use_letsencrypt" =~ ^[Yy]$ ]]; then
    cat > "scripts/renew-pilot-ssl.sh" << 'EOF'
#!/bin/bash

# Renew Let's Encrypt certificates for pilot domains

echo "🔄 Renewing SSL certificates..."

# Renew all certificates
sudo certbot renew --quiet

# Copy renewed certificates to nginx directory
for domain in staging.feedbackai.se business.staging.feedbackai.se admin.staging.feedbackai.se aurora.feedbackai.se malmohuset.feedbackai.se goteborg.feedbackai.se; do
    if [[ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]]; then
        sudo cp "/etc/letsencrypt/live/$domain/fullchain.pem" "nginx/ssl/${domain}.crt" 2>/dev/null || \
        sudo cp "/etc/letsencrypt/live/$domain/fullchain.pem" "nginx/ssl/pilot-cafes/${domain}.crt" 2>/dev/null
        
        sudo cp "/etc/letsencrypt/live/$domain/privkey.pem" "nginx/ssl/${domain}.key" 2>/dev/null || \
        sudo cp "/etc/letsencrypt/live/$domain/privkey.pem" "nginx/ssl/pilot-cafes/${domain}.key" 2>/dev/null
        
        sudo chown $USER:$USER "nginx/ssl/${domain}.crt" "nginx/ssl/${domain}.key" 2>/dev/null || \
        sudo chown $USER:$USER "nginx/ssl/pilot-cafes/${domain}.crt" "nginx/ssl/pilot-cafes/${domain}.key" 2>/dev/null
    fi
done

# Reload nginx
docker-compose -f docker-compose.staging.yml restart nginx

echo "✅ SSL certificates renewed"
EOF
    
    chmod +x scripts/renew-pilot-ssl.sh
    
    # Add to crontab suggestion
    echo ""
    echo "📅 SSL Renewal Automation"
    echo "Add this to crontab for automatic renewal:"
    echo "0 2 * * * /path/to/ai-feedback-platform/scripts/renew-pilot-ssl.sh"
fi

echo ""
echo "🎉 Pilot Domain Setup Complete!"
echo "=============================="
echo ""
echo "📁 Files created:"
echo "   - nginx/ssl/*.crt, *.key (SSL certificates)"
echo "   - nginx/sites/*.conf (Pilot café configurations)"
echo "   - scripts/verify-pilot-domains.sh (Domain verification)"
echo "   - pilot-dns-records.txt (DNS configuration template)"
if [[ "$use_letsencrypt" =~ ^[Yy]$ ]]; then
    echo "   - scripts/renew-pilot-ssl.sh (SSL renewal automation)"
fi
echo ""
echo "📋 Next Steps:"
echo "1. Configure DNS records using pilot-dns-records.txt"
echo "2. Wait for DNS propagation (up to 24 hours)"
echo "3. Run: ./scripts/verify-pilot-domains.sh"
echo "4. Start staging environment: docker-compose -f docker-compose.staging.yml up -d"
echo ""
echo "🏪 Pilot Café Access URLs:"
for domain in "${PILOT_CAFE_DOMAINS[@]}"; do
    cafe_name=$(echo "$domain" | cut -d'.' -f1)
    echo "   $cafe_name: https://$domain"
done
echo ""
echo "🔧 Management URLs:"
echo "   Staging App: https://staging.feedbackai.se"
echo "   Business Portal: https://business.staging.feedbackai.se"
echo "   Admin Panel: https://admin.staging.feedbackai.se"