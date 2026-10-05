import csv
import json
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

# Two original grammar points and examples for each lesson, in lesson order.
GRAMMAR = [
    [("Giải thích bằng んです", "V thể thường・Aい + んです / N・Aな + なんです", "Dùng để giải thích, hỏi nguyên nhân hoặc nhấn mạnh bối cảnh.", "Thường dùng trong hội thoại khi người nghe cần thêm thông tin.", "どうして遅れたんですか。電車が遅れたんです。", "Sao bạn đến muộn vậy? Vì tàu bị trễ."), ("Nhờ vả lịch sự", "Vていただけませんか", "Anh/chị có thể vui lòng làm giúp tôi ... được không?", "Cách nhờ vả trang trọng, lịch sự.", "もう一度説明していただけませんか。", "Anh/chị có thể vui lòng giải thích lại một lần nữa không?")],
    [("Thể khả năng", "Động từ thể khả năng", "Diễn tả khả năng hoặc việc có thể thực hiện.", "Dùng dạng khả năng của động từ; đối tượng thường đi với が.", "私は漢字が少し読めます。", "Tôi có thể đọc được một ít kanji."), ("Nhìn thấy và nghe thấy", "N が見えます／聞こえます", "Có thể nhìn thấy / nghe thấy một cách tự nhiên.", "見えます và 聞こえます mô tả điều lọt vào tầm nhìn hoặc thính giác.", "ここから海が見えます。", "Từ đây có thể nhìn thấy biển.")],
    [("Hai hành động đồng thời", "Vます bỏ ます + ながら", "Vừa làm việc này vừa làm việc khác.", "Hai hành động thường do cùng một chủ thể thực hiện.", "音楽を聞きながら勉強します。", "Tôi vừa nghe nhạc vừa học."), ("Liệt kê lý do", "Thể thường + し、～し", "Vừa ... vừa ...; nêu nhiều lý do hoặc đặc điểm.", "し có thể nối các lý do trước khi nêu kết luận.", "この店は安いし、おいしいし、よく来ます。", "Quán này vừa rẻ vừa ngon nên tôi thường đến.")],
    [("Trạng thái do hành động hoàn tất", "Tự động từ thể ています", "Đang ở trạng thái là kết quả của một hành động.", "Phân biệt với hành động đang diễn ra; thường đi với tự động từ.", "窓が開いています。", "Cửa sổ đang mở."), ("Tha động từ và tự động từ", "N が tự động từ / N を tha động từ", "Diễn tả vật tự thay đổi trạng thái hoặc có người tác động lên vật.", "Chọn trợ từ và động từ theo việc có chủ thể tác động hay không.", "私が窓を開けました。", "Tôi đã mở cửa sổ.")],
    [("Trạng thái chuẩn bị sẵn", "N が Vてあります", "Một việc đã được làm và trạng thái vẫn còn.", "Dùng tha động từ; tập trung vào kết quả đã chuẩn bị.", "会議室にいすが並べてあります。", "Ghế đã được xếp sẵn trong phòng họp."), ("Làm trước để chuẩn bị", "Vておきます", "Làm trước, chuẩn bị sẵn cho việc sau.", "Dùng khi chủ động hoàn tất việc cần thiết từ trước.", "旅行の前に切符を買っておきます。", "Tôi sẽ mua vé trước chuyến đi.")],
    [("Thể ý chí", "Động từ thể ý chí", "Rủ rê hoặc tự nhủ sẽ cùng làm việc gì.", "Dạng thân mật của ～ましょう; cách tạo dạng thay đổi theo nhóm động từ.", "少し休もう。", "Nghỉ một chút nhé."), ("Dự định", "Thể ý chí + と思っています / Vるつもりです", "Đang dự định hoặc có ý định làm gì.", "Nêu kế hoạch đã hình thành trước thời điểm nói.", "来年、日本へ留学しようと思っています。", "Tôi đang định năm sau đi du học Nhật Bản.")],
    [("Lời khuyên", "Vたほうがいいです／Vないほうがいいです", "Nên làm / không nên làm.", "Dùng để đưa ra lời khuyên hoặc khuyến nghị.", "熱がありますから、今日は休んだほうがいいです。", "Vì bị sốt nên hôm nay bạn nên nghỉ."), ("Dự đoán và khả năng", "～でしょう／～かもしれません", "Có lẽ ... / có thể ...", "でしょう thể hiện dự đoán khá có cơ sở; かもしれません thể hiện khả năng.", "午後から雨が降るかもしれません。", "Có thể từ buổi chiều trời sẽ mưa.")],
    [("Mệnh lệnh và cấm đoán", "Động từ thể mệnh lệnh／thể cấm", "Ra lệnh mạnh hoặc yêu cầu không được làm.", "Thường gặp trong biển báo, khẩu hiệu và tình huống khẩn cấp.", "危ないですから、そこに入るな。", "Nguy hiểm nên đừng vào đó."), ("Đọc và hiểu biển báo", "～と書いてあります／～と読みます", "Có viết là ... / đọc là ...", "Trích nội dung chữ viết hoặc cách đọc một từ.", "この漢字は「出口」と読みます。", "Kanji này đọc là “deguchi” (lối ra).")],
    [("Làm theo hướng dẫn", "Vる／Vた／Nの とおりに", "Làm theo đúng như ...", "とおりに đứng sau hành động, chỉ dẫn hoặc danh từ の.", "説明書に書いてあるとおりに組み立ててください。", "Xin hãy lắp theo đúng như hướng dẫn viết trong sách."), ("Sau khi và không làm", "Vたあとで / Vないで", "Sau khi làm ... / không làm ... mà ...", "あとで nêu trình tự; ないで nối hành động không thực hiện với hành động kế tiếp.", "宿題をしたあとで、テレビを見ます。", "Sau khi làm bài tập, tôi xem ti vi.")],
    [("Điều kiện ば", "Vば／Aければ／Nなら", "Nếu ... thì ...", "Dùng để nêu điều kiện dẫn đến kết quả hoặc lời khuyên.", "時間があれば、手伝います。", "Nếu có thời gian, tôi sẽ giúp."), ("Nếu là N thì", "Nなら、～", "Nếu nói về N / nếu là N thì ...", "なら nhận chủ đề hoặc thông tin vừa được nêu làm điều kiện.", "京都へ行くなら、秋がいいですよ。", "Nếu đi Kyoto thì mùa thu đẹp đấy.")],
    [("Mục đích và trạng thái đạt được", "Vる／Vない + ように", "Để có thể ... / để không ...", "ように dùng với khả năng hoặc trạng thái không do ý chí trực tiếp kiểm soát.", "忘れないように、メモしてください。", "Hãy ghi chú để khỏi quên."), ("Thay đổi khả năng/thói quen", "Vる／Vない + ようになります", "Trở nên có thể / dần hình thành thói quen.", "Diễn tả sự thay đổi theo thời gian.", "毎日練習して、長い文章も読めるようになりました。", "Nhờ luyện tập hằng ngày, tôi đã có thể đọc cả đoạn văn dài.")],
    [("Câu bị động", "Động từ thể bị động", "Chủ thể chịu tác động của hành động.", "Dùng khi muốn đưa người/vật chịu tác động lên làm chủ đề.", "私は先生にほめられました。", "Tôi được thầy/cô khen."), ("Bị ảnh hưởng bởi hành động", "Người は người に V bị động", "Ai đó bị người khác làm gì hoặc bị ảnh hưởng.", "に đánh dấu người thực hiện hành động bị động.", "弟にケーキを食べられました。", "Tôi bị em trai ăn mất bánh." )],
    [("Danh từ hóa hành động", "Vる + のは／のが／のを", "Việc làm V thì ... / thích, thấy, biết việc làm V.", "の biến mệnh đề động từ thành cụm danh từ.", "外国語を勉強するのは楽しいです。", "Việc học ngoại ngữ rất vui."), ("Nêu mục đích sử dụng", "Vます bỏ ます + のに使います", "Được dùng để làm ...", "Nêu công dụng của dụng cụ hoặc phương tiện.", "このはさみは紙を切るのに使います。", "Cái kéo này được dùng để cắt giấy.")],
    [("Lý do với ので", "Thể thường + ので", "Vì ... nên ...", "Nêu lý do mềm mại, thường dùng để giải thích hoặc xin phép.", "電車が遅れたので、会議に遅刻しました。", "Vì tàu trễ nên tôi đã đến cuộc họp muộn."), ("Nguyên nhân và cảm xúc", "Vて、～", "Vì ... nên ...; nối nguyên nhân với cảm xúc/kết quả.", "Câu trước nêu nguyên nhân dẫn đến cảm xúc hoặc tình trạng.", "試験に合格して、とてもうれしかったです。", "Tôi rất vui vì đã thi đỗ.")],
    [("Câu hỏi gián tiếp", "Từ để hỏi + thể thường + か", "Ai/ở đâu/khi nào ...; câu hỏi được đưa vào câu lớn hơn.", "Mệnh đề câu hỏi kết thúc bằng か trước động từ chính.", "駅までどう行くか、教えてください。", "Xin hãy chỉ cho tôi cách đi đến nhà ga."), ("Không biết có hay không; thử làm", "～かどうか / Vてみます", "Có ... hay không / thử làm ...", "かどうか dùng khi không có từ để hỏi; てみる nói thử làm.", "この方法が正しいかどうか、調べてみます。", "Tôi sẽ thử kiểm tra xem cách này có đúng không.")],
    [("Kính ngữ tôn kính", "お／ご + Vます bỏ ます + になります", "Cách nói tôn kính về hành động của người nghe/người được nhắc đến.", "Dùng trong giao tiếp trang trọng; một số động từ có dạng kính ngữ riêng.", "社長はもうお帰りになりました。", "Giám đốc đã về rồi."), ("Nhận với sắc thái kính trọng", "いただきます／くださいます", "Nhận hoặc được ai đó làm giúp theo cách nói lịch sự.", "Chọn cách nói theo vai trò của người cho và người nhận.", "先生に本をいただきました。", "Tôi đã nhận sách từ thầy/cô.")],
    [("Vì mục đích", "Nのために／Vるために", "Vì ... / để đạt mục đích ...", "Nêu mục tiêu chủ động mà hành động hướng tới.", "日本で働くために、日本語を勉強しています。", "Tôi học tiếng Nhật để làm việc ở Nhật."), ("Công dụng, thời gian, chi phí", "Nに使います／時間・お金がかかります", "Dùng cho N / tốn thời gian hoặc tiền bạc.", "に chỉ mục đích sử dụng; かかる diễn tả thời lượng hoặc chi phí cần thiết.", "この機械は写真を印刷するのに使います。", "Máy này được dùng để in ảnh.")],
    [("Trông có vẻ sắp", "Vます bỏ ます + そうです", "Trông có vẻ sắp xảy ra.", "Dùng với động từ để suy đoán từ dấu hiệu quan sát được.", "雨が降りそうです。", "Trông có vẻ sắp mưa."), ("Trông có vẻ như thế nào", "Aい bỏ い + そうです／Aな + そうです", "Trông có vẻ ...", "Dùng để nhận xét vẻ ngoài hoặc cảm nhận từ quan sát.", "このケーキはおいしそうです。", "Cái bánh này trông có vẻ ngon.")],
    [("Quá mức", "Vます bỏ ます／A bỏ い・な + すぎます", "Làm quá nhiều hoặc quá ...", "すぎる kết hợp với động từ và tính từ để nói vượt mức phù hợp.", "昨日、食べすぎました。", "Hôm qua tôi đã ăn quá nhiều."), ("Dễ/khó làm", "Vます bỏ ます + やすい／にくい", "Dễ làm / khó làm.", "Đánh giá mức độ thuận tiện khi thực hiện hành động.", "このペンは書きやすいです。", "Cây bút này dễ viết.")],
    [("Trong trường hợp", "Vる／Vた／Nの 場合は", "Trong trường hợp ...", "Nêu cách xử lý khi một tình huống cụ thể xảy ra.", "パスポートをなくした場合は、すぐ連絡してください。", "Nếu làm mất hộ chiếu, hãy liên lạc ngay."), ("Mặc dù nhưng", "Thể thường + のに", "Mặc dù ... nhưng ...", "Nối hai ý trái với điều người nghe thường dự đoán.", "薬を飲んだのに、熱が下がりません。", "Mặc dù đã uống thuốc nhưng vẫn không hạ sốt.")],
    [("Các giai đoạn của hành động", "Vる／Vている／Vた + ところです", "Sắp làm / đang làm / vừa làm xong.", "ところ chỉ đúng giai đoạn của hành động tại thời điểm nói.", "今から出かけるところです。", "Bây giờ tôi sắp ra ngoài."), ("Vừa mới và chắc là", "Vたばかりです／～はずです", "Vừa mới ... / chắc là ... theo căn cứ.", "ばかり nhấn mạnh hành động mới xảy ra; はず nêu kỳ vọng có căn cứ.", "彼はもう駅に着いたはずです。", "Chắc anh ấy đã đến nhà ga rồi.")],
    [("Nghe nói", "Thể thường + そうです", "Nghe nói rằng ...", "Truyền đạt thông tin nhận được từ người khác hoặc nguồn tin.", "天気予報によると、明日は雨だそうです。", "Theo dự báo thời tiết, nghe nói ngày mai trời mưa."), ("Suy đoán từ dấu hiệu", "Thể thường + ようです", "Có vẻ như ..., dường như ...", "Người nói suy luận dựa trên tình huống hoặc dấu hiệu.", "電気が消えています。もう誰もいないようです。", "Đèn đã tắt. Có vẻ như không còn ai ở đó.")],
    [("Sai khiến", "Động từ thể sai khiến", "Bắt/cho phép ai làm gì.", "Dùng theo quan hệ quyền hạn hoặc ngữ cảnh cho phép.", "母は子どもに野菜を食べさせました。", "Mẹ bắt/cho phép đứa trẻ ăn rau."), ("Xin phép được làm", "Vさせてください", "Xin hãy cho phép tôi làm ...", "Người nói xin phép thực hiện hành động.", "今日は早く帰らせてください。", "Hôm nay xin hãy cho phép tôi về sớm.")],
    [("Kính ngữ trong giao tiếp", "いらっしゃいます／召し上がります／ご覧になります", "Các dạng tôn kính thường gặp: đến/đi/ở, ăn/uống, xem.", "Dùng động từ tôn kính riêng khi nói về hành động của khách hoặc cấp trên.", "先生は何時にいらっしゃいますか。", "Thầy/cô sẽ đến lúc mấy giờ ạ?"), ("Cách mời lịch sự", "お／ご + Vます bỏ ます + ください", "Xin mời vui lòng làm ...", "Dùng trong hướng dẫn và phục vụ khách.", "こちらで少々お待ちください。", "Xin quý khách vui lòng đợi một chút ở đây.")],
    [("Khiêm nhường ngữ", "お／ご + Vます bỏ ます + します", "Cách nói khiêm nhường về hành động của mình.", "Dùng khi nói với khách, cấp trên hoặc trong môi trường công việc.", "私が資料をお持ちします。", "Để tôi mang tài liệu ạ."), ("Diễn đạt trang trọng", "ございます／でございます", "Cách nói lịch sự, trang trọng của あります／です.", "Thường dùng trong thông báo và phục vụ khách hàng.", "こちらが受付でございます。", "Đây là quầy tiếp tân ạ.")],
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
    "title": "Tiếng Nhật N4 - Minna no Nihongo Sơ cấp II",
    "description": "Giáo trình tham khảo 25 bài gồm từ vựng, ngữ pháp, ví dụ và quiz. Nội dung biên soạn mới theo phạm vi sơ cấp nâng cao; JLPT không công bố danh sách từ cố định theo cấp.",
    "order_no": 2,
}]
lessons, topics, vocabularies, meanings, topic_vocabularies = [], [], [], [], []
vocabulary_examples, grammar_points, grammar_examples = [], [], []
quizzes, quiz_questions, quiz_answers = [], [], []
quiz_specs = []
vocabulary_ids = {}
for order, ((title, description, raw_words), lesson_grammar) in enumerate(zip(LESSONS, GRAMMAR), 1):
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
            vocabulary_examples.append({"id": new_id(), "vocabulary_id": vocabulary_id, "japanese": f"「{surface}」という言葉を覚えました。", "hiragana": f"「{reading}」ということばをおぼえました。", "translation": f"Tôi đã học từ/cụm từ “{meaning}”."})
        topic_vocabularies.append({"topic_id": topic_id, "vocabulary_id": vocabulary_id})

    for grammar_title, structure, meaning, usage, japanese, vietnamese in lesson_grammar:
        grammar_id = new_id()
        example = {"jp": japanese, "vi": vietnamese, "audio_url": ""}
        grammar_points.append({"id": grammar_id, "lesson_id": lesson_id, "title": grammar_title, "structure": structure, "meaning": meaning, "usage": usage, "jlpt": "N4", "topic_id": topic_id, "title_jp": structure, "meaning_vi": meaning, "explanation": usage, "jlpt_level": "N4", "example_sentences": json.dumps([example], ensure_ascii=False)})
        grammar_examples.append({"id": new_id(), "grammar_id": grammar_id, "japanese": japanese, "translation": vietnamese})
    quiz_specs.append((topic_id, title, lesson_grammar))

