// src/main.rs
mod encryption;

use encryption::{decrypt_data as decrypt_original_data, encrypt_data as encrypt_original_data, generate_aes_key};
use aes_gcm::Key;
use aes_gcm::Aes256Gcm;
use anyhow::{anyhow, Result, Context};
use std::env;
use dotenv::dotenv;
// use chrono::Utc; // Artık kullanılmıyor
use std::process::Command;
use std::path::{Path, PathBuf};
use serde::{Serialize, Deserialize};
use base64::{engine::general_purpose::STANDARD, Engine as _};
use hex;
use reqwest;
use std::fs;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct LitEncryptedAesKeyPacket {
    lit_ciphertext: String,
    lit_data_hash: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FinalArweavePacket {
    original_file_name: String,
    original_data_nonce: String,
    original_data_ciphertext: String,
    lit_protected_aes_key: LitEncryptedAesKeyPacket,
}

const TEST_FILE_PATH: &str = "test_data/test_image.png"; 
const DECRYPTED_FILE_NAME_PREFIX: &str = "decrypted_";

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();

    let user_eth_address = env::var("TEST_ETH_ADDRESS")?;
    let arweave_keyfile_path_str = env::var("ARWEAVE_KEYFILE_PATH")?;
    println!("Kullanılacak Ethereum Adresi: {}", user_eth_address);
    println!("Kullanılacak Arweave Anahtar Dosyası: {}", arweave_keyfile_path_str);

    let test_file_path = Path::new(TEST_FILE_PATH);
    if !test_file_path.exists() {
        return Err(anyhow!("Test dosyası bulunamadı: {}", TEST_FILE_PATH));
    }
    println!("Kullanılacak Test Dosyası: {}", TEST_FILE_PATH);

    // Adım 1: AES Anahtarını Lit Protocol ile Şifreleme
    println!("\n--- Adım 1: AES Anahtarını Lit Protocol ile Şifreleme ---");
    let aes_key_for_lit_object: Key<Aes256Gcm> = generate_aes_key();
    let aes_key_hex_to_encrypt = hex::encode(aes_key_for_lit_object.as_slice());

    let mut lit_script_base_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    lit_script_base_path.push("key_manager_lit");

    let encrypt_script_full_path = lit_script_base_path.join("encrypt_string.js");
    let lit_encrypt_command_output = Command::new("node")
        .arg(&encrypt_script_full_path)
        .arg(&aes_key_hex_to_encrypt)
        .arg(&user_eth_address)
        .current_dir(&lit_script_base_path)
        .output()
        .with_context(|| format!("Lit şifreleme betiği ({:?}) çalıştırılamadı.", encrypt_script_full_path))?;

    let lit_key_packet_for_final_packet: LitEncryptedAesKeyPacket;
    if !lit_encrypt_command_output.stderr.is_empty() {
        eprintln!("   Lit Encrypt Script (stderr):\n{}", String::from_utf8_lossy(&lit_encrypt_command_output.stderr).trim_end());
    }
    if lit_encrypt_command_output.status.success() {
        let stdout_str = String::from_utf8(lit_encrypt_command_output.stdout).context("Lit şifreleme stdout'u UTF-8 değil.")?;
        let trimmed_stdout = stdout_str.trim();
        if trimmed_stdout.is_empty() { return Err(anyhow!("Lit şifreleme stdout boş.")); }
        lit_key_packet_for_final_packet = serde_json::from_str(trimmed_stdout)?;
        println!("   ✅ Lit ile AES anahtarı şifrelendi.");
    } else {
        let exit_code = lit_encrypt_command_output.status.code().unwrap_or(-1);
        if !lit_encrypt_command_output.stdout.is_empty() {
            eprintln!("   Lit Encrypt Script stdout (başarısız durumda):\n{}", String::from_utf8_lossy(&lit_encrypt_command_output.stdout).trim_end());
        }
        return Err(anyhow!("Lit şifreleme betiği başarısız oldu (exit code: {}).", exit_code));
    }

    // Adım 2: Orijinal Dosyayı Şifreleme
    println!("\n--- Adım 2: Orijinal Dosyayı Şifreleme ---");
    let original_file_bytes = fs::read(test_file_path)?;
    println!("   Orijinal dosya boyutu: {} bytes", original_file_bytes.len());
    let (encrypted_file_data, original_nonce_vec) = encrypt_original_data(&aes_key_for_lit_object, &original_file_bytes)
        .map_err(|e| anyhow!("Orijinal dosya şifreleme hatası: {}", e))?;
    println!("   Orijinal dosya şifrelendi (Şifreli boyut: {} bytes)", encrypted_file_data.len());

    let final_packet_to_upload = FinalArweavePacket {
        original_file_name: test_file_path.file_name().unwrap_or_default().to_string_lossy().into_owned(),
        original_data_nonce: STANDARD.encode(&original_nonce_vec),
        original_data_ciphertext: STANDARD.encode(&encrypted_file_data),
        lit_protected_aes_key: lit_key_packet_for_final_packet.clone(),
    };
    let json_payload_for_arweave = serde_json::to_string_pretty(&final_packet_to_upload)?;

    let temp_payload_file_name = "temp_arweave_payload.json";
    let temp_payload_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join(temp_payload_file_name);
    fs::write(&temp_payload_path, &json_payload_for_arweave)?;

    // Adım 3: Arweave'e Yükleme
    println!("\n--- Adım 3: Arweave'e Yükleme ---");
    let mut arweave_script_base_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    arweave_script_base_path.push("arweave_uploader");
    let upload_script_full_path = arweave_script_base_path.join("upload.js");

    let arweave_upload_output = Command::new("node")
        .arg(&upload_script_full_path)
        .arg(&temp_payload_path)
        .arg(&arweave_keyfile_path_str)
        .current_dir(&arweave_script_base_path)
        .output().with_context(|| format!("Arweave yükleme betiği çalıştırılamadı: {:?}", upload_script_full_path))?;

    let arweave_tx_id: String;
    if !arweave_upload_output.stderr.is_empty() {
        eprintln!("   Arweave Upload Script (stderr):\n{}", String::from_utf8_lossy(&arweave_upload_output.stderr).trim_end());
    }
    if arweave_upload_output.status.success() {
        let stdout_str = String::from_utf8(arweave_upload_output.stdout)?;
        arweave_tx_id = stdout_str.trim().to_string();
        if arweave_tx_id.is_empty() { return Err(anyhow!("Arweave TX ID boş döndü.")); }
        println!("   ✅ Veri Arweave'e yüklendi. TX ID: {}", arweave_tx_id);
    } else {
        let _ = fs::remove_file(&temp_payload_path);
        return Err(anyhow!("Arweave yükleme betiği başarısız oldu."));
    }
    fs::remove_file(&temp_payload_path)?;

    // Adım 4: Arweave'den Veri Çekme
    println!("\n--- Adım 4: Arweave'den Veri Çekme ---");
    let arweave_gw_url = format!("http://localhost:1984/{}", arweave_tx_id);
    let client = reqwest::Client::new();
    let response = client.get(&arweave_gw_url).send().await?;
    if !response.status().is_success() {
        return Err(anyhow!("Arweave'den veri çekme başarısız. Status: {}", response.status()));
    }
    let received_json_payload_from_arweave = response.text().await?;
    let received_packet_from_arweave: FinalArweavePacket = serde_json::from_str(&received_json_payload_from_arweave)
        .with_context(|| format!("Arweave'den çekilen veri parse edilemedi. Alınan (kısmi): '{}'", received_json_payload_from_arweave.chars().take(100).collect::<String>()))?;

    println!("   ✅ Arweave'den veri çekildi: {}", received_packet_from_arweave.original_file_name);

    // Adım 5: Lit ile AES Anahtarını Geri Çözme
    println!("\n--- Adım 5: Lit ile AES Anahtarını Geri Çözme ---");
    let decrypt_script_full_path = lit_script_base_path.join("decrypt_string.js");
    let lit_decrypt_command_output = Command::new("node")
        .arg(&decrypt_script_full_path)
        .arg(&received_packet_from_arweave.lit_protected_aes_key.lit_ciphertext)
        .arg(&received_packet_from_arweave.lit_protected_aes_key.lit_data_hash)
        .arg(&user_eth_address)
        .current_dir(&lit_script_base_path)
        .output().with_context(|| format!("Lit şifre çözme betiği çalıştırılamadı: {:?}", decrypt_script_full_path))?;

    let decrypted_aes_key_bytes: Vec<u8>;
    if !lit_decrypt_command_output.stderr.is_empty() {
        eprintln!("   Lit Decrypt Script (stderr):\n{}", String::from_utf8_lossy(&lit_decrypt_command_output.stderr).trim_end());
    }

    if lit_decrypt_command_output.status.success() {
        let stdout_full_str = String::from_utf8(lit_decrypt_command_output.stdout)?;
        let decrypted_aes_key_hex = stdout_full_str.trim().lines().last().unwrap_or("").trim();
        if decrypted_aes_key_hex.is_empty() { return Err(anyhow!("Lit şifre çözme stdout'u boş.")); }
        decrypted_aes_key_bytes = hex::decode(decrypted_aes_key_hex)?;
        println!("   ✅ Lit ile AES anahtarı çözüldü ({} byte).", decrypted_aes_key_bytes.len());
    } else {
        let exit_code = lit_decrypt_command_output.status.code().unwrap_or(-1);
        if !lit_decrypt_command_output.stdout.is_empty() {
            eprintln!("   Lit Decrypt Script stdout (başarısız durumda):\n{}", String::from_utf8_lossy(&lit_decrypt_command_output.stdout).trim_end());
        }
        return Err(anyhow!("Lit şifre çözme betiği başarısız oldu (exit code: {}).", exit_code));
    }

    // Adım 6: Orijinal Dosyayı Çözme ve Doğrulama
    println!("\n--- Adım 6: Orijinal Dosyayı Çözme ve Doğrulama ---");
    let recovered_aes_key = Key::<Aes256Gcm>::from_slice(&decrypted_aes_key_bytes);
    let received_original_nonce_bytes = STANDARD.decode(&received_packet_from_arweave.original_data_nonce)?;
    let encrypted_file_data_from_arweave = STANDARD.decode(&received_packet_from_arweave.original_data_ciphertext)?;

    let decrypted_file_data_vec = decrypt_original_data(recovered_aes_key, &encrypted_file_data_from_arweave, &received_original_nonce_bytes)
        .map_err(|e| anyhow!("Orijinal dosya şifre çözme hatası: {}", e))?;
    println!("   Çözülen dosya verisi boyutu: {} bytes", decrypted_file_data_vec.len());

    // ---- DOSYA ADINI DİNAMİK OLARAK OLUŞTURMA ----
    let base_filename = format!("{}{}", DECRYPTED_FILE_NAME_PREFIX, received_packet_from_arweave.original_file_name);
    let path_obj = Path::new(&base_filename);
    let mut counter = 0;
    let mut final_decrypted_filename = PathBuf::from(&base_filename);

    // Dosya adının kökünü ve uzantısını al
    let stem = path_obj.file_stem().unwrap_or_default().to_str().unwrap_or_default();
    let extension = path_obj.extension().unwrap_or_default().to_str().unwrap_or_default();

    while final_decrypted_filename.exists() {
        counter += 1;
        if extension.is_empty() {
            final_decrypted_filename = PathBuf::from(format!("{}_{}", stem, counter));
        } else {
            final_decrypted_filename = PathBuf::from(format!("{}_{}.{}", stem, counter, extension));
        }
    }
    println!("   Çözülen dosya şuraya yazılacak: '{}'", final_decrypted_filename.display());
    // ---- DOSYA ADI OLUŞTURMA SONU ----

    fs::write(&final_decrypted_filename, &decrypted_file_data_vec)?;
    println!("   ✅ Çözülen dosya başarıyla '{}' dosyasına yazıldı.", final_decrypted_filename.display());

    if original_file_bytes.as_slice() == decrypted_file_data_vec.as_slice() {
        println!("   ✅ Orijinal Dosya Verisi Başarıyla Doğrulandı.");
    } else {
        return Err(anyhow!("HATA: Orijinal ve çözülen dosya verisi EŞLEŞMİYOR!"));
    }

    println!("\n🎉🎉🎉 TÜM İŞLEMLER BAŞARIYLA TAMAMLANDI 🎉🎉🎉");
    Ok(())
}