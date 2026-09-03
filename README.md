# OnboardOps

Enterprise Onboarding AI Assistant Operations & Evaluation Platform.

企业入职助手的 Agent / Planner / Skill / Tool / Eval 运营管理平台(内部运营/产品后台工具)。

## V1 范围

本版本(V1 项目骨架)只搭建整体导航结构、布局与视觉风格,8 个模块均为占位页,不包含任何真实业务逻辑、数据库交互或登录鉴权。

模块列表:聊天 Demo、Agent 控制台、Skills、Tools、Planner、模型管理、运营中心、数据中心。

## 技术栈

- Next.js (App Router) + TypeScript
- Tailwind CSS
- lucide-react
- Zustand(已预留依赖,V1 暂未使用)

## 本地开发

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

复制 `.env.example` 为 `.env.local` 并按需填写(V1 暂无需任何环境变量)。`.env.local` 已被 `.gitignore` 忽略,请勿提交真实密钥。
