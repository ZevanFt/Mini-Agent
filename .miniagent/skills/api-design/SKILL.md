---
name: api-design
description: Use when the user wants to design, review, or refactor REST APIs, GraphQL schemas, or API endpoints. Provides REST API design principles including resource naming, HTTP methods, status codes, pagination, error handling, and OpenAPI specification. Triggers on API design, endpoint creation, API review requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - API 设计
  - REST API
  - 接口设计
  - endpoint
  - 设计接口
  - API review
  - API design
  - GraphQL schema
---

# API Design Skill

REST API design following industry best practices.

## RESTful Resource Naming

### DO
- Use nouns for resources: `/users`, `/orders`, `/products`
- Use plural nouns for collections: `/users` (not `/user`)
- Use nested paths for relationships: `/users/{id}/orders`
- Use kebab-case: `/api/v1/user-preferences`

### DON'T
- Don't use verbs: `/getUsers` → `/users`
- Don't mix resource types: `/usersAndOrders` → `/users`, `/orders`
- Don't expose internal structure: `/database/users` → `/users`

## HTTP Methods

| Method | Purpose | Idempotent | Safe |
|--------|---------|------------|------|
| GET | Retrieve resource | ✅ | ✅ |
| POST | Create new resource | ❌ | ❌ |
| PUT | Replace entire resource | ✅ | ❌ |
| PATCH | Partial update | ✅ | ❌ |
| DELETE | Remove resource | ✅ | ❌ |

## Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| 200 | OK | Successful GET, PUT, PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource |
| 422 | Unprocessable | Validation failed |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Unexpected error |

## Standard Response Format

### Success

```json
{
  "data": {
    "id": "123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

### Error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      {
        "field": "email",
        "message": "must be a valid email address"
      }
    ]
  }
}
```

## Pagination

```
GET /api/v1/users?page=2&limit=20
```

Response:
```json
{
  "data": [...],
  "meta": {
    "currentPage": 2,
    "totalPages": 10,
    "totalItems": 200,
    "itemsPerPage": 20
  },
  "links": {
    "self": "/api/v1/users?page=2&limit=20",
    "first": "/api/v1/users?page=1&limit=20",
    "prev": "/api/v1/users?page=1&limit=20",
    "next": "/api/v1/users?page=3&limit=20",
    "last": "/api/v1/users?page=10&limit=20"
  }
}
```

## Filtering, Sorting, Searching

```
GET /api/v1/users?status=active&role=admin
GET /api/v1/users?sort=-createdAt,name
GET /api/v1/users?q=john&fields=id,name,email
```

## API Design Checklist

- [ ] Resource names are nouns, plural, kebab-case
- [ ] HTTP methods are used correctly
- [ ] Status codes are appropriate
- [ ] Error responses are consistent
- [ ] Pagination is implemented for collections
- [ ] Filtering/sorting/searching are supported
- [ ] Authentication and authorization are enforced
- [ ] Rate limiting is configured
- [ ] API versioning strategy is defined
- [ ] OpenAPI/Swagger spec is maintained
