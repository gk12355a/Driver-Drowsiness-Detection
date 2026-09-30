# 🚗 Driver Drowsiness Detection System

Hệ thống nhận diện tài xế ngủ gật theo thời gian thực (**Real-time Driver Drowsiness Detection System**) dựa trên Computer Vision, Biometrics và Temporal Guardrails. Dự án được xây dựng toàn diện với **Backend FastAPI (Python)** và **Frontend React Vite + TailwindCSS**.

---

## 📑 Mục lục
1. [Giới thiệu & Tính năng chính](#-giới-thiệu--tính-năng-chính)
2. [Kiến trúc công nghệ](#-kiến-trúc-công-nghệ)
3. [Cấu trúc thư mục dự án](#-cấu-trúc-thư-mục-dự-án)
4. [Cơ chế lưu trữ & Cơ sở dữ liệu](#-cơ-chế-lưu-trữ--cơ-sở-dữ-liệu-database)
5. [Yêu cầu môi trường](#-yêu-cầu-môi-trường)
6. [Hướng dẫn cài đặt & Khởi chạy chi tiết](#-hướng-dẫn-cài-đặt--khởi-chạy-chi-tiết)
   - [Khởi chạy Backend (Python FastAPI)](#bước-1-khởi-chạy-backend)
   - [Khởi chạy Frontend (React Vite)](#bước-2-khởi-chạy-frontend)
7. [Hướng dẫn sử dụng hệ thống](#-hướng-dẫn-sử-dụng-hệ-thống)
8. [Tài liệu API Endpoints](#-tài-liệu-api-endpoints)

---

## 🌟 Giới thiệu & Tính năng chính

Hệ thống giải quyết triệt để bài toán an toàn giao thông qua việc giám sát liên tục trạng thái sinh trắc học của người lái xe:

- **Nhận diện mốc khuôn mặt tốc độ cao**: Sử dụng MediaPipe Face Mesh bắt 468 mốc tọa độ với tần số lấy mẫu 25–30 FPS.
- **Trích xuất chỉ số sinh trắc học (Biometrics)**:
  - **EAR (Eye Aspect Ratio)**: Theo công thức chuẩn *Soukupova & Cech (2016)* để phát hiện chớp mắt và nhắm mắt.
  - **MAR (Mouth Aspect Ratio)**: Nhận diện cử chỉ ngáp kéo dài, phân biệt rõ với nói chuyện bình thường.
  - **Head Pose Estimation (PnP)**: Tính toán góc Euler 3D (Pitch, Yaw, Roll) để phát hiện gục đầu ngủ gật hoặc quay đầu nhìn lệch hướng lái xe.
- **Temporal Guardrails Engine**:
  - **PERCLOS 30s**: Giám sát % thời gian mắt nhắm trong cửa sổ trượt 30 giây (kích hoạt cảnh báo khi $\ge 40\%$).
  - **Micro-sleep Guardrail**: Báo động khẩn cấp tức thì khi phát hiện mắt nhắm liên tục $\ge 1.5$ giây.
  - **Bộ lọc EWMA & Trend Gain**: Làm mịn tín hiệu và dự báo xu hướng buồn ngủ sớm trước 1–2 giây.
- **Hiệu chuẩn cá nhân (75 Frames Calibration)**: Tự động học chỉ số mắt/mặt ban đầu của tài xế để tối ưu ngưỡng phát hiện, hạn chế cảnh báo sai với người mắt híp hoặc đeo kính.
- **Phân cấp cảnh báo 4 cấp độ trực quan**:
  - 🟢 **Level 1 (NORMAL, Điểm 1-3)**: Tỉnh táo, an toàn.
  - 🟡 **Level 2 (WARNING, Điểm 4-5)**: Bắt đầu mệt mỏi, phát âm thanh chuông nhắc nhở nhẹ.
  - 🟠 **Level 3 (DANGER, Điểm 6-7)**: Buồn ngủ nặng, phát còi báo động kép và trợ lý giọng nói hỏi thăm.
  - 🔴 **Level 4 (CRITICAL SOS, Điểm 8-10 hoặc Micro-sleep $\ge 1.5$s)**: Báo động nguy cấp, kích hoạt còi khẩn cấp, tự động chụp ảnh cabin và ghi nhận sự kiện SOS.
- **Cơ chế Cooldown (20s)**: Ngăn chặn việc phát chuông liên tục gây ức chế tài xế (ngoại trừ mức CRITICAL).
- **Trợ lý giọng nói tiếng Việt (AI Voice Assistant)**: Phát câu hỏi thăm *"Tài xế chú ý, bạn đang có dấu hiệu mệt mỏi"* và cho phép tài xế bấm xác nhận *"Tôi vẫn tỉnh táo"* rảnh tay.
- **Tối ưu Mobile Responsive**: Giao diện co giãn tự động trên mọi thiết bị (máy tính để bàn, tablet, điện thoại thông minh).

---

## 🛠️ Kiến trúc công nghệ

| Thành phần | Công nghệ sử dụng | Mục đích / Vai trò |
| :--- | :--- | :--- |
| **Backend Framework** | `Python 3.11`, `FastAPI`, `Uvicorn` | API REST & WebSocket streaming tốc độ cao |
| **Computer Vision** | `MediaPipe 0.10.14`, `OpenCV` | Trích xuất khuôn mặt, Head Pose, EAR, MAR |
| **Khoa học dữ liệu** | `NumPy`, `SciPy` | Bộ lọc tín hiệu, tính toán hình học 3D |
| **Cơ sở dữ liệu** | `SQLite 3` | Lưu trữ dữ liệu sự kiện SOS bền vững |
| **Frontend Framework** | `React 19`, `Vite` | Giao diện điều khiển SPA mượt mà, tải nhanh |
| **CSS Styling** | `TailwindCSS v4` | Thiết kế giao diện hiện đại, full responsive |
| **Biểu đồ & Âm thanh** | `HTML5 Canvas`, `Web Audio API`, `SpeechSynthesis` | Vẽ sóng tín hiệu thời gian thực & âm thanh còi báo |
| **Bộ Icon** | `Lucide React` | Icon giao diện sắc nét |

---

## 📂 Cấu trúc thư mục dự án

```plaintext
Driver Drowsiness Detection/
│
├── .gitignore                      # Cấu hình bỏ qua file rác, virtualenv, node_modules, DB
├── README.md                       # Tài liệu hướng dẫn chi tiết dự án
│
├── backend/                        # Nguồn mã Python Backend
│   ├── venv/                       # Virtual Environment Python
│   ├── snapshots/                  # Thư mục lưu trữ ảnh bằng chứng chụp khi xảy ra SOS
│   │   └── .gitkeep
│   ├── drowsiness.db               # Cơ sở dữ liệu SQLite lưu trữ sự kiện SOS (tự sinh)
│   ├── requirements.txt            # Danh sách thư viện Python cần cài đặt
│   ├── database.py                 # Module kết nối và thao tác với SQLite
│   ├── biometrics.py               # Thuật toán tính toán EAR, MAR và chỉ số 3D Model
│   ├── detector.py                 # MediaPipe Face Mesh & solvePnP Head Pose
│   ├── guardrails.py               # PERCLOS, Micro-sleep, EWMA Trend, Phân cấp cảnh báo
│   └── main.py                     # Entry point FastAPI, WebSocket stream, REST API
│
└── frontend/                       # Nguồn mã Frontend React Vite
    ├── node_modules/               # Thư viện npm
    ├── public/                     # Static assets
    ├── src/
    │   ├── components/
    │   │   ├── RiskGauge.jsx       # Đồng hồ đo điểm rủi ro bán nguyệt (0-10)
    │   │   └── BiometricChart.jsx  # Biểu đồ vẽ sóng EAR, MAR trực tiếp bằng Canvas
    │   ├── utils/
    │   │   └── sound.js            # Module âm thanh Synthesizer & Giọng nói tiếng Việt
    │   ├── App.jsx                 # Màn hình chính giám sát & quản trị SOS
    │   ├── index.css               # Cấu hình TailwindCSS
    │   └── main.jsx                # Entry point React
    ├── package.json                # Danh sách gói phụ thuộc npm
    └── vite.config.js              # Cấu hình Vite & plugin TailwindCSS
```

---

## 🗄️ Cơ chế lưu trữ & Cơ sở dữ liệu (Database)

Hệ thống tích hợp sẵn **SQLite 3** (`backend/drowsiness.db`):
- **Bảng `incidents`**: Lưu trữ toàn bộ các vi phạm buồn ngủ cấp độ cao (`CRITICAL` hoặc điểm $\ge 8.0$):
  - `id`: Mã định danh sự kiện (ví dụ: `SOS-1790783900`)
  - `timestamp`: Thời điểm vi phạm (định dạng `YYYY-MM-DD HH:MM:SS`)
  - `level`: Cấp độ nguy hiểm (`CRITICAL`)
  - `score`: Điểm rủi ro buồn ngủ (0.0 – 10.0)
  - `perclos`: Tỷ lệ mắt nhắm trong 30 giây gần nhất (%)
  - `ear`: Chỉ số mở mắt tại thời điểm vi phạm
  - `mar`: Chỉ số mở miệng (ngáp)
  - `closed_duration`: Số giây nhắm mắt liên tục
  - `reason`: Lý do cảnh báo (Micro-sleep $\ge 1.5$s, v.v.)
  - `snapshot_path`: Đường dẫn file ảnh chụp lưu trên đĩa máy tính (`backend/snapshots/`)
  - `snapshot_base64`: Chuỗi ảnh Base64 phục vụ hiển thị tức thì trên Web
  - `lat`, `lng`: Tọa độ GPS của phương tiện
  - `speed_kmh`: Tốc độ xe di chuyển (km/h)

### 🧹 Cơ chế Tự động Dọn dẹp Snapshot (Tránh đầy ổ đĩa)
Module [`cleaner.py`](backend/cleaner.py) quản lý và tự động giải phóng bộ nhớ theo 3 lớp an toàn:
1. **Time-To-Live (TTL)**: Tự động xóa các file ảnh cũ hơn **7 ngày** (`MAX_SNAPSHOT_AGE_DAYS = 7`).
2. **Giới hạn số lượng (File Count Quota)**: Giữ lại tối đa **200 ảnh** mới nhất (`MAX_SNAPSHOT_FILES = 200`).
3. **Ngưỡng dung lượng tối đa (LRU Size Quota)**: Khi tổng dung lượng thư mục `snapshots/` vượt ngưỡng **100 MB** (`MAX_SNAPSHOT_DIR_MB = 100`), hệ thống tự động tìm và xóa các ảnh cũ nhất (FIFO/LRU) cho đến khi dung lượng hạ xuống mức an toàn (dưới 80% quota).
4. **Chu kỳ dọn dẹp**: Tự động chạy ngầm mỗi **15 phút**, đồng thời cung cấp nút **"Dọn dẹp"** thủ công trực tiếp trên giao diện Web Dashboard và API `POST /api/snapshots/cleanup`.

---

## 💻 Yêu cầu môi trường

- **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux.
- **Python**: Phiên bản **3.10** hoặc **3.11** (khuyến nghị Python 3.11).
- **Node.js**: Phiên bản **18.x** trở lên (khuyến nghị Node 20+ hoặc 22+).
- **Camera/Webcam**: Hoạt động bình thường và trình duyệt cho phép quyền truy cập camera.

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy chi tiết

### Bước 1: Khởi chạy Backend

1. Mở cửa sổ **Terminal / PowerShell**, điều hướng vào thư mục backend:
   ```powershell
   cd "d:\Projects\TranBaoTram\Driver Drowsiness Detection\backend"
   ```

2. Kích hoạt môi trường ảo Python (virtual environment):
   - **Trên Windows (PowerShell)**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
     *(Nếu gặp lỗi Execution Policy trên PowerShell, chạy lệnh: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` rồi chạy lại).*
   - **Trên macOS / Linux**:
     ```bash
     source venv/bin/activate
     ```

3. *(Tùy chọn - nếu cài máy mới)* Cài đặt các thư viện cần thiết:
   ```bash
   pip install -r requirements.txt
   ```

4. Khởi chạy máy chủ FastAPI:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```
   Khi màn hình hiển thị:
   ```
   INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
   ```
   $\rightarrow$ Backend đã sẵn sàng! Bạn có thể kiểm tra Swagger API tại: `http://localhost:8000/docs`.

---

### Bước 2: Khởi chạy Frontend

1. Mở một cửa sổ **Terminal / PowerShell thứ hai**, điều hướng vào thư mục frontend:
   ```powershell
   cd "d:\Projects\TranBaoTram\Driver Drowsiness Detection\frontend"
   ```

2. *(Tùy chọn - nếu cài máy mới)* Cài đặt thư viện Node:
   ```bash
   npm install
   ```

3. Khởi chạy server phát triển Vite:
   ```bash
   npm run dev
   ```
   Khi màn hình hiển thị:
   ```
     VITE v8.3.1  ready in ... ms

     ➜  Local:   http://localhost:5173/
     ➜  Network: use --host to expose
   ```

4. Mở trình duyệt Web (Chrome, Edge, Firefox) và truy cập:
   👉 **`http://localhost:5173`**

---

## 🎯 Hướng dẫn sử dụng hệ thống

1. **Bật Camera Cabin**:
   - Nhấn nút màu xanh lá **"Bật Camera Cabin"** ở góc trên bên phải.
   - Khi trình duyệt hỏi xin quyền truy cập Camera, chọn **"Allow" (Cho phép)**.
2. **Hiệu chuẩn cá nhân (Khuyên dùng)**:
   - Nhấn nút **"Hiệu chuẩn 75F"**.
   - Ngồi ngay ngắn, nhìn thẳng vào camera trong vòng 3 giây để hệ thống tự động ghi nhận đường cơ sở (baseline) của mắt và khuôn mặt bạn.
3. **Thử nghiệm các tình huống**:
   - **Nhắm mắt bình thường / chớp mắt**: Điểm nguy cơ vẫn ở mức thấp (Xanh lá).
   - **Ngáp to (MAR $\ge 0.55$)**: Điểm tăng lên mức Vàng/Cam (Mệt mỏi).
   - **Gục đầu hoặc quay mặt đi**: Góc Pitch/Yaw tăng, hệ thống báo lệch hướng.
   - **Nhắm mắt liên tục $> 1.5$ giây (Giả lập ngủ gật Micro-sleep)**: 
     - Hệ thống lập tức nhảy sang mức **CRITICAL (Đỏ)**.
     - Còi báo động khẩn cấp kêu liên tục.
     - Trợ lý AI phát giọng nói cảnh báo.
     - Tự động chụp ảnh bằng chứng lưu vào database và cập nhật ngay vào bảng **Nhật ký sự kiện SOS**.
4. **Xác nhận tỉnh táo**:
   - Khi có cảnh báo, bạn có thể nhấn nút **"Tôi Vẫn Tỉnh Táo!"** trên camera hoặc nút **"Xác Nhận Tỉnh Táo"** tại hộp Trợ lý AI để hủy cảnh báo rảnh tay.

---

## 📡 Tài liệu API Endpoints

| Giao thức | Endpoint | Phương thức | Mô tả |
| :--- | :--- | :--- | :--- |
| **HTTP** | `/` | `GET` | Kiểm tra trạng thái hoạt động của server |
| **HTTP** | `/api/status` | `GET` | Lấy các chỉ số cấu hình, baseline hiệu chuẩn hiện tại |
| **HTTP** | `/api/calibration` | `POST` | Bắt đầu hoặc reset tiến trình hiệu chuẩn (`{"action": "start"}`) |
| **HTTP** | `/api/incidents` | `GET` | Lấy danh sách 50 sự kiện SOS mới nhất từ SQLite database |
| **HTTP** | `/api/incidents` | `POST` | Ghi nhận sự kiện buồn ngủ mới vào database |
| **WebSocket** | `/ws/detect` | `WS` | Luồng gửi ảnh frame base64 từ camera và nhận kết quả sinh trắc học thời gian thực |
