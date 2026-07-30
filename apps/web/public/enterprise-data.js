// ============================================================
// 企业模拟数据 - 用于客户报备表单智能搜索
// ============================================================

const ENTERPRISE_DATA = [
  { name: '北京启明科技有限公司', creditCode: '91110108MA01ABCD01', address: '北京市海淀区中关村软件园' },
  { name: '上海云鼎信息技术有限公司', creditCode: '91310115MA01EFGH02', address: '上海市浦东新区张江高科技园区' },
  { name: '广州盛世网络科技有限公司', creditCode: '91440106MA01IJKL03', address: '广州市天河区珠江新城' },
  { name: '深圳中信数字安全有限公司', creditCode: '91440300MA01MNOP04', address: '深圳市南山区科技园' },
  { name: '成都天府大数据有限公司', creditCode: '91510100MA01QRST05', address: '成都市高新区天府软件园' },
  { name: '杭州数智安全科技有限公司', creditCode: '91330106MA01UVWX06', address: '杭州市滨江区物联网小镇' },
  { name: '武汉长江信创研究院', creditCode: '91420100MA01YZAB07', address: '武汉市东湖高新区光谷软件园' },
  { name: '南京紫金医疗信息科技有限公司', creditCode: '91320102MA01CDEF08', address: '南京市鼓楼区软件大道' },
  { name: '北京安盾网络科技有限公司', creditCode: '91110105MA01GHIJ09', address: '北京市朝阳区望京SOHO' },
  { name: '上海锐行信息技术有限公司', creditCode: '91310104MA01KLMN10', address: '上海市徐汇区漕河泾开发区' },
  { name: '广州卓越安全解决方案公司', creditCode: '91440104MA01OPQR11', address: '广州市海珠区琶洲互联网创新集聚区' },
  { name: '深圳联创安全科技有限公司', creditCode: '91440300MA01STUV12', address: '深圳市福田区华强北' },
  { name: '成都信安网络工程有限公司', creditCode: '91510107MA01WXYZ13', address: '成都市武侯区西部智谷' },
  { name: '阿里巴巴（中国）有限公司', creditCode: '91330100799655058B', address: '杭州市余杭区五常街道' },
  { name: '腾讯科技（深圳）有限公司', creditCode: '9144030071526726XG', address: '深圳市南山区高新区' },
  { name: '华为技术有限公司', creditCode: '9144030019238763X2', address: '深圳市龙岗区坂田华为基地' },
  { name: '百度在线网络技术（北京）有限公司', creditCode: '91110108772551609J', address: '北京市海淀区上地十街' },
  { name: '京东世纪贸易有限公司', creditCode: '911103026605015136', address: '北京市经济技术开发区' },
  { name: '美团点评科技有限公司', creditCode: '91110108399643379M', address: '北京市朝阳区望京东路' },
  { name: '字节跳动科技有限公司', creditCode: '91110108399643379M', address: '北京市海淀区知春路' },
  { name: '中国平安保险（集团）股份有限公司', creditCode: '914403001923176729', address: '深圳市福田区益田路' },
  { name: '中国工商银行股份有限公司', creditCode: '91110000100003962T', address: '北京市西城区复兴门内大街' },
  { name: '中国建设银行股份有限公司', creditCode: '911100001000044477', address: '北京市西城区金融大街' },
  { name: '中国银行股份有限公司', creditCode: '911100001000013428', address: '北京市西城区复兴门内大街' },
  { name: '招商银行股份有限公司', creditCode: '9144030010001686XA', address: '深圳市福田区深南大道' },
  { name: '中国移动通信集团有限公司', creditCode: '911100001000016605', address: '北京市西城区金融大街' },
  { name: '中国电信集团有限公司', creditCode: '91110000100010277Q', address: '北京市西城区金融大街' },
  { name: '中国联合网络通信集团有限公司', creditCode: '91110000100010277Q', address: '北京市西城区金融大街' },
  { name: '国家电网有限公司', creditCode: '9111000010001065XA', address: '北京市西城区西长安街' },
  { name: '中国石油天然气集团有限公司', creditCode: '91110000100010282X', address: '北京市东城区东直门北大街' },
  { name: '中国石油化工集团有限公司', creditCode: '91110000100010282X', address: '北京市朝阳区朝阳门北大街' },
  { name: '中国建筑集团有限公司', creditCode: '91110000100010285X', address: '北京市海淀区三里河路' },
  { name: '中国中铁股份有限公司', creditCode: '91110000710935003U', address: '北京市丰台区南四环西路' },
  { name: '中国铁建股份有限公司', creditCode: '91110000710929434R', address: '北京市海淀区复兴路' },
  { name: '中国中车集团有限公司', creditCode: '91110000100005852X', address: '北京市海淀区西四环中路' },
  { name: '中国船舶集团有限公司', creditCode: '91110000100005852X', address: '上海市浦东新区浦东大道' },
  { name: '中国航空工业集团有限公司', creditCode: '91110000100005852X', address: '北京市朝阳区东三环中路' },
  { name: '中国兵器工业集团有限公司', creditCode: '91110000100005852X', address: '北京市西城区三里河路' },
  { name: '中国航天科技集团有限公司', creditCode: '91110000100005852X', address: '北京市海淀区阜成路' },
  { name: '中国航天科工集团有限公司', creditCode: '91110000100005852X', address: '北京市海淀区阜成路' },
  { name: '中国电子科技集团有限公司', creditCode: '91110000100005852X', address: '北京市海淀区万寿路' },
  { name: '中国信息通信科技集团有限公司', creditCode: '91110000100005852X', address: '北京市海淀区学院路' },
  { name: '中国科学院控股有限公司', creditCode: '91110000100005852X', address: '北京市西城区三里河路' },
  { name: '清华大学', creditCode: '12100000400005852X', address: '北京市海淀区清华园' },
  { name: '北京大学', creditCode: '12100000400005852X', address: '北京市海淀区颐和园路' },
  { name: '浙江大学', creditCode: '12330000400005852X', address: '杭州市西湖区余杭塘路' },
  { name: '复旦大学', creditCode: '12310000400005852X', address: '上海市杨浦区邯郸路' },
  { name: '上海交通大学', creditCode: '12310000400005852X', address: '上海市闵行区东川路' },
  { name: '南京大学', creditCode: '12320000400005852X', address: '南京市鼓楼区汉口路' },
  { name: '中国科学技术大学', creditCode: '12340000400005852X', address: '合肥市包河区金寨路' },
  { name: '华中科技大学', creditCode: '12420000400005852X', address: '武汉市洪山区珞喻路' },
  { name: '武汉大学', creditCode: '12420000400005852X', address: '武汉市武昌区珞珈山' },
  { name: '中山大学', creditCode: '12440000400005852X', address: '广州市海珠区新港西路' },
  { name: '四川大学', creditCode: '12510000400005852X', address: '成都市武侯区一环路' },
  { name: '西安交通大学', creditCode: '12610000400005852X', address: '西安市碑林区咸宁西路' },
  { name: '哈尔滨工业大学', creditCode: '12230000400005852X', address: '哈尔滨市南岗区西大直街' },
  { name: '北京航空航天大学', creditCode: '12100000400005852X', address: '北京市海淀区学院路' },
  { name: '北京理工大学', creditCode: '12100000400005852X', address: '北京市海淀区中关村南大街' },
  { name: '同济大学', creditCode: '12310000400005852X', address: '上海市杨浦区四平路' },
  { name: '东南大学', creditCode: '12320000400005852X', address: '南京市玄武区四牌楼' },
  { name: '天津大学', creditCode: '12120000400005852X', address: '天津市南开区卫津路' },
  { name: '南开大学', creditCode: '12120000400005852X', address: '天津市南开区卫津路' },
  { name: '山东大学', creditCode: '12370000400005852X', address: '济南市历城区山大南路' },
  { name: '中国海洋大学', creditCode: '12370000400005852X', address: '青岛市崂山区松岭路' },
  { name: '吉林大学', creditCode: '12220000400005852X', address: '长春市朝阳区前进大街' },
  { name: '东北大学', creditCode: '12210000400005852X', address: '沈阳市和平区文化路' },
  { name: '大连理工大学', creditCode: '12210000400005852X', address: '大连市甘井子区凌工路' },
  { name: '中南大学', creditCode: '12430000400005852X', address: '长沙市岳麓区麓山南路' },
  { name: '湖南大学', creditCode: '12430000400005852X', address: '长沙市岳麓区麓山南路' },
  { name: '国防科技大学', creditCode: '12430000400005852X', address: '长沙市开福区德雅路' },
  { name: '厦门大学', creditCode: '12350000400005852X', address: '厦门市思明区思明南路' },
  { name: '华南理工大学', creditCode: '12440000400005852X', address: '广州市天河区五山路' },
  { name: '重庆大学', creditCode: '12500000400005852X', address: '重庆市沙坪坝区沙正街' },
  { name: '电子科技大学', creditCode: '12510000400005852X', address: '成都市高新区西源大道' },
  { name: '西北工业大学', creditCode: '12610000400005852X', address: '西安市碑林区友谊西路' },
  { name: '兰州大学', creditCode: '12620000400005852X', address: '兰州市城关区天水南路' },
  { name: '中国农业大学', creditCode: '12100000400005852X', address: '北京市海淀区圆明园西路' },
  { name: '北京邮电大学', creditCode: '12100000400005852X', address: '北京市海淀区西土城路' },
  { name: '西安电子科技大学', creditCode: '12610000400005852X', address: '西安市雁塔区太白南路' },
  { name: '南京航空航天大学', creditCode: '12320000400005852X', address: '南京市江宁区将军大道' },
  { name: '南京理工大学', creditCode: '12320000400005852X', address: '南京市玄武区孝陵卫' },
  { name: '北京交通大学', creditCode: '12100000400005852X', address: '北京市海淀区上园村' },
  { name: '华东理工大学', creditCode: '12310000400005852X', address: '上海市徐汇区梅陇路' },
  { name: '南京农业大学', creditCode: '12320000400005852X', address: '南京市玄武区卫岗' },
  { name: '华中农业大学', creditCode: '12420000400005852X', address: '武汉市洪山区狮子山' },
  { name: '西南大学', creditCode: '12500000400005852X', address: '重庆市北碚区天生路' },
  { name: '中国药科大学', creditCode: '12320000400005852X', address: '南京市江宁区龙眠大道' },
  { name: '河海大学', creditCode: '12320000400005852X', address: '南京市鼓楼区西康路' },
  { name: '中国矿业大学', creditCode: '12320000400005852X', address: '徐州市铜山区大学路' },
  { name: '中国石油大学（华东）', creditCode: '12370000400005852X', address: '青岛市黄岛区长江西路' },
  { name: '中国石油大学（北京）', creditCode: '12100000400005852X', address: '北京市昌平区府学路' },
  { name: '中国地质大学（武汉）', creditCode: '12420000400005852X', address: '武汉市洪山区鲁磨路' },
  { name: '中国地质大学（北京）', creditCode: '12100000400005852X', address: '北京市海淀区学院路' },
  { name: '北京科技大学', creditCode: '12100000400005852X', address: '北京市海淀区学院路' },
  { name: '北京化工大学', creditCode: '12100000400005852X', address: '北京市朝阳区北三环东路' },
  { name: '北京林业大学', creditCode: '12100000400005852X', address: '北京市海淀区清华东路' },
  { name: '北京中医药大学', creditCode: '12100000400005852X', address: '北京市朝阳区北三环东路' },
  { name: '北京外国语大学', creditCode: '12100000400005852X', address: '北京市海淀区西三环北路' },
  { name: '中国传媒大学', creditCode: '12100000400005852X', address: '北京市朝阳区定福庄东街' },
  { name: '中央财经大学', creditCode: '12100000400005852X', address: '北京市海淀区学院南路' },
  { name: '对外经济贸易大学', creditCode: '12100000400005852X', address: '北京市朝阳区惠新东街' },
  { name: '中国政法大学', creditCode: '12100000400005852X', address: '北京市昌平区府学路' },
  { name: '华北电力大学', creditCode: '12100000400005852X', address: '北京市昌平区回龙观' },
  { name: '中国矿业大学（北京）', creditCode: '12100000400005852X', address: '北京市海淀区学院路' },
  { name: '北京协和医学院', creditCode: '12100000400005852X', address: '北京市东城区东单三条' },
  { name: '首都医科大学', creditCode: '12100000400005852X', address: '北京市丰台区右安门外' },
  { name: '北京工业大学', creditCode: '12100000400005852X', address: '北京市朝阳区平乐园' },
  { name: '北京工商大学', creditCode: '12100000400005852X', address: '北京市海淀区阜成路' },
  { name: '北京建筑大学', creditCode: '12100000400005852X', address: '北京市西城区展览馆路' },
  { name: '北京信息科技大学', creditCode: '12100000400005852X', address: '北京市海淀区清河小营' },
  { name: '北京电子科技学院', creditCode: '12100000400005852X', address: '北京市丰台区富丰路' },
  { name: '国际关系学院', creditCode: '12100000400005852X', address: '北京市海淀区坡上村' },
  { name: '外交学院', creditCode: '12100000400005852X', address: '北京市西城区展览馆路' },
  { name: '中国消防救援学院', creditCode: '12100000400005852X', address: '北京市昌平区南雁路' },
  { name: '北京舞蹈学院', creditCode: '12100000400005852X', address: '北京市海淀区万寿寺路' },
  { name: '中央音乐学院', creditCode: '12100000400005852X', address: '北京市西城区鲍家街' },
  { name: '中央美术学院', creditCode: '12100000400005852X', address: '北京市朝阳区花家地南街' },
  { name: '中央戏剧学院', creditCode: '12100000400005852X', address: '北京市东城区东棉花胡同' },
  { name: '北京电影学院', creditCode: '12100000400005852X', address: '北京市海淀区西土城路' },
  { name: '北京体育大学', creditCode: '12100000400005852X', address: '北京市海淀区信息路' },
  { name: '中国音乐学院', creditCode: '12100000400005852X', address: '北京市朝阳区安翔路' },
  { name: '中国戏曲学院', creditCode: '12100000400005852X', address: '北京市丰台区万泉寺' },
  { name: '北京第二外国语学院', creditCode: '12100000400005852X', address: '北京市朝阳区定福庄南里' },
  { name: '首都师范大学', creditCode: '12100000400005852X', address: '北京市海淀区西三环北路' },
  { name: '北京语言大学', creditCode: '12100000400005852X', address: '北京市海淀区学院路' },
  { name: '中国劳动关系学院', creditCode: '12100000400005852X', address: '北京市海淀区增光路' },
  { name: '中华女子学院', creditCode: '12100000400005852X', address: '北京市朝阳区育慧东路' },
  { name: '北京石油化工学院', creditCode: '12100000400005852X', address: '北京市大兴区清源北路' },
  { name: '北京农学院', creditCode: '12100000400005852X', address: '北京市昌平区回龙观' },
  { name: '北京印刷学院', creditCode: '12100000400005852X', address: '北京市大兴区兴华大街' },
  { name: '北京物资学院', creditCode: '12100000400005852X', address: '北京市通州区富河大街' },
  { name: '首钢工学院', creditCode: '12100000400005852X', address: '北京市石景山区晋元庄' },
  { name: '北京警察学院', creditCode: '12100000400005852X', address: '北京市昌平区南口镇' },
  { name: '中国民航大学', creditCode: '12120000400005852X', address: '天津市东丽区津北公路' },
  { name: '天津工业大学', creditCode: '12120000400005852X', address: '天津市西青区宾水西道' },
  { name: '天津科技大学', creditCode: '12120000400005852X', address: '天津市河西区大沽南路' },
  { name: '天津理工大学', creditCode: '12120000400005852X', address: '天津市西青区宾水西道' },
  { name: '天津医科大学', creditCode: '12120000400005852X', address: '天津市和平区气象台路' },
  { name: '天津中医药大学', creditCode: '12120000400005852X', address: '天津市静海区团泊新城' },
  { name: '天津师范大学', creditCode: '12120000400005852X', address: '天津市西青区宾水西道' },
  { name: '天津职业技术师范大学', creditCode: '12120000400005852X', address: '天津市河西区大沽南路' },
  { name: '天津外国语大学', creditCode: '12120000400005852X', address: '天津市河西区马场道' },
  { name: '天津商业大学', creditCode: '12120000400005852X', address: '天津市北辰区光荣道' },
  { name: '天津财经大学', creditCode: '12120000400005852X', address: '天津市河西区珠江道' },
  { name: '天津体育学院', creditCode: '12120000400005852X', address: '天津市静海区团泊新城' },
  { name: '天津音乐学院', creditCode: '12120000400005852X', address: '天津市河东区十一经路' },
  { name: '天津美术学院', creditCode: '12120000400005852X', address: '天津市河北区天纬路' },
  { name: '天津城建大学', creditCode: '12120000400005852X', address: '天津市西青区津静公路' },
  { name: '天津农学院', creditCode: '12120000400005852X', address: '天津市西青区津静公路' },
  { name: '上海大学', creditCode: '12310000400005852X', address: '上海市宝山区上大路' },
  { name: '上海理工大学', creditCode: '12310000400005852X', address: '上海市杨浦区军工路' },
  { name: '上海海事大学', creditCode: '12310000400005852X', address: '上海市浦东新区海港大道' },
  { name: '上海工程技术大学', creditCode: '12310000400005852X', address: '上海市松江区龙腾路' },
  { name: '上海海洋大学', creditCode: '12310000400005852X', address: '上海市浦东新区沪城环路' },
  { name: '上海中医药大学', creditCode: '12310000400005852X', address: '上海市浦东新区蔡伦路' },
  { name: '华东师范大学', creditCode: '12310000400005852X', address: '上海市普陀区中山北路' },
  { name: '上海师范大学', creditCode: '12310000400005852X', address: '上海市徐汇区桂林路' },
  { name: '上海外国语大学', creditCode: '12310000400005852X', address: '上海市虹口区大连西路' },
  { name: '华东政法大学', creditCode: '12310000400005852X', address: '上海市松江区龙源路' },
  { name: '上海对外经贸大学', creditCode: '12310000400005852X', address: '上海市松江区文翔路' },
  { name: '上海应用技术大学', creditCode: '12310000400005852X', address: '上海市徐汇区漕宝路' },
  { name: '上海第二工业大学', creditCode: '12310000400005852X', address: '上海市浦东新区金海路' },
  { name: '上海电机学院', creditCode: '12310000400005852X', address: '上海市浦东新区水华路' },
  { name: '上海商学院', creditCode: '12310000400005852X', address: '上海市徐汇区中山西路' },
  { name: '上海海关学院', creditCode: '12310000400005852X', address: '上海市浦东新区华夏西路' },
  { name: '上海政法学院', creditCode: '12310000400005852X', address: '上海市青浦区外青松公路' },
  { name: '上海立信会计金融学院', creditCode: '12310000400005852X', address: '上海市松江区文翔路' },
  { name: '上海健康医学院', creditCode: '12310000400005852X', address: '上海市浦东新区周祝公路' },
  { name: '上海公安学院', creditCode: '12310000400005852X', address: '上海市浦东新区崇景路' }
];

// 企业搜索函数 - 支持模糊搜索
function searchEnterprises(keyword) {
  if (!keyword || keyword.length < 2) return [];
  
  const lowerKeyword = keyword.toLowerCase();
  return ENTERPRISE_DATA.filter(enterprise => 
    enterprise.name.toLowerCase().includes(lowerKeyword)
  ).slice(0, 10); // 最多返回10条
}

// 统一社会信用代码校验
function validateCreditCode(code) {
  if (!code || code.length !== 18) return false;
  // 统一社会信用代码正则：由18位数字或大写字母组成，不含I、O、Z、S、V
  const pattern = /^[0-9A-HJ-NPQRTUWXY]{18}$/;
  return pattern.test(code);
}

// 手机号校验
function validatePhone(phone) {
  if (!phone) return false;
  // 中国大陆手机号：1开头，第二位3-9，共11位
  const pattern = /^1[3-9]\d{9}$/;
  return pattern.test(phone.replace(/[-\s]/g, ''));
}

// 挂载到 window 对象，供其他脚本使用
window.searchEnterprises = searchEnterprises;
window.validateCreditCode = validateCreditCode;
window.validatePhone = validatePhone;

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ENTERPRISE_DATA, searchEnterprises, validateCreditCode, validatePhone };
}
