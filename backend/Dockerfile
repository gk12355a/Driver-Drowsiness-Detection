# ==============================================================================
# Dockerfile for Driver Drowsiness Detection Backend (Python + FastAPI)
# ==============================================================================
FROM python:3.11-slim

# Thiết lập biến môi trường
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

# Cài đặt các thư viện hệ thống cần thiết cho OpenCV, MediaPipe và X11/GL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy file requirements trước để tối ưu Docker Layer Caching
COPY requirements.txt .

# Nâng cấp pip và cài đặt dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy toàn bộ mã nguồn backend vào container
COPY . .

# Tạo thư mục chứa snapshots và data
RUN mkdir -p snapshots data

# Mở cổng 8000 cho FastAPI & WebSocket
EXPOSE 8000

# Healthcheck kiểm tra trạng thái hoạt động của backend
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Khởi chạy ứng dụng với Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
