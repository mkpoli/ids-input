// @ts-check
// The systems that describe a Han character by its parts, in the order they appeared, each with
// the page its facts were read from on 2026-11-14. A year marked `from` is the earliest evidence
// found, not a stated start.

/**
 * @typedef {{ year: string, from?: boolean, title: string, who: string, sample?: string,
 *   text: Record<'en' | 'ja' | 'ko' | 'vi' | 'zh-Hans' | 'zh-Hant', string>, sources: { label: string, url: string }[] }} HistoryEntry
 */

/** @type {HistoryEntry[]} */
export const HISTORY = [
  {
    year: '1998', title: '漢字構形資料庫 (CDP)', who: '中央研究院資訊科學研究所 文獻處理實驗室 · 謝清俊, 莊德明', sample: 'CDP-8BD0',
    text: {
      en: 'A character is written as a 構字式: parts joined side by side, stacked or enclosing. Parts with no code sit in Big5’s private area, and those codes are the CDP-8xxx other tables cite.',
      ja: '文字を構字式で書きます。部品を横・縦・包含の三通りに連ねる式です。符号のない部品はBig5の外字領域に置かれ、その符号が他の表でいうCDP-8xxxです。',
      ko: '글자를 구자식(構字式)으로 적습니다. 부품을 가로, 세로, 포함의 세 가지로 잇는 식입니다. 부호가 없는 부품은 Big5 사용자 정의 영역에 두며, 그 부호가 다른 표의 CDP-8xxx입니다.',
      vi: 'Một chữ được viết bằng 構字式: các bộ phận nối ngang, nối dọc hoặc bao nhau. Bộ phận chưa có mã nằm ở vùng riêng của Big5, và các mã đó chính là CDP-8xxx mà bảng khác dẫn.',
      'zh-Hans': '用构字式描述汉字：部件以横连、直连、包含三种方式相接。没有编码的部件放在Big5的外字区，这些代码就是其他表里的CDP-8xxx。',
      'zh-Hant': '用構字式描述漢字：部件以橫連、直連、包含三種方式相接。沒有編碼的部件放在Big5的外字區，這些代碼就是其他表裡的CDP-8xxx。',
    },
    sources: [{ label: '漢字構形資料庫', url: 'https://cdp.sinica.edu.tw/cdphanzi/' }, { label: '莊德明、鄧賢瑛 2009', url: 'https://cdp.sinica.edu.tw/service/documents/T090904.pdf' }, { label: 'GlyphWiki: CDP外字', url: 'https://glyphwiki.org/wiki/Group:CDP外字' }],
  },
  {
    year: '1999', title: 'Unicode 3.0', who: 'Unicode', sample: '⿰ ⿱ ⿲ ⿳ ⿴ ⿵ ⿶ ⿷ ⿸ ⿹ ⿺ ⿻',
    text: {
      en: 'Twelve Ideographic Description Characters, U+2FF0 to U+2FFB. Most of them come from GBK.',
      ja: '漢字構成記述文字12字、U+2FF0からU+2FFB。大半はGBKに由来します。',
      ko: '한자 구성 기술 문자 12자, U+2FF0부터 U+2FFB. 대부분 GBK에서 왔습니다.',
      vi: 'Mười hai ký tự mô tả chữ Hán, U+2FF0 đến U+2FFB. Phần lớn lấy từ GBK.',
      'zh-Hans': '十二个表意文字描述字符，U+2FF0至U+2FFB。大多来自GBK。',
      'zh-Hant': '十二個表意文字描述字元，U+2FF0至U+2FFB。大多來自GBK。',
    },
    sources: [{ label: 'DerivedAge.txt', url: 'https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt' }, { label: 'Core Specification §18.2', url: 'https://www.unicode.org/versions/Unicode17.0.0/core-spec/chapter-18/' }],
  },
  {
    year: '2001', from: true, title: 'CHISE IDS', who: '守岡知彦 MORIOKA Tomohiko', sample: '&CDP-8BD0;',
    text: {
      en: 'Descriptions for the characters of the CHISE character database. A glyph with no code point is an entity reference by its name in the database; CDP’s parts joined in 2003.',
      ja: 'CHISE文字データベースの各文字の記述。符号位置のないグリフは、データベースでの名前による実体参照で書きます。CDPの部品は2003年に加わりました。',
      ko: 'CHISE 문자 데이터베이스의 글자별 기술입니다. 코드 포인트가 없는 글리프는 데이터베이스의 이름으로 된 엔티티 참조로 적습니다. CDP 부품은 2003년에 들어왔습니다.',
      vi: 'Mô tả cho các chữ trong cơ sở dữ liệu ký tự CHISE. Glyph chưa có mã được viết bằng tham chiếu thực thể theo tên trong cơ sở dữ liệu; các bộ phận CDP được thêm năm 2003.',
      'zh-Hans': 'CHISE字符数据库中各字的描述。没有码位的字形用它在数据库里的名称写成实体引用；CDP的部件在2003年加入。',
      'zh-Hant': 'CHISE字元資料庫中各字的描述。沒有碼位的字形用它在資料庫裡的名稱寫成實體參照；CDP的部件在2003年加入。',
    },
    sources: [{ label: 'chise/ids README', url: 'https://github.com/chise/ids/blob/main/README.md' }, { label: 'ChangeLog', url: 'https://raw.githubusercontent.com/chise/ids/main/ChangeLog' }],
  },
  {
    year: '2003', title: 'CDL · Wenlin', who: 'Tom Bishop, Richard Cook',
    text: {
      en: 'Character Description Language: XML that places every component and stroke by coordinates. Its first public specification is IRG N985.',
      ja: 'Character Description Language。各部品と筆画を座標で置くXMLです。最初の公開仕様はIRG N985です。',
      ko: 'Character Description Language. 부품과 획을 좌표로 놓는 XML입니다. 첫 공개 명세는 IRG N985입니다.',
      vi: 'Character Description Language: XML đặt từng bộ phận và nét theo tọa độ. Bản đặc tả công khai đầu tiên là IRG N985.',
      'zh-Hans': 'Character Description Language：用坐标安放每个部件和笔画的XML。首个公开规范是IRG N985。',
      'zh-Hant': 'Character Description Language：用座標安放每個部件和筆畫的XML。首個公開規範是IRG N985。',
    },
    sources: [{ label: 'IRG N985', url: 'https://www.unicode.org/irg/docs/n0985-CDLSpecification.pdf' }],
  },
  {
    year: '2005', title: 'KAGE · GlyphWiki', who: '上地宏一 KAMICHI Koichi', sample: 'u2ffa-u98a8-u6625 · cdp-89ae',
    text: {
      en: 'KAGE draws a glyph from stroke data; GlyphWiki is the wiki of such glyphs. A glyph may be named by its description in code points, and CDP’s parts keep their codes.',
      ja: 'KAGEは筆画データからグリフを描き、グリフウィキはそのグリフのウィキです。グリフは符号位置で綴った記述を名前にでき、CDPの部品は符号のまま名前になります。',
      ko: 'KAGE는 획 데이터로 글리프를 그리고, GlyphWiki는 그 글리프의 위키입니다. 글리프 이름은 코드 포인트로 적은 기술이 될 수 있고, CDP 부품은 부호 그대로 이름이 됩니다.',
      vi: 'KAGE vẽ glyph từ dữ liệu nét; GlyphWiki là wiki của các glyph đó. Một glyph có thể mang tên là mô tả viết bằng điểm mã, và bộ phận CDP giữ nguyên mã của mình.',
      'zh-Hans': 'KAGE根据笔画数据绘制字形，GlyphWiki是这些字形的维基。字形可以用以码位拼写的描述序列命名，CDP的部件沿用原代码。',
      'zh-Hant': 'KAGE根據筆畫資料繪製字形，GlyphWiki是這些字形的維基。字形可以用以碼位拼寫的描述序列命名，CDP的部件沿用原代碼。',
    },
    sources: [{ label: 'CHISE Conference 2005', url: 'https://www.chise.org/conf/2005/kamichi/chise2005-kamichi.pdf' }, { label: 'グリフを登録する', url: 'https://glyphwiki.org/wiki/GlyphWiki:グリフを登録する' }],
  },
  {
    year: '2011', from: true, title: 'cjkvi-ids', who: '川幡太一 KAWABATA Taichi', sample: '①–⑳',
    text: {
      en: 'A branch of CHISE’s table kept for the IRG’s work on duplicate and unifiable characters. An unencoded part is a circled number, its stroke count.',
      ja: 'CHISEの表の枝で、IRGでの重複・統合可能文字の検出のために整備されています。符号化されていない部品は、画数を表す丸数字で書きます。',
      ko: 'CHISE 표의 갈래로, IRG에서 중복·통합 가능 글자를 찾는 데 쓰려고 정비한 것입니다. 부호화되지 않은 부품은 획수를 나타내는 원문자로 적습니다.',
      vi: 'Một nhánh của bảng CHISE, duy trì cho việc tìm chữ trùng và chữ hợp nhất được ở IRG. Bộ phận chưa mã hóa là một số khoanh tròn, tức số nét.',
      'zh-Hans': 'CHISE表的一个分支，为IRG查找重复字和可统一字而维护。未编码部件写成带圈数字，数字是笔画数。',
      'zh-Hant': 'CHISE表的一個分支，為IRG查找重複字和可統一字而維護。未編碼部件寫成帶圈數字，數字是筆畫數。',
    },
    sources: [{ label: 'cjkvi-ids README', url: 'https://github.com/cjkvi/cjkvi-ids/blob/master/README.md' }, { label: '漢字データベース: IDS', url: 'https://kanji-database.sourceforge.net/ids/ids.html' }],
  },
  {
    year: '2016', from: true, title: 'BabelStone IDS', who: 'Andrew West 魏安', sample: '{53}',
    text: {
      en: 'Built on Kawabata’s data, IRG submissions and its maintainer’s own work, with a description per source region. An unencoded part is a number in braces, listed in the file’s note 6.',
      ja: '川幡氏のデータ、IRGへの提出資料、作者自身の作業に基づき、提出源ごとに記述を持ちます。符号化されていない部品は波括弧に入れた番号で、ファイルの注6に一覧があります。',
      ko: '가와바타의 데이터, IRG 제출 자료, 작성자 자신의 작업을 바탕으로 하며 출처 지역별 기술을 둡니다. 부호화되지 않은 부품은 중괄호 속 번호이고, 파일의 주 6에 목록이 있습니다.',
      vi: 'Dựa trên dữ liệu của Kawabata, hồ sơ gửi IRG và công sức của chính người duy trì, có mô tả riêng cho từng nguồn. Bộ phận chưa mã hóa là một số trong ngoặc nhọn, liệt kê ở chú thích 6 của tệp.',
      'zh-Hans': '以川幡的数据、提交IRG的材料和作者自己的整理为基础，按提交源分别给出描述。未编码部件写成花括号里的编号，见文件的注6。',
      'zh-Hant': '以川幡的資料、提交IRG的材料和作者自己的整理為基礎，按提交源分別給出描述。未編碼部件寫成花括號裡的編號，見檔案的註6。',
    },
    sources: [{ label: 'IDS.TXT', url: 'https://www.babelstone.co.uk/CJK/IDS.TXT' }],
  },
  {
    year: '2021', from: true, title: 'hfhchan/ids', who: 'Henry Chan',
    text: {
      en: 'Descriptions made by hand or exported from the hkcs glyphs on GlyphWiki, split by the IRG’s principles.',
      ja: '手作業、またはグリフウィキのhkcsグリフからの書き出しで作られた記述。IRGの原則に従って分解しています。',
      ko: '손으로 만들거나 GlyphWiki의 hkcs 글리프에서 내보낸 기술로, IRG 원칙에 따라 나눕니다.',
      vi: 'Các mô tả làm tay hoặc xuất từ glyph hkcs trên GlyphWiki, tách theo nguyên tắc của IRG.',
      'zh-Hans': '手工编写或由GlyphWiki的hkcs字形导出的描述，按IRG的原则拆分。',
      'zh-Hant': '手工編寫或由GlyphWiki的hkcs字形匯出的描述，按IRG的原則拆分。',
    },
    sources: [{ label: 'hfhchan/ids README', url: 'https://github.com/hfhchan/ids/blob/master/README.md' }],
  },
  {
    year: '2021', from: true, title: '白式 IDS · zi.tools', who: '白易 Yi Bai', sample: '#(-𠃌㇉) · ⿻[1:]丨日 · (.,T)',
    text: {
      en: 'Extensions so that one description names one glyph: stroke chains, crossing constraints on ⿻, variant identifiers and uniqueness marks. NightFurySL2001 and others wrote the grammar up in 2026.',
      ja: '一つの記述が一つのグリフを指すようにする拡張です。筆画連鎖、⿻の交差の制約、字形変体の識別子、唯一化の印があります。文法は2026年にNightFurySL2001らがまとめました。',
      ko: '기술 하나가 글리프 하나를 가리키도록 하는 확장입니다. 획 사슬, ⿻의 교차 제약, 자형 변체 식별자, 유일화 표지가 있습니다. 문법은 2026년에 NightFurySL2001 등이 정리했습니다.',
      vi: 'Các mở rộng để một mô tả chỉ đúng một glyph: chuỗi nét, ràng buộc chỗ cắt của ⿻, ký hiệu biến thể và dấu duy nhất hóa. Ngữ pháp được NightFurySL2001 và cộng sự viết lại năm 2026.',
      'zh-Hans': '让一个描述序列只对应一个字形的扩展：笔画链、⿻的穿插限制、字形变体标识符和唯一化分隔符。语法由夜煞之乐等人在2026年整理成文。',
      'zh-Hant': '讓一個描述序列只對應一個字形的擴展：筆畫鏈、⿻的穿插限制、字形變體標識符和唯一化分隔符。語法由夜煞之樂等人在2026年整理成文。',
    },
    sources: [{ label: 'yi-bai/ids', url: 'https://github.com/yi-bai/ids' }, { label: '（白式）IDS 延展语法导论', url: 'https://nightfurysl2001.github.io/bai-ids/' }],
  },
  {
    year: '2023', title: 'Unicode 15.1', who: 'Ken Lunde, John Jenkins, Andrew West (IRG N2572)', sample: '⿼ ⿽ ⿾ ⿿ ㇯',
    text: {
      en: 'Five more: enclosure from the right and from the lower right, mirroring, rotation and subtraction.',
      ja: '5字が加わりました。右からの囲み、右下からの囲み、左右反転、回転、引き算です。',
      ko: '다섯 자가 더해졌습니다. 오른쪽 둘러싸기, 오른쪽 아래 둘러싸기, 좌우 뒤집기, 회전, 빼기입니다.',
      vi: 'Thêm năm ký tự: bao từ bên phải, bao từ góc dưới phải, lật gương, xoay và phép trừ.',
      'zh-Hans': '新增五个：右包围、右下包围、镜像、旋转和删减。',
      'zh-Hant': '新增五個：右包圍、右下包圍、鏡像、旋轉和刪減。',
    },
    sources: [{ label: 'IRG N2572', url: 'https://unicode.org/irg/docs/n2572-NewIDCs.pdf' }, { label: 'DerivedAge.txt', url: 'https://www.unicode.org/Public/UCD/latest/ucd/DerivedAge.txt' }],
  },
  {
    year: '2026', title: 'IDS Workshop', who: 'mkpoli', sample: '&X-00053;',
    text: {
      en: 'One identifier for each unencoded form, whatever the tables above call it, with what each form is in the other notations.',
      ja: '上の各表での呼び名によらず、符号化されていない字形ごとに一つの識別子を振り、他の記法での書き方を添えます。',
      ko: '위의 표들이 뭐라 부르든 부호화되지 않은 자형마다 식별자 하나를 주고, 다른 표기법으로는 무엇인지 함께 적습니다.',
      vi: 'Một định danh cho mỗi dạng chưa mã hóa, dù các bảng trên gọi nó là gì, kèm cách viết dạng ấy trong các ký pháp khác.',
      'zh-Hans': '不管上面各表怎么称呼，给每个未编码字形一个标识符，并列出它在其他记法里的写法。',
      'zh-Hant': '不管上面各表怎麼稱呼，給每個未編碼字形一個識別碼，並列出它在其他記法裡的寫法。',
    },
    sources: [{ label: 'custom-ids.tsv', url: 'https://github.com/mkpoli/ids-input/blob/main/data/custom-ids.tsv' }, { label: 'docs/custom-components.md', url: 'https://github.com/mkpoli/ids-input/blob/main/docs/custom-components.md' }],
  },
]

