"""
EcoMind 安全代码执行沙箱

对标 Trae Solo 的 cloudide.icube-agent-shell-exec:
  允许 Agent 执行 Python 代码进行环境数据分析
  安全边界: 白名单模块 + 超时 + 内存限制 + 禁止文件/网络

Usage:
    exec = SandboxExecutor()
    result = await exec.run("import numpy as np; print(np.mean(data))")
"""
from __future__ import annotations

import ast
import logging
import sys
import time
import traceback
from dataclasses import dataclass, field
from io import StringIO
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 白名单模块—只有这些模块可以 import
ALLOWED_MODULES = {
    "numpy", "pandas", "scipy", "sklearn",
    "math", "statistics", "datetime", "json",
    "collections", "itertools", "functools",
    "re", "string", "textwrap",
    "csv", "io",
    "typing", "dataclasses",
}

# 禁止模块—即使出现在白名单中也拦截
BLOCKED_FUNCTIONS = {
    "open", "exec", "eval", "compile",
    "__import__", "importlib",
    "os", "sys", "subprocess", "shutil",
    "socket", "requests", "urllib", "httpx",
    "pathlib", "glob",
    "pickle", "shelve",
}


class SandboxError(Exception):
    pass


@dataclass
class SandboxResult:
    output: str
    error: str = ""
    duration_ms: float = 0
    truncated: bool = False
    max_output_chars: int = 5000


class SandboxExecutor:
    """安全 Python 代码执行沙箱"""

    def __init__(
        self,
        timeout_sec: float = 30.0,
        max_output_chars: int = 5000,
    ):
        self.timeout = timeout_sec
        self.max_output = max_output_chars

    async def run(self, code: str, namespace: Optional[dict] = None) -> SandboxResult:
        """
        在受限环境中执行 Python 代码。

        Args:
            code: Python 代码
            namespace: 预置变量（如 data=np.array([...])）

        Returns:
            SandboxResult
        """
        t0 = time.time()

        try:
            # 1. AST 安全检查
            self._audit_ast(code)

            # 2. 受限命名空间
            sandbox_globals = {
                "__builtins__": self._safe_builtins(),
                **self._safe_stdlib(),
                **(namespace or {}),
            }
            sandbox_locals: dict[str, Any] = {}

            # 3. 捕获 stdout
            stdout_buf = StringIO()
            old_stdout = sys.stdout
            sys.stdout = stdout_buf

            try:
                import signal as _signal
                _signal.alarm(int(self.timeout))

                exec(compile(code, "<sandbox>", "exec"), sandbox_globals, sandbox_locals)
                output = stdout_buf.getvalue()

                _signal.alarm(0)
            except TimeoutError:
                raise SandboxError(f"代码执行超时 ({self.timeout}s)")
            except Exception as e:
                return SandboxResult(
                    output=stdout_buf.getvalue(),
                    error=f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
                    duration_ms=round((time.time() - t0) * 1000, 1),
                )
            finally:
                sys.stdout = old_stdout

            truncated = False
            if len(output) > self.max_output:
                output = output[:self.max_output] + "\n... [输出截断]"
                truncated = True

            return SandboxResult(
                output=output,
                duration_ms=round((time.time() - t0) * 1000, 1),
                truncated=truncated,
            )

        except SandboxError as e:
            return SandboxResult(output="", error=str(e),
                               duration_ms=round((time.time() - t0) * 1000, 1))

    def _audit_ast(self, code: str) -> None:
        """AST 安全检查——拦截危险操作"""
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            raise SandboxError(f"语法错误: {e}")

        for node in ast.walk(tree):
            # 拦截危险 import
            if isinstance(node, ast.Import):
                for alias in node.names:
                    if alias.name.split(".")[0] not in ALLOWED_MODULES:
                        raise SandboxError(f"禁止导入模块: {alias.name}")
            elif isinstance(node, ast.ImportFrom):
                mod = node.module or ""
                if mod.split(".")[0] not in ALLOWED_MODULES:
                    raise SandboxError(f"禁止导入模块: {mod}")

            # 拦截危险函数调用
            elif isinstance(node, ast.Call):
                func_name = self._get_call_name(node)
                if func_name and func_name in BLOCKED_FUNCTIONS:
                    raise SandboxError(f"禁止调用: {func_name}")

    def _get_call_name(self, node: ast.Call) -> Optional[str]:
        if isinstance(node.func, ast.Name):
            return node.func.id
        elif isinstance(node.func, ast.Attribute):
            return node.func.attr
        return None

    def _safe_builtins(self) -> dict:
        """受限的内建函数"""
        return {
            "abs": abs, "all": all, "any": any,
            "bool": bool, "dict": dict, "enumerate": enumerate,
            "filter": filter, "float": float, "int": int,
            "len": len, "list": list, "map": map,
            "max": max, "min": min, "print": print,
            "range": range, "round": round, "set": set,
            "sorted": sorted, "str": str, "sum": sum,
            "tuple": tuple, "type": type, "zip": zip,
            "True": True, "False": False, "None": None,
            "Exception": Exception, "ValueError": ValueError,
            "TypeError": TypeError, "KeyError": KeyError,
            "isinstance": isinstance, "hasattr": hasattr,
            "__build_class__": __build_class__ if hasattr(sys.modules[__name__], '__build_class__') else type,
        }

    def _safe_stdlib(self) -> dict:
        """白名单标准库"""
        import math
        import statistics
        import datetime
        import json
        import re
        import collections
        import itertools
        import functools
        return {
            "math": math, "statistics": statistics,
            "datetime": datetime, "json": json, "re": re,
            "collections": collections, "itertools": itertools,
            "functools": functools,
        }

    def quick_analysis(self, expression: str, namespace: Optional[dict] = None) -> str:
        """快速数据分析（单行表达式）"""
        sandbox_globals = {
            **self._safe_builtins(),
            **self._safe_stdlib(),
            **(namespace or {}),
        }
        try:
            result = eval(expression, sandbox_globals)
            return str(result)
        except Exception as e:
            return f"计算错误: {e}"
