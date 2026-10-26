# Đưa API lên Netlify

Netlify Drop chỉ đăng các tệp tĩnh; nó không chạy `server.ps1`. Cấu hình này giữ trang web trên Netlify, chạy API bằng Netlify Functions và lưu dữ liệu trong Supabase. Mật khẩu quản trị và khóa Supabase chỉ được đặt trong Environment variables của Netlify, không đưa vào HTML, JavaScript phía trình duyệt hoặc Git.

## 1. Tạo cơ sở dữ liệu Supabase

1. Tạo project tại [supabase.com](https://supabase.com).
2. Mở **SQL Editor**, tạo query mới, dán toàn bộ nội dung `supabase/schema.sql` rồi bấm **Run**. Nếu project đã có schema từ trước hoặc schema.sql được cập nhật, chạy lại toàn bộ script: các thay đổi dùng `IF NOT EXISTS` và `CREATE OR REPLACE FUNCTION` để bổ sung/cập nhật mà không xóa dữ liệu hiện tại.
3. Trong **Project Settings → API**, ghi lại **Project URL** và **service_role key**. Chỉ dùng key này làm biến môi trường bí mật trên Netlify; không gửi key qua chat và không đặt key vào file trong project.

## 2. Cấu hình biến môi trường trên Netlify

Trong site settings, mở **Environment variables** và thêm:

| Tên | Giá trị |
| --- | --- |
| `SUPABASE_URL` | Project URL ở bước 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | `service_role` key ở bước 1 |
| `THEOCEAN_ADMIN_EMAIL` | Email dùng để đăng nhập admin |
| `THEOCEAN_ADMIN_PASSWORD` | Mật khẩu riêng, tối thiểu 12 ký tự |
| `THEOCEAN_SESSION_SECRET` | Chuỗi ngẫu nhiên, tối thiểu 32 ký tự |
| `THEOCEAN_RATE_LIMIT_SECRET` | Một chuỗi ngẫu nhiên khác, tối thiểu 32 ký tự |

Có thể tạo hai chuỗi secret ngẫu nhiên trong PowerShell bằng lệnh sau; giữ chúng riêng tư:

```powershell
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
1..2 | ForEach-Object {
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    [Convert]::ToBase64String($bytes)
}
$rng.Dispose()
```

Không dùng lại mật khẩu tài khoản Netlify/Supabase. Không đặt các biến bí mật ở scope `Functions` bị giới hạn sai môi trường; để dùng cho Production và Deploy Previews nếu cần kiểm tra cả hai.

## 3. Deploy Functions

Các Netlify Functions không được đưa lên bằng cách chỉ kéo-thả thư mục như bản preview tĩnh trước đó. Cài Node.js LTS nếu máy chưa có Node.js, rồi mở PowerShell tại thư mục gốc `C:\TheOcean` và chạy:

```powershell
npm install --global netlify-cli
netlify login
netlify link
netlify deploy --build --prod --dir .
```

Ở `netlify link`, chọn site The Ocean Gym có domain `theoceangym.netlify.app`. Nếu CLI hỏi xác nhận deploy, chọn site đó. Mỗi lần sửa code, chạy lại lệnh deploy cuối. Nếu muốn dùng GitHub để tự deploy, kết nối repo trong Netlify; giữ `netlify.toml` ở thư mục gốc.

Sau khi thêm hoặc sửa Environment variables, deploy lại để Functions nhận cấu hình mới.

## 4. Chuyển tài khoản cũ sang dữ liệu dùng chung

Tài khoản được tạo trước khi bật cloud có thể còn trong `localStorage` của trình duyệt admin đã dùng để cấp tài khoản. Sau khi áp dụng schema và deploy:

1. Mở trang chính **trên đúng trình duyệt và thiết bị đang chứa danh sách tài khoản cũ**.
2. Chọn đăng nhập thông thường, nhập `THEOCEAN_ADMIN_EMAIL` và `THEOCEAN_ADMIN_PASSWORD`. Đăng nhập thành công sẽ chuyển thẳng vào dashboard admin.
3. Dashboard sẽ tự gửi tài khoản và hồ sơ ứng tuyển HLV cũ lên Supabase. Mật khẩu tài khoản được băm ở máy chủ, rồi bỏ mật khẩu rõ khỏi bản sao cục bộ. Dashboard báo số tài khoản và hồ sơ đã chuyển; kiểm tra các danh sách trước khi đóng trang.
4. Nếu dashboard báo trùng tên đăng nhập, tài khoản cũ vẫn được giữ trên thiết bị. Đổi tên đăng nhập bị trùng trong dữ liệu cũ rồi đăng nhập admin và thử lại.

Chỉ import một lần trên mỗi thiết bị admin. Các tài khoản tạo, khóa, mở khóa hoặc xóa sau đó sẽ thao tác trực tiếp trên Supabase và xuất hiện trên thiết bị khác. Không xóa dữ liệu trình duyệt cũ trước khi chuyển xong.

## 5. Kiểm tra

- Trang chính: `https://theoceangym.netlify.app/`
- Admin: `https://theoceangym.netlify.app/html/admin.html`
- Đăng nhập một tài khoản hội viên và một tài khoản HLV để thử chat với Admin; sau khi có lịch đặt, hội viên và HLV đó có thể nhắn tin riêng cho nhau. Tin nhắn mới cần được phản hồi qua lại từ hai tài khoản để xác nhận đồng bộ.
- Gửi thử hồ sơ ứng tuyển HLV, kiểm tra hồ sơ trong admin, duyệt và cấp mật khẩu. Mật khẩu chỉ hiển thị một lần; gửi trực tiếp cho HLV để họ đăng nhập và đổi mật khẩu.
- Sau khi cấp tài khoản hội viên từ yêu cầu tư vấn, yêu cầu đó được đánh dấu đã xử lý và không còn hiện ở danh sách mới; số liệu tổng số yêu cầu vẫn được giữ.
- Đăng nhập hội viên/HLV trên một thiết bị; đăng nhập admin trên thiết bị khác để kiểm tra khóa và mở lại tài khoản.
- Đăng nhập trên trang chính bằng `THEOCEAN_ADMIN_EMAIL` và `THEOCEAN_ADMIN_PASSWORD`; xác nhận website chuyển thẳng vào dashboard admin.

Nếu có lỗi, xem **Netlify → Functions → api → Logs**. Không gửi `service_role` key, session secret hay mật khẩu trong ảnh/log công khai.

## Lưu ý

- Chỉ người biết email và mật khẩu admin mới vào được dashboard; không chia sẻ thông tin đăng nhập.
- Netlify Functions dùng cookie `HttpOnly`, `Secure`, `SameSite=Strict`, hết hạn sau 8 giờ. Đăng nhập admin và tài khoản bị giới hạn theo địa chỉ IP; gửi hồ sơ ứng tuyển HLV bị giới hạn 5 lần mỗi giờ.
- Chat cần đăng nhập bằng tài khoản hội viên hoặc HLV. Hội viên chỉ chat riêng với HLV có lịch đặt chưa bị hủy và với Ban quản trị; HLV chỉ xem các hội thoại đặt lịch của mình và chat với Ban quản trị. Hộp thư admin hiển thị tối đa 100 hội thoại gần nhất và tự làm mới khi đang mở tab chat. Chạy lại `supabase/schema.sql` trước khi deploy phiên bản có chat để tạo bảng hội thoại và liên kết tin nhắn.
- Phiên admin và phiên hội viên/HLV không dùng chung quyền: đăng nhập một loại tài khoản sẽ kết thúc phiên loại còn lại trên trình duyệt đó. Để vào trang admin, đăng xuất tài khoản hội viên/HLV trước rồi đăng nhập bằng thông tin admin trên trang chính; mở trực tiếp trang admin khi chưa có phiên admin sẽ quay về trang chính.
- Mật khẩu tài khoản được lưu dưới dạng hash scrypt, không trả về trong danh sách admin. Mật khẩu mới chỉ hiển thị một lần khi admin cấp tài khoản.
- Đăng ký và doanh thu được lưu trong Supabase, không còn lưu trong tệp JSON trên máy cá nhân. Sao lưu dữ liệu Supabase định kỳ.
- `server.ps1` vẫn dùng cho chạy local; nó không phải backend production trên Netlify.
