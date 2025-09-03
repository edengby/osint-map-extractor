'use client';

import React, { useEffect, useRef, useState } from 'react';

const HIDE_KEY = 'mapToCsv_hideGuide2';
const LANG_KEY = 'mapToCsv_guideLang2';

type Lang = 'he' | 'ar';

const t = {
    he: {
        title: 'איך להשתמש בכלי «מפה ← CSV»',
        rule: 'הכלי עובד לפי כלל פשוט:',
        ruleStrong1: 'הזיזו את המפה כדי לבחור מקום',
        ruleStrong2: 'ואז כתבו בתיבה כדי לבחור מה מחפשים',
        steps: {
            s1: 'בחרו את המקום (איפה) על המפה: גררו וזַמְּנוּ (Zoom) לאזור הרצוי. החיפוש מתבצע רק בתוך המלבן שמופיע. דוגמה: רוצים עזה? הזיזו את המפה לעזה תחילה.',
            s2: 'כתבו מה מחפשים (מה) בתיבה: הקלידו קטגוריה/מילת חיפוש, לא שם מקום. דוגמאות: «מסעדה», «בתי חולים», «מאפייה», «בית ספר». אפשר גם בערבית או באנגלית לפי האזור.',
            s3: 'לחצו “חיפוש בתחומי התצוגה”: תראו את התוצאות על המפה וברשימה. “טען עוד” יביא עמוד נוסף (עדיין באותו תחום תצוגה).',
            s4: 'ייצוא של מה שרואים: “ייצוא CSV (בתצוגה)” יוריד רק את הפריטים שנמצאים בתוך גבולות המפה כרגע. ה-CSV כולל: שם, כתובת, קואורדינטות, place_id, דירוג, מספר ביקורות, סוגים, סטטוס, אתר, טלפון וקישור ל-Google Maps.',
            s5: 'דוא"ל על כל חיפוש (אופציונלי): אם הופעל, תישלח הודעת דוא"ל על כל חיפוש עם CSV מצורף.',
        },
        notesTitle: 'מנקודות חשובות',
        notes: {
            n1: '“שפה” קובעת את שפת היציאה (שמות/כתובות כשזמינים) — היא לא מתרגמת את החיפוש. השתמשו בשפת האזור לקבלת התאמות טובות יותר (למשל «مستشفى»).',
            n2: 'אין שימוש ב-region. ההגבלה הגאוגרפית נקבעת לפי מלבן התצוגה בלבד.',
            n3: 'אין תוצאות? נסו מילה מקומית («مستشفى»/“hospital”), שנו מעט את הזום, או ודאו שהמפה ממוקדת באזור הנכון.',
        },
        golden: 'כלל זהב: מזיזים את המפה = בוחרים מקום. כותבים בתיבה = בוחרים מה.',
        help: 'צריכים עזרה? כתבו לנו:',
        dontShow: 'אל תציג שוב',
        start: 'התחל',
        langToggleTitle: 'החלפת שפה',
        langToggleLabel: (to: 'he' | 'ar') => (to === 'he' ? 'עברית' : 'العربية'),
    },
    ar: {
        title: 'كيفية استخدام الأداة «خريطة ← CSV»',
        rule: 'قاعدة بسيطة:',
        ruleStrong1: 'حرّك الخريطة لتختار المكان',
        ruleStrong2: 'ثم اكتب في الصندوق لتختار الشيء',
        steps: {
            s1: 'اختر المكان (أين) على الخريطة: حرّك وكبّر/صغّر إلى المنطقة المطلوبة. يتم البحث داخل المستطيل الظاهر فقط. مثال: تريد غزة؟ حرّك الخريطة إلى غزة أولًا.',
            s2: 'اكتب ما تريد (ماذا) في الصندوق: اكتب فئة/كلمة، وليس اسم مكان. أمثلة: «مطعم»، «مستشفى»، «مخبز»، «مدرسة». يمكنك استخدام العبرية أو الإنجليزية عند الحاجة.',
            s3: 'اضغط «بحث ضمن العرض»: سترى النتائج على الخريطة وفي الجدول. استخدم «تحميل المزيد» لجلب الصفحة التالية (ما زال داخل نفس العرض).',
            s4: 'صدّر ما تراه فقط: زر «تصدير CSV (ضمن العرض)» ينزّل العناصر الموجودة داخل حدود الخريطة حاليًا. يتضمن CSV: الاسم، العنوان، الإحداثيات، place_id، التقييم، عدد المراجعات، الأنواع، الحالة، الموقع الإلكتروني، الهاتف، ورابط خرائط Google.',
            s5: 'بريد لكل عملية بحث (اختياري): عند التهيئة، يتم إرسال رسالة بريدية بكل بحث مع CSV مرفق.',
        },
        notesTitle: 'ملاحظات مهمة',
        notes: {
            n1: '«اللغة» تضبط لغة الإخراج (الأسماء/العناوين عند توفرها) — لا تترجم الاستعلام. استخدم لغة المنطقة للحصول على تطابقات أفضل (مثل «مستشفى»).',
            n2: 'لا نستخدم region. التقييد الجغرافي يعتمد على مستطيل العرض فقط.',
            n3: 'لا توجد نتائج؟ جرّب كلمة محلية («مستشفى»/“hospital”)، غيّر مستوى التكبير قليلًا، أو تأكد أنك في المنطقة الصحيحة.',
        },
        golden: 'القاعدة الذهبية: حرّك الخريطة = تحدد المكان. اكتب في الصندوق = تحدد الشيء.',
        help: 'تحتاج مساعدة؟ راسلنا:',
        dontShow: 'لا تُظهر هذا مرة أخرى',
        start: 'ابدأ',
        langToggleTitle: 'تبديل اللغة',
        langToggleLabel: (to: 'he' | 'ar') => (to === 'he' ? 'עברית' : 'العربية'),
    },
} satisfies Record<Lang, any>;

