# P2P五子棋游戏

这是一个基于WebRTC和STUN服务器的P2P五子棋对战游戏。玩家可以无需中央服务器直接连接对战。
- **访问网页版游戏**：[https://aosyang.github.io/gomoku-vibe-coding/](https://aosyang.github.io/gomoku-vibe-coding/)

> 本项目使用Cursor AI以Vibe Coding方式完成，人工编码成分较少。

## 功能特点

- 使用WebRTC实现P2P直接连接，无需中央服务器
- 通过Google的STUN服务器（stun.l.google.com:19302）进行NAT穿透
- 用户名本地保存，下次访问自动填充
- 现代化UI设计，响应式布局适配各种设备
- 棋子落子实时预览，对手可以看到你的鼠标位置
- 胜利后智能提示，不遮挡获胜路径
- 获胜棋子高亮动画效果
- 中文界面，操作简单直观

## 游戏规则

- 黑棋先行（创建游戏的玩家为黑棋）
- 在15x15的棋盘上轮流落子
- 任意方向（水平、垂直、对角线）连成5子即获胜
- 棋盘填满且无人获胜则为平局

## 使用方法

1. 打开游戏网页
2. 输入你的用户名（会自动保存）
3. 创建游戏或加入已有游戏：
   - **创建游戏**：点击"创建游戏"按钮，将生成的连接ID发送给对方
   - **加入游戏**：输入对方的连接ID，点击"加入游戏"按钮

## 交互功能

- **落子预览**：鼠标悬停在棋盘上时会显示半透明的棋子
- **对手预览**：可以看到对手的鼠标位置
- **胜利提示**：当一方获胜时，会高亮显示获胜的五个棋子，并显示胜利消息
- **查看棋盘**：胜利后可以点击"查看棋盘"按钮隐藏胜利提示，清晰查看获胜路径
- **重新开始**：可以发起重新开始请求，等待对手确认

## 技术实现

- 使用原生JavaScript开发，无需框架
- CDN加载PeerJS库用于WebRTC连接
- 谷歌STUN服务器实现NAT穿透
- CSS3动画和过渡效果增强用户体验
- 响应式设计适配各种屏幕尺寸
- localStorage存储用户设置
- WebRTC数据通道传输游戏状态

## 本地运行

由于浏览器安全限制，WebRTC功能需要通过HTTP服务器访问。可以使用以下方法之一启动本地服务器：

### 使用Python（推荐）

```bash
# Python 3
python -m http.server

# 或Python 2
python -m SimpleHTTPServer
```

然后访问 http://localhost:8000

### 使用Node.js

如果已安装Node.js，可以全局安装`http-server`：

```bash
npm install -g http-server
http-server
```

然后访问 http://localhost:8080

## 注意事项

- 需要网络连接才能使用STUN服务器
- 某些严格的防火墙或NAT配置可能会阻止P2P连接
- 建议使用现代浏览器（Chrome, Firefox, Edge等）运行此游戏
- 移动设备上也可以运行，但推荐使用PC以获得最佳体验

## 部署

该项目可以部署到任何静态网站托管服务（如GitHub Pages、Netlify、Vercel等）：

1. 克隆或下载仓库
2. 将文件上传到托管服务
3. 访问部署后的URL即可开始游戏

由于使用CDN加载PeerJS库，无需额外的服务器端配置。 