/**
 * 内置图表模板库（3.3）
 *
 * 每个模板只存储纯 <mxCell> 片段（不含根细胞 id="0"/"1"，不含外层容器），
 * 载入时统一走 wrapMxCells 包装成完整骨架——与 AI 生成链路保持一致。
 */

export interface DiagramTemplate {
  id: string;
  name: string;
  description: string;
  cells: string;
}

/** 类图样式：三栏 UML 类框 */
const CLASS_STYLE =
  "swimlane;fontStyle=0;childLayout=stackLayout;horizontal=1;startSize=26;horizontalStack=0;resizeParent=1;resizeParentMax=0;resizeLast=0;collapsible=1;marginBottom=0;whiteSpace=wrap;html=1;";

export const DIAGRAM_TEMPLATES: DiagramTemplate[] = [
  {
    id: "class-diagram",
    name: "类图模板",
    description: "包含 User / Order 两个类的简单类图",
    cells: [
      `<mxCell id="2" value="User" style="${CLASS_STYLE}" vertex="1" parent="1">`,
      `  <mxGeometry x="80" y="80" width="200" height="120" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="3" value="+ id: String&#10;+ name: String&#10;+ login(): void" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;whiteSpace=wrap;html=1;" vertex="1" parent="2">`,
      `  <mxGeometry y="26" width="200" height="94" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="4" value="Order" style="${CLASS_STYLE}" vertex="1" parent="1">`,
      `  <mxGeometry x="400" y="80" width="200" height="120" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="5" value="+ id: String&#10;+ userId: String&#10;+ total: Number" style="text;strokeColor=none;fillColor=none;align=left;verticalAlign=top;spacingLeft=4;spacingRight=4;overflow=hidden;rotatable=0;points=[[0,0.5],[1,0.5]];portConstraint=eastwest;whiteSpace=wrap;html=1;" vertex="1" parent="4">`,
      `  <mxGeometry y="26" width="200" height="94" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="6" value="" style="edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;endArrow=open;endFill=0;" edge="1" parent="1" source="2" target="4">`,
      `  <mxGeometry relative="1" as="geometry" />`,
      `</mxCell>`,
    ].join("\n"),
  },
  {
    id: "sequence-login",
    name: "登录时序图",
    description: "用户 → 前端 → 后端 的登录流程",
    cells: [
      `<mxCell id="2" value="用户" style="shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;" vertex="1" parent="1">`,
      `  <mxGeometry x="60" y="80" width="30" height="60" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="3" value="前端" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">`,
      `  <mxGeometry x="200" y="40" width="100" height="40" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="4" value="后端" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">`,
      `  <mxGeometry x="400" y="40" width="100" height="40" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="5" value="点击登录" style="html=1;verticalAlign=bottom;endArrow=open;endSize=8;dashed=0;" edge="1" parent="1" source="2" target="3">`,
      `  <mxGeometry relative="1" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="6" value="POST /login" style="html=1;verticalAlign=bottom;endArrow=open;endSize=8;dashed=0;" edge="1" parent="1" source="3" target="4">`,
      `  <mxGeometry relative="1" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="7" value="返回 token" style="html=1;verticalAlign=bottom;endArrow=open;endSize=8;dashed=1;" edge="1" parent="1" source="4" target="3">`,
      `  <mxGeometry relative="1" as="geometry" />`,
      `</mxCell>`,
    ].join("\n"),
  },
  {
    id: "er-diagram",
    name: "ER 图模板",
    description: "客户 / 订单 两个实体的关系",
    cells: [
      `<mxCell id="2" value="客户&#10;────────&#10;id (PK)&#10;name" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;" vertex="1" parent="1">`,
      `  <mxGeometry x="60" y="80" width="180" height="110" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="3" value="订单&#10;────────&#10;id (PK)&#10;customer_id (FK)" style="rounded=0;whiteSpace=wrap;html=1;align=left;verticalAlign=top;" vertex="1" parent="1">`,
      `  <mxGeometry x="360" y="80" width="180" height="110" as="geometry" />`,
      `</mxCell>`,
      `<mxCell id="4" value="1..n" style="endArrow=ERmany;startArrow=ERone;html=1;rounded=0;exitX=1;exitY=0.5;exitDx=0;exitDy=0;entryX=0;entryY=0.5;entryDx=0;entryDy=0;" edge="1" parent="1" source="2" target="3">`,
      `  <mxGeometry relative="1" as="geometry" />`,
      `</mxCell>`,
    ].join("\n"),
  },
];

/** 图表类型选择器选项（注入到生成提示词） */
export const DIAGRAM_TYPES = [
  "类图",
  "时序图",
  "用例图",
  "流程图",
  "ER 图",
] as const;
