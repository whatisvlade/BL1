// ==UserScript==
// @name         New Userscript
// @namespace    http://tampermonkey.net/
// @version      2025-06-22
// @description  try to take over the world!
// @author       You
// @match        https://appointment.blsspainrussia.ru/Global/newcaptcha/logincaptcha*
// @match        https://appointment.blsspainrussia.ru/Global/NewCaptcha/LoginCaptcha*
// @match        https://belarus.blsspainglobal.com/Global/newcaptcha/logincaptcha*
// @match        https://belarus.blsspainglobal.com/Global/NewCaptcha/LoginCaptcha*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Устанавливаем масштаб страницы для мобильного
    const meta = document.createElement('meta');
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(meta);
})();
