// ==UserScript==
// @name         fill_travel_date
// @namespace    http://tampermonkey.net/
// @version      2025-07-07
// @description  Кнопка "Запросить код" по центру внизу на любой странице + замена текста alert OTP
// @author       You
// @match        https://appointment.blsspainrussia.ru/Global/Appointment/ApplicantSelection*
// @grant        none
// ==/UserScript==

(async function () {
    // === НАСТРОЙКИ ===
    const TELEGRAM_BOT_TOKEN = '7901901530:AAE29WGTOS3s7TBVUmShUEYBkXXPq7Ew1UA';
    const TELEGRAM_CHAT_ID = '{{ TELEGRAM_CHAT_ID }}';
    const USER_NAME = '{{ USER_NAME }}';
    const EMAIL = '{{ EMAIL }}';
    const PASSWORD = '{{ EMAILPASSWORD }}';
    const TRAVEL_DATE = '{{ TRAVEL_DATE }}';
    const apiUrl = "https://firstmail-imap-api.onrender.com/mail";
    const CODE_MAX_AGE_MIN = 7;

    let dateMessageSent = false;
    let otpErrorSent = false; // чтобы не спамить ТГ

    function extractDate() {
        const input = document.querySelector('#ResponseData');
        if (input) {
            const raw = input.value.replace(/&quot;/g, '"');
            const match = raw.match(/\d{4}-\d{2}-\d{2}/);
            return match ? match[0] : TRAVEL_DATE;
        }
        return TRAVEL_DATE;
    }

    async function sendTelegramMessage(text) {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: text,
                    parse_mode: 'HTML'
                })
            });
            const data = await response.json();
            console.log('Сообщение отправлено в Telegram:', data);
        } catch (error) {
            console.error('Ошибка отправки в Telegram:', error);
        }
    }

    async function sendDateTgMessage() {
        if (dateMessageSent) return;
        const date = extractDate();
        const text = `📆 ${USER_NAME} выбрал(а) дату: ${date}`;
        await sendTelegramMessage(text);
        dateMessageSent = true;
    }

    async function sendOtpTgRequest(errorType) {
        if (otpErrorSent) return;
        const date = extractDate();
        const text = `❗️${USER_NAME} не удалось получить/проверить ОТП-код (${errorType})\n\n📧 Почта: ${EMAIL}\n🔐 Пароль: ${PASSWORD}\n📅 Дата записи: ${date}`;
        await sendTelegramMessage(text);
        otpErrorSent = true;
    }

    async function autoClickAgreeButton() {
        const modal = document.getElementById('termsmodal');
        const agreeButton = modal?.querySelector('.btn.btn-primary');
        if (modal && modal.style.display === 'block' && agreeButton) {
            agreeButton.click();
            console.log('Agree в termsmodal — клик!');
            await sendDateTgMessage();
            await waitForTravelDateInput();
        }
    }

    async function waitForTravelDateInput() {
        const interval = setInterval(() => {
            const travelDateInput = document.querySelector('#TravelDate');
            if (travelDateInput && travelDateInput.offsetParent !== null) {
                travelDateInput.value = TRAVEL_DATE;
                travelDateInput.dispatchEvent(new Event('input', { bubbles: true }));
                travelDateInput.dispatchEvent(new Event('change', { bubbles: true }));
                const kendoDatePicker = $(travelDateInput).data('kendoDatePicker');
                if (kendoDatePicker) {
                    kendoDatePicker.value(TRAVEL_DATE);
                    kendoDatePicker.trigger('change');
                }
                travelDateInput.style.display = 'none'; // <-- СКРЫВАЕМ ПОЛЕ
                const parentGroup = travelDateInput.closest('.form-group');
                if (parentGroup) {
                    parentGroup.style.display = 'none'; // <-- СКРЫВАЕМ БЛОК
                }
                console.log('Дата установлена и скрыта:', TRAVEL_DATE);
                clearInterval(interval);
            }
        }, 100);
    }

    autoClickAgreeButton();
    setInterval(autoClickAgreeButton, 2000);
    waitForTravelDateInput();

    // --- Кнопка ---
    function createOtpButton() {
        if (document.getElementById('get-mail-code-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'get-mail-code-btn';
        btn.textContent = 'Запросить код';
        btn.style.position = 'fixed';
        btn.style.left = '50%';
        btn.style.bottom = '32px';
        btn.style.transform = 'translateX(-50%)';
        btn.style.zIndex = 9999999;
        btn.style.padding = '10px 18px';
        btn.style.background = '#157af6';
        btn.style.color = '#fff';
        btn.style.fontSize = '15px';
        btn.style.border = 'none';
        btn.style.borderRadius = '32px';
        btn.style.boxShadow = '0 1px 4px rgba(0,0,0,0.10)';
        btn.style.cursor = 'pointer';
        btn.style.fontWeight = 'bold';
        btn.style.letterSpacing = '0.2px';
        btn.style.width = '140px';
        btn.style.margin = '0';

        btn.onclick = async () => {
            btn.disabled = true;
            btn.textContent = 'Запрос...';

            // Функция для выполнения запроса кода
            const requestCode = async () => {
                try {
                    const resp = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
                    });
                    const data = await resp.json();
                    let codeOk = false, timeMsg = '', code = data.code;
                    if (data.code && data.date) {
                        let date = new Date(data.date);
                        let now = new Date();
                        let diffMs = now - date;
                        let diffMin = diffMs / 1000 / 60;
                        let dateStr = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
                        if (diffMin > CODE_MAX_AGE_MIN) {
                            codeOk = false;
                            timeMsg = `Письмо пришло в ${dateStr}`;
                        } else {
                            codeOk = true;
                            timeMsg = `Пришло: ${dateStr}`;
                        }
                    }
                    return { codeOk, timeMsg, code };
                } catch (e) {
                    return { codeOk: false, timeMsg: '', code: null, error: true };
                }
            };

            // === НОВАЯ ЛОГИКА: до 5 попыток с интервалом 15 сек ===
            const MAX_ATTEMPTS = 5;
            const ATTEMPT_INTERVAL_MS = 20000;

            let finalResult = null;

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                btn.textContent = `Попытка ${attempt}/${MAX_ATTEMPTS}...`;
                const result = await requestCode();

                if (result.codeOk) {
                    showPopupCode(result.code, result.timeMsg);
                    showNotification('Код получен!');
                    // Автовставка кода
                    insertCodeToEmailField(result.code);
                    finalResult = result;
                    break;
                } else {
                    // Неудача на этой попытке
                    if (attempt < MAX_ATTEMPTS) {
                        const reason = result.error ? 'ошибка запроса' : 'кода нет/устарел';
                        showNotification(`Код не найден (${reason}). Следующая попытка через 15 сек...`);
                        btn.textContent = `Ждём 15 сек (${attempt}/${MAX_ATTEMPTS})`;
                        await new Promise(r => setTimeout(r, ATTEMPT_INTERVAL_MS));
                    } else {
                        // После 5-й попытки шлём в ТГ
                        if (result?.error) {
                            await sendOtpTgRequest('ошибка запроса после 5 попыток');
                            showPopupMsg('Ошибка, обратитесь к менеджеру', '');
                            showNotification('Ошибка');
                        } else {
                            await sendOtpTgRequest('нет кода или устарел после 5 попыток');
                            showPopupMsg('Код подтверждения не пришёл, обратитесь к менеджеру', result.timeMsg || '');
                            showNotification('Нет свежего кода');
                        }
                        finalResult = result;
                    }
                }
            }

            btn.disabled = false;
            btn.textContent = 'Запросить код';
        };

        document.body.appendChild(btn);
    }

    function showNotification(msg) {
        let note = document.getElementById('mail-code-note');
        if (!note) {
            note = document.createElement('div');
            note.id = 'mail-code-note';
            note.style.position = 'fixed';
            note.style.top = '50%';
            note.style.left = '50%';
            note.style.transform = 'translate(-50%, -50%)';
            note.style.background = '#ff6b35';
            note.style.color = '#fff';
            note.style.padding = '20px 30px';
            note.style.fontSize = '18px';
            note.style.fontWeight = 'bold';
            note.style.borderRadius = '12px';
            note.style.boxShadow = '0 8px 32px rgba(255, 107, 53, 0.4)';
            note.style.zIndex = 999999;
            note.style.opacity = '0';
            note.style.transition = 'all 0.3s ease';
            note.style.textAlign = 'center';
            note.style.minWidth = '300px';
            note.style.border = '3px solid #fff';
            document.body.appendChild(note);
        }

        note.textContent = msg;
        note.style.opacity = '1';
        note.style.transform = 'translate(-50%, -50%) scale(1.05)';

        setTimeout(() => {
            note.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 200);

        setTimeout(() => {
            note.style.opacity = '0';
            note.style.transform = 'translate(-50%, -50%) scale(0.95)';
        }, 4000);
    }

    // Функция для автоматической вставки кода в поле EmailCode
    function insertCodeToEmailField(code) {
        const emailCodeInput = document.querySelector('#EmailCode');
        if (emailCodeInput) {
            emailCodeInput.value = code;
            emailCodeInput.dispatchEvent(new Event('input', { bubbles: true }));
            emailCodeInput.dispatchEvent(new Event('change', { bubbles: true }));
            console.log('Код автоматически вставлен в поле EmailCode:', code);
        }
    }

    function showPopupCode(code, dateStr) {
        // Автоматически вставляем код в поле EmailCode
        insertCodeToEmailField(code);

        let box = document.getElementById('mail-code-popup');
        if (!box) {
            box = document.createElement('div');
            box.id = 'mail-code-popup';
            box.style.position = 'fixed';
            box.style.top = '0';
            box.style.left = '50%';
            box.style.transform = 'translate(-50%, 0)';
            box.style.background = '#fff';
            box.style.color = '#222';
            box.style.fontSize = '17px';
            box.style.fontWeight = 'bold';
            box.style.padding = '11px 16px 13px 16px';
            box.style.marginTop = '16px';
            box.style.borderRadius = '15px';
            box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)';
            box.style.zIndex = 100000;
            box.style.display = 'flex';
            box.style.flexDirection = 'column';
            box.style.alignItems = 'center';
            box.style.maxWidth = '95vw';
            box.style.wordBreak = 'break-word';
            const close = document.createElement('button');
            close.textContent = '✕';
            close.style.marginTop = '5px';
            close.style.background = 'transparent';
            close.style.color = '#888';
            close.style.border = 'none';
            close.style.fontSize = '17px';
            close.style.cursor = 'pointer';
            close.onclick = () => box.remove();
            box.appendChild(close);
            document.body.appendChild(box);
        } else {
            box.childNodes.forEach(node => { if (node.tagName !== "BUTTON") node.remove(); });
        }
        let dateHtml = dateStr ? `<div style="font-size:12px;color:#555;margin-bottom:4px;">${dateStr}</div>` : '';
        box.innerHTML = dateHtml +
            `<div style="margin-bottom:4px;">Ваш код подтверждения:</div>
             <div style="font-size:21px;letter-spacing:5px;">${code}</div>`;
        const close = document.createElement('button');
        close.textContent = '✕';
        close.style.marginTop = '5px';
        close.style.background = 'transparent';
        close.style.color = '#888';
        close.style.border = 'none';
        close.style.fontSize = '17px';
        close.style.cursor = 'pointer';
        close.onclick = () => box.remove();
        box.appendChild(close);
        box.style.display = 'flex';
    }

    function showPopupMsg(message, dateStr) {
        let box = document.getElementById('mail-code-popup');
        if (!box) {
            box = document.createElement('div');
            box.id = 'mail-code-popup';
            box.style.position = 'fixed';
            box.style.top = '0';
            box.style.left = '50%';
            box.style.transform = 'translate(-50%, 0)';
            box.style.background = '#fff';
            box.style.color = '#d40000';
            box.style.fontSize = '15px';
            box.style.fontWeight = 'bold';
            box.style.padding = '11px 16px 13px 16px';
            box.style.marginTop = '16px';
            box.style.borderRadius = '15px';
            box.style.boxShadow = '0 2px 8px rgba(0,0,0,0.13)';
            box.style.zIndex = 100000;
            box.style.display = 'flex';
            box.style.flexDirection = 'column';
            box.style.alignItems = 'center';
            box.style.maxWidth = '95vw';
            box.style.wordBreak = 'break-word';
            const close = document.createElement('button');
            close.textContent = '✕';
            close.style.marginTop = '5px';
            close.style.background = 'transparent';
            close.style.color = '#888';
            close.style.border = 'none';
            close.style.fontSize = '17px';
            close.style.cursor = 'pointer';
            close.onclick = () => box.remove();
            box.appendChild(close);
            document.body.appendChild(box);
        } else {
            box.childNodes.forEach(node => { if (node.tagName !== "BUTTON") node.remove(); });
        }
        let dateHtml = dateStr ? `<div style="font-size:12px;color:#555;margin-bottom:4px;">${dateStr}</div>` : '';
        box.innerHTML = dateHtml + `<div style="margin-bottom:4px;">${message}</div>`;
        const close = document.createElement('button');
        close.textContent = '✕';
        close.style.marginTop = '5px';
        close.style.background = 'transparent';
        close.style.color = '#888';
        close.style.border = 'none';
        close.style.fontSize = '17px';
        close.style.cursor = 'pointer';
        close.onclick = () => box.remove();
        box.appendChild(close);
        box.style.display = 'flex';
    }

    // --- ЗАМЕНА ТЕКСТА ALERT ОТП ---
    function replaceOtpAlertText() {
        document.querySelectorAll('.alert.alert-warning.text-center').forEach(div => {
            if (/An OTP has been sent to your registered email/i.test(div.textContent)) {
                div.innerHTML = 'ВСТАВЬТЕ КОД ОТП ИЗ 6 ЦИФР <span class="required">*</span>';
            }
        });
    }

    setTimeout(createOtpButton, 10000);

    // --- Авто-клик модалки загрузки фото ---
    let isAgreeButtonClicked = false;
    async function autoClickAgreeButtonInPhotoUploadModal() {
        const modal = document.getElementById('photoUploadModal');
        const agreeButton = modal?.querySelector('.btn.btn-primary');
        if (modal && modal.style.display === 'block' && agreeButton) {
            agreeButton.click();
            isAgreeButtonClicked = true;
            console.log('Кнопка согласия в photoUploadModal нажата.');
        }
    }
    setInterval(autoClickAgreeButtonInPhotoUploadModal, 500);

    async function executeActionsSequentially() {
        try {
            while (!isAgreeButtonClicked) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            console.log('Начинаем действия после подтверждения в фото модальном окне');
            await new Promise(resolve => setTimeout(resolve, 2000));
            const radioButton = document.querySelector('.rdo-applicant');
            if (radioButton && radioButton.offsetParent !== null) {
                radioButton.click();
                console.log('Радиокнопка нажата.');
            } else {
                console.warn('Радиокнопка не найдена.');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
            const submitButton = document.getElementById('btnSubmit');
            if (submitButton && submitButton.offsetParent !== null) {
                submitButton.click();
                console.log('Кнопка Submit нажата.');
            } else {
                console.warn('Кнопка Submit не найдена.');
            }
        } catch (error) {
            console.error('Ошибка выполнения действий:', error);
        }
    }

    executeActionsSequentially();

    // === ОТСЛЕЖИВАНИЕ ОШИБКИ "Please enter correct email OTP" ===
    function watchOtpError() {
        if (otpErrorSent) return;
        const selector = '.validation-summary.validation-summary-errors ul li';
        const li = document.querySelector(selector);
        if (
            li &&
            /Please enter correct email OTP/i.test(li.textContent)
        ) {
            sendOtpTgRequest('неверный код ОТП');
            showNotification('Отправлено в Telegram: ошибка кода ОТП');
        }
    }

    setInterval(watchOtpError, 2000);
    window.addEventListener('DOMContentLoaded', watchOtpError);

    // --- Запускаем замену alert
    replaceOtpAlertText();
    setInterval(replaceOtpAlertText, 1000);

})();
