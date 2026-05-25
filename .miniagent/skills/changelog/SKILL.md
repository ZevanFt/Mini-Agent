---
name: changelog
description: Use when the user wants to create, update, or maintain a CHANGELOG file following Keep a Changelog format. Provides conventional changelog categories (Added, Changed, Deprecated, Removed, Fixed, Security) with semantic versioning guidelines. Triggers on changelog creation, release notes, or version management requests.
allowed-tools: file_read, file_write, glob, grep, bash
disallowedTools:
  - web_search
triggers:
  - 更新日志
  - changelog
  - 版本日志
  - release notes
  - 更新 CHANGELOG
  - version notes
  - 写更新日志
  - 更新日志文件
---

# Changelog Skill

Maintain CHANGELOG following Keep a Changelog format with Semantic Versioning.

## Format

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- New feature descriptions

### Changed
- Changes in existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Now removed features

### Fixed
- Bug fixes

### Security
- Vulnerability fixes

## [1.2.0] - 2024-01-15

### Added
- User authentication with OAuth2
- Rate limiting on API endpoints

### Fixed
- Memory leak in WebSocket handler

## [1.1.0] - 2024-01-01
...
```

## Semantic Versioning

| Version | When to Use | Example |
|---------|-------------|---------|
| MAJOR (x.0.0) | Breaking changes | 1.0.0 → 2.0.0 |
| MINOR (0.x.0) | New features (backward compatible) | 1.0.0 → 1.1.0 |
| PATCH (0.0.x) | Bug fixes | 1.0.0 → 1.0.1 |

## Writing Guidelines

- Use past tense: "Added support for..."
- Be specific: mention affected modules
- Include PR/issue numbers: "(#123)"
- Group by category, not by commit
- Order entries chronologically (newest first)

## Changelog Generation from Git

```bash
# Get commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline

# Filter by conventional commit types
git log --oneline | grep -E "^(feat|fix|BREAKING)"
```
