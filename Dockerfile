# Use an official Node.js runtime as the base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy project files
COPY . .

# Expose the port (Make sure your app runs on this port)
EXPOSE 3000

# Command to start the app
CMD ["node", "server.js"]
