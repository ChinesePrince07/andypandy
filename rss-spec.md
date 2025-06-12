# Afilmory RSS EXIF Extension Specification

## 概述

本规范定义了在 RSS 2.0 feeds 中包含摄影 EXIF 数据的标准方法，专为照片画廊网站设计。该扩展允许 RSS 阅读器和其他应用程序访问详细的摄影技术参数。

## 命名空间

XML 命名空间: `https://exif.org/rss/1.0`  
推荐前缀: `exif`

在 RSS 根元素中声明命名空间：

```xml
<rss version="2.0" 
     xmlns:atom="http://www.w3.org/2005/Atom" 
     xmlns:exif="https://exif.org/rss/1.0">
```

## EXIF 标签定义

### 相机设置参数

#### `<exif:aperture>`

**描述**: 光圈值  
**格式**: `f/{数值}`  
**示例**: `<exif:aperture>f/1.4</exif:aperture>`  
**映射**: EXIF FNumber 字段

#### `<exif:shutterSpeed>`

**描述**: 快门速度  
**格式**:

- 长曝光: `{秒数}s`
- 短曝光: `1/{分母}s`  
  **示例**:
- `<exif:shutterSpeed>1/250s</exif:shutterSpeed>`
- `<exif:shutterSpeed>2s</exif:shutterSpeed>`  
  **映射**: EXIF ExposureTime 字段

#### `<exif:iso>`

**描述**: ISO 感光度  
**格式**: 整数  
**示例**: `<exif:iso>1000</exif:iso>`  
**映射**: EXIF ISOSpeedRatings 字段

#### `<exif:exposureCompensation>`

**描述**: 曝光补偿  
**格式**: `{±数值} EV`  
**示例**:

- `<exif:exposureCompensation>+0.7 EV</exif:exposureCompensation>`
- `<exif:exposureCompensation>-1.3 EV</exif:exposureCompensation>`  
  **映射**: EXIF ExposureBiasValue 字段

### 镜头参数

#### `<exif:focalLength>`

**描述**: 实际焦距  
**格式**: `{数值}mm`  
**示例**: `<exif:focalLength>50mm</exif:focalLength>`  
**映射**: EXIF FocalLength 字段

#### `<exif:focalLength35mm>`

**描述**: 等效35mm焦距  
**格式**: `{数值}mm`  
**示例**: `<exif:focalLength35mm>75mm</exif:focalLength35mm>`  
**映射**: EXIF FocalLengthIn35mmFilm 字段

#### `<exif:lens>`

**描述**: 镜头型号  
**格式**: CDATA 包装的字符串  
**示例**: `<exif:lens><![CDATA[BS-Optics FX 50mm F1.4]]></exif:lens>`  
**映射**: EXIF LensModel 字段

### 设备信息

#### `<exif:camera>`

**描述**: 相机品牌和型号  
**格式**: CDATA 包装的字符串  
**示例**: `<exif:camera><![CDATA[FUJIFILM X-T5]]></exif:camera>`  
**映射**: EXIF Make + Model 字段组合

### 图像属性

#### `<exif:imageWidth>`

**描述**: 图像宽度（像素）  
**格式**: 整数  
**示例**: `<exif:imageWidth>7728</exif:imageWidth>`  
**映射**: 来自图像处理系统的实际宽度

#### `<exif:imageHeight>`

**描述**: 图像高度（像素）  
**格式**: 整数  
**示例**: `<exif:imageHeight>5152</exif:imageHeight>`  
**映射**: 来自图像处理系统的实际高度

#### `<exif:dateTaken>`

**描述**: 拍摄时间（原始时间戳）  
**格式**: ISO 8601 格式  
**示例**: `<exif:dateTaken>2025-06-05T16:12:43.000Z</exif:dateTaken>`  
**映射**: EXIF DateTimeOriginal 字段

## 完整示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:exif="https://exif.org/rss/1.0">
  <channel>
    <title><![CDATA[我的摄影画廊]]></title>
    <link>https://example.com</link>
    <description><![CDATA[分享我的摄影作品]]></description>
    
    <item>
      <title><![CDATA[夕阳下的城市]]></title>
      <link>https://example.com/photo123</link>
      <guid isPermaLink="true">https://example.com/photo123</guid>
      <description><![CDATA[城市天际线在夕阳下的美丽景象]]></description>
      <pubDate>Thu, 05 Jun 2025 16:12:43 GMT</pubDate>
      <category><![CDATA[风景]]></category>
      <category><![CDATA[城市]]></category>
      <enclosure url="https://example.com/thumbnails/photo123.webp" type="image/webp" length="1024000" />
      
      <!-- EXIF 数据扩展 -->
      <exif:aperture>f/1.4</exif:aperture>
      <exif:shutterSpeed>1/250s</exif:shutterSpeed>
      <exif:iso>1000</exif:iso>
      <exif:exposureCompensation>0 EV</exif:exposureCompensation>
      <exif:imageWidth>7728</exif:imageWidth>
      <exif:imageHeight>5152</exif:imageHeight>
      <exif:dateTaken>2025-06-05T16:12:43.000Z</exif:dateTaken>
      <exif:camera><![CDATA[FUJIFILM X-T5]]></exif:camera>
      <exif:lens><![CDATA[BS-Optics FX 50mm F1.4]]></exif:lens>
      <exif:focalLength>50mm</exif:focalLength>
      <exif:focalLength35mm>75mm</exif:focalLength35mm>
    </item>
  </channel>
</rss>
```

## 兼容性和实现注意事项

### 向后兼容性

- 标准的 RSS 2.0 阅读器将忽略不识别的命名空间元素
- 核心 RSS 功能（标题、链接、描述等）保持完全兼容

### 可选字段

- 所有 EXIF 标签都是可选的
- 如果某个 EXIF 数据不可用，应省略对应的标签而不是输出空值

### 数据验证

- 实现者应验证 EXIF 数据的有效性
- 对于无效或缺失的数据，建议静默跳过而不是输出错误值

### 性能考虑

- EXIF 数据提取可能影响 RSS 生成性能
- 建议在构建时预处理 EXIF 数据而非实时提取

## 版本历史

- **v1.0** (2025-01-19): 初始规范发布
  - 定义核心 EXIF 标签集合
  - 建立命名空间约定
  - 提供完整实现示例

## 许可证

本规范基于 Creative Commons Attribution 4.0 International License 发布。
