
# Merkeziyetsiz Veri Koruma ve Yönetim Sistemi

**GitHub Reposu:** [https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git](https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git)

Bu proje, kullanıcıların dosyalarını istemci tarafında (tarayıcıda) güvenli bir şekilde şifrelemesini, bu şifreleme için kullanılan AES anahtarını Lit Protocol ile merkeziyetsiz erişim kontrolüyle korumasını, şifreli veri paketini Arweave (yerel `arlocal` simülasyonu kullanılarak) ağına yüklemesini ve bu yüklemelere ait **metadata'yı Sepolia test ağındaki bir Ethereum akıllı kontratı üzerinde yönetmesini** sağlayan bir Web3 Merkeziyetsiz Uygulama (DApp) prototipidir. Kullanıcılar, DApp aracılığıyla daha önce yükledikleri dosyalara bir panel üzerinden erişebilir ve bunları deşifre edebilirler.

## Projenin Ana Katmanları ve Teknolojiler

-   **Kullanıcı Arayüzü (DApp):** Next.js (React, TypeScript) - `merkeziyetsiz-ui` klasöründe yer alır. Kullanıcı etkileşimlerini, cüzdan bağlantısını ve diğer servislerle iletişimi yönetir.
-   **Çekirdek Kriptografi:** Rust (AES-256-GCM) ile geliştirilmiş, WebAssembly (WASM) formatına derlenmiş (`core_crypto_module` crate'i, `src/lib.rs` içinde) ve tarayıcıda çalışan şifreleme/deşifreleme motoru.
-   **Merkeziyetsiz Anahtar Yönetimi:** Lit Protocol (DatilTest ağı) kullanılarak AES anahtarlarının güvenli yönetimi ve koşullu erişimi sağlanır. Entegrasyon, tarayıcıda çalışan Lit Protocol JavaScript SDK'sı ile gerçekleştirilmiştir.
-   **Merkeziyetsiz Depolama:** Şifrelenmiş veri paketlerinin kalıcı ve sansüre dirençli depolanması için Arweave ağı hedeflenmiştir. Geliştirme ve testlerde `arlocal` (yerel Arweave simülatörü) kullanılmıştır. Etkileşim, `arweave-js` kütüphanesi ile sağlanmıştır.
-   **Blockchain Etkileşimi (Kimlik, İmzalar ve Metadata Yönetimi):** Ethereum (Sepolia Testnet üzerinden MetaMask cüzdanı ile).
    -   **Akıllı Kontrat (`MetadataStorage.sol`):** Solidity ile yazılmış ve Foundry kullanılarak geliştirilip Sepolia test ağına dağıtılmıştır. Bu kontrat, kullanıcıların dosya metadata'larını (dosya adı, Arweave TX ID, dosya tipi, tarih) kendi Ethereum adreslerine bağlı olarak saklar ve yönetir. (Projenin `smart-contracts/metadata-storage-contract/` klasöründe yer alır.)
-   **Blockchain İletişim Kütüphanesi (DApp için):** `ethers.js`

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

## DApp Kurulumu ve Çalıştırma

Bu bölüm, projenin ana DApp arayüzünü ve entegre akıllı kontrat sistemini yerel makinenizde çalıştırmak için izlenmesi gereken adımları detaylandırmaktadır.

### Ön Gereksinimler

1.  **Node.js ve npm/yarn:** [Node.js (LTS)](https://nodejs.org/).
2.  **Rust ve Cargo:** [Rust Kurulumu](https://www.rust-lang.org/tools/install).
3.  **wasm-pack:** `cargo install wasm-pack`.
4.  **Foundry:** Akıllı kontratları derlemek, test etmek ve dağıtmak için. Kurulum için [Foundry Book](https://book.getfoundry.sh/getting-started/installation).
5.  **arlocal (Arweave Yerel Simülatörü):** `npm install -g arlocal`.
6.  **MetaMask Tarayıcı Eklentisi:** Sepolia test ağına bağlı ve üzerinde test SepoliaETH bulunan bir hesap.
7.  **Arweave Cüzdan Anahtar Dosyası (JWK):** `arlocal` veya `arweave.app`'ten. **Güvenli saklayın, GitHub'a YÜKLEMEYİN!**

### Proje Kurulum Adımları

1.  **GitHub Deposunu Klonlayın:**
    ```bash
    git clone https://github.com/SuleymanSelimPirinc/merkeziyetsiz-veri-koruma.git
    cd merkeziyetsiz-veri-koruma
    ```
2.  **Next.js Frontend Bağımlılıklarını Yükleyin:**
    ```bash
    cd merkeziyetsiz-ui
    npm install
    cd ..
    ```
3.  **Akıllı Kontrat Bağımlılıkları (Foundry Projesi İçin):**
    `smart-contracts/metadata-storage-contract/` dizinine girip, eğer `lib/forge-std` gibi submodule'ler yoksa veya güncellemek isterseniz:
    ```bash
    cd smart-contracts/metadata-storage-contract
    forge install # Veya forge update
    cd ../.. 
    ```

### Yapılandırma

**DApp Yapılandırması (`merkeziyetsiz-ui/src/services/contractService.ts`):**
-   `MetadataStorage.sol` kontratını Sepolia'ya dağıttıktan sonra elde ettiğiniz **kontrat adresini** bu dosyadaki `CONTRACT_ADDRESS` sabitine girmeniz gerekmektedir.
-   Kontratın **ABI JSON** dosyasını (`smart-contracts/metadata-storage-contract/out/MetadataStorage.sol/MetadataStorage.json`) alıp, `merkeziyetsiz-ui/src/contracts/MetadataStorage.json` olarak kaydetmeniz (veya içeriğini güncellemeniz) gerekmektedir.

**Akıllı Kontrat Dağıtımı İçin `.env` Dosyası (Sadece Geliştirici Tarafından, Bir Kez Kullanılır):**
`MetadataStorage.sol` kontratını Sepolia'ya dağıtmak için `smart-contracts/metadata-storage-contract/` klasörünün kökünde bir `.env` dosyası oluşturulmalıdır:
```env
# smart-contracts/metadata-storage-contract/.env
SEPOLIA_RPC_URL="SİZİN_SEPOLIA_RPC_URL_NİZ (örn: Infura, Alchemy)"
SEPOLIA_PRIVATE_KEY="0xSİZİN_DAĞITIMCI_METAMASK_SEPOLIA_ÖZEL_ANAHTARINIZ"
ETHERSCAN_API_KEY="SİZİN_ETHERSCAN_API_ANAHTARINIZ (Kontrat doğrulaması için, isteğe bağlı)"
```
**Bu `.env` dosyası ASLA GitHub'a gönderilmemelidir ve `.gitignore` ile hariç tutulmalıdır.**

### Projeyi Çalıştırma

1.  **`arlocal`'ı Kalıcı Veri ile Başlatın:**
    Projenin ana dizininde (`merkeziyetsiz-veri-koruma/`) bir `arlocal-data` klasörü oluşturun. Yeni bir terminalde:
    ```bash
    arlocal --persist ./arlocal-data
    ```
2.  **Rust WASM Modülünü Derleyin:**
    Ana proje dizininde (`merkeziyetsiz-veri-koruma/`):
    ```bash
    wasm-pack build --target web --out-dir ./merkeziyetsiz-ui/src/lib/rust-crypto --dev
    ```
    *Not: `Cargo.toml`'daki `[package].name` ile `FileProcessor.tsx` içindeki import yolunun eşleştiğinden emin olun.*

3.  **Akıllı Kontratı Dağıtın (Eğer Henüz Dağıtılmadıysa veya Güncellendiyse):**

    a.  `smart-contracts/metadata-storage-contract/` dizinine gidin.

    b.  Gerekirse derleyin: `forge build`

    c.  Dağıtım betiğini çalıştırın (yukarıdaki `.env` dosyasının ayarlandığından emin olun):
        ```bash
        forge script script/DeployMetadataStorage.sol:DeployMetadataStorage --rpc-url sepolia --broadcast --verify -vvvv
        ```
    d.  Çıktıdaki **kontrat adresini** alın ve `merkeziyetsiz-ui/src/services/contractService.ts` dosyasındaki `CONTRACT_ADDRESS` sabitini güncelleyin.

    e.  Oluşan **ABI JSON** dosyasını (`out/MetadataStorage.sol/MetadataStorage.json`) `merkeziyetsiz-ui/src/contracts/MetadataStorage.json` olarak kopyalayın/güncelleyin.

4.  **Next.js Geliştirme Sunucusunu Başlatın:**
    `merkeziyetsiz-ui/` klasöründeyken:
    ```bash
    npm run dev
    ```
    Uygulama `http://localhost:3000` adresinde açılacaktır.

### DApp Kullanım Akışı

1.  Tarayıcıda uygulamayı açın ve MetaMask cüzdanınızı (Sepolia ağına ayarlı) bağlayın.
    *   Daha önce o adresle yüklediğiniz ve akıllı kontrata kaydettiğiniz dosyalar varsa, "Kaydedilmiş Dosyalarınız" panelinde listelenecektir.
2.  **Yeni Dosya Yükleme ve Kaydetme:**
3. **Adım A:** Arweave JWK dosyanızı seçin.
    
   **Adım B:** Şifrelemek istediğiniz dosyayı seçin.
    
   **Adım C:** "Yeni AES Anahtarı Üret".
    
   **Adım D:** "AES Anahtarını Lit ile Koru" (MetaMask imzası istenir).
    
   **Adım E:** "Dosyayı Şifrele & Arweave'e Yükle".
    *   Bu adım sonunda Arweave TX ID'si alınır. Ardından, dosya metadata'sını akıllı kontrata kaydetmek için MetaMask'tan ikinci bir işlem onayı ve (test) gas ücreti istenir.
    *   "Kaydedilmiş Dosyalarınız" paneli yeni dosya ile güncellenir.
5.  **Mevcut Bir Dosyayı Deşifreleme:**

    a.  "Kaydedilmiş Dosyalarınız" panelinden bir dosyayı "Deşifre İçin Seç" butonuna tıklayarak seçin.

    b.  Seçilen TX ID, aşağıdaki "Adım F" bölümündeki input alanına otomatik olarak dolar.

    c.  **Adım F:** "Deşifrele ve İndir" butonuna tıklayın (MetaMask'tan Lit için imza istenir).

    d.  Orijinal dosyanız indirilecektir.

---

## Proje Yapısı

-   **`merkeziyetsiz-ui/`**: Next.js frontend DApp'i.
    -   `src/app/`: Sayfalar ve layout.
    -   `src/components/`: React bileşenleri (`ConnectWallet.tsx`, `FileProcessor.tsx`).
    -   `src/services/`: Servisler (`litService.ts`, `arweaveService.ts`, `contractService.ts`).
    -   `src/contracts/`: Akıllı kontrat ABI'si (`MetadataStorage.json`).
    -   `src/lib/rust-crypto/`: Derlenmiş WASM paketi.
-   **`src/`**: Rust WASM kütüphanesinin kaynak kodları (`lib.rs`).
-   **`Cargo.toml`**: Rust projesi yapılandırması.
-   **`smart-contracts/metadata-storage-contract/`**: Foundry ile geliştirilen akıllı kontrat projesi.
    -   `src/MetadataStorage.sol`: Kullanıcı dosya metadata'larını saklayan Solidity kontratı.
    -   `script/DeployMetadataStorage.sol`: Dağıtım betiği.
    -   `test/MetadataStorageTest.sol`: Birim testleri.
    -   `foundry.toml`: Foundry proje yapılandırması.
    -   `.env`: (GİT'E GÖNDERİLMEZ) Geliştiriciye özel dağıtım anahtarı ve RPC URL'si.

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
