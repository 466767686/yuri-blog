---
title: "想在手机上做一个 AI Agent"
link: phone-ai-agent
date: 2026-10-02 20:00:00
catalog: true
tags:
  - 工具
  - AI
  - 折腾
categories:
  - 工具
---
起因是 Termux。上周装了个，想在手机上跑点脚本。后来发现能装 Python，就想干脆做个 agent 试试。

想法很简单：一个能循环调用大模型 API 的脚本。输入一个问题，它自己决定要不要调工具，调用，拿结果，继续想，直到给出答案。在电脑上这玩意儿已经烂大街了，但手机上没啥人折腾。

用 pkg 装了 Python 3.12。requests 直接 pip 装上。本来想用各家 SDK，看了看体积算了，requests 发 HTTP 请求就够。工具先用两个最简单的试水：一个读取剪贴板，一个打开 URL。剪贴板用 termux-clipboard-get，URL 用 termux-open-url，都是 Termux:API 自带。

写到晚上十二点多，跑通了。第一版逻辑特别蠢，就是把工具描述塞进 prompt，让模型输出 JSON 表示要调哪个，我用正则扒出来执行。没有 function calling，没有 MCP，什么都没有。但能跑。问它"今天天气怎么样"，它会说"我需要联网"，然后调 open-url，然后卡住——因为它没有返回值。

问题来了：open-url 只负责打开浏览器，拿不到结果。我得换个能抓网页的工具。but 手机 Python 装 beautifulsoup 会很慢……先算了，直接让它调 curl 命令输出 HTML，再用正则清掉标签塞回去。丑是丑了点。

中间试过用 API 的 function calling。Claude 和 OpenAI 都支持，但格式不一样，工具定义写了两套，调试到 1 点多。第二天下课回来发现 API key 欠费了，白折腾。

现在这玩意儿的状态是：能聊天，能读剪贴板，能搜网页但抓回来一堆乱码，能打开 APP。电量是个问题，跑一晚上掉 40%。准备接下来用 Tasker 或者 cron 让它定时跑点东西，比如早上帮我总结一下天气和日程。

说实话，在手机上跑这东西唯一的理由是——不能随时开电脑。真要做正经东西还得去 PC 上。但想了想，全班大概只有我在这种破事上浪费晚自习。
