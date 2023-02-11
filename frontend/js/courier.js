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
        let err = new Error(errmsg)
        err.response = response
        err.status = response.status
        throw err
    }
    return json;
}
// Формат вывода даты и времени
const dateOptions = { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
        // Загрузить историю транзакций
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
    else if (contentId === 'free-orders-list') {
        const url = `${apiHost}/api/courier/free-orders/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            }})
        .then(handleFetchError)
        .then(response_data => {
            const orderList = response_data;
            const orderListUL = document.querySelector('#free-orders-list .order-list');
            orderListUL.innerHTML = "";
            orderList.forEach(order => {
                const listItem = createElementFromHTML(`
                <li class="order-list__item" data-order-id=${order.id}>
                    <div class="order-list__item--header">
                        <div class="order-list__item__name">${order.name}</div>
                        <div class="order-list__item__weight">Вес: ${order.weight} кг</div>
                        <div class="order-list__item__action-item--container">
                            <button class="order-list__item__action-item"><i class="fas fa-caret-down"></i></button>
                            ${order.canPickup === true 
                            ? '<button class="order-list__item__action-item"><i class="far fa-handshake"></i></button>' 
                            : ''}
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
                    <div class="order-list__item__detail">...</div>
                </li>`);
                orderListUL.appendChild(listItem);
            });
            orderListUL.childNodes.forEach((listItem) => {
                const url = `${apiHost}/api/orders/${listItem.dataset.orderId}/`;
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
            freeOrdersListActivate();
        })
        .catch(err => {
            showToast(true, err.message);
            throw err
        });
    }
    else if (contentId === 'order-history') {
        const url = `${apiHost}/api/courier/my-orders/history/`;
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
        // текущий заказ
        const url = `${apiHost}/api/courier/current-order/`;
        fetch (url, {
            method: 'GET',
            headers: {
                "Content-Type": 'application/json',
                "Authorization": `JWT ${localStorage.getItem('access')}`
            }})
        .then(handleFetchError)
        .then(response_data => {
            const order = response_data;
            const orderContainer = document.querySelector('#current-order');
            orderContainer.innerHTML = "";
            const orderItem = createElementFromHTML(`
                <div class="order-list__item current-order" data-order-id=${order.id}>
                    <div class="order-list__item--header">
                        <div class="order-list__item__name">${order.name}</div>
                        <div class="order-list__item__weight">Вес: ${order.weight} кг</div>
                        <div class="order-list__item__action-item--container">
                            <button class="order-list__item__action-item"><i class="fas fa-caret-down"></i></button>
                            <button class="order-list__item__action-item"><i class="far fa-check-circle"></i></button>
                            <button class="order-list__item__action-item"><i class="fas fa-ban"></i></button>
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
                    <div class="order-list__item__detail">${order.detail}</div>
                </div>`.trim()
            );
            orderContainer.appendChild(orderItem);
            // Активация кнопок заказа
            orderItem.querySelector('.fa-caret-down').parentElement.addEventListener('click', e => {
                // Отобразить описание заказа
                e.currentTarget.classList.toggle('order-list__item__action-item--active');
                if (e.currentTarget.classList.contains('order-list__item__action-item--active')) {
                    orderItem.querySelector('.order-list__item__detail').style.display = 'block';
                } else {
                    orderItem.querySelector('.order-list__item__detail').style.display = 'none';
                }
            })
            orderItem.querySelector('.fa-check-circle').parentElement.addEventListener('click', (e) => {
                // Завершить заказ
                fetch(url, {
                    method: 'PUT',
                    headers: {
                        "Content-Type": 'application/json',
                        "Authorization": `JWT ${localStorage.getItem('access')}`
                    }})
                .then(handleFetchError)
                .then(response_data => {
                    showToast(false, "Поздравляю, Вы успешно выполнили заказ!");
                    flipContent('order-history');
                })
                .catch(err => {
                    showToast(true, err.message);
                    throw err
                })
            });
            orderItem.querySelector('.fa-ban').parentElement.addEventListener('click', (e) => {
                // Отменить заказ
                fetch(url, {
                    method: 'DELETE',
                    headers: {
                        "Content-Type": 'application/json',
                        "Authorization": `JWT ${localStorage.getItem('access')}`
                    }})
                .then(handleFetchError)
                .then(response_data => {
                    showToast(false, "Заказ отменён.");
                    flipContent('free-orders-list');
                })
                .catch(err => {
                    showToast(true, err.message);
                    throw err
                })
            });
        })
        .catch(err => {
            showToast(true, err.message);
            flipContent('free-orders-list');
            throw err
        });
    }
}



// Активация страницы профиля
function myWorkspaceActivate() {
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
// Активация списка свободных заказов
function freeOrdersListActivate () {
    const freeOrderList = document.querySelector('#free-orders-list .order-list');
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
        listItem.querySelector('.fa-handshake')?.parentElement.addEventListener('click', (e) => {
            // Взять заказ в разработку
            const url = `${apiHost}/api/courier/orders/${listItem.dataset.orderId}/`;
            fetch (url, {
                method: 'POST',
                headers: {
                    "Content-Type": 'application/json',
                    "Authorization": `JWT ${localStorage.getItem('access')}`
                }})
            .then(handleFetchError)
            .then(response_data => {
                showToast(false, 'Вы успешно взяли заказ!');
                flipContent('current-order');
            })
            .catch(err => {
                showToast(true, err.message);
                throw err
            })
        });
    });
}
// Активация сайдбара
function sidebarActivate() {
    const sidebarList = document.querySelector('.sidebar__list');
    sidebarList.querySelectorAll('.sidebar__list__item').forEach((sidebarListItem) => {
        sidebarListItem.addEventListener('click', (e) => {
            const contentId = sidebarListItem.getAttribute('data-content-id');
            flipContent(contentId);
        });
    });
}



/* ENTRYPOINT */
// При загрузке странице активируем всё в первый раз
function init () {
    document.addEventListener("DOMContentLoaded", (e) => {
        if (!(localStorage.getItem("isCourier") !== null && localStorage.getItem("isCourier") === "true" && localStorage.getItem("access") !== null)) {
            localStorage.removeItem("isCourier");
            localStorage.removeItem("access");
            location.replace(host + '/login.html');
        }
    });
    myWorkspaceActivate();
    sidebarActivate();
    freeOrdersListActivate();
    // Первый контент, который мы увидим - страница нашего профиля
    flipContent('my-workspace');
}

init();
