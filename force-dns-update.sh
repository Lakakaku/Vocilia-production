#!/bin/bash

# Force DNS Cache Clear on macOS
echo "🔧 Forcing DNS Cache Clear on macOS"
echo "===================================="
echo ""
echo "This script will attempt multiple methods to clear your DNS cache."
echo "You may be prompted for your password."
echo ""

# Method 1: Standard DNS cache flush
echo "Method 1: Flushing DNS cache..."
sudo dscacheutil -flushcache 2>/dev/null && echo "✅ DNS cache flushed" || echo "⚠️  Needs sudo permission"

# Method 2: Restart mDNSResponder
echo ""
echo "Method 2: Restarting mDNSResponder..."
sudo killall -HUP mDNSResponder 2>/dev/null && echo "✅ mDNSResponder restarted" || echo "⚠️  Needs sudo permission"

# Method 3: Clear DNS via network service
echo ""
echo "Method 3: Clearing network DNS..."
sudo killall -INFO mDNSResponder 2>/dev/null && echo "✅ DNS info refreshed" || echo "⚠️  Needs sudo permission"

# Method 4: Add temporary hosts entry (commented out by default)
echo ""
echo "Method 4: Temporary hosts file override..."
echo "To immediately access the site, you can add this to /etc/hosts:"
echo "66.33.22.229 api.vocilia.com"
echo ""
echo "Run: echo '66.33.22.229 api.vocilia.com' | sudo tee -a /etc/hosts"
echo "(Remove it later with: sudo sed -i '' '/api.vocilia.com/d' /etc/hosts)"

# Test current DNS
echo ""
echo "Current DNS Resolution:"
echo "----------------------"
echo -n "Local DNS: "
dig api.vocilia.com +short | tail -1
echo -n "Google DNS: "
dig @8.8.8.8 api.vocilia.com +short | tail -1
echo -n "Expected: "
echo "66.33.22.229"

echo ""
echo "✅ DNS flush attempted. Results may take 1-2 minutes to apply."
echo "Run ./dns-tracker.sh to monitor the update progress."