/** Systems with no date found on a page read. @type {HistoryEntry[]} */
export const UNDATED = [
  {
    year: '', title: 'CBETA 組字式', who: 'CBETA 中華電子佛典協會', sample: '[金*本]',
    text: {
      en: 'Six signs between brackets, * / @ - + ?. 明 is 日*月, 音 is 立/日, 因 is 囗@大 and 閒 is 間-日+月.',
      ja: '角括弧の中で六つの記号 * / @ - + ? を使います。明は日*月、音は立/日、因は囗@大、閒は間-日+月です。',
      ko: '대괄호 안에서 여섯 기호 * / @ - + ? 를 씁니다. 明은 日*月, 音은 立/日, 因은 囗@大, 閒은 間-日+月입니다.',
      vi: 'Sáu dấu trong ngoặc vuông, * / @ - + ?. 明 là 日*月, 音 là 立/日, 因 là 囗@大 và 閒 là 間-日+月.',
      'zh-Hans': '方括号里用六个符号 * / @ - + ?。明是日*月，音是立/日，因是囗@大，閒是間-日+月。',
      'zh-Hant': '方括號裡用六個符號 * / @ - + ?。明是日*月，音是立/日，因是囗@大，閒是間-日+月。',
    },
    sources: [{ label: 'CBETA 組字式基本規則', url: 'https://www.cbeta.org/format/rare-rule.php' }],
  },
]
