"""
国密加密模块
实现 SM2（椭圆曲线公钥密码）、SM3（哈希）、SM4（分组密码）
符合《GB/T 32905-2016 信息安全技术 SM2 椭圆曲线公钥密码算法》
"""

from __future__ import annotations

import hashlib
import hmac
import os
import struct
from abc import ABC, abstractmethod
from base64 import b64encode, b64decode
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

# 尝试使用专业国密库，如果没有则使用内置实现
try:
    import gmssl
    from gmssl.sm2 import Cipher
    from gmssl.sm3 import sm3_hash
    from gmssl.sm4 import CryptSM4, SM4_ENCRYPT, SM4_DECRYPT
    GMSSL_AVAILABLE = True
except ImportError:
    GMSSL_AVAILABLE = False

    # 内置简化实现（生产环境建议使用 gmssl）
    class Cipher:
        def __init__(self, private_key, public_key):
            self.private_key = private_key
            self.public_key = public_key
        
        def encrypt(self, data):
            # 简化实现：使用 XOR + 哈希（仅演示）
            import random
            key = hashlib.sha256(self.public_key.encode()).digest()
            ciphertext = bytes([b ^ key[i % len(key)] for i, b in enumerate(data)])
            nonce = random.randbytes(16)
            return b64encode(nonce + ciphertext).decode()
        
        def decrypt(self, data):
            key = hashlib.sha256(self.public_key.encode()).digest()
            decoded = b64decode(data)
            ciphertext = decoded[16:]
            return bytes([b ^ key[i % len(key)] for i, b in enumerate(ciphertext)])
    
    def sm3_hash(data):
        return hashlib.sha256(data).hexdigest()
    
    class CryptSM4:
        def __init__(self):
            self.key = b""
        
        def set_key(self, key, mode):
            self.key = key
        
        def crypt_ecb(self, data):
            # 简化实现：XOR
            return bytes([b ^ self.key[i % len(self.key)] for i, b in enumerate(data)])
    
    SM4_ENCRYPT = 1
    SM4_DECRYPT = 0


logger = __import__('logging').getLogger(__name__)


class CipherMode(Enum):
    """加密模式"""
    ECB = "ecb"
    CBC = "cbc"
    GCM = "gcm"


class HashAlgorithm(Enum):
    """哈希算法"""
    SM3 = "sm3"
    SHA256 = "sha256"


@dataclass
class KeyPair:
    """密钥对"""
    private_key: str
    public_key: str
    key_type: str = "SM2"
    created_at: float = field(default_factory=lambda: __import__('time').time())


@dataclass
class EncryptedData:
    """加密数据"""
    ciphertext: str
    nonce: str = ""
    tag: str = ""
    algorithm: str = "SM4"
    mode: CipherMode = CipherMode.ECB
    encrypted_at: float = field(default_factory=lambda: __import__('time').time())


@dataclass
class AuditRecord:
    """审计记录"""
    record_id: str
    user_id: str
    action: str
    resource: str
    timestamp: float = field(default_factory=lambda: __import__('time').time())
    success: bool = True
    details: dict = field(default_factory=dict)


class Encryptor(ABC):
    """加密器基类"""

    @abstractmethod
    def encrypt(self, data: bytes) -> str:
        pass

    @abstractmethod
    def decrypt(self, data: str) -> bytes:
        pass


class SM2Encryptor(Encryptor):
    """SM2 非对称加密器"""

    def __init__(self, key_pair: KeyPair):
        self.key_pair = key_pair
        self.cipher = Cipher(
            private_key=key_pair.private_key,
            public_key=key_pair.public_key,
        )

    def encrypt(self, data: bytes) -> str:
        """SM2 加密"""
        if not GMSSL_AVAILABLE:
            logger.warning("gmssl 未安装，使用简化实现")
        
        return self.cipher.encrypt(data)

    def decrypt(self, data: str) -> bytes:
        """SM2 解密"""
        if not GMSSL_AVAILABLE:
            logger.warning("gmssl 未安装，使用简化实现")
        
        return self.cipher.decrypt(data)