translation_pool = [grammar[5] for lesson_grammar in GRAMMAR for grammar in lesson_grammar]
for topic_id, title, lesson_grammar in quiz_specs:
    quiz_id = new_id()
    quizzes.append({"id": quiz_id, "topic_id": topic_id, "title": f"Ôn tập N4: {title}"})
    for item_no, grammar in enumerate(lesson_grammar, 1):
        japanese, correct = grammar[4], grammar[5]
        question_id = new_id()
        quiz_questions.append({"id": question_id, "quiz_id": quiz_id, "question": f"Câu {item_no}. Chọn nghĩa đúng của câu: {japanese}"})
        choices = [correct]
        start = (len(quiz_questions) * 7) % len(translation_pool)
        for offset in range(len(translation_pool)):
            choice = translation_pool[(start + offset) % len(translation_pool)]
            if choice not in choices:
                choices.append(choice)
            if len(choices) == 4:
                break
        for choice_no, answer in enumerate(choices):
            quiz_answers.append({"id": new_id(), "question_id": question_id, "answer": answer, "is_correct": str(choice_no == 0).upper()})

records = {
    "Courses": courses,
    "Lessons": lessons,
    "Topics": topics,
    "Vocabularies": vocabularies,
    "VocabularyMeanings": meanings,
    "TopicVocabularies": topic_vocabularies,
    "VocabularyExamples": vocabulary_examples,
    "GrammarPoints": grammar_points,
    "GrammarExamples": grammar_examples,
    "Quizzes": quizzes,
    "QuizQuestions": quiz_questions,
    "QuizAnswers": quiz_answers,
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
    "GIÁO TRÌNH N4 - 25 BÀI (BÀI 26-50)\n"
    "Mỗi bài có chủ đề, từ vựng, cách đọc kana, nghĩa tiếng Việt, 2 điểm ngữ pháp kèm ví dụ và 1 quiz gồm 2 câu.\n"
    "CSV theo schema curriculum_import_template.xlsx; nhập theo thứ tự: Courses, Lessons, Topics, Vocabularies, VocabularyMeanings, TopicVocabularies, VocabularyExamples, GrammarPoints, GrammarExamples, Quizzes, QuizQuestions, QuizAnswers.\n"
    "Đây là danh sách học tập tham khảo, không phải danh sách chính thức hay đầy đủ cho kỳ thi. JLPT không công bố danh mục từ vựng/kanji/ngữ pháp cố định theo cấp; xem FAQ: https://www.jlpt.jp/e/faq/\n"
    "Mô tả mục tiêu trình độ N4: https://www.jlpt.jp/e/about/levelsummary.html\n"
    "Minna no Nihongo Sơ cấp II được xếp tương đương N4 và gồm 25 bài: https://www.3anet.co.jp/np/en/books/1400/\n",
    encoding="utf-8",
)
print(f"Created {len(LESSONS)} lessons, {len(vocabularies)} unique vocabulary entries, {len(grammar_points)} grammar points, and {len(quiz_questions)} quiz questions in {OUT}")
