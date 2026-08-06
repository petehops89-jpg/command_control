# Docker Environment Setup for Vistamations Music

This docker environment sets up the containerized stack for **Vistamations Music**, part of the VISTAMATIONS real-time runtime simulator architecture.

## Architecture & Services

- **App Service (`app`)**: Node.js app container mounted to local workspace.
- **Redis (`redis`)**: Cache/state backend for real-time runtime coordination.
- **Prometheus (`prometheus`)**: Runtime metrics collection and observability.

## Getting Started

1. Ensure Docker Desktop / Docker Engine is running on your system.
2. Build and start the environment:
   ```bash
   docker compose up -d --build
   ```
3. View running containers:
   ```bash
   docker compose ps
   ```
4. Check logs:
   ```bash
   docker compose logs -f
   ```
5. Stop environment:
   ```bash
   docker compose down
   ```
