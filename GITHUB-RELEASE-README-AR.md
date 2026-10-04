# نظام تحديث حساباتي عبر GitHub

المستودع الخاص بالتحديثات:
https://github.com/anamasry816-blip/hesabaty-updates

## إصدار جديد
1. غيّر رقم `version` في `package.json`، ثم حدّث `package-lock.json` بالطريقة الطبيعية عبر `npm install` إذا لزم.
2. اعمل commit ثم tag مثل `v1.1.6`.
3. ارفع الـtag إلى GitHub.
4. GitHub Actions سيبني Windows NSIS ويرفع ملفات الإصدار إلى GitHub Release تلقائيًا.
5. النسخ المثبتة من حساباتي ستفحص GitHub وتحمّل الإصدار الجديد تلقائيًا.

## مهم
لا ترفع مفاتيح التفعيل السرية أو `private-key.pem` إلى هذا المستودع.
