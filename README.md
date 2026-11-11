# Sun* NestJS Training - Project Core Setup

Dự án chuẩn hóa cho chương trình đào tạo NestJS tại Sun*, bao gồm tích hợp Swagger OpenAPI, quản trị biến môi trường qua `@nestjs/config`, đa ngôn ngữ (i18n) với `nestjs-i18n`, kiểm thử tự động với Vitest, quản lý cơ sở dữ liệu PostgreSQL qua TypeORM migration thủ công, và hệ thống Authentication (JWT + Redis Blacklist).

---

## 1. Yêu cầu hệ thống

- **Node.js**: >= 20.x LTS (khuyến nghị Node 22+ hoặc 24 LTS)
- **Package Manager**: `npm`
- **Docker & Docker Compose**: Dùng để chạy PostgreSQL và Redis

---

## 2. Cài đặt & Khởi động hạ tầng

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
| `DB_HOST` | Địa chỉ host PostgreSQL | `localhost` |
| `DB_PORT` | Cổng kết nối PostgreSQL | `5432` |
| `DB_USERNAME` | Tên đăng nhập cơ sở dữ liệu | `postgres` |
| `DB_PASSWORD` | Mật khẩu cơ sở dữ liệu | `password123` |
| `DB_NAME` | Tên database | `sun_nestjs_db` |
| `REDIS_HOST` | Địa chỉ host Redis | `localhost` |
| `REDIS_PORT` | Cổng Redis | `6379` |
| `JWT_SECRET` | Khóa bí mật ký mã token | `super_secret_jwt_key_...` |
| `JWT_EXPIRES_IN` | Thời gian sống access token (giây) | `3600` |

### Bước 3: Khởi chạy PostgreSQL và Redis (Docker)
```bash
docker compose up -d
```

### Bước 4: Chạy Migration cơ sở dữ liệu (Manual Migration)
```bash
# Thực thi các migration đang chờ xử lý
npm run migration:run

# Rollback / Hoàn tác migration gần nhất nếu cần
npm run migration:revert
```

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

Swagger UI được tích hợp sẵn để xem schema và test API trực quan kèm tính năng Bearer Token:
- **Đường dẫn Swagger UI**: [http://localhost:3000/api](http://localhost:3000/api)

---

## 5. Danh sách API Authentication

| Method | Endpoint | Bảo vệ (Guard) | Mô tả |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/auth/register` | Public | Đăng ký tài khoản người dùng mới |
| `POST` | `/api/auth/login` | Public | Xác thực đăng nhập và nhận JWT access token |
| `POST` | `/api/auth/logout` | `Bearer JWT` | Đăng xuất và lưu token vào Redis blacklist |
| `GET` | `/api/auth/me` | `Bearer JWT` | Lấy thông tin tài khoản đang đăng nhập |

### Cơ chế Redis Token Blacklist:
- Khi người dùng gọi `POST /api/auth/logout`, token payload chứa định danh duy nhất `jti` (UUID).
- Server tính toán thời gian sống còn lại (`remainingTtl = exp - now`) và lưu key `auth:blacklist:{jti}` vào Redis với TTL tương ứng.
- Khi gửi request có kèm token đến các route được bảo vệ bởi `JwtAuthGuard`, guard kiểm tra `jti` trong Redis: nếu đã có trong blacklist thì từ chối ngay với mã lỗi `401 Unauthorized`.

---

## 6. Cơ chế Đa ngôn ngữ (i18n)

Hệ thống hỗ trợ 2 ngôn ngữ:
- `en`: Tiếng Anh (Mặc định / Fallback)
- `vi`: Tiếng Việt

### Thứ tự ưu tiên giải quyết ngôn ngữ (Resolvers):
1. **Query Parameter (`lang` hoặc `l`)**:
   ```bash
   curl "http://localhost:3000/?lang=vi"
   ```
2. **Custom Header (`x-lang` hoặc `x-custom-lang`)**:
   ```bash
   curl -H "x-lang: vi" http://localhost:3000/
   ```
3. **Standard Header (`Accept-Language`)**:
   ```bash
   curl -H "Accept-Language: vi" http://localhost:3000/
   ```
4. **Fallback mặc định**: Khi không truyền hoặc ngôn ngữ không được hỗ trợ (ví dụ `?lang=fr`), server tự động trả về tiếng Anh (`Hello World!`).

---

## 7. Kiểm thử & Định dạng mã nguồn

```bash
# Kiểm tra lỗi tĩnh với Oxlint
npm run lint

# Định dạng code với Prettier
npm run format

# Chạy Unit Tests với Vitest
npm run test

# Chạy Integration & E2E Tests
npm run test:e2e

# Đo độ bao phủ mã nguồn (Coverage)
npm run test:cov
```
