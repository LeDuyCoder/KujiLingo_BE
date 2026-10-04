import csv
import uuid
from copy import copy
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "curriculum_n4_tu_vung"
OUT.mkdir(exist_ok=True)

# Vocabulary is authored as: kanji-or-surface|kana|Vietnamese meaning|word type.
LESSONS = [
    ("Giải thích sự việc", "Nêu lý do, kể sự cố và liên lạc khi có thay đổi.", "遅れる|おくれる|đến muộn|VERB;迷う|まよう|bị lạc, phân vân|VERB;故障|こしょう|sự hỏng hóc|NOUN;事故|じこ|tai nạn|NOUN;渋滞|じゅうたい|tắc đường|NOUN;理由|りゆう|lý do|NOUN;説明|せつめい|sự giải thích|NOUN;連絡|れんらく|liên lạc|NOUN;急ぐ|いそぐ|vội, nhanh lên|VERB;間に合う|まにあう|kịp giờ|VERB;迎える|むかえる|đón, chào đón|VERB;困る|こまる|gặp khó khăn|VERB"),
    ("Khả năng và thiết bị", "Từ vựng về khả năng, máy móc, công việc và công nghệ.", "建てる|たてる|xây dựng|VERB;直す|なおす|sửa chữa|VERB;壊す|こわす|làm hỏng|VERB;壊れる|こわれる|bị hỏng|VERB;動く|うごく|chuyển động, hoạt động|VERB;運転する|うんてんする|lái xe|VERB;技術|ぎじゅつ|kỹ thuật|NOUN;道具|どうぐ|dụng cụ|NOUN;機械|きかい|máy móc|NOUN;工場|こうじょう|nhà máy|NOUN;専門|せんもん|chuyên môn|NOUN;電池|でんち|pin|NOUN"),
    ("Công việc và sinh hoạt", "Nói về thói quen làm việc, nghỉ ngơi và sắp xếp sinh hoạt.", "勤める|つとめる|làm việc tại (công ty)|VERB;休憩|きゅうけい|giờ nghỉ|NOUN;残業|ざんぎょう|làm thêm giờ|NOUN;続ける|つづける|tiếp tục|VERB;片付ける|かたづける|dọn dẹp, sắp xếp|VERB;集める|あつめる|thu thập, tập hợp|VERB;相談|そうだん|sự trao đổi, tư vấn|NOUN;参加|さんか|sự tham gia|NOUN;しばらく|しばらく|một lúc, một thời gian|ADVERB;ちゃんと|ちゃんと|đàng hoàng, đúng cách|ADVERB;ほとんど|ほとんど|hầu hết, gần như|ADVERB;用事|ようじ|việc bận, công việc cần làm|NOUN"),
    ("Sức khỏe và bệnh viện", "Gọi tên triệu chứng, khám bệnh và chăm sóc sức khỏe.", "頭痛|ずつう|đau đầu|NOUN;熱|ねつ|sốt, nhiệt độ|NOUN;咳|せき|ho|NOUN;喉|のど|cổ họng|NOUN;怪我|けが|vết thương, bị thương|NOUN;診察|しんさつ|sự khám bệnh|NOUN;注射|ちゅうしゃ|tiêm, mũi tiêm|NOUN;治る|なおる|khỏi bệnh, lành|VERB;健康|けんこう|sức khỏe|NOUN;薬局|やっきょく|hiệu thuốc|NOUN;体温|たいおん|thân nhiệt|NOUN;痛み|いたみ|cơn đau|NOUN"),
    ("Chuẩn bị và đồ dùng", "Chuẩn bị việc cần làm, kiểm tra đồ đạc và lịch hẹn.", "準備|じゅんび|sự chuẩn bị|NOUN;用意|ようい|sự chuẩn bị, sắp sẵn|NOUN;確認|かくにん|sự xác nhận, kiểm tra|NOUN;予約|よやく|đặt trước|NOUN;必要|ひつよう|cần thiết|NA_ADJECTIVE;冷蔵庫|れいぞうこ|tủ lạnh|NOUN;電子レンジ|でんしレンジ|lò vi sóng|NOUN;棚|たな|kệ|NOUN;引き出し|ひきだし|ngăn kéo|NOUN;玄関|げんかん|lối vào nhà|NOUN;留守|るす|vắng nhà|NOUN;鍵|かぎ|chìa khóa|NOUN"),
    ("Kế hoạch và sự kiện", "Lên kế hoạch, thay đổi lịch và tham gia sự kiện.", "計画|けいかく|kế hoạch|NOUN;出発|しゅっぱつ|sự khởi hành|NOUN;到着|とうちゃく|sự đến nơi|NOUN;申し込む|もうしこむ|đăng ký|VERB;決める|きめる|quyết định|VERB;変える|かえる|thay đổi|VERB;招待|しょうたい|sự mời, lời mời|NOUN;集合|しゅうごう|sự tập hợp|NOUN;都合|つごう|sự thuận tiện, lịch trình|NOUN;予定|よてい|dự định, kế hoạch|NOUN;間|あいだ|khoảng thời gian, trong khi|NOUN;楽しみ|たのしみ|điều mong đợi, niềm vui|NOUN"),
    ("Lời khuyên và thể trạng", "Trao đổi về thể trạng, nghỉ ngơi và cách chăm sóc bản thân.", "運動|うんどう|vận động, tập thể dục|NOUN;睡眠|すいみん|giấc ngủ|NOUN;食事|しょくじ|bữa ăn, việc ăn uống|NOUN;栄養|えいよう|dinh dưỡng|NOUN;体調|たいちょう|tình trạng sức khỏe|NOUN;無理|むり|quá sức, không thể|NOUN;心配|しんぱい|lo lắng|NOUN;休養|きゅうよう|sự nghỉ ngơi|NOUN;できるだけ|できるだけ|hết sức có thể|ADVERB;たぶん|たぶん|có lẽ|ADVERB;きっと|きっと|chắc hẳn|ADVERB;十分|じゅうぶん|đầy đủ, đủ|NA_ADJECTIVE"),
    ("Quy định và thủ tục", "Hiểu nội quy, biển báo, giấy tờ và hướng dẫn.", "規則|きそく|quy định|NOUN;禁止|きんし|cấm|NOUN;注意|ちゅうい|chú ý, cảnh báo|NOUN;説明書|せつめいしょ|sách hướng dẫn|NOUN;意味|いみ|ý nghĩa|NOUN;翻訳|ほんやく|bản dịch, dịch thuật|NOUN;調べる|しらべる|tra cứu, điều tra|VERB;書類|しょるい|giấy tờ, tài liệu|NOUN;受付|うけつけ|quầy tiếp nhận|NOUN;係|かかり|người phụ trách|NOUN;記入|きにゅう|việc điền thông tin|NOUN;提出|ていしゅつ|việc nộp|NOUN"),
    ("Nấu ăn và hướng dẫn", "Từ vựng về nguyên liệu, hương vị và các bước nấu ăn.", "混ぜる|まぜる|trộn|VERB;焼く|やく|nướng, rán|VERB;煮る|にる|nấu, hầm|VERB;切る|きる|cắt|VERB;入れる|いれる|cho vào|VERB;取り出す|とりだす|lấy ra|VERB;材料|ざいりょう|nguyên liệu|NOUN;味|あじ|vị, hương vị|NOUN;砂糖|さとう|đường|NOUN;塩|しお|muối|NOUN;しょうゆ|しょうゆ|nước tương|NOUN;手順|てじゅん|trình tự, các bước|NOUN"),
    ("Thiên nhiên và mùa", "Miêu tả thời tiết, cảnh sắc, cây cối và các mùa.", "季節|きせつ|mùa|NOUN;春|はる|mùa xuân|NOUN;夏|なつ|mùa hè|NOUN;秋|あき|mùa thu|NOUN;冬|ふゆ|mùa đông|NOUN;桜|さくら|hoa anh đào|NOUN;紅葉|こうよう|lá đổi màu mùa thu|NOUN;景色|けしき|phong cảnh|NOUN;湖|みずうみ|hồ|NOUN;島|しま|hòn đảo|NOUN;雲|くも|mây|NOUN;風|かぜ|gió|NOUN"),
    ("Mục tiêu và tiến bộ", "Diễn đạt mục tiêu, nỗ lực, thói quen và sự tiến bộ.", "目標|もくひょう|mục tiêu|NOUN;将来|しょうらい|tương lai|NOUN;夢|ゆめ|ước mơ|NOUN;努力|どりょく|sự nỗ lực|NOUN;練習|れんしゅう|luyện tập|NOUN;上達|じょうたつ|sự tiến bộ, thành thạo|NOUN;習慣|しゅうかん|thói quen|NOUN;挑戦|ちょうせん|sự thử thách|NOUN;身につける|みにつける|học được, trang bị cho mình|VERB;増える|ふえる|tăng lên|VERB;減る|へる|giảm đi|VERB;成功|せいこう|thành công|NOUN"),
    ("Thi đấu và thành tích", "Nói về trận đấu, kết quả, người tham gia và thành tích.", "優勝|ゆうしょう|vô địch|NOUN;試合|しあい|trận đấu|NOUN;選手|せんしゅ|tuyển thủ|NOUN;応援|おうえん|cổ vũ|NOUN;勝つ|かつ|thắng|VERB;負ける|まける|thua|VERB;結果|けっか|kết quả|NOUN;成績|せいせき|thành tích, điểm số|NOUN;代表|だいひょう|đại diện|NOUN;選ぶ|えらぶ|lựa chọn|VERB;表|ひょう|bảng, biểu|NOUN;残念|ざんねん|đáng tiếc|NA_ADJECTIVE"),
    ("Ý kiến và đời sống", "Nói về suy nghĩ, ý kiến, cảm xúc và các khía cạnh xã hội.", "経験|けいけん|kinh nghiệm|NOUN;意見|いけん|ý kiến|NOUN;気持ち|きもち|tâm trạng, cảm giác|NOUN;考え|かんがえ|suy nghĩ|NOUN;文化|ぶんか|văn hóa|NOUN;生活|せいかつ|cuộc sống, sinh hoạt|NOUN;社会|しゃかい|xã hội|NOUN;場合|ばあい|trường hợp|NOUN;例えば|たとえば|ví dụ|ADVERB;特別|とくべつ|đặc biệt|NA_ADJECTIVE;普通|ふつう|bình thường|NOUN;自由|じゆう|tự do|NA_ADJECTIVE"),
    ("Gia đình và trưởng thành", "Từ vựng về gia đình, quan hệ họ hàng và quá trình lớn lên.", "祖父|そふ|ông (của mình)|NOUN;祖母|そぼ|bà (của mình)|NOUN;孫|まご|cháu|NOUN;親戚|しんせき|họ hàng|NOUN;夫|おっと|chồng (của mình)|NOUN;妻|つま|vợ (của mình)|NOUN;息子|むすこ|con trai|NOUN;娘|むすめ|con gái|NOUN;育てる|そだてる|nuôi dạy|VERB;生まれる|うまれる|được sinh ra|VERB;育つ|そだつ|lớn lên|VERB;大切|たいせつ|quan trọng, quý giá|NA_ADJECTIVE"),
    ("Du lịch và di chuyển", "Chuẩn bị chuyến đi, hỏi dịch vụ và di chuyển giữa các địa điểm.", "観光|かんこう|tham quan|NOUN;旅館|りょかん|nhà trọ kiểu Nhật|NOUN;宿泊|しゅくはく|lưu trú|NOUN;料金|りょうきん|chi phí, giá cước|NOUN;荷物|にもつ|hành lý|NOUN;空港|くうこう|sân bay|NOUN;飛行機|ひこうき|máy bay|NOUN;乗り換える|のりかえる|đổi tuyến, chuyển tàu|VERB;片道|かたみち|một chiều|NOUN;往復|おうふく|khứ hồi|NOUN;近所|きんじょ|khu vực lân cận|NOUN;案内|あんない|hướng dẫn|NOUN"),
    ("Quà tặng và giao tiếp", "Dùng từ lịch sự khi thăm hỏi, cảm ơn và trao quà.", "贈り物|おくりもの|quà tặng|NOUN;お祝い|おいわい|lời chúc mừng, quà mừng|NOUN;お礼|おれい|lời cảm ơn, quà cảm ơn|NOUN;お見舞い|おみまい|thăm người bệnh|NOUN;訪ねる|たずねる|đến thăm|VERB;届ける|とどける|giao, chuyển đến|VERB;お世話|おせわ|sự giúp đỡ, chăm sóc|NOUN;親切|しんせつ|tốt bụng, tử tế|NA_ADJECTIVE;遠慮|えんりょ|sự khách sáo, ngại|NOUN;申し訳ない|もうしわけない|xin lỗi, áy náy|I_ADJECTIVE;どうぞ|どうぞ|xin mời, xin cứ tự nhiên|EXPRESSION;よろしく|よろしく|mong được giúp đỡ, xin gửi lời|EXPRESSION"),
    ("Công sở và nghề nghiệp", "Từ vựng về tuyển dụng, họp hành, tài liệu và công tác.", "給料|きゅうりょう|tiền lương|NOUN;面接|めんせつ|phỏng vấn|NOUN;会議|かいぎ|cuộc họp|NOUN;資料|しりょう|tài liệu|NOUN;印刷|いんさつ|in ấn|NOUN;出張|しゅっちょう|chuyến công tác|NOUN;休暇|きゅうか|kỳ nghỉ phép|NOUN;経験|けいけん|kinh nghiệm|NOUN;担当|たんとう|phụ trách|NOUN;採用|さいよう|tuyển dụng|NOUN;連絡先|れんらくさき|thông tin liên lạc|NOUN;打ち合わせ|うちあわせ|buổi trao đổi công việc|NOUN"),
    ("Hình dáng và tình trạng", "Miêu tả đặc điểm, sự thay đổi và trạng thái của đồ vật.", "形|かたち|hình dạng|NOUN;色|いろ|màu sắc|NOUN;匂い|におい|mùi|NOUN;音|おと|âm thanh|NOUN;似合う|にあう|hợp, hợp với|VERB;着替える|きがえる|thay quần áo|VERB;変わる|かわる|thay đổi|VERB;片付く|かたづく|được dọn gọn|VERB;汚れる|よごれる|bị bẩn|VERB;並ぶ|ならぶ|xếp hàng, được bày|VERB;丁寧|ていねい|lịch sự, cẩn thận|NA_ADJECTIVE;複雑|ふくざつ|phức tạp|NA_ADJECTIVE"),
    ("Mức độ và đánh giá", "So sánh mức độ, đánh giá việc dễ/khó và tình trạng đủ thiếu.", "過ぎる|すぎる|quá, vượt quá|VERB;足りる|たりる|đủ|VERB;簡単|かんたん|đơn giản|NA_ADJECTIVE;苦手|にがて|không giỏi, không thích|NA_ADJECTIVE;得意|とくい|giỏi, sở trường|NA_ADJECTIVE;十分|じゅうぶん|đủ, đầy đủ|NA_ADJECTIVE;かなり|かなり|khá, tương đối|ADVERB;特に|とくに|đặc biệt là|ADVERB;ずっと|ずっと|suốt, hơn hẳn|ADVERB;だんだん|だんだん|dần dần|ADVERB;比べる|くらべる|so sánh|VERB;選択|せんたく|sự lựa chọn|NOUN"),
    ("Sự cố và an toàn", "Nói về thiên tai, tình huống nguy hiểm và cách bảo vệ mọi người.", "火事|かじ|hỏa hoạn|NOUN;大雨|おおあめ|mưa lớn|NOUN;地震|じしん|động đất|NOUN;台風|たいふう|bão|NOUN;逃げる|にげる|chạy trốn, sơ tán|VERB;助ける|たすける|giúp, cứu|VERB;危険|きけん|nguy hiểm|NOUN;安全|あんぜん|an toàn|NA_ADJECTIVE;非常口|ひじょうぐち|lối thoát hiểm|NOUN;避難|ひなん|sơ tán|NOUN;もし|もし|nếu|ADVERB;それでも|それでも|dù vậy|CONJUNCTION"),
    ("Thời điểm và tiến độ", "Nói về việc vừa xảy ra, sắp xảy ra và các mốc thời gian.", "さっき|さっき|lúc nãy|ADVERB;たった今|たったいま|vừa mới đây|ADVERB;間もなく|まもなく|chẳng bao lâu nữa|ADVERB;もうすぐ|もうすぐ|sắp sửa|ADVERB;これから|これから|từ bây giờ|ADVERB;先ほど|さきほど|vừa nãy (lịch sự)|ADVERB;すぐ|すぐ|ngay lập tức|ADVERB;まだ|まだ|vẫn còn, chưa|ADVERB;とうとう|とうとう|cuối cùng thì|ADVERB;遅刻|ちこく|sự đi muộn|NOUN;期限|きげん|thời hạn|NOUN;間に|あいだに|trong lúc, trong khoảng|NOUN"),
    ("Tin tức và thông tin", "Đọc, nghe và truyền đạt tin tức hoặc thông báo.", "ニュース|ニュース|tin tức|NOUN;記事|きじ|bài báo|NOUN;新聞|しんぶん|báo|NOUN;放送|ほうそう|chương trình phát sóng|NOUN;発表|はっぴょう|sự công bố, thuyết trình|NOUN;話題|わだい|chủ đề, chuyện đang được nói đến|NOUN;うわさ|うわさ|tin đồn|NOUN;知らせ|しらせ|tin báo, thông báo|NOUN;情報|じょうほう|thông tin|NOUN;受け取る|うけとる|nhận|VERB;伝える|つたえる|truyền đạt|VERB;報告|ほうこく|báo cáo|NOUN"),
    ("Trách nhiệm và phân công", "Nói về nhiệm vụ, sự có mặt và việc nhờ người khác đảm nhận.", "責任|せきにん|trách nhiệm|NOUN;任せる|まかせる|giao phó|VERB;当番|とうばん|người trực, phiên trực|NOUN;出席|しゅっせき|sự có mặt|NOUN;欠席|けっせき|sự vắng mặt|NOUN;手伝う|てつだう|giúp đỡ|VERB;世話|せわ|chăm sóc|NOUN;準備|じゅんび|sự chuẩn bị|NOUN;係員|かかりいん|nhân viên phụ trách|NOUN;頼む|たのむ|nhờ, yêu cầu|VERB;代わり|かわり|sự thay thế, thay cho|NOUN;必要|ひつよう|cần thiết|NA_ADJECTIVE"),
    ("Khiêm nhường trong công việc", "Từ ngữ thường gặp khi tiếp khách, gọi điện và trao đổi lịch sự.", "申す|もうす|nói (khiêm nhường)|VERB;伺う|うかがう|hỏi, thăm (khiêm nhường)|VERB;参る|まいる|đi, đến (khiêm nhường)|VERB;頂く|いただく|nhận, ăn/uống (khiêm nhường)|VERB;拝見する|はいけんする|xem (khiêm nhường)|VERB;存じる|ぞんじる|biết (khiêm nhường)|VERB;訪問|ほうもん|sự thăm viếng|NOUN;案内|あんない|sự hướng dẫn|NOUN;お忙しい|おいそがしい|bận (cách nói lịch sự)|I_ADJECTIVE;失礼|しつれい|thất lễ, xin phép|NOUN;承知|しょうち|sự hiểu, chấp thuận|NOUN;少々|しょうしょう|một chút (lịch sự)|ADVERB"),
    ("Lời cảm ơn và kết thúc", "Ôn từ vựng lịch sự để cảm ơn, xin lỗi và kết thúc trao đổi.", "感謝|かんしゃ|lòng biết ơn|NOUN;おかげ|おかげ|nhờ có, nhờ vào|NOUN;心|こころ|trái tim, tấm lòng|NOUN;皆様|みなさま|quý vị, mọi người|NOUN;迷惑|めいわく|phiền toái, làm phiền|NOUN;今後|こんご|từ nay về sau|NOUN;改めて|あらためて|một lần nữa, dịp khác|ADVERB;本当に|ほんとうに|thật sự|ADVERB;どうも|どうも|cảm ơn/nhiều (tùy ngữ cảnh)|EXPRESSION;お元気で|おげんきで|chúc mạnh khỏe|EXPRESSION;よろしくお願いします|よろしくおねがいします|mong được giúp đỡ|EXPRESSION;失礼します|しつれいします|xin phép (ra về/kết thúc)|EXPRESSION"),
]

