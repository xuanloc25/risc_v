# Trình Biên Dịch Hợp Ngữ RISC-V (Web-Based)

## Giới thiệu

Dự án này là một trình biên dịch hợp ngữ RISC-V đơn giản, được xây dựng bằng JavaScript và chạy trực tiếp trên trình duyệt web.
## Chức năng

Trang web cho phép người dùng nhập code hợp ngữ RISC-V vào một ô nhập liệu và sau đó chuyển đổi nó thành mã nhị phân. Kết quả được hiển thị trực tiếp trên trang web.

**Trang web:** [https://xuanloc25.github.io/risc_v/](https://xuanloc25.github.io/risc_v/)

## Công nghệ sử dụng

*   **HTML:** Cấu trúc và nội dung của trang web.
*   **JavaScript:** Logic biên dịch hợp ngữ RISC-V sang mã nhị phân.
## Cấu trúc code

Code JavaScript được chia thành các hàm chính sau:

*   **`registerMapping`:** Một đối tượng (object) được sử dụng để ánh xạ các tên thanh ghi theo chuẩn MIPS và các tên thanh ghi thông thường sang tên thanh ghi RISC-V tương ứng.
*   **`normalizeRegisterNames(instruction)`:** Hàm chuẩn hóa tên các thanh ghi trong một lệnh hợp ngữ.
*   **`convertToBinary()`:** Hàm lấy code hợp ngữ RISC-V từ ô nhập liệu, chuyển đổi nó thành mã nhị phân và hiển thị kết quả.
*   **`riscvToBinary(instruction)`:** Hàm chính để chuyển đổi một lệnh hợp ngữ RISC-V thành mã nhị phân.

## Các định dạng lệnh được hỗ trợ

Hiện tại, trình biên dịch chỉ hỗ trợ một số định dạng lệnh RISC-V cơ bản. Việc mở rộng hỗ trợ cho nhiều định dạng lệnh hơn là một trong những mục tiêu phát triển trong tương lai.

## Hướng dẫn sử dụng

1.  Truy cập trang web: [https://xuanloc25.github.io/risc_v/](https://xuanloc25.github.io/risc_v/)
2.  Nhập code hợp ngữ RISC-V vào ô nhập liệu.
3.  Nhấp vào nút "Compile".
4.  Mã nhị phân tương ứng sẽ được hiển thị bên dưới.
