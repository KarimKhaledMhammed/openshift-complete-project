# MySQL Database Dockerfile
FROM mysql:8.0

# Metadata
LABEL maintainer="student@example.com" \
      version="1.0" \
      description="Bookstore Database (MySQL 8.0)"

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/

# Environment variables
ENV MYSQL_ROOT_PASSWORD=password \
      MYSQL_DATABASE=bookstore \
      MYSQL_USER=bookstore \
      MYSQL_PASSWORD=securepassword123

# Expose MySQL port
EXPOSE 3306

# MySQL will automatically run scripts in /docker-entrypoint-initdb.d/
# on first initialization, so no custom entrypoint needed

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
      CMD mysqladmin ping -h localhost -u root -p${MYSQL_ROOT_PASSWORD} || exit 1