TABLES = {
    "Courses": ["id", "title", "description", "image", "order_no", "deleted_at"],
    "Lessons": ["id", "course_id", "title", "description", "order_no"],
    "Topics": ["id", "lesson_id", "title", "description", "image", "order_no"],
    "Vocabularies": ["id", "kanji", "hiragana", "romaji", "word_type", "jlpt", "frequency", "audio", "image", "created_at", "deleted_at"],
    "VocabularyMeanings": ["id", "vocabulary_id", "language", "meaning", "display_order"],
    "TopicVocabularies": ["topic_id", "vocabulary_id"],
    "VocabularyExamples": ["id", "vocabulary_id", "japanese", "hiragana", "translation"],
    "GrammarPoints": ["id", "lesson_id", "title", "structure", "meaning", "usage", "jlpt", "topic_id", "title_jp", "meaning_vi", "explanation", "jlpt_level", "example_sentences", "audio_url", "created_by", "created_at", "updated_at", "deleted_at"],
    "GrammarExamples": ["id", "grammar_id", "japanese", "translation"],
    "Quizzes": ["id", "topic_id", "title"],
    "QuizQuestions": ["id", "quiz_id", "question", "audio", "image"],
    "QuizAnswers": ["id", "question_id", "answer", "is_correct"],
}


