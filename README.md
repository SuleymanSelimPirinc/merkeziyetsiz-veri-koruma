
# Merkeziyetsiz Veri Koruma ve Yönetim Sistemi

**GitHub Reposu:** [https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git](https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git)

Bu proje, kullanıcıların dosyalarını istemci tarafında (tarayıcıda) güvenli bir şekilde şifrelemesini, bu şifreleme için kullanılan AES anahtarını Lit Protocol ile merkeziyetsiz erişim kontrolüyle korumasını ve hem şifreli dosyayı hem de korumalı anahtarı Arweave (yerel `arlocal` simülasyonu) ağına yüklemesini sağlayan bir Web3 DApp prototipidir. Proje ayrıca, Arweave'den daha önce yüklenmiş bir paketin TX ID'si ile çekilip deşifrelenerek orijinal dosyaya erişilmesini de göstermektedir.

## Projenin Ana Katmanları ve Teknolojiler

-   **Kullanıcı Arayüzü (DApp):** Next.js (React, TypeScript) - `merkeziyetsiz-ui` klasöründe yer alır.
-   **Çekirdek Kriptografi:** Rust (AES-256-GCM), WebAssembly (WASM) olarak derlenmiş (`core_crypto_module` varsayılan crate adı, `src/lib.rs` içinde).
-   **Merkeziyetsiz Anahtar Yönetimi:** Lit Protocol (DatilTest ağı) - Tarayıcıda çalışan Lit Protocol JS SDK'sı ile entegre.
-   **Merkeziyetsiz Depolama:** Arweave (`arlocal` yerel simülasyonu) - Tarayıcıda çalışan `arweave-js` ile entegre.
-   **Blockchain Etkileşimi (Kimlik ve İmzalar):** Ethereum (Sepolia Testnet üzerinden MetaMask cüzdanı ile).

## DApp Kurulumu ve Çalıştırma (Önerilen Yöntem)

Bu bölüm, projenin ana DApp arayüzünü çalıştırmak için gerekli adımları içerir.

### Ön Gereksinimler

