# 字段字典

说明：业务实体存放在 `entities.data_json` 中，本字典按实体类型列出 JSON 字段、推断类型和样例形态。样例仅用于字段理解，真实交付库已脱敏。

## users

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | A001<br>A002<br>A003 |
| username | string | admin<br>admin_ah<br>admin_js |
| name | string | 联软科技超级管理员<br>安徽区管理员<br>江苏区管理员 |
| role | string | superadmin<br>admin<br>admin |
| password | string | 123456<br>123456<br>123456 |
| region | string | 安徽区<br>江苏区<br>上海区（非金） |
| bigRegion | string | 大东区<br>大东区<br>大东区 |
| avatar | string | 超<br>皖<br>苏 |
| remark | string | 超级管理员，不可删除 |
| status | string | active<br>active<br>active |
| createdAt | string | 2026-04-01T18:24:07.724Z<br>2026-04-13T05:52:37.468Z<br>2026-04-28T06:17:46.162Z |
| partnerId | string | P001<br>P001<br>P001 |
| partnerName | string | 山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司 |
| phone | string | 15269139027<br>15688883615<br>15628780562 |
| email | string | 1041021475@qq.com<br>3111824108@qq.com<br>554049046@qq.com |
| createdBy | string | A001<br>A001<br>A001 |
| createdByRole | string | superadmin<br>superadmin<br>superadmin |
| updatedBy | string | A001<br>A001<br>A001 |
| updatedAt | string | 2026-04-28T06:42:35.036Z<br>2026-04-28T06:42:35.036Z<br>2026-04-28T06:42:35.036Z |
| approvedAt | string | 2026-05-07T04:18:24.409Z<br>2026-05-28T06:10:47.887Z |
| lastLogin | string | 2026-06-08T08:53:57.087Z<br>2026-06-07T12:09:08.871Z<br>2026-06-02T08:06:28.676Z |
| lastLoginType | string | iam_h5_sso<br>iam_h5_sso<br>iam_h5_sso |
| ssoProvider | string | iam_h5<br>iam_h5<br>iam_h5 |
| ssoSubject | string | 6560853721999106621<br>2507890367242045591<br>6561613284872853552 |
| staffRole | string | 销售代表 |
| approvedBy | string | A030 |

