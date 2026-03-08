docker compose logs -f --tail 0 nakama 2>&1 | sed 's/^[^{]*//' | jq 'select(.msg )'
