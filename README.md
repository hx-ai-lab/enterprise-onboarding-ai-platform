# OnboardOps

Enterprise Onboarding AI Assistant Operations & Evaluation Platform.

企业入职助手的 Agent / Planner / Skill / Tool / Eval 运营管理平台(内部运营/产品后台工具)。

## V2 范围

在 V1 项目骨架(整体导航结构、布局与视觉风格)基础上,V2 实现了 **Agent 控制台 / Skills / Tools** 三个模块的真实功能:

- 新员工可以在 Agent 控制台的「运行测试」页面用自然语言提问入职相关问题
- Planner 根据问题与当前模拟员工身份,从该 Agent 已绑定且已启用的 Skill / Tool 中生成执行计划
- Executor 按计划逐步调用 Skill / Tool,并在返回最终回复前强制执行合规与风险审核
- 运营人员可以在 Skills / Tools 管理页配置、测试、启用/禁用这些能力,保存后立即生效
- 每次运行都会写入执行日志,可在 Agent 详情的「执行日志」页按 Agent 维度查看

聊天 Demo、Planner、模型管理、运营中心、数据中心 5 个模块仍为 V1 占位页,留待后续版本开发。

## 技术栈与数据层

- **框架**:Next.js (App Router) + TypeScript,业务 API 使用 Route Handlers(`app/api/**`),未新建独立后端
- **数据层**:仓库 `/mock-data` 保存只读 Demo Seed;Upstash Redis 保存运行时状态;未使用 Prisma/ORM
- **大模型调用**:通过环境变量配置 API Key / Base URL / 模型名称,默认 **Mock 模式**——未配置或调用失败时自动降级为本地规则化模拟输出,保证项目随时可演示,不会报错崩溃
- **身份模拟**:未接入真实登录;顶部导航栏右上角提供「切换模拟员工身份」下拉选择,用于以不同员工视角测试

## 本地开发

### 环境要求

- Node.js 20+
- npm

### 安装与启动

```bash
npm install
cp .env.example .env.local   # 按需填写,留空即为 Mock 模式
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

可运行 `npm run verify:storage` 执行隔离 namespace 下的持久化回归验证;脚本覆盖 Seed Override、Custom CRUD、
Tombstone、Skill 测试结果、Run Log、服务重启读取及 Preview 缺少 Redis 时 fail-closed,并在结束后恢复本地 Demo 状态文件。

### 环境变量说明(`.env.example`)

| 变量 | 说明 |
|---|---|
| `LLM_API_KEY` | 大模型服务的 API Key(通用命名,配合 `LLM_BASE_URL` 可指向任意 OpenAI 兼容接口)。与 `OPENAI_API_KEY` 二选一,`LLM_API_KEY` 优先级更高 |
| `OPENAI_API_KEY` | 直接使用 OpenAI 官方 API 时可用这个更常见的变量名代替 `LLM_API_KEY`;设置后若未显式配置 `LLM_BASE_URL`,会自动使用 `https://api.openai.com/v1` 作为请求地址,无需额外配置 |
| `LLM_BASE_URL` | OpenAI 兼容的 Chat Completions 接口 Base URL(例如接入非 OpenAI 的兼容服务),请求会 POST 到 `${LLM_BASE_URL}/chat/completions`;仅在需要覆盖默认的 OpenAI 地址时才需要设置 |
| `LLM_MODEL` | 部署级模型名称,设置后对所有 Skill 生效(优先级高于每个 Skill 自己保存的 `model_params.model`),用于整体切换到非 OpenAI 的模型(如接入 DeepSeek 时设为 `deepseek-v4-flash` 等);不设置时才会使用各 Skill 编辑页里保存的模型 |
| `PORT` | 本地启动端口(可选) |
| `KV_REST_API_URL` | Upstash Redis REST URL;Vercel Upstash Integration 自动提供,不要提交实际值 |
| `KV_REST_API_TOKEN` | Upstash Redis 读写 Token;Vercel Upstash Integration 自动提供,不要提交实际值 |
| `STORAGE_NAMESPACE` | 可选的本地/测试 namespace 覆盖;Vercel 自动使用 `VERCEL_ENV` 隔离 Production 与 Preview |

`.env.local` 用于存放本地真实配置,已被 `.gitignore` 忽略,请勿提交真实密钥;`.env.example` 仅列出变量名。

### Mock 模式说明

- `LLM_API_KEY`/`OPENAI_API_KEY` 均未配置时,所有 Skill 调用自动走内置的规则化 Mock 输出(见 `lib/skills/mocks.ts`),Tool 调用本身就是纯代码 + 本地 JSON 数据,不依赖大模型
- 真实调用失败(网络错误、超时、非 2xx 状态码、返回内容无法解析为 JSON)时同样会静默降级为 Mock 输出,并在执行明细中用文字提示「已使用 Mock 模式」及具体原因,不会导致请求失败
- Agent 运行页 / Skill 测试页的每一步都会标注 `mocked` 状态,方便区分本次输出来自真实模型还是 Mock

### 数据持久化架构

**Seed JSON = Demo 基础数据;Upstash Redis = Runtime Persistent State。**

