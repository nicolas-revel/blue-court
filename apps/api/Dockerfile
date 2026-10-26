# Built from the repository root: docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@blue-court/api
# The Prisma client is generated into src/, which `deploy` leaves out; dist/ has it compiled.
RUN pnpm --filter=@blue-court/api deploy --prod --legacy /app

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app .
USER node
EXPOSE 4000
# Applies pending migrations, then starts the API.
CMD ["npm", "start"]
