import csv
import json
import uuid
from pathlib import Path
from copy import copy
from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent
OUT = ROOT / "curriculum_n5_25_bai"
OUT.mkdir(exist_ok=True)

# Each vocabulary item is surface|reading|Vietnamese meaning|schema enum.
# Each grammar item is title|structure|meaning|usage|example|translation.
LESSONS = [
    ("Chào hỏi và giới thiệu", "Giới thiệu bản thân, quốc tịch, nghề nghiệp và người khác.",
     ["わたし|わたし|tôi|PRONOUN", "がくせい|がくせい|học sinh, sinh viên|NOUN", "かいしゃいん|かいしゃいん|nhân viên công ty|NOUN", "せんせい|せんせい|giáo viên|NOUN", "いしゃ|いしゃ|bác sĩ|NOUN", "にほん|にほん|Nhật Bản|NOUN", "ベトナム|ベトナム|Việt Nam|NOUN", "ともだち|ともだち|bạn bè|NOUN"],
     [("Danh từ は danh từ です", "N1 は N2 です", "N1 là N2.", "Giới thiệu, xác định người hoặc vật.", "わたしは がくせいです。", "Tôi là sinh viên."), ("Phủ định và câu hỏi danh từ", "N1 は N2 じゃありません / ですか", "N1 không phải là N2 / có phải N2 không?", "Phủ định hoặc hỏi lịch sự; trả lời はい／いいえ.", "ミンさんは せんせいですか。", "Anh Minh là giáo viên phải không?")]),
    ("Đồ vật và sở hữu", "Nhận biết đồ vật, hỏi đồ vật thuộc về ai và dùng từ chỉ định.",
     ["これ|これ|cái này|PRONOUN", "それ|それ|cái đó|PRONOUN", "あれ|あれ|cái kia|PRONOUN", "ほん|ほん|sách|NOUN", "じしょ|じしょ|từ điển|NOUN", "かさ|かさ|ô, dù|NOUN", "かばん|かばん|cặp, túi|NOUN", "だれ|だれ|ai|PRONOUN"],
     [("Từ chỉ định đồ vật", "これ／それ／あれ は N です", "Đây/đó/kia là N.", "これ gần người nói, それ gần người nghe, あれ xa cả hai.", "これは にほんごの ほんです。", "Đây là sách tiếng Nhật."), ("Sở hữu và danh từ bổ nghĩa", "N1 の N2 / この・その・あの N", "N2 của N1; cái N này/đó/kia.", "の nối quan hệ sở hữu hoặc phân loại; この đi cùng danh từ.", "これは わたしの かさです。", "Đây là ô của tôi.")]),
    ("Địa điểm và mua sắm", "Hỏi và chỉ địa điểm, gọi tên nơi chốn và hỏi giá.",
     ["ここ|ここ|ở đây|PRONOUN", "そこ|そこ|ở đó|PRONOUN", "あそこ|あそこ|ở kia|PRONOUN", "どこ|どこ|ở đâu|PRONOUN", "きょうしつ|きょうしつ|lớp học|NOUN", "しょくどう|しょくどう|nhà ăn|NOUN", "えき|えき|nhà ga|NOUN", "いくら|いくら|bao nhiêu tiền|PRONOUN"],
     [("Chỉ địa điểm", "ここ／そこ／あそこ は N です", "Ở đây/đó/kia là N.", "Hỏi địa điểm bằng どこ; lịch sự hơn dùng こちら／そちら.", "としょかんは あそこです。", "Thư viện ở đằng kia."), ("Hỏi giá", "N は いくらですか", "N giá bao nhiêu? אלא", "Hỏi giá tiền và trả lời bằng số + 円.", "この かさは いくらですか。", "Cái ô này giá bao nhiêu?")]),
    ("Thời gian và lịch sinh hoạt", "Nói giờ, lịch làm việc và hoạt động thường ngày.",
     ["いま|いま|bây giờ|NOUN", "じ|じ|giờ|NOUN", "ふん|ふん|phút|NOUN", "まいにち|まいにち|hằng ngày|ADVERB", "おきます|おきます|thức dậy|VERB", "ねます|ねます|ngủ|VERB", "はたらきます|はたらきます|làm việc|VERB", "やすみ|やすみ|ngày nghỉ|NOUN"],
     [("Nói giờ", "いま ～時 ～分です", "Bây giờ là ... giờ ... phút.", "Dùng các cách đọc giờ/phút đặc biệt khi nói thời gian.", "いま はちじはんです。", "Bây giờ là 8 giờ rưỡi."), ("Thời điểm và khoảng thời gian", "時間 に Vます / ～から ～まで", "Làm gì vào lúc... / từ... đến...", "に đánh dấu thời điểm cụ thể; から và まで chỉ điểm đầu, cuối.", "まいあさ ６じに おきます。", "Mỗi sáng tôi thức dậy lúc 6 giờ.")]),
    ("Đi lại và phương tiện", "Nói nơi đến, phương tiện, điểm xuất phát và người đi cùng.",
     ["いきます|いきます|đi|VERB", "きます|きます|đến|VERB", "かえります|かえります|trở về|VERB", "でんしゃ|でんしゃ|tàu điện|NOUN", "ちかてつ|ちかてつ|tàu điện ngầm|NOUN", "バス|バス|xe buýt|NOUN", "じてんしゃ|じてんしゃ|xe đạp|NOUN", "ともだち|ともだち|bạn|NOUN"],
     [("Nơi đến và phương tiện", "場所 へ 行きます／来ます／帰ります; phương tiện で", "Đi/đến/về địa điểm bằng phương tiện.", "へ đánh dấu hướng đến; で đánh dấu phương tiện.", "バスで がっこうへ いきます。", "Tôi đi đến trường bằng xe buýt."), ("Đi cùng và xuất phát", "人 と V / 場所 から", "Làm gì cùng ai / từ địa điểm nào.", "と nối người đồng hành; から nêu điểm xuất phát.", "ともだちと えきから かえります。", "Tôi cùng bạn về từ nhà ga.")]),
    ("Hoạt động hằng ngày", "Nói về ăn uống, học tập, mua sắm và rủ ai cùng làm.",
     ["たべます|たべます|ăn|VERB", "のみます|のみます|uống|VERB", "みます|みます|xem, nhìn|VERB", "ききます|ききます|nghe, hỏi|VERB", "よみます|よみます|đọc|VERB", "かきます|かきます|viết|VERB", "かいます|かいます|mua|VERB", "いっしょに|いっしょに|cùng nhau|ADVERB"],
     [("Tân ngữ và nơi diễn ra hành động", "N を Vます / 場所 で Vます", "Làm hành động lên N / làm gì ở địa điểm.", "を đánh dấu tân ngữ; で đánh dấu nơi hành động diễn ra.", "カフェで コーヒーを のみます。", "Tôi uống cà phê ở quán."), ("Rủ và đề nghị", "Vませんか / Vましょう", "Cùng làm ... nhé? / Chúng ta hãy ...", "ませんか là lời mời; ましょう là đề nghị cùng làm.", "いっしょに えいがを みませんか。", "Cùng xem phim nhé?")]),
    ("Sinh hoạt và tặng nhận", "Diễn tả phương tiện thực hiện, ngôn ngữ và việc cho/nhận.",
     ["はし|はし|đũa|NOUN", "ペン|ペン|bút|NOUN", "にほんご|にほんご|tiếng Nhật|NOUN", "メール|メール|thư điện tử|NOUN", "あげます|あげます|cho, tặng|VERB", "もらいます|もらいます|nhận|VERB", "かします|かします|cho mượn|VERB", "かります|かります|mượn|VERB"],
     [("Phương tiện và ngôn ngữ", "道具／言語 で V", "Làm bằng dụng cụ hoặc bằng ngôn ngữ.", "で nêu công cụ, phương tiện hoặc ngôn ngữ dùng để giao tiếp.", "ペンで なまえを かきます。", "Tôi viết tên bằng bút."), ("Cho, nhận, mượn", "人に Nを あげます／もらいます／かします／かります", "Cho, nhận, cho mượn hoặc mượn đồ từ ai.", "Trợ từ に đánh dấu người cho/nhận tùy động từ.", "ともだちに ほんを かりました。", "Tôi đã mượn sách từ bạn.")]),
    ("Miêu tả người và vật", "Miêu tả đặc điểm, thời tiết, đồ ăn và nơi chốn.",
     ["おおきい|おおきい|to, lớn|I_ADJECTIVE", "ちいさい|ちいさい|nhỏ|I_ADJECTIVE", "あたらしい|あたらしい|mới|I_ADJECTIVE", "ふるい|ふるい|cũ|I_ADJECTIVE", "しずか|しずか|yên tĩnh|NA_ADJECTIVE", "にぎやか|にぎやか|náo nhiệt|NA_ADJECTIVE", "きれい|きれい|đẹp, sạch|NA_ADJECTIVE", "てんき|てんき|thời tiết|NOUN"],
     [("Tính từ い", "N は Aいです / Aくないです", "N thì ... / không ...", "Tính từ い đứng cuối câu; phủ định đổi い thành くない.", "きょうは あついです。", "Hôm nay trời nóng."), ("Tính từ な", "N は Aです / Aじゃありません; Aな N", "N thì ... / không ...", "Tính từ な dùng な trước danh từ và bỏ な trước です.", "このまちは しずかです。", "Thành phố này yên tĩnh.")]),
    ("Sở thích và lý do", "Nói điều yêu thích, khả năng, mức độ và lý do.",
     ["すき|すき|thích|NA_ADJECTIVE", "きらい|きらい|ghét, không thích|NA_ADJECTIVE", "じょうず|じょうず|giỏi|NA_ADJECTIVE", "へた|へた|kém|NA_ADJECTIVE", "わかります|わかります|hiểu|VERB", "あります|あります|có (đồ vật)|VERB", "スポーツ|スポーツ|thể thao|NOUN", "りょうり|りょうり|món ăn, nấu ăn|NOUN"],
     [("Sở thích và khả năng", "N が 好き／嫌い／上手／下手です", "Thích, không thích, giỏi hoặc kém N.", "が đánh dấu đối tượng của sở thích, khả năng và mức độ hiểu.", "わたしは おんがくが すきです。", "Tôi thích âm nhạc."), ("Lý do và mức độ", "～から、～ / よく・だいたい・あまり・ぜんぜん", "Vì ... nên ... / các mức độ thường, khá, không lắm, hoàn toàn không.", "から nối lý do; あまり và ぜんぜん thường đi với phủ định.", "にほんごが すこし わかりますから、たのしいです。", "Vì hiểu một chút tiếng Nhật nên tôi thấy vui.")]),
    ("Vị trí và sự tồn tại", "Nói có người/vật ở đâu và vị trí tương đối.",
     ["あります|あります|có, tồn tại (đồ vật)|VERB", "います|います|có, tồn tại (người/động vật)|VERB", "うえ|うえ|trên|NOUN", "した|した|dưới|NOUN", "まえ|まえ|phía trước|NOUN", "うしろ|うしろ|phía sau|NOUN", "となり|となり|bên cạnh|NOUN", "なか|なか|bên trong|NOUN"],
     [("Tồn tại", "場所 に N が あります／います", "Có N ở địa điểm.", "あります dùng cho vật/sự kiện; います dùng cho người/động vật.", "つくえの うえに ほんが あります。", "Có quyển sách ở trên bàn."), ("Vị trí tương đối", "N1 は N2 の vị trí に あります／います", "N1 ở vị trí ... so với N2.", "Các từ vị trí thường kết hợp với の: 上、下、前、後ろ、隣、中.", "ねこは いすの したに います。", "Con mèo ở dưới ghế.")]),
    ("Số lượng và tần suất", "Đếm người, đồ vật, thời lượng và hỏi tần suất.",
     ["ひとり|ひとり|một người|NOUN", "ふたり|ふたり|hai người|NOUN", "まい|まい|tờ, chiếc (vật mỏng)|NOUN", "ほん|ほん|cái, chai, quyển (vật dài)|NOUN", "かい|かい|lần|NOUN", "しゅうかん|しゅうかん|tuần|NOUN", "どのくらい|どのくらい|bao lâu, mức nào|PRONOUN", "ぐらい|ぐらい|khoảng|PARTICLE"],
     [("Đếm và số lượng", "Số lượng + N / N を số lượng V", "Bao nhiêu người/vật; làm gì với số lượng nào.", "Dùng lượng từ đúng loại; lượng từ thường đứng trước động từ.", "りんごを みっつ かいました。", "Tôi đã mua ba quả táo."), ("Thời lượng và tần suất", "Thời lượng V / ～に ～回", "Làm gì trong bao lâu / bao nhiêu lần trong một khoảng.", "Khoảng thời gian không cần に; tần suất dùng に sau chu kỳ.", "いっしゅうかんに にかい べんきょうします。", "Tôi học hai lần mỗi tuần.")]),
    ("So sánh", "So sánh hai sự vật và nói lựa chọn nổi bật nhất.",
     ["たかい|たかい|đắt, cao|I_ADJECTIVE", "やすい|やすい|rẻ|I_ADJECTIVE", "はやい|はやい|nhanh, sớm|I_ADJECTIVE", "おそい|おそい|chậm, muộn|I_ADJECTIVE", "おいしい|おいしい|ngon|I_ADJECTIVE", "むずかしい|むずかしい|khó|I_ADJECTIVE", "やさしい|やさしい|dễ, hiền|I_ADJECTIVE", "いちばん|いちばん|nhất|ADVERB"],
     [("So sánh hơn", "A は B より ～です", "A ... hơn B.", "より đứng sau đối tượng làm mốc so sánh.", "でんしゃは バスより はやいです。", "Tàu điện nhanh hơn xe buýt."), ("Chọn nhất và hỏi lựa chọn", "～の中で N が いちばん ～です / どちら", "N ... nhất trong nhóm / cái nào trong hai cái.", "どちら dùng so sánh hai lựa chọn; いちばん nói mức cao nhất.", "この みせの ケーキが いちばん おいしいです。", "Bánh ở cửa hàng này ngon nhất.")]),
    ("Mong muốn và dự định", "Nói điều muốn có, muốn làm và mục đích đi/đến.",
     ["ほしい|ほしい|muốn có|I_ADJECTIVE", "あそびます|あそびます|chơi|VERB", "かいます|かいます|mua|VERB", "たべます|たべます|ăn|VERB", "のみます|のみます|uống|VERB", "みず|みず|nước|NOUN", "くつ|くつ|giày|NOUN", "りょこう|りょこう|du lịch|NOUN"],
     [("Muốn có", "N が ほしいです", "Muốn có N.", "Người nói dùng ほしい để nêu mong muốn sở hữu.", "あたらしい くつが ほしいです。", "Tôi muốn có đôi giày mới."), ("Muốn làm và mục đích", "Vます bỏ ます + たいです / Vます bỏ ます + に行きます", "Muốn làm gì / đi đâu để làm gì.", "たい diễn tả mong muốn của người nói; に行く nêu mục đích di chuyển.", "にほんへ さくらを みに いきたいです。", "Tôi muốn đến Nhật ngắm hoa anh đào.")]),
    ("Thể て và nhờ vả", "Dùng thể て để nhờ ai làm, xin phép và mô tả hành động đang diễn ra.",
     ["まちます|まちます|đợi|VERB", "すわります|すわります|ngồi|VERB", "つかいます|つかいます|sử dụng|VERB", "おしえます|おしえます|dạy, chỉ|VERB", "てつだいます|てつだいます|giúp đỡ|VERB", "まど|まど|cửa sổ|NOUN", "しゃしん|しゃしん|ảnh|NOUN", "ちょっと|ちょっと|một chút|ADVERB"],
     [("Yêu cầu lịch sự", "Vてください", "Xin hãy làm V.", "Dùng thể て + ください để yêu cầu hoặc hướng dẫn lịch sự.", "ここに なまえを かいてください。", "Xin hãy viết tên vào đây."), ("Đang diễn ra và đề nghị giúp", "Vています / Vましょうか", "Đang làm V / để tôi làm giúp nhé?", "ています diễn tả hành động đang diễn ra; ましょうか đề nghị giúp.", "しゃしんを とりましょうか。", "Để tôi chụp ảnh giúp nhé?")]),
    ("Cho phép và trạng thái", "Xin phép, cấm đoán và mô tả trạng thái kết quả.",
     ["あけます|あけます|mở (cửa)|VERB", "しめます|しめます|đóng|VERB", "けします|けします|tắt|VERB", "つけます|つけます|bật|VERB", "はいります|はいります|vào|VERB", "でます|でます|ra, rời khỏi|VERB", "ここ|ここ|ở đây|PRONOUN", "だめ|だめ|không được|EXPRESSION"],
     [("Xin phép và cấm", "Vてもいいです / Vてはいけません", "Được phép làm / không được phép làm.", "Dùng để hỏi hoặc nêu quy định, cấm đoán.", "ここで しゃしんを とってもいいですか。", "Tôi chụp ảnh ở đây có được không?"), ("Trạng thái kết quả", "Vています", "Đang ở trạng thái kết quả của hành động.", "Một số động từ chỉ trạng thái duy trì như kết hôn, biết, đang sống.", "わたしは おおさかに すんでいます。", "Tôi đang sống ở Osaka.")]),
    ("Nối hành động và đặc điểm", "Kể các hành động theo trình tự, kết nối nhiều tính từ.",
     ["そうじします|そうじします|dọn dẹp|VERB", "せんたくします|せんたくします|giặt giũ|VERB", "りょうりします|りょうりします|nấu ăn|VERB", "かえります|かえります|trở về|VERB", "それから|それから|sau đó|CONJUNCTION", "そして|そして|và rồi|CONJUNCTION", "べんり|べんり|tiện lợi|NA_ADJECTIVE", "まち|まち|thành phố|NOUN"],
     [("Nối nhiều hành động", "Vて、Vて、～", "Làm V rồi tiếp tục làm V.", "Liệt kê hành động theo trình tự hoặc nhóm hoạt động.", "あさごはんを たべて、がっこうへ いきます。", "Tôi ăn sáng rồi đi học."), ("Nối tính từ và danh từ", "Aくて / Aで / Nで", "Vừa ... vừa ...; nối các đặc điểm.", "Tính từ い đổi い thành くて; tính từ な và danh từ dùng で.", "このまちは しずかで、べんりです。", "Thành phố này yên tĩnh và tiện lợi.")]),
    ("Quy định và nghĩa vụ", "Nói điều phải làm, không phải làm và lời khuyên.",
     ["きります|きります|cắt|VERB", "おくります|おくります|gửi|VERB", "だします|だします|nộp, gửi ra|VERB", "はらいます|はらいます|trả tiền|VERB", "かえします|かえします|trả lại|VERB", "わすれます|わすれます|quên|VERB", "しんぱい|しんぱい|lo lắng|NOUN", "くすり|くすり|thuốc|NOUN"],
     [("Nghĩa vụ", "Vない bỏ い + なければなりません", "Phải làm V.", "Đổi sang thể ない rồi thay い bằng ければなりません.", "くすりを のまなければなりません。", "Tôi phải uống thuốc."), ("Không cần và lời khuyên", "Vない bỏ い + なくてもいいです", "Không làm V cũng được.", "Dùng khi việc đó không bắt buộc.", "あしたは はやく こなくてもいいです。", "Ngày mai bạn không cần đến sớm.")]),
    ("Khả năng và sở thích", "Nói khả năng, sở thích và việc làm trước một hành động khác.",
     ["できます|できます|có thể, hoàn thành|VERB", "うんてんします|うんてんします|lái xe|VERB", "うたいます|うたいます|hát|VERB", "およぎます|およぎます|bơi|VERB", "しゅみ|しゅみ|sở thích|NOUN", "おんがく|おんがく|âm nhạc|NOUN", "まえ|まえ|trước|NOUN", "しけん|しけん|kỳ thi|NOUN"],
     [("Khả năng", "V辞書形 + ことができます", "Có thể làm V.", "Danh từ hóa động từ bằng こと rồi kết hợp できます.", "ひらがなを よむことができます。", "Tôi có thể đọc hiragana."), ("Sở thích và trước khi", "趣味は V辞書形ことです / V辞書形まえに", "Sở thích là làm V / trước khi làm V.", "こと danh từ hóa động từ; まえに diễn tả hành động xảy ra trước.", "ねるまえに、ほんを よみます。", "Trước khi ngủ, tôi đọc sách.")]),
    ("Kinh nghiệm và thay đổi", "Kể kinh nghiệm, hoạt động tiêu biểu và sự thay đổi.",
     ["のぼります|のぼります|leo|VERB", "とまります|とまります|trọ, ở lại|VERB", "うんどうします|うんどうします|tập thể dục|VERB", "さんぽします|さんぽします|đi dạo|VERB", "けっこんします|けっこんします|kết hôn|VERB", "あき|あき|mùa thu|NOUN", "だんだん|だんだん|dần dần|ADVERB", "きせつ|きせつ|mùa|NOUN"],
     [("Kinh nghiệm", "Vたことがあります", "Đã từng làm V.", "Dùng thể た + ことがあります để kể trải nghiệm.", "ふじさんに のぼったことがあります。", "Tôi đã từng leo núi Phú Sĩ."), ("Liệt kê và biến đổi", "Vたり Vたりします / Aく・Nに なります", "Làm những việc như V / trở nên ...", "たり liệt kê ví dụ không đầy đủ; なる diễn tả sự thay đổi.", "あきに なって、すずしくなりました。", "Sang thu rồi, trời trở nên mát mẻ.")]),
    ("Thể thông thường", "Dùng thể thông thường trong hội thoại thân mật.",
     ["いく|いく|đi|VERB", "くる|くる|đến|VERB", "たべる|たべる|ăn|VERB", "のむ|のむ|uống|VERB", "おもしろい|おもしろい|thú vị|I_ADJECTIVE", "たのしい|たのしい|vui|I_ADJECTIVE", "きのう|きのう|hôm qua|NOUN", "あした|あした|ngày mai|NOUN"],
     [("Thể thông thường của động từ", "Vます → Vる／Vない／Vた／Vなかった", "Dạng thường hiện tại, phủ định, quá khứ và quá khứ phủ định.", "Dùng trong hội thoại thân mật và làm nền cho mẫu câu bổ trợ.", "きのう えいがを みた。", "Hôm qua tôi đã xem phim."), ("Thể thường của tính từ và danh từ", "Aい／Aかった／Aくない／Aくなかった; Nだ／Nだった", "Các dạng thường của tính từ và danh từ.", "Dùng trong giao tiếp thân mật; tính từ な và danh từ dùng だ ở hiện tại khẳng định.", "きのうの えいがは おもしろかった。", "Bộ phim hôm qua rất thú vị.")]),
    ("Ý kiến và truyền đạt", "Nói suy nghĩ, trích lời nói và xác nhận với người nghe.",
     ["おもう|おもう|nghĩ|VERB", "いう|いう|nói|VERB", "てんき|てんき|thời tiết|NOUN", "あめ|あめ|mưa|NOUN", "たぶん|たぶん|có lẽ|ADVERB", "きっと|きっと|chắc chắn|ADVERB", "ほんとう|ほんとう|thật, sự thật|NOUN", "そう|そう|đúng vậy, như thế|EXPRESSION"],
     [("Nêu ý kiến", "Thể thường + と 思います", "Tôi nghĩ rằng ... llamada", "と đánh dấu nội dung suy nghĩ.", "あした あめが ふると おもいます。", "Tôi nghĩ ngày mai trời sẽ mưa."), ("Trích dẫn và xác nhận", "Thể thường + と 言います / ～でしょう", "Nói rằng ... / có lẽ..., đúng không?", "と đánh dấu nội dung lời nói; でしょう nêu phỏng đoán hoặc xác nhận.", "せんせいは あした テストが あると いいました。", "Thầy/cô nói ngày mai có bài kiểm tra.")]),
    ("Bổ nghĩa danh từ", "Dùng mệnh đề ngắn để mô tả người, vật và nơi chốn.",
     ["ひと|ひと|người|NOUN", "もの|もの|đồ vật|NOUN", "ふく|ふく|quần áo|NOUN", "すむ|すむ|sống, cư trú|VERB", "つくる|つくる|làm, chế tạo|VERB", "かう|かう|mua|VERB", "ちかく|ちかく|gần|NOUN", "さがす|さがす|tìm kiếm|VERB"],
     [("Mệnh đề bổ nghĩa danh từ", "Thể thường + N", "N mà ... / N đã ...", "Mệnh đề thể thường đứng ngay trước danh từ được bổ nghĩa.", "これは わたしが かった ほんです。", "Đây là quyển sách tôi đã mua."), ("Phân biệt chủ thể trong mệnh đề", "Mệnh đề は → が + N", "N mà chủ thể thực hiện hành động ...", "Trong mệnh đề bổ nghĩa, chủ thể thường được đánh dấu bằng が.", "おおさかに すんでいる ひとです。", "Đó là người đang sống ở Osaka.")]),
    ("Thời điểm và điều kiện tự nhiên", "Nói khi nào làm việc gì và kết quả tự nhiên khi có điều kiện.",
     ["おします|おします|ấn, nhấn|VERB", "まわします|まわします|vặn, xoay|VERB", "とまります|とまります|dừng|VERB", "うごきます|うごきます|chuyển động|VERB", "しんごう|しんごう|đèn tín hiệu|NOUN", "みち|みち|đường|NOUN", "こうさてん|こうさてん|ngã tư|NOUN", "つぎ|つぎ|tiếp theo|NOUN"],
     [("Khi làm việc gì", "Vる／Vた／Nの とき", "Khi/trong lúc làm V hoặc vào dịp N.", "Dùng とき để chỉ thời điểm xảy ra hành động chính.", "みちを わたるとき、みぎを みます。", "Khi qua đường, tôi nhìn bên phải."), ("Điều kiện tự nhiên", "Vる と、～", "Hễ/khi làm V thì kết quả tự nhiên xảy ra.", "と nối điều kiện với kết quả thường xuyên hoặc quy luật.", "このボタンを おすと、ドアが あきます。", "Ấn nút này thì cửa mở.")]),
    ("Nhận và nhờ giúp đỡ", "Nói về việc nhận/cho đồ và nhận sự giúp đỡ.",
     ["くれます|くれます|cho tôi, tặng tôi|VERB", "なおします|なおします|sửa, chỉnh|VERB", "おくります|おくります|gửi|VERB", "つれていきます|つれていきます|dẫn đi (người)|VERB", "つれてきます|つれてきます|dẫn đến (người)|VERB", "しょうかいします|しょうかいします|giới thiệu|VERB", "せつめいします|せつめいします|giải thích|VERB", "おみやげ|おみやげ|quà lưu niệm|NOUN"],
     [("Cho tôi và làm giúp", "Người が わたしに Nを くれます", "Ai đó cho/tặng tôi N.", "くれる dùng khi người cho hướng lợi ích về phía tôi hoặc người thân.", "ともだちが わたしに おみやげを くれました。", "Bạn đã tặng tôi quà lưu niệm."), ("Nhận sự giúp đỡ", "Vて あげます／もらいます／くれます", "Làm giúp ai / được ai làm giúp / ai làm giúp tôi.", "Chọn động từ cho/nhận theo góc nhìn người hưởng lợi.", "せんせいに にほんごを おしえて もらいました。", "Tôi được thầy/cô dạy tiếng Nhật.")]),
    ("Giả định và nhượng bộ", "Nêu điều kiện giả định và diễn tả dù có trở ngại vẫn làm.",
     ["もし|もし|nếu|ADVERB", "たら|たら|nếu, khi (điều kiện)|PARTICLE", "ても|ても|dù, cho dù|PARTICLE", "こんど|こんど|lần tới|NOUN", "つごう|つごう|sự thuận tiện, lịch trình|NOUN", "おかね|おかね|tiền|NOUN", "じかん|じかん|thời gian|NOUN", "だいじょうぶ|だいじょうぶ|ổn, không sao|NA_ADJECTIVE"],
     [("Điều kiện たら", "Vたら／Aかったら／Nだったら、～", "Nếu/khi ... thì ...", "たら dùng cho điều kiện hoặc thời điểm sau khi sự việc xảy ra.", "ひまが あったら、えいがを みます。", "Nếu có thời gian rảnh, tôi sẽ xem phim."), ("Nhượng bộ ても", "Vても／Aくても／Nでも、～", "Dù ... thì vẫn ...", "ても diễn tả kết quả không thay đổi dù có điều kiện trái ngược.", "あめが ふっても、がっこうへ いきます。", "Dù trời mưa, tôi vẫn đi học.")]),
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


def uid():
    return str(uuid.uuid4())


def write_table(name, rows):
    with (OUT / f"{name}.csv").open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=TABLES[name], extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


course_id = uid()
courses = [{"id": course_id, "title": "Tiếng Nhật N5 - Minna no Nihongo Sơ cấp I", "description": "Lộ trình 25 bài cho người mới bắt đầu: giao tiếp cơ bản, từ vựng, ngữ pháp và tự luyện. Nội dung biên soạn độc lập theo phạm vi syllabus công khai của Minna no Nihongo Sơ cấp I.", "order_no": 1}]
rows = {name: [] for name in TABLES if name not in ("Courses", "Lessons")}
lesson_records = []
for index, (title, description, vocab_data, grammar_data) in enumerate(LESSONS, 1):
    lesson_id, topic_id = uid(), uid()
    lesson_records.append({"id": lesson_id, "course_id": course_id, "title": f"Bài {index}: {title}", "description": description, "order_no": index})
    rows["Topics"].append({"id": topic_id, "lesson_id": lesson_id, "title": title, "description": description, "order_no": 1})
    vocabulary_ids = []
    for vocab_item in vocab_data:
        surface, reading, meaning, word_type = vocab_item.split("|", 3)
        vocabulary_id = uid()
        vocabulary_ids.append(vocabulary_id)
        rows["Vocabularies"].append({"id": vocabulary_id, "kanji": surface, "hiragana": reading, "word_type": word_type, "jlpt": "N5", "frequency": 1})
        rows["VocabularyMeanings"].append({"id": uid(), "vocabulary_id": vocabulary_id, "language": "vi", "meaning": meaning, "display_order": 1})
        rows["TopicVocabularies"].append({"topic_id": topic_id, "vocabulary_id": vocabulary_id})
        example = None
        if word_type == "NOUN":
            example = (f"これは {surface}です。", f"Đây là {meaning}.")
        elif word_type == "I_ADJECTIVE":
            example = (f"このほんは {surface}です。", f"Quyển sách này {meaning}.")
        elif word_type == "VERB":
            example = (f"まいにち {surface}。", f"Tôi {meaning} hằng ngày.")
        elif word_type == "PRONOUN":
            examples = {
                "これ": ("これは なんですか。", "Cái này là gì?"),
                "それ": ("それは なんですか。", "Cái đó là gì?"),
                "あれ": ("あれは なんですか。", "Cái kia là gì?"),
                "どこ": ("トイレは どこですか。", "Nhà vệ sinh ở đâu?"),
                "だれ": ("あのひとは だれですか。", "Người kia là ai?"),
                "いくら": ("これは いくらですか。", "Cái này giá bao nhiêu?"),
                "どのくらい": ("どのくらい かかりますか。", "Mất khoảng bao lâu?"),
            }
            example = examples.get(surface, (f"{surface}は どこですか。", f"{meaning} ở đâu?"))
        if example:
            rows["VocabularyExamples"].append({"id": uid(), "vocabulary_id": vocabulary_id, "japanese": example[0], "hiragana": example[0], "translation": example[1]})
    grammar_ids = []
    for gtitle, structure, meaning, usage, jp, vi in grammar_data:
        grammar_id = uid()
        grammar_ids.append(grammar_id)
        examples = [{"jp": jp, "vi": vi, "audio_url": ""}]
        rows["GrammarPoints"].append({"id": grammar_id, "lesson_id": lesson_id, "title": gtitle, "structure": structure, "meaning": meaning, "usage": usage, "jlpt": "N5", "topic_id": topic_id, "title_jp": structure, "meaning_vi": meaning, "explanation": usage, "jlpt_level": "N5", "example_sentences": json.dumps(examples, ensure_ascii=False)})
        rows["GrammarExamples"].append({"id": uid(), "grammar_id": grammar_id, "japanese": jp, "translation": vi})
    quiz_id = uid()
    rows["Quizzes"].append({"id": quiz_id, "topic_id": topic_id, "title": f"Tự luyện bài {index}: {title}"})
    for gindex, grammar in enumerate(grammar_data):
        jp, correct = grammar[4], grammar[5]
        qid = uid()
        rows["QuizQuestions"].append({"id": qid, "quiz_id": quiz_id, "question": f"Câu {gindex + 1}. Câu sau có nghĩa là gì? {jp}"})
        distractors = [g[5] for g in grammar_data if g[5] != correct]
        distractors.extend(["Tôi không biết.", "Ngày mai tôi sẽ làm việc."])
        choices = [correct] + distractors[:3]
        for choice_index, answer in enumerate(choices):
            rows["QuizAnswers"].append({"id": uid(), "question_id": qid, "answer": answer, "is_correct": str(choice_index == 0).upper()})

write_table("Courses", courses)
write_table("Lessons", lesson_records)
for name, records in rows.items():
    write_table(name, records)

workbook = load_workbook(ROOT / "curriculum_import_template.xlsx")
workbook_records = {"Courses": courses, "Lessons": lesson_records, **rows}
for name, records in workbook_records.items():
    sheet = workbook[name]
    headers = [cell.value for cell in sheet[1]]
    row_style = [copy(cell._style) for cell in sheet[2]] if sheet.max_row >= 2 else []
    if sheet.max_row > 1:
        sheet.delete_rows(2, sheet.max_row - 1)
    for record in records:
        sheet.append([record.get(header, "") for header in headers])
        if row_style:
            for cell, style in zip(sheet[sheet.max_row], row_style):
                if style:
                    cell._style = copy(style)
workbook.save(OUT / "curriculum_import_n5_25_bai.xlsx")

(OUT / "README.txt").write_text(
    "Bo CSV giao trinh N5 gom 25 bai, xuat theo schema cua curriculum_import_template.xlsx.\n"
    "Tat ca ID va khoa ngoai duoc tao bang UUID; import theo thu tu: Courses, Lessons, Topics, Vocabularies, VocabularyMeanings, TopicVocabularies, VocabularyExamples, GrammarPoints, GrammarExamples, Quizzes, QuizQuestions, QuizAnswers.\n"
    "Nguon syllabus: https://www.3anet.co.jp/np/resrcs/230000/\n"
    "Pham vi va cau vi du duoc bien soan lai; day la bo khung lop hoc N5, can doi chieu voi sach va audio ban quyen khi giang day.\n",
    encoding="utf-8"
)
print(f"Created {len(LESSONS)} lessons and {sum(map(len, workbook_records.values()))} curriculum records in {OUT}")
