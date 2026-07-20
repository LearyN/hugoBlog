#!/usr/bin/env python3
"""
hot-topics 部署自检脚本
在 trends.json 更新并 push 后执行，验证线上数据是否已同步。
如果不匹配，自动触发 Cloudflare Pages 重新部署。

用法:
  python3 scripts/verify_hot_topics.py [--redeploy]
  
  --redeploy: 不匹配时自动触发 redeploy（cron 模式用）
"""

import json
import subprocess
import sys
import time
import urllib.request

DEPLOY_HOOK_URL = "https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/3bedc9f6-9717-4f8d-8568-630aa9734f3a"
SITE_URL = "https://learyliang.com/hot-topics/data/trends.json"
LOCAL_FILE = "static/hot-topics/data/trends.json"

MAX_RETRIES = 6       # 最多等 3 分钟（每次 30s）
RETRY_INTERVAL = 30   # 秒


def get_local_fetched_at():
    """读取本地 trends.json 的 fetched_at"""
    try:
        with open(LOCAL_FILE, "r") as f:
            data = json.load(f)
        return data.get("fetched_at", "")
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"❌ 无法读取本地文件 {LOCAL_FILE}: {e}")
        return None


def get_remote_fetched_at():
    """读取线上 trends.json 的 fetched_at"""
    try:
        req = urllib.request.Request(SITE_URL, headers={"User-Agent": "LearyClaw-Verify/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.load(resp)
        return data.get("fetched_at", "")
    except Exception as e:
        print(f"⚠️ 无法读取线上文件: {e}")
        return None


def trigger_redeploy():
    """触发 Cloudflare Pages 重新部署"""
    print("🔄 触发 Cloudflare Pages 重新部署...")
    try:
        req = urllib.request.Request(DEPLOY_HOOK_URL, method="POST")
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode()
            print(f"  ✅ 部署触发成功: {resp.status}")
            return True
    except Exception as e:
        print(f"  ❌ 部署触发失败: {e}")
        return False


def main():
    auto_redeploy = "--redeploy" in sys.argv

    local_ts = get_local_fetched_at()
    if local_ts is None:
        sys.exit(1)

    print(f"📦 本地: {local_ts}")

    for attempt in range(1, MAX_RETRIES + 1):
        remote_ts = get_remote_fetched_at()
        if remote_ts is None:
            print(f"  ⚠️ 第 {attempt}/{MAX_RETRIES} 次: 线上读取失败，{RETRY_INTERVAL}s 后重试")
            time.sleep(RETRY_INTERVAL)
            continue

        print(f"🌐 线上: {remote_ts}")

        if local_ts == remote_ts:
            print("✅ 数据已同步，无需操作")
            return 0

        print(f"  ⏳ 不匹配（第 {attempt}/{MAX_RETRIES} 次）")

        if attempt < MAX_RETRIES:
            print(f"  ⏰ 等待 {RETRY_INTERVAL}s 后重试...")
            time.sleep(RETRY_INTERVAL)

    # 重试耗尽，数据仍不匹配
    print(f"❌ 重试 {MAX_RETRIES} 次后线上数据仍未更新")
    print(f"   本地: {local_ts}")
    print(f"   线上: {remote_ts if 'remote_ts' in dir() else 'N/A'}")

    if auto_redeploy:
        print("  ⚡ 触发自动重新部署...")
        trigger_redeploy()
        # 再等一轮
        for attempt in range(1, MAX_RETRIES + 1):
            remote_ts = get_remote_fetched_at()
            if remote_ts == local_ts:
                print("✅ 重新部署后数据已同步")
                return 0
            time.sleep(RETRY_INTERVAL)

        print("❌ 重新部署后仍未同步，请手动检查")
        return 1

    return 1


if __name__ == "__main__":
    sys.exit(main())