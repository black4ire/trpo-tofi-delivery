const MODE = 'DEV';

const host =  window.location.protocol + "//" + window.location.host;
const devApiHost = 'http://localhost';
const prodApiHost = 'http://134.125.44.31';
const apiHost = (MODE === 'DEV') ? devApiHost : prodApiHost;

// Создание HTML-элементов из строки
function createElementFromHTML(htmlString) {
    var div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
}
// Проверка на пустой объект
function isEmptyObject(obj) {
    return (obj && Object.keys(obj).length === 0
        && Object.getPrototypeOf(obj) === Object.prototype);
}
const handleFetchError = async (response) => {
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok) {
        const errmsg = json.errors[0]
        // создаём исключением и записываем туда сообщение об ошибке, если статус не 2хх
        let err = new Error("HTTP status code: " + response.status + "\nMessage: " + errmsg)
        err.response = response
        err.status = response.status
        throw err
    }
    return json;
}
// Конфигурация для календаря
const flatpickrConfig = {
    locale: "ru",
    enableTime: true,
    dateFormat: "Y-m-d H:i",
    altInput: true,
    altFormat: "F j, Y (H:i)"
};
// Формат вывода даты и времени
const dateOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
}
// Инициализация инпутов с календарём
function initFlatpickr () {
    flatpickr("#time-to-pickup", flatpickrConfig);
    flatpickr("#time-to-deliver", flatpickrConfig);
}
function showToast(isError, payload) {
    let toast;
    if (isError){
        toast = document.querySelector('.toast--error');
    } else {
        toast = document.querySelector(".toast--ok");
    }
    toast.innerHTML = payload;
    toast.classList.add("toast--active");
    setTimeout(() => {
        toast.classList.remove("toast--active");
    }, 5000);
}
// Выбор контента, который нужно отобразить на странице
function flipContent(contentId, additionalCallback=null, disablePrefetch=false) {
    const sidebarList = document.querySelector('.sidebar__list');
    const contentContainer = document.querySelector('.content--container');
    sidebarList.querySelectorAll('.sidebar__list__item').forEach((sidebarListItem) => {
        sidebarListItem.classList.remove('sidebar__list__item--active');
    });
    contentContainer.querySelectorAll('.content').forEach((item) => {
        item.classList.remove('content--active');
    });
    const contentItem = contentContainer.querySelector(`#${contentId}`);
    contentItem.classList.add('content--active');
    if (!disablePrefetch) prefetchDataForContent(contentId);
    const sidebarListItem = sidebarList.querySelector(`.sidebar__list__item[data-content-id=${contentId}]`);
    sidebarListItem.classList.add('sidebar__list__item--active');
    // выполняем доп. действия, если они были переданы
    if (additionalCallback !== null) additionalCallback();
}



