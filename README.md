# humateck-scouter

Content Scouter daily YouTube trending collector → Supabase.

## GitHub Actions secrets (exact names)

| Name | Value |
|------|--------|
| `YOUTUBE_API_KEY` | YouTube Data API key |
| `SUPABASE_URL` | `https://ajvtyotblrtexcxuazqm.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase **Secret** / service_role key |

Delete any old names (`SUPABASE_SERVICE_KEY`, etc.) before re-adding.

## Workflows

- `Global Daily Scout Collect` — schedule + manual (`fetch-global.mjs`)
- `Japan Daily Scout Collect (personal)` — manual only (`fetch.mjs`)
