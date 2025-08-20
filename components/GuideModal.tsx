'use client';

import React, { useEffect, useRef, useState } from 'react';

const HIDE_KEY = 'mapToCsv_hideGuide';

export default function GuideModal() {
    const [open, setOpen] = useState(false);
    const [dontShow, setDontShow] = useState(false);
    const dialogRef = useRef<HTMLDivElement | null>(null);

    // Show on first load unless user hid it before
    useEffect(() => {
        try {
            const hidden = localStorage.getItem(HIDE_KEY) === 'true';
            if (!hidden) setOpen(true);
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

    // Simple outside click to close
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

    const close = () => {
        if (dontShow) {
            try { localStorage.setItem(HIDE_KEY, 'true'); } catch {}
        }
        setOpen(false);
    };

    if (!open) return null;

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
                dir="rtl"
                lang="ar"
            >
                <div className="flex items-start justify-between gap-3">
                    <h2 id="guide-title" className="text-xl font-semibold">
                        كيفية استخدام الأداة «خريطة ← CSV»
                    </h2>
                    <button
                        aria-label="إغلاق"
                        onClick={close}
                        className="shrink-0 rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100"
                    >
                        ×
                    </button>
                </div>

                <div className="mt-3 text-slate-700 space-y-3 leading-7">
                    <p>
                        هذه الأداة تعمل بقاعدة بسيطة: <strong>حرّك الخريطة لتختار المكان</strong>، ثم
                        <strong> اكتب في الصندوق لتختار الشيء</strong>.
                    </p>

                    <ol className="list-decimal pr-5 space-y-2">
                        <li>
                            <strong>اختر المكان (أين) على الخريطة:</strong> قم بالتحريك والتكبير إلى المنطقة المطلوبة.
                            يتم البحث داخل المستطيل الظاهر فقط. <em>مثال: تريد غزة؟ حرّك الخريطة إلى غزة أولًا.</em>
                        </li>
                        <li>
                            <strong>اكتب ما تريد (ماذا) في الصندوق:</strong> اكتب فئة/كلمة، وليس اسم مكان.
                            أمثلة: «مطعم»، «مستشفى»، «مخبز»، «مدرسة». يمكنك أيضًا استخدام العبرية أو الإنجليزية عند الحاجة.
                        </li>
                        <li>
                            <strong>اضغط “بحث ضمن العرض”:</strong> سترى النتائج على الخريطة وفي الجدول. استخدم “تحميل المزيد”
                            لجلب الصفحة التالية (ما زال داخل نفس العرض).
                        </li>
                        <li>
                            <strong>صدّر ما تراه فقط:</strong> زر «تصدير CSV (ضمن العرض)» ينزل العناصر الموجودة داخل حدود الخريطة
                            حاليًا. يتضمن CSV: الاسم، العنوان، الإحداثيات، <code>place_id</code>، التقييم، عدد المراجعات،
                            الأنواع، الحالة، <strong>الموقع الإلكتروني</strong>، <strong>الهاتف</strong>، ورابط خرائط Google.
                        </li>
                        <li>
                            <strong>بريد لكل عملية بحث (اختياري):</strong> عند التهيئة، يتم إرسال رسالة بريدية بكل بحث مع CSV مرفق.
                        </li>
                    </ol>

                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <p className="font-medium">ملاحظات مهمة</p>
                        <ul className="list-disc pr-5 mt-2 space-y-1">
                            <li>
                                <strong>اللغة</strong> تضبط لغة <em>الإخراج</em> (الأسماء/العناوين عند توفرها)، لكنها لا تترجم
                                استعلامك. استخدم لغة المنطقة للحصول على تطابقات أفضل (مثال: «مستشفى» في مناطق عربية).
                            </li>
                            <li>
                                لا نستخدم <code>region</code>. التقييد الجغرافي يعتمد على <strong>مستطيل العرض</strong> الحالي فقط.
                            </li>
                            <li>
                                لا توجد نتائج؟ جرّب كلمة محلية (مثل «مستشفى»)، كبّر/صغّر الخريطة قليلًا، أو تأكد أنك تقف على المنطقة
                                الصحيحة.
                            </li>
                        </ul>
                    </div>

                    <p className="text-sm text-slate-500">
                        القاعدة الذهبية: <strong>حرّك الخريطة = تحدد المكان. اكتب في الصندوق = تحدد الشيء.</strong>
                    </p>

                    <p className="text-xs text-slate-500">
                        تحتاج مساعدة؟ راسلنا: <a className="text-blue-600 underline" href="mailto:osinthelpil@gmail.com">osinthelpil@gmail.com</a>
                    </p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                        <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-slate-300"
                            checked={dontShow}
                            onChange={(e) => setDontShow(e.target.checked)}
                        />
                        لا تُظهر هذا مرة أخرى
                    </label>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={close}
                            className="rounded-xl bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700"
                        >
                            ابدأ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
