# MinIO Local S3-Compatible Storage

This directory contains the Docker Compose configuration for running MinIO locally as an S3-compatible storage backend for RecorderGear development.

## Quick Start

```bash
# Start MinIO
cd infra/minio
docker compose up -d

# Check status
docker compose ps

# Stop MinIO
docker compose down
```

## Access

- **S3 API Endpoint**: http://localhost:9000
- **Web Console**: http://localhost:9001
- **Credentials**: 
  - Username: `MINIOadmin`
  - Password: `MINIOadmin`

## Configuration

### Default Setup
- **Bucket**: `recordergear-dev` (auto-created)
- **Access**: Private (no anonymous access)
- **Data Volume**: `minio_data` (persisted across restarts)

### Network Access
MinIO is configured to be accessible from your local network:
- API runs on all interfaces (0.0.0.0:9000)
- Use your laptop's LAN IP address for mobile device access
- Example: `http://192.168.1.100:9000`

## Usage with RecorderGear API

The API server expects these environment variables:
```bash
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=MINIOadmin
S3_SECRET_KEY=MINIOadmin
S3_BUCKET=recordergear-dev
S3_FORCE_PATH_STYLE=true
```

## Web Console

Visit http://localhost:9001 to access the MinIO web interface:

1. Login with `MINIOadmin` / `MINIOadmin`
2. Navigate to "Buckets" to see `recordergear-dev`
3. Upload/download files manually for testing
4. Monitor access logs and usage statistics

## Bucket Management

### Manual Bucket Creation (if needed)
```bash
# Install MinIO client
brew install minio/stable/mc

# Configure alias
mc alias set local http://localhost:9000 MINIOadmin MINIOadmin

# Create bucket
mc mb local/recordergear-dev

# Set private access
mc anonymous set none local/recordergear-dev
```

### List Objects
```bash
mc ls local/recordergear-dev/
mc ls local/recordergear-dev/recordings/
```

## Troubleshooting

### Connection Issues
1. **Docker not running**: Start Docker Desktop
2. **Port conflicts**: Check if ports 9000/9001 are available
3. **Firewall**: Allow Docker through firewall for LAN access

### Mobile Device Can't Connect
1. **Same Wi-Fi**: Ensure phone and laptop on same network
2. **LAN IP**: Use laptop's IP, not localhost/127.0.0.1
3. **Firewall**: Check laptop firewall settings
4. **Test**: Try accessing http://YOUR_IP:9001 from phone browser

### Permission Issues
```bash
# Fix volume permissions
sudo chown -R 1001:1001 ./data
```

### Reset Everything
```bash
# Stop and remove all data
docker compose down -v
docker volume rm minio_minio_data
docker compose up -d
```

## Production Notes

For production deployment:
1. **Change credentials**: Use secure, random access keys
2. **SSL/TLS**: Enable HTTPS with proper certificates
3. **Network**: Configure proper security groups/firewall rules
4. **Backup**: Set up bucket replication and backup policies
5. **Monitoring**: Enable CloudWatch/logging integration

## Switching to AWS S3

To use AWS S3 instead of MinIO, update the API environment variables:
```bash
S3_ENDPOINT=  # Leave empty for AWS S3
S3_REGION=us-west-2
S3_ACCESS_KEY=YOUR_AWS_ACCESS_KEY
S3_SECRET_KEY=YOUR_AWS_SECRET_KEY
S3_BUCKET=your-production-bucket
S3_FORCE_PATH_STYLE=false
```

No code changes required!