## partners

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | P001<br>P002<br>P003 |
| name | string | 山东诚卓信息技术有限公司<br>山东华安赛服智能科技有限公司<br>北京思源佳通科技有限公司 |
| level | string | lep<br>lep<br>lep |
| partnerLevel | string | secondary<br>primary<br>none |
| parentPartnerId | string\|null | P002 |
| parentPartnerIds | array | ["P002"]<br>[]<br>[] |
| partnerLevelSetBy | string\|null | A001<br>A001<br>A001 |
| partnerLevelSetAt | string\|null | 2026-05-22T07:32:14.546Z<br>2026-05-20T07:56:21.197Z<br>2026-05-28T06:12:56.699Z |
| region | string | 山东区<br>山东区<br>山东区 |
| bigRegion | string | 大北区<br>大北区<br>大北区 |
| contact | string | 梁翠<br>张东<br>李金刚 |
| phone | string | 18660115073<br>18953522876<br>13589253036 |
| email | string | 18611703654@126.com<br>sunzhongpeng@hycs.info.com<br>zhichunhui@qidi-it.com |
| status | string | active<br>active<br>active |
| joinDate | string | 2026-04-28<br>2026-04-28<br>2026-04-28 |
| quoteCount | number | 1<br>1<br>0 |
| orderCount | number | 1<br>2<br>0 |
| totalAmt | number | 0<br>0<br>0 |
| staff | array | [{"id":"S001-04","userId":"S003","username":"liuzhen","name":"刘振","phone":"15269139027","email":"1041021475@qq.com","sta<br>[{"id":"S002-01","userId":"S022","username":"shangxichao","name":"商希超","role":"销售代表","phone":"18953522876","email":"shan<br>[] |
| createdBy | string | A001<br>A001<br>A001 |
| createdByRole | string | superadmin<br>superadmin<br>superadmin |
| isTechService | boolean | false<br>false<br>false |
| updatedAt | string | 2026-05-22T07:32:14.546Z<br>2026-05-20T07:56:21.197Z<br>2026-05-06T08:51:26.672Z |
| techServiceType | string | none<br>none<br>none |
| updatedBy | string | A001 |
| approvedBy | string | A030 |
| approvedAt | string | 2026-05-26T09:29:33.013Z |
| remark | string |  |

## registrations

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | REG-1777425518310-1<br>REG-1777425518310-2<br>REG-1777425518310-3 |
| customer | string | 山东渤海实业集团有限公司<br>银座集团股份有限公司<br>山东新华制药股份有限公司 |
| creditCode | string | 91371600706390568B<br>91370000163045062F<br>91370000164102287B |
| industry | string | 制造业<br>商贸零售<br>生物制药 |
| contact | string | 孙彭<br>王晓琳<br>魏玉友 |
| phone | string | 18678900629<br>15866810768<br>19953230103 |
| address | string | 潍坊市坊子区龙山路3433号<br>中国 山东 济南市 历下区<br>中国 天津 天津市 和平区 |
| assignedStaffId | string | S003<br>S004<br>S012 |
| assignedStaffName | string | 刘振<br>周丽姣<br>陈雷振 |
| partnerId | string | P001<br>P001<br>P001 |
| partnerName | string | 山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司 |
| region | string | 山东区<br>山东区<br>山东区 |
| status | string | approved<br>approved<br>approved |
| approvedAt | string | 2026-04-29T01:18:38.310Z<br>2026-04-29T01:18:38.310Z<br>2026-04-29T01:18:38.310Z |
| approvedBy | string | A001<br>A001<br>A001 |
| createdBy | string | S003<br>S004<br>S012 |
| createdByName | string | 刘振<br>周丽姣<br>陈雷振 |
| createdAt | string | 2026-04-29T01:18:38.310Z<br>2026-04-29T01:18:38.310Z<br>2026-04-29T01:18:38.310Z |
| expireAt | string | 2026-10-26T01:18:38.310Z<br>2026-10-26T01:18:38.310Z<br>2026-10-26T01:18:38.310Z |
| updatedBy | string | A001<br>A001<br>A001 |
| updatedAt | string | 2026-04-29T02:01:09.133Z<br>2026-04-29T02:01:09.133Z<br>2026-04-29T02:01:09.133Z |
| legalPerson | string | -<br>李金泉 |
| companyStatus | string | 88991<br>88992<br>88991 |
| email | string |  |
| city | string | 山东省潍坊市<br>山东省潍坊市<br>山东省青岛市 |
| owner | string | A013<br>A013<br>A013 |
| hasOpportunity | boolean | true<br>true<br>true |
| assignedPartnerId | string | P004<br>P004<br>P005 |
| assignedPartnerName | string | 山东凯航信息科技有限公司<br>山东凯航信息科技有限公司<br>青岛惠创联成电子科技有限公司 |
| project | string | 高密电子政务网准入<br>坊子区医院NXG<br>青岛大学附属心血管病医院准入 |
| endpointRange | string | 500以上<br>200~500<br>200~500 |
| estimatedAmt | string | 50<br>10<br>5 |
| signDate | string | 2026-10-14<br>2026-10-20<br>2026-10-30 |
| protectDays | number | 90<br>180<br>180 |
| notes | string | 竞争对手蓝盾 |
| remark | string |  |

## opportunities

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | OPP-1778134298304-1<br>OPP-1778134298304-2<br>OPP-1778134298304-3 |
| name | string | 渤海实业XCAD<br>银座集团准入桌管<br>银座集团SDP |
| customer | string | 山东渤海实业集团有限公司<br>银座集团股份有限公司<br>银座集团股份有限公司 |
| regId | string | REG-1777425518310-1<br>REG-1777425518310-2<br>REG-1777425518310-2 |
| amount | number | 0<br>0<br>0 |
| expectedClose | string | 2026-09-17<br>2026-07-23 |
| stage | string | cancelled<br>10%见面并明确需求<br>10%见面并明确需求 |
| industry | string | 制造<br>制造<br>制造 |
| contact | string | 陈一鸣<br>陈一鸣<br>舒珩 |
| phone | string | 15550047933<br>15550047933<br>15192888211 |
| remark | string |  |
| assignedStaffId | string | S003<br>S004<br>S004 |
| assignedStaffName | string | 刘振<br>周丽姣<br>周丽姣 |
| partnerId | string | P001<br>P001<br>P001 |
| partnerName | string | 山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司<br>山东诚卓信息技术有限公司 |
| region | string | 山东区<br>山东区<br>山东区 |
| createdBy | string | S003<br>S004<br>S004 |
| createdByName | string | 刘振<br>周丽姣<br>周丽姣 |
| owner | string | 刘振<br>周丽姣<br>周丽姣 |
| tags | array | []<br>[]<br>[] |
| lastFollowAt | string | 2026-06-11 |
| createdAt | string | 2026-05-07T06:11:38.304Z<br>2026-05-07T06:11:38.304Z<br>2026-05-07T06:11:38.304Z |
| updatedAt | string | 2026-05-29T05:25:04.341Z<br>2026-05-07T06:19:09.729Z<br>2026-05-07T06:19:09.729Z |
| updatedBy | string | A001<br>A001<br>A001 |
| endpoints | number | 400<br>0<br>0 |
| source | string | 渠道推荐<br>渠道推荐<br>渠道推荐 |
| ownerId | string | A013<br>A013<br>A013 |
| quoteId | null\|string | QT-1780908381521 |
| notes | string |  |
| followUps | array | []<br>[]<br>[] |
| assignedPartnerId | string | P005<br>P002<br>P002 |
| assignedPartnerName | string | 青岛惠创联成电子科技有限公司<br>山东华安赛服智能科技有限公司<br>山东华安赛服智能科技有限公司 |
| contactPerson | string |  |
| contactPhone | string |  |

## quotes

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | QT-1779847182350<br>QT-1780908381521<br>QT-1781148190669 |
| customer | string | 山东碧海机械科技有限公司<br>山东碧海机械科技有限公司<br>测试--北京市工业设计 |
| regId | string | REG-2026-950281<br>REG-2026-950281<br>REG-1781148127559 |
| oppIds | array | ["OPP-1779847047385"]<br>["OPP-1780908364991"]<br>["OPP-1781148163985"] |
| oppId | string | OPP-1779847047385<br>OPP-1780908364991<br>OPP-1781148163985 |
| endpoints | number | 267<br>1<br>100 |
| products | array | ["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-04","FEAT-MOD-LEP-01-02","FEAT-MOD-LEP-01-07","FEAT-MOD-LEP-01-03","FEAT-MOD-LEP-<br>["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-02","FEAT-MOD-LEP-01-04","FEAT-MOD-LEP-01-06","FEAT-MOD-LEP-01-07","FEAT-MOD-LEP-<br>["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-09","FEAT-MOD-LEP-01-15","FEAT-MOD-LEP-01-08"] |
| hardwareIds | array | []<br>[]<br>[] |
| quoteMode | string | custom<br>package<br>custom |
| packageId | string | PKG-1779260271109 |
| total | number | 456570<br>0<br>8250 |
| validDays | number | 30<br>30<br>30 |
| ownerId | string | A013<br>A022<br>PA001 |
| createdBy | string | A013<br>A022<br>PA001 |
| assignedStaffId | string | A013<br>A022<br>PA001 |
| region | string | 山东区<br>山东区<br>山东区 |
| partnerName | string | 临沂普悦天诚信息科技有限公司<br>临沂普悦天诚信息科技有限公司<br>山东诚卓信息技术有限公司 |
| partnerId | string | P025<br>P025<br>P001 |
| assignedPartnerName | string | 临沂普悦天诚信息科技有限公司<br>临沂普悦天诚信息科技有限公司<br>山东诚卓信息技术有限公司 |
| assignedPartnerId | string | P025<br>P025<br>P001 |
| assignedStaffName | string | 舒珩<br>舒珩<br>梁翠 |
| createdByName | string | 山东区管理员<br>梁婉琦<br>梁翠 |
| status | string | draft<br>converted<br>converted |
| createdAt | string | 2026-05-27T01:59:42.350Z<br>2026-06-08T08:46:21.521Z<br>2026-06-11T03:23:10.669Z |
| hasSensitiveKeywordWorkload | boolean | true<br>false<br>false |
| standardPersonDays | number | 15<br>2.5<br>2.5 |
| workloadRuleId | string | IWR-4-4<br>IWR-1-1<br>IWR-1-1 |
| workloadRuleName | string | DES 201-500点 含敏感关键字<br>EPP 1-100点<br>EPP 1-100点 |
| workloadClassifications | object | {"productType":"DES","sensitiveKeyword":true,"matchedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-02","FEAT-MOD-LE<br>{"productType":"EPP","sensitiveKeyword":false,"matchedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-02","FEAT-MOD-L<br>{"productType":"EPP","sensitiveKeyword":false,"matchedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-08","FEAT-MOD-L |
| workloadSummary | string | DES 201-500点，含敏感关键字，建议 15 人天<br>EPP 1-100点，建议 2.5 人天<br>EPP 1-100点，建议 2.5 人天 |
| workloadSnapshot | object | {"endpoints":267,"pointLabel":"201-500点","selectedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-04","FEAT-MOD-LEP-0<br>{"endpoints":1,"pointLabel":"1-100点","selectedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-02","FEAT-MOD-LEP-01-04<br>{"endpoints":100,"pointLabel":"1-100点","selectedFeatureIds":["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-09","FEAT-MOD-LEP-01- |
| workloadCalculatedAt | string | 2026-05-28T06:09:57.921Z<br>2026-06-08T08:46:21.522Z<br>2026-06-11T03:23:10.669Z |
| featurePointOverrides | object | {}<br>{}<br>{} |
| updatedAt | string | 2026-05-28T06:09:57.921Z<br>2026-06-08T08:46:40.498Z<br>2026-06-11T03:23:16.054Z |
| statusHistory | array | [{"from":"draft","to":"converted","operatorId":"A022","operatorName":"梁婉琦","changedAt":"2026-06-08T08:46:40.498Z"}]<br>[{"from":"draft","to":"converted","operatorId":"PA001","operatorName":"梁翠","changedAt":"2026-06-11T03:23:16.054Z"}] |
| originalTotal | number | 27500<br>115500 |
| discountAmount | number | 19250<br>92400 |

## orders

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | ORD-1780908400434<br>ORD-1781148196042<br>ORD-1781148312532 |
| quoteId | string | QT-1780908381521<br>QT-1781148190669<br>QT-1781148309806 |
| customer | string | 山东碧海机械科技有限公司<br>测试--北京市工业设计<br>谱尼测试集团股份有限公司 |
| total | number | 0<br>8250<br>23100 |
| deliveryAddr | string | 山东省临沂市<br>中国 北京 北京市 朝阳区<br>中国 北京 北京市 海淀区 |
| contacts | string | 舒珩 15192888211<br>123 16455236501<br>123 16544521652 |
| region | string | 山东区<br>山东区<br>山东区 |
| regId | string | REG-2026-950281<br>REG-1781148127559<br>REG-1781148262425 |
| oppId | string | OPP-1780908364991<br>OPP-1781148163985<br>OPP-1781148293251 |
| createdBy | string | A022<br>PA001<br>S022 |
| assignedStaffId | string | A022<br>PA001<br>S022 |
| createdByName | string | 梁婉琦<br>梁翠<br>商希超 |
| partnerName | string | 临沂普悦天诚信息科技有限公司<br>山东诚卓信息技术有限公司<br>山东华安赛服智能科技有限公司 |
| partnerId | string | P025<br>P001<br>P002 |
| parentPartnerId | null\|string | P002 |
| assignedPartnerName | string | 临沂普悦天诚信息科技有限公司<br>山东华安赛服智能科技有限公司<br>山东华安赛服智能科技有限公司 |
| assignedPartnerId | string | P025<br>P002<br>P002 |
| assignedStaffName | string | 舒珩<br>梁翠<br>商希超 |
| status | string | cancelled<br>primary_confirmed<br>pending |
| createdAt | string | 2026-06-08T08:46:40.434Z<br>2026-06-11T03:23:16.042Z<br>2026-06-11T03:25:12.532Z |
| statusHistory | array | [{"from":"pending","to":"processing","operatorId":"A022","operatorName":"梁婉琦","operatorRole":"superadmin","remark":"厂商已确<br>[{"from":"pending","to":"primary_confirmed","operatorId":"PA001","operatorName":"张东","operatorRole":"primary_partner","r |
| updatedAt | string | 2026-06-08T08:53:17.326Z |
| lastOperatorId | string | A022 |
| lastOperatorName | string | 梁婉琦 |
| lastOperatorRole | string | superadmin |
| primaryConfirmedBy | string | PA001 |
| primaryConfirmedByName | string | 张东 |
| primaryConfirmedAt | string | 2026-06-11T03:23:32.879Z |
| primaryConfirmRemark | string |  |

## categories

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | CAT-LEP<br>CAT-MAINTENANCE<br>CAT-1779261229045 |
| name | string | 联软ESPP企业安全监测保护平台软件V5.0<br>维保产品模块<br>UniXCAD联软国产化身份目录与域管安全系统V5.0 |
| type | string | software<br>software<br>software |
| icon | string | 🛡️<br>🔧<br>📦 |
| sort | number | 1<br>2<br>3 |
| status | string | active<br>active<br>active |
| desc | string | 联软ESPP企业安全监测保护平台软件V5.0<br>标准维保服务、原厂现场人工服务等<br>UniXCAD联软国产化身份目录与域管安全系统V5.0 |
| createdAt | string | 2026-04-12<br>2026-04-19<br>2026-05-20T07:13:49.045Z |
| published | boolean | true |

## modules

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | MOD-LEP-01<br>MOD-LEP-02<br>MOD-LEP-03 |
| categoryId | string | CAT-LEP<br>CAT-LEP<br>CAT-LEP |
| name | string | 桌面安全管理<br>防泄密<br>防勒索 |
| icon | string | 🖥️<br>🔒<br>🛡️ |
| sort | number | 1<br>2<br>3 |
| status | string | active<br>active<br>active |
| desc | string | 终端桌面安全管理模块套件<br>数据防泄密模块<br>勒索病毒防护模块 |
| createdAt | string | 2026-04-12<br>2026-04-12<br>2026-04-12 |
| published | boolean | true<br>true |

## features

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | FEAT-MOD-LEP-01-01<br>FEAT-MOD-LEP-01-02<br>FEAT-MOD-LEP-01-03 |
| moduleId | string | MOD-LEP-01<br>MOD-LEP-01<br>MOD-LEP-01 |
| name | string | 桌面管理模块（含资产管理，远程桌面）<br>安全管理模块<br>非授权外连控制模块 |
| productCode | string | UA-AM-1<br>UA-SS-1<br>UA-DevCtrl-1 |
| priceType | string | tiered<br>tiered<br>tiered |
| priceFixed | null\|number | 0<br>3000<br>0 |
| tiers | array | [{"min":1,"max":19,"price":150},{"min":20,"max":49,"price":140},{"min":50,"max":99,"price":130},{"min":100,"max":199,"pr<br>[{"min":1,"max":19,"price":75},{"min":20,"max":49,"price":70},{"min":50,"max":99,"price":65},{"min":100,"max":199,"price<br>[{"min":1,"max":19,"price":75},{"min":20,"max":49,"price":70},{"min":50,"max":99,"price":65},{"min":100,"max":199,"price |
| discount | number\|null | 0.2<br>0.2<br>0.2 |
| unit | string | 端点<br>端点<br>端点 |
| desc | string | 桌面管理许可，主要功能包括：<br>1）终端资产信息收集与管理，包括：设备基本属性、设备配置信息、设备硬件信息、设备软件信息等；<br>2）远程交互，包括：远程连接终端桌面交互、发布通知公告等；<br>3）节能管理：节能及非工作时间开关机管理；<br>4）对客户端<br>安全管理许可，主要功能包括：<br>1）软件防火墙功能，对指定程序、网络地址范围、通讯方向、端口范围等设置访问权限；<br>2）支持对终端流量进行统计；<br>3）支持对网络连接和互联网连通进行检测与监听。<br>非授权外连控制模块客户端许可，主要功能包括：<br>1）对计算机外联设备的使用进行审计和管控，包括：USB设备、蓝牙、光驱、串口、并口、1394接口等；<br>2）支持禁用终端电脑共享WiFi热点。 |
| status | string | active<br>active<br>active |
| published | boolean | true<br>true<br>true |
| createdAt | string | 2026-04-12<br>2026-04-12<br>2026-04-12 |
| priceForPrimary | array\|number | [{"min":1,"max":19,"price":30},{"min":20,"max":49,"price":28},{"min":50,"max":99,"price":26},{"min":100,"max":199,"price<br>[{"min":1,"max":19,"price":15},{"min":20,"max":49,"price":14},{"min":50,"max":99,"price":13},{"min":100,"max":199,"price<br>[{"min":1,"max":19,"price":15},{"min":20,"max":49,"price":14},{"min":50,"max":99,"price":13},{"min":100,"max":199,"price |
| priceForSecondary | array\|number | [{"min":1,"max":19,"price":45},{"min":20,"max":49,"price":42},{"min":50,"max":99,"price":39},{"min":100,"max":199,"price<br>[{"min":1,"max":19,"price":23},{"min":20,"max":49,"price":21},{"min":50,"max":99,"price":20},{"min":100,"max":199,"price<br>[{"min":1,"max":19,"price":23},{"min":20,"max":49,"price":21},{"min":50,"max":99,"price":20},{"min":100,"max":199,"price |
| priceRatioPrimary | number | 20<br>20<br>20 |
| priceRatioSecondary | number | 30<br>30<br>30 |
| priceRatioUpdatedAt | string | 2026-05-26T01:27:51.368Z<br>2026-05-20T05:17:11.825Z<br>2026-05-20T05:17:21.665Z |
| updatedAt | string | 2026-05-26T01:27:51.369Z<br>2026-05-20T05:17:11.825Z<br>2026-05-20T05:17:21.665Z |
| regionPriceOverrides | array | [{"region":"江苏区","enabled":true,"priceRatioPrimary":15,"priceRatioSecondary":22,"priceForPrimary":[{"min":1,"max":19,"pr<br>[{"region":"江苏区","enabled":true,"priceRatioPrimary":15,"priceRatioSecondary":22,"priceForPrimary":[{"min":1,"max":19,"pr<br>[{"region":"江苏区","enabled":true,"priceRatioPrimary":15,"priceRatioSecondary":22,"priceForPrimary":[{"min":1,"max":19,"pr |
| regionPriceUpdatedAt | string | 2026-05-26T01:27:51.369Z<br>2026-05-20T05:17:11.825Z<br>2026-05-20T05:17:21.665Z |
| required | boolean | false<br>false<br>false |
| maintenanceModuleRates | array | [{"moduleId":"MOD-LEP-01","rate":15},{"moduleId":"MOD-LEP-02","rate":15},{"moduleId":"MOD-LEP-03","rate":15},{"moduleId" |
| maintenanceFeatureOverrides | array | [{"featureId":"FEAT-MOD-LEP-01-01","rate":null},{"featureId":"FEAT-MOD-LEP-01-02","rate":null},{"featureId":"FEAT-MOD-LE |
| unitPoints | null |  |

## hardwareProducts

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | HW-1779256169710<br>HW-1779256306653<br>HW-1779256394538 |
| categoryId | string | CAT-HW<br>CAT-HW<br>CAT-HW |
| name | string | LV-7050<br>网络准入控制器设备（N1）<br>网络准入控制器设备（N3） |
| model | string | 准入-N1<br>准入-N3<br>准入-N2 |
| icon | string | 🖥️<br>🖥️<br>🖥️ |
| desc | string | 联软安略安全管控平台专用设备，具备管理中心与NACC功能，特性：<br>1）单电源，4个千兆网口；<br>2）最大支持500台设备的管理；<br>3）内置安略系统所需的操作系统和数据库软件；<br>4）系统所需的软件模块在SMB产品报价单中选取。<br>特性：<br>1、1U机架式设备、单电源、6个千兆网口、最大认证并发数：100个/秒、最大支持设备数量：200台<br>2、准入方式支持：支持策略路由、端口镜像、EOU/NACC、IAB、Portal、安全控件多种准入控制方式，自带RAIUS服务；<br>3<br>特性：<br>1、1U机架式设备、单电源、6个千兆网口、最大认证并发数：500个/秒、最大支持设备数量：1000台<br>2、准入方式支持：支持策略路由、端口镜像、EOU/NACC、IAB、Portal、安全控件多种准入控制方式，自带RAIUS服务；<br> |
| specs | string | CPU: 4核 \| 内存: 32GB \| 硬盘: 2*2TB（raid1） \| 网口: 4个千兆<br>CPU: 4核 \| 内存: 16GB \| 硬盘: 1TB \| 网口: 6个千兆<br>CPU: 4核 \| 内存: 16GB \| 硬盘: 1TB \| 网口: 6个千兆 |
| priceFixed | number | 20000<br>21000<br>37000 |
| unit | string | 台<br>台<br>台 |
| status | string | active<br>active<br>active |
| published | boolean | true<br>true<br>true |
| createdAt | string | 2026-05-20T05:49:29.710Z<br>2026-05-20T05:51:46.653Z<br>2026-05-20T05:53:14.538Z |
| updatedAt | string | 2026-05-20T06:26:49.080Z<br>2026-05-20T05:56:43.401Z<br>2026-05-20T05:56:39.481Z |

## packages

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | PKG-1779260271109<br>PKG-1779260520781<br>PKG-1779260571591 |
| name | string | 桌面管理<br>网络准入<br>防病毒（EDR） |
| icon | string | 📦<br>📦<br>📦 |
| desc | string |  |
| featureIds | array | ["FEAT-MOD-LEP-01-01","FEAT-MOD-LEP-01-02","FEAT-MOD-LEP-01-04","FEAT-MOD-LEP-01-06","FEAT-MOD-LEP-01-07","FEAT-MOD-LEP-<br>["FEAT-MOD-LEP-04-02","FEAT-MOD-LEP-04-01"]<br>["FEAT-MOD-LEP-03-01","FEAT-MOD-LEP-03-02"] |
| hardwareIds | array | []<br>[]<br>[] |
| moduleIds | array | ["MOD-LEP-01"]<br>["MOD-LEP-04"]<br>[] |
| status | string | active<br>active<br>active |
| published | boolean | true<br>true<br>true |
| createdAt | string | 2026-05-20T06:57:51.109Z<br>2026-05-20T07:02:00.781Z<br>2026-05-20T07:02:51.591Z |
| updatedAt | string | 2026-05-20T07:08:48.739Z<br>2026-05-20T07:08:43.192Z<br>2026-05-20T07:07:15.568Z |

## products

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |

## implementationWorkloadClassifications

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | IWC-PRODUCT-TYPE<br>IWC-SENSITIVE-KEYWORD |
| code | string | productType<br>sensitiveKeyword |
| name | string | 产品类型<br>敏感关键字 |
| valueType | string | enum<br>boolean |
| options | array | [{"value":"EPP","label":"EPP"},{"value":"DES","label":"DES"}]<br>[{"value":true,"label":"是"},{"value":false,"label":"否"}] |
| editable | boolean | false<br>false |
| createdAt | string | 2026-05-25T06:16:52.432Z<br>2026-05-25T06:16:52.432Z |

## implementationWorkloadMappings

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | IWM-FEAT-MOD-LEP-01-01<br>IWM-FEAT-MOD-LEP-01-02<br>IWM-FEAT-MOD-LEP-01-03 |
| featureId | string | FEAT-MOD-LEP-01-01<br>FEAT-MOD-LEP-01-02<br>FEAT-MOD-LEP-01-03 |
| featureName | string | 桌面管理模块（含资产管理，远程桌面）<br>安全管理模块<br>非授权外连控制模块 |
| moduleId | string | MOD-LEP-01<br>MOD-LEP-01<br>MOD-LEP-01 |
| moduleName | string | 桌面安全管理<br>桌面安全管理<br>桌面安全管理 |
| productCode | string | UA-AM-1<br>UA-SS-1<br>UA-DevCtrl-1 |
| productType | string | EPP<br>EPP<br>EPP |
| sensitiveKeyword | boolean | false<br>false<br>false |
| source | string | seed<br>seed<br>seed |
| active | boolean | true<br>true<br>true |
| createdAt | string | 2026-05-25T06:16:52.433Z<br>2026-05-25T06:16:52.433Z<br>2026-05-25T06:16:52.433Z |
| updatedAt | string | 2026-05-25T06:16:52.433Z<br>2026-05-25T06:16:52.433Z<br>2026-05-25T06:16:52.433Z |

## implementationWorkloadRules

| 字段 | 类型 | 样例（脱敏前字段形态） |
| --- | --- | --- |
| id | string | IWR-1-1<br>IWR-1-2<br>IWR-2-3 |
| name | string | EPP 1-100点<br>EPP 1-100点 含敏感关键字<br>DES 1-100点 |
| minPoints | number | 1<br>1<br>1 |
| maxPoints | number\|null | 100<br>100<br>100 |
| productType | string | EPP<br>EPP<br>DES |
| sensitiveKeyword | boolean | false<br>true<br>false |
| personDays | number | 2.5<br>4.5<br>4 |
| active | boolean | true<br>true<br>true |
| source | string | manual<br>manual<br>manual |
| createdAt | string | 2026-05-25T06:16:52.432Z<br>2026-05-25T06:16:52.432Z<br>2026-05-25T06:16:52.432Z |
| updatedAt | string | 2026-06-02T08:18:54.081Z<br>2026-06-02T08:19:00.205Z<br>2026-06-02T08:18:46.461Z |
| updatedBy | string | A030<br>A030<br>A030 |
