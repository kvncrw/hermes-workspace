FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
      bash python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --no-frozen-lockfile

COPY . .

ENV HERMES_API_URL=http://hermes-agent:8642

EXPOSE 3000

CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "3000"]