// Вытащить данные с бэка перед отображением контента
function prefetchDataForContent(contentId) {
    if (contentId === 'my-workspace') {
        const profileUpdateForm = document.querySelector('#profile-update-form');
        let url = `${apiHost}/api/profile/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
        }})
        .then(handleFetchError)
        .then(response_data => {
            profileUpdateForm.querySelector('#phone').setAttribute('value', response_data.phone); 
            profileUpdateForm.querySelector('#fullName').setAttribute('value', response_data.fullName);
            profileUpdateForm.querySelector('#email').setAttribute('value', response_data.email);
            profileUpdateForm.parentElement.querySelector('.balance').textContent = `${response_data.balance} BYN`;
        })
        .catch(err => {
            showToast(true, err.message);
            throw err;
        });
        // загружаем историю транзакций
        const transactionList = document.querySelector('.my-transactions');
        url = `${apiHost}/api/profile/transactions/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
        }})
        .then(handleFetchError)
        .then(response_data => {
            const tableHeader = transactionList.querySelector('.my-transactions__table-header');
            console.log(response_data);
            response_data.forEach((data_entry) => {
                const htmlString = `
                <li class="my-transactions__item">
                    <p class="transaction-date">${(new Date(data_entry.timeHappened)).toLocaleDateString('ru-RU', dateOptions)}</p>
                    <p class="transaction-desc">${data_entry.description}</p>
                    <p class="transaction-sum">${(data_entry.cost.toString()[0] === '-' ? "" : "+") + data_entry.cost} BYN</p>
                </li>
                `;
                elem = createElementFromHTML(htmlString.trim());
                tableHeader.insertAdjacentElement('afterend', elem);
            })
        })
        .catch(err => {
            showToast(true, err.message);
            throw err;
        });
        transactionList.querySelectorAll('li').forEach((listItem) => listItem.remove());
    }
    else if (contentId === 'my-orders-list') {
        const url = `${apiHost}/api/customer/my-orders/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            }})
        .then(handleFetchError)
        .then(response_data => {
            const orderList = response_data;
            const orderListUL = document.querySelector('#my-orders-list .order-list');
            orderListUL.innerHTML = "";
            orderList.forEach(order => {
                const listItem = createElementFromHTML(`
                <li class="order-list__item" data-order-id=${order.id}>
                    <div class="order-list__item--header">
                        <div class="order-list__item__name">${order.name}</div>
                        <div class="order-list__item__weight">Вес: ${order.weight} кг</div>
                        <div class="order-list__item__action-item--container">
                            <button class="order-list__item__action-item"><i class="fas fa-caret-down"></i></button>
                            ${order.canEdit 
                                ? 
                                `<button class="order-list__item__action-item"><i class="far fa-edit"></i></button>
                                <button class="order-list__item__action-item"><i class="fas fa-trash"></i></button>`
                                : ""
                            }
                        </div>
                    </div>
                    <div class="order-list__item__price">Цена: ${order.price} BYN</div>
                    <div class="order-list__item__sender">Отправитель: ${order.sender}</div>
                    <div class="order-list__item__courier-payment">Оплата курьера: ${order.courierPayment} BYN</div>
                    <div class="order-list__item__recipient">Получатель: ${order.recipient}</div>
                    <hr class="order-list__item--inside-separator">
                    <div class="order-list__item__address-from">Откуда: ${order.addressFrom}</div>
                    <div class="order-list__item__time-to-pickup">Забрать: ${(new Date(order.timeToPickup)).toLocaleDateString('ru-RU', dateOptions)}</div>
                    <div class="order-list__item__address-to">Куда: ${order.addressTo}</div>
                    <div class="order-list__item__time-to-deliver">Время доставки: ${(new Date(order.timeToDeliver)).toLocaleDateString('ru-RU', dateOptions)}</div>
                    <div class="order-list__item__status" style="color: ${order.canEdit ?  "rgb(255, 81, 54)" : "rgb(82, 255, 94)"};">
                        Статус: ${order.canEdit ? "Ищем курьера..." : "Курьер нашёлся."}
                    </div>
                    <div class="order-list__item__detail">...</div>
                </li>`);
                orderListUL.appendChild(listItem);
                orderListUL.childNodes.forEach((listItem) => {
                    const url = `${apiHost}/api/customer/my-orders/${listItem.dataset.orderId}/`;
                    fetch (url, {
                        method: 'GET',
                        headers: {
                            "Content-Type": 'application/json',
                            "Authorization": `JWT ${localStorage.getItem('access')}`
                    }})
                    .then(handleFetchError)
                    .then(response_data => {
                        const detail = response_data.detail;
                        listItem.querySelector('.order-list__item__detail').textContent = detail;
                    })
                    .catch(err => {
                        showToast(true, err.message);
                    })
                })
            });
            myOrderListActivate();
        })
        .catch(err => {
            showToast(true, err.message);
            throw err
        });
    }
    else if (contentId === 'order-history') {
        const url = `${apiHost}/api/customer/my-orders/history/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            }})
        .then(handleFetchError)
        .then(response_data => {
            const orderList = response_data;
            const orderListUL = document.querySelector('#order-history .order-list');
            orderListUL.innerHTML = "";
            orderList.forEach(order => {
                const listItem = createElementFromHTML(`
                <li class="order-list__item">
                    <div class="order-list__item--header">
                        <div class="order-list__item__name">${order.name}</div>
                        <div class="order-list__item__weight">Вес: ${order.weight} кг</div>
                    </div>
                    <div class="order-list__item__price">Цена: ${order.price} BYN</div>
                    <div class="order-list__item__sender">Отправитель: ${order.sender}</div>
                    <div class="order-list__item__courier-payment">Оплата курьера: ${order.courierPayment} BYN</div>
                    <div class="order-list__item__recipient">Получатель: ${order.recipient}</div>
                    <hr class="order-list__item--inside-separator">
                    <div class="order-list__item__address-from">Откуда: ${order.addressFrom}</div>
                    <div class="order-list__item__time-to-pickup">Забрать: ${(new Date(order.timeToPickup)).toLocaleDateString('ru-RU', dateOptions)}</div>
                    <div class="order-list__item__address-to">Куда: ${order.addressTo}</div>
                    <div class="order-list__item__time-to-deliver">Время доставки: ${(new Date(order.timeToDeliver)).toLocaleDateString('ru-RU', dateOptions)}</div>
                    <div class="order-list__item__detail">${order.detail}</div>
                </li>`);
                orderListUL.appendChild(listItem);
            });
        })
        .catch(err => {
            showToast(true, err.message);
            throw err;
        });
    }
    else {
        // два разных действия для создания и обновления
        const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
        if (orderCreateUpdateForm.dataset.action === 'create') {
            // зачищаем инпуты формы
            orderCreateUpdateForm.querySelectorAll('input').forEach((input) => {
                input.removeAttribute('value');
            })
            orderCreateUpdateForm.querySelector('textarea').value = '';
        } else {
            const orderId = orderCreateUpdateForm.dataset.orderId;
            const url = `${apiHost}/api/customer/my-orders/${orderId}/`;
            fetch (url, {
                method: 'GET',
                headers: {
                    "Content-Type": 'application/json',
                    "Authorization": `JWT ${localStorage.getItem('access')}`
            }})
            .then(handleFetchError)
            .then(response_data => {
                orderCreateUpdateForm.querySelector('#name').value = response_data.name;
                orderCreateUpdateForm.querySelector('#weight').value = response_data.weight;
                orderCreateUpdateForm.querySelector('#price').value = response_data.price;
                orderCreateUpdateForm.querySelector('#courier-payment').value = response_data.courierPayment;
                orderCreateUpdateForm.querySelector('#address-from').value = response_data.addressFrom;
                orderCreateUpdateForm.querySelector('#address-to').value = response_data.addressTo;
                orderCreateUpdateForm.querySelector('#receiver-phone').value = response_data.recipient.split(" ")[1];
                orderCreateUpdateForm.querySelector('#description').value = response_data.detail;
            })
            .catch(err => {
                showToast(true, err.message);
                throw err;
            });
        }
    }
}



