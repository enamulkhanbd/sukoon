export interface SurahMeta {
  id: number;
  nameSimple: string;
  nameArabic: string;
  nameBangla: string;
  meaningBangla: string;
  versesCount: number;
  revelationPlace: "makkah" | "madinah";
  bismillahPre: boolean;
  pages: [number, number];
}

export const SURAHS: SurahMeta[] = [
  {
    "id": 1,
    "nameSimple": "Al-Fatihah",
    "nameArabic": "الفاتحة",
    "nameBangla": "আল-ফাতিহা",
    "meaningBangla": "সূচনা",
    "versesCount": 7,
    "revelationPlace": "makkah",
    "bismillahPre": false,
    "pages": [
      1,
      1
    ]
  },
  {
    "id": 2,
    "nameSimple": "Al-Baqarah",
    "nameArabic": "البقرة",
    "nameBangla": "আল-বাকারা",
    "meaningBangla": "বকনা-বাছুর",
    "versesCount": 286,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      2,
      49
    ]
  },
  {
    "id": 3,
    "nameSimple": "Ali 'Imran",
    "nameArabic": "آل عمران",
    "nameBangla": "আলে ইমরান",
    "meaningBangla": "ইমরানের পরিবার",
    "versesCount": 200,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      50,
      76
    ]
  },
  {
    "id": 4,
    "nameSimple": "An-Nisa",
    "nameArabic": "النساء",
    "nameBangla": "আন-নিসা",
    "meaningBangla": "নারী",
    "versesCount": 176,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      77,
      106
    ]
  },
  {
    "id": 5,
    "nameSimple": "Al-Ma'idah",
    "nameArabic": "المائدة",
    "nameBangla": "আল-মায়িদাহ",
    "meaningBangla": "খাদ্য পরিবেশিত টেবিল",
    "versesCount": 120,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      106,
      127
    ]
  },
  {
    "id": 6,
    "nameSimple": "Al-An'am",
    "nameArabic": "الأنعام",
    "nameBangla": "আল-আনআম",
    "meaningBangla": "গৃহপালিত পশু",
    "versesCount": 165,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      128,
      150
    ]
  },
  {
    "id": 7,
    "nameSimple": "Al-A'raf",
    "nameArabic": "الأعراف",
    "nameBangla": "আল-আরাফ",
    "meaningBangla": "উচু স্থান",
    "versesCount": 206,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      151,
      176
    ]
  },
  {
    "id": 8,
    "nameSimple": "Al-Anfal",
    "nameArabic": "الأنفال",
    "nameBangla": "আল-আনফাল",
    "meaningBangla": "যুদ্ধ-লব্ধ ধনসম্পদ",
    "versesCount": 75,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      177,
      186
    ]
  },
  {
    "id": 9,
    "nameSimple": "At-Tawbah",
    "nameArabic": "التوبة",
    "nameBangla": "আত-তাওবাহ",
    "meaningBangla": "অনুশোচনা",
    "versesCount": 129,
    "revelationPlace": "madinah",
    "bismillahPre": false,
    "pages": [
      187,
      207
    ]
  },
  {
    "id": 10,
    "nameSimple": "Yunus",
    "nameArabic": "يونس",
    "nameBangla": "ইউনুস",
    "meaningBangla": "নবী ইউনুস",
    "versesCount": 109,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      208,
      221
    ]
  },
  {
    "id": 11,
    "nameSimple": "Hud",
    "nameArabic": "هود",
    "nameBangla": "হুদ",
    "meaningBangla": "নবী হুদ",
    "versesCount": 123,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      221,
      235
    ]
  },
  {
    "id": 12,
    "nameSimple": "Yusuf",
    "nameArabic": "يوسف",
    "nameBangla": "ইউসুফ",
    "meaningBangla": "নবী ইউসুফ",
    "versesCount": 111,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      235,
      248
    ]
  },
  {
    "id": 13,
    "nameSimple": "Ar-Ra'd",
    "nameArabic": "الرعد",
    "nameBangla": "আর-রাদ",
    "meaningBangla": "বজ্রপাত",
    "versesCount": 43,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      249,
      255
    ]
  },
  {
    "id": 14,
    "nameSimple": "Ibrahim",
    "nameArabic": "ابراهيم",
    "nameBangla": "ইবরাহীম",
    "meaningBangla": "নবী ইবরাহীম",
    "versesCount": 52,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      255,
      261
    ]
  },
  {
    "id": 15,
    "nameSimple": "Al-Hijr",
    "nameArabic": "الحجر",
    "nameBangla": "আল-হিজর",
    "meaningBangla": "পাথুরে পাহাড়",
    "versesCount": 99,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      262,
      267
    ]
  },
  {
    "id": 16,
    "nameSimple": "An-Nahl",
    "nameArabic": "النحل",
    "nameBangla": "আন-নাহল",
    "meaningBangla": "মৌমাছি",
    "versesCount": 128,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      267,
      281
    ]
  },
  {
    "id": 17,
    "nameSimple": "Al-Isra",
    "nameArabic": "الإسراء",
    "nameBangla": "আল-ইসরা",
    "meaningBangla": "ইহুদি জাতি",
    "versesCount": 111,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      282,
      293
    ]
  },
  {
    "id": 18,
    "nameSimple": "Al-Kahf",
    "nameArabic": "الكهف",
    "nameBangla": "আল-কাহফ",
    "meaningBangla": "গুহা",
    "versesCount": 110,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      293,
      304
    ]
  },
  {
    "id": 19,
    "nameSimple": "Maryam",
    "nameArabic": "مريم",
    "nameBangla": "মারইয়াম",
    "meaningBangla": "মারইয়াম (ঈসা নবীর মা)",
    "versesCount": 98,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      305,
      312
    ]
  },
  {
    "id": 20,
    "nameSimple": "Taha",
    "nameArabic": "طه",
    "nameBangla": "ত্বা-হা",
    "meaningBangla": "ত়া হা",
    "versesCount": 135,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      312,
      321
    ]
  },
  {
    "id": 21,
    "nameSimple": "Al-Anbya",
    "nameArabic": "الأنبياء",
    "nameBangla": "আল-আম্বিয়া",
    "meaningBangla": "নবীগণ",
    "versesCount": 112,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      322,
      331
    ]
  },
  {
    "id": 22,
    "nameSimple": "Al-Hajj",
    "nameArabic": "الحج",
    "nameBangla": "আল-হাজ্জ",
    "meaningBangla": "হ়াজ্জ",
    "versesCount": 78,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      332,
      341
    ]
  },
  {
    "id": 23,
    "nameSimple": "Al-Mu'minun",
    "nameArabic": "المؤمنون",
    "nameBangla": "আল-মুমিনূন",
    "meaningBangla": "বিশ্বাসী",
    "versesCount": 118,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      342,
      349
    ]
  },
  {
    "id": 24,
    "nameSimple": "An-Nur",
    "nameArabic": "النور",
    "nameBangla": "আন-নূর",
    "meaningBangla": "আলো",
    "versesCount": 64,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      350,
      359
    ]
  },
  {
    "id": 25,
    "nameSimple": "Al-Furqan",
    "nameArabic": "الفرقان",
    "nameBangla": "আল-ফুরকান",
    "meaningBangla": "মানদণ্ড",
    "versesCount": 77,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      359,
      366
    ]
  },
  {
    "id": 26,
    "nameSimple": "Ash-Shu'ara",
    "nameArabic": "الشعراء",
    "nameBangla": "আশ-শুআরা",
    "meaningBangla": "কবি",
    "versesCount": 227,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      367,
      376
    ]
  },
  {
    "id": 27,
    "nameSimple": "An-Naml",
    "nameArabic": "النمل",
    "nameBangla": "আন-নামল",
    "meaningBangla": "পিঁপড়া",
    "versesCount": 93,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      377,
      385
    ]
  },
  {
    "id": 28,
    "nameSimple": "Al-Qasas",
    "nameArabic": "القصص",
    "nameBangla": "আল-কাসাস",
    "meaningBangla": "কাহিনি",
    "versesCount": 88,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      385,
      396
    ]
  },
  {
    "id": 29,
    "nameSimple": "Al-'Ankabut",
    "nameArabic": "العنكبوت",
    "nameBangla": "আল-আনকাবূত",
    "meaningBangla": "মাকড়শা",
    "versesCount": 69,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      396,
      404
    ]
  },
  {
    "id": 30,
    "nameSimple": "Ar-Rum",
    "nameArabic": "الروم",
    "nameBangla": "আর-রূম",
    "meaningBangla": "রোমান জাতি",
    "versesCount": 60,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      404,
      410
    ]
  },
  {
    "id": 31,
    "nameSimple": "Luqman",
    "nameArabic": "لقمان",
    "nameBangla": "লুকমান",
    "meaningBangla": "এক জ্ঞানী ব্যাক্তি",
    "versesCount": 34,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      411,
      414
    ]
  },
  {
    "id": 32,
    "nameSimple": "As-Sajdah",
    "nameArabic": "السجدة",
    "nameBangla": "আস-সাজদাহ",
    "meaningBangla": "সিজদা",
    "versesCount": 30,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      415,
      417
    ]
  },
  {
    "id": 33,
    "nameSimple": "Al-Ahzab",
    "nameArabic": "الأحزاب",
    "nameBangla": "আল-আহযাব",
    "meaningBangla": "জোট",
    "versesCount": 73,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      418,
      427
    ]
  },
  {
    "id": 34,
    "nameSimple": "Saba",
    "nameArabic": "سبإ",
    "nameBangla": "সাবা",
    "meaningBangla": "রানী সাবা/শেবা",
    "versesCount": 54,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      428,
      434
    ]
  },
  {
    "id": 35,
    "nameSimple": "Fatir",
    "nameArabic": "فاطر",
    "nameBangla": "ফাতির",
    "meaningBangla": "আদি স্রষ্টা",
    "versesCount": 45,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      434,
      440
    ]
  },
  {
    "id": 36,
    "nameSimple": "Ya-Sin",
    "nameArabic": "يس",
    "nameBangla": "ইয়াসীন",
    "meaningBangla": "ইয়াসীন",
    "versesCount": 83,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      440,
      445
    ]
  },
  {
    "id": 37,
    "nameSimple": "As-Saffat",
    "nameArabic": "الصافات",
    "nameBangla": "আস-সাফফাত",
    "meaningBangla": "সারিবদ্ধভাবে দাঁড়ানো",
    "versesCount": 182,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      446,
      452
    ]
  },
  {
    "id": 38,
    "nameSimple": "Sad",
    "nameArabic": "ص",
    "nameBangla": "সোয়াদ",
    "meaningBangla": "আরবি বর্ণ সাদ",
    "versesCount": 88,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      453,
      458
    ]
  },
  {
    "id": 39,
    "nameSimple": "Az-Zumar",
    "nameArabic": "الزمر",
    "nameBangla": "আয-যুমার",
    "meaningBangla": "দলবদ্ধ জনতা",
    "versesCount": 75,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      458,
      467
    ]
  },
  {
    "id": 40,
    "nameSimple": "Ghafir",
    "nameArabic": "غافر",
    "nameBangla": "গাফির",
    "meaningBangla": "ক্ষমাকারী",
    "versesCount": 85,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      467,
      476
    ]
  },
  {
    "id": 41,
    "nameSimple": "Fussilat",
    "nameArabic": "فصلت",
    "nameBangla": "ফুসসিলাত",
    "meaningBangla": "সুস্পষ্ট বিবরণ",
    "versesCount": 54,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      477,
      482
    ]
  },
  {
    "id": 42,
    "nameSimple": "Ash-Shuraa",
    "nameArabic": "الشورى",
    "nameBangla": "আশ-শূরা",
    "meaningBangla": "পরামর্শ",
    "versesCount": 53,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      483,
      489
    ]
  },
  {
    "id": 43,
    "nameSimple": "Az-Zukhruf",
    "nameArabic": "الزخرف",
    "nameBangla": "আয-যুখরুফ",
    "meaningBangla": "সোনাদানা",
    "versesCount": 89,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      489,
      495
    ]
  },
  {
    "id": 44,
    "nameSimple": "Ad-Dukhan",
    "nameArabic": "الدخان",
    "nameBangla": "আদ-দুখান",
    "meaningBangla": "ধোঁয়া",
    "versesCount": 59,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      496,
      498
    ]
  },
  {
    "id": 45,
    "nameSimple": "Al-Jathiyah",
    "nameArabic": "الجاثية",
    "nameBangla": "আল-জাসিয়াহ",
    "meaningBangla": "নতজানু",
    "versesCount": 37,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      499,
      502
    ]
  },
  {
    "id": 46,
    "nameSimple": "Al-Ahqaf",
    "nameArabic": "الأحقاف",
    "nameBangla": "আল-আহকাফ",
    "meaningBangla": "বালুর পাহাড়",
    "versesCount": 35,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      502,
      506
    ]
  },
  {
    "id": 47,
    "nameSimple": "Muhammad",
    "nameArabic": "محمد",
    "nameBangla": "মুহাম্মাদ",
    "meaningBangla": "নবী মুহাম্মদ",
    "versesCount": 38,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      507,
      510
    ]
  },
  {
    "id": 48,
    "nameSimple": "Al-Fath",
    "nameArabic": "الفتح",
    "nameBangla": "আল-ফাতহ",
    "meaningBangla": "বিজয়",
    "versesCount": 29,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      511,
      515
    ]
  },
  {
    "id": 49,
    "nameSimple": "Al-Hujurat",
    "nameArabic": "الحجرات",
    "nameBangla": "আল-হুজুরাত",
    "meaningBangla": "আবাস",
    "versesCount": 18,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      515,
      517
    ]
  },
  {
    "id": 50,
    "nameSimple": "Qaf",
    "nameArabic": "ق",
    "nameBangla": "ক্বাফ",
    "meaningBangla": "কাফ",
    "versesCount": 45,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      518,
      520
    ]
  },
  {
    "id": 51,
    "nameSimple": "Adh-Dhariyat",
    "nameArabic": "الذاريات",
    "nameBangla": "আয-যারিয়াত",
    "meaningBangla": "বিক্ষেপকারী বাতাস",
    "versesCount": 60,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      520,
      523
    ]
  },
  {
    "id": 52,
    "nameSimple": "At-Tur",
    "nameArabic": "الطور",
    "nameBangla": "আত-তূর",
    "meaningBangla": "পাহাড়",
    "versesCount": 49,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      523,
      525
    ]
  },
  {
    "id": 53,
    "nameSimple": "An-Najm",
    "nameArabic": "النجم",
    "nameBangla": "আন-নাজম",
    "meaningBangla": "তারা",
    "versesCount": 62,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      526,
      528
    ]
  },
  {
    "id": 54,
    "nameSimple": "Al-Qamar",
    "nameArabic": "القمر",
    "nameBangla": "আল-কামার",
    "meaningBangla": "চাঁদ",
    "versesCount": 55,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      528,
      531
    ]
  },
  {
    "id": 55,
    "nameSimple": "Ar-Rahman",
    "nameArabic": "الرحمن",
    "nameBangla": "আর-রহমান",
    "meaningBangla": "পরম করুণাময়",
    "versesCount": 78,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      531,
      534
    ]
  },
  {
    "id": 56,
    "nameSimple": "Al-Waqi'ah",
    "nameArabic": "الواقعة",
    "nameBangla": "আল-ওয়াকিয়াহ",
    "meaningBangla": "নিশ্চিত ঘটনা",
    "versesCount": 96,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      534,
      537
    ]
  },
  {
    "id": 57,
    "nameSimple": "Al-Hadid",
    "nameArabic": "الحديد",
    "nameBangla": "আল-হাদীদ",
    "meaningBangla": "লোহা",
    "versesCount": 29,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      537,
      541
    ]
  },
  {
    "id": 58,
    "nameSimple": "Al-Mujadila",
    "nameArabic": "المجادلة",
    "nameBangla": "আল-মুজাদালাহ",
    "meaningBangla": "অনুযোগকারিণী",
    "versesCount": 22,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      542,
      545
    ]
  },
  {
    "id": 59,
    "nameSimple": "Al-Hashr",
    "nameArabic": "الحشر",
    "nameBangla": "আল-হাশর",
    "meaningBangla": "সমাবেশ",
    "versesCount": 24,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      545,
      548
    ]
  },
  {
    "id": 60,
    "nameSimple": "Al-Mumtahanah",
    "nameArabic": "الممتحنة",
    "nameBangla": "আল-মুমতাহিনাহ",
    "meaningBangla": "নারী, যাকে পরীক্ষা করা হবে",
    "versesCount": 13,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      549,
      551
    ]
  },
  {
    "id": 61,
    "nameSimple": "As-Saf",
    "nameArabic": "الصف",
    "nameBangla": "আস-সাফ",
    "meaningBangla": "সারিবদ্ধ সৈন্যদল",
    "versesCount": 14,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      551,
      552
    ]
  },
  {
    "id": 62,
    "nameSimple": "Al-Jumu'ah",
    "nameArabic": "الجمعة",
    "nameBangla": "আল-জুমুআহ",
    "meaningBangla": "সম্মেলন/শুক্রবার",
    "versesCount": 11,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      553,
      554
    ]
  },
  {
    "id": 63,
    "nameSimple": "Al-Munafiqun",
    "nameArabic": "المنافقون",
    "nameBangla": "আল-মুনাফিকূন",
    "meaningBangla": "ভণ্ড বিশ্বাসী",
    "versesCount": 11,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      554,
      555
    ]
  },
  {
    "id": 64,
    "nameSimple": "At-Taghabun",
    "nameArabic": "التغابن",
    "nameBangla": "আত-তাগাবুন",
    "meaningBangla": "মোহ অপসারণ",
    "versesCount": 18,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      556,
      557
    ]
  },
  {
    "id": 65,
    "nameSimple": "At-Talaq",
    "nameArabic": "الطلاق",
    "nameBangla": "আত-তালাক",
    "meaningBangla": "তালাক",
    "versesCount": 12,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      558,
      559
    ]
  },
  {
    "id": 66,
    "nameSimple": "At-Tahrim",
    "nameArabic": "التحريم",
    "nameBangla": "আত-তাহরীম",
    "meaningBangla": "নিষিদ্ধকরণ",
    "versesCount": 12,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      560,
      561
    ]
  },
  {
    "id": 67,
    "nameSimple": "Al-Mulk",
    "nameArabic": "الملك",
    "nameBangla": "আল-মুলক",
    "meaningBangla": "সার্বভৌম কর্তৃত্ব",
    "versesCount": 30,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      562,
      564
    ]
  },
  {
    "id": 68,
    "nameSimple": "Al-Qalam",
    "nameArabic": "القلم",
    "nameBangla": "আল-ক্বালাম",
    "meaningBangla": "কলম",
    "versesCount": 52,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      564,
      566
    ]
  },
  {
    "id": 69,
    "nameSimple": "Al-Haqqah",
    "nameArabic": "الحاقة",
    "nameBangla": "আল-হাক্কাহ",
    "meaningBangla": "নিশ্চিত সত্য",
    "versesCount": 52,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      566,
      568
    ]
  },
  {
    "id": 70,
    "nameSimple": "Al-Ma'arij",
    "nameArabic": "المعارج",
    "nameBangla": "আল-মাআরিজ",
    "meaningBangla": "উন্নয়নের সোপান",
    "versesCount": 44,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      568,
      570
    ]
  },
  {
    "id": 71,
    "nameSimple": "Nuh",
    "nameArabic": "نوح",
    "nameBangla": "নূহ",
    "meaningBangla": "নবী নূহ",
    "versesCount": 28,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      570,
      571
    ]
  },
  {
    "id": 72,
    "nameSimple": "Al-Jinn",
    "nameArabic": "الجن",
    "nameBangla": "আল-জিন",
    "meaningBangla": "জিন সম্প্রদায়",
    "versesCount": 28,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      572,
      573
    ]
  },
  {
    "id": 73,
    "nameSimple": "Al-Muzzammil",
    "nameArabic": "المزمل",
    "nameBangla": "আল-মুযযাম্মিল",
    "meaningBangla": "বস্ত্রাচ্ছাদনকারী",
    "versesCount": 20,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      574,
      575
    ]
  },
  {
    "id": 74,
    "nameSimple": "Al-Muddaththir",
    "nameArabic": "المدثر",
    "nameBangla": "আল-মুদ্দাসসির",
    "meaningBangla": "পোশাক পরিহিত",
    "versesCount": 56,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      575,
      577
    ]
  },
  {
    "id": 75,
    "nameSimple": "Al-Qiyamah",
    "nameArabic": "القيامة",
    "nameBangla": "আল-কিয়ামাহ",
    "meaningBangla": "পুনরুত্থান",
    "versesCount": 40,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      577,
      578
    ]
  },
  {
    "id": 76,
    "nameSimple": "Al-Insan",
    "nameArabic": "الانسان",
    "nameBangla": "আল-ইনসান",
    "meaningBangla": "মানবজাতি",
    "versesCount": 31,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      578,
      580
    ]
  },
  {
    "id": 77,
    "nameSimple": "Al-Mursalat",
    "nameArabic": "المرسلات",
    "nameBangla": "আল-মুরসালাত",
    "meaningBangla": "প্রেরিত পুরুষ",
    "versesCount": 50,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      580,
      581
    ]
  },
  {
    "id": 78,
    "nameSimple": "An-Naba",
    "nameArabic": "النبإ",
    "nameBangla": "আন-নাবা",
    "meaningBangla": "মহাসংবাদ",
    "versesCount": 40,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      582,
      583
    ]
  },
  {
    "id": 79,
    "nameSimple": "An-Nazi'at",
    "nameArabic": "النازعات",
    "nameBangla": "আন-নাযিআত",
    "meaningBangla": "প্রচেষ্টাকারী",
    "versesCount": 46,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      583,
      584
    ]
  },
  {
    "id": 80,
    "nameSimple": "'Abasa",
    "nameArabic": "عبس",
    "nameBangla": "আবাসা",
    "meaningBangla": "সে ভ্রু কুঁচকালো",
    "versesCount": 42,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      585,
      585
    ]
  },
  {
    "id": 81,
    "nameSimple": "At-Takwir",
    "nameArabic": "التكوير",
    "nameBangla": "আত-তাকবীর",
    "meaningBangla": "অন্ধকারাচ্ছন্ন",
    "versesCount": 29,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      586,
      586
    ]
  },
  {
    "id": 82,
    "nameSimple": "Al-Infitar",
    "nameArabic": "الإنفطار",
    "nameBangla": "আল-ইনফিতার",
    "meaningBangla": "বিদীর্ণ করা",
    "versesCount": 19,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      587,
      587
    ]
  },
  {
    "id": 83,
    "nameSimple": "Al-Mutaffifin",
    "nameArabic": "المطففين",
    "nameBangla": "আল-মুতাফফিফীন",
    "meaningBangla": "প্রতারণা করা",
    "versesCount": 36,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      587,
      589
    ]
  },
  {
    "id": 84,
    "nameSimple": "Al-Inshiqaq",
    "nameArabic": "الإنشقاق",
    "nameBangla": "আল-ইনশিকাক",
    "meaningBangla": "খণ্ড-বিখণ্ডকরণ",
    "versesCount": 25,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      589,
      589
    ]
  },
  {
    "id": 85,
    "nameSimple": "Al-Buruj",
    "nameArabic": "البروج",
    "nameBangla": "আল-বুরূজ",
    "meaningBangla": "নক্ষত্রপুঞ্জ",
    "versesCount": 22,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      590,
      590
    ]
  },
  {
    "id": 86,
    "nameSimple": "At-Tariq",
    "nameArabic": "الطارق",
    "nameBangla": "আত-তারিক",
    "meaningBangla": "রাতের আগন্তুক",
    "versesCount": 17,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      591,
      591
    ]
  },
  {
    "id": 87,
    "nameSimple": "Al-A'la",
    "nameArabic": "الأعلى",
    "nameBangla": "আল-আলা",
    "meaningBangla": "সর্বোন্নত",
    "versesCount": 19,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      591,
      592
    ]
  },
  {
    "id": 88,
    "nameSimple": "Al-Ghashiyah",
    "nameArabic": "الغاشية",
    "nameBangla": "আল-গাশিয়াহ",
    "meaningBangla": "বিহ্বলকর ঘটনা",
    "versesCount": 26,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      592,
      592
    ]
  },
  {
    "id": 89,
    "nameSimple": "Al-Fajr",
    "nameArabic": "الفجر",
    "nameBangla": "আল-ফাজর",
    "meaningBangla": "ভোরবেলা",
    "versesCount": 30,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      593,
      594
    ]
  },
  {
    "id": 90,
    "nameSimple": "Al-Balad",
    "nameArabic": "البلد",
    "nameBangla": "আল-বালাদ",
    "meaningBangla": "নগর",
    "versesCount": 20,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      594,
      594
    ]
  },
  {
    "id": 91,
    "nameSimple": "Ash-Shams",
    "nameArabic": "الشمس",
    "nameBangla": "আশ-শামস",
    "meaningBangla": "সূর্য",
    "versesCount": 15,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      595,
      595
    ]
  },
  {
    "id": 92,
    "nameSimple": "Al-Layl",
    "nameArabic": "الليل",
    "nameBangla": "আল-লাইল",
    "meaningBangla": "রাত",
    "versesCount": 21,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      595,
      596
    ]
  },
  {
    "id": 93,
    "nameSimple": "Ad-Duhaa",
    "nameArabic": "الضحى",
    "nameBangla": "আদ-দুহা",
    "meaningBangla": "পূর্বাহ্নের সুর্যকিরণ",
    "versesCount": 11,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      596,
      596
    ]
  },
  {
    "id": 94,
    "nameSimple": "Ash-Sharh",
    "nameArabic": "الشرح",
    "nameBangla": "আশ-শারহ",
    "meaningBangla": "বক্ষ প্রশস্তকরণ",
    "versesCount": 8,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      596,
      596
    ]
  },
  {
    "id": 95,
    "nameSimple": "At-Tin",
    "nameArabic": "التين",
    "nameBangla": "আত-তীন",
    "meaningBangla": "ডুমুর",
    "versesCount": 8,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      597,
      597
    ]
  },
  {
    "id": 96,
    "nameSimple": "Al-'Alaq",
    "nameArabic": "العلق",
    "nameBangla": "আল-আলাক",
    "meaningBangla": "রক্তপিণ্ড",
    "versesCount": 19,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      597,
      597
    ]
  },
  {
    "id": 97,
    "nameSimple": "Al-Qadr",
    "nameArabic": "القدر",
    "nameBangla": "আল-কদর",
    "meaningBangla": "মহিমান্বিত",
    "versesCount": 5,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      598,
      598
    ]
  },
  {
    "id": 98,
    "nameSimple": "Al-Bayyinah",
    "nameArabic": "البينة",
    "nameBangla": "আল-বাইয়্যিনাহ",
    "meaningBangla": "প্রমাণ",
    "versesCount": 8,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      598,
      599
    ]
  },
  {
    "id": 99,
    "nameSimple": "Az-Zalzalah",
    "nameArabic": "الزلزلة",
    "nameBangla": "আয-যিলযাল",
    "meaningBangla": "ভূমিকম্প",
    "versesCount": 8,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      599,
      599
    ]
  },
  {
    "id": 100,
    "nameSimple": "Al-'Adiyat",
    "nameArabic": "العاديات",
    "nameBangla": "আল-আদিয়াত",
    "meaningBangla": "অভিযানকারী",
    "versesCount": 11,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      599,
      600
    ]
  },
  {
    "id": 101,
    "nameSimple": "Al-Qari'ah",
    "nameArabic": "القارعة",
    "nameBangla": "আল-কারিআহ",
    "meaningBangla": "মহাসংকট",
    "versesCount": 11,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      600,
      600
    ]
  },
  {
    "id": 102,
    "nameSimple": "At-Takathur",
    "nameArabic": "التكاثر",
    "nameBangla": "আত-তাকাসুর",
    "meaningBangla": "প্রাচুর্যের প্রতিযোগিতা",
    "versesCount": 8,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      600,
      600
    ]
  },
  {
    "id": 103,
    "nameSimple": "Al-'Asr",
    "nameArabic": "العصر",
    "nameBangla": "আল-আসর",
    "meaningBangla": "সময়",
    "versesCount": 3,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      601,
      601
    ]
  },
  {
    "id": 104,
    "nameSimple": "Al-Humazah",
    "nameArabic": "الهمزة",
    "nameBangla": "আল-হুমাযাহ",
    "meaningBangla": "পরনিন্দাকারী",
    "versesCount": 9,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      601,
      601
    ]
  },
  {
    "id": 105,
    "nameSimple": "Al-Fil",
    "nameArabic": "الفيل",
    "nameBangla": "আল-ফীল",
    "meaningBangla": "হাতি",
    "versesCount": 5,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      601,
      601
    ]
  },
  {
    "id": 106,
    "nameSimple": "Quraysh",
    "nameArabic": "قريش",
    "nameBangla": "কুরাইশ",
    "meaningBangla": "কুরাইশ গোত্র",
    "versesCount": 4,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      602,
      602
    ]
  },
  {
    "id": 107,
    "nameSimple": "Al-Ma'un",
    "nameArabic": "الماعون",
    "nameBangla": "আল-মাঊন",
    "meaningBangla": "সাহায্য সহায়তা",
    "versesCount": 7,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      602,
      602
    ]
  },
  {
    "id": 108,
    "nameSimple": "Al-Kawthar",
    "nameArabic": "الكوثر",
    "nameBangla": "আল-কাউসার",
    "meaningBangla": "কাউসার/প্রাচুর্য",
    "versesCount": 3,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      602,
      602
    ]
  },
  {
    "id": 109,
    "nameSimple": "Al-Kafirun",
    "nameArabic": "الكافرون",
    "nameBangla": "আল-কাফিরূন",
    "meaningBangla": "অবিশ্বাসী",
    "versesCount": 6,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      603,
      603
    ]
  },
  {
    "id": 110,
    "nameSimple": "An-Nasr",
    "nameArabic": "النصر",
    "nameBangla": "আন-নাসর",
    "meaningBangla": "সাহায্য",
    "versesCount": 3,
    "revelationPlace": "madinah",
    "bismillahPre": true,
    "pages": [
      603,
      603
    ]
  },
  {
    "id": 111,
    "nameSimple": "Al-Masad",
    "nameArabic": "المسد",
    "nameBangla": "আল-মাসাদ",
    "meaningBangla": "খেজুরের পাকানো (রশি)",
    "versesCount": 5,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      603,
      603
    ]
  },
  {
    "id": 112,
    "nameSimple": "Al-Ikhlas",
    "nameArabic": "الإخلاص",
    "nameBangla": "আল-ইখলাস",
    "meaningBangla": "আন্তরিকতা",
    "versesCount": 4,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      604,
      604
    ]
  },
  {
    "id": 113,
    "nameSimple": "Al-Falaq",
    "nameArabic": "الفلق",
    "nameBangla": "আল-ফালাক",
    "meaningBangla": "নিশিভোর",
    "versesCount": 5,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      604,
      604
    ]
  },
  {
    "id": 114,
    "nameSimple": "An-Nas",
    "nameArabic": "الناس",
    "nameBangla": "আন-নাস",
    "meaningBangla": "মানুষ জাতি",
    "versesCount": 6,
    "revelationPlace": "makkah",
    "bismillahPre": true,
    "pages": [
      604,
      604
    ]
  }
];

export const SURAH_MAP: Record<number, SurahMeta> = Object.fromEntries(
  SURAHS.map((s) => [s.id, s])
);
