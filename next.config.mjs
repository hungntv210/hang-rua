/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Goi free cua football-data.org gioi han 10 request/phut. Mot build SACH
  // can ~12 request (6 giai x lich + 5 BXH + 1 bracket) nen chac chan cham
  // tran; lib/football-data.ts doi theo header X-RequestCounter-Reset roi thu
  // lai toi 3 lan, truong hop xau nhat ~180s cho mot trang.
  //
  // Gia tri nay phai LON HON ngan sach retry do. Dat 120s van bi SIGTERM giua
  // chung (4 trang giai phai sinh lai), nen nang len 300s.
  //
  // Build co cache (.next con nguyen) khong goi API nen khong bi anh huong.
  staticPageGenerationTimeout: 300,

  // Prerender bang MOT worker thay vi song song theo so CPU.
  //
  // Nguyen nhan: tran gioi han la 10 request/PHUT. Chay song song thi ~12
  // request cua build cham tran gan nhu cung luc, retry cua tung trang chong
  // len nhau va co trang cạn luot (da do: 2/22 trang bake ra 429). Chay tuan tu
  // thi request trai deu, retry hiem khi phai dung toi.
  //
  // Danh doi: build lau hon. Chi anh huong build, khong anh huong dev.
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;
