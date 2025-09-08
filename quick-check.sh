#!/bin/bash
while true; do
  clear
  echo '🔍 Quick DNS Check - '23:06:13
  echo '========================'
  result=$(dig api.vocilia.com +short | tail -1)
  if [[ "$result" == "66.33.22.229" ]]; then
    echo '✅ DNS UPDATED! api.vocilia.com → 66.33.22.229'
    echo 'You can now access https://business.vocilia.com'
    break
  else
    echo '❌ Still cached: api.vocilia.com → '$result
    echo 'Checking again in 5 seconds...'
  fi
  sleep 5
done
