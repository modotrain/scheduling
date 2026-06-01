# Cycle 切换与扩展实施说明

本文档说明本项目从 cycle2 平滑迁移到 cycle3（以及后续 cycleN）时的设计考虑、操作步骤、注意事项、数据注入方式与验收建议。

## 1. 设计目标与边界

### 1.1 核心目标

1. 保持当前 cycle2 行为不变（默认仍可完整工作）。
2. 支持以最小改动新增 cycleN（尽量不改业务代码）。
3. 首页只对 Cycle Planning 的 4 个子入口做 cycle 维度切换。
4. too-management、tootogp-schedule、short-term-planning 保持共享逻辑，不按 cycle 拆库拆表。

### 1.2 当前实现概览

Cycle 相关信息由配置驱动：

- 配置文件：src/db/cycles.config.json
- 前后端读取入口：app/lib/cycles.ts
- 周次 epoch 计算支持按 cycle：app/lib/week-utils.ts

配置结构示例：

```json
{
  "activeCycle": 2,
  "cycles": [
    {
      "cycle": 2,
      "epoch": "2025-08-12",
      "label": "Cycle 2"
    }
  ]
}
```

activeCycle 控制默认展示与未显式传入 ?cycle= 时的默认目标。

## 2. 架构实现考虑

### 2.1 路由层与页面层的 cycle 传递

项目采用 query 参数 ?cycle=N 作为运行时 cycle 选择器：

1. API 侧通过 resolveCycleFromRequest(request) 解析 cycle。
2. 页面侧通过 useCycle() 或 parseCycleParam() 获取当前 cycle。
3. 页面内部 fetch、详情页跳转、返回链接均携带 cycleQuery，避免跨页丢失。
4. 本地缓存 key 按 cycle 隔离，避免切换后读到旧 cycle 缓存数据。

### 2.2 首页入口策略

首页仅对 Cycle Planning 四个入口进行 cycle 切换：

1. Sources & Status
2. Long-Term Schedule
3. Calibration Workspace
4. Gap Filling Sources

short-term-planning 入口保持在 tab 外，作为共享入口，不随 cycle 切换。

### 2.3 数据库模型策略

Cycle 专属表通过工厂统一生成，新增 cycle 不需要手写新 schema：

- 表工厂：src/db/cycle-tables.ts
- 关键能力：getCycleTables(n)、CYCLE_TABLE_NAME(n)

每个 cycle 一套同构物理表（9 张）：

1. gp_cycleN
2. cycleN_gf
3. long_term_observation_list_cycleN
4. long_term_observation_list_cycleN_gf
5. gp_cycleN_source_reports
6. cycleN_skymap_sources
7. cycleN_skymap_schedule
8. gp_cycleN_proposal
9. cycleN_anti_too_proposal

### 2.4 共享模块保持不拆 cycle

以下模块及表保持共享，不因 cycle 切换拆分：

1. too-management（approved_too）
2. tootogp-schedule（tootogp_schedule）
3. short-term-planning（short_term_plan_sessions）

这样可避免把 ToO 与短期会话体系引入多 cycle 复杂性，保持原执行逻辑稳定。

## 3. 新增 Cycle（一键扩展）

### 3.1 脚本

新增 cycle 使用：src/add_cycle.ts

命令格式：

```bash
npx tsx src/add_cycle.ts --cycle 3 --epoch 2026-08-11 --label "Cycle 3"
```

其中：

1. --cycle 必填，正整数。
2. --epoch 必填，YYYY-MM-DD。
3. --label 选填，默认 Cycle N。

### 3.2 脚本行为说明

脚本会自动执行：

1. 校验 cycle 未在 cycles.config.json 中注册。
2. 选择已注册的最小 cycle 作为模板，克隆 9 张 cycle 专属表结构。
3. 给 serial id 表重建独立 sequence，避免共享模板 sequence。
4. 修正 skymap 相关表 dataset 默认值为 cycleN。
5. 将新 cycle 写入 src/db/cycles.config.json。

脚本不会自动切换 activeCycle。

## 4. 切换到新 Cycle 的推荐流程

建议分为三步：

1. 建表注册。
2. 数据注入与校验。
3. 切换 activeCycle。

### 4.1 步骤一：建表注册

```bash
npx tsx src/add_cycle.ts --cycle 3 --epoch 2026-08-11 --label "Cycle 3"
```

### 4.2 步骤二：数据注入

所有 cycle-aware 注入脚本都支持：

```bash
--cycle N
```

如果不传，默认使用 activeCycle。

建议注入顺序（以 cycle3 为例）：

