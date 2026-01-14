# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| v1.0    | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

Please report any security vulnerabilities to the security team at `security@example.com`.
We pledge to acknowledge reports within 48 hours and provide a timeline for remediation.

## Vulnerability Management Process

1.  **Detection**: Automated Trivy scans run on every build.
2.  **Triage**: High and Critical vulnerabilities block deployment.
3.  **Remediation**:
    *   **OS Level**: `apk update && apk upgrade` in Dockerfiles.
    *   **Dependency Level**: `npm update` or `npm audit fix`.
    *   **Base Image**: Upgrade to newer maintained tags (e.g., `1.26-alpine`).
4.  **Verification**: Re-scan to confirm 0 vulnerabilities.

## Known Exceptions

All exceptions must be documented in `.trivyignore` with a valid reason and review date.

```
# Example .trivyignore
# CVE-202X-XXXX: No fix available for this alpine package yet. Risk mitigated by network policy.
# Reviewed: 2026-01-11
```

## Security Controls

*   **Zero Trust Networking**: Default Deny-All NetworkPolicies.
*   **Least Privilege**: All containers run as non-root (UID > 1000).
*   **Immutable Infrastructure**: Read-only root filesystems enforced where possible.
*   **Secrets Management**: Secrets injected via Kubernetes Secret resources, never environment variables if possible.
