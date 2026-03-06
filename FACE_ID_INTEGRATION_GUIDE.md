# Hướng dẫn Tích hợp Face ID vào Hệ thống Quản lý Dụng cụ

## 📋 Tổng quan

Tài liệu này mô tả các bước tích hợp công nghệ nhận diện khuôn mặt (Face ID) vào hệ thống quản lý dụng cụ hiện tại.

## 🎯 Mục tiêu

- Cho phép người dùng đăng ký khuôn mặt khi tạo tài khoản
- Đăng nhập bằng Face ID thay vì mật khẩu
- Hỗ trợ đăng nhập kết hợp (Face ID + Password) để tăng bảo mật

## 🏗️ Kiến trúc

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
│                 │
│  ┌───────────┐  │
│  │face-api.js│  │ ← Xử lý nhận diện trên browser
│  └─────┬─────┘  │
└────────┼────────┘
         │ HTTP/REST
┌────────▼──────────────────┐
│   Backend API              │
│   (Express/Node.js)        │
│                            │
│  ┌──────────────────────┐  │
│  │ Face ID Endpoints    │  │
│  │ - /api/auth/face/    │  │
│  │   register          │  │
│  │ - /api/auth/face/    │  │
│  │   login             │  │
│  └──────────────────────┘  │
│                            │
│  ┌──────────────────────┐  │
│  │   MongoDB            │  │
│  │   - faceDescriptors  │  │ ← Lưu face data
│  └──────────────────────┘  │
└────────────────────────────┘
```

## 📦 Công nghệ sử dụng

### Frontend

- **face-api.js**: Thư viện JavaScript nhận diện khuôn mặt chạy trên browser
- **TensorFlow.js**: Backend cho face-api.js (tự động được tải)

### Backend

- **MongoDB**: Lưu trữ face descriptors (mảng số thực)
- **Express**: API endpoints xử lý Face ID

## 🔄 Quy trình hoạt động

### 1. Đăng ký Face ID

```
User → Chụp ảnh → face-api.js trích xuất descriptor →
Gửi descriptor lên server → Lưu vào MongoDB
```

### 2. Đăng nhập bằng Face ID

```
User → Chụp ảnh → face-api.js trích xuất descriptor →
Gửi descriptor lên server → So sánh với descriptors trong DB →
Tìm match → Trả về JWT token
```

## 📝 Các bước triển khai

### Bước 1: Cập nhật User Model

- Thêm field `faceDescriptors` để lưu mảng descriptors
- Thêm field `hasFaceId` để đánh dấu user đã đăng ký Face ID

### Bước 2: Cài đặt Dependencies

```bash
cd frontend
npm install face-api.js
```

### Bước 3: Tải Models cho face-api.js

- Tải các model files từ: https://github.com/justadudewhohacks/face-api.js-models
- Đặt vào `frontend/public/models/`

### Bước 4: Tạo Backend API

- `POST /api/auth/face/register` - Đăng ký Face ID
- `POST /api/auth/face/login` - Đăng nhập bằng Face ID
- `GET /api/auth/face/status` - Kiểm tra user đã đăng ký Face ID chưa

### Bước 5: Tạo Frontend Components

- `FaceCapture.jsx` - Component chụp và xử lý ảnh
- `FaceRecognitionService.js` - Service xử lý face-api.js
- Cập nhật `Login.jsx` và `Register.jsx`

### Bước 6: Tích hợp vào UI

- Thêm nút "Đăng nhập bằng Face ID" vào trang Login
- Thêm bước đăng ký Face ID vào trang Register

## 🔒 Bảo mật

1. **Face Descriptors**: Lưu dưới dạng mảng số, không thể reverse về ảnh gốc
2. **Threshold**: Sử dụng threshold 0.6 để cân bằng độ chính xác và bảo mật
3. **Fallback**: Luôn có phương án đăng nhập bằng password
4. **Liveness Detection**: Có thể thêm kiểm tra người thật (yêu cầu chuyển động)

## 📊 Độ chính xác

- **True Positive Rate**: ~95-98% (tùy điều kiện ánh sáng)
- **False Positive Rate**: < 0.1%
- **Threshold**: 0.6 (có thể điều chỉnh)

## 🚀 Triển khai Production

1. **Tối ưu Models**: Sử dụng models nhẹ hơn cho production
2. **CDN**: Host models trên CDN để tải nhanh hơn
3. **Caching**: Cache models trong browser
4. **Error Handling**: Xử lý lỗi khi không có camera hoặc không nhận diện được

## 📚 Tài liệu tham khảo

- face-api.js: https://github.com/justadudewhohacks/face-api.js
- Models: https://github.com/justadudewhohacks/face-api.js-models
- TensorFlow.js: https://www.tensorflow.org/js
