import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from datetime import datetime

wb = openpyxl.Workbook()

# 样式定义
header_font = Font(bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
thin_border = Border(
    left=Side(style='thin'),
    right=Side(style='thin'),
    top=Side(style='thin'),
    bottom=Side(style='thin')
)
required_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")  # 浅黄色标记必填
example_fill = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")  # 浅绿色示例

def style_header(ws, row_num, required_cols=None):
    """设置表头样式"""
    for cell in ws[row_num]:
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border
        if required_cols and cell.column in required_cols:
            cell.fill = PatternFill(start_color="C00000", end_color="C00000", fill_type="solid")  # 深红色标记必填

def style_data_row(ws, row_num):
    """设置数据行样式"""
    for cell in ws[row_num]:
        cell.border = thin_border
        cell.alignment = Alignment(vertical="center")

def set_column_widths(ws, widths):
    """设置列宽"""
    for i, width in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = width

# ========== Sheet 1: 渠道商信息 ==========
ws1 = wb.active
ws1.title = "1-渠道商信息"

# 表头
headers1 = ["渠道商名称*", "合作级别", "所属区域*", "大区", "联系人", "联系电话", "邮箱",
            "技术服务", "渠道商等级", "上级渠道商", "备注"]
ws1.append(headers1)
style_header(ws1, 1, required_cols=[1, 3])  # 第1、3列必填

# 示例数据
example1 = ["示例科技有限公司", "gold", "山东区", "大北区", "张三", "13800138000", "zhangsan@example.com",
            "是", "primary", "", "这是一条示例数据"]
ws1.append(example1)
style_data_row(ws1, 2)
for i, cell in enumerate(ws1[2], 1):
    if i <= len(example1):
        cell.fill = example_fill

# 字段说明行
ws1.cell(row=3, column=1, value="=== 以下为空白模板，请填写您的数据 ===")
ws1.merge_cells('A3:K3')

# 空白模板行
ws1.append(["", "", "山东区", "", "", "", "", "是", "none", "", ""])
style_data_row(ws1, 4)

# 说明区域
ws1.cell(row=6, column=1, value="【字段说明】")
ws1.cell(row=7, column=1, value="渠道商名称*: 必填，唯一标识，如公司全称")
ws1.cell(row=8, column=1, value="合作级别: lep/钻石(diamond)/金牌(gold)/银牌(silver)/铜牌(bronze)，默认gold")
ws1.cell(row=9, column=1, value="所属区域*: 必填，如：山东区、安徽区、江苏区等")
ws1.cell(row=10, column=1, value="渠道商等级: primary(一级)/secondary(二级)/none(无)，默认none")
ws1.cell(row=11, column=1, value="上级渠道商: 如果是二级渠道商，填写其上级一级渠道商名称")
ws1.cell(row=12, column=1, value="技术服务: 是/否")
ws1.cell(row=13, column=1, value="")
ws1.cell(row=14, column=1, value="【注意事项】")
ws1.cell(row=15, column=1, value="1. 必填字段必须填写，否则导入失败")
ws1.cell(row=16, column=1, value="2. 渠道商名称不能与现有数据重复")
ws1.cell(row=17, column=1, value="3. 请先导入渠道商，再导入员工和客户")

set_column_widths(ws1, [25, 12, 12, 12, 12, 15, 25, 10, 12, 20, 20])

# ========== Sheet 2: 渠道商员工 ==========
ws2 = wb.create_sheet("2-渠道商员工")

headers2 = ["所属渠道商名称*", "员工姓名*", "登录账号*", "角色", "联系电话", "邮箱", "密码"]
ws2.append(headers2)
style_header(ws2, 1, required_cols=[1, 2, 3])

example2 = ["山东诚卓科技有限公司", "成卓", "cz001", "销售代表", "13800138001", "chengzhuo@example.com", "123456"]
ws2.append(example2)
style_data_row(ws2, 2)
for i, cell in enumerate(ws2[2], 1):
    if i <= len(example2):
        cell.fill = example_fill

ws2.cell(row=3, column=1, value="=== 以下为空白模板 ===")
ws2.merge_cells('A3:G3')

ws2.append(["", "", "", "销售代表", "", "", "123456"])
style_data_row(ws2, 4)

ws2.cell(row=6, column=1, value="【字段说明】")
ws2.cell(row=7, column=1, value="所属渠道商名称*: 必填，必须与\"1-渠道商信息\"中的渠道商名称一致")
ws2.cell(row=8, column=1, value="员工姓名*: 必填")
ws2.cell(row=9, column=1, value="登录账号*: 必填，唯一，用于登录系统")
ws2.cell(row=10, column=1, value="角色: partner_admin(渠道管理员)/销售代表，默认销售代表")
ws2.cell(row=11, column=1, value="密码: 默认123456，可自行修改")
ws2.cell(row=12, column=1, value="")
ws2.cell(row=13, column=1, value="【注意事项】")
ws2.cell(row=14, column=1, value="1. 登录账号不能与现有账号重复")
ws2.cell(row=15, column=1, value="2. 导入后员工初始密码为123456")

set_column_widths(ws2, [25, 12, 15, 15, 15, 25, 12])

# ========== Sheet 3: 客户报备 ==========
ws3 = wb.create_sheet("3-客户报备")

headers3 = ["客户名称*", "统一社会信用代码", "所属行业", "联系人", "联系电话",
            "邮箱", "城市地址", "所属渠道商*", "负责员工", "备注"]
ws3.append(headers3)
style_header(ws3, 1, required_cols=[1, 8])

example3 = ["山东黄金集团有限公司", "91370000XXXXXXXX", "金融", "田经理", "13800138000",
            "tian@example.com", "济南", "山东诚卓科技有限公司", "梁翠", "重点客户"]
ws3.append(example3)
style_data_row(ws3, 2)
for i, cell in enumerate(ws3[2], 1):
    if i <= len(example3):
        cell.fill = example_fill

ws3.cell(row=3, column=1, value="=== 以下为空白模板 ===")
ws3.merge_cells('A3:J3')

ws3.append(["", "", "", "", "", "", "", "", "", ""])
style_data_row(ws3, 4)

ws3.cell(row=6, column=1, value="【字段说明】")
ws3.cell(row=7, column=1, value="客户名称*: 必填，唯一标识客户")
ws3.cell(row=8, column=1, value="统一社会信用代码: 18位代码，用于去重")
ws3.cell(row=9, column=1, value="所属行业: 金融/制造/教育/医疗/互联网/政府等")
ws3.cell(row=10, column=1, value="所属渠道商*: 必填，必须与\"1-渠道商信息\"中的渠道商名称一致")
ws3.cell(row=11, column=1, value="负责员工: 必须与\"2-渠道商员工\"中的员工姓名一致")
ws3.cell(row=12, column=1, value="")
ws3.cell(row=13, column=1, value="【注意事项】")
ws3.cell(row=14, column=1, value="1. 同一渠道商下，客户名称不能重复")
ws3.cell(row=15, column=1, value="2. 统一社会信用代码重复也会被拦截")
ws3.cell(row=16, column=1, value="3. 报备状态默认\"已审批\"(approved)")

set_column_widths(ws3, [30, 20, 12, 12, 15, 25, 15, 25, 12, 20])

# ========== Sheet 4: 商机管理 ==========
ws4 = wb.create_sheet("4-商机管理")

headers4 = ["商机名称*", "客户名称*", "所属行业", "联系人", "联系电话",
            "销售阶段", "预估金额(万元)", "终端数量", "所属渠道商*", "负责员工",
            "关联报备客户", "预计签约时间", "备注"]
ws4.append(headers4)
style_header(ws4, 1, required_cols=[1, 2, 9])

example4 = ["黄金集团XCAD项目", "山东黄金集团有限公司", "金融", "田经理", "13800138000",
            "qualification", "50", "500", "山东诚卓科技有限公司", "梁翠",
            "山东黄金集团有限公司", "2026-06-30", "重点跟进中"]
ws4.append(example4)
style_data_row(ws4, 2)
for i, cell in enumerate(ws4[2], 1):
    if i <= len(example4):
        cell.fill = example_fill

ws4.cell(row=3, column=1, value="=== 以下为空白模板 ===")
ws4.merge_cells('A3:M3')

ws4.append(["", "", "", "", "", "prospecting", "", "", "", "", "", "", ""])
style_data_row(ws4, 4)

ws4.cell(row=6, column=1, value="【字段说明】")
ws4.cell(row=7, column=1, value="商机名称*: 必填")
ws4.cell(row=8, column=1, value="客户名称*: 必填，必须与\"3-客户报备\"中的客户名称一致（用于关联）")
ws4.cell(row=9, column=1, value="销售阶段: prospecting(初步接触)/qualification(需求确认)/proposal(方案报价)/negotiation(商务谈判)/won(赢单)/lost(输单)")
ws4.cell(row=10, column=1, value="预估金额: 数字，单位万元")
ws4.cell(row=11, column=1, value="终端数量: 数字，如500表示500个终端")
ws4.cell(row=12, column=1, value="所属渠道商*: 必填，必须与\"1-渠道商信息\"中的渠道商名称一致")
ws4.cell(row=13, column=1, value="负责员工: 必须与\"2-渠道商员工\"中的员工姓名一致")
ws4.cell(row=14, column=1, value="关联报备客户: 可留空，会自动关联到同名的已报备客户")
ws4.cell(row=15, column=1, value="预计签约时间: 格式YYYY-MM-DD，如2026-06-30")
ws4.cell(row=16, column=1, value="")
ws4.cell(row=17, column=1, value="【销售阶段说明】")
ws4.cell(row=18, column=1, value="prospecting: 初步接触 (0%)")
ws4.cell(row=19, column=1, value="qualification: 需求确认 (10-20%)")
ws4.cell(row=20, column=1, value="proposal: 方案报价 (30-50%)")
ws4.cell(row=21, column=1, value="negotiation: 商务谈判 (70-90%)")
ws4.cell(row=22, column=1, value="won: 赢单 (100%)")
ws4.cell(row=23, column=1, value="lost: 输单 (0%)")

set_column_widths(ws4, [25, 25, 10, 12, 15, 15, 12, 10, 25, 12, 25, 15, 20])

# 保存文件
output_path = "d:/远程交付中心文件/建设材料/AI项目及frp/联软渠道管理平台/项目文件夹/lianruan-crm-deploy-v2.2.0/CRM数据导入模板.xlsx"
wb.save(output_path)
print(f"模板已创建: {output_path}")
