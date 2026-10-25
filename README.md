# AirPocket MVP

AirPocket 是一个面向中匈跨境留学生、旅行者和华人用户的 P2P 行李额共享微信小程序 MVP。这里的 bag 指空余行李额 / 可被别人使用的行李空间。

## 已实现链路

- 带货者进入 `Offer Space`，通过 `Release Bag` 发布新的空余行李额，散件生成 `A0001` 格式的 bagNo，整箱生成 `B0001` 格式的 bagNo，并可勾选愿意接受的特殊物品类型。
- 寄货者进入 `Find Bags`，查看 active 且剩余重量大于 0 的 bag。
- 寄货者进入详情页填写占用重量、物品描述和实际特殊物品，调用云函数完成绑定；特殊物品只能从带货者已开放的类型中选择。
- 绑定后扣减 `bags.remainingWeight`，剩余重量为 0 时自动把 bag 状态更新为 `locked`。
- 寄货者提交 binding 后默认有 2 小时修改期；到期后自动锁单，锁单前可以编辑或取消，取消会恢复 bag 剩余重量。
- 带货者和寄货者分别在各自模块的 `My Bags` 查看历史记录。
- 平台客服作为中介联系双方：带货者发布和编辑 bag 时填写微信号与收货地址；寄货者绑定时填写微信号、取货地址和目的地快递信息。
- 首页提供 `Prohibited Items` 禁运物品清单入口，按禁止、限制/申报、高风险需确认和平台处理原则展示用户自查提示。

## 云函数

需要在微信开发者工具中上传并部署以下云函数，建议选择“上传并部署：云端安装依赖”：

- `getOpenId`
- `adminCheckAccess`
- `adminRequestAccess`
- `adminGetDashboard`
- `adminUpdateBagStatus`
- `adminUpdateBindingStatus`
- `createBag`
- `getBags`
- `getBagDetail`
- `bindBag`
- `updateBinding`
- `cancelBinding`
- `updateBag`
- `getMyCarrierBags`
- `getMySenderBindings`

`createBag` 会尝试自动创建 `bags` 和 `counters` collection；`bindBag` 会尝试自动创建 `bindings` collection。

`Release Bag` 支持 `散件` 和 `整箱` 两种类型：散件由带货者填写可用重量；整箱由带货者填写箱子数量，每箱默认 23kg，寄货者每次绑定 1 个整箱。未被绑定过的 bag 可以在带货者 `My Bags` 中进入 `Edit Bag / 编辑` 修改全部发布信息，包括散件和整箱互转；互转时会按类型重新生成 `A` 或 `B` 编号。

特殊物品字段分为两层：带货者在 `Release Bag` / `Edit Bag` 中保存 `specialItemOptions`，表示该 bag 可接受的特殊物品；寄货者在 `Bag Detail` / `Edit Binding` 中保存 `requestedSpecialItems`，表示自己实际要带的特殊物品。`bindBag` 和 `updateBinding` 会在云端校验 `requestedSpecialItems` 必须属于该 bag 的 `specialItemOptions`。

隐私展示规则：

- 带货者微信号和收货地址只给平台后台与带货者本人可见，寄货者在 `Find Bags` 和 `Bag Detail` 看不到。
- 寄货者微信号、取货地址和目的地快递信息只给平台后台与寄货者本人可见，带货者在 `My Bags` 的绑定详情里看不到。
- 已经有 binding 的 bag 不能再编辑。

## Admin 后台

隐藏页面路径：`pages/admin/index`。该页面用于平台客服查看完整 bag / binding 信息，包括双方微信号和地址，并更新运营状态。

当前 Admin 页面已经整理为客服工作台：

- 顶部统计 `待处理`、`今日新增`、`Bags`、`Bindings`。
- 支持按 bag 编号、微信号、城市、地址搜索。
- 支持按 binding 状态和 bag 状态筛选。
- `Binding Work Queue` 用于客服优先处理寄货者绑定记录。
- `Bags` 用于查看带货者发布记录和更新 bag 状态。
- `Recent Audit Logs` 展示最近后台状态操作记录。

后台每次通过 `adminUpdateBagStatus` 或 `adminUpdateBindingStatus` 修改状态时，都会写入 `auditLogs` collection，记录管理员 OpenID、操作类型、目标 bag / binding、修改前状态、修改后状态和操作时间。`adminGetDashboard` 会读取最近 30 条日志展示在后台。

管理员权限只通过 `admins` collection 判断。管理员打开小程序首页时，`adminCheckAccess` 会校验当前微信用户的 OpenID；如果是管理员，首页会显示 `Admin Panel` 入口。普通用户即使知道 `pages/admin/index` 路径，也无法通过 admin 云函数读取后台数据。

`admins` collection 推荐记录格式：

```js
{
  openid: "管理员openid",
  name: "管理员名称",
  role: "admin",
  status: "active",
  createdAt: Date,
  updatedAt: Date
}
```

代码里不再内置管理员 OpenID，也不再通过 `ADMIN_OPENIDS` 环境变量自动补齐管理员。上线或重新部署 admin 云函数前，请先在云开发数据库中确认 `admins` collection 已存在，并且你和需要管理后台的朋友都已经有 `status: "active"` 的记录。后续新增或停用管理员，只需要修改 `admins` collection：

- 新增管理员：新增一条 `openid + name + role + status` 记录。
- 停用管理员：把对应记录的 `status` 改成 `disabled`。
- 恢复管理员：把对应记录的 `status` 改回 `active`。

获取新管理员 OpenID 的方式：让对方打开小程序首页，长按 `AirPocket` 标题并提交后台权限申请。系统会把他的 OpenID 写入 `adminRequests` collection。审核通过后，把该 OpenID 新增到 `admins` collection，并设置 `status: "active"`。注意：`adminRequests` 只用于收集申请，不直接授予后台权限；真正的权限只看 `admins` collection。

需要部署以下 admin 云函数：

- `adminCheckAccess`
- `adminRequestAccess`
- `adminGetDashboard`
- `adminUpdateBagStatus`
- `adminUpdateBindingStatus`

## 暂未接入

- 微信支付
- 聊天功能
- 实名认证
