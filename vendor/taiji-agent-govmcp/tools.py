"""
政务工具集
提供常见政务场景的工具函数
"""

from __future__ import annotations

import datetime
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class DocumentType(Enum):
    """公文类型"""
    NOTICE = "notice"           # 通知
    REPORT = "report"           # 报告
    DECISION = "decision"       # 决定
    GUIDANCE = "guidance"       # 意见
    FORM = "form"               # 表单


@dataclass
class DocumentInfo:
    """公文信息"""
    doc_type: DocumentType
    title: str
    content: str
    issuer: str
    issue_date: datetime.date
    document_number: str = ""
    urgency: str = "normal"
    classification: str = "internal"


class DocumentHelper:
    """公文辅助工具"""

    @staticmethod
    def validate_document_number(doc_num: str) -> bool:
        """验证公文文号"""
        pattern = r'^[A-Z]{2}〔\d{4}〕\d+号$'
        return bool(re.match(pattern, doc_num))

    @staticmethod
    def extract_document_info(text: str) -> dict:
        """从文本中提取公文信息"""
        info = {}
        
        # 提取标题
        title_match = re.search(r'^# (.+)$', text, re.MULTILINE)
        if title_match:
            info['title'] = title_match.group(1)
        
        # 提取文号
        doc_num_match = re.search(r'[A-Z]{2}〔\d{4}〕\d+号', text)
        if doc_num_match:
            info['document_number'] = doc_num_match.group(0)
        
        # 提取日期
        date_match = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日', text)
        if date_match:
            try:
                info['issue_date'] = datetime.date(
                    int(date_match.group(1)),
                    int(date_match.group(2)),
                    int(date_match.group(3)),
                )
            except ValueError:
                pass
        
        return info

    @staticmethod
    def generate_document_number(
        prefix: str,
        year: int,
        serial: int,
    ) -> str:
        """生成公文文号"""
        return f"{prefix}〔{year}〕{serial}号"

    @staticmethod
    def format_document(doc: DocumentInfo) -> str:
        """格式化公文"""
        lines = []
        
        lines.append(f"# {doc.title}")
        lines.append("")
        
        if doc.document_number:
            lines.append(doc.document_number)
            lines.append("")
        
        lines.append(f"发文单位：{doc.issuer}")
        lines.append(f"发文日期：{doc.issue_date.strftime('%Y年%m月%d日')}")
        
        if doc.urgency != "normal":
            lines.append(f"紧急程度：{doc.urgency}")
        
        if doc.classification != "internal":
            lines.append(f"密级：{doc.classification}")
        
        lines.append("")
        lines.append(doc.content)
        
        return "\n".join(lines)


class PolicyHelper:
    """政策工具"""

    @staticmethod
    def extract_keywords(text: str) -> list[str]:
        """提取政策关键词（简化实现）"""
        keywords = [
            "审批", "备案", "核准", "许可", "处罚",
            "扶持", "补贴", "奖励", "优惠", "减免",
            "规范", "要求", "标准", "规定", "办法",
        ]
        
        found = []
        for keyword in keywords:
            if keyword in text:
                found.append(keyword)
        
        return found

    @staticmethod
    def summarize_policy(text: str, max_length: int = 200) -> str:
        """政策摘要"""
        if len(text) <= max_length:
            return text
        
        # 简单的首段+末段摘要
        paragraphs = text.split("\n\n")
        if len(paragraphs) >= 2:
            summary = f"{paragraphs[0]}\n\n...\n\n{paragraphs[-1]}"
            if len(summary) <= max_length:
                return summary
        
        return text[:max_length] + "..."


class AddressHelper:
    """地址工具"""

    @staticmethod
    def validate_address(address: str) -> bool:
        """验证地址格式"""
        has_province = any(
            p in address
            for p in ["省", "市", "自治区", "直辖市"]
        )
        return has_province

    @staticmethod
    def split_address(address: str) -> dict:
        """地址拆分"""
        result = {
            "province": "",
            "city": "",
            "district": "",
            "street": "",
            "detail": address,
        }
        
        # 简化的地址解析
        province_marks = ["省", "自治区", "直辖市"]
        for mark in province_marks:
            if mark in address:
                parts = address.split(mark, 1)
                result["province"] = parts[0] + mark
                address = parts[1]
                break
        
        if "市" in address:
            parts = address.split("市", 1)
            result["city"] = parts[0] + "市"
            address = parts[1]
        
        district_marks = ["区", "县", "市"]
        for mark in district_marks:
            if mark in address:
                parts = address.split(mark, 1)
                result["district"] = parts[0] + mark
                address = parts[1]
                break
        
        result["street"] = address
        
        return result


