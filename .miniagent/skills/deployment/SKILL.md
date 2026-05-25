---
name: deployment
description: Use when the user wants to deploy an application, set up CI/CD pipelines, create Docker configurations, or automate deployment workflows. Provides deployment patterns for Docker, GitHub Actions, Vercel, AWS, and other platforms. Triggers on deployment, CI/CD setup, Docker configuration, or production release requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 部署
  - deploy
  - 发布
  - release
  - CI/CD
  - Docker
  - docker-compose
  - github actions
  - 部署到生产环境
  - 部署流程
---

# Deployment Skill

Application deployment following modern DevOps practices.

## Deployment Patterns

### Docker

```dockerfile
# Multi-stage build for production
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    depends_on:
      - db
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD}
volumes:
  pgdata:
```

### GitHub Actions (CI/CD)

```yaml
name: CI/CD Pipeline
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # Deploy command here
          echo "Deploying..."
```

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Secrets stored securely (not in code)
- [ ] Health check endpoint working
- [ ] Logging and monitoring configured
- [ ] Database migrations applied
- [ ] Rollback plan documented
- [ ] Load testing completed
- [ ] Security scan passed
- [ ] SSL/TLS configured
- [ ] CDN configured (if applicable)