- `employees.json`、`onboarding_tasks.json`、`contacts.json`、`policies.json`、`trainings.json` 始终只读,不会迁移或写回
- Agent / Skill / Tool 从 Seed JSON 开始;Seed 被修改后写 Redis Override,新建对象写 Redis Custom,删除 Seed 写 Redis Tombstone
- Agent Run Log(包括 Planner → Executor → Compliance 的完整 Trace)只写 Redis,不再写仓库文件或 `/tmp`
- Redis key 使用 `onboardops:v1:<environment>:*`;Vercel Production 与 Preview 分别使用 `production`、`preview`,互不污染
- 后续 Bad Cases、Evaluation Cases、Evaluation Runs 可沿用同一版本化 namespace 和 Repository/Adapter,本版本不提供相关 UI

当前 Redis key 设计:

| 数据 | Key / Redis 类型 |
|---|---|
| Seed 配置覆盖 | `onboardops:v1:<environment>:{agents|skills|tools}:overrides` / Hash |
| 用户新建配置 | `onboardops:v1:<environment>:{agents|skills|tools}:custom` / Hash |
| 已删除 Seed | `onboardops:v1:<environment>:{agents|skills|tools}:tombstones` / Set |
| Run Log 正文 | `onboardops:v1:<environment>:run-logs:items` / Hash |
| Run Log 全局时间索引 | `onboardops:v1:<environment>:run-logs:all` / Sorted Set |
| Agent Run Log 索引 | `onboardops:v1:<environment>:run-logs:by-agent:<agentId>` / Sorted Set |

`production` 与 `preview` 是固定隔离的 Vercel namespace。Bad Cases、Evaluation Cases、Evaluation Runs 后续分别使用
`bad-cases:*`、`evaluations:cases:*`、`evaluations:runs:*`,本阶段只保留 namespace 扩展约定,不提前创建数据或界面。

Vercel Production / Preview 必须同时提供 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`。配置缺失或 Redis 请求失败时,
API 会失败且 UI 不会显示保存成功;线上环境绝不回退本地文件、Memory 或 `/tmp`。本地未配置 Redis 时会在服务端明确警告,
并使用被 Git 忽略的 `.data/runtime-state.json` Demo fallback,方便刷新和重启开发服务器后继续演示。

## 示例提问

在「Agent 控制台 → 入职助手 Agent → 运行测试」页面可以直接点击以下示例问题,或自行输入:

- 我入职第一天需要做什么
- 请假需要提前多久申请,走什么流程
- 我的入职任务完成得怎么样了,还有哪些没做
- IT 支持的联系方式是什么

## 目录结构(V2 新增部分)

```
app/(dashboard)/
├── agents/
│   ├── page.tsx                 # Agent 列表
│   ├── [agentId]/
│   │   ├── page.tsx             # Agent 详情:基础信息编辑 + 绑定 Skill/Tool
│   │   ├── run/page.tsx         # 测试运行页
│   │   └── logs/page.tsx        # 执行日志列表
│   └── new/page.tsx
├── skills/
│   ├── page.tsx
│   ├── [skillId]/
│   │   ├── page.tsx             # Skill 详情(只读)+ 最近一次测试结果
│   │   ├── edit/page.tsx        # 编辑:名称/描述/Prompt/模型参数/启用状态
│   │   └── test/page.tsx        # 单独测试该 Skill
│   └── new/page.tsx
└── tools/
    ├── page.tsx
    ├── [toolId]/page.tsx        # Tool 详情(含内联编辑)
    └── new/page.tsx

app/api/
├── agents/[[...routes]]         # CRUD + /run + /logs
├── skills/[[...routes]]         # CRUD + /test
├── tools/[[...routes]]          # CRUD
└── employees/                   # 供身份切换器 / 测试页使用

