#!/usr/bin/env python3
"""
诊断浏览器 404 问题
"""
import os
import sys
import json

print("-" * 60)
print("  🧪 诊断页面加载与网络请求")
print("-" * 60)

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright 未安装，尝试安装...")
    import subprocess
    subprocess.run([sys.executable, "-m", "pip", "install", "playwright"], check=True)
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"], check=True)
    from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()
    
    # 监听所有请求和响应
    requests = []
    responses = []
    console_messages = []
    
    def log_request(req):
        requests.append({
            "url": req.url,
            "method": req.method,
            "resource_type": req.resource_type,
            "timestamp": req.timestamp
        })
        print(f"[{req.method}] {req.url}")
    
    def log_response(resp):
        responses.append({
            "url": resp.url,
            "status": resp.status,
            "status_text": resp.status_text,
            "ok": resp.ok
        })
        if not resp.ok:
            print(f"✗ [{resp.status}] {resp.url}")
    
    def log_console(msg):
        console_messages.append({
            "type": msg.type,
            "text": msg.text,
            "args": [str(a) for a in msg.args]
        })
        print(f"[console.{msg.type}] {msg.text}")
    
    page.on("request", log_request)
    page.on("response", log_response)
    page.on("console", log_console)
    
    print("\n正在打开页面 http://localhost:5173 ...\n")
    page.goto("http://localhost:5173")
    page.wait_for_load_state("networkidle", timeout=30000)
    
    print("\n" + "=" * 60)
    print("  📊 结果汇总")
    print("=" * 60)
    
    print(f"\n总请求数: {len(requests)}")
    print(f"成功响应: {len([r for r in responses if r['ok']])}")
    print(f"失败响应: {len([r for r in responses if not r['ok']])}")
    
    errors = [r for r in responses if not r['ok']]
    if errors:
        print("\n❌ 失败的请求:")
        for err in errors:
            print(f"  • [{err['status']}] {err['url']}")
    
    print("\n" + "=" * 60)
    print("  📝 原始数据")
    print("=" * 60)
    
    output = {
        "requests": requests,
        "responses": responses,
        "console": console_messages
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    
    print("\n" + "=" * 60)
    print("  📸 截图已保存到 /tmp/ecomind-diagnosis.png")
    page.screenshot(path="/tmp/ecomind-diagnosis.png", full_page=True)
    
    print("\n等待 5 秒后关闭浏览器...")
    import time
    time.sleep(5)
    
    browser.close()
