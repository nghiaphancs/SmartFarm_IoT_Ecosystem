# ĐẶC TẢ CHI TIẾT CƠ SỞ DỮ LIỆU SMARTFARM IOT

---

## 1. TỔNG QUAN HỆ THỐNG
Cơ sở dữ liệu được thiết kế theo hướng **Modular Architecture**, tách biệt rõ ràng giữa:
*   Quản lý thiết bị IoT & Vận hành thực tế.
*   Giám sát dữ liệu cảm biến & Cảnh báo.
*   Phân tích dữ liệu bằng Trí tuệ nhân tạo (AI Services).
*   Quản trị người dùng & Phân quyền.

---

## 2. SƠ ĐỒ THỰC THỂ MỐI QUAN HỆ (ERD)

```mermaid
erDiagram
    users ||--o{ action_logs : "thực hiện"
    users ||--o{ user_devices : "quyền truy cập"
    users ||--o{ configurations : "cập nhật"
    
    devices ||--o{ user_devices : "được gán cho"
    devices ||--o{ sensor_data : "ghi nhận"
    devices ||--o{ configurations : "áp dụng"
    devices ||--o{ action_logs : "lưu nhật ký"
    devices ||--o{ alerts : "kích hoạt"
    devices ||--o{ ai_services : "được phục vụ bởi"

    ai_services ||--o{ ai_ml_history : "lưu kết quả"
    sensor_types ||--o{ sensor_data : "định nghĩa loại"

    users {
        int id PK
        string username UK
        string password_hash
        string role
        boolean is_active
        datetime created_at
    }

    devices {
        int id PK
        string name
        string device_type
        string aio_feed_key UK
        string location
        float battery_level
        boolean status
        datetime last_seen
    }

    ai_services {
        int id PK
        string name
        string service_type "WATERING | DISEASE_DETECT"
        int device_id FK
    }

    ai_ml_history {
        int id PK
        int service_id FK
        json input_data
        json result_data
        float confidence_score
        string recommendation
        datetime created_at
    }

    action_logs {
        int id PK
        int device_id FK
        int user_id FK
        string action
        string status
        string trigger_source "MANUAL | AUTO"
        datetime created_at
    }

    sensor_types {
        int id PK
        string name UK
        string unit
    }

    sensor_data {
        int id PK
        int device_id FK
        int sensor_type_id FK
        float value
        datetime created_at
    }

    user_devices {
        int user_id FK
        int device_id FK
        string permission_level
    }

    configurations {
        int id PK
        string config_key
        float config_value
        int device_id FK
        int updated_by FK
    }

    alerts {
        int id PK
        int device_id FK
        string message
        string severity "INFO | WARNING | CRITICAL"
        datetime acknowledged_at
        datetime created_at
    }
```

---

## 3. TỪ ĐIỂN DỮ LIỆU (DATA DICTIONARY)

### 3.1 Nhóm Quản trị (Admin & Auth)
| Bảng | Cột | Kiểu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **users** | `id` | Integer | PK | Khóa chính. |
| | `username` | String | UK, Not Null | Tên đăng nhập. |
| | `role` | String | Default: 'FARMER'| Vai trò: ADMIN hoặc FARMER. |
| **user_devices**| `user_id` | Integer | FK | Liên kết tới users. |
| | `device_id` | Integer | FK | Liên kết tới devices. |
| | `permission_level`| String | | Cấp độ: VIEW, OPERATOR, ADMIN. |
| **configurations**| `config_key` | String | Not Null | Tên cấu hình (VD: `TEMP_MAX`). |
| | `config_value`| Float | Not Null | Giá trị cài đặt. |

### 3.2 Nhóm Vận hành IoT (IoT Operation)
| Bảng | Cột | Kiểu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **devices** | `id` | Integer | PK | Khóa chính. |
| | `aio_feed_key`| String | UK, Not Null | Khóa Adafruit IO tương ứng. |
| | `battery_level`| Float | | % Pin của thiết bị. |
| | `last_seen` | DateTime | | Lần cuối thiết bị trực tuyến. |
| **action_logs** | `id` | Integer | PK | Khóa chính. |
| | `action` | String | | Hành động (ON/OFF). |
| | `trigger_source`| String | | Nguồn: MANUAL hoặc AUTO. |
| | `status` | String | | SUCCESS hoặc FAILED. |

### 3.3 Nhóm Giám sát (Monitoring)
| Bảng | Cột | Kiểu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **sensor_types** | `id` | Integer | PK | Khóa chính. |
| | `name` | String | UK | Tên loại cảm biến. |
| | `unit` | String | | Đơn vị tính (°C, %, lux). |
| **sensor_data** | `id` | Integer | PK | Khóa chính. |
| | `value` | Float | Not Null | Giá trị đo được thực tế. |
| **alerts** | `id` | Integer | PK | Khóa chính. |
| | `severity` | String | | Mức độ: INFO, WARNING, CRITICAL. |

### 3.4 Nhóm Trí tuệ nhân tạo (AI Services)
| Bảng | Cột | Kiểu | Ràng buộc | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| **ai_services** | `id` | Integer | PK | Khóa chính. |
| | `service_type`| String | | WATERING hoặc DISEASE_DETECT. |
| **ai_ml_history**| `id` | Integer | PK | Khóa chính. |
| | `input_data` | JSON | | Dữ liệu thô đưa vào AI. |
| | `result_data` | JSON | | Kết quả phân tích từ AI. |
| | `recommendation`| String | | Lời khuyên cho người dùng. |

---

## 4. CHI TIẾT MỐI QUAN HỆ (RELATIONSHIPS)
1.  **Một-Nhiều (1:N):**
    *   Một thiết bị (`devices`) có thể có nhiều dịch vụ AI (`ai_services`).
    *   Một dịch vụ AI (`ai_services`) ghi nhận nhiều lượt dự đoán (`ai_ml_history`).
    *   Một thiết bị (`devices`) sinh ra nhiều lượt dữ liệu (`sensor_data`) và hành động (`action_logs`).
2.  **Nhiều-Nhiều (N:N):**
    *   Người dùng (`users`) quản lý nhiều thiết bị (`devices`) thông qua bảng trung gian `user_devices`.
3.  **Tách biệt logic:** Bảng `action_logs` và `ai_ml_history` **không tham chiếu trực tiếp**, đảm bảo module vận hành và module phân tích hoạt động độc lập, giảm thiểu lỗi dây chuyền.

---

## 5. TÍNH NĂNG KỸ THUẬT NỔI BẬT
*   **Modularization:** Dễ dàng thêm các loại AI mới bằng cách định nghĩa trong `ai_services`.
*   **Integrity:** Các ràng buộc khóa ngoại (Foreign Key) đảm bảo dữ liệu không bị mồ côi.
*   **Audit Trail:** Mọi hành động của hệ thống đều được lưu vết trong `action_logs` và `alerts`.
*   **JSON Support:** Linh hoạt trong việc lưu trữ kết quả AI không cấu trúc.
