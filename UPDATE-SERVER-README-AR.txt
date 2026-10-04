حساباتي — التحديث التلقائي عبر GitHub

المستودع:
https://github.com/anamasry816-blip/hesabaty-updates

البرنامج يستخدم GitHub Releases كمصدر رسمي للتحديثات.

طريقة إصدار نسخة جديدة:
1) غيّر version في package.json.
2) حدّث package-lock.json عبر npm install عند الحاجة.
3) اعمل tag للنسخة بصيغة v1.1.6 مثلًا.
4) ارفع الـtag إلى GitHub.
5) GitHub Actions يبني Windows NSIS ويرفع ملفات الإصدار تلقائيًا إلى GitHub Release.
6) النسخ المثبتة تفحص GitHub وتحمّل النسخة الأحدث تلقائيًا.

لا ترفع private-key.pem أو أي مفتاح سري خاص بالتفعيل إلى هذا المستودع.
