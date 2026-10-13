# Database Layer

This folder contains the PostgreSQL setup.

## Files
- docker-compose.yml: Starts PostgreSQL locally
- schema.sql: Creates initial tables

## Run
1. Install Docker Desktop
2. Open terminal in project root
3. Run: docker compose -f database/docker-compose.yml up -d
4. PostgreSQL will be available at localhost:5432
