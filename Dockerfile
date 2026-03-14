# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

# Non-sensitive build args (visible in image metadata — intentionally non-secret)
ARG SCHOOL_SLUG
ARG COLEGIO_HUB_API_URL
ENV SCHOOL_SLUG=$SCHOOL_SLUG
ENV COLEGIO_HUB_API_URL=$COLEGIO_HUB_API_URL

# COLEGIO_SERVICE_TOKEN is injected via a BuildKit secret mount so it is NEVER
# stored in any image layer or visible in `docker history`.
# CI passes it with: --secret id=colegio_service_token,env=COLEGIO_SERVICE_TOKEN
RUN --mount=type=secret,id=colegio_service_token \
    COLEGIO_SERVICE_TOKEN=$(cat /run/secrets/colegio_service_token 2>/dev/null || true) \
    npm run build

EXPOSE 3000

CMD ["npm", "start"]
