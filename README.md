# Sun* NestJS Training - Project Core Setup

Dự án khởi tạo cho chương trình đào tạo NestJS tại Sun*, bao gồm tích hợp Swagger OpenAPI, quản trị biến môi trường qua `@nestjs/config`, đa ngôn ngữ (i18n) với `nestjs-i18n`, và bộ công cụ kiểm thử tự động với Vitest.

---

## 1. Yêu cầu hệ thống

- **Node.js**: >= 20.x LTS (khuyến nghị Node 22+ hoặc 24 LTS)
- **Package Manager**: `npm`

---

## 2. Cài đặt & Cấu hình môi trường

### Bước 1: Cài đặt dependencies
```bash
npm install
```

### Bước 2: Thiết lập biến môi trường
Sao chép file cấu hình mẫu từ `.env.example`:
```bash
cp .env.example .env
```

Các biến môi trường cơ bản:
| Biến | Ý nghĩa | Giá trị mặc định |
| :--- | :--- | :--- |
| `PORT` | Cổng HTTP server lắng nghe | `3000` |
| `NODE_ENV` | Môi trường runtime (`development` / `production`) | `development` |

---

## 3. Khởi chạy ứng dụng

```bash
# Chế độ phát triển (Watch mode)
npm run start:dev

# Chế độ debug
npm run start:debug

# Build mã nguồn
npm run build

# Chạy bản production đã build
npm run start:prod
```

Server sẽ khởi động tại: `http://localhost:3000`

---

## 4. Tài liệu API (Swagger OpenAPI)

Swagger UI được tích hợp sẵn để phục vụ việc xem schema và test API trực quan:
- **Đường dẫn Swagger UI**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 5. Cơ chế Đa ngôn ngữ (i18n)

Hệ thống hỗ trợ 2 ngôn ngữ:
- `en`: Tiếng Anh (Mặc định / Fallback)
- `vi`: Tiếng Việt

### Thứ tự ưu tiên giải quyết ngôn ngữ (Resolvers):
1. **Query Parameter (`lang` hoặc `l`)**:
   ```bash
   curl "http://localhost:3000/?lang=vi"
   # Output: Xin chào thế giới!
   ```
2. **Custom Header (`x-lang` hoặc `x-custom-lang`)**:
   ```bash
   curl -H "x-lang: vi" http://localhost:3000/
   # Output: Xin chào thế giới!
   ```
3. **Standard Header (`Accept-Language`)**:
   ```bash
   curl -H "Accept-Language: vi" http://localhost:3000/
   # Output: Xin chào thế giới!
   ```
4. **Fallback mặc định**: Khi không truyền hoặc ngôn ngữ không được hỗ trợ (ví dụ `?lang=fr`), server tự động trả về tiếng Anh (`Hello World!`).

---

## 6. Kiểm thử & Định dạng mã nguồn

```bash
# Kiểm tra lỗi tĩnh với Oxlint
npm run lint

# Định dạng code với Prettier
npm run format

# Chạy Unit Tests
npm run test

# Chạy Integration & E2E Tests
npm run test:e2e

# Đo độ bao phủ mã nguồn (Coverage)
npm run test:cov
```

