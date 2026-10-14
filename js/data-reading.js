// ============================================================
// HSK 1 - HSK 4 (3.0) – Ngân hàng bài tập Luyện đọc hiểu (HSK Reading)
// Bao gồm 2 dạng chuẩn đề thi HSK:
// 1. Cloze Test (选词填空) - Điền từ vào đoạn văn
// 2. Reading Comprehension (阅读理解) - Đọc đoạn văn trả lời câu hỏi
// ============================================================

const READING_DATA = [
  // ══════════════════════════════════════════════════════════
  // HSK 1 (12 bài đọc)
  // ══════════════════════════════════════════════════════════
  {
    id: "r_hsk1_1",
    level: 1,
    type: "cloze",
    title: "Kế hoạch cuối tuần",
    passage: "周末我和朋友一起去[1]中国菜。下午我们要去[2]看书。今天的天气很[3]。",
    pinyin: "Zhōumò wǒ hé péngyou yìqǐ qù chī Zhōngguócài. Xiàwǔ wǒmen yào qù túshūguǎn kàn shū. Jīntiān de tiānqì hěn hǎo.",
    translation: "Cuối tuần tôi và bạn bè cùng nhau đi ăn món Trung Quốc. Buổi chiều chúng tôi sẽ đến thư viện đọc sách. Thời tiết hôm nay rất đẹp.",
    wordBank: ["吃", "图书馆", "好", "水", "大"],
    answers: { "1": "吃", "2": "图书馆", "3": "好" }
  },
  {
    id: "r_hsk1_2",
    level: 1,
    type: "qa",
    title: "Gia đình Tiểu Minh",
    passage: "我叫小明，我家有三口人：爸爸、妈妈和我。爸爸是医生，妈妈是老师。我是学生，我们在北京。",
    pinyin: "Wǒ jiào Xiǎomíng, wǒ jiā yǒu sān kǒu rén: bàba, māma hé wǒ. Bàba shì yīshēng, māma shì lǎoshī. Wǒ shì xuéshēng, wǒmen zài Běijīng.",
    translation: "Tôi tên là Tiểu Minh, nhà tôi có ba người: bố, mẹ và tôi. Bố là bác sĩ, mẹ là giáo viên. Tôi là học sinh, chúng tôi ở Bắc Kinh.",
    question: "小明的爸爸做什么工作？",
    questionPinyin: "Xiǎomíng de bàba zuò shénme gōngzuò?",
    options: ["医生", "老师", "学生", "售货员"],
    correctIndex: 0
  },
  {
    id: "r_hsk1_3",
    level: 1,
    type: "cloze",
    title: "Gặp gỡ bạn mới",
    passage: "你好！很高兴[1]你。我是美国人，我现在在学习[2]。你[3]什么名字？",
    pinyin: "Nǐ hǎo! Hěn gāoxìng rènshi nǐ. Wǒ shì Měiguórén, wǒ xiànzài zài xuéxí Hànyǔ. Nǐ jiào shénme míngzi?",
    translation: "Xin chào! Rất vui được quen biết bạn. Tôi là người Mỹ, hiện tại tôi đang học tiếng Hán. Bạn tên là gì?",
    wordBank: ["认识", "汉语", "叫", "听", "买"],
    answers: { "1": "认识", "2": "汉语", "3": "叫" }
  },
  {
    id: "r_hsk1_4",
    level: 1,
    type: "qa",
    title: "Đi siêu thị mua hoa quả",
    passage: "今天下午我和同学去商店买水果。我们买了五个大苹果和一些香蕉。苹果很甜，一点儿也不贵。",
    pinyin: "Jīntiān xiàwǔ wǒ hé tóngxué qù shāngdiàn mǎi shuǐguǒ. Wǒmen mǎi le wǔ gè dà píngguǒ hé yìxiē xiāngjiāo. Píngguǒ hěn tián, yìdiǎnr yě bú guì.",
    translation: "Chiều nay tôi và bạn học đến cửa hàng mua hoa quả. Chúng tôi đã mua năm quả táo to và một ít chuối. Táo rất ngọt, không đắt chút nào.",
    question: "他们在商店买了什么？",
    questionPinyin: "Tāmen zài shāngdiàn mǎi le shénme?",
    options: ["苹果和香蕉", "衣服和鞋子", "茶和咖啡", "米饭和菜"],
    correctIndex: 0
  },
  {
    id: "r_hsk1_5",
    level: 1,
    type: "cloze",
    title: "Một ngày ở trường",
    passage: "我每天早上八点去[1]。老师教我们写[2]。中午我和同学在学校吃[3]。",
    pinyin: "Wǒ měitiān zǎoshang bā diǎn qù xuéxiào. Lǎoshī jiāo wǒmen xiě hànzì. Zhōngwǔ wǒ hé tóngxué zài xuéxiào chī fàn.",
    translation: "Mỗi sáng tôi đến trường lúc tám giờ. Thầy giáo dạy chúng tôi viết chữ Hán. Buổi trưa tôi và bạn học ăn cơm ở trường.",
    wordBank: ["学校", "汉字", "饭", "睡觉", "看"],
    answers: { "1": "学校", "2": "汉字", "3": "饭" }
  },
  {
    id: "r_hsk1_6",
    level: 1,
    type: "qa",
    title: "Thời tiết hôm nay",
    passage: "昨天的天气不好，下了一整天的大雨。今天天气很好，很暖和，我想去公园走走。",
    pinyin: "Zuótiān de tiānqì bù hǎo, xià le yì zhěng tiān de dàyǔ. Jīntiān tiānqì hěn hǎo, hěn nuǎnhuo, wǒ xiǎng qù gōngyuán zǒuzou.",
    translation: "Thời tiết hôm qua không tốt, mưa to cả ngày. Hôm nay thời tiết rất đẹp, rất ấm áp, tôi muốn đi công viên dạo bộ.",
    question: "今天天气怎么样？",
    questionPinyin: "Jīntiān tiānqì zěnmeyàng?",
    options: ["下大雨", "很冷", "天气很好很暖和", "刮大风"],
    correctIndex: 2
  },
  {
    id: "r_hsk1_7",
    level: 1,
    type: "cloze",
    title: "Thói quen uống nước",
    passage: "医生对我说，每天要多喝[1]，少喝冰水。我喜欢在早上喝一杯热[2]，下午喝[3]。",
    pinyin: "Yīshēng duì wǒ shuō, měitiān yào duō hē shuǐ, shǎo hē bīngshuǐ. Wǒ xǐhuan zài zǎoshang hē yì bēi rè chá, xiàwǔ hē kāfēi.",
    translation: "Bác sĩ nói với tôi rằng, mỗi ngày nên uống nhiều nước, ít uống nước đá. Tôi thích uống một cốc trà nóng vào buổi sáng và uống cà phê vào buổi chiều.",
    wordBank: ["水", "茶", "咖啡", "苹果", "衣服"],
    answers: { "1": "水", "2": "茶", "3": "咖啡" }
  },
  {
    id: "r_hsk1_8",
    level: 1,
    type: "qa",
    title: "Mèo con của tôi",
    passage: "我家有一只白色的小猫。它很小，也很漂亮。它喜欢在椅子下面睡觉，我们都很喜欢它。",
    pinyin: "Wǒ jiā yǒu yì zhī báisè de xiǎomāo. Tā hěn xiǎo, yě hěn piàoliang. Tā xǐhuan zài yǐzi xiàmiàn shuìjiào, wǒmen dōu hěn xǐhuan tā.",
    translation: "Nhà tôi có một chú mèo con màu trắng. Nó rất nhỏ nhắn và cũng rất đẹp. Nó thích ngủ ở dưới ghế, chúng tôi đều rất yêu quý nó.",
    question: "小猫喜欢在哪里睡觉？",
    questionPinyin: "Xiǎomāo xǐhuan zài nǎlǐ shuìjiào?",
    options: ["桌子上面", "椅子下面", "床上", "门外"],
    correctIndex: 1
  },
  {
    id: "r_hsk1_9",
    level: 1,
    type: "cloze",
    title: "Hỏi đường đến ga tàu",
    passage: "请问，火车站怎么[1]？一直往[2]走，就在前面。太[3]你了！",
    pinyin: "Qǐngwèn, huǒchēzhàn zěnme zǒu? Yìzhí wǎng qián zǒu, jiù zài qiánmiàn. Tài xièxie nǐ le!",
    translation: "Xin hỏi, ga tàu hỏa đi như thế nào? Cứ đi thẳng về phía trước, nó ở ngay phía trước. Vô cùng cảm ơn bạn!",
    wordBank: ["走", "前", "谢谢", "来", "后"],
    answers: { "1": "走", "2": "前", "3": "谢谢" }
  },
  {
    id: "r_hsk1_10",
    level: 1,
    type: "qa",
    title: "Xem phim cùng bạn gái",
    passage: "星期天晚上七点，我和女朋友去电影院看电影。那个电影很有意思，我们看得很高兴。",
    pinyin: "Xīngqītiān wǎnshang qī diǎn, wǒ hé nǚpéngyou qù diànyǐngyuàn kàn diànyǐng. Nà ge diànyǐng hěn yǒu yìsi, wǒmen kàn de hěn gāoxìng.",
    translation: "Tối chủ nhật lúc bảy giờ, tôi và bạn gái đến rạp chiếu phim xem phim. Bộ phim đó rất hay, chúng tôi xem rất vui vẻ.",
    question: "他们什么时候去看电影？",
    questionPinyin: "Tāmen shénme shíhou qù kàn diànyǐng?",
    options: ["星期天早上", "星期天中午", "星期天晚上七点", "星期六下午"],
    correctIndex: 2
  },
  {
    id: "r_hsk1_11",
    level: 1,
    type: "cloze",
    title: "Giới thiệu căn phòng",
    passage: "这是我的房间。房间里有一张[1]，一个大桌子和两把[2]。桌子上有很多[3]。",
    pinyin: "Zhè shì wǒ de fángjiān. Fángjiān li yǒu yì zhāng chuáng, yí ge dà zhuōzi hé liǎng bǎ yǐzi. Zhuōzi shang yǒu hěn duō shū.",
    translation: "Đây là phòng của tôi. Trong phòng có một chiếc giường, một cái bàn to và hai chiếc ghế. Trên bàn có rất nhiều sách.",
    wordBank: ["床", "椅子", "书", "狗", "衣服"],
    answers: { "1": "床", "2": "椅子", "3": "书" }
  },
  {
    id: "r_hsk1_12",
    level: 1,
    type: "qa",
    title: "Học bơi",
    passage: "我不会游泳。我哥哥游得非常好，这个星期六他要教我游泳。我很期待。",
    pinyin: "Wǒ bú huì yóuyǒng. Wǒ gēge yóu de fēicháng hǎo, zhè ge xīngqīliù tā yào jiāo wǒ yóuyǒng. Wǒ hěn qīdài.",
    translation: "Tôi không biết bơi. Anh trai tôi bơi rất giỏi, thứ bảy tuần này anh ấy sẽ dạy tôi bơi. Tôi rất mong đợi.",
    question: "谁要教我游泳？",
    questionPinyin: "Shéi yào jiāo wǒ yóuyǒng?",
    options: ["爸爸", "老师", "哥哥", "朋友"],
    correctIndex: 2
  },

  // ══════════════════════════════════════════════════════════
  // HSK 2 (12 bài đọc)
  // ══════════════════════════════════════════════════════════
  {
    id: "r_hsk2_1",
    level: 2,
    type: "cloze",
    title: "Chuẩn bị đi du lịch",
    passage: "下个月我们要去北京[1]。我们已经[2]好了机票，现在正在准备行李。我希望那里的天气[3]太冷。",
    pinyin: "Xià ge yuè wǒmen yào qù Běijīng lǚyóu. Wǒmen yǐjīng mǎi hǎo le jīpiào, xiànzài zhèngzài zhǔnbèi xíngli. Wǒ xīwàng nàli de tiānqì bú yào tài lěng.",
    translation: "Tháng sau chúng tôi sẽ đi du lịch Bắc Kinh. Chúng tôi đã mua xong vé máy bay rồi, hiện tại đang chuẩn bị hành lý. Tôi hy vọng thời tiết ở đó đừng quá lạnh.",
    wordBank: ["旅游", "买", "不要", "走", "卖"],
    answers: { "1": "旅游", "2": "买", "3": "不要" }
  },
  {
    id: "r_hsk2_2",
    level: 2,
    type: "qa",
    title: "Thói quen tập thể dục",
    passage: "小张为了身体健康，每天早晨都去跑步半个小时。跑完步以后，他吃一个鸡蛋，喝一杯牛奶，然后去上班。",
    pinyin: "Xiǎo Zhāng wèile shēntǐ jiànkāng, měitiān zǎochén dōu qù pǎobù bàn ge xiǎoshí. Pǎo wán bù yǐhòu, tā chī yí ge jīdàn, hē yì bēi niúnǎi, ránhòu qù shàngbān.",
    translation: "Tiểu Trương vì sức khỏe, mỗi buổi sáng đều chạy bộ nửa tiếng. Sau khi chạy bộ xong, anh ấy ăn một quả trứng gà, uống một ly sữa tươi rồi đi làm.",
    question: "小张每天早晨做什么运动？",
    questionPinyin: "Xiǎo Zhāng měitiān zǎochén zuò shénme yùndòng?",
    options: ["游泳", "踢足球", "打篮球", "跑步"],
    correctIndex: 3
  },
  {
    id: "r_hsk2_3",
    level: 2,
    type: "cloze",
    title: "Mua sắm quần áo",
    passage: "这件白色的衣服比那件红色的[1]一些。虽然样式很新，[2]我觉得有一点儿贵。服务员说打折后很[3]。",
    pinyin: "Zhè jiàn báisè de yīfu bǐ nà jiàn hóngsè de cháng yìxiē. Suīrán yàngshì hěn xīn, dànshì wǒ juéde yǒu yìdiǎnr guì. Fúwùyuán shuō dǎzhé hòu hěn piányi.",
    translation: "Chiếc áo màu trắng này dài hơn chiếc màu đỏ một chút. Mặc dù kiểu dáng rất mới, nhưng tôi thấy hơi đắt một chút. Nhân viên phục vụ nói sau khi giảm giá thì rất rẻ.",
    wordBank: ["长", "但是", "便宜", "快", "帮助"],
    answers: { "1": "长", "2": "但是", "3": "便宜" }
  },
  {
    id: "r_hsk2_4",
    level: 2,
    type: "qa",
    title: "Bị ốm đi khám bệnh",
    passage: "昨天晚上王老师觉得头疼，今天早上他去医院看病。医生让他按时吃药，多休息，这两天不要太累。",
    pinyin: "Zuótiān wǎnshang Wáng lǎoshī juéde tóuténg, jīntiān zǎoshang tā qù yīyuàn kànbìng. Yīshēng ràng tā ànshí chī yào, duō xiūxi, zhè liǎng tiān bú yào tài lèi.",
    translation: "Tối qua thầy Vương cảm thấy đau đầu, sáng nay thầy đến bệnh viện khám bệnh. Bác sĩ bảo thầy uống thuốc đúng giờ, nghỉ ngơi nhiều, hai ngày này đừng quá mệt mỏi.",
    question: "医生给王老师什么建议？",
    questionPinyin: "Yīshēng gěi Wáng lǎoshī shénme jiànyì?",
    options: ["多去运动", "按时吃药多休息", "多喝咖啡", "去学校上课"],
    correctIndex: 1
  },
  {
    id: "r_hsk2_5",
    level: 2,
    type: "cloze",
    title: "Chuyển nhà mới",
    passage: "我们上个星期[1]了新家。新家离我上班的公司很[2]，每天走路十五分钟就[3]了。",
    pinyin: "Wǒmen shàng ge xīngqī bān le xīn jiā. Xīn jiā lí wǒ shàngbān de gōngsī hěn jìn, měitiān zǒulù shíwǔ fēnzhōng jiù dào le.",
    translation: "Tuần trước chúng tôi đã chuyển đến nhà mới. Nhà mới cách công ty tôi đi làm rất gần, mỗi ngày đi bộ mười lăm phút là đến rồi.",
    wordBank: ["搬", "近", "到", "走", "离"],
    answers: { "1": "搬", "2": "近", "3": "到" }
  },
  {
    id: "r_hsk2_6",
    level: 2,
    type: "qa",
    title: "Đi tàu cao tốc",
    passage: "以前从这里去上海坐普通火车要十个小时，现在坐高铁只要三个小时，既舒服又快速。",
    pinyin: "Yǐqián cóng zhèlǐ qù Shànghǎi zuò pǔtōng huǒchē yào shí ge xiǎoshí, xiànzài zuò gāotiě zhǐ yào sān ge xiǎoshí, jì shūfu yòu kuàisù.",
    translation: "Trước đây từ đây đi Thượng Hải ngồi tàu hỏa thường mất mười tiếng, bây giờ đi tàu cao tốc chỉ mất ba tiếng, vừa thoải mái vừa nhanh chóng.",
    question: "现在坐高铁去上海需要多长时间？",
    questionPinyin: "Xiànzài zuò gāotiě qù Shànghǎi xūyào duō cháng shíjiān?",
    options: ["十个小时", "三个小时", "五个小时", "一天"],
    correctIndex: 1
  },
  {
    id: "r_hsk2_7",
    level: 2,
    type: "cloze",
    title: "Học nấu món ăn",
    passage: "我觉得做中国菜很[1]。我常常在网上看视频学习。今天我把西红柿和鸡蛋[2]在一起，味道非常好[3]。",
    pinyin: "Wǒ juéde zuò Zhōngguócài hěn yǒu yìsi. Wǒ chángcháng zài wǎngshang kàn shìpín xuéxí. Jīntiān wǒ bǎ xīhóngshì hé jīdàn zuò zài yìqǐ, wèidào fēicháng hǎochī.",
    translation: "Tôi thấy nấu món ăn Trung Quốc rất thú vị. Tôi thường xem video trên mạng để học. Hôm nay tôi xào cà chua chung với trứng, mùi vị rất ngon miệng.",
    wordBank: ["有意思", "做", "吃", "没意思", "卖"],
    answers: { "1": "有意思", "2": "做", "3": "吃" }
  },
  {
    id: "r_hsk2_8",
    level: 2,
    type: "qa",
    title: "Món quà sinh nhật",
    passage: "昨天是妹妹的生日，哥哥送给她一块漂亮的手表。妹妹非常喜欢，立刻戴在了手上。",
    pinyin: "Zuótiān shì mèimei de shēngrì, gēge sòng gěi tā yí kuài piàoliang de shǒubiǎo. Mèimei fēicháng xǐhuan, lìkè dài zài le shǒu shang.",
    translation: "Hôm qua là sinh nhật em gái, anh trai tặng cho em một chiếc đồng hồ đeo tay rất đẹp. Em gái vô cùng thích, lập tức đeo vào tay.",
    question: "哥哥送给妹妹什么生日礼物？",
    questionPinyin: "Gēge sòng gěi mèimei shénme shēngrì lǐwù?",
    options: ["一本书", "一件衣服", "一块手表", "一个新手机"],
    correctIndex: 2
  },
  {
    id: "r_hsk2_9",
    level: 2,
    type: "cloze",
    title: "Thời tiết giao mùa",
    passage: "现在的天气越来越[1]了。出门的时候要多穿一件[2]，别感冒了。大家都要注意身体[3]。",
    pinyin: "Xiànzài de tiānqì yuèláiyuè lěng le. Chūmén de shíhou yào duō chuān yí jiàn yīfu, bié gǎnmào le. Dàjiā dōu yào zhùyì shēntǐ jiànkāng.",
    translation: "Thời tiết bây giờ ngày càng lạnh rồi. Khi ra ngoài nên mặc thêm một chiếc áo, đừng để bị cảm lạnh. Mọi người đều phải chú ý sức khỏe.",
    wordBank: ["冷", "衣服", "健康", "热", "慢"],
    answers: { "1": "冷", "2": "衣服", "3": "健康" }
  },
  {
    id: "r_hsk2_10",
    level: 2,
    type: "qa",
    title: "Sở thích đọc sách",
    passage: "大卫每个周末最喜欢做的事情就是去图书馆看书。他觉得看书不仅能学到新知识，还能让心情放松。",
    pinyin: "Dàwèi měi ge zhōumò zuì xǐhuan zuò de shìqing jiù shì qù túshūguǎn kàn shū. Tā juéde kàn shū bùjǐn néng xuédào xīn zhīshi, hái néng ràng xīnqíng fàngsōng.",
    translation: "Việc David thích làm nhất mỗi dịp cuối tuần là đến thư viện đọc sách. Cậu ấy thấy đọc sách không chỉ học được kiến thức mới mà còn giúp tâm trạng thư giãn.",
    question: "大卫周末最喜欢做什么？",
    questionPinyin: "Dàwèi zhōumò zuì xǐhuan zuò shénme?",
    options: ["去图书馆看书", "去电影院看电影", "去体育馆跑步", "去超市买东西"],
    correctIndex: 0
  },
  {
    id: "r_hsk2_11",
    level: 2,
    type: "cloze",
    title: "Công việc tại công ty",
    passage: "他在一家外贸公司[1]。因为他会说英语和汉语，所以工作做得很[2]。经理经常[3]他。",
    pinyin: "Tā zài yì jiā wàimào gōngsī gōngzuò. Yīnwèi tā huì shuō Yīngyǔ hé Hànyǔ, suǒyǐ gōngzuò zuò de hěn hǎo. Jīnglǐ chángcháng biǎoyáng tā.",
    translation: "Anh ấy làm việc tại một công ty ngoại thương. Vì anh ấy biết nói cả tiếng Anh và tiếng Hán, nên công việc làm rất tốt. Giám đốc thường khen ngợi anh ấy.",
    wordBank: ["工作", "好", "表扬", "学习", "难"],
    answers: { "1": "工作", "2": "好", "3": "表扬" }
  },
  {
    id: "r_hsk2_12",
    level: 2,
    type: "qa",
    title: "Kỳ nghỉ hè của Lý Minh",
    passage: "放暑假了，李明打算先去爷爷奶奶家住两个星期，然后再和爸爸妈妈一起去海边看大海。",
    pinyin: "Fàng shǔjià le, Lǐ Míng dǎsuàn xiān qù yéye nǎinai jiā zhù liǎng ge xīngqī, ránhòu zài hé bàba māma yìqǐ qù hǎibiān kàn dàhǎi.",
    translation: "Được nghỉ hè rồi, Lý Minh dự định trước tiên đến nhà ông bà nội ở hai tuần, sau đó sẽ cùng bố mẹ đến bãi biển ngắm biển.",
    question: "李明放暑假后打算先做什么？",
    questionPinyin: "Lǐ Míng fàng shǔjià hòu dǎsuàn xiān zuò shénme?",
    options: ["去海边旅游", "去爷爷奶奶家住两周", "在家写作业", "去参加夏令营"],
    correctIndex: 1
  },

  // ══════════════════════════════════════════════════════════
  // HSK 3 (12 bài đọc)
  // ══════════════════════════════════════════════════════════
  {
    id: "r_hsk3_1",
    level: 3,
    type: "cloze",
    title: "Kế hoạch leo núi",
    passage: "周末我打算和朋友一起去[1]山。虽然天气有一点儿[2]，但是我们都很[3]。",
    pinyin: "Zhōumò wǒ dǎsuàn hé péngyou yìqǐ qù pá shān. Suīrán tiānqì yǒu yìdiǎnr lěng, dànshì wǒmen dōu hěn gāoxìng.",
    translation: "Cuối tuần tôi dự định cùng bạn bè đi leo núi. Tuy thời tiết hơi lạnh một chút, nhưng chúng tôi đều rất vui vẻ.",
    wordBank: ["爬", "冷", "高兴", "忙", "饱"],
    answers: { "1": "爬", "2": "冷", "3": "高兴" }
  },
  {
    id: "r_hsk3_2",
    level: 3,
    type: "qa",
    title: "Thói quen uống cà phê",
    passage: "小王每天早上都要喝一杯黑咖啡，这样能让他工作的时候更有精神。他说咖啡的味道虽然有点儿苦，但能让他保持专注。",
    pinyin: "Xiǎo Wáng měitiān zǎoshang dōu yào hē yì bēi hēi kāfēi, zhèyàng néng ràng tā gōngzuò de shíhou gèng yǒu jīngshén. Tā shuō kāfēi de wèidào suīrán yǒudiǎnr kǔ, dàn néng ràng tā bǎochí zhuānzhù.",
    translation: "Tiểu Vương mỗi sáng đều phải uống một cốc cà phê đen, việc này giúp anh ấy làm việc tỉnh táo hơn. Anh ấy nói vị cà phê tuy hơi đắng nhưng giúp anh ấy duy trì sự tập trung.",
    question: "小王为什么要喝黑咖啡？",
    questionPinyin: "Xiǎo Wáng wèishénme yào hē hēi kāfēi?",
    options: ["因为他口渴", "为了让工作更有精神", "因为咖啡很便宜", "他不喜欢喝茶"],
    correctIndex: 1
  },
  {
    id: "r_hsk3_3",
    level: 3,
    type: "cloze",
    title: "Bảo vệ môi trường",
    passage: "现在很多人都开始骑自行车上班，这样不但能锻炼[1]，而且对保护环境很有[2]。城市里的空气也越来越[3]了。",
    pinyin: "Xiànzài hěn duō rén dōu kāishǐ qí zìxíngchē shàngbān, zhèyàng búdàn néng duànliàn shēntǐ, érqiě duì bǎohù huánjìng hěn yǒu hǎochu. Chéngshì li de kōngqì yě yuèláiyuè xīnxuān le.",
    translation: "Hiện nay nhiều người bắt đầu đạp xe đi làm, việc này không chỉ rèn luyện thân thể mà còn rất có lợi cho việc bảo vệ môi trường. Không khí trong thành phố cũng ngày càng trong lành.",
    wordBank: ["身体", "好处", "新鲜", "麻烦", "简单"],
    answers: { "1": "身体", "2": "好处", "3": "新鲜" }
  },
  {
    id: "r_hsk3_4",
    level: 3,
    type: "qa",
    title: "Bí quyết học chữ Hán",
    passage: "很多外国留学生觉得汉字很难写，但只要每天坚持练习写十个生词，多听汉语广播，水平就会提高得很快。",
    pinyin: "Hěn duō wàiguó liúxuéshēng juéde hànzì hěn nán xiě, dàn zhǐyào měitiān jiānchí liànxí xiě shí ge shēngcí, duō tīng Hànyǔ guǎngbō, shuǐpíng jiù huì tígāo de hěn kuài.",
    translation: "Nhiều lưu học sinh nước ngoài cảm thấy chữ Hán rất khó viết, nhưng chỉ cần mỗi ngày kiên trì luyện viết mười từ mới, nghe nhiều đài phát thanh tiếng Hán thì trình độ sẽ tiến bộ rất nhanh.",
    question: "根据这段话，学好汉字的关键是什么？",
    questionPinyin: "Gēnjù zhè duàn huà, xué hǎo hànzì de guānjiàn shì shénme?",
    options: ["每天看电影", "每天坚持练习写生词", "找中国朋友聊天", "去中国旅游"],
    correctIndex: 1
  },
  {
    id: "r_hsk3_5",
    level: 3,
    type: "cloze",
    title: "Lần đầu đi máy bay",
    passage: "第一次坐飞机的时候，他心里很[1]。飞机起飞后，透过窗户看到白云，他感到特别[2]。乘务员的服务也很[3]。",
    pinyin: "Dì-yī cì zuò fēijī de shíhou, tā xīnli hěn jǐnzhāng. Fēijī qǐfēi hòu, tòuguò chuānghu kàndào báiyún, tā gǎndào tèbié shénqí. Chéngwùyuán de fúwù yě hěn rèqíng.",
    translation: "Lần đầu tiên đi máy bay, trong lòng anh ấy rất căng thẳng. Sau khi máy bay cất cánh, nhìn qua cửa sổ thấy mây trắng, anh cảm thấy đặc biệt kỳ diệu. Dịch vụ của tiếp viên cũng rất nhiệt tình.",
    wordBank: ["紧张", "神奇", "热情", "难过", "危险"],
    answers: { "1": "紧张", "2": "神奇", "3": "热情" }
  },
  {
    id: "r_hsk3_6",
    level: 3,
    type: "qa",
    title: "Tình bạn thời đại học",
    passage: "虽然大学毕业已经五年了，但我和老李每个月都会通一次电话，聊聊各自的生活和工作，我们的友谊一直没有改变。",
    pinyin: "Suīrán dàxué bìyè yǐjīng wǔ nián le, dàn wǒ hé Lǎo Lǐ měi ge yuè dōu huì tōng yí cì diànhuà, liáoliao gèzì de shēnghuó hé gōngzuò, wǒmen de yǒuyì yìzhí méiyǒu gǎibiàn.",
    translation: "Tuy tốt nghiệp đại học đã năm năm rồi, nhưng tôi và Lão Lý mỗi tháng đều gọi điện cho nhau một lần, tán gẫu về cuộc sống và công việc của mỗi người, tình bạn của chúng tôi chưa từng thay đổi.",
    question: "这段话主要讲的是什么？",
    questionPinyin: "Zhè duàn huà zhǔyào jiǎng de shì shénme?",
    options: ["大学的学习生活", "毕业找工作的困难", "毕业后依然深厚的友谊", "电话费很贵"],
    correctIndex: 2
  },
  {
    id: "r_hsk3_7",
    level: 3,
    type: "cloze",
    title: "Giữ gìn vóc dáng",
    passage: "想要保持好身材，不能光靠节食，最重要的是要坚持[1]。饮食方面要多吃蔬菜水果，少吃[2]，生活要[3]。",
    pinyin: "Xiǎng yào bǎochí hǎo shēncái, bù néng guāng kào jiéshí, zuì zhòngyào de shì yào jiānchí yùndòng. Yǐnshí fāngmiàn yào duō chī shūcài shuǐguǒ, shǎo chī tiánshí, shēnghuó yào yǒu guīlǜ.",
    translation: "Muốn duy trì vóc dáng đẹp, không thể chỉ dựa vào nhịn ăn, điều quan trọng nhất là phải kiên trì vận động. Về ăn uống nên ăn nhiều rau củ hoa quả, ít ăn đồ ngọt, sinh hoạt phải có quy luật.",
    wordBank: ["运动", "甜食", "有规律", "睡觉", "生气"],
    answers: { "1": "运动", "2": "甜食", "3": "有规律" }
  },
  {
    id: "r_hsk3_8",
    level: 3,
    type: "qa",
    title: "Mua sắm trực tuyến",
    passage: "现在网购非常方便。如果买到的衣服尺码不合适或者颜色不喜欢，七天之内都可以无理由申请退货退款。",
    pinyin: "Xiànzài wǎnggòu fēicháng fāngbiàn. Rúguǒ mǎidào de yīfu chǐmǎ bù héshì huòzhě yánsè bù xǐhuan, qī tiān zhī nèi dōu kěyǐ wú lǐyóu shēnqǐng tuìhuò tuìkuǎn.",
    translation: "Hiện nay mua sắm online vô cùng tiện lợi. Nếu chiếc áo mua về kích cỡ không vừa hoặc màu sắc không thích, trong vòng bảy ngày đều có thể yêu cầu trả hàng hoàn tiền không cần lý do.",
    question: "在网上买的衣服不合适可以怎么样？",
    questionPinyin: "Zài wǎngshang mǎi de yīfu bù héshì kěyǐ zěnmeyàng?",
    options: ["只能送给朋友", "必须自己留着", "七天内可以申请退货退款", "去实体店换货"],
    correctIndex: 2
  },
  {
    id: "r_hsk3_9",
    level: 3,
    type: "cloze",
    title: "Buổi phỏng vấn xin việc",
    passage: "明天上午九点有一个重要的[1]。为了给考官留下一个好[2]，他特意买了一套整齐的西装，并提前[3]了常见问题。",
    pinyin: "Míngtiān shàngwǔ jiǔ diǎn yǒu yí ge zhòngyào de miànshì. Wèile gěi kǎoguān liúxià yí ge hǎo yìnxiàng, tā tèyì mǎi le yí tào zhěngqí de xīzhuāng, bìng tíqián zhǔnbèi le chángjiàn wèntí.",
    translation: "Sáng mai lúc chín giờ có một buổi phỏng vấn quan trọng. Để lại ấn tượng tốt cho giám khảo, anh ấy đặc biệt mua một bộ âu phục chỉn chu và chuẩn bị trước các câu hỏi thường gặp.",
    wordBank: ["面试", "印象", "准备", "比赛", "迟到"],
    answers: { "1": "面试", "2": "印象", "3": "准备" }
  },
  {
    id: "r_hsk3_10",
    level: 3,
    type: "qa",
    title: "Văn hóa thưởng trà",
    passage: "中国人喝茶的历史非常悠久。不同地方的人喜欢喝不同的茶，比如南方人喜欢绿茶，北方人喜欢花茶。",
    pinyin: "Zhōngguórén hē chá de lìshǐ fēicháng yōujiǔ. Bùtóng dìfang de rén xǐhuan hē bùtóng de chá, bǐrú nánfāngrén xǐhuan lǜchá, běifāngrén xǐhuan huāchá.",
    translation: "Lịch sử uống trà của người Trung Quốc vô cùng lâu đời. Người dân các vùng miền khác nhau thích uống các loại trà khác nhau, ví dụ người miền Nam thích trà xanh, người miền Bắc thích trà hoa.",
    question: "根据这段话，北方人普遍比较喜欢哪种茶？",
    questionPinyin: "Gēnjù zhè duàn huà, běifāngrén pǔbiàn bǐjiào xǐhuan nǎ zhǒng chá?",
    options: ["红茶", "绿茶", "花茶", "乌龙茶"],
    correctIndex: 2
  },
  {
    id: "r_hsk3_11",
    level: 3,
    type: "cloze",
    title: "Chuyến du lịch bất ngờ",
    passage: "这次去云南旅游，我们[1]到了很多热情的当地人。他们不仅为我们介绍景点的[2]，还请我们品尝了特色[3]。",
    pinyin: "Zhè cì qù Yúnnán lǚyóu, wǒmen yùdào le hěn duō rèqíng de dāngdìrén. Tāmen bùjǐn wèi wǒmen jièshào jǐngdiǎn de lìshǐ, hái qǐng wǒmen pǐncháng le tèsè xiǎochī.",
    translation: "Chuyến đi du lịch Vân Nam lần này, chúng tôi đã gặp rất nhiều người dân địa phương hiếu khách. Họ không chỉ giới thiệu lịch sử các danh lam thắng cảnh cho chúng tôi mà còn mời chúng tôi thưởng thức các món ăn vặt đặc sắc.",
    wordBank: ["遇", "历史", "小吃", "忘", "借"],
    answers: { "1": "遇", "2": "历史", "3": "小吃" }
  },
  {
    id: "r_hsk3_12",
    level: 3,
    type: "qa",
    title: "Tầm quan trọng của giấc ngủ",
    passage: "医生指出，成年人每天应该保证七到八小时的充足睡眠。长期熬夜不仅会影响第二天的记忆力，还会降低身体免疫力。",
    pinyin: "Yīshēng zhǐchū, chéngniánrén měitiān yīnggāi bǎozhèng qī dào bā xiǎoshí de chōngzú shuìmián. Chángqī áoyè bùjǐn huì yǐngxiǎng dì-èr tiān de jìyìlì, hái huì jiàngdī shēntǐ miǎnyìlì.",
    translation: "Bác sĩ chỉ ra rằng, người trưởng thành mỗi ngày nên đảm bảo giấc ngủ đầy đủ từ bảy đến tám tiếng. Thức khuya lâu ngày không chỉ ảnh hưởng đến trí nhớ của ngày hôm sau mà còn làm suy giảm khả năng miễn dịch của cơ thể.",
    question: "长期熬夜会对身体产生什么影响？",
    questionPinyin: "Chángqī áoyè huì duì shēntǐ chǎnshēng shénme yǐngxiǎng?",
    options: ["让人记忆力更好", "影响记忆力并降低免疫力", "让身体更有活力", "有利于减肥"],
    correctIndex: 1
  },

  // ══════════════════════════════════════════════════════════
  // HSK 4 (12 bài đọc)
  // ══════════════════════════════════════════════════════════
  {
    id: "r_hsk4_1",
    level: 4,
    type: "cloze",
    title: "Thái độ trong công việc",
    passage: "在工作中，遇到困难是难免的。重要的是保持积极的[1]。只要我们认真分析原因，积极寻找[2]办法，就没有克服不了的[3]。",
    pinyin: "Zài gōngzuò zhōng, yùdào kùnnan shì nánmiǎn de. Zhòngyào de shì bǎochí jījí de tàidu. Zhǐyào wǒmen rènjēn fēnxī yuányīn, jījí xúnzhǎo jiějué bànfǎ, jiù méiyǒu kèfú bù liǎo de kùnnan.",
    translation: "Trong công việc, gặp phải khó khăn là điều khó tránh khỏi. Điều quan trọng là duy trì một thái độ tích cực. Chỉ cần chúng ta chăm chỉ phân tích nguyên nhân, tích cực tìm kiếm biện pháp giải quyết thì không có khó khăn nào là không thể vượt qua.",
    wordBank: ["态度", "解决", "困难", "骄傲", "粗心"],
    answers: { "1": "态度", "2": "解决", "3": "困难" }
  },
  {
    id: "r_hsk4_2",
    level: 4,
    type: "qa",
    title: "Giá trị của sự thất bại",
    passage: "很多人害怕失败，但事实上，失败往往是通向成功必经的道路。每一次失败都能让我们发现自身的不足，从而积累宝贵的经验。",
    pinyin: "Hěn duō rén hàipà shībài, dàn shìshí shang, shībài wǎngwǎng shì tōngxiàng chénggōng bìjīng de dàolù. Měi yí cì shībài dōu néng ràng wǒmen fāxiàn zìshēn de bùzú, cóng'ér jīlěi bǎoguì de jīngyàn.",
    translation: "Nhiều người sợ hãi thất bại, nhưng trên thực tế, thất bại thường là con đường tất yếu dẫn tới thành công. Mỗi một lần thất bại đều giúp chúng ta nhận ra thiếu sót của bản thân, từ đó tích lũy được những kinh nghiệm quý giá.",
    question: "作者对“失败”持有什么态度？",
    questionPinyin: "Zuòzhě duì 'shībài' chíyǒu shénme tàidu?",
    options: ["应该完全避免失败", "失败没有任何意义", "失败能带来经验促成成功", "失败的人不值得尊重"],
    correctIndex: 2
  },
  {
    id: "r_hsk4_3",
    level: 4,
    type: "cloze",
    title: "Giao tiếp giữa người với người",
    passage: "人与人之间的交流，不仅需要语言，更需要真诚的[1]。懂得倾听别人说话，尊重他人的[2]，才能赢得别人的[3]和支持。",
    pinyin: "Rén yǔ rén zhījiān de jiāoliú, bùjǐn xūyào yǔyán, gèng xūyào zhēnchéng de wēixiào. Dǒngde qīngtīng biérén shuōhuà, zūnzhòng tārén de yìjiàn, cái néng yíngdé biérén de xìnrèn hé zhīchí.",
    translation: "Giao lưu giữa người với người không chỉ cần ngôn ngữ mà càng cần nụ cười chân thành. Biết lắng nghe người khác nói, tôn trọng ý kiến của người khác mới có thể giành được sự tín nhiệm và ủng hộ của mọi người.",
    wordBank: ["微笑", "意见", "信任", "怀疑", "批评"],
    answers: { "1": "微笑", "2": "意见", "3": "信任" }
  },
  {
    id: "r_hsk4_4",
    level: 4,
    type: "qa",
    title: "Đọc sách trên điện thoại",
    passage: "随着智能手机的普及，越来越多的人习惯在手机上阅读电子书。电子书不仅携带方便、价格便宜，而且随时随地都可以翻看，极大地方便了现代人的生活。",
    pinyin: "Suízhe zhìnéng shǒujī de pǔjí, yuèláiyuè duō de rén xíguàn zài shǒujī shang yuèdú diànzǐshū. Diànzǐshū bùjǐn xiédài fāngbiàn, jiàgé piányi, érqiě suíshí suídì dōu kěyǐ fānkàn, jídà de fāngbiàn le xiàndàirén de shēnghuó.",
    translation: "Cùng với sự phổ cập của điện thoại thông minh, ngày càng nhiều người có thói quen đọc sách điện tử trên điện thoại. Sách điện tử không chỉ mang theo tiện lợi, giá thành rẻ, mà còn có thể đọc bất cứ lúc nào bất cứ nơi đâu, tạo sự thuận tiện rất lớn cho cuộc sống người hiện đại.",
    question: "根据这段话，电子书的主要优点是什么？",
    questionPinyin: "Gēnjù zhè duàn huà, diànzǐshū de zhǔyào yōudiǎn shì shénme?",
    options: ["字体比纸质书大", "携带方便且随时可看", "适合老年人阅读", "完全不需要花钱"],
    correctIndex: 1
  },
  {
    id: "r_hsk4_5",
    level: 4,
    type: "cloze",
    title: "Quản lý thời gian hiệu quả",
    passage: "成功人士通常非常懂得合理[1]时间。他们会按照事情的轻重缓急列出[2]，绝不把今天的事情[3]到明天。",
    pinyin: "Chénggōng rénshì tōngcháng fēicháng dǒngde hélǐ ānpái shíjiān. Tāmen huì ànzhào shìqing de qīngzhòng huǎnjí lièchū jìhuà, juébù bǎ jīntiān de shìqing tuīchí dào míngtiān.",
    translation: "Những người thành công thông thường rất biết cách sắp xếp thời gian hợp lý. Họ sẽ dựa theo mức độ quan trọng khẩn cấp của sự việc để lên kế hoạch, tuyệt đối không hoãn việc của ngày hôm nay sang ngày mai.",
    wordBank: ["安排", "计划", "推迟", "浪费", "随便"],
    answers: { "1": "安排", "2": "计划", "3": "推迟" }
  },
  {
    id: "r_hsk4_6",
    level: 4,
    type: "qa",
    title: "Tính cách và sự nghiệp",
    passage: "心理学家研究发现，一个人的性格对其职业发展起着关键作用。性格开朗、善于与人合作的人，往往更容易在团队协作中脱颖而出。",
    pinyin: "Xīnlǐxuéjiā yánjiū fāxiàn, yí ge rén de xìnggé duì qí zhíyè fāzhǎn qǐ zhe guānjiàn zuòyòng. Xìnggé kāilǎng, shànyú yǔ rén hézuò de rén, wǎngwǎng gèng róngyì zài tuánduì xiézuò zhōng tuōyǐng-érchū.",
    translation: "Các nhà tâm lý học nghiên cứu phát hiện ra rằng tính cách của một người đóng vai trò then chốt đối với sự phát triển sự nghiệp của họ. Người có tính cách cởi mở, giỏi hợp tác với người khác thường dễ dàng nổi bật trong tinh thần làm việc nhóm.",
    question: "什么样的人更容易在团队中脱颖而出？",
    questionPinyin: "Shénmeyàng de rén gèng róngyì zài tuánduì zhōng tuōyǐng-érchū?",
    options: ["喜欢独自工作的人", "性格开朗且善于合作的人", "言语极少的人", "只听从指挥的人"],
    correctIndex: 1
  },
  {
    id: "r_hsk4_7",
    level: 4,
    type: "cloze",
    title: "Lối sống xanh",
    passage: "所谓绿色生活，就是指节约资源、减少[1]的生活方式。比如出门尽量乘坐公共[2]，减少塑料袋的[3]。",
    pinyin: "Suǒwèi lǜsè shēnghuó, jiù shì zhǐ jiéyuē zīyuán, jiǎnshǎo wūrǎn de shēnghuó fāngshì. Bǐrú chūmén jǐnliàng chéngzuò gōnggòng jiāotōng, jiǎnshǎo sùliàodài de shǐyòng.",
    translation: "Cái gọi là lối sống xanh chính là phương thức sinh hoạt tiết kiệm tài nguyên, giảm thiểu ô nhiễm. Ví dụ ra ngoài cố gắng đi phương tiện giao thông công cộng, giảm bớt việc sử dụng túi ni-lông.",
    wordBank: ["污染", "交通", "使用", "保护", "浪费"],
    answers: { "1": "污染", "2": "交通", "3": "使用" }
  },
  {
    id: "r_hsk4_8",
    level: 4,
    type: "qa",
    title: "Sức mạnh của lời khen ngợi",
    passage: "及时而真诚的赞美能够激发人的潜力。教育孩子时，鼓励和表扬往往比单纯的批评更有效果，能帮助孩子建立充足的自信心。",
    pinyin: "Jíshí ér zhēnchéng de zànměi nénggòu jīfā rén de qiánlì. Jiàoyù háizi shí, gǔlì hé biǎoyáng wǎngwǎng bǐ dānchún de pīpíng gèng yǒu xiàoguǒ, néng bāngzhù háizi jiànlì chōngzú de zìxìnxīn.",
    translation: "Lời khen ngợi kịp thời và chân thành có thể khơi dậy tiềm năng của con người. Khi giáo dục con cái, khích lệ và khen thưởng thường có hiệu quả hơn chỉ đơn thuần phê bình, có thể giúp trẻ xây dựng sự tự tin đầy đủ.",
    question: "怎样教育孩子更容易帮助其建立自信心？",
    questionPinyin: "Zěnyàng jiàoyù háizi gèng róngyì bāngzhù qí jiànlì zìxìnxīn?",
    options: ["经常严厉批评", "多给予鼓励和表扬", "让孩子独自面对一切", "不对孩子提出任何要求"],
    correctIndex: 1
  },
  {
    id: "r_hsk4_9",
    level: 4,
    type: "cloze",
    title: "Văn hóa nơi công cộng",
    passage: "在公共场所，我们应当自觉[1]公共秩序。在图书馆和医院请保持[2]，不要大声喧哗，共同营造一个良好的[3]。",
    pinyin: "Zài gōnggòng chǎngsuǒ, wǒmen yīngdāng zìjué zūnshǒu gōnggòng zhìxù. Zài túshūguǎn hé yīyuàn qǐng bǎochí ānjìng, bú yào dà shēng xuānhuá, gòngtóng yíngzào yí ge liánghǎo de huánjìng.",
    translation: "Ở nơi công cộng, chúng ta nên tự giác tuân thủ trật tự chung. Tại thư viện và bệnh viện xin vui lòng giữ trật tự im lặng, không làm ồn lớn tiếng, cùng nhau xây dựng một môi trường văn minh.",
    wordBank: ["遵守", "安静", "环境", "破坏", "随便"],
    answers: { "1": "遵守", "2": "安静", "3": "环境" }
  },
  {
    id: "r_hsk4_10",
    level: 4,
    type: "qa",
    title: "Tiêu dùng thông minh",
    passage: "购物时不要盲目追求名牌，而应该根据自己的实际需求和经济条件进行选择。适合自己的才是最好的，这才是理性的消费观念。",
    pinyin: "Gòuwù shí bú yào mángmù zhuīqiú míngpái, ér yīnggāi gēnjù zìjǐ de shíjì xūqiú hé jīngjì tiáojiàn jìnxíng xuǎnzé. Shìhé zìjǐ de cái shì zuì hǎo de, zhè cái shì lǐxìng de xiāofèi guānniàn.",
    translation: "Khi mua sắm đừng mù quáng chạy theo hàng hiệu, mà nên lựa chọn dựa theo nhu cầu thực tế và điều kiện kinh tế của mình. Thích hợp với bản thân mới là tốt nhất, đây mới là quan niệm tiêu dùng lý trí.",
    question: "什么是理性的消费观念？",
    questionPinyin: "Shénme shì lǐxìng de xiāofèi guānniàn?",
    options: ["一定要买最贵的商品", "只买知名大品牌", "根据实际需求与条件选择适合的", "尽量不花一分钱"],
    correctIndex: 2
  },
  {
    id: "r_hsk4_11",
    level: 4,
    type: "cloze",
    title: "Ý chí rèn luyện thể thao",
    passage: "坚持长跑不仅能增强体质，更能磨炼人的[1]。在感到疲惫想要放弃时，只要再坚持[2]，就能突破自己的[3]。",
    pinyin: "Jiānchí chángpǎo bùjǐn néng zēngqiáng tǐzhì, gèng néng móliàn rén de yìzhì. Zài gǎndào píbèi xiǎng yào fàngqì shí, zhǐyào zài jiānchí yíxià, jiù néng tūpò zìjǐ de jíxiàn.",
    translation: "Kiên trì chạy đường dài không chỉ nâng cao thể chất mà càng tôi luyện ý chí con người. Khi cảm thấy kiệt sức muốn bỏ cuộc, chỉ cần kiên trì thêm một chút là có thể đột phá giới hạn của chính mình.",
    wordBank: ["意志", "一下", "极限", "放弃", "骄傲"],
    answers: { "1": "意志", "2": "一下", "3": "极限" }
  },
  {
    id: "r_hsk4_12",
    level: 4,
    type: "qa",
    title: "Nghệ thuật từ chối",
    passage: "学会拒绝是一门艺术。当我们无法满足别人的要求时，委婉而真诚地说明原因，不仅不会伤害彼此的感情，反而能体现出自己的成熟与坦诚。",
    pinyin: "Xuéhuì jùjué shì yì mén yìshù. Dāng wǒmen wúfǎ mǎnzú biérén de yāoqiú shí, wěiwǎn ér zhēnchéng de shuōmíng yuányīn, bùjǐn bú huì shānghài bǐcǐ de gǎnqíng, fǎn'ér néng tǐxiàn chū zìjǐ de chéngshú yǔ tǎnchéng.",
    translation: "Học cách từ chối là một môn nghệ thuật. Khi chúng ta không thể đáp ứng yêu cầu của người khác, khéo léo và chân thành giải thích nguyên nhân không những không làm tổn thương tình cảm của nhau mà ngược lại còn thể hiện sự chín chắn và thẳng thắn của mình.",
    question: "面对无法满足的要求时，应该怎么做？",
    questionPinyin: "Miànduì wúfǎ mǎnzú de yāoqiú shí, yīnggāi zěnme zuò?",
    options: ["假装答应但不去做", "委婉真诚地说明原因拒绝", "生气地直接拒绝", "以后再也不理对方"],
    correctIndex: 1
  }
];

// Helper methods gắn vào DataStore nếu DataStore đã tồn tại
if (typeof DataStore !== "undefined") {
  DataStore.getReadings = function({ level, type } = {}) {
    return READING_DATA.filter((r) => {
      if (level != null && r.level !== Number(level)) return false;
      if (type && type !== "all" && r.type !== type) return false;
      return true;
    });
  };
  DataStore.getReadingById = function(id) {
    return READING_DATA.find((r) => r.id === id) || null;
  };
}
