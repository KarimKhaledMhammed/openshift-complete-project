# Frontend Dockerfile - Multi-stage build for Nginx
# Stage 1: Runtime
FROM nginxinc/nginx-unprivileged:1.26-alpine

# Metadata
LABEL maintainer="student@example.com" \
    version="1.0" \
    description="Bookstore Frontend"

# Copy custom configuration
COPY nginx.conf /etc/nginx/nginx.conf

USER root
RUN apk update && apk upgrade
USER nginx

# Copy static assets
COPY ./html /usr/share/nginx/html

# Switch to non-root user (already default in unprivileged image, but explicit is good)
USER 101

# Expose port (must match nginx.conf)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:8080/nginx-health || exit 1