// Создание заказа на бэке
async function addNewOrder() {
    const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
    const url = `${apiHost}/api/customer/my-orders/`;
    let body = {
        name: orderCreateUpdateForm.querySelector('#name').value,
        weight: orderCreateUpdateForm.querySelector('#weight').value,
        price: orderCreateUpdateForm.querySelector('#price').value,
        courierPayment: orderCreateUpdateForm.querySelector('#courier-payment').value,
        addressFrom: orderCreateUpdateForm.querySelector('#address-from').value,
        addressTo: orderCreateUpdateForm.querySelector('#address-to').value,
        detail: orderCreateUpdateForm.querySelector('#description').value,
        recipient: orderCreateUpdateForm.querySelector('#receiver-phone').value,
        timeToPickup: orderCreateUpdateForm.querySelector('#time-to-pickup').value,
        timeToDeliver: orderCreateUpdateForm.querySelector('#time-to-deliver').value,
    };
    body = JSON.stringify(body);
    await fetch(url, {
        method: 'POST',
        headers: {
            "Content-Type": 'application/json',
            "Authorization": `JWT ${localStorage.getItem('access')}`
        },
        body: body
    })
    .then(handleFetchError)
    .then(response_data => {
        showToast(false, "Добавлен новый заказ!");
        prefetchDataForContent('my-orders-list');
    })
    .catch(err => {
        showToast(true, err.message);
        throw err
    });
}
// Обновление заказа на бэке
async function updateMyOrder() {
    const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
    const url = `${apiHost}/api/customer/my-orders/${orderCreateUpdateForm.dataset.orderId}/`;
    let body = {
        name: orderCreateUpdateForm.querySelector('#name').value,
        weight: orderCreateUpdateForm.querySelector('#weight').value,
        price: orderCreateUpdateForm.querySelector('#price').value,
        courierPayment: orderCreateUpdateForm.querySelector('#courier-payment').value,
        addressFrom: orderCreateUpdateForm.querySelector('#address-from').value,
        addressTo: orderCreateUpdateForm.querySelector('#address-to').value,
        detail: orderCreateUpdateForm.querySelector('#description').value,
        recipient: orderCreateUpdateForm.querySelector('#receiver-phone').value,
    };
    body = JSON.stringify(body);
    await fetch(url, {
        method: 'PATCH',
        headers: {
            "Content-Type": 'application/json',
            "Authorization": `JWT ${localStorage.getItem('access')}`
        },
        body: body
    })
    .then(handleFetchError)
    .then(response_data => {
        showToast(false, "Ваш заказ успешно обновлён!");  
        prefetchDataForContent('my-orders-list');
    })
    .catch(err => {
        showToast(true, err.message);
        throw err;
    });
}


