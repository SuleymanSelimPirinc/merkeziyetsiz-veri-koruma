// src/encryption.rs

// Gerekli kütüphaneleri import et
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng as AeadOsRng}; // aes-gcm içindeki OsRng
use rand::RngCore; // fill_bytes için

/// Verilen bir anahtar ve veri ile AES-256-GCM şifrelemesi yapar.
/// Nonce'ı ve şifreli metni döndürür.
/// Fonksiyonu dışarıdan çağırabilmek için `pub` anahtar kelimesini ekliyoruz.
pub fn encrypt_data(key: &Key<Aes256Gcm>, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key);

    // Her şifreleme için benzersiz bir Nonce oluştur (96 bit / 12 byte)
    let mut nonce_bytes = [0u8; 12];
    // aes-gcm'nin kendi OsRng'sini kullanıyoruz (AeadOsRng olarak yeniden adlandırılmış)
    AeadOsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Veriyi şifrele
    let ciphertext = cipher.encrypt(nonce, plaintext)?;

    // Şifreli veriyi ve kullanılan Nonce'ı birlikte döndür
    Ok((ciphertext, nonce.to_vec()))
}

/// Verilen anahtar, nonce ve şifreli veri ile AES-256-GCM şifresini çözer.
/// Orijinal veriyi (plaintext) döndürür.
/// Fonksiyonu dışarıdan çağırabilmek için `pub` anahtar kelimesini ekliyoruz.
pub fn decrypt_data(key: &Key<Aes256Gcm>, ciphertext: &[u8], nonce_bytes: &[u8]) -> Result<Vec<u8>, aes_gcm::Error> {
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);

    // Şifreyi çöz
    let plaintext = cipher.decrypt(nonce, ciphertext)?;

    Ok(plaintext)
}

// --- İsteğe Bağlı: Anahtar Oluşturma Fonksiyonu ---
// Anahtar oluşturmayı da bu modüle taşıyabiliriz
use rand::rngs::OsRng as RandOsRng; // rand kütüphanesinin OsRng'si

/// Rastgele bir AES-256 anahtarı oluşturur.
/// Dikkat: Güvenli anahtar YÖNETİMİ bu fonksiyonun kapsamı dışındadır.
pub fn generate_aes_key() -> Key<Aes256Gcm> {
    let mut key_bytes = [0u8; 32]; // 256 bit = 32 byte
    // rand kütüphanesinin OsRng'sini (RandOsRng olarak adlandırılmış) kullanalım
    RandOsRng.fill_bytes(&mut key_bytes);
    Key::<Aes256Gcm>::from_slice(&key_bytes).clone() // Key::from_slice referans alır, clone ile sahiplik alırız
}