lib/
├── types.ts                     # 领域模型类型定义
├── data/                        # 领域 Repository 入口 + 只读 Seed JSON
├── storage/                     # Upstash Redis / 本地 Demo Storage Adapter
├── llm.ts                       # LLM 客户端(OpenAI 兼容),含 Mock 判定
├── tools/runners.ts             # 6 个 Tool 的真实执行逻辑
├── skills/{mocks,runner}.ts     # 6 个 Skill 的 Mock 规则 + 真实 LLM 调用
├── planner.ts                   # 执行计划生成(仅基于已启用能力)
└── executor.ts                  # 按计划执行 + 合规审核重试循环
```

## Skill / Tool 配置说明

### 内置 6 个 Skill(`mock-data/skills.json`)

| Skill | 作用 | 关键约束 |
|---|---|---|
| 入职问题结构化 Skill | 把自然语言问题解析为 `intent` / `question_type` / 关键词等结构化信息 | 仅基于输入判断,不编造员工档案外的信息 |
| 入职任务决策 Skill | 基于已查询到的任务数据判断下一步推荐任务 | 只能对传入任务排序筛选,不得新增任务 |
| 入职流程解释 Skill | 生成步骤化、面向新员工的流程说明 | 不得编造制度/联系人/时间 |
| 制度与知识问答 Skill | 仅基于 Tool 查到的制度内容回答 | 必须标注制度名称/版本号/生效日期;查不到需明确说明 |
| 入职沟通话术生成 Skill | 汇总前序结果生成最终自然语言回复 | 不暴露 Planner/Skill/Tool/JSON 等内部细节;涉及薪酬/社保/公积金避免绝对化承诺 |
| 合规与风险审核 Skill | 审核最终回复是否泄露隐私、编造制度、不当承诺、歧视性表达 | 输出 `risk_level`/`passed`/`issues`/`suggestions`/`final_reply`,是回复发出前的最后一关 |

每个 Skill 包含 `prompt`(系统 Prompt 模板)、`model_params`(`model`/`temperature`/`max_tokens`)、`enabled` 与 `last_test`(最近一次单独测试的输入/输出/时间)。在 Skills 列表页可以「测试」「编辑」「禁用」,**禁用后该 Skill 不会出现在新生成的执行计划中,且即使被手动调用(如测试页)也会被拒绝执行**。

### 内置 6 个 Tool(`mock-data/tools.json`)

| Tool | 数据源 | 说明 |
|---|---|---|
| 查询员工信息 Tool | `employees.json` | 查询本人返回完整档案;查询他人仅返回脱敏后的公开组织信息(姓名/部门/岗位/入职阶段) |
| 查询入职任务 Tool | `onboarding_tasks.json` | 仅允许查询本人任务,不允许跨员工查询 |
| 查询公司联系人 Tool | `contacts.json` | 覆盖 HR/IT/行政/培训/财务/部门负责人 |
| 查询制度知识库 Tool | `policies.json` | 覆盖员工手册/考勤/请假/报销/信息安全/社保公积金/试用期等 |
| 查询培训计划 Tool | `trainings.json` | 覆盖通用/岗位/信息安全/企业文化培训 |
| 入职任务状态计算 Tool | `onboarding_tasks.json`(纯代码计算) | 计算完成率、逾期任务、按优先级排序,不调用大模型 |

同样支持在 Tools 列表页「编辑」「禁用」,禁用规则与 Skill 一致。

## Planner / Executor 核心规则

- Planner 只根据当前 Agent **已绑定且当前已启用**的 Skill / Tool 生成执行计划,不会引用不存在或已禁用的能力
- 规划本身是确定性的规则匹配(而非由大模型决定步骤顺序),因为 Executor 需要按固定契约为每一步组装输入;这样也保证 Mock 模式与真实 LLM 模式下生成的计划完全一致,只有每步 Skill 的产出内容不同
- 若 Agent 缺少「入职问题结构化」「入职沟通话术生成」「合规与风险审核」中任意一个必备 Skill(未绑定或已禁用),请求会被直接中止并提示原因,不会返回未经审核的内容
- 最终回复在返回前必须经过合规与风险审核 Skill;审核不通过时,系统会带着审核建议重新生成回复并再次审核(最多重试一次),仍未通过则返回审核环节给出的安全兜底版本,并在页面上明确标注「审核未通过,已使用安全兜底回复」
- 查询不到数据时,Tool / Skill 均返回明确的“未查询到相关信息”,不会编造

## JSON 数据结构说明

所有 Seed 数据文件位于 `/mock-data`,均为**完全虚构**的演示数据。Seed 文件只读,用户操作不会写回 Git:

- `employees.json`:12 名虚构员工,覆盖技术/产品/市场/人力资源/财务/行政/法务/销售等部门与 5 种入职阶段
- `onboarding_tasks.json`:112 条入职任务,按员工与入职阶段生成,含状态/优先级/截止日期/依赖关系
- `contacts.json`:10 位虚构联系人,覆盖 HR/IT/行政/培训/财务/部门负责人角色
- `policies.json`:9 条制度,覆盖员工手册/考勤/请假/报销/信息安全/社保公积金/试用期等类别
- `trainings.json`:10 项培训计划,覆盖通用/岗位/信息安全/企业文化
- `skills.json` / `tools.json` / `agents.json`:Skill / Tool / Agent 的初始 Seed 配置;运行时覆盖和自定义对象存于 Redis
- `logs.json`:仅保留为空的历史 Demo 文件,运行时不再读取;Redis 中的 Agent Run Log 按 `agent_id` 建索引并最多保留 300 条

具体字段定义见 `lib/types.ts`。

## 验收自查

- [x] Agent 控制台可选择 Agent、输入问题并运行,完整展示 Planner 计划 → 每步调用(含输入/输出 JSON,可折叠)→ 最终回复 → 合规审核结果
- [x] 禁用某个 Skill 后,该 Skill 不会出现在新生成的执行计划中,且手动调用(测试页 / Planner)会被拒绝
- [x] Skills / Tools 列表、编辑、测试页面功能齐全,复用既有设计规范(文字 + 图标,不单靠颜色)
- [x] 大模型 API 未配置时自动切换 Mock 模式,不报错崩溃
- [x] 仓库中不含真实密钥或真实员工数据
- [x] README 覆盖环境要求、安装步骤、`.env` 配置说明、启动方式、示例提问、JSON 数据结构说明、Skill/Tool 配置说明、Mock 模式说明
