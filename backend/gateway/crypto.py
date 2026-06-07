"""
EcoMind 网关加密工具 — 企微/微信消息加解密

企业微信 / 微信公众号使用 AES-256-CBC 加密回调消息。
"""
from __future__ import annotations

import base64
import hashlib
import random
import string
import struct
from Crypto.Cipher import AES


def wecom_decrypt_echostr(
    token: str,
    encoding_aes_key: str,
    corp_id: str,
    msg_signature: str,
    timestamp: str,
    nonce: str,
    echostr: str,
) -> str:
    """
    企业微信 URL 验证——解密 echostr。

    Args:
        token: 企业微信后台配置的 Token
        encoding_aes_key: 43位 EncodingAESKey
        corp_id: 企业 Corp ID
        msg_signature: 消息签名
        timestamp: 时间戳
        nonce: 随机数
        echostr: 加密的 echostr

    Returns:
        解密后的明文
    """
    # 1. 验证签名
    tmp_list = sorted([token, timestamp, nonce, echostr])
    tmp_str = "".join(tmp_list)
    expected_sig = hashlib.sha1(tmp_str.encode()).hexdigest()
    if msg_signature != expected_sig:
        raise ValueError(f"企微签名验证失败")

    # 2. Base64 解码 AES Key
    aes_key = base64.b64decode(encoding_aes_key + "=")

    # 3. 解密
    cipher = AES.new(aes_key, AES.MODE_CBC, iv=aes_key[:16])
    decrypted = cipher.decrypt(base64.b64decode(echostr))

    # 4. 去 PKCS7 padding
    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]

    # 5. 去掉前 16 字节随机数 + 4 字节 msg_len
    content = decrypted[16 + 4:]
    return content.decode("utf-8")


def wecom_decrypt_msg(
    token: str,
    encoding_aes_key: str,
    corp_id: str,
    msg_signature: str,
    timestamp: str,
    nonce: str,
    encrypted_msg: str,
) -> tuple[str, str]:
    """
    解密企业微信回调消息体。

    Returns:
        (明文消息, receive_id)
    """
    aes_key = base64.b64decode(encoding_aes_key + "=")
    cipher = AES.new(aes_key, AES.MODE_CBC, iv=aes_key[:16])
    decrypted = cipher.decrypt(base64.b64decode(encrypted_msg))

    pad_len = decrypted[-1]
    decrypted = decrypted[:-pad_len]

    random_bytes = decrypted[:16]
    msg_len = struct.unpack(">I", decrypted[16:20])[0]
    plaintext = decrypted[20:20 + msg_len].decode("utf-8")
    receive_id = decrypted[20 + msg_len:].decode("utf-8")

    return plaintext, receive_id


def wecom_encrypt_msg(
    token: str,
    encoding_aes_key: str,
    corp_id: str,
    plaintext: str,
    nonce: str = "",
    timestamp: str = "",
) -> dict[str, str]:
    """
    加密企业微信回复消息。

    Returns:
        {"encrypt": ..., "msgsignature": ..., "timestamp": ..., "nonce": ...}
    """
    import time as _time
    nonce = nonce or "".join(random.choices(string.digits, k=10))
    timestamp = timestamp or str(int(_time.time()))

    # PKCS7 pad
    block_size = 32
    pad_len = block_size - len(plaintext.encode()) % block_size
    padded = plaintext + chr(pad_len) * pad_len

    random_bytes = "".join(random.choices(string.ascii_letters, k=16))
    msg_len = struct.pack(">I", len(plaintext.encode()))
    to_encrypt = (random_bytes + msg_len.decode("latin-1") + plaintext + corp_id).encode()

    aes_key = base64.b64decode(encoding_aes_key + "=")
    cipher = AES.new(aes_key, AES.MODE_CBC, iv=aes_key[:16])
    encrypted = base64.b64encode(cipher.encrypt(to_encrypt)).decode()

    tmp_list = sorted([token, timestamp, nonce, encrypted])
    signature = hashlib.sha1("".join(tmp_list).encode()).hexdigest()

    return {
        "encrypt": encrypted,
        "msgsignature": signature,
        "timestamp": timestamp,
        "nonce": nonce,
    }
