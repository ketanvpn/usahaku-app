import { describe, it, expect } from "vitest";
import {
  buildStrukHtml,
  getBodyWidth,
  getPageCss,
  type StrukData,
} from "../artifacts/hutang-app/src/lib/struk";
import type { Pengaturan } from "../artifacts/hutang-app/src/hooks/use-pengaturan";

const baseHasil: StrukData = {
  id: 7,
  tanggal: "2026-05-15",
  nama_usaha: "Toko Sari",
  subtotal: 25000,
  diskon: 0,
  total: 25000,
  uang_bayar: 30000,
  kembalian: 5000,
  items: [
    {
      nama_barang: "Roti Tawar Sari Roti Gandum Utuh",
      jumlah: 2,
      satuan: "pcs",
      harga_satuan: 8500,
      subtotal: 17000,
    },
    {
      nama_barang: "Susu",
      jumlah: 1,
      satuan: "kotak",
      harga_satuan: 8000,
      subtotal: 8000,
    },
  ],
};

const pengaturan58mm: Pengaturan = {
  struk_header: "Jl. Merdeka 12",
  struk_footer: "Terima kasih sudah belanja",
  struk_ukuran_kertas: "58mm",
  struk_tampilkan_logo: "0",
  logo_filename: null,
};

const pengaturan80mm: Pengaturan = {
  ...pengaturan58mm,
  struk_ukuran_kertas: "80mm",
};

describe("getPageCss / getBodyWidth", () => {
  it("58mm: page size 58mm dan body 50mm (safety margin printer thermal)", () => {
    expect(getPageCss("58mm")).toContain("size: 58mm auto");
    expect(getBodyWidth("58mm")).toBe("50mm");
  });

  it("80mm: page size 80mm dan body 72mm", () => {
    expect(getPageCss("80mm")).toContain("size: 80mm auto");
    expect(getBodyWidth("80mm")).toBe("72mm");
  });

  it("A4: page size A4 dan body auto", () => {
    expect(getPageCss("A4")).toContain("size: A4");
    expect(getBodyWidth("A4")).toBe("auto");
  });

  it("ukuran tidak dikenal fallback ke 80mm", () => {
    expect(getPageCss("foo")).toContain("size: 80mm auto");
    expect(getBodyWidth("foo")).toBe("72mm");
  });
});

describe("buildStrukHtml — layout 58mm", () => {
  const html = buildStrukHtml(baseHasil, { pengaturan: pengaturan58mm });

  it("memakai page size 58mm", () => {
    expect(html).toContain("size: 58mm auto");
  });

  it("TIDAK memakai layout tabel 4 kolom (yang bikin overflow di 58mm)", () => {
    // Bug v1.0.83: kolom Barang/Qty/Harga/Sub di 58mm bikin baris pecah.
    // Layout baru pakai flex 2-baris per item, jadi tidak ada <thead> atau <tr>.
    expect(html).not.toContain("<thead>");
    expect(html).not.toContain("<tr>");
    expect(html).not.toContain("<table>");
  });

  it("memakai layout flex 2-baris per item (.item / .item-nama / .row)", () => {
    expect(html).toContain('class="item"');
    expect(html).toContain('class="item-nama"');
    expect(html).toContain('class="row"');
  });

  it("nama barang panjang di-escape dan masuk ke item-nama", () => {
    expect(html).toContain("Roti Tawar Sari Roti Gandum Utuh");
  });

  it("angka format Rupiah tanpa prefix Rp untuk hemat ruang", () => {
    // 17.000 (id-ID) bukan "Rp 17.000"
    expect(html).toContain("17.000");
    expect(html).not.toMatch(/Rp\s*17\.000/);
  });

  it("baris TOTAL ditampilkan dengan nilai total transaksi", () => {
    expect(html).toMatch(/TOTAL.*25\.000/s);
  });

  it("header tambahan dari pengaturan dirender dan di-escape", () => {
    expect(html).toContain("Jl. Merdeka 12");
  });

  it("footer custom dari pengaturan dirender", () => {
    expect(html).toContain("Terima kasih sudah belanja");
  });

  it("font 8pt untuk body 58mm supaya muat", () => {
    expect(html).toMatch(/font-size:\s*8pt/);
  });
});

describe("buildStrukHtml — layout 80mm/A4 (regression)", () => {
  const html80 = buildStrukHtml(baseHasil, { pengaturan: pengaturan80mm });

  it("80mm tetap pakai layout tabel 4 kolom (tidak boleh berubah)", () => {
    expect(html80).toContain("<thead>");
    expect(html80).toContain("<table>");
    expect(html80).toContain("Barang");
    expect(html80).toContain("Qty");
    expect(html80).toContain("Harga");
  });

  it("80mm pakai page size 80mm dan body 72mm", () => {
    expect(html80).toContain("size: 80mm auto");
    expect(html80).toContain("width:72mm");
  });

  it("default (pengaturan undefined) jatuh ke 80mm", () => {
    const html = buildStrukHtml(baseHasil);
    expect(html).toContain("size: 80mm auto");
  });
});

describe("buildStrukHtml — keamanan HTML", () => {
  it("nama barang dengan tag HTML di-escape (no XSS)", () => {
    const evil: StrukData = {
      ...baseHasil,
      items: [
        {
          nama_barang: "<script>alert(1)</script>",
          jumlah: 1,
          satuan: "pcs",
          harga_satuan: 1000,
          subtotal: 1000,
        },
      ],
    };
    const html = buildStrukHtml(evil, { pengaturan: pengaturan58mm });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("nama_usaha dengan karakter spesial di-escape", () => {
    const html = buildStrukHtml(
      { ...baseHasil, nama_usaha: "Toko \"Sari\" & Co" },
      { pengaturan: pengaturan80mm },
    );
    expect(html).toContain("Toko &quot;Sari&quot; &amp; Co");
  });
});

describe("buildStrukHtml — diskon", () => {
  it("kalau ada diskon, baris Subtotal + Diskon ditampilkan (58mm)", () => {
    const html = buildStrukHtml(
      { ...baseHasil, diskon: 5000, total: 20000 },
      { pengaturan: pengaturan58mm },
    );
    expect(html).toContain("Subtotal");
    expect(html).toContain("Diskon");
    expect(html).toContain("-5.000");
  });

  it("kalau diskon 0, baris Subtotal/Diskon disembunyikan (58mm)", () => {
    const html = buildStrukHtml(baseHasil, { pengaturan: pengaturan58mm });
    // 'Diskon' tidak boleh muncul sebagai label baris
    expect(html).not.toMatch(/<span>Diskon<\/span>/);
  });
});