class IDNumberHelper:
    """身份证工具"""

    @staticmethod
    def validate_id_number(id_num: str) -> bool:
        """验证身份证号"""
        if len(id_num) != 18:
            return False
        
        if not id_num[:17].isdigit():
            return False
        
        # 校验码验证
        weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
        check_codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
        
        total = sum(
            int(id_num[i]) * weights[i]
            for i in range(17)
        )
        
        check_code = check_codes[total % 11]
        
        return id_num[17].upper() == check_code

    @staticmethod
    def extract_birthday(id_num: str) -> Optional[datetime.date]:
        """提取生日"""
        if len(id_num) != 18:
            return None
        
        try:
            year = int(id_num[6:10])
            month = int(id_num[10:12])
            day = int(id_num[12:14])
            
            return datetime.date(year, month, day)
        except ValueError:
            return None

    @staticmethod
    def mask_id_number(id_num: str) -> str:
        """身份证号脱敏"""
        if len(id_num) == 18:
            return f"{id_num[:6]}********{id_num[-4:]}"
        elif len(id_num) == 15:
            return f"{id_num[:6]}*****{id_num[-3:]}"
        return id_num


class SocialCreditCodeHelper:
    """统一社会信用代码工具"""

    @staticmethod
    def validate_credit_code(code: str) -> bool:
        """验证统一社会信用代码"""
        if len(code) != 18:
            return False
        
        # 简化验证
        if not re.match(r'^[0-9A-Z]{18}$', code):
            return False
        
        return True

    @staticmethod
    def parse_credit_code(code: str) -> dict:
        """解析统一社会信用代码"""
        if len(code) != 18:
            return {}
        
        return {
            "registration_authority": code[0],
            "category": code[1],
            "administrative_division": code[2:8],
            "organization_code": code[8:17],
            "check_digit": code[17],
        }


class DataMasking:
    """数据脱敏工具"""

    @staticmethod
    def mask_phone(phone: str) -> str:
        """手机号脱敏"""
        if len(phone) == 11:
            return f"{phone[:3]}****{phone[-4:]}"
        return phone

    @staticmethod
    def mask_email(email: str) -> str:
        """邮箱脱敏"""
        if '@' in email:
            name, domain = email.split('@', 1)
            if len(name) > 2:
                return f"{name[0]}***{name[-1]}@{domain}"
            return f"***@{domain}"
        return email

    @staticmethod
    def mask_bank_account(account: str) -> str:
        """银行卡号脱敏"""
        if len(account) >= 16:
            return f"{account[:4]}{'*' * (len(account) - 8)}{account[-4:]}"
        return account


class CalendarHelper:
    """工作日计算工具"""

    # 简化的节假日列表
    HOLIDAYS = {
        "元旦": ["01-01"],
        "春节": ["02-10", "02-11", "02-12", "02-13", "02-14", "02-15", "02-16"],
        "清明节": ["04-04", "04-05", "04-06"],
        "劳动节": ["05-01", "05-02", "05-03", "05-04", "05-05"],
        "端午节": ["06-20", "06-21", "06-22"],
        "中秋节": ["09-19", "09-20", "09-21"],
        "国庆节": ["10-01", "10-02", "10-03", "10-04", "10-05", "10-06", "10-07"],
    }

    @classmethod
    def is_workday(cls, date: datetime.date) -> bool:
        """判断是否为工作日"""
        if date.weekday() >= 5:  # 周六、周日
            return False
        
        date_str = date.strftime("%m-%d")
        for holiday in cls.HOLIDAYS.values():
            if date_str in holiday:
                return False
        
        return True

    @classmethod
    def add_workdays(cls, date: datetime.date, days: int) -> datetime.date:
        """计算加上工作日后的日期"""
        current_date = date
        remaining = days
        
        while remaining > 0:
            current_date += datetime.timedelta(days=1)
            if cls.is_workday(current_date):
                remaining -= 1
        
        return current_date

    @classmethod
    def calculate_workdays(cls, start: datetime.date, end: datetime.date) -> int:
        """计算工作日天数"""
        count = 0
        current = start
        
        while current <= end:
            if cls.is_workday(current):
                count += 1
            current += datetime.timedelta(days=1)
        
        return count


class FileHelper:
    """文件工具"""

    ALLOWED_EXTENSIONS = [
        ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".pdf", ".txt", ".jpg", ".jpeg", ".png",
    ]

    @classmethod
    def validate_file_extension(cls, filename: str) -> bool:
        """验证文件扩展名"""
        import os
        ext = os.path.splitext(filename)[1].lower()
        return ext in cls.ALLOWED_EXTENSIONS

    @classmethod
    def get_file_size_mb(cls, file_path: str) -> float:
        """获取文件大小（MB）"""
        import os
        if os.path.exists(file_path):
            return os.path.getsize(file_path) / (1024 * 1024)
        return 0.0


class GovTools:
    """政务工具集"""

    document = DocumentHelper()
    policy = PolicyHelper()
    address = AddressHelper()
    id_number = IDNumberHelper()
    credit_code = SocialCreditCodeHelper()
    masking = DataMasking()
    calendar = CalendarHelper()
    file = FileHelper()


__all__ = [
    "DocumentType",
    "DocumentInfo",
    "DocumentHelper",
    "PolicyHelper",
    "AddressHelper",
    "IDNumberHelper",
    "SocialCreditCodeHelper",
    "DataMasking",
    "CalendarHelper",
    "FileHelper",
    "GovTools",
]
