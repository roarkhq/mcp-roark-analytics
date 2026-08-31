# Dockerfile for Roark MCP Server
#
# This Dockerfile builds a Docker image for the MCP Server.
#
# To build the image locally:
#   docker build -t @roarkanalytics/sdk-mcp:local .
#
# To run the image:
#   docker run -i @roarkanalytics/sdk-mcp:local [OPTIONS]
#
# Common options:
#   --tool=<name>              Include specific tools
#   --resource=<name>          Include tools for specific resources
#   --operation=read|write     Filter by operation type
#   --client=<type>            Set client compatibility (e.g., claude, cursor)
#   --transport=<type>         Set transport type (stdio or http)
#
# For a full list of options:
#   docker run -i @roarkanalytics/sdk-mcp:local --help
#
# Note: The MCP server uses stdio transport by default. Docker's -i flag
# enables interactive mode, allowing the container to communicate over stdin/stdout.

# Build stage
FROM node:24-alpine AS builder

# Enable corepack to use pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install bash for build script
RUN apk add --no-cache bash openssl

# Set working directory
WORKDIR /build

# Copy entire repository
COPY . .

# Set CI environment variable so pnpm install runs without prompts
ENV CI=true

# Install all dependencies and build everything
RUN pnpm install --frozen-lockfile && \
    pnpm build

FROM denoland/deno:alpine-2.7.1

# Install node and npm
RUN apk add --no-cache nodejs npm

ENV LD_LIBRARY_PATH=/usr/lib:/usr/local/lib

# Add non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy the build results, preserving directory structure
#
# The line that used to follow this one copied `/build/dist` over
# `node_modules/@roarkanalytics/sdk`: the SDK was built from the same workspace
# and `workspace:*` left nothing installable behind. This package depends on a
# published SDK now, so `pnpm install` above has already put the real one in
# node_modules, and copying this package's own `dist` over it would replace the
# SDK with the MCP server.
COPY --from=builder /build .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app
RUN chown -R nodejs:nodejs /deno-dir

# Switch to non-root user
USER nodejs

# The MCP server uses stdio transport by default
# No exposed ports needed for stdio communication

# Set the entrypoint to the MCP server
ENTRYPOINT ["node", "dist/index.js"]

# Allow passing arguments to the MCP server
CMD []