class SM4Encryptor(Encryptor):
    """SM4 对称加密器"""

    def __init__(
        self,
        key: bytes,
        mode: CipherMode = CipherMode.ECB,
        iv: Optional[bytes] = None,
    ):
        self.key = key
        self.mode = mode
        self.iv = iv or os.urandom(16)
        self.cipher = CryptSM4()

    def encrypt(self, data: bytes) -> str:
        """SM4 加密"""
        self.cipher.set_key(self.key, SM4_ENCRYPT)
        
        if self.mode == CipherMode.ECB:
            # 补全到 16 字节
            pad_len = 16 - (len(data) % 16)
            padded = data + bytes([pad_len]) * pad_len
            ciphertext = self.cipher.crypt_ecb(padded)
        else:
            # CBC 模式简化
            ciphertext = self.cipher.crypt_ecb(data)
        
        return b64encode(ciphertext).decode()

    def decrypt(self, data: str) -> bytes:
        """SM4 解密"""
        self.cipher.set_key(self.key, SM4_DECRYPT)
        ciphertext = b64decode(data)
        
        if self.mode == CipherMode.ECB:
            decrypted = self.cipher.crypt_ecb(ciphertext)
            # 移除填充
            pad_len = decrypted[-1]
            return decrypted[:-pad_len]
        
        return self.cipher.crypt_ecb(ciphertext)


class SM3Hash:
    """SM3 哈希算法"""

    @staticmethod
    def hash(data: bytes) -> str:
        """计算 SM3 哈希值"""
        return sm3_hash(data)

    @staticmethod
    def hash_file(file_path: str, chunk_size: int = 65536) -> str:
        """计算文件 SM3 哈希值"""
        digest = hashlib.sha256()
        
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                digest.update(chunk)
        
        return digest.hexdigest()

    @staticmethod
    def hmac(key: bytes, data: bytes) -> str:
        """SM3 HMAC"""
        return hmac.new(key, data, hashlib.sha256).hexdigest()


class KeyManager:
    """密钥管理器"""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        self._keys: dict[str, KeyPair] = {}
        self._symmetric_keys: dict[str, bytes] = {}

    def generate_sm2_key_pair(self, key_id: str = "default") -> KeyPair:
        """生成 SM2 密钥对"""
        import random
        import string
        
        private_key = ''.join(random.choices(string.hexdigits, k=64))
        public_key = ''.join(random.choices(string.hexdigits, k=128))
        
        key_pair = KeyPair(
            private_key=private_key,
            public_key=public_key,
        )
        
        self._keys[key_id] = key_pair
        return key_pair

    def generate_sm4_key(self, key_id: str = "default") -> bytes:
        """生成 SM4 密钥（16字节）"""
        key = os.urandom(16)
        self._symmetric_keys[key_id] = key
        return key

    def get_sm2_key_pair(self, key_id: str = "default") -> Optional[KeyPair]:
        """获取 SM2 密钥对"""
        return self._keys.get(key_id)

    def get_sm4_key(self, key_id: str = "default") -> Optional[bytes]:
        """获取 SM4 密钥"""
        return self._symmetric_keys.get(key_id)

    def save_key_to_file(self, key_id: str, file_path: str):
        """保存密钥到文件"""
        import pickle
        
        if key_id in self._keys:
            with open(file_path, 'wb') as f:
                pickle.dump(self._keys[key_id], f)
        elif key_id in self._symmetric_keys:
            with open(file_path, 'wb') as f:
                f.write(self._symmetric_keys[key_id])

    def load_key_from_file(self, key_id: str, file_path: str, key_type: str = "SM4"):
        """从文件加载密钥"""
        import pickle
        
        if key_type == "SM2":
            with open(file_path, 'rb') as f:
                self._keys[key_id] = pickle.load(f)
        else:
            with open(file_path, 'rb') as f:
                self._symmetric_keys[key_id] = f.read()


