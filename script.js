define(['jquery'], function ($) {
    var CustomWidget = function () {
        var self = this;

        self.getBackendUrl = function () {
            if (self.params && self.params.backend_url) {
                return self.params.backend_url.replace(/\/+$/, '');
            }
            return 'http://127.0.0.1:8000';
        };

        self.extractPhone = function () {
            try {
                const card = APP.data.current_card;
                if (!card || !card.contacts || !card.contacts.main_contact) {
                    return null;
                }

                const contact = card.contacts.main_contact;
                if (!contact.custom_fields_values) {
                    return null;
                }

                let phone = null;

                contact.custom_fields_values.forEach(field => {
                    if (field.field_code === 'PHONE' && field.values && field.values.length > 0) {
                        phone = field.values[0].value;
                    }
                });

                if (!phone) return null;

                return phone.replace(/\D/g, '');
            } catch (e) {
                console.error('VizaAssist extractPhone error', e);
                return null;
            }
        };

        self.fetchWithTimeout = async function (url, timeoutMs = 3000) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const response = await fetch(url, {
                    method: 'GET',
                    signal: controller.signal
                });
                clearTimeout(timer);
                return response;
            } catch (e) {
                clearTimeout(timer);
                throw e;
            }
        };

        self.renderWidgetBody = function (data, phone, amoId) {
            let statusClass = 'not_found';
            if (data.status === 'ok') statusClass = 'ok';
            if (data.status === 'warning') statusClass = 'warning';
            if (data.status === 'empty') statusClass = 'empty';

            let html = `
                <div class="vizaassist-widget">
                    <div class="vizaassist-title">VizaAssist</div>
            `;

            if (!data.found) {
                html += `
                    <div class="vizaassist-status not_found">Локальная сделка не найдена</div>
                `;
            } else {
                html += `
                    <div class="vizaassist-status ${statusClass}">
                        Статус: ${data.status}
                    </div>
                    <div class="vizaassist-metric">Заявителей: <b>${data.applicants_count}</b></div>
                    <div class="vizaassist-metric">Документов загружено: <b>${data.documents_uploaded}</b></div>
                    <div class="vizaassist-metric">Предупреждений: <b>${data.warnings_count}</b></div>
                `;
            }

            html += `
                    <button class="vizaassist-btn" id="vizaassist-open-btn">
                        Открыть VizaAssist
                    </button>
                </div>
            `;

            self.$widget.find('.widget_body').html(html);

            $('#vizaassist-open-btn').off('click').on('click', function () {
                try {
                    const link = `vizaassist://open?phone=${phone}&amo_id=${amoId}`;
                    window.location.href = link;
                } catch (e) {
                    console.error('Deep link error', e);
                }
            });
        };

        self.renderError = function (message, phone, amoId) {
            let html = `
                <div class="vizaassist-widget">
                    <div class="vizaassist-title">VizaAssist</div>
                    <div class="vizaassist-error">${message}</div>
            `;

            if (phone) {
                html += `
                    <button class="vizaassist-btn" id="vizaassist-open-btn">
                        Открыть VizaAssist
                    </button>
                `;
            }

            html += `</div>`;

            self.$widget.find('.widget_body').html(html);

            if (phone) {
                $('#vizaassist-open-btn').off('click').on('click', function () {
                    try {
                        const link = `vizaassist://open?phone=${phone}&amo_id=${amoId}`;
                        window.location.href = link;
                    } catch (e) {
                        console.error('Deep link error', e);
                    }
                });
            }
        };

        self.loadSummary = async function () {
            const $widgetBody = self.$widget.find('.widget_body');
            $widgetBody.html('<div class="vizaassist-widget">Загрузка статуса...</div>');

            const phone = self.extractPhone();
            const card = APP.data.current_card;
            const amoId = card && card.id ? card.id : '';

            if (!phone) {
                self.renderError('Телефон контакта не найден', null, amoId);
                return;
            }

            const backendUrl = self.getBackendUrl();

            try {
                const response = await self.fetchWithTimeout(`${backendUrl}/deals/summary/by_phone/${phone}`, 3000);

                if (!response.ok) {
                    self.renderError('Backend вернул ошибку', phone, amoId);
                    return;
                }

                const data = await response.json();
                self.renderWidgetBody(data, phone, amoId);

            } catch (e) {
                console.error('VizaAssist widget fetch error', e);
                self.renderError('Нет связи с локальным приложением', phone, amoId);
            }
        };

        this.callbacks = {
            settings: function () {
                return true;
            },

            init: function () {
                return true;
            },

            bind_actions: function () {
                return true;
            },

            render: function () {
                return true;
            },

            dpSettings: function () {
                return true;
            },

            advancedSettings: function () {
                return true;
            },

            leads: {
                selected: function () {
                    self.loadSummary();
                    return true;
                }
            },

            contacts: {
                selected: function () {
                    self.loadSummary();
                    return true;
                }
            },

            onSave: function () {
                return true;
            },

            destroy: function () {
                return true;
            }
        };

        return this;
    };

    return CustomWidget;
});