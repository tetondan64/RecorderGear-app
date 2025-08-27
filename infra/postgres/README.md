# RecorderGear PostgreSQL Setup

Local PostgreSQL database for RecorderGear API development and testing.

## Quick Start

```bash
# Start PostgreSQL only
docker compose up -d

# Start with pgAdmin web interface
docker compose --profile admin up -d

# Check status
docker compose ps

# View logs
docker compose logs postgres

# Stop services
docker compose down
```

## Database Connection

- **Host**: localhost
- **Port**: 5432
- **Database**: recordergear
- **Username**: recordergear
- **Password**: recordergear
- **Connection URL**: `postgres://recordergear:recordergear@localhost:5432/recordergear`

## pgAdmin (Optional)

When running with `--profile admin`:

- **URL**: http://localhost:8080
- **Email**: admin@recordergear.local
- **Password**: admin

### Adding Server in pgAdmin

1. Right-click "Servers" → "Register" → "Server"
2. General Tab:
   - Name: `RecorderGear Local`
3. Connection Tab:
   - Hostname: `postgres` (container name)
   - Port: `5432`
   - Database: `recordergear`
   - Username: `recordergear`
   - Password: `recordergear`

## Development Workflow

```bash
# 1. Start database
cd infra/postgres
docker compose up -d

# 2. Configure API
cd ../../apps/api
cp .env.example .env
# Edit .env to set DATABASE_URL

# 3. Run migrations
npm run db:migrate

# 4. Optional: Import existing JSON data
npm run db:import-json

# 5. Start API server
npm run dev
```

## Data Persistence

Data is persisted in Docker volumes:
- `postgres_data`: Database files
- `pgadmin_data`: pgAdmin configuration

To reset the database:
```bash
docker compose down -v  # Warning: deletes all data
docker compose up -d
```

## Connection Testing

```bash
# Test connection from host
psql postgres://recordergear:recordergear@localhost:5432/recordergear -c "SELECT version();"

# Connect interactively
psql postgres://recordergear:recordergear@localhost:5432/recordergear
```

## Troubleshooting

### Port 5432 already in use
```bash
# Check what's using the port
lsof -i :5432

# Stop other PostgreSQL instances or change port in docker-compose.yml
```

### Connection refused
```bash
# Check container status
docker compose ps

# View logs
docker compose logs postgres

# Restart if needed  
docker compose restart postgres
```

### Performance Tuning (Production)

For production deployment, consider these PostgreSQL settings:
- `shared_buffers`: 25% of RAM
- `effective_cache_size`: 75% of RAM  
- `work_mem`: 4MB per connection
- `maintenance_work_mem`: 256MB
- `checkpoint_completion_target`: 0.9
- `wal_buffers`: 16MB
- `default_statistics_target`: 100