# Deneme Takip

YKS (TYT / AYT) deneme sonuçlarını takip etmek için basit, mobil uyumlu bir site. Hiçbir kütüphane kullanmaz; sadece HTML, CSS ve JavaScript.

## Özellikler

- TYT veya AYT denemesi seçip ders ders **doğru / yanlış / boş** girişi (boş sayısı otomatik hesaplanır)
- Netler otomatik hesaplanır (4 yanlış 1 doğruyu götürür)
- Denemenin yapıldığı tarih
- Her denemeye istediğin kadar yorum yazma
- Toplam net ve ders ders net grafikleri, ders ortalamaları
- Düzenleme ve silme
- Veriler GitHub'daki gizli bir depoda (`data.json`) tutulur, tüm cihazlar aynı verileri görür
- **Yedeği indir / Yedek yükle** ile JSON yedek alınabilir

## Kurulum

1. Verilerin tutulacağı **gizli** bir depo aç ve içine `[]` yazan bir `data.json` koy.
2. [Fine-grained token](https://github.com/settings/personal-access-tokens/new) oluştur: yalnızca bu depoya erişsin, izin olarak **Contents: Read and write** ver.
3. Siteyi aç, ⚙︎ simgesinden depo adını ve token'ı gir. Her cihazda bir kez yapman yeterli.

Cihazda yalnızca bağlantı bilgisi saklanır; denemeler GitHub'da durur.
