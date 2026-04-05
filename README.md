# CompusAss (校园助手/社团预约系统) 系统分析报告

## 1. 项目概述
CompusAss 是一款基于微信原生小程序与微信云开发（CloudBase）的校园综合助手及预约系统。该项目采用了前后端分离和云原生架构，主要服务于校园社团通知下发、活动展示、场地与活动预约报名、用户中心管理以及移动端后台数据维护等场景。

## 2. 系统架构设计
系统整体依托 **Serverless（无服务器）** 架构，前端使用原生微信小程序语法（WXML/WXSS/JS）开发，后端依托于微信单体云函数与云数据库。

### 2.1 前端架构 (Miniprogram)
前端代码位于 `miniprogram/` 目录下，采用组件化和模块化设计：
- **核心业务模块 (`projects/A00/`)**：包含了面向用户（C端）的主要业务页面，包括：
  - `default/`：首页展示与导航。
  - `news/`：社团通知与简介（资讯列表与图文详情）。
  - `calendar/` & `meet/`：预约日历视图、活动详情与在线报名表单。
  - `my/`：个人中心、我的预约/活动参与记录与资料修改。
- **管理后台模块 (`pages/admin/`)**：面向管理员（B端）的移动端后台页面，涵盖：
  - 数据面板、活动预约管理（包含时段设置、扫码核销、记录导出）、资讯文章发布、用户列表及系统设置。
- **公共组件库 (`cmpts/`)**：沉淀了大量高复用的自定义组件，例如动态表单生成器（`form`）、日历控件（`calendar`）、图片上传（`img_upload`）、海报生成（`poster`）等。
- **业务逻辑抽象 (`biz/` & `behavior/`)**：抽离了各个页面的核心业务逻辑与 Behaviors，极大提升了代码的复用度。

### 2.2 后端架构 (CloudFunctions)
后端采用 **单路由云函数入口（Single-Entry Cloud Function）** 模式，所有业务请求统一指向名为 `cloud` 的云函数，从而彻底解决云函数冷启动问题，并突破云函数数量限制。其底层基于一套自研的轻量级 MVC 路由框架：

1. **入口与路由分发 (Router)**：
   - 核心文件：`index.js` 及 `framework/core/application.js`。
   - 工作流：通过接收前端传入的 `route` 参数（如 `meet/list`），在 `config/route.js` 中匹配对应的控制器及方法（如 `meet_controller@list`），并动态实例化执行。
   - 支持类似中间件的 AOP 拦截（如路由配置中的 `#` 后缀支持 `beforeApp` 前置处理）。

2. **Controller 层 (`project/controller/`)**：
   - 承担请求接收、参数校验（依赖 `framework/validate/`）与权限控制。
   - 严格划分 `admin/`（后台管理API，需校验 Token/Admin 权限）与前端普通接口（依赖 OpenID 校验）。
   - 基类 `base_controller.js` 提供了通用的成功/失败响应结构（如 `appUtil.handlerData`）。

3. **Service 层 (`project/service/`)**：
   - 处理核心业务逻辑与事务（如报名冲突检测、并发超卖控制、日历数据生成等）。
   - 通过继承 `base_service.js` 实现通用的 CRUD 服务，复用度极高。

4. **Model 层 (`project/model/`)**：
   - 基于面向对象对微信云数据库 (Cloud Database) 的 Collection 进行了高级封装。
   - 统一定义了 `DB_STRUCTURE` 数据字典（支持类型校验、默认值、必填项限制，模拟关系型数据库的严格约束）。

### 2.3 数据存储设计 (Cloud Database)
系统使用微信云开发的 NoSQL 数据库，基于 `Model` 层定义的 `DB_STRUCTURE`，实现了类似关系型数据库的约束机制。核心数据表（集合）结构如下：

#### 1. 用户表 (`ax_user` - `UserModel`)
管理 C 端授权用户信息及状态。
- `USER_MINI_OPENID`: String (核心外键/主键，小程序 OpenID)
- `USER_STATUS`: Int (状态：0=待审核, 1=正常)
- `USER_NAME` / `USER_MOBILE`: String (真实姓名与手机号)
- `USER_LOGIN_CNT` / `USER_LOGIN_TIME`: Int (登录统计与最后活跃时间)

#### 2. 活动/预约项目表 (`ax_meet` - `MeetModel`)
定义预约项目的基本信息、可预约时段与自定义表单配置。
- `MEET_ID`: String (业务主键)
- `MEET_TITLE`: String (项目名称)
- `MEET_DAYS`: Array (可用日期与时段的快照)
- `MEET_FORM_SET`: Array (动态表单字段设置，JSON 格式，支持自定义收集字段)
- `MEET_STYLE_SET`: Object (样式与封面图设置)
- `MEET_STATUS`: Int (状态：0=未启用, 1=使用中, 9=停止预约, 10=已关闭)

#### 3. 报名流水表 (`ax_join` - `JoinModel`)
记录用户的每一次预约行为、核销状态及填写的动态表单数据。
- `JOIN_ID`: String (业务流水号)
- `JOIN_USER_ID`: String (关联用户 ID)
- `JOIN_MEET_ID` / `JOIN_MEET_TITLE`: String (关联的项目 ID 及冗余标题)
- `JOIN_MEET_DAY` / `JOIN_MEET_TIME_START`: String (预约的具体日期与时间段)
- `JOIN_FORMS`: Array (用户填写的表单快照数据)
- `JOIN_CODE`: String (15位唯一核验码，用于线下扫码签到)
- `JOIN_IS_CHECKIN`: Int (签到状态：0=未签到, 1=已签到)
- `JOIN_STATUS`: Int (状态：1=预约成功, 10=用户取消, 99=系统取消)

#### 4. 资讯/通知表 (`ax_news` - `NewsModel`)
存储社团公告、活动简介及图文内容。
- `NEWS_ID`: String (业务主键)
- `NEWS_TYPE`: Int (类型：0=本地文章，1=外部链接)
- `NEWS_CATE_ID` / `NEWS_CATE_NAME`: String (分类映射)
- `NEWS_CONTENT`: Array (富文本内容切片，支持多图文)
- `NEWS_VIEW_CNT` / `NEWS_FAV_CNT`: Int (浏览量与收藏量)

#### 5. 其他辅助表
- **`ax_admin` (`AdminModel`)**: 后台管理员表，记录账号、密码（MD5）及权限等级。
- **`ax_setup` (`SetupModel`)**: 系统配置表，存储全局设置（如“关于我们”、联系电话、客服二维码等）。
- **`ax_log` (`LogModel`)**: 系统日志表，用于审计管理员的关键操作与系统异常。

## 3. 核心功能亮点
1. **多维度预约与核销体系**：支持按日期、时段配置预约名额，提供直观的日历视图 (`calendar_index`)，并支持管理员在线下进行扫码核销签到。
2. **移动端轻量化后台**：管理员无需依赖 PC 端，直接在小程序内即可完成资讯发布、活动创建、名单查看，并支持通过集成的 `node-xlsx` 将预约数据导出为 Excel 表格。
3. **高可用可扩展架构**：使用单体云函数分发机制，结合 `Model-Service-Controller` 分层架构，使代码具备极强的可维护性和业务水平扩展能力。
4. **动态表单配置**：内置的自定义表单组件允许活动发布者在后台灵活配置需要收集的用户报名信息（如姓名、学号、电话等），满足不同类型活动的报名需求。