```bash
npx tsx src/inject_cycle_gf.ts --cycle 3 --gp
npx tsx src/inject_cycle_gf.ts --cycle 3 --gf
npx tsx src/inject_longterm_weekly_plans.ts --cycle 3
npx tsx src/inject_longterm_weekly_plans_gf.ts --cycle 3
npx tsx src/inject_cycle_skymap_data.ts --cycle 3
npx tsx src/inject_cycle_gf_skymap_data.ts --cycle 3
npx tsx src/inject_gp_cycle_source_reports.ts --cycle 3 --dataset=gp
npx tsx src/inject_gp_cycle_source_reports.ts --cycle 3 --dataset=gf
```

说明：

1. inject_cycle_gf.ts 通过 --gp / --gf（或 --target gp|gf）区分导入目标。
2. 当目标为 gp 时，会合并三份源文件导入同一张 gp_cycleN 表：GP、WXTCAL、FXTCAL。
3. inject_cycle_skymap_data.ts 会合并 GP/WXTCAL/FXTCAL 三份 visibility_eachday 文件导入同一张 cycleN_skymap_sources 表。
4. inject_gp_cycle_source_reports.ts 通过 --dataset=gp 或 --dataset=gf 区分来源。
5. 其中 --dataset=gp 会映射到历史分区值 cycle2（兼容旧查询）；这里的 dataset 语义是“主流/ GF 数据分区”，不是 cycle 编号。
6. 所有 cycle-aware 脚本建议始终显式传 --cycle N。
7. inject_too.ts 属于共享 ToO 数据，不是 cycle-aware，不用于 cycle 切换流程。

### 4.3 步骤三：切默认 cycle

数据验证通过后，手动将 src/db/cycles.config.json 中 activeCycle 改为目标 cycle（例如 3）。

切换后：

1. 首页默认展示新 cycle 的 Planning 入口。
2. 旧 cycle 仍可通过 tab 或显式 ?cycle=2 访问。

## 5. 数据注入输入来源说明

### 5.1 主要目录

注入脚本默认读取 longterm_sch 目录下数据：

1. longterm_sch/reviewed_cycleN_source_list_GP_forDatabase.csv
2. longterm_sch/reviewed_cycleN_source_list_wxtcal_forDatabase.csv
3. longterm_sch/reviewed_cycleN_source_list_fxtcal_forDatabase.csv
4. longterm_sch/reviewed_cycleN_source_list_GF_forDatabase.csv
5. longterm_sch/reviewed_cycleN_source_list_GP_visibility_eachday.csv
6. longterm_sch/reviewed_cycleN_source_list_wxtcal_visibility_eachday.csv
7. longterm_sch/reviewed_cycleN_source_list_fxtcal_visibility_eachday.csv
8. longterm_sch/reviewed_cycleN_source_list_GF_visibility_eachday.csv
9. longterm_sch/weekly_plans/*.csv
10. longterm_sch/weekly_plans_gf/*.csv
11. longterm_sch/schedule_result.csv
12. longterm_sch/schedule_gf_records.csv
13. longterm_sch/source_reports/*.txt
14. longterm_sch/source_reports_gf/*.txt

说明：

1. 这里的 N 表示目标 cycle（例如 cycle3）。
2. GP/WXTCAL/FXTCAL 在多个注入流程中会合并导入到同一个 GP 相关目标表。

### 5.2 覆盖行为注意

多数注入脚本会先清空目标表再写入（delete + insert）。

执行前请确认：

1. 目标 cycle 是否正确（强烈建议始终显式传 --cycle）。
2. CSV/TXT 数据是否齐全且与目标 cycle 匹配。
3. 在生产环境执行前完成备份或至少有可恢复方案。

## 6. 运行与验收建议

### 6.1 类型检查

```bash
npx tsc --noEmit
```

### 6.2 建议验收清单

1. 首页 tab 默认落在 activeCycle。
2. 4 个 cycle 页面切换后请求都携带 ?cycle=N。
3. 列表页和详情页跳转后 cycle 不丢失。
4. 各页缓存不会在不同 cycle 间串数据。
5. too-management、tootogp-schedule、short-term-planning 功能不受影响。

### 6.3 回滚建议

若切换后发现问题：

1. 先将 activeCycle 改回上一稳定 cycle。
2. 保留新 cycle 表结构，修复后重新注入数据。
3. 不建议直接删除新 cycle 表，避免影响排障取证。

## 7. 常见问题

### Q1: 为什么不直接复制一套 cycle3 路由目录？

A: 通过 ?cycle 参数 + 表工厂可避免目录与代码重复，降低每年维护成本。

### Q2: 为什么 shared pages 不做 cycle 拆分？

A: ToO 与 short-term 更偏跨周期执行/调度协同，拆分会引入额外一致性成本，当前需求明确要求保持共享。

### Q3: 新增 cycle 后为什么不自动切 activeCycle？

A: 防止“建表成功但数据未准备好”时误切流量，activeCycle 需要人工确认后再切。

---

如需将以上流程自动化为一键流水（新增 cycle + 注入 + 校验 + 切换），可后续新增一个 orchestrator 脚本并加入强校验与确认步骤。