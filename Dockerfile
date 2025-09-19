FROM node:18-alpine

WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para desarrollo)
RUN npm ci

# Copiar todo el código fuente
COPY . .

# Verificar que el archivo existe (debug)
RUN ls -la src/

EXPOSE 3001

# Por defecto usar development
CMD ["npm", "run", "dev"]