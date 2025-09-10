#!/bin/bash

echo "🔍 Checking DNS Configuration for vocilia.com"
echo "============================================"
echo ""

echo "📡 Current Nameservers:"
dig +short NS vocilia.com
echo ""

echo "✅ Expected Nameservers:"
echo "ns1.vercel-dns.com"
echo "ns2.vercel-dns.com"
echo ""

echo "🌐 Checking domain resolution:"
echo -n "vocilia.com: "
dig +short vocilia.com
echo -n "www.vocilia.com: "
dig +short www.vocilia.com
echo -n "business.vocilia.com: "
dig +short business.vocilia.com
echo -n "api.vocilia.com: "
dig +short api.vocilia.com
echo ""

echo "📝 Note: DNS propagation can take 5 minutes to 48 hours"
echo "If nameservers still show GoDaddy's, wait and check again later"