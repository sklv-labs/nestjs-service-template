# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# Workspace manifests only, so a dependency change is what invalidates the install layer — not a
# source edit. Every package's manifest has to be present or pnpm cannot resolve the workspace.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/nestjs-core/package.json ./packages/nestjs-core/
# --ignore-scripts: the root `prepare` script installs git hooks, which has no meaning in an image
# and fails outright under --prod, where husky is not installed. No dependency here needs a build
# step either.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY tsconfig.json ./
COPY packages ./packages
COPY src ./src
# `tsc -b` walks the project references: the package is built first, then the service compiles
# against its declarations.
RUN pnpm build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/nestjs-core/package.json ./packages/nestjs-core/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --ignore-scripts

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
# `node_modules/@sklv-labs/nestjs-core` is a symlink into `packages/`, so the target has to exist
# here too — its manifest for the exports map, and its build output.
COPY --from=prod-deps /app/packages/nestjs-core/package.json ./packages/nestjs-core/
COPY --from=build /app/packages/nestjs-core/dist ./packages/nestjs-core/dist
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000
# Runs node directly rather than a package script, so npm_package_* are absent — service identity
# comes from package.json instead.
CMD ["node", "dist/src/main.js"]
