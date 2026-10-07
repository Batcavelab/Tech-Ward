"""Load the placeholder catalog. Safe to run again: existing items (by slug) are left alone.

Prices and names are examples to replace from the admin once the supplier list is final.
"""
from django.core.management.base import BaseCommand

from shop.models import Category, Product

CATEGORIES = [
    # slug, group, fr, ar
    ("cameras-interieur", "cameras", "Caméras intérieures", "كاميرات داخلية"),
    ("cameras-exterieur", "cameras", "Caméras extérieures", "كاميرات خارجية"),
    ("cameras-ptz", "cameras", "Caméras PTZ", "كاميرات PTZ"),
    ("cameras-wifi", "cameras", "Caméras Wi-Fi", "كاميرات واي فاي"),
    ("enregistreurs", "recording", "Enregistreurs et disques", "أجهزة التسجيل والأقراص"),
    ("alarmes", "alarm", "Alarmes", "أنظمة الإنذار"),
    ("controle-acces", "access", "Contrôle d'accès", "التحكم في الولوج"),
    ("accessoires", "accessories", "Accessoires", "الإكسسوارات"),
]

# slug, category, kind, art, brand, price, featured, fr name, ar name, fr short, ar short, fr specs, ar specs
ITEMS = [
    ("camera-interieure-wifi-2k", "cameras-wifi", "product", "indoor", "EZVIZ", 349, True,
     "Caméra intérieure Wi-Fi 2K", "كاميرا داخلية واي فاي 2K",
     "Pour la maison, le bureau et les petits espaces.", "للمنزل والمكتب والمساحات الصغيرة.",
     "Résolution 2K\nVision nocturne jusqu'à 10 m\nDétection de mouvement\nAudio bidirectionnel",
     "دقة 2K\nرؤية ليلية حتى 10 م\nكشف الحركة\nصوت ثنائي الاتجاه"),
    ("camera-exterieure-4mp", "cameras-exterieur", "product", "bullet", "Hikvision", 599, True,
     "Caméra extérieure 4 MP", "كاميرا خارجية 4 ميغابكسل",
     "Conçue pour toutes les conditions météo.", "مصممة لجميع الظروف الجوية.",
     "Résolution 4 MP\nRésistante aux intempéries (IP67)\nVision nocturne jusqu'à 30 m\nDétection de mouvement",
     "دقة 4 ميغابكسل\nمقاومة للعوامل الجوية (IP67)\nرؤية ليلية حتى 30 م\nكشف الحركة"),
    ("camera-ptz-4mp", "cameras-ptz", "product", "ptz", "Dahua", 1899, True,
     "Caméra PTZ 4 MP", "كاميرا PTZ 4 ميغابكسل",
     "Couverture complète avec rotation 360°.", "تغطية كاملة مع دوران 360°.",
     "Résolution 4 MP\nRotation et inclinaison 360°\nVision nocturne jusqu'à 100 m\nSuivi automatique",
     "دقة 4 ميغابكسل\nدوران وإمالة 360°\nرؤية ليلية حتى 100 م\nتتبع تلقائي"),
    ("sonnette-video-connectee", "controle-acces", "product", "doorbell", "EZVIZ", 799, True,
     "Sonnette vidéo connectée", "جرس باب بالفيديو",
     "Voyez, parlez et gardez le contrôle.", "شاهد وتحدث وتحكم عن بعد.",
     "Vidéo HD 1080p\nDétection de mouvement\nAudio bidirectionnel\nStockage cloud",
     "فيديو 1080p\nكشف الحركة\nصوت ثنائي الاتجاه\nتخزين سحابي"),
    ("camera-dome-interieure-4mp", "cameras-interieur", "product", "ptz", "Hikvision", 449, False,
     "Caméra dôme intérieure 4 MP", "كاميرا قبة داخلية 4 ميغابكسل",
     "Discrète, idéale pour commerces et bureaux.", "خفية، مثالية للمحلات والمكاتب.",
     "Résolution 4 MP\nGrand angle 103°\nVision nocturne jusqu'à 30 m\nMicro intégré",
     "دقة 4 ميغابكسل\nزاوية واسعة 103°\nرؤية ليلية حتى 30 م\nميكروفون مدمج"),
    ("camera-exterieure-wifi-couleur", "cameras-wifi", "product", "bullet", "Imou", 549, False,
     "Caméra extérieure Wi-Fi vision couleur", "كاميرا خارجية واي فاي رؤية ملونة",
     "Images en couleur même la nuit.", "صور ملونة حتى في الليل.",
     "Résolution 4 MP\nVision nocturne couleur\nSirène et projecteur intégrés\nIP66",
     "دقة 4 ميغابكسل\nرؤية ليلية بالألوان\nصفارة وكشاف مدمجان\nIP66"),
    ("camera-exterieure-8mp", "cameras-exterieur", "product", "bullet", "Dahua", 1099, False,
     "Caméra extérieure 4K (8 MP)", "كاميرا خارجية 4K (8 ميغابكسل)",
     "Détails nets pour plaques et visages.", "تفاصيل دقيقة للوحات والوجوه.",
     "Résolution 4K\nIP67\nVision nocturne jusqu'à 40 m\nDétection humain / véhicule",
     "دقة 4K\nIP67\nرؤية ليلية حتى 40 م\nكشف الأشخاص والمركبات"),
    ("enregistreur-nvr-4-voies", "enregistreurs", "product", "nvr", "Hikvision", 899, False,
     "Enregistreur NVR 4 voies", "مسجل NVR بـ4 قنوات",
     "Enregistre jusqu'à 4 caméras IP.", "يسجل حتى 4 كاميرات IP.",
     "4 caméras IP\nPoE intégré\nSortie HDMI 4K\nAccès à distance sur mobile",
     "4 كاميرات IP\nPoE مدمج\nمخرج HDMI 4K\nوصول عن بعد عبر الهاتف"),
    ("enregistreur-nvr-8-voies", "enregistreurs", "product", "nvr", "Dahua", 1490, False,
     "Enregistreur NVR 8 voies", "مسجل NVR بـ8 قنوات",
     "Pour les installations de 5 à 8 caméras.", "للتركيبات من 5 إلى 8 كاميرات.",
     "8 caméras IP\nPoE 8 ports\n2 baies disque dur\nAccès à distance sur mobile",
     "8 كاميرات IP\nPoE بـ8 منافذ\nمكانان للأقراص الصلبة\nوصول عن بعد عبر الهاتف"),
    ("disque-dur-surveillance-2to", "enregistreurs", "product", "hdd", "", 690, False,
     "Disque dur surveillance 2 To", "قرص صلب للمراقبة 2 تيرابايت",
     "Conçu pour enregistrer 24h/24.", "مصمم للتسجيل على مدار الساعة.",
     "Capacité 2 To\nUsage 24/7\nEnviron 15 jours pour 4 caméras",
     "سعة 2 تيرابايت\nاستخدام 24/7\nحوالي 15 يومًا لـ4 كاميرات"),
    ("kit-alarme-sans-fil", "alarmes", "product", "alarm", "Hikvision", 2490, False,
     "Kit alarme sans fil", "عدة إنذار لاسلكية",
     "Centrale, détecteurs et sirène prêts à installer.", "لوحة تحكم وأجهزة استشعار وصفارة جاهزة للتركيب.",
     "Centrale Wi-Fi / 4G\n2 détecteurs de mouvement\n1 contact de porte\nAlertes sur l'application",
     "لوحة تحكم واي فاي / 4G\nكاشفا حركة\nمستشعر باب\nتنبيهات عبر التطبيق"),
    ("detecteur-mouvement", "alarmes", "product", "sensor", "Hikvision", 290, False,
     "Détecteur de mouvement sans fil", "كاشف حركة لاسلكي",
     "Complément pour votre kit alarme.", "إضافة لعدة الإنذار.",
     "Portée 12 m\nImmunité animaux\nAutonomie 3 ans",
     "مدى 12 م\nلا يتأثر بالحيوانات الأليفة\nبطارية 3 سنوات"),
    ("sirene-exterieure", "alarmes", "product", "siren", "Hikvision", 590, False,
     "Sirène extérieure avec flash", "صفارة خارجية مع وميض",
     "Dissuasive et visible de loin.", "رادعة ومرئية من بعيد.",
     "110 dB\nFlash LED\nSans fil",
     "110 ديسيبل\nوميض LED\nلاسلكية"),
    ("lecteur-badge-clavier", "controle-acces", "product", "keypad", "Dahua", 790, False,
     "Lecteur badge et code", "قارئ بطاقات ورمز",
     "Ouverture de porte par badge ou code.", "فتح الباب بالبطاقة أو الرمز.",
     "Badges RFID\nClavier rétroéclairé\nJusqu'à 1 000 utilisateurs",
     "بطاقات RFID\nلوحة مفاتيح مضيئة\nحتى 1000 مستخدم"),
    ("pointeuse-empreinte", "controle-acces", "product", "finger", "Hikvision", 1290, False,
     "Pointeuse à empreinte digitale", "جهاز البصمة لتسجيل الحضور",
     "Contrôle d'accès et pointage du personnel.", "التحكم في الولوج وتسجيل حضور الموظفين.",
     "Empreinte, badge et code\nRapports de présence\nÉcran couleur",
     "بصمة وبطاقة ورمز\nتقارير الحضور\nشاشة ملونة"),
    ("interphone-video", "controle-acces", "product", "intercom", "Dahua", 1590, False,
     "Interphone vidéo", "إنترفون بالفيديو",
     "Écran 7 pouces et platine de rue.", "شاشة 7 بوصات ووحدة خارجية.",
     "Écran 7\"\nVision nocturne\nOuverture de porte à distance",
     "شاشة 7 بوصات\nرؤية ليلية\nفتح الباب عن بعد"),
    ("serrure-connectee", "controle-acces", "product", "lock", "EZVIZ", 2290, False,
     "Serrure connectée", "قفل ذكي",
     "Empreinte, code, carte ou téléphone.", "بصمة أو رمز أو بطاقة أو هاتف.",
     "Empreinte digitale\nCode et carte\nOuverture via l'application",
     "بصمة الإصبع\nرمز وبطاقة\nالفتح عبر التطبيق"),
    ("cable-reseau-305m", "accessoires", "product", "cable", "", 790, False,
     "Câble réseau CAT6 (305 m)", "كابل شبكة CAT6 (305 م)",
     "Pour caméras IP et PoE.", "لكاميرات IP و PoE.",
     "CAT6 cuivre\nRouleau de 305 m\nUsage intérieur / extérieur",
     "CAT6 نحاس\nلفة 305 م\nاستخدام داخلي وخارجي"),
    ("alimentation-12v", "accessoires", "product", "cable", "", 120, False,
     "Alimentation 12 V caméra", "محول كهرباء 12 فولت للكاميرا",
     "Bloc d'alimentation pour caméra.", "محول طاقة للكاميرا.",
     "12 V / 2 A\nProtection surtension",
     "12 فولت / 2 أمبير\nحماية من ارتفاع الجهد"),

    # Installation packs (from the work plan; prices are placeholders)
    ("pack-essentiel", None, "pack", "pack", "", 2990, False,
     "Pack Essentiel · 2 caméras", "باقة أساسية · كاميرتان",
     "Appartement, petit commerce.", "شقة، محل صغير.",
     "2 caméras 4 MP\nEnregistreur 4 voies + 1 To\nInstallation et câblage\nApplication sur téléphone",
     "كاميرتان 4 ميغابكسل\nمسجل 4 قنوات + 1 تيرابايت\nالتركيب والأسلاك\nالتطبيق على الهاتف"),
    ("pack-confort", None, "pack", "pack", "", 3790, True,
     "Pack Confort · 3 caméras", "باقة الراحة · 3 كاميرات",
     "Entrée de maison, jardin, garage.", "مدخل المنزل، الحديقة، المرآب.",
     "3 caméras 4 MP\nEnregistreur 4 voies + 1 To\nInstallation et câblage\nApplication sur téléphone",
     "3 كاميرات 4 ميغابكسل\nمسجل 4 قنوات + 1 تيرابايت\nالتركيب والأسلاك\nالتطبيق على الهاتف"),
    ("pack-pro", None, "pack", "pack", "", 4590, False,
     "Pack Pro · 4 caméras", "باقة برو · 4 كاميرات",
     "Villa, café, petit bureau.", "فيلا، مقهى، مكتب صغير.",
     "4 caméras 4 MP\nEnregistreur 4 voies + 2 To\nInstallation et câblage\nApplication sur téléphone",
     "4 كاميرات 4 ميغابكسل\nمسجل 4 قنوات + 2 تيرابايت\nالتركيب والأسلاك\nالتطبيق على الهاتف"),
    ("pack-business", None, "pack", "pack", "", 8490, False,
     "Pack Business · 8 caméras", "باقة الأعمال · 8 كاميرات",
     "Entrepôt, grand magasin.", "مستودع، متجر كبير.",
     "8 caméras 4 MP\nEnregistreur 8 voies + 4 To\nInstallation et câblage\nApplication sur téléphone",
     "8 كاميرات 4 ميغابكسل\nمسجل 8 قنوات + 4 تيرابايت\nالتركيب والأسلاك\nالتطبيق على الهاتف"),

    # Services quoted per site (price empty = on quote)
    ("installation-alarme", "alarmes", "service", "alarm", "", None, False,
     "Installation système d'alarme", "تركيب نظام الإنذار",
     "Étude, fourniture et installation adaptées à votre site.", "دراسة وتوفير وتركيب حسب موقعك.",
     "Visite technique gratuite\nDétecteurs, sirènes, télécommandes\nAlertes sur téléphone\nFormation à l'utilisation",
     "زيارة تقنية مجانية\nكواشف وصفارات وأجهزة تحكم\nتنبيهات على الهاتف\nتدريب على الاستخدام"),
    ("installation-controle-acces", "controle-acces", "service", "keypad", "", None, False,
     "Installation contrôle d'accès", "تركيب نظام التحكم في الولوج",
     "Badges, empreintes, interphones et serrures.", "بطاقات وبصمات وإنترفون وأقفال.",
     "Visite technique gratuite\nBadge, empreinte ou code\nPointage du personnel\nGestion des accès à distance",
     "زيارة تقنية مجانية\nبطاقة أو بصمة أو رمز\nتسجيل حضور الموظفين\nإدارة الولوج عن بعد"),
    ("contrat-maintenance", None, "service", "service", "", None, False,
     "Contrat de maintenance", "عقد الصيانة",
     "Vérification et nettoyage de votre installation.", "فحص وتنظيف منظومتك.",
     "Visites périodiques\nMises à jour et sauvegardes\nIntervention prioritaire",
     "زيارات دورية\nتحديثات ونسخ احتياطي\nتدخل ذو أولوية"),
    ("visite-technique", None, "service", "service", "", 0, False,
     "Visite technique gratuite", "زيارة تقنية مجانية",
     "Un technicien évalue votre site avant le devis.", "تقني يعاين موقعك قبل عرض السعر.",
     "Sans engagement\nConseils sur l'emplacement des caméras\nDevis détaillé",
     "بدون التزام\nنصائح حول أماكن الكاميرات\nعرض سعر مفصل"),
]


class Command(BaseCommand):
    help = "Charge le catalogue de démonstration (produits, packs, services)."

    def handle(self, *args, **options):
        cats = {}
        for i, (slug, group, fr, ar) in enumerate(CATEGORIES):
            cats[slug], _ = Category.objects.get_or_create(
                slug=slug, defaults={"group": group, "name_fr": fr, "name_ar": ar, "order": i})
        created = 0
        for i, row in enumerate(ITEMS):
            (slug, cat, kind, art, brand, price, featured,
             name_fr, name_ar, short_fr, short_ar, specs_fr, specs_ar) = row
            _, was_created = Product.objects.get_or_create(slug=slug, defaults={
                "category": cats.get(cat), "kind": kind, "art": art, "brand": brand,
                "price": price, "featured": featured, "order": i,
                "name_fr": name_fr, "name_ar": name_ar, "short_fr": short_fr, "short_ar": short_ar,
                "specs_fr": specs_fr, "specs_ar": specs_ar,
            })
            created += was_created
        self.stdout.write(self.style.SUCCESS(f"{created} élément(s) ajouté(s)."))
