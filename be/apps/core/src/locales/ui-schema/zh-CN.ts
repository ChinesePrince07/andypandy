const zhCnUiSchema = {
  settings: {
    title: '系统设置',
    description: '管理 AFilmory 的全局行为与服务接入。',
  },
  builder: {
    title: '构建器设置',
    description: '配置照片构建任务的并发、日志与仓库同步策略。',
    sections: {
      processing: {
        title: '处理与性能',
        description: '控制并发数量、Live Photo 行为以及文件 ID 规则。',
        groups: {
          concurrency: {
            title: '并发控制',
            fields: {
              'default-concurrency': {
                title: '默认并发数',
                description: '单次构建任务允许的最大并发处理数。',
                helper: '建议设置为 CPU 核心数的 1-2 倍。',
              },
              'worker-concurrency': {
                title: 'Worker 内部并发',
                description: '使用集群模式时，每个 Worker 进程内部允许的并发任务数。',
              },
              'worker-count': {
                title: '最大 Worker 数',
                description: '集群模式下最多可启动的 Worker 进程数量。',
              },
              'worker-timeout': {
                title: 'Worker 超时时间（毫秒）',
                description: '单个 Worker 在无响应情况下的退出时间，单位为毫秒。',
              },
            },
          },
          behavior: {
            title: '处理行为',
            fields: {
              'enable-live-photo': {
                title: '启用 Live Photo 检测',
                description: '检测 HEIC 与 MP4 的配对关系，并为 Live Photo 生成合集。',
                true: '已启用',
                false: '已关闭',
              },
              'digest-suffix-length': {
                title: '摘要后缀长度',
                description: '在照片 ID 末尾追加 SHA-256 摘要以避免命名冲突，0 表示禁用。',
              },
              'supported-formats': {
                title: '允许的图片格式',
                description: '可选，使用逗号分隔的扩展示例：jpg,png,heic。留空表示不限制。',
              },
            },
          },
        },
      },
      observability: {
        title: '日志与可观测性',
        description: '控制日志级别、进度输出与集群策略。',
        groups: {
          progress: {
            title: '进度反馈',
            fields: {
              'show-progress': {
                title: '显示终端进度条',
                description: '在 CLI 中实时输出处理进度。',
              },
              'show-detailed-stats': {
                title: '输出详细统计',
                description: '构建完成后打印耗时、增量统计等信息。',
              },
              'use-cluster-mode': {
                title: '启用集群模式',
                description: '在多核环境下使用 Node.js Cluster 分裂多个 Worker 进程。',
              },
            },
          },
          logging: {
            title: '日志级别',
            fields: {
              'logging-level': {
                title: '日志等级',
                description: '控制 CLI 输出的详细程度。',
                placeholder: '选择日志等级',
              },
              'logging-verbose': {
                title: '启用 Verbose 模式',
                description: '输出更详细的调试日志。',
              },
              'logging-output': {
                title: '写入日志文件',
                description: '在 CLI 目录下输出构建日志文件，便于排查问题。',
              },
            },
          },
        },
      },
    },
  },
  site: {
    title: '站点设置',
    description: '配置前台站点的品牌信息、社交链接与地图体验。',
    sections: {
      basic: {
        title: '基础信息',
        description: '展示在导航栏、首页标题与 SEO 中。',
        fields: {
          'site-name': {
            title: '站点名称',
            description: '显示在站点导航栏和页面标题中。',
            placeholder: '请输入站点名称',
          },
          'site-title': {
            title: '首页标题',
            description: '用于浏览器标签页及 SEO 标题。',
            placeholder: '请输入首页标题',
          },
          'site-description': {
            title: '站点描述',
            description: '展示在站点简介及搜索引擎摘要中。',
            placeholder: '请输入站点描述…',
          },
          'site-url': {
            title: '站点 URL',
            description: '站点对外访问的主域名，必须为绝对地址。',
            placeholder: 'https://afilmory.innei.in',
          },
          'site-accent-color': {
            title: '品牌主题色',
            description: '用于按钮、强调文本等高亮元素，支持 HEX 格式。',
            helper: '示例：#007bff',
          },
        },
      },
      social: {
        title: '社交与订阅',
        description: '配置展示在站点页脚与关于区域的社交账号。',
        groups: {
          channels: {
            title: '社交渠道',
            description: '填写完整的链接或用户名，展示在站点社交区块。',
            fields: {
              twitter: {
                title: 'Twitter',
                helper: '支持完整链接或 @用户名。',
              },
              github: {
                title: 'GitHub',
                helper: '支持完整链接或用户名。',
              },
              rss: {
                title: '生成 RSS 订阅源',
                description: '启用后将在前台站点暴露 RSS 订阅入口。',
                helper: '开启后访客可通过 RSS 订阅最新照片。',
              },
            },
          },
        },
      },
      feed: {
        title: 'Feed 设置',
        description: '配置第三方 Feed 数据源，用于聚合内容。',
        groups: {
          folo: {
            title: 'Folo Challenge',
            description: '同步 Folo Challenge 数据所需的 Feed ID 与用户 ID。',
            fields: {
              'feed-id': {
                title: 'Feed ID',
                placeholder: '请输入 Feed ID',
              },
              'user-id': {
                title: 'User ID',
                placeholder: '请输入 User ID',
              },
            },
          },
        },
      },
      map: {
        title: '地图展示',
        description: '配置地图组件可用的提供商、样式与投影。',
        fields: {
          providers: {
            title: '地图提供商列表',
            description: '使用 JSON 数组表示优先级列表，例如 ["maplibre"]。',
            helper: '留空则禁用地图功能。',
          },
          style: {
            title: '地图样式',
            description: '填写 MapLibre Style URL，或使用 builtin 选择内置样式。',
            helper: '示例：builtin 或 https://tiles.example.com/style.json',
          },
          projection: {
            title: '地图投影',
            description: '选择地图渲染的投影方式。',
            helper: '默认为 mercator，可根据需求切换为 globe。',
            placeholder: '选择投影方式',
          },
        },
      },
    },
  },
  system: {
    title: '平台设置',
    description: '管理整个平台的注册入口、登录策略与 OAuth 配置。',
    sections: {
      registration: {
        title: '全局注册策略',
        description: '控制新用户注册配额以及本地账号能力。',
        fields: {
          'allow-registration': {
            title: '允许新用户注册',
            description: '关闭后仅超级管理员可以手动添加账号。',
          },
          'local-provider': {
            title: '启用本地登录（邮箱/密码）',
            description: '关闭后普通用户只能使用第三方登录渠道。',
          },
          'base-domain': {
            title: '平台基础域名',
            description: '用于解析子域名租户，如 example.domain.com。更新后请确保证书和 DNS 已配置。',
            helper: '留空使用默认域名 afilmory.art。',
            placeholder: 'afilmory.art',
          },
          'max-users': {
            title: '全局可注册用户上限',
            description: '达到上限后阻止新的注册，留空表示不限制。',
            helper: '设置为 0 时将立即阻止新的用户注册。',
            placeholder: '无限制',
          },
        },
      },
      billing: {
        title: '订阅计划配置',
        description: '为每个订阅计划定义资源限制、价格展示与 Creem 商品映射。',
        fields: {
          quota: {
            helper: '留空表示遵循默认或不限，填写数字后将覆盖对应计划。',
            'monthly-asset': {
              title: '每月可新增照片（张）',
              description: '达到上限后将阻止新增照片。留空表示回退到默认值或不限。',
              placeholder: '例如 300',
            },
            'library-limit': {
              title: '图库容量限制（张）',
              description: '限制单个租户可管理的照片数量，0 表示完全禁止新增。',
              placeholder: '例如 500',
            },
            'upload-limit': {
              title: '后台上传大小上限（MB）',
              description: '单次上传的最大文件体积，留空表示默认或无限制。',
              placeholder: '例如 20',
            },
            'sync-limit': {
              title: '同步素材大小上限（MB）',
              description: 'Data Sync 导入时允许的最大文件尺寸。',
              placeholder: '例如 50',
            },
          },
          pricing: {
            'monthly-price': {
              title: '月度定价',
              description: '用于展示的价格或 Creem 产品价格，留空保留默认值。',
              placeholder: '例如 49',
              helper: '留空表示暂不展示定价信息。',
            },
            currency: {
              title: '币种',
              description: 'ISO 货币代码，如 CNY、USD 等。',
              placeholder: 'CNY',
              helper: '留空表示使用默认币种或不展示。',
            },
          },
          payment: {
            'creem-product': {
              title: 'Creem Product ID',
              description: '用于创建结算会话的 Creem 商品 ID。留空表示该计划不会显示升级入口。',
              placeholder: 'prod_xxx',
            },
            helper: '为空将隐藏升级入口。',
          },
        },
        plans: {
          free: {
            title: 'Free 计划（free）',
            description: '默认入门方案，适用于个人与试用场景。',
          },
          pro: {
            title: 'Pro 计划（pro）',
            description: '专业方案，预留给即将上线的订阅。',
          },
          friend: {
            title: 'Friend 计划（friend）',
            description: '内部使用的好友方案，没有任何限制，仅超级管理员可设置。',
          },
        },
      },
      oauth: {
        title: 'OAuth 登录渠道',
        description: '统一配置所有租户可用的第三方登录渠道。',
        fields: {
          gateway: {
            title: 'OAuth 网关地址',
            description: '所有第三方登录统一走该回调入口（例如 https://auth.afilmory.art）。留空则回退到租户域名。',
            helper: '必须包含 http/https 协议，结尾无需斜杠。',
            placeholder: 'https://auth.afilmory.art',
          },
        },
        groups: {
          google: {
            title: 'Google OAuth',
            description: '在 Google Cloud Console 中创建 OAuth 应用后填入以下信息。',
            fields: {
              'client-id': {
                title: 'Client ID',
                description: 'Google OAuth 的客户端 ID。',
                placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com',
              },
              'client-secret': {
                title: 'Client Secret',
                description: 'Google OAuth 的客户端密钥。',
                placeholder: '************',
              },
            },
          },
          github: {
            title: 'GitHub OAuth',
            description: 'GitHub Developer settings 中创建 OAuth App 后填入以下信息。',
            fields: {
              'client-id': {
                title: 'Client ID',
                description: 'GitHub OAuth 的客户端 ID。',
                placeholder: 'Iv1.xxxxxxxxxxxxxxxx',
              },
              'client-secret': {
                title: 'Client Secret',
                description: 'GitHub OAuth 的客户端密钥。',
                placeholder: '****************',
              },
            },
          },
        },
      },
    },
  },
} as const

export default zhCnUiSchema