1.  **Node.js ve npm/yarn:** [Node.js (LTS)](https://nodejs.org/) (npm, Node.js ile birlikte gelir).
2.  **Rust ve Cargo:** [Rust Kurulumu](https://www.rust-lang.org/tools/install)
3.  **wasm-pack:** Rust kodunu WebAssembly'e derlemek için.
    ```bash
    cargo install wasm-pack
    ```
4.  **arlocal (Arweave Yerel Simülatörü - Test İçin):**
    ```bash
    npm install -g arlocal
    # VEYA
    # yarn global add arlocal
    ```
5.  **MetaMask Tarayıcı Eklentisi:**
    *   Kurulu ve ayarlı olmalıdır.
    *   **Sepolia test ağına** bağlı bir hesap.
    *   Bu hesapta test amaçlı SepoliaETH bulunmalıdır (Faucet'lerden temin edilebilir).
6.  **Arweave Cüzdan Anahtar Dosyası (JWK):**
    *   **Test için `arlocal` ile:** `arlocal`'ı ilk başlattığınızda size bir test cüzdanı ve anahtar dosyası yolu (`.json`) verecektir. Bu dosyayı DApp arayüzünden yükleyeceksiniz.
    *   **Alternatif veya Gerçek Arweave Ağı İçin:** [https://arweave.app/](https://arweave.app/) adresinden bir Arweave web cüzdanı oluşturabilir ve anahtar dosyanızı (JWK formatında) indirebilirsiniz. **Bu anahtar dosyasını GÜVENLİ bir şekilde saklayın ve ASLA GitHub'a yüklemeyin!** DApp'in "Adım A" kısmında bu dosyayı seçmeniz istenecektir.

### Proje Kurulumu

1.  **Projeyi Klonlayın:**
    ```bash
    git clone https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git
    cd merkeziyetsiz-veri-koruma
    ```

2.  **Next.js Frontend Bağımlılıklarını Yükleyin:**
    ```bash
    cd merkeziyetsiz-ui
    npm install
    # VEYA
    # yarn install
    cd .. 
    ```

### Yapılandırma (DApp İçin)

Bu DApp'in çalışması için harici `.env` dosyalarına **ihtiyaç yoktur.** Lit Network ve Arweave yerel bağlantısı gibi konfigürasyonlar kod içinde ayarlanmıştır. Kullanıcı etkileşimleri (cüzdan bağlantısı, Arweave JWK yükleme) doğrudan arayüz üzerinden yapılır.

-   **Lit Protocol Ağı:** `merkeziyetsiz-ui/src/services/litService.ts` içinde `LIT_NETWORK.DatilTest` (veya `'datil-test'`) olarak ayarlanmıştır.
-   **Arweave Bağlantısı:** `merkeziyetsiz-ui/src/services/arweaveService.ts` içinde `arlocal` (`http://localhost:1984`) için ayarlanmıştır.

### Projeyi Çalıştırma

1.  **`arlocal`'ı Başlatın (Test İçin):**
    Yeni bir terminal penceresi açın ve şu komutu çalıştırın:
    ```bash
    arlocal
    ```
    Bu, yerel Arweave ağınızı `http://localhost:1984` üzerinde başlatacaktır. Konsolda size bir test cüzdan anahtar dosyası yolu gösterecektir. Bu dosyayı DApp'te kullanacaksınız.
    *Not: `arlocal` her yeniden başlatıldığında verileri sıfırlayabilir. Yüklediğiniz TX ID'lerinin kalıcı olması için `arlocal --persist ./arlocal-data` gibi bir komutla veri klasörü belirleyebilirsiniz.*

2.  **Rust WASM Modülünü Derleyin:**
    Projenin ana dizininde (`merkeziyetsiz-veri-koruma/`) şu komutu çalıştırın:
    ```bash
    wasm-pack build --target web --out-dir ./merkeziyetsiz-ui/src/lib/rust-crypto --dev
    ```
    Bu komut, Rust kriptografi kütüphanenizi (`src/lib.rs`) WebAssembly'e derler ve Next.js projesinin (`merkeziyetsiz-ui/src/lib/rust-crypto/`) içine gerekli JavaScript bağlayıcı kodlarıyla birlikte paketler.
    *Not: `Cargo.toml` dosyanızdaki `[package].name` alanı (örneğin `core_crypto_module`) ile `merkeziyetsiz-ui/src/components/FileProcessor.tsx` içindeki `await import('../lib/rust-crypto/PAKET_ADINIZ');` satırındaki `PAKET_ADINIZ` kısmının eşleştiğinden emin olun.*

3.  **Next.js Geliştirme Sunucusunu Başlatın:**
    `merkeziyetsiz-ui` klasörünün içindeyken:
    ```bash
    cd merkeziyetsiz-ui
    npm run dev
    # VEYA
    # yarn dev
    ```
    Uygulama genellikle `http://localhost:3000` adresinde açılacaktır.

### DApp Kullanım Akışı

1.  Tarayıcıda `http://localhost:3000` adresini açın.
2.  MetaMask cüzdanınızı bağlayın (Sepolia test ağına ayarlı olmalıdır).
3.  **Adım A:** "Arweave Cüzdan (JWK)" kısmından, `arlocal`'dan aldığınız veya `arweave.app`'ten indirdiğiniz Arweave anahtar `.json` dosyasını seçin.
4.  **Adım B (Şifreleme):** Şifrelemek istediğiniz bir dosya seçin.
5.  **Adım C:** "Yeni AES Anahtarı Üret" butonuna tıklayın.
6.  **Adım D:** "AES Anahtarını Lit ile Koru" butonuna tıklayın. (MetaMask'tan bir imza isteği gelecektir, onaylayın.)
7.  **Adım E:** "Dosyayı Şifrele & Arweave'e Yükle" butonuna tıklayın.
    *   Başarılı olursa, UI'da bir Arweave TX ID'si ve `arlocal` görüntüleyici linki göreceksiniz. **Bu TX ID'sini not alın.**
8.  **Adım F (Deşifreleme):**
    *   Daha önce (aynı veya farklı bir `arlocal` oturumunda, eğer `--persist` kullanıldıysa veya `arlocal` hala çalışıyorsa) yüklediğiniz ve TX ID'sini bildiğiniz bir dosyanın TX ID'sini ilgili input alanına yapıştırın.
    *   "Deşifrele ve İndir" butonuna tıklayın. (MetaMask'tan bir imza isteği daha gelecektir – AES anahtarını Lit ile çözmek için.)
    *   Başarılı olursa, orijinal dosyanızı indirebileceğiniz bir link görünecektir.

---

## (İSTEĞE BAĞLI) Eski Komut Satırı Akışını Çalıştırma (Rust + Node.js)

Bu DApp, projenin ilk geliştirme aşamalarında Rust tabanlı bir ana uygulamanın (`src/main.rs`), Lit Protocol ve Arweave işlemleri için Node.js betiklerini (`key_manager_lit/` ve `arweave_uploader/` klasörlerindeki) çağırdığı bir komut satırı arayüzüne sahipti. Bu yapı, DApp versiyonu için **artık ana geliştirme odağı değildir ve doğrudan kullanılmamaktadır.**

Ancak, bu eski mekanizmayı incelemek veya bağımsız olarak test etmek isterseniz aşağıdaki adımları izleyebilirsiniz:

### Ön Gereksinimler (Eski Akış İçin Ekstra)

-   Yukarıdaki DApp ön gereksinimlerine ek olarak, Node.js betiklerinin kendi bağımlılıkları olacaktır.

### Yapılandırma (Eski Akış İçin)

1.  **Ana `.env` Dosyası:**
    Projenin ana dizininde (`merkeziyetsiz-veri-koruma/`) bir `.env` dosyası oluşturun (eğer yoksa). Aşağıdaki değişkenleri kendi bilgilerinizle doldurun:
    ```env
    # Örnek /merkeziyetsiz-veri-koruma/.env içeriği
    ARWEAVE_KEYFILE_PATH="C:/YOLUNUZ/arweave-keyfile.json" # Arlocal anahtar dosyanızın tam yolu
    TEST_ETH_ADDRESS="0xSI_ZIN_SEPOLIA_TEST_ADRESINIZ"
    ```
    **Bu dosya `.gitignore` içinde olmalı ve GitHub'a gönderilmemelidir.**

2.  **Lit Protocol İçin `.env` Dosyası:**
    Eğer `key_manager_lit/` klasörü projenizde hala mevcutsa, bu klasörün içine bir `.env` dosyası oluşturun:
    ```env
    # Örnek /merkeziyetsiz-veri-koruma/key_manager_lit/.env içeriği
    TEST_ETH_PRIVATE_KEY="YUKARIDAKI_TEST_ADRESININ_OZEL_ANAHTARI"
    # DİKKAT: Özel anahtarları sadece yerel testlerde ve çok dikkatli kullanın!
    ```
    **Bu dosya da `.gitignore` içinde olmalı ve GitHub'a gönderilmemelidir.**

### Node.js Bağımlılıkları (Eski Betikler İçin)

Eğer `key_manager_lit/` ve `arweave_uploader/` klasörlerindeki Node.js betiklerini çalıştırmak isterseniz, her bir klasörün içine girip `npm install` (veya `yarn install`) çalıştırmanız gerekebilir:
```bash
cd key_manager_lit
npm install
cd ../arweave_uploader
npm install
cd .. 
```
*(Not: Bu klasörler DApp için gereksizse ve projenizden çıkarıldıysa bu adım anlamsızdır.)*

### Komut Satırı Akışını Çalıştırma

1.  `arlocal`'ı ayrı bir terminalde çalıştırın.
2.  Projenin ana dizininde (`merkeziyetsiz-veri-koruma/`) iken, Rust uygulamasını (binary) çalıştırın:
    ```bash
    cargo run 
    ```
    Bu, `src/main.rs` dosyasını çalıştıracaktır. Bu dosyanın içeriği, Node.js betiklerini çağıran eski mantığı içermelidir. Güncel DApp geliştirmesi sırasında `src/main.rs` değiştirilmiş veya işlevsiz bırakılmış olabilir.

**Önemli Not:** Bu eski komut satırı akışı, DApp'in mevcut işleyişinden bağımsızdır ve güncel proje için birincil kullanım yöntemi değildir. Sadece konseptin ilk aşamalarını ve farklı bir entegrasyon modelini göstermektedir.

---

## Sorun Giderme ve Notlar

-   **Lit Protocol Bağlantı Hataları (`net::ERR_NETWORK_CHANGED` vb.):**
    DApp'i başlatırken veya Lit Protocol ile ilgili bir işlem yaparken konsolda Lit RPC endpoint'lerine erişimde ağ hataları görebilirsiniz. Bu tür hatalar genellikle geçicidir. Birkaç dakika bekleyip sayfayı yenileyerek tekrar deneyin veya internet bağlantınızı kontrol edin. Proje, Lit Protocol için `DatilTest` ağını hedeflemektedir.

-   **MetaMask Etkileşimleri:**
    DApp, Lit Protocol işlemleri için MetaMask üzerinden SIWE mesajlarını imzalamanızı isteyecektir. Bu imza isteklerini onaylamanız gerekmektedir. MetaMask'ınızın Sepolia Testnet'e bağlı olduğundan emin olun.

-   **`arlocal` Kullanımı ve Kalıcılık:**
    -   Bu proje test amacıyla `arlocal` kullanır. `arlocal` her yeniden başlatıldığında (eğer `--persist` bayrağı kullanılmazsa) verileri sıfırlar.
    -   Yüklediğiniz TX ID'lerinin `arlocal` oturumları arasında kalıcı olması için, `arlocal`'ı bir veri klasörü belirterek çalıştırabilirsiniz: `arlocal --persist ./arlocal-data`. Bu, `arlocal-data` adlı bir klasörde işlem verilerini saklayacaktır.
    -   Farklı dosyalar yükleyip, `arlocal`'ı kapatıp `--persist` ile aynı veri klasörünü kullanarak tekrar başlattığınızda, önceki TX ID'lerini girerek dosyalarınıza erişebilmelisiniz.

-   **Deprecated Uyarıları:**
    Konsolda Lit Protocol veya diğer kütüphanelerden "deprecated symbol" uyarıları görebilirsiniz. Proje, belirtilen bağımlılık versiyonlarıyla çalışacak şekilde ayarlanmıştır.

---

## Proje Yapısı

-   `merkeziyetsiz-ui/`: Next.js frontend DApp'i.
    -   `src/app/`: Sayfalar ve ana layout.
    -   `src/components/`: React bileşenleri.
    -   `src/services/`: Harici servislerle etkileşim.
    -   `src/lib/rust-crypto/`: Derlenmiş WASM paketi.
-   `src/`: Rust WASM kütüphanesinin kaynak kodları (`lib.rs`).
-   `Cargo.toml`: Rust projesinin bağımlılıkları ve crate tanımı.
-   `(Gelecek)` `smart-contracts/`: Kullanıcı metadata'sını ve dosya listesini saklamak için Solidity akıllı kontratları (Foundry ile geliştirilecek).

## Gelecekteki Geliştirmeler
-   Foundry ile geliştirilecek akıllı kontratlar aracılığıyla kullanıcıya özel, kalıcı dosya listesi paneli.
-   Gerçek Arweave testnet/mainnet ağına entegrasyon seçeneği.
-   Gelişmiş UI/UX, daha detaylı yükleniyor göstergeleri ve kapsamlı hata yönetimi.
-   DID (Merkeziyetsiz Kimlik) ve ZKP (Sıfır Bilgi Kanıtları) entegrasyonları.
-   Kapsamlı birim ve entegrasyon testleri.
