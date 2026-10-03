# ==============================================================================
# Dockerfile for Driver Drowsiness Detection Frontend (React Vite + Nginx)
# Multi-stage Build: Stage 1 Build -> Stage 2 Lightweight Nginx Server
# ==============================================================================

# --- Stage 1: Build Frontend Artifacts ---
FROM node:22-alpine AS build

WORKDIR /app

# Copy package descriptors trước để cache layer npm install
COPY package.json package-lock.json ./

RUN npm ci

# Copy toàn bộ mã nguồn frontend
COPY . .

# Build ứng dụng sang thư mục dist/
RUN npm run build

# --- Stage 2: Serve with Nginx Alpine ---
FROM nginx:alpine

# Copy file cấu hình Nginx tối ưu cho SPA và Reverse Proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy bản build tĩnh từ Stage 1 vào thư mục public của Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Mở cổng HTTP tiêu chuẩn
EXPOSE 80

# Chạy Nginx ở foreground mode
CMD ["nginx", "-g", "daemon off;"]
