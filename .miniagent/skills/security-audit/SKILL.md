---
name: security-audit
description: Use when the user wants to audit code for security vulnerabilities, check for exposed secrets, review authentication/authorization logic, or ensure OWASP Top 10 compliance. Provides read-only security review covering injection, XSS, CSRF, secrets management, and dependency vulnerabilities. Triggers on security review, vulnerability scan, or security compliance requests.
allowed-tools: file_read, glob, grep, bash
disallowedTools:
  - file_write
  - web_search
triggers:
  - 安全审计
  - security audit
  - 安全审查
  - vulnerability scan
  - 检查安全问题
  - security check
  - OWASP
  - 查找密钥
  - exposed secrets
  - 安全漏洞
---

# Security Audit Skill

Read-only security review following OWASP Top 10 guidelines.

## OWASP Top 10 Checklist

### 1. Broken Access Control
- [ ] No IDOR (Insecure Direct Object References)
- [ ] Authorization checks on every endpoint
- [ ] Principle of least privilege enforced
- [ ] No admin functions exposed without auth

### 2. Cryptographic Failures
- [ ] No hardcoded passwords, API keys, or tokens
- [ ] Secrets in environment variables or vault
- [ ] TLS used for all external communication
- [ ] Passwords hashed with bcrypt/argon2

### 3. Injection
- [ ] Parameterized queries (no string concatenation)
- [ ] Input validation and sanitization
- [ ] No eval() or exec() with user input
- [ ] Command injection prevention

### 4. Insecure Design
- [ ] Threat modeling for critical features
- [ ] Rate limiting on sensitive endpoints
- [ ] Idempotency for financial operations
- [ ] Defense in depth strategy

### 5. Security Misconfiguration
- [ ] No debug mode in production
- [ ] Default credentials changed
- [ ] Security headers set (CSP, X-Frame-Options)
- [ ] CORS properly configured

### 6. Vulnerable Components
- [ ] Dependencies up to date
- [ ] No known CVEs in dependencies
- [ ] Lock files committed
- [ ] Automated dependency scanning

### 7. Authentication Failures
- [ ] MFA for sensitive operations
- [ ] Session timeout configured
- [ ] Password policy enforced
- [ ] Brute force protection

### 8. Data Integrity Violations
- [ ] Input validation on all data
- [ ] Output encoding to prevent XSS
- [ ] CSRF tokens on state-changing requests
- [ ] Integrity checks on critical data

### 9. Logging and Monitoring
- [ ] Sensitive data not logged
- [ ] Audit trail for critical operations
- [ ] Alerts for suspicious activity
- [ ] Log integrity protected

### 10. Server-Side Request Forgery
- [ ] URL validation for user-supplied URLs
- [ ] Internal network not accessible
- [ ] Whitelist for allowed domains
- [ ] Response body not returned to user

## Secret Detection Patterns

```regex
# API Keys
(?:api[_-]?key|apikey)["\s:=]+["'][A-Za-z0-9]{20,}["']

# AWS Keys
AKIA[0-9A-Z]{16}

# Private Keys
-----BEGIN (?:RSA |EC )?PRIVATE KEY-----

# Passwords in code
(?:password|passwd|pwd)\s*=\s*["'][^"']+["']

# JWT Tokens
eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+
```

## Audit Process

1. Scan for secrets using patterns above
2. Review authentication and authorization logic
3. Check for injection vulnerabilities
4. Review dependency versions
5. Check configuration files for sensitive data
6. Output structured security report

## Report Format

```
## Security Audit Report

### Critical (Must Fix)
1. [file:line] Issue - Impact

### High (Should Fix)
1. [file:line] Issue - Impact

### Medium (Consider Fixing)
1. [file:line] Issue - Impact

### Informational
1. [file:line] Observation
```
