// 中国城市数据（仅保留有坐标的79个城市）
const CITY_DATA = [
  {
    province: "上海市",
    cities: [
      { city: "上海", counties: ["上海市区"] },
    ]
  },
  {
    province: "云南省",
    cities: [
      { city: "昆明", counties: ["昆明市区"] },
    ]
  },
  {
    province: "内蒙古自治区",
    cities: [
      { city: "呼和浩特", counties: ["呼和浩特市区"] },
    ]
  },
  {
    province: "北京市",
    cities: [
      { city: "北京", counties: ["北京市区"] },
    ]
  },
  {
    province: "吉林省",
    cities: [
      { city: "长春", counties: ["长春市区"] },
    ]
  },
  {
    province: "四川省",
    cities: [
      { city: "成都", counties: ["成都市区"] },
    ]
  },
  {
    province: "天津市",
    cities: [
      { city: "天津", counties: ["天津市区"] },
    ]
  },
  {
    province: "宁夏回族自治区",
    cities: [
      { city: "银川", counties: ["银川市区"] },
    ]
  },
  {
    province: "安徽省",
    cities: [
      { city: "合肥", counties: ["合肥市区"] },
      { city: "安庆", counties: ["安庆市区"] },
      { city: "芜湖", counties: ["芜湖市区"] },
      { city: "蚌埠", counties: ["蚌埠市区"] },
    ]
  },
  {
    province: "山东省",
    cities: [
      { city: "威海", counties: ["威海市区"] },
      { city: "日照", counties: ["日照市区"] },
      { city: "济南", counties: ["济南市区"] },
      { city: "潍坊", counties: ["潍坊市区"] },
      { city: "烟台", counties: ["烟台市区"] },
      { city: "青岛", counties: ["青岛市区"] },
    ]
  },
  {
    province: "山西省",
    cities: [
      { city: "太原", counties: ["太原市区"] },
    ]
  },
  {
    province: "广东省",
    cities: [
      { city: "东莞", counties: ["东莞市区"] },
      { city: "中山", counties: ["中山市区"] },
      { city: "佛山", counties: ["佛山市区"] },
      { city: "广州", counties: ["广州市区"] },
      { city: "惠州", counties: ["惠州市区"] },
      { city: "江门", counties: ["江门市区"] },
      { city: "深圳", counties: ["深圳市区"] },
      { city: "珠海", counties: ["珠海市区"] },
    ]
  },
  {
    province: "广西壮族自治区",
    cities: [
      { city: "南宁", counties: ["南宁市区"] },
      { city: "柳州", counties: ["柳州市区"] },
      { city: "桂林", counties: ["桂林市区"] },
    ]
  },
  {
    province: "新疆维吾尔自治区",
    cities: [
      { city: "乌鲁木齐", counties: ["乌鲁木齐市区"] },
    ]
  },
  {
    province: "江苏省",
    cities: [
      { city: "南京", counties: ["南京市区"] },
      { city: "南通", counties: ["南通市区"] },
      { city: "常州", counties: ["常州市区"] },
      { city: "常熟", counties: ["常熟市区"] },
      { city: "徐州", counties: ["徐州市区"] },
      { city: "扬州", counties: ["扬州市区"] },
      { city: "无锡", counties: ["无锡市区"] },
      { city: "泰州", counties: ["泰州市区"] },
      { city: "淮安", counties: ["淮安市区"] },
      { city: "盐城", counties: ["盐城市区"] },
      { city: "苏州", counties: ["苏州市区"] },
      { city: "连云港", counties: ["连云港市区"] },
      { city: "镇江", counties: ["镇江市区"] },
    ]
  },
  {
    province: "江西省",
    cities: [
      { city: "九江", counties: ["九江市区"] },
      { city: "南昌", counties: ["南昌市区"] },
      { city: "赣州", counties: ["赣州市区"] },
    ]
  },
  {
    province: "河北省",
    cities: [
      { city: "保定", counties: ["保定市区"] },
      { city: "唐山", counties: ["唐山市区"] },
      { city: "石家庄", counties: ["石家庄市区"] },
      { city: "秦皇岛", counties: ["秦皇岛市区"] },
    ]
  },
  {
    province: "河南省",
    cities: [
      { city: "洛阳", counties: ["洛阳市区"] },
      { city: "郑州", counties: ["郑州市区"] },
    ]
  },
  {
    province: "浙江省",
    cities: [
      { city: "台州", counties: ["台州市区"] },
      { city: "嘉兴", counties: ["嘉兴市区"] },
      { city: "宁波", counties: ["宁波市区"] },
      { city: "杭州", counties: ["杭州市区"] },
      { city: "温州", counties: ["温州市区"] },
      { city: "湖州", counties: ["湖州市区"] },
      { city: "绍兴", counties: ["绍兴市区"] },
      { city: "金华", counties: ["金华市区"] },
    ]
  },
  {
    province: "海南省",
    cities: [
      { city: "三亚", counties: ["三亚市区"] },
      { city: "海口", counties: ["海口市区"] },
    ]
  },
  {
    province: "湖北省",
    cities: [
      { city: "宜昌", counties: ["宜昌市区"] },
      { city: "武汉", counties: ["武汉市区"] },
      { city: "襄阳", counties: ["襄阳市区"] },
    ]
  },
  {
    province: "湖南省",
    cities: [
      { city: "长沙", counties: ["长沙市区"] },
    ]
  },
  {
    province: "甘肃省",
    cities: [
      { city: "兰州", counties: ["兰州市区"] },
    ]
  },
  {
    province: "福建省",
    cities: [
      { city: "厦门", counties: ["厦门市区"] },
      { city: "福州", counties: ["福州市区"] },
    ]
  },
  {
    province: "西藏自治区",
    cities: [
      { city: "拉萨", counties: ["拉萨市区"] },
    ]
  },
  {
    province: "贵州省",
    cities: [
      { city: "贵阳", counties: ["贵阳市区"] },
      { city: "遵义", counties: ["遵义市区"] },
    ]
  },
  {
    province: "辽宁省",
    cities: [
      { city: "大连", counties: ["大连市区"] },
      { city: "沈阳", counties: ["沈阳市区"] },
    ]
  },
  {
    province: "重庆市",
    cities: [
      { city: "重庆", counties: ["重庆市区"] },
    ]
  },
  {
    province: "陕西省",
    cities: [
      { city: "西安", counties: ["西安市区"] },
    ]
  },
  {
    province: "青海省",
    cities: [
      { city: "西宁", counties: ["西宁市区"] },
    ]
  },
  {
    province: "黑龙江省",
    cities: [
      { city: "哈尔滨", counties: ["哈尔滨市区"] },
    ]
  },
];