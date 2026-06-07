#!/usr/bin/env python3
"""
EcoMind OS E2E 文件上传验证测试 v3
==================================
修复: Playwright事件循环冲突 + SPA渲染时序 + API验证分离
"""

import os, sys, time, tempfile, json, subprocess, threading

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

BASE_URL = "http://localhost:5173"
API_URL = "http://localhost:8000"
RESULTS = []

def log_test(name, passed, detail="", elapsed_ms=0):
    RESULTS.append({"name": name, "passed": passed, "detail": detail, "elapsed_ms": elapsed_ms})
    icon = "✅" if passed else "❌"
    print(f"  [{icon}] {name} ({elapsed_ms:.0f}ms)")
    if detail:
        print(f"      └─ {detail}")


def run_api_tests_in_subprocess(test_file):
    """在独立子进程中运行API测试，避免Playwright事件循环冲突"""
    code = f'''
import aiohttp, asyncio, json, sys

async def main():
    r = {{}}
    async with aiohttp.ClientSession() as s:
        form = aiohttp.FormData()
        with open("{test_file}", "rb") as f:
            form.add_field("file", f.read(), filename="e2e_monitor.txt", content_type="text/plain")
        async with s.post("{API_URL}/api/upload", data=form) as resp:
            ud = await resp.json()
            r["upload_status"] = resp.status
            r["file_path"] = ud.get("file_path", "")
            r["is_virtual"] = r["file_path"].startswith("/files/f-")
            r["path_leaked"] = "/tmp/" in r["file_path"] or "ecomind_uploads" in r["file_path"]
        
        fp = r["file_path"]
        if r["is_virtual"]:
            async with s.get("{API_URL}/api/upload/resolve", params={{"virtual_path": fp}}) as resp:
                rd = await resp.json()
                r["resolve_status"] = resp.status
                r["resolve_has_real"] = "real_path" in rd
        
        async with s.get("{API_URL}/api/upload/files") as resp:
            ld = await resp.json()
            r["list_leaked"] = any(
                "/tmp/" in fi.get("path", "") or "ecomind_uploads" in fi.get("path", "")
                for fi in ld.get("files", [])
            )
        
        # Chat test with file path
        msg_body = "[已上传文件1: e2e_monitor.txt | 服务器路径: " + fp + " | 类型: 文本文件]\\n\\n请分析这个环境监测数据，给出空气质量评价和建议"
        payload = {{
            "message": msg_body,
            "expert_id": "ecomind",
            "session_id": "e2e-file-test-001",
            "model": "deepseek-chat",
            "temperature": 0.7,
            "stream": False,
            "conversation_history": [],
        }}
        try:
            async with s.post("{API_URL}/api/chat", json=payload,
                              timeout=aiohttp.ClientTimeout(total=60)) as resp:
                cd = await resp.json()
                r["chat_status"] = resp.status
                content = cd.get("content", "")
                r["chat_content_len"] = len(content)
                r["tools_used"] = cd.get("tools_used", [])
                refuse_pats = ["无法访问","无法查看","没有权限","不能查看","无法直接","没法查看","看不到","桌面上的文件","本地计算机","文件系统"]
                r["refuses"] = [p for p in refuse_pats if p in content]
                substance_kw = ["空气质量","PM2.5","AQI","监测","数据","建议","良好","污染","μg","浓度","评价"]
                r["substances"] = [k for k in substance_kw if k in content]
        except Exception as e:
            r["chat_error"] = str(e)
        
        # C1 security test
        try:
            async with s.post("{API_URL}/api/chat", json={{"message": "", "model": "nonexistent"}}) as resp:
                body = await resp.json()
                r["c1_status"] = resp.status
                bs = json.dumps(body, ensure_ascii=False)[:500]
                leak_pats = ["traceback", "sql ", "exception"]
                r["c1_leaks"] = [p for p in leak_pats if p.lower() in bs.lower()]
                r["c1_has_generic"] = "内部" in bs or "request_id" in bs
                r["c1_has_rid"] = "request_id" in bs
                r["c1_body_preview"] = bs[:150]
        except Exception as e:
            r["c1_error"] = str(e)
    
    print(json.dumps(r, ensure_ascii=False))

asyncio.run(main())
'''
    result = subprocess.run(
        [sys.executable, "-c", code],
        capture_output=True, text=True, timeout=90,
    )
    if result.returncode != 0:
        return {"error": result.stderr, "stdout": result.stdout}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {"raw_stdout": result.stdout, "raw_stderr": result.stderr}


