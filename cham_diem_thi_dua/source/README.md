# Hệ thống thi đua CBVC

Thư mục này lưu mã nguồn để phát triển và kiểm thử. Trang đang phục vụ tại /cham_diem_thi_dua/ dùng index.html và assets/ ở thư mục cha. Cập nhật mã nguồn tại đây không thay thế các tệp đã biên dịch và không triển khai lên Firebase.

## Chuẩn bị môi trường thử nghiệm

1. Tạo dự án Firebase thử nghiệm riêng. Bật đăng nhập email và mật khẩu, tạo tài khoản thử trong Firebase Authentication và chuẩn bị các hồ sơ thử trong `users`. Mỗi tài khoản cần một email riêng và một hồ sơ đúng vai trò. Tạo tổ chuyên môn trong `departments`.
2. Sao chép `.env.example` thành `.env.local` và điền cấu hình Web App của dự án thử nghiệm. Firebase Hosting và các quy tắc hiện dùng cơ sở dữ liệu `(default)`.
3. Cấp quyền bằng Firebase Admin SDK. Sau khi thiết lập Application Default Credentials cho đúng môi trường, kiểm tra trước bằng `npm run sync:claims -- <project-id>`. Lệnh chỉ in số lượng, gồm số hồ sơ cần đối chiếu và số hồ sơ còn trường mật khẩu cũ. Sau khi duyệt kết quả, dùng `npm run sync:claims -- <project-id> --apply` để cập nhật quyền Firebase Auth. Yêu cầu đăng nhập lại sau khi cấp quyền hoặc đổi tổ trưởng.
4. Chạy kiểm thử và dựng bản phát hành.

```sh
npm ci
npm test
npm run test:rules
npm run check:release -- <project-id>
npm run build
```

Kiểm thử quy tắc dùng Firestore Emulator và dự án giả `demo-cva`. Khi thử trên dự án thử nghiệm, dùng các vai trò BGH, tổ trưởng hai tổ, CBGV và Ban Thi đua. Kiểm tra hồ sơ khóa, nộp và duyệt điểm, phân quyền xuất báo cáo, Word A4 và bản in phiếu cá nhân.

## Điều kiện trước khi phát hành

- Tạo ít nhất một tài khoản BGH có hồ sơ và quyền khớp trước khi áp dụng quy tắc mới. Kiểm tra các tài khoản còn thiếu quyền hoặc có email trùng. Trình duyệt chỉ đăng nhập tài khoản đã được tạo trong Firebase Authentication.
- Với dữ liệu phiên bản cũ, sau khi có bản sao lưu và được quản trị viên duyệt, xử lý riêng các trường `customPassword`, `passwordUpdatedAt` và bộ sưu tập `user_passwords` nếu có. Đặt lại mọi mật khẩu cũ dùng chung hoặc từng lưu dưới dạng rõ. Công cụ cấp quyền không đọc lại giá trị mật khẩu ra màn hình, không đổi mật khẩu và không sửa hồ sơ Firestore.
- Kiểm tra hồ sơ điểm cũ có dữ liệu bất thường trước khi duyệt. Hồ sơ tháng được sửa hoặc nộp theo quy tắc mới có tối đa 8 mục cộng và trừ. Trần theo học kỳ được tính ở giao diện. Firestore kiểm tra tổng tháng khớp các mục và giới hạn ghi theo vai trò. Với bảng xếp hạng đã công bố từ bản cũ, đối chiếu lại hồ sơ từng tháng trước khi mở cho người dùng.
- Bản chụp JSON chỉ chứa điểm và ghi chú. BGH có thể tải bản chụp trong phiên làm việc để đối chiếu. Khôi phục chính thức thực hiện theo [hướng dẫn xuất và nhập của Firestore](https://firebase.google.com/docs/firestore/manage-data/export-import). Diễn tập nhập bản sao lưu vào dự án thử nghiệm và đối chiếu số hồ sơ, điểm, quyền và bảng xếp hạng. Danh mục tài khoản Firebase Authentication, quyền và cấu hình là phần riêng của kế hoạch khôi phục.
- Trên máy dùng chung đã chạy bản cũ, quản trị viên cần kiểm kê bản chụp cũ trong bộ nhớ trình duyệt và các tệp JSON đã tải xuống. Giao diện mới không đọc các bản chụp cũ.

Sau khi môi trường thử nghiệm đạt các điều kiện trên, dùng đúng cấu hình của dự án cần phát hành và kiểm tra lại đích trước khi thực hiện lệnh triển khai.

```sh
npm run check:release -- <project-id>
npm run build
npx firebase-tools deploy --project <project-id> --only hosting,firestore:rules
```
