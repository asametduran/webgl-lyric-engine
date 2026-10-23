export PYTHONUTF8=1
python tools/retry.py en 107 172 "Baby, you deserve better. You deserve someone that loves you right. Better, better. So, wherever you go, whoever you meet, just remember me." > r1.log 2>&1
python tools/retry.py en 0 17 "Baby, you deserve better." > r0.log 2>&1
python tools/retry.py en 165 215 "Oh, baby, one thing I need you to know. Baby, you deserve better. You deserve someone that loves you right. I could love you till the end of time." > r2.log 2>&1
echo ok > retry.done
