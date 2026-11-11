# ui-interaction-prd-extract skill需求

# ui-interaction-prd-extract

## 一、目标

分析目标的代码和fairygui工程



这里要强调，分析目标是核心打牌模块，大厅lobby等其他模块暂时不用管

xuanwulobby\\assets\\42324



&nbsp;

提取出所有的ui界面 ui组件 ui交互细节

按照

1.模块

2.界面

3.组件

4.交互 状态

5.事件



分析顺序



1.划分模块 例如打牌模块

2.每个模块的流程loop

3.按照流程顺序

多少个界面

界面 一共有多少个界面和弹窗

4.每个界面包含所有的组件有哪些

组件 每个界面包含哪些组件 要划分界面专属还是 公共组件

5.每个组件是否有交互逻辑

是否有相关联的交互逻辑  不同的组件 例如按钮 列表 列表Item等

6.是否关联事件 包含 接收 和 发送 网络事件 派发的事件等

事件 组件是否会触发相关的事件



## 二、输入与输出

输入：

fairygui库

```
input-ui/
E:\WorkProjects\PrdGameSkill\input-ui\kawuxing-fgui
```

cocos工程代码库

大厅工程

E:\\WorkProjects\\PrdGameSkill\\input-ui\\xuanwulobby

核心的玩法

E:\\WorkProjects\\PrdGameSkill\\input-ui\\xuanwulobby\\assets\\42324



&nbsp;

输出（唯一交付物）：

```
examples/ui-interaction-prd-extract/
  模块分析.md
  界面分析.md
  流程分析.md
  界面/xxx界面.md
  组件/xxx组件.md
```

