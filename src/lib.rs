// src/lib.rs
use wasm_bindgen::prelude::*;
use js_sys;
use aes_gcm::{Aes256Gcm, Key, Nonce};
use aes_gcm::aead::{Aead, KeyInit, OsRng as AeadOsRng};
use rand::RngCore;
use rand::rngs::OsRng as RandOsRng;
use core::slice; // slice::from_raw_parts için

#[wasm_bindgen]
pub fn set_panic_hook() { /* ... aynı ... */ }

#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

// WASM için bellek ayırma fonksiyonu (JS'den çağrılacak)
#[wasm_bindgen]
pub fn wasm_alloc(size: usize) -> *mut u8 {
    let mut buf = Vec::with_capacity(size);
    let ptr = buf.as_mut_ptr();
    core::mem::forget(buf); // Rust'ın bu belleği drop etmesini engelle
    ptr
}

// WASM belleğini serbest bırakma fonksiyonu (JS'den çağrılacak)
#[wasm_bindgen]
pub fn wasm_dealloc(ptr: *mut u8, size: usize) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, size);
    }
}

#[wasm_bindgen]
pub fn generate_aes_key_wasm() -> js_sys::Uint8Array { // Çalışıyor
    let mut key_bytes = [0u8; 32];
    RandOsRng.fill_bytes(&mut key_bytes);
    js_sys::Uint8Array::from(&key_bytes[..])
}

#[wasm_bindgen]
pub fn encrypt_data_wasm(
    key_ptr: *const u8, key_len: usize,
    plaintext_ptr: *const u8, plaintext_len: usize
) -> JsValue {
    // Hata oluşursa bu fonksiyonun JsValue::from_str ile hata döndürebilmesi için
    // tüm bloğu bir closure içine alıp sonra sonucu map edebiliriz veya her ? sonrası map_err.
    // Şimdilik basitçe ilerleyelim ve ? operatörünün çalışacağını varsayalım,
    // çünkü fonksiyonun genel dönüş tipi zaten JsValue (hata durumunda string içeren).

    let key_bytes: &[u8] = unsafe { slice::from_raw_parts(key_ptr, key_len) };
    let plaintext: &[u8] = unsafe { slice::from_raw_parts(plaintext_ptr, plaintext_len) };

    let key_obj = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(&key_obj);

    let mut nonce_bytes = [0u8; 12];
    AeadOsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    match cipher.encrypt(nonce, plaintext) {
        Ok(ciphertext_vec) => {
            let result_obj = js_sys::Object::new();

            // Reflect::set, Result<bool, JsValue> döndürür.
            // Hata durumunda, ? operatörü JsValue(hata) döndürerek fonksiyondan çıkacak.
            // Bu JsValue, aşağıdaki Err(e) bloğundaki gibi JsValue::from_str ile oluşturulmuş bir string olacak.
            // Eğer başarılıysa (Ok(true)), devam edecek.
            if js_sys::Reflect::set(&result_obj, &JsValue::from_str("nonce"), &js_sys::Uint8Array::from(nonce.as_slice()).into()).is_err() {
                return JsValue::from_str("Failed to set nonce property");
            }
            if js_sys::Reflect::set(&result_obj, &JsValue::from_str("ciphertext"), &js_sys::Uint8Array::from(ciphertext_vec.as_slice()).into()).is_err() {
                return JsValue::from_str("Failed to set ciphertext property");
            }

            result_obj.into()
        }
        Err(e) => JsValue::from_str(&format!("Encryption error (AES): {:?}", e)), // AES hatası
    }
}

#[wasm_bindgen]
pub fn decrypt_data_wasm(
    key_ptr: *const u8, key_len: usize,
    ciphertext_ptr: *const u8, ciphertext_len: usize,
    nonce_ptr: *const u8, nonce_len: usize
) -> JsValue { // DÖNÜŞ TİPİ JsValue
    // Pointer ve length'lerden slice oluştur (UNSAFE blok içinde)
    let key_bytes: &[u8] = unsafe { slice::from_raw_parts(key_ptr, key_len) };
    let ciphertext: &[u8] = unsafe { slice::from_raw_parts(ciphertext_ptr, ciphertext_len) };
    let nonce_bytes: &[u8] = unsafe { slice::from_raw_parts(nonce_ptr, nonce_len) };

    let key_obj = Key::<Aes256Gcm>::from_slice(key_bytes);
    let cipher = Aes256Gcm::new(&key_obj); // Key objesini referansla al
    let nonce = Nonce::from_slice(nonce_bytes);

    match cipher.decrypt(nonce, ciphertext) {
        Ok(plaintext_vec) => {
            // Başarılı durumda plaintext_vec (Vec<u8>) bir js_sys::Uint8Array'e dönüştürülüp JsValue olarak döndürülür.
            js_sys::Uint8Array::from(plaintext_vec.as_slice()).into()
        }
        Err(e) => {
            // Hata durumunda hatayı string olarak içeren bir JsValue döndür
            JsValue::from_str(&format!("Decryption error (AES): {:?}", e))
        }
    }
}










