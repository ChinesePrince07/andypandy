# 字体提取系统

## 概述

为了解决在某些 Linux 系统上英文字体渲染效果不佳的问题，我们开发了一个字体提取系统，可以从系统中的真实字体文件中提取字形路径，生成基于 SVG 的文本渲染器。

## 特性

- ✅ **真实字体提取**: 从系统字体文件中提取真实的字形轮廓
- ✅ **高质量渲染**: 基于矢量路径，确保在任何尺寸下都清晰
- ✅ **跨平台一致性**: 在所有操作系统上获得相同的渲染效果
- ✅ **自动备份**: 提取前自动备份原有文件
- ✅ **完整字符集**: 支持大小写字母、数字和常用符号

## 使用方法

### 提取字体

```bash
npm run extract:font
```

这个命令会：
1. 搜索系统中可用的字体文件
2. 从字体中提取字形路径
3. 生成新的 SVG 文本渲染器
4. 自动备份原有文件

### 测试效果

```bash
npm run test:svg-font
```

生成对比图片来验证字体渲染效果。

### 生成 OG 图片

```bash
npm run build:og
```

使用新的字体渲染器生成 OG 图片。

## 支持的字体

系统会按优先级搜索以下字体：

### macOS
- SF Compact (推荐) - Apple 的现代无衬线字体
- Geneva - 经典的 macOS 字体

### Linux
- Liberation Sans - 开源的 Arial 替代品
- DejaVu Sans - 高质量的开源字体

### 通用
- Helvetica (TTF 格式)
- Arial

## 技术实现

### 字体加载
使用 `opentype.js` 库解析字体文件：

```typescript
const font = await opentype.load(fontPath)
const glyph = font.charToGlyph(char)
```

### 路径标准化
将字体单位转换为标准化的 SVG 路径：

```typescript
function normalizeGlyphPath(path: opentype.Path, unitsPerEm: number): string {
  const scale = 100 / unitsPerEm // 缩放到 100 单位高度
  // 转换坐标系（Y 轴翻转）
  const y = 100 - cmd.y * scale
  return commands.join(' ')
}
```

### 代码生成
自动生成包含所有字形数据的 TypeScript 文件：

```typescript
const HELVETICA_CHARACTERS: Record<string, CharacterPath> = {
  'A': {
    path: 'M 10.2 100.0 L 34.3 0.0 L 34.3 0.0 ...',
    width: 68.6,
    height: 100,
    advanceWidth: 68.6
  },
  // ... 更多字符
}
```

## 字形数据结构

每个字符包含以下信息：

```typescript
interface CharacterPath {
  path: string        // SVG 路径数据
  width: number       // 字符宽度
  height: number      // 字符高度（固定为 100）
  advanceWidth: number // 字符间距
}
```

## 渲染优化

### 填充渲染
普通字体使用填充模式：
```svg
<path d="..." fill="white" />
```

### 粗体渲染
粗体字体同时使用填充和描边：
```svg
<path d="..." fill="white" stroke="white" stroke-width="1.5" />
```

## 优势

1. **精确性**: 直接使用字体文件中的原始字形数据
2. **一致性**: 在所有平台上获得相同的渲染效果
3. **质量**: 基于矢量路径，支持任意缩放
4. **性能**: 预处理的路径数据，运行时性能优异
5. **兼容性**: 不依赖系统字体渲染引擎

## 注意事项

1. **字体格式**: 目前只支持 TTF 格式，不支持 TTC (TrueType Collection)
2. **字符集**: 提取的字符集是预定义的，如需新字符需要重新提取
3. **文件大小**: 生成的文件会比原来的手工路径稍大
4. **字体许可**: 确保使用的字体允许提取和使用

## 故障排除

### 字体未找到
如果系统中没有找到合适的字体，可以：
1. 安装推荐的字体
2. 修改 `HELVETICA_FONT_PATHS` 数组添加自定义路径
3. 使用在线字体服务

### TTC 格式错误
如果遇到 "Unsupported OpenType signature ttcf" 错误：
1. 寻找 TTF 格式的替代字体
2. 使用字体转换工具将 TTC 转换为 TTF

### 字形缺失
如果某些字符没有字形：
1. 检查字体是否包含该字符
2. 更换包含更完整字符集的字体
3. 为缺失字符提供后备方案

## 未来改进

- [ ] 支持 TTC 格式字体
- [ ] 支持更多字符和 Unicode 范围
- [ ] 字形路径压缩优化
- [ ] 支持字体变体（Light、Medium、Bold 等）
- [ ] 在线字体提取服务