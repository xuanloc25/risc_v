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
Ví dụ: '$T0': ['X5', 'T0']
=> $T0, T0 sẽ được chuyển thành X5.
*   **`normalizeRegisterNames(instruction)`:**  thay thế tất cả các tên thanh ghi MIPS (ví dụ: $zero, $ra, $sp) và các tên thanh ghi thông thường (ví dụ: t0, t1, s0) bằng tên thanh ghi RISC-V tương ứng.
Ví dụ: ADD $T0, $T1, $T2  =>  ADD X5, X6, X7
*   **`convertToBinary()`:** Hàm này đọc đầu vào từ người dùng, chuẩn hóa nó và chuyển đổi từng dòng lệnh assembly thành mã nhị phân bằng cách gọi riscvToBinary(instruction). Nó cũng hiển thị kết quả trên giao diện.
*   **`riscvToBinary(instruction)`:** Hàm chính để chuyển đổi một lệnh hợp ngữ RISC-V thành mã nhị phân.
Bước 1: Chuẩn hóa lệnh
**`instruction = normalizeRegisterNames(instruction);`**
=> Chuyển thanh ghi về dạng Xn.

## Các định dạng lệnh được hỗ trợ

Hiện tại, trình biên dịch chỉ hỗ trợ một số định dạng lệnh RISC-V cơ bản. Việc mở rộng hỗ trợ cho nhiều định dạng lệnh hơn là một trong những mục tiêu phát triển trong tương lai.

## Hướng dẫn sử dụng

1.  Truy cập trang web: [https://xuanloc25.github.io/risc_v/](https://xuanloc25.github.io/risc_v/)
2.  Nhập code hợp ngữ RISC-V vào ô nhập liệu.
3.  Nhấp vào nút "Compile".
4.  Mã nhị phân tương ứng sẽ được hiển thị bên dưới.
