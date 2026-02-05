# Use Node 20 as the base image
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the port (matches process.env.PORT)
EXPOSE 3001

# Start the application
CMD ["node", "index.js"]