def main():
    print("=" * 60)
    print("  🧪 EcoMind OS 浏览器E2E文件上传验证 v3")
    print("=" * 60)
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        console_logs = []
        network_reqs = []
        network_resps = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))
        page.on("request", lambda req: network_reqs.append({"url": req.url, "method": req.method}))
        page.on("response", lambda resp: network_resps.append({"url": resp.url, "status": resp.status}))
        
        try:
            # Step 1: 打开页面
            print("\n📌 Step 1: 打开聊天页面...")
            t0 = time.time()
            page.goto(BASE_URL, timeout=20000)
            page.wait_for_load_state("networkidle", timeout=20000)
            
            # 等待 React 渲染完成
            page.wait_for_timeout(3000)
            
            log_test("页面加载", True, f"{(time.time()-t0)*1000:.0f}ms")
            page.screenshot(path="/tmp/e2e_01_initial.png", full_page=True)
            
            # Debug: 打印页面上所有 input 元素
            all_inputs = page.evaluate("""() => {
                const inputs = document.querySelectorAll('input');
                return Array.from(inputs).map(el => ({
                    type: el.type,
                    id: el.id,
                    className: el.className.substring(0, 60),
                    hidden: el.hidden || el.offsetParent === null,
                    accept: el.accept,
                }));
            }""")
            log_test("页面input元素数", len(all_inputs) > 0, f"found={len(all_inputs)}")
            for inp in all_inputs:
                print(f"         📋 input[type={inp['type']}] id={inp['id'] or '-'} "
                      f"class={inp['className'][:40]} hidden={inp['hidden']} accept={inp.get('accept','-')}")
            
            # Step 2: 创建测试文件
            print("\n📌 Step 2: 创建测试文件...")
            test_content = """EcoMind OS 环境监测数据报告
=================================
监测站点: 长沙市雨花区环境监测站
监测时间: 2026-05-29 08:00-09:00
AQI: 78 (良)
首要污染物: PM2.5 (45 μg/m³)
PM10: 68 μg/m³
SO2: 8 μg/m³
NO2: 32 μg/m³
CO: 0.8 mg/m³
O3: 98 μg/m³
结论: 空气质量良好，适合户外活动"""
            
            tf = tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False,
                                             prefix="e2e_", encoding="utf-8")
            tf.write(test_content)
            tf.close()
            TEST_FILE = tf.name
            log_test("创建测试文件", True, TEST_FILE)
            
            # Step 3: 文件上传 (浏览器端)
            print("\n📌 Step 3: 浏览器文件上传...")
            t0 = time.time()
            
            file_input = page.locator('input[type="file"]')
            input_count = file_input.count()
            log_test("文件input存在", input_count > 0, f"count={input_count}")
            
            if input_count > 0:
                file_input.set_input_files(TEST_FILE)
                
                # 等待上传完成 — 检查 UI 状态变化或网络请求
                page.wait_for_timeout(5000)
                
                upload_reqs = [r for r in network_reqs if '/api/upload' in r.get('url', '')]
                upload_resps = [r for r in network_resps if '/api/upload' in r.get('url', '')]
                
                log_test("上传请求发出", len(upload_reqs) > 0, f"{len(upload_reqs)}个 /api/upload 请求")
                log_test("上传响应收到", len(upload_resps) > 0, 
                        f"statuses={[r['status'] for r in upload_resps]}")
                
                upload_logs = [l for l in console_logs 
                             if 'upload' in l.lower() or '附件' in l or 'serverPath' in l or '发送消息' in l]
                log_test("上传日志捕获", len(upload_logs) > 0, f"{len(upload_logs)}条")
                for l in upload_logs[-5:]:
                    print(f"         📋 {l[:140]}")
                
                # 检查 UI 上是否出现附件 badge
                badges = page.locator('[class*="Badge"], [class*="attached"], [data-file-name]')
                badge_count = badges.count()
                log_test("UI显示附件badge", badge_count > 0, f"count={badge_count}")
                
                page.screenshot(path="/tmp/e2e_02_after_upload.png", full_page=True)
            else:
                log_test("文件上传跳过", False, "input元素未找到，尝试JS注入方式")
                # 尝试通过 JS 创建并触发
                js_result = page.evaluate("""(filePath) => {
                    try {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.style.display = 'none';
                        document.body.appendChild(input);
                        
                        const dataTransfer = new DataTransfer();
                        // 无法从纯路径创建File对象（浏览器安全限制）
                        // 返回信息说明限制
                        return {success: true, msg: 'input created via JS', count: document.querySelectorAll("input[type=file]").length};
                    } catch(e) {
                        return {success: false, error: e.message};
                    }
                }""", TEST_FILE)
                print(f"         📋 JS注入结果: {js_result}")
            
            # Step 4-6: API级验证 (子进程避免事件循环冲突)
            print("\n📌 Step 4-6: 子进程API验证 (H1虚拟路径 + 三层防御 + C1安全)...")
            t0 = time.time()
            api_results = run_api_tests_in_subprocess(TEST_FILE)
            elapsed = (time.time() - t0) * 1000
            
            if "error" in api_results:
                log_test("子进程执行", False, api_results.get("error", "")[:150], elapsed)
            else:
                log_test("子进程API验证完成", True, f"{elapsed:.0f}ms", elapsed)
                
                ar = api_results
                log_test("上传HTTP 200", ar.get('upload_status') == 200, f"status={ar.get('upload_status')}")
                log_test("H1虚拟路径格式", ar.get('is_virtual'), f"path={ar.get('file_path','')}")
                log_test("H1无路径泄露", not ar.get('path_leaked', True), "")
                log_test("解析端点可达", ar.get('resolve_status') == 200, f"status={ar.get('resolve_status',0)}")
                log_test("解析含real_path", ar.get('resolve_has_real', False), "")
                log_test("列表无泄露", not ar.get('list_leaked', True), "")
                
                log_test("对话HTTP 200", ar.get('chat_status') == 200, f"status={ar.get('chat_status')}")
                refuses = ar.get('refuses', [])
                log_test("三层防御-零拒绝", len(refuses) == 0, f"refuses={refuses or '无'}")
                substances = ar.get('substances', [])
                log_test("回复含实质内容", len(substances) >= 2, f"keywords={substances}")
                tools = ar.get('tools_used', [])
                log_test("工具被调用", len(tools) > 0, f"tools={tools}")
                
                content_len = ar.get('chat_content_len', 0)
                log_test("AI回复长度>50字符", content_len > 50, f"{content_len}字符")
                
                c1_leaks = ar.get('c1_leaks', [])
                log_test("C1无SQL/堆栈泄露", len(c1_leaks) == 0, f"leaks={c1_leaks or '无'}")
                log_test("C1返回通用消息", ar.get('c1_has_generic', False),
                        f"body: {ar.get('c1_body_preview', '')[:100]}")
                log_test("C1含request_id", ar.get('c1_has_rid', False), "")
            
            page.screenshot(path="/tmp/e2e_03_final.png", full_page=True)
            
        except PlaywrightTimeout as e:
            log_test("页面操作", False, f"超时: {e}")
            page.screenshot(path="/tmp/e2e_timeout.png")
        except Exception as e:
            log_test("E2E流程", False, f"异常: {type(e).__name__}: {e}")
            import traceback; traceback.print_exc()
        finally:
            browser.close()
    
    try:
        os.unlink(TEST_FILE)
    except OSError:
        pass
    
    # 汇总
    print("\n" + "=" * 60)
    print("  📊 E2E 验证汇总报告")
    print("=" * 60)
    
    total = len(RESULTS)
    passed = sum(1 for r in RESULTS if r['passed'])
    failed = total - passed
    
    print(f"\n  总测试数: {total}")
    print(f"  通过:     {'✅ ' + str(passed)}")
    print(f"  失败:     {'❌ ' + str(failed)}")
    print(f"  通过率:   {passed/total*100:.1f}%")
    
    print(f"\n  {'详细结果':^55}")
    print(f"  {'-'*55}")
    for r in RESULTS:
        icon = "✅" if r['passed'] else "❌"
        d = r['detail'][:42] if r['detail'] else ""
        print(f"  {icon} {r['name']:<28} {d}")
    
    if failed == 0:
        print(f"\n  🎉 所有E2E验证通过！生产部署就绪！")
    else:
        print(f"\n  ⚠️  {failed} 项失败需排查")
    
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main() or 0)
