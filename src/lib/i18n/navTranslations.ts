// Real translations for the one piece of UI visible on every single
// dashboard page regardless of which section you're in - the nav bar and
// Settings menu. This is deliberately the first place dashboard i18n
// lands, not a stand-in: it's proof, on every page load, that a saved
// language preference does something, not just a value sitting unused in
// the database. English never needs a lookup - it's the key itself.
export type NavLanguageCode = 'ar' | 'ru' | 'es' | 'hi' | 'ur' | 'tl' | 'zh' | 'fr';

const NAV_TRANSLATIONS: Record<string, Record<NavLanguageCode, string>> = {
  'Orders': { ar: 'الطلبات', ru: 'Заказы', es: 'Pedidos', hi: 'ऑर्डर', ur: 'آرڈرز', tl: 'Mga Order', zh: '订单', fr: 'Commandes' },
  'Requests': { ar: 'طلبات الضيوف', ru: 'Запросы', es: 'Solicitudes', hi: 'अनुरोध', ur: 'درخواستیں', tl: 'Mga Kahilingan', zh: '请求', fr: 'Demandes' },
  'Kitchen': { ar: 'المطبخ', ru: 'Кухня', es: 'Cocina', hi: 'रसोई', ur: 'باورچی خانہ', tl: 'Kusina', zh: '厨房', fr: 'Cuisine' },
  'POS Terminal': { ar: 'نقطة البيع', ru: 'Касса', es: 'Terminal POS', hi: 'पीओएस टर्मिनल', ur: 'پی او ایس ٹرمینل', tl: 'POS Terminal', zh: 'POS 终端', fr: 'Terminal de caisse' },
  'Tables': { ar: 'الطاولات', ru: 'Столы', es: 'Mesas', hi: 'टेबल', ur: 'میزیں', tl: 'Mga Mesa', zh: '餐桌', fr: 'Tables' },
  'Front Desk': { ar: 'الاستقبال', ru: 'Стойка регистрации', es: 'Recepción', hi: 'फ्रंट डेस्क', ur: 'فرنٹ ڈیسک', tl: 'Front Desk', zh: '前台', fr: 'Réception' },
  'Housekeeping': { ar: 'التدبير المنزلي', ru: 'Уборка номеров', es: 'Limpieza', hi: 'हाउसकीपिंग', ur: 'ہاؤس کیپنگ', tl: 'Paglilinis', zh: '客房服务', fr: 'Entretien ménager' },
  'Sales & Events': { ar: 'المبيعات والفعاليات', ru: 'Продажи и мероприятия', es: 'Ventas y eventos', hi: 'बिक्री और आयोजन', ur: 'سیلز اور تقریبات', tl: 'Benta at mga Kaganapan', zh: '销售与活动', fr: 'Ventes et événements' },
  'Payments': { ar: 'المدفوعات', ru: 'Платежи', es: 'Pagos', hi: 'भुगतान', ur: 'ادائیگیاں', tl: 'Mga Bayad', zh: '付款', fr: 'Paiements' },
  'Inventory': { ar: 'المخزون', ru: 'Склад', es: 'Inventario', hi: 'इन्वेंटरी', ur: 'انوینٹری', tl: 'Imbentaryo', zh: '库存', fr: 'Inventaire' },
  'Bank Reconciliation': { ar: 'تسوية البنك', ru: 'Банковская сверка', es: 'Conciliación bancaria', hi: 'बैंक मिलान', ur: 'بینک مصالحت', tl: 'Pagkakasundo sa Bangko', zh: '银行对账', fr: 'Rapprochement bancaire' },
  'Business Profile': { ar: 'ملف النشاط التجاري', ru: 'Профиль бизнеса', es: 'Perfil del negocio', hi: 'व्यवसाय प्रोफ़ाइल', ur: 'کاروباری پروفائل', tl: 'Profile ng Negosyo', zh: '企业资料', fr: "Profil de l'entreprise" },
  'Credentials & Integrations': { ar: 'بيانات الاعتماد والتكاملات', ru: 'Учётные данные и интеграции', es: 'Credenciales e integraciones', hi: 'क्रेडेंशियल और इंटीग्रेशन', ur: 'اسناد اور انضمام', tl: 'Kredensyal at Integrasyon', zh: '凭证与集成', fr: 'Identifiants et intégrations' },
  'Contracts & Receipts': { ar: 'العقود والإيصالات', ru: 'Договоры и квитанции', es: 'Contratos y recibos', hi: 'अनुबंध और रसीदें', ur: 'معاہدے اور رسیدیں', tl: 'Kontrata at Resibo', zh: '合同与收据', fr: 'Contrats et reçus' },
  'Change Password': { ar: 'تغيير كلمة المرور', ru: 'Изменить пароль', es: 'Cambiar contraseña', hi: 'पासवर्ड बदलें', ur: 'پاس ورڈ تبدیل کریں', tl: 'Baguhin ang Password', zh: '修改密码', fr: 'Changer le mot de passe' },
  'F&B Outlets & Services': { ar: 'منافذ المطاعم والخدمات', ru: 'Точки питания и услуги', es: 'Puntos de F&B y servicios', hi: 'एफ एंड बी आउटलेट और सेवाएं', ur: 'ایف اینڈ بی آؤٹ لیٹس اور خدمات', tl: 'F&B Outlets at Serbisyo', zh: '餐饮网点与服务', fr: 'Points de restauration et services' },
  'Rate Plans': { ar: 'خطط الأسعار', ru: 'Тарифные планы', es: 'Planes de tarifas', hi: 'रेट प्लान', ur: 'ریٹ پلانز', tl: 'Mga Rate Plan', zh: '房价方案', fr: 'Plans tarifaires' },
  'Night Audit': { ar: 'التدقيق الليلي', ru: 'Ночной аудит', es: 'Auditoría nocturna', hi: 'नाइट ऑडिट', ur: 'نائٹ آڈٹ', tl: 'Night Audit', zh: '夜审', fr: 'Audit de nuit' },
  'POS Integration': { ar: 'تكامل نقطة البيع', ru: 'Интеграция кассы', es: 'Integración POS', hi: 'पीओएस एकीकरण', ur: 'پی او ایس انضمام', tl: 'POS Integration', zh: 'POS 集成', fr: 'Intégration caisse' },
  'HR': { ar: 'الموارد البشرية', ru: 'Кадры', es: 'RR. HH.', hi: 'एचआर', ur: 'ایچ آر', tl: 'HR', zh: '人力资源', fr: 'RH' },
  'Landing Page Buttons': { ar: 'أزرار الصفحة الرئيسية', ru: 'Кнопки главной страницы', es: 'Botones de la página principal', hi: 'लैंडिंग पेज बटन', ur: 'لینڈنگ پیج بٹن', tl: 'Mga Button sa Landing Page', zh: '着陆页按钮', fr: "Boutons de la page d'accueil" },
  'Menu Management': { ar: 'إدارة القائمة', ru: 'Управление меню', es: 'Gestión del menú', hi: 'मेनू प्रबंधन', ur: 'مینو کا انتظام', tl: 'Pamamahala ng Menu', zh: '菜单管理', fr: 'Gestion du menu' },
  'Loyalty': { ar: 'الولاء', ru: 'Лояльность', es: 'Fidelización', hi: 'लॉयल्टी', ur: 'لائلٹی', tl: 'Loyalty', zh: '会员忠诚计划', fr: 'Fidélité' },
  'Cards': { ar: 'البطاقات', ru: 'Карты', es: 'Tarjetas', hi: 'कार्ड', ur: 'کارڈز', tl: 'Mga Card', zh: '卡片', fr: 'Cartes' },
  'Notifications': { ar: 'الإشعارات', ru: 'Уведомления', es: 'Notificaciones', hi: 'सूचनाएं', ur: 'اطلاعات', tl: 'Mga Abiso', zh: '通知', fr: 'Notifications' },
  'Bookings': { ar: 'الحجوزات', ru: 'Бронирования', es: 'Reservas', hi: 'बुकिंग', ur: 'بکنگز', tl: 'Mga Booking', zh: '预订', fr: 'Réservations' },
  'Services': { ar: 'الخدمات', ru: 'Услуги', es: 'Servicios', hi: 'सेवाएं', ur: 'خدمات', tl: 'Mga Serbisyo', zh: '服务', fr: 'Services' },
  'Features': { ar: 'الميزات', ru: 'Функции', es: 'Funciones', hi: 'सुविधाएं', ur: 'خصوصیات', tl: 'Mga Feature', zh: '功能', fr: 'Fonctionnalités' },
  'Audit Log': { ar: 'سجل التدقيق', ru: 'Журнал аудита', es: 'Registro de auditoría', hi: 'ऑडिट लॉग', ur: 'آڈٹ لاگ', tl: 'Audit Log', zh: '审计日志', fr: "Journal d'audit" },
  'Analytics': { ar: 'التحليلات', ru: 'Аналитика', es: 'Analítica', hi: 'एनालिटिक्स', ur: 'تجزیات', tl: 'Analytics', zh: '数据分析', fr: 'Analytique' },
  'Forecasting & Budgeting': { ar: 'التنبؤ والميزانية', ru: 'Прогнозирование и бюджет', es: 'Previsión y presupuesto', hi: 'पूर्वानुमान और बजट', ur: 'پیش گوئی اور بجٹ', tl: 'Forecasting at Badyet', zh: '预测与预算', fr: 'Prévisions et budget' },
  'Staff': { ar: 'الموظفون', ru: 'Персонал', es: 'Personal', hi: 'स्टाफ', ur: 'عملہ', tl: 'Staff', zh: '员工', fr: 'Personnel' },
  'Contact Us': { ar: 'اتصل بنا', ru: 'Связаться с нами', es: 'Contáctenos', hi: 'हमसे संपर्क करें', ur: 'ہم سے رابطہ کریں', tl: 'Makipag-ugnayan', zh: '联系我们', fr: 'Nous contacter' },
  'Settings': { ar: 'الإعدادات', ru: 'Настройки', es: 'Configuración', hi: 'सेटिंग्स', ur: 'ترتیبات', tl: 'Mga Setting', zh: '设置', fr: 'Paramètres' },
  'Sign out': { ar: 'تسجيل الخروج', ru: 'Выйти', es: 'Cerrar sesión', hi: 'साइन आउट', ur: 'سائن آؤٹ', tl: 'Mag-sign Out', zh: '退出登录', fr: 'Se déconnecter' },
};

// Falls back to the original English label for anything not in the
// dictionary above (or for 'en' itself) - never a blank or a raw key
// leaking through.
export function translateNavLabel(label: string, lang: string | undefined): string {
  if (!lang || lang === 'en') return label;
  return NAV_TRANSLATIONS[label]?.[lang as NavLanguageCode] || label;
}
