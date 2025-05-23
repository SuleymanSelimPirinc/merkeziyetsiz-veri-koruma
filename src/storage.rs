// src/storage.rs

// JSON paketleme için gerekli importlar
use serde::{Serialize, Deserialize};
use base64_crate::{Engine as _, engine::general_purpose::STANDARD as BASE64_STANDARD};
use anyhow::{Result, Context};

#[derive(Serialize, Deserialize, Debug)]
pub struct EncryptedDataPacket {
    nonce: String,
    ciphertext: String,
}

impl EncryptedDataPacket {
    pub fn new(nonce_bytes: &[u8], ciphertext_bytes: &[u8]) -> Self {
        EncryptedDataPacket {
            nonce: BASE64_STANDARD.encode(nonce_bytes),
            ciphertext: BASE64_STANDARD.encode(ciphertext_bytes),
        }
    }
    pub fn to_json_string(&self) -> Result<String> {
        serde_json::to_string(self).context("EncryptedDataPacket JSON'a çevrilemedi")
    }
}

// upload_to_arweave fonksiyonu ve ilgili Arweave/arloader importları tamamen kaldırıldı.
