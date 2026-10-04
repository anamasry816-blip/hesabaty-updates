@echo off
setlocal
cd /d "%~dp0"
echo ========================================
echo   حساباتي - بناء نسخة Windows
========================================
echo.
echo [1/2] تثبيت الحزم...
call npm ci
if errorlevel 1 goto :err

echo.
echo [2/2] بناء Setup...
call npm run dist -- --publish never
if errorlevel 1 goto :err

echo.
echo تم بناء حساباتي. افتح مجلد dist.
pause
exit /b 0
:err
echo.
echo حدث خطأ أثناء البناء.
pause
exit /b 1