// активация кнопок каждого заказа на контенте "Мои заказы"
function myOrderListActivate () {
    const freeOrderList = document.querySelector('#my-orders-list .order-list');
    freeOrderList.querySelectorAll('.order-list__item').forEach((listItem) => {
        listItem.querySelector('.fa-caret-down').parentElement.addEventListener('click', (e) => {
            // Отобразить описание заказа
            e.currentTarget.classList.toggle('order-list__item__action-item--active');
            if (e.currentTarget.classList.contains('order-list__item__action-item--active')) {
                listItem.querySelector('.order-list__item__detail').style.display = 'block';
            } else {
                listItem.querySelector('.order-list__item__detail').style.display = 'none';
            }
        });
        listItem.querySelector('.fa-edit')?.parentElement.addEventListener('click', (e) => {
            // открываем форму в режиме апдейта
            const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
            orderCreateUpdateForm.setAttribute('data-action', 'update');
            orderCreateUpdateForm.setAttribute('data-order-id', listItem.dataset.orderId);
            orderCreateUpdateFormActivate();
            flipContent('create-update-order');
        });
        listItem.querySelector('.fa-trash')?.parentElement.addEventListener('click', (e) => {
            // удаление заказа с подтверждением
            let result = confirm('Вы действительно хотите удалить этот заказ?');
            if (result == true) {
                const url = `${apiHost}/api/customer/my-orders/${listItem.dataset.orderId}/`;
                fetch(url, {
                    method: 'DELETE',
                    headers: {
                        "Content-Type": 'application/json',
                        "Authorization": `JWT ${localStorage.getItem('access')}`
                }})
                .then(handleFetchError)
                .then(response_data => {
                    showToast(false, "Заказ успешно удалён!");
                    listItem.remove();
                })
                .catch(err => {
                    showToast(true, err.message);
                });
            }
        });
    });
}
// активация сайдбара
function sidebarActivate() {
    const sidebarList = document.querySelector('.sidebar__list');
    sidebarList.querySelectorAll('.sidebar__list__item').forEach((sidebarListItem) => {
        sidebarListItem.addEventListener('click', (e) => {
            const contentId = sidebarListItem.getAttribute('data-content-id');
            if (contentId === 'create-update-order') {
                const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
                orderCreateUpdateForm.dataset.action = 'create';
                prepareForm(orderCreateUpdateForm);
            }
            flipContent(contentId);
        });
    });
}
// Подготовка формы заказа перед отображением на экран
function prepareForm(form) {
    const action = form.dataset.action;
    // динамическая цена
    form.querySelector('#weight').addEventListener('change', (e) => {
        const newValue = parseInt(e.target.value, 10);
        const priceInput = form.querySelector('#price');
        if (newValue > 0 && newValue <= 15) {
            priceInput.value = newValue * 0.75;
        } else {
            priceInput.value = 0;
        } 
    });
    // подготовка формы
    if (action === 'update') {
        if (form.getAttribute('data-order-id') === null){
            throw new Error('data-order-id is not defined on form!');
        }
        form.querySelector('#time-to-pickup')?.parentElement.remove();
        form.querySelector('#time-to-deliver')?.parentElement.remove();
        form.querySelector('.submit-btn').textContent = 'Обновить';
        form.querySelector('h2').textContent = 'Изменение информации о заказе';
    } else {
        if (form.getAttribute('data-order-id') !== null){
            form.removeAttribute('data-order-id');
        }
        const htmlString = `
        <div class="input-group">
            <label for="time-to-pickup" class="textlabel">Забрать</label>
            <input type="datetime-local" required class="flatpickr flatpickr-input" name="time-to-pickup" id="time-to-pickup" placeholder="Выберите дату и время">
        </div>
        <div class="input-group">
            <label for="time-to-deliver" class="textlabel">Доставить</label>
            <input type="datetime-local" required class="flatpickr flatpickr-input" name="time-to-deliver" id="time-to-deliver" placeholder="Выберите дату и время">
        </div>`;
        if (form.querySelector('#time-to-pickup') === null) {
            document.querySelector('#address-to').parentElement.insertAdjacentHTML('afterend', htmlString.trim());
            initFlatpickr();
        }
        form.querySelector('.submit-btn').textContent = 'Добавить';
        form.querySelector('h2').textContent = 'Новый заказ';
    }
}
// Активация формы заказа. Здесь разделяется логика двух действий: 
// создания и обновления
function orderCreateUpdateFormActivate() {
    const orderCreateUpdateForm = document.querySelector("#order-create-update-form");
    prepareForm(orderCreateUpdateForm);
    orderCreateUpdateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        try {
            if (orderCreateUpdateForm.dataset.action === 'create'){
                addNewOrder()
                .then((res) => {flipContent('my-orders-list', null, true);})
                .catch((err) => {throw err});
            } else {
                updateMyOrder()
                .then((res) => {flipContent('my-orders-list', null, true);})
                .catch((err) => {throw err});
            }
        } catch (err) {
            showToast(true, err.message);
            throw err;
        }
    })
}
// Активация страницы профиля
function myWorkspaceActivate() {
    // Кнопка добавления средств к балансу
    const addUpBalanceBtn = document.querySelector('#my-workspace .addup-balance-btn');
    addUpBalanceBtn.addEventListener('click', (e) => {
        const money = document.querySelector('#addup-balance-input').value;
        const url = `${apiHost}/api/payment/top_up_the_balance/?sum_to_add=${money}`;
        fetch(url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            }
        })
        .then(handleFetchError)
        .then(response_data => {
            open(`${apiHost}${response_data.success}`, "_blank");
        })
        .catch(err => {
            showToast(true, err.message);
            throw err
        });
    });
    // Форма данных пользователя
    const updateUserInfoForm = document.querySelector('#profile-update-form');
    updateUserInfoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const url = `${apiHost}/api/profile/`;
        let body = {
            phone: updateUserInfoForm.querySelector('#phone').value,
            fullName: updateUserInfoForm.querySelector('#fullName').value
        };
        body = JSON.stringify(body);
        fetch(url, {
            method: 'PATCH',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            },
            body: body
        })
        .then(handleFetchError)
        .then(response_data => {
            showToast(false, 'Successfully updated user info!');
        })
        .catch(err => {
            showToast(true, err.message);
            throw err
        });
    })
}

/* ENTRYPOINT */
// При загрузке странице активируем всё в первый раз
function init () {
    document.addEventListener("DOMContentLoaded", (e) => {
        if (!(localStorage.getItem("isCourier") !== null && localStorage.getItem("isCourier") === "false" && localStorage.getItem("access") !== null)) {
            localStorage.removeItem("isCourier");
            localStorage.removeItem("access");
            location.replace(host + '/login.html');
        }
    });
    initFlatpickr();
    myWorkspaceActivate();
    myOrderListActivate();
    sidebarActivate();
    orderCreateUpdateFormActivate();
    // Первый контент, который мы увидим - страница нашего профиля
    flipContent('my-workspace');
}

init();