def new_id():
    return str(uuid.uuid4())


def write_csv(name, records):
    with (OUT / f"{name}.csv").open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=TABLES[name], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


course_id = new_id()
courses = [{
    "id": course_id,
    "title": "Tiếng Nhật N4 - Từ vựng Sơ cấp II",
    "description": "Bộ từ vựng tham khảo 25 bài, biên soạn theo các chủ đề giao tiếp sơ cấp nâng cao; JLPT không công bố danh sách từ cố định theo cấp.",
    "order_no": 2,
}]
lessons, topics, vocabularies, meanings, topic_vocabularies = [], [], [], [], []
vocabulary_ids = {}
for order, (title, description, raw_words) in enumerate(LESSONS, 1):
    lesson_id, topic_id = new_id(), new_id()
    lessons.append({"id": lesson_id, "course_id": course_id, "title": f"Bài {order + 25}: {title}", "description": description, "order_no": order})
    topics.append({"id": topic_id, "lesson_id": lesson_id, "title": title, "description": description, "order_no": 1})
    for item in raw_words.split(";"):
        surface, reading, meaning, word_type = item.split("|", 3)
        key = (surface, reading)
        vocabulary_id = vocabulary_ids.get(key)
        if vocabulary_id is None:
            vocabulary_id = new_id()
            vocabulary_ids[key] = vocabulary_id
            vocabularies.append({"id": vocabulary_id, "kanji": surface, "hiragana": reading, "word_type": word_type, "jlpt": "N4", "frequency": 1})
            meanings.append({"id": new_id(), "vocabulary_id": vocabulary_id, "language": "vi", "meaning": meaning, "display_order": 1})
        topic_vocabularies.append({"topic_id": topic_id, "vocabulary_id": vocabulary_id})

