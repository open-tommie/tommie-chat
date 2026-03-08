docker compose logs -f nakama 2>&1 | sed 's/^[^{]*//' | jq '.'