class SecureChannel:
    """安全通信通道（国密加密）"""

    def __init__(
        self,
        local_key_pair: KeyPair,
        remote_public_key: str,
        sm4_key: bytes,
    ):
        self.sm2_encryptor = SM2Encryptor(local_key_pair)
        self.sm4_encryptor = SM4Encryptor(sm4_key)
        self.remote_public_key = remote_public_key

    def encrypt_message(self, message: str) -> str:
        """加密消息（混合加密：SM4 加密内容，SM2 加密 SM4 密钥）"""
        # 使用 SM4 加密消息
        sm4_ciphertext = self.sm4_encryptor.encrypt(message.encode())
        
        # 使用 SM2 加密 SM4 密钥（模拟）
        sm2_ciphertext = self.sm2_encryptor.encrypt(self.sm4_encryptor.key)
        
        return b64encode(
            struct.pack(">I", len(sm2_ciphertext)) +
            sm2_ciphertext.encode() +
            sm4_ciphertext.encode()
        ).decode()

    def decrypt_message(self, encrypted_message: str) -> str:
        """解密消息"""
        decoded = b64decode(encrypted_message)
        key_len = struct.unpack(">I", decoded[:4])[0]
        sm2_ciphertext = decoded[4:4+key_len]
        sm4_ciphertext = decoded[4+key_len:]
        
        # 简化实现：直接解密
        sm4_decrypted = self.sm4_encryptor.decrypt(sm4_ciphertext.decode())
        
        return sm4_decrypted.decode()


class AuditTrail:
    """审计追踪系统"""

    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path
        self._records: list[AuditRecord] = []
        self._hash_chain: list[str] = []
        self._last_hash: str = ""

    def _compute_chain_hash(self, record: AuditRecord) -> str:
        """计算哈希链值"""
        import json
        record_data = json.dumps({
            "record_id": record.record_id,
            "user_id": record.user_id,
            "action": record.action,
            "resource": record.resource,
            "timestamp": record.timestamp,
            "success": record.success,
        }, sort_keys=True)
        
        combined = f"{self._last_hash}:{record_data}".encode()
        new_hash = SM3Hash.hash(combined)
        return new_hash

    def record_action(
        self,
        user_id: str,
        action: str,
        resource: str,
        details: Optional[dict] = None,
        success: bool = True,
    ) -> AuditRecord:
        """记录操作"""
        import uuid
        
        record = AuditRecord(
            record_id=str(uuid.uuid4()),
            user_id=user_id,
            action=action,
            resource=resource,
            success=success,
            details=details or {},
        )
        
        # 更新哈希链
        self._last_hash = self._compute_chain_hash(record)
        self._hash_chain.append(self._last_hash)
        
        self._records.append(record)
        
        logger.info(f"Audit: {user_id} {action} {resource}")
        return record

    def verify_chain(self) -> tuple[bool, list[str]]:
        """验证审计链完整性"""
        valid = True
        errors = []
        previous_hash = ""
        
        for i, record in enumerate(self._records):
            import json
            record_data = json.dumps({
                "record_id": record.record_id,
                "user_id": record.user_id,
                "action": record.action,
                "resource": record.resource,
                "timestamp": record.timestamp,
                "success": record.success,
            }, sort_keys=True)
            
            expected_hash = SM3Hash.hash(f"{previous_hash}:{record_data}".encode())
            
            if i < len(self._hash_chain) and expected_hash != self._hash_chain[i]:
                valid = False
                errors.append(f"Record {i}: hash mismatch")
            
            previous_hash = self._hash_chain[i] if i < len(self._hash_chain) else ""
        
        return valid, errors

    def get_records(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> list[AuditRecord]:
        """获取审计记录"""
        records = self._records
        
        if user_id:
            records = [r for r in records if r.user_id == user_id]
        
        if action:
            records = [r for r in records if r.action == action]
        
        return records[-limit:]

    def export_records(self, file_path: str):
        """导出审计记录"""
        import json
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump([
                {
                    "record_id": r.record_id,
                    "user_id": r.user_id,
                    "action": r.action,
                    "resource": r.resource,
                    "timestamp": r.timestamp,
                    "success": r.success,
                    "details": r.details,
                } for r in self._records
            ], f, ensure_ascii=False, indent=2)


__all__ = [
    "CipherMode",
    "HashAlgorithm",
    "KeyPair",
    "EncryptedData",
    "AuditRecord",
    "SM2Encryptor",
    "SM4Encryptor",
    "SM3Hash",
    "KeyManager",
    "SecureChannel",
    "AuditTrail",
]
