# Zero-cost-capable deployment

## Local preview

```bash
npm run serve
```

Then open `http://localhost:4173`. Health check: `http://localhost:4173/api/health`.

The browser preview has no external runtime dependency and uses synthetic data.

## Static hosting

`index.html` and `web/` can be served from any static host. GitHub Pages or similar free tiers can host the P0 demo. Do not place live Maximo credentials or RTA operational data in a public static deployment.

## Local open-source brain

Run an OpenAI-compatible local inference endpoint using an open-source runtime such as llama.cpp or vLLM. Set `LLM_BASE_URL` and `LLM_MODEL`. The RailMind domain layer does not import a proprietary model SDK.

## Database

For a local governed memory store, `infra/docker-compose.yml` starts PostgreSQL with pgvector. This is optional for the static P0 demo.