records = {
    "Courses": courses,
    "Lessons": lessons,
    "Topics": topics,
    "Vocabularies": vocabularies,
    "VocabularyMeanings": meanings,
    "TopicVocabularies": topic_vocabularies,
    "VocabularyExamples": [],
    "GrammarPoints": [],
    "GrammarExamples": [],
    "Quizzes": [],
    "QuizQuestions": [],
    "QuizAnswers": [],
}
for table, rows in records.items():
    write_csv(table, rows)

book = load_workbook(ROOT / "curriculum_import_template.xlsx")
for table, rows in records.items():
    sheet = book[table]
    headers = [cell.value for cell in sheet[1]]
    styles = [copy(cell._style) for cell in sheet[2]] if sheet.max_row > 1 else []
    if sheet.max_row > 1:
        sheet.delete_rows(2, sheet.max_row - 1)
    for row in rows:
        sheet.append([row.get(header, "") for header in headers])
        if styles:
            for cell, style in zip(sheet[sheet.max_row], styles):
                if style:
                    cell._style = copy(style)
book.save(OUT / "curriculum_import_n4_tu_vung.xlsx")

(OUT / "README.txt").write_text(
    "BO TU VUNG N4 - 25 BAI\n"
    "Co 25 bai (bai 26-50), moi bai co chu de, tu vung, cach doc kana, loai tu va nghia tieng Viet.\n"
    "CSV theo schema curriculum_import_template.xlsx; import theo thu tu: Courses, Lessons, Topics, Vocabularies, VocabularyMeanings, TopicVocabularies. Cac bang grammar va quiz de trong vi bo nay tap trung vao tu vung.\n"
    "Danh sach hoc tap tham khao, khong phai danh sach chinh thuc hay day du cho ky thi. JLPT khong cong bo danh muc tu vung/kanji/ngu phap co dinh theo cap; xem FAQ: https://www.jlpt.jp/e/faq/\n"
    "Nguon muc tieu trinh do N4: https://www.jlpt.jp/e/about/levelsummary.html\n"
    "Minna no Nihongo Shokyu II, tuong duong N4 va gom 25 bai: https://www.3anet.co.jp/np/en/books/1400/\n",
    encoding="utf-8",
)
print(f"Created {len(LESSONS)} lessons and {len(vocabularies)} unique vocabulary entries in {OUT}")