export default function GuideModal() {
    const [open, setOpen] = useState(false);
    const [dontShow, setDontShow] = useState(false);
    const [lang, setLang] = useState<Lang>('he');
    const dialogRef = useRef<HTMLDivElement | null>(null);

    // Initial load: open unless hidden; pick saved or auto language
    useEffect(() => {
        try {
            const hidden = localStorage.getItem(HIDE_KEY) === 'true';
            if (!hidden) setOpen(true);
            const savedLang = localStorage.getItem(LANG_KEY) as Lang | null;
            if (savedLang === 'he' || savedLang === 'ar') {
                setLang(savedLang);
            } else {
                const prefs = navigator.languages || [navigator.language || 'he'];
                const foundAr = prefs.some((p) => /^ar\b/i.test(p));
                const foundHe = prefs.some((p) => /^he\b/i.test(p));
                setLang(foundHe ? 'he' : foundAr ? 'ar' : 'he');
            }
        } catch {
            // ignore
        }
    }, []);

    // Close on Escape
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setOpen(false);
        }
        if (open) document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    // Outside click to close
    useEffect(() => {
        function onClick(e: MouseEvent) {
            if (!open) return;
            if (dialogRef.current && e.target instanceof Node && !dialogRef.current.contains(e.target)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);

    const switchLang = () => {
        const next: Lang = lang === 'he' ? 'ar' : 'he';
        setLang(next);
        try { localStorage.setItem(LANG_KEY, next); } catch {}
    };

    const close = () => {
        try {
            localStorage.setItem(LANG_KEY, lang);
            if (dontShow) localStorage.setItem(HIDE_KEY, 'true');
        } catch {}
        setOpen(false);
    };

    if (!open) return null;

    const tr = t[lang];

    return (
        <div
            className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-sm grid place-items-center px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
        >
            <div
                ref={dialogRef}
                className="w-full max-w-2xl rounded-2xl bg-white shadow-xl border border-slate-200 p-5 sm:p-6"
                dir="rtl" // both he/ar are RTL
                lang={lang}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                    <h2 id="guide-title" className="text-xl font-semibold">
                        {tr.title}
                    </h2>

                    <div className="flex items-center gap-2">
                        {/* NEW: single toggle button to switch between Arabic & Hebrew */}
                        <button
                            type="button"
                            onClick={switchLang}
                            title={tr.langToggleTitle}
                            className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-100"
                        >
                            {tr.langToggleLabel(lang === 'he' ? 'ar' : 'he')}
                        </button>

                        <button
                            aria-label="Close"
                            onClick={close}
                            className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                            title="Close"
                        >
                            ×
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="mt-3 text-slate-700 space-y-3 leading-7">
                    <p>
                        {tr.rule}{' '}
                        <strong>{tr.ruleStrong1}</strong>
                        {' , '}
                        <strong>{tr.ruleStrong2}</strong>.
                    </p>

                    <ol className="list-decimal pr-5 space-y-2">
                        <li>{tr.steps.s1}</li>
                        <li>{tr.steps.s2}</li>
                        <li>{tr.steps.s3}</li>
                        <li>{tr.steps.s4}</li>
                        <li>{tr.steps.s5}</li>
                    </ol>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="font-medium">{tr.notesTitle}</p>
                        <ul className="list-disc pr-5 mt-2 space-y-1">
                            <li>{tr.notes.n1}</li>
                            <li>{tr.notes.n2}</li>
                            <li>{tr.notes.n3}</li>
                        </ul>
                    </div>

                    <p className="text-sm text-slate-500">{tr.golden}</p>

                    <p className="text-xs text-slate-500">
                        {tr.help}{' '}
                        <a className="text-blue-600 underline" href="mailto:osinthelpil@gmail.com">
                            osinthelpil@gmail.com
                        </a>
                    </p>
                </div>

                {/* Footer */}
                <div className="mt-5 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={dontShow}
                            onChange={(e) => setDontShow(e.target.checked)}
                        />
                        {tr.dontShow}
                    </label>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={close}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
                        >
                            {tr.